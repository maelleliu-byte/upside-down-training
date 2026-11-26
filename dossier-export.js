/* Dossier post-profilage PC / VC — charte v2 « gris » (voir CHARTE-VISUELLE.md).
   udtDossier.open(data) ouvre un aperçu plein écran du dossier complet (12 pages 1080 × 1350) :
   chaque page se partage (WhatsApp, etc.) ou se télécharge en image, et le dossier entier en PDF.
   data = {
     athlete: "Prénom Nom", gender: "male" | "female",
     run: true | false, mv: "Run" | "Row" | "Bike Erg"…, k: "run" | "row" | "bike"…, p500: bool (allure /500m),
     date: "YYYY-MM-DD", a3: 15.25, a12: 12.9,            // km/h en course, watts sur ergo
     zones: [{z:"Z1", lo:45, hi:72}, … {z:"Z5", lo:100, hi:null}]  // bornes en % de la PC / VC (zonesFor de pc.html)
   }
   Lecture seule : ce module ne lit ni n'écrit aucune donnée, il met en page ce qu'on lui donne. */
(function () {
  "use strict";
  var CREAM = "#F6F4E8", SAGE = "rgba(246,244,232,.72)", ACC = "#14A595", S1C = "#7FF0DF", S2C = "#19C2AE";
  var ZC = { 1: "#3B8FEA", 2: "#22B35E", 3: "#E8C21C", 4: "#F58A1F", 5: "#E5483B", 6: "#9B6CF0", 7: "#E86BB4" };
  var ZN = { 1: "Récupération active", 2: "Endurance fondamentale", 3: "Tempo", 4: "Seuil", 5: "VO2max", 6: "Sprint long", 7: "Sprint court" };
  var ZRPE = { 1: "1/10", 2: "2–3/10", 3: "4–5/10", 4: "6–7/10", 5: "8–10/10", 6: "9–10/10", 7: "Effort max" };
  var SEUILS = [[2, "S1", S1C], [4, "S2", S2C]];
  var DOMAINES = [["MODÉRÉ", [1, 2]], ["ÉLEVÉ", [3, 4]], ["SÉVÈRE", [5]], ["EXTRÊME", [6, 7]]];
  var MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var F_ANTON = "'UDP Anton',Anton,sans-serif", F_SG = "'UDP Grotesk','Space Grotesk',sans-serif", F_IN = "'UDP Inter',Inter,sans-serif";
  var FONTS = [["UDP Anton", 400, "fonts/anton-latin-400-normal.woff2"], ["UDP Grotesk", 500, "fonts/space-grotesk-latin-500-normal.woff2"],
    ["UDP Grotesk", 700, "fonts/space-grotesk-latin-700-normal.woff2"], ["UDP Inter", 400, "fonts/inter-latin-400-normal.woff2"],
    ["UDP Inter", 600, "fonts/inter-latin-600-normal.woff2"]];
  var LIB_IMG = "https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js";
  var LIB_PDF = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";

  /* ---------- utilitaires ---------- */
  function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function fr(v, d) { return Number(v).toFixed(d == null ? 1 : d).replace(".", ","); }
  function n1(v) { return (Math.round(v * 10) / 10).toString(); }
  function pace(kmh) { var s = Math.round(3600 / kmh); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function p500(w) { var s = Math.round(500 * Math.cbrt(2.8 / w)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function dateFR(iso) { var d = new Date(iso + "T12:00:00"); return d.getDate() + " " + MOIS[d.getMonth()] + " " + d.getFullYear(); }
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d; }
  function rgba(h, a) { h = h.replace("#", ""); return "rgba(" + parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," + parseInt(h.slice(4, 6), 16) + "," + a + ")"; }
  function slug(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase(); }

  /* ---------- modèle PC / VC (identique à pc.html) ---------- */
  function Model(d) {
    var m = { d: d, run: !!d.run }, a3 = +d.a3, a12 = +d.a12;
    m.cp = (a12 * 12 - a3 * 3) / 9;
    m.wp = m.run ? (a3 - m.cp) * 50 : (a3 - m.cp) * 180;
    m.ratio = a12 / a3 * 100;
    var f = d.gender === "female";
    m.th = f ? [73, 76, 79, 82] : [71, 74, 77, 80];
    var r = m.ratio;
    m.ei = r < m.th[0] ? 0 : r < m.th[1] ? 1 : r < m.th[2] ? 2 : r < m.th[3] ? 3 : 4;
    var P = f ? "Puissante" : "Puissant", E = f ? "Endurante" : "Endurant";
    m.label = [P + " ++", P + " +", "Intermédiaire", E + " +", E + " ++"][m.ei];
    m.labs = [P + " ++", P + " +", "Intermédiaire", E + " +", E + " ++"];
    m.R = m.run ? "VC" : "PC";
    var def = m.run ? [[1, 45, 72], [2, 72, 80], [3, 80, 88], [4, 88, 100], [5, 100, null]] : [[1, 45, 60], [2, 60, 75], [3, 75, 88], [4, 88, 103], [5, 103, null]];
    m.zones = (d.zones && d.zones.length >= 5) ? d.zones.slice(0, 5).map(function (z) { return [+String(z.z).replace(/\D/g, ""), +z.lo, z.hi == null ? null : +z.hi]; }) : def;
    m.zr = {}; m.zones.forEach(function (z) { m.zr[z[0]] = [z[1], z[2]]; });
    m.at = function (pc) { return m.cp * pc / 100; };
    m.val = function (pc) { return m.run ? fr(m.at(pc)) + " km/h" : Math.round(m.at(pc)) + " W"; };
    m.main = function (v) { return m.run ? pace(v) + " /km" : Math.round(v) + " W"; };          // valeur principale
    m.rngMain = function (lo, hi) {                                                             // « 6:11 – 5:38 /km » ou « 208 – 243 W »
      return m.run ? pace(m.at(lo)) + " – " + pace(m.at(hi)) + " /km" : Math.round(m.at(lo)) + " – " + Math.round(m.at(hi)) + " W";
    };
    m.rngSub = function (lo, hi) {
      return m.run ? fr(m.at(lo)) + "–" + fr(m.at(hi)) + " km/h" : d.p500 ? p500(m.at(lo)) + "–" + p500(m.at(hi)) + " /500m" : "";
    };
    m.res = function () { return m.run ? Math.round(m.wp) + " m" : fr(m.wp / 1000) + " kJ"; };
    m.resName = m.run ? "D′" : "W′";
    return m;
  }

  /* ---------- briques communes ---------- */
  function continuum(cur, size) {
    var o = [];
    DOMAINES.forEach(function (dm, i) {
      dm[1].forEach(function (z) { o.push('<span class="ucz" style="color:' + ZC[z] + ';opacity:' + (cur == null || cur === z ? 1 : .32) + '">Z' + z + '</span>'); });
      if (i < SEUILS.length) o.push('<span class="ucs" style="color:' + SEUILS[i][2] + '">//<small>' + SEUILS[i][1] + '</small></span>');
      else if (i < DOMAINES.length - 1) o.push('<span class="ucs" style="color:rgba(246,244,232,.38)">/<small>&nbsp;</small></span>');
    });
    return '<div class="ucont" style="font-size:' + size + 'px">' + o.join("") + "</div>";
  }
  function sep(k, pad) {
    if (k >= SEUILS.length) return '<div class="usp" style="padding:' + pad + '"><i style="background:rgba(246,244,232,.14)"></i></div>';
    var s = SEUILS[k], nm = s[1] === "S1" ? "SEUIL 1" : "SEUIL 2";
    return '<div class="usp" style="padding:' + pad + '"><i style="background:' + s[2] + '"></i><span style="color:' + s[2] + '">// ' + nm + '</span><i style="background:' + s[2] + '"></i></div>';
  }
  function head(ey, title, top, size) {
    return '<div class="uc uey" style="top:' + top + 'px">' + esc(ey) + "</div>" +
      '<div class="uc" style="top:' + (top + 46) + 'px"><div class="uti" data-fit="940" style="font-size:' + size + 'px">' + esc(title) + "</div></div>" +
      '<div class="uc" style="top:' + (top + 46 + size + 18) + 'px"><div class="ubar"></div></div>';
  }
  function cards(items, top, h) {
    return '<div style="position:absolute;left:60px;right:60px;top:' + top + 'px;display:flex;gap:18px;height:' + h + 'px">' +
      items.map(function (it) { return '<div class="ucard ukc"><div class="ukv" style="color:' + it[2] + '">' + esc(it[0]) + '</div><div class="ukl">' + esc(it[1]) + "</div></div>"; }).join("") + "</div>";
  }

  /* ---------- pages ---------- */
  function pCover(m) {
    var d = m.d, unit = m.run ? "COURSE À PIED" : String(d.mv || "ERGO").toUpperCase();
    var parts = String(d.athlete || "").trim().split(/\s+/).filter(Boolean);
    var name = parts.length ? esc(parts[0].toUpperCase()) + "<br>" + esc(parts.slice(1).join(" ").toUpperCase()) : "TON<br>PROFILAGE";
    return '<div class="uc uey" style="top:230px">TON PROFILAGE · ' + m.R + " · " + esc(unit) + "</div>" +
      '<div class="uc" style="top:282px"><div class="uti" data-fit="960" style="font-size:150px;line-height:164px">' + name + "</div></div>" +
      '<div class="uc" style="top:648px"><div class="ubar"></div></div>' +
      '<div class="uc" style="top:680px;font-weight:700;font-size:30px">' + (d.date ? "Test du " + dateFR(d.date) : "") + "</div>" +
      cards([[m.main(m.cp), m.run ? "vitesse critique · " + fr(m.cp) + " km/h" : "puissance critique" + (d.p500 ? " · " + p500(m.cp) + " /500m" : ""), ACC],
        [fr(m.ratio, 0) + " %", "ratio 12′ / 3′ · profil " + m.label.toLowerCase(), ACC]], 770, 150) +
      '<div class="uc" style="top:980px;font-size:30px;line-height:1.4">Tes zones, ton profil et tes séances,<br><span class="uacc">calculés sur tes propres valeurs.</span></div>' +
      '<div class="uc" style="top:1150px">' + continuum(null, 34) + "</div>";
  }

  function courbeSvg(m) {
    var d = m.d, W = 960, Hh = 520, x0 = 96, x1 = W - 40, y0 = 60, y1 = Hh - 80, tmin = 1.5, tmax = 20, k = m.run ? 3.6 : 1;
    var vOf = function (tm) { return m.cp + (m.wp / (tm * 60)) * k; };
    var vmax = m.cp + m.wp / (tmin * 60) * k * 1.04, vmin = m.cp * 0.9;
    var X = function (tm) { return x0 + (tm - tmin) / (tmax - tmin) * (x1 - x0); };
    var Y = function (v) { return y1 - (v - vmin) / (vmax - vmin) * (y1 - y0); };
    var pts = [];
    for (var t = tmin * 10; t <= tmax * 10; t++) pts.push(n1(X(t / 10)) + " " + n1(Y(vOf(t / 10))));
    var curve = "M" + pts.join(" L"), area = curve + " L" + n1(X(tmax)) + " " + n1(Y(m.cp)) + " L" + n1(X(tmin)) + " " + n1(Y(m.cp)) + " Z";
    var unit = m.run ? "/km" : "W", step = m.run ? 1 : 25, o = ['<svg width="' + W + '" height="' + Hh + '" viewBox="0 0 ' + W + " " + Hh + '" xmlns="http://www.w3.org/2000/svg">'];
    var txt = function (x, y, s, a) { return '<text x="' + n1(x) + '" y="' + n1(y) + '" font-family="' + F_SG + '" ' + (a || "") + ">" + s + "</text>"; };
    for (var v = Math.ceil(vmin / step) * step; v <= vmax; v += step) {
      o.push('<line x1="' + x0 + '" x2="' + x1 + '" y1="' + n1(Y(v)) + '" y2="' + n1(Y(v)) + '" stroke="rgba(246,244,232,.08)"/>');
      o.push(txt(x0 - 14, Y(v) + 6, m.run ? pace(v) : String(v), 'text-anchor="end" font-size="18" fill="' + SAGE + '"'));
    }
    o.push(txt(x0 - 14, y0 - 22, unit, 'text-anchor="end" font-weight="700" font-size="16" fill="' + SAGE + '"'));
    o.push('<path d="' + area + '" fill="' + ZC[5] + '" fill-opacity=".18"/>');
    o.push('<line x1="' + x0 + '" x2="' + x1 + '" y1="' + n1(Y(m.cp)) + '" y2="' + n1(Y(m.cp)) + '" stroke="' + S2C + '" stroke-width="3" stroke-dasharray="12 8"/>');
    o.push('<path d="' + curve + '" fill="none" stroke="' + CREAM + '" stroke-width="4"/>');
    [[3, +d.a3], [12, +d.a12]].forEach(function (p) {
      o.push('<circle cx="' + n1(X(p[0])) + '" cy="' + n1(Y(p[1])) + '" r="11" fill="' + ACC + '" stroke="#161616" stroke-width="3"/>');
      o.push(txt(X(p[0]) + 18, Y(p[1]) - 16, p[0] + "′ · " + (m.run ? pace(p[1]) : Math.round(p[1])) + " " + unit, 'font-weight="700" font-size="24" fill="' + CREAM + '"'));
    });
    o.push(txt(x1, Y(m.cp) + 32, m.R + " " + (m.run ? pace(m.cp) : Math.round(m.cp)) + " " + unit, 'text-anchor="end" font-weight="700" font-size="22" fill="' + S2C + '"'));
    o.push(txt(X(5.2), (Y(vOf(5.2)) + Y(m.cp)) / 2 + 8, "réserve " + m.resName, 'font-weight="700" font-size="20" fill="' + ZC[5] + '"'));
    [2, 5, 10, 15, 20].forEach(function (tm) { o.push(txt(X(tm), y1 + 34, tm + "′", 'text-anchor="middle" font-size="18" fill="' + SAGE + '"')); });
    o.push('<line x1="' + x0 + '" x2="' + x1 + '" y1="' + y1 + '" y2="' + y1 + '" stroke="' + CREAM + '" stroke-width="2"/>');
    o.push(txt(x1, y1 + 64, "durée de l'effort", 'text-anchor="end" font-size="16" fill="' + SAGE + '"'));
    return o.join("") + "</svg>";
  }
  function pTest(m) {
    var d = m.d, a3 = +d.a3, a12 = +d.a12;
    var sub = function (v, sec) { return m.run ? fr(v, 2) + " km/h · " + Math.round(v / 3.6 * sec) + " m" : d.p500 ? p500(v) + " /500m" : ""; };
    return head("TON TEST · 3′ PUIS 12′ À FOND", "TA COURBE", 120, 110) +
      '<div class="ucard" style="position:absolute;left:60px;top:330px;width:960px;height:520px;overflow:hidden">' + courbeSvg(m) + "</div>" +
      cards([["3′ · " + m.main(a3), sub(a3, 180), ACC], ["12′ · " + m.main(a12), sub(a12, 720), ACC]], 880, 120) +
      '<div class="uc" style="top:1040px;font-size:27px;line-height:1.42">Ta <b style="color:' + S2C + '">' + (m.run ? "vitesse" : "puissance") + " critique</b> se rapproche de ton S2.<br>" +
      '<span class="uacc">Au-dessus, l\'effort devient vite limité dans le temps.</span></div>';
  }

  function pZones(m) {
    var d = m.d;
    function row(z) {
      var a, b, pc = "";
      if (z >= 6) { a = m.run ? "< " + pace(+d.a3) + " /km" : "effort max"; b = m.run ? "plus vite que ton 3′" : "au-delà du 3′"; }
      else {
        var lo = m.zr[z][0], hi = m.zr[z][1];
        if (hi == null) { a = m.run ? "< " + pace(m.at(lo)) + " /km" : "> " + Math.round(m.at(lo)) + " W"; b = m.run ? "> " + fr(m.at(lo)) + " km/h" : d.p500 ? "< " + p500(m.at(lo)) + " /500m" : ""; }
        else if (z === 1) { a = m.run ? "> " + pace(m.at(hi)) + " /km" : "< " + Math.round(m.at(hi)) + " W"; b = m.run ? "< " + fr(m.at(hi)) + " km/h" : d.p500 ? "> " + p500(m.at(hi)) + " /500m" : ""; }
        else { a = m.rngMain(lo, hi); b = m.rngSub(lo, hi); }
        pc = " · " + lo + (hi != null ? "–" + hi : "+") + " % " + m.R;
      }
      return '<div class="qzr"><i style="background:' + ZC[z] + '"></i><div class="qzn"><b style="color:' + ZC[z] + '">Z' + z + "</b> " + ZN[z] +
        "<small>RPE " + ZRPE[z] + pc + '</small></div><div class="qzw">' + esc(a) + "<small>" + esc(b) + "</small></div></div>";
    }
    var parts = [];
    DOMAINES.forEach(function (dm, k) {
      parts.push('<div class="qdm">DOMAINE ' + dm[0] + "</div>");
      dm[1].forEach(function (z) { parts.push(row(z)); });
      if (k < DOMAINES.length - 1) parts.push(sep(k, "6px 0"));
    });
    return '<div class="uc" style="top:100px">' + continuum(null, 30) + "</div>" +
      '<div class="uc" style="top:156px"><div class="uti" style="font-size:104px">TES 7 ZONES</div></div>' +
      '<div class="uc" style="top:274px"><div class="ubar"></div></div>' +
      '<div class="ucard" style="position:absolute;left:60px;top:302px;width:960px;padding:8px 30px">' + parts.join("") + "</div>";
  }

  function orientation(m) {
    var R = m.R, title, why, prio;
    if (m.ei <= 1) {
      title = "Profil puissant : priorité à la " + R;
      why = "Tu produis beaucoup sur 3′ grâce à ta réserve, mais ta " + R + " est basse par rapport à ce potentiel : tu t'uses vite dès que l'effort dure.";
      prio = ["Monter ta " + R + " : volume en Z2 et blocs longs proches de la " + R,
        "Tempo / seuil : 2 × 20′ à " + m.val(88) + "–" + m.val(95) + ", puis 4 × 10′ à " + m.val(95) + "–" + m.val(100),
        "La réserve s'entretient avec une séance courte par semaine, pas plus"];
    } else if (m.ei >= 3) {
      title = "Profil endurant : développer la réserve";
      why = "Ta " + R + " est haute par rapport à ton 3′ : tu tiens longtemps, mais tu manques de « carburant » au-dessus de la " + R + " pour les attaques, les relances et les fins de course.";
      prio = ["Travail au-dessus de ta " + R + " (domaine sévère) : 1 à 2 séances par semaine", "Intervalles courts et VO2max, sprints, et force-vitesse en salle", "Garder la Z2 pour ne pas perdre ta base"];
    } else {
      title = "Profil intermédiaire : alterner les blocs";
      why = R + " et réserve sont en bon rapport : on alterne les blocs pour faire monter toute la courbe.";
      prio = ["Bloc de 4–6 semaines orienté seuil, puis bloc orienté VO2max", "Z2 majoritaire (environ 75 % du volume)", "Re-tester à la fin de chaque bloc"];
    }
    return { title: title, why: why, prio: prio };
  }
  function gaugeSvg(m) {
    var W = 960, Hh = 230, lo = 64, hi = 90, x0 = 40, x1 = W - 40, yb = 110;
    var X = function (r) { return x0 + (Math.min(Math.max(r, lo), hi) - lo) / (hi - lo) * (x1 - x0); };
    var cuts = [lo].concat(m.th, [hi]), cols = [ZC[7], ZC[6], ZC[3], ZC[2], ZC[1]];
    var o = ['<svg width="' + W + '" height="' + Hh + '" viewBox="0 0 ' + W + " " + Hh + '" xmlns="http://www.w3.org/2000/svg">'];
    for (var i = 0; i < 5; i++) {
      var a = X(cuts[i]), b = X(cuts[i + 1]), on = i === m.ei;
      o.push('<rect x="' + n1(a + 2) + '" y="' + yb + '" width="' + n1(b - a - 4) + '" height="26" rx="6" fill="' + cols[i] + '" fill-opacity="' + (on ? 1 : .28) + '"/>');
    }
    // libellés : celui du profil en grand sous son segment, les autres seulement aux extrémités (pas de chevauchement)
    var mid = function (i) { return (X(cuts[i]) + X(cuts[i + 1])) / 2; };
    [0, 4].forEach(function (i) { if (i !== m.ei) o.push('<text x="' + n1(mid(i)) + '" y="' + (yb + 64) + '" text-anchor="middle" font-family="' + F_SG + '" font-weight="700" font-size="16" fill="' + SAGE + '">' + esc(m.labs[i]) + "</text>"); });
    var xm = Math.min(Math.max(mid(m.ei), 130), W - 130);
    o.push('<text x="' + n1(xm) + '" y="' + (yb + 66) + '" text-anchor="middle" font-family="' + F_SG + '" font-weight="700" font-size="21" fill="' + CREAM + '">' + esc(m.label) + "</text>");
    m.th.forEach(function (c) { o.push('<text x="' + n1(X(c)) + '" y="' + (yb - 12) + '" text-anchor="middle" font-family="' + F_SG + '" font-size="15" fill="' + SAGE + '">' + c + " %</text>"); });
    var xr = X(m.ratio);
    o.push('<path d="M' + n1(xr - 16) + " " + (yb - 58) + " L" + n1(xr + 16) + " " + (yb - 58) + " L" + n1(xr) + " " + (yb - 30) + ' Z" fill="' + CREAM + '"/>');
    o.push('<text x="' + n1(xr) + '" y="' + (yb - 70) + '" text-anchor="middle" font-family="' + F_ANTON + '" font-size="40" fill="' + CREAM + '">' + fr(m.ratio, 0) + " %</text>");
    return o.join("") + "</svg>";
  }
  function pProfil(m) {
    var o = orientation(m);
    var items = o.prio.map(function (p, i) { return '<div class="qpr"><b>' + (i + 1) + "</b><span>" + esc(p) + "</span></div>"; }).join("");
    return head("TON PROFIL ÉNERGÉTIQUE · RATIO 12′ / 3′", m.label.toUpperCase(), 110, 110) +
      '<div class="ucard" style="position:absolute;left:60px;top:310px;width:960px;height:230px">' + gaugeSvg(m) + "</div>" +
      '<div class="uc" style="top:572px;font-weight:700;font-size:32px">' + esc(o.title) + "</div>" +
      '<div class="uc" style="top:624px;font-size:25px;line-height:1.42;color:' + SAGE + '">' + esc(o.why) + "</div>" +
      '<div class="uc uey" style="top:790px;font-size:22px">TES PRIORITÉS</div>' +
      '<div class="ucard" style="position:absolute;left:60px;top:834px;width:960px;padding:14px 30px">' + items + "</div>";
  }

  /* ---------- séances ---------- */
  function warmup(top, accels) {
    var s = [[10, 2, "wu"]];
    if (accels) { [5, 6, 7].forEach(function (z) { s.push([0.2, z, "wu"], [1, 2, "rec"]); }); s[s.length - 1][0] = 2.4; }
    else { ({ 3: [3, 3, 3, 3], 4: [3, 3, 4, 4], 5: [3, 4, 4, 5] })[top].forEach(function (z) { s.push([0.5, z, "wu"], [0.5, 2, "rec"]); }); s[s.length - 1][0] = 1.5; }
    return s;
  }
  function blocs(top, work, opt, rec, n, cd) {
    var s = warmup(top);
    for (var k = 0; k < n; k++) { s.push([work, top, "work"]); if (opt) s.push([opt, top, "opt"]); s.push([rec, 2, "rec"]); }
    s[s.length - 1] = [cd || 5, 2, "cd"];
    return s;
  }
  function vo2court() {
    var s = warmup(5);
    for (var b = 0; b < 2; b++) { for (var i = 0; i < 12; i++) s.push([0.5, 5, i < 8 ? "work" : "opt"], [0.5, 2, "rec"]); s[s.length - 1][0] = b === 0 ? 3 : 0.5; }
    return s.concat([[5, 2, "cd"]]);
  }
  function chartSvg(s, W, Hh) {
    var segs = s.segments, z = s.zone, zc = ZC[z], x0 = 112, x1 = W - 36, base = Hh - 92, top = 62, step = (base - top) / 7, px = (x1 - x0) / 60;
    var o = ['<svg width="' + W + '" height="' + Hh + '" viewBox="0 0 ' + W + " " + Hh + '" xmlns="http://www.w3.org/2000/svg">'];
    for (var zz = 1; zz <= 7; zz++) {
      var y = base - zz * step, op = zz === z ? 1 : .55;
      o.push('<line x1="' + x0 + '" y1="' + n1(y) + '" x2="' + x1 + '" y2="' + n1(y) + '" stroke="rgba(246,244,232,.12)" stroke-width="1" stroke-dasharray="3 6"/>');
      o.push('<circle cx="40" cy="' + n1(y + 1) + '" r="6" fill="' + ZC[zz] + '" opacity="' + op + '"/>');
      o.push('<text x="56" y="' + n1(y + 7) + '" font-family="' + F_SG + '" font-weight="' + (zz === z ? 700 : 500) + '" font-size="19" fill="' + CREAM + '" opacity="' + op + '">Z' + zz + "</text>");
    }
    SEUILS.forEach(function (sl) {
      var y = base - (sl[0] + .5) * step;
      o.push('<line x1="' + x0 + '" y1="' + n1(y) + '" x2="' + x1 + '" y2="' + n1(y) + '" stroke="' + sl[2] + '" stroke-width="2" stroke-dasharray="10 6" opacity=".9"/>');
      o.push('<text x="' + x1 + '" y="' + n1(y - 7) + '" text-anchor="end" font-family="' + F_SG + '" font-weight="700" font-size="15" letter-spacing="1.5" fill="' + sl[2] + '">' + sl[1] + "</text>");
    });
    var t = 0, workX = [], wuEnd = null, maxZ = 0;
    segs.forEach(function (sg) {
      var dd = sg[0], zz = sg[1], kind = sg[2], x = x0 + t * px;
      var w = Math.max(dd * px, (kind === "work" || kind === "opt" || kind === "wu") && dd < 1 ? 4 : dd * px), h = zz * step, c = ZC[zz], fill, extra = "";
      maxZ = Math.max(maxZ, zz);
      if (kind === "work") { fill = c; workX.push([x, x + w]); }
      else if (kind === "opt") { fill = rgba(c, .28); extra = ' stroke="' + c + '" stroke-width="1.5" stroke-dasharray="4 3"'; workX.push([x, x + w]); }
      else if (kind === "wu") fill = zz > 2 ? rgba(c, .75) : ZC[2];
      else fill = ZC[2];
      var gap = w > 6 ? 1.2 : 0;
      o.push('<rect x="' + n1(x) + '" y="' + n1(base - h) + '" width="' + n1(Math.max(w - gap, 2)) + '" height="' + n1(h) + '" rx="2" fill="' + fill + '"' + extra + "/>");
      if ((kind === "work" || kind === "opt") && wuEnd == null) wuEnd = x;
      t += dd;
    });
    if (s.marqueurs) for (var k = s.marqueurs; k <= 40; k += s.marqueurs)
      o.push('<circle cx="' + n1(x0 + k * px) + '" cy="' + n1(base - z * step) + '" r="7" fill="#161616" stroke="' + CREAM + '" stroke-width="2.5"/>');
    o.push('<line x1="' + x0 + '" y1="' + (base + 1) + '" x2="' + (x1 + 10) + '" y2="' + (base + 1) + '" stroke="' + CREAM + '" stroke-width="2"/>');
    o.push('<path d="M' + (x1 + 10) + " " + (base - 6) + " L" + (x1 + 22) + " " + (base + 1) + " L" + (x1 + 10) + " " + (base + 8) + 'Z" fill="' + CREAM + '"/>');
    [0, 15, 30, 45, 60].forEach(function (tt) {
      var x = x0 + tt * px;
      o.push('<line x1="' + n1(x) + '" y1="' + (base + 1) + '" x2="' + n1(x) + '" y2="' + (base + 10) + '" stroke="' + CREAM + '" stroke-width="2"/>');
      o.push('<text x="' + n1(x) + '" y="' + (base + 38) + '" text-anchor="middle" font-family="' + F_IN + '" font-size="19" fill="' + SAGE + '">' + tt + "′</text>");
    });
    if (workX.length) {
      var cx = (workX[0][0] + workX[workX.length - 1][1]) / 2, ly = base - maxZ * step - 22;
      SEUILS.slice().reverse().forEach(function (sl) { var sy = base - (sl[0] + .5) * step; if (Math.abs(ly - 8 - sy) < 18) ly = sy - 12; });
      o.push('<text x="' + n1(cx) + '" y="' + n1(ly) + '" text-anchor="middle" font-family="' + F_SG + '" font-weight="700" font-size="24" fill="' + zc + '">' + esc(s.label_bloc) + "</text>");
    }
    if (wuEnd && wuEnd > x0 + 60) {
      var wcx = (x0 + x0 + 10 * px) / 2, yb = base - 2 * step, sub = z >= 6 ? "+ 3 accél." : "+ 4 × 30″/30″";
      [["ÉCHAUFFEMENT", 600, 14], ["10′ Z2", 400, 15], [sub, 400, 15]].forEach(function (l, i) {
        o.push('<text x="' + n1(wcx) + '" y="' + n1(yb + 26 + i * 21) + '" text-anchor="middle" font-family="' + F_IN + '" font-weight="' + l[1] + '" font-size="' + l[2] + '" fill="' + CREAM + '">' + l[0] + "</text>");
      });
    }
    var legY = Hh - 22, items = [["Travail", zc, null]];
    if (segs.some(function (x) { return x[2] === "opt"; })) items.push(["Optionnel", rgba(zc, .28), zc]);
    if (segs.some(function (x) { return x[2] === "rec" || x[2] === "cd" || x[2] === "wu"; })) items.push(["Récup / Z2 facile", ZC[2], null]);
    if (s.marqueurs) items.push(["Mesure FC + RPE", null, CREAM]);
    var lx = x0;
    items.forEach(function (it) {
      if (it[1] == null) o.push('<circle cx="' + (lx + 8) + '" cy="' + (legY - 6) + '" r="6" fill="#161616" stroke="' + it[2] + '" stroke-width="2.5"/>');
      else o.push('<rect x="' + lx + '" y="' + (legY - 14) + '" width="16" height="16" rx="3" fill="' + it[1] + '"' + (it[2] ? ' stroke="' + it[2] + '" stroke-width="1.5" stroke-dasharray="3 2"' : "") + "/>");
      o.push('<text x="' + (lx + 26) + '" y="' + legY + '" font-family="' + F_IN + '" font-size="17" fill="' + SAGE + '">' + it[0] + "</text>");
      lx += 26 + it[0].length * 9.2 + 34;
    });
    return o.join("") + "</svg>";
  }
  function seances(m) {
    var d = m.d, LAB = m.run ? "allure /km" : "puissance (W)", bikeLike = /bike/i.test(d.k || d.mv || "");
    var A = function (lo, hi) { return m.rngMain(lo, hi); }, Ash = function (lo, hi) { return A(lo, hi).replace(" /km", "").replace(" W", ""); };
    var z = m.zr, out = [];
    out.push(m.run ? {
      zone: 1, titre: "Récupération active", prescription: "20–30′ footing très facile", rpe: "> " + pace(m.at(z[1][1])) + " /km",
      stats: [["20–30′", "durée totale"], ["> " + pace(m.at(z[1][1])), LAB], ["1", "RPE cible"]], segments: [[20, 1, "work"], [10, 1, "opt"]],
      label_bloc: "20–30′ très facile · RPE 1", objectif: "Récupérer activement : faire circuler le sang sans ajouter de fatigue. Ça doit rester très facile !",
      releve: "FC et RPE en fin de séance : la FC doit rester basse et stable du début à la fin."
    } : {
      zone: 1, titre: "Récupération active", prescription: "30′ continu" + (bikeLike ? " · > 75 rpm" : ""), rpe: "< " + Math.round(m.at(z[1][1])) + " W",
      stats: [["30′", "durée totale"], bikeLike ? ["> 75", "rpm (cadence)"] : ["< " + Math.round(m.at(z[1][1])), LAB], ["1", "RPE cible"]], segments: [[30, 1, "work"]],
      label_bloc: "30′ très facile · RPE 1", objectif: "Récupérer activement : faire circuler le sang sans ajouter de fatigue. Ça doit rester très facile !",
      releve: "FC et RPE en fin de séance : la FC doit rester basse et stable du début à la fin."
    });
    out.push({
      zone: 2, titre: "Endurance fondamentale", ey: "SÉANCE REPÈRE", prescription: "30–40′ continu", rpe: A(z[2][0], z[2][1]),
      stats: [["30–40′", "durée totale"], [Ash(z[2][0], z[2][1]), LAB], ["2–3", "RPE cible"]], segments: [[30, 2, "work"], [10, 2, "opt"]], marqueurs: 5,
      label_bloc: "FC + RPE toutes les 5′",
      objectif: (m.run ? "L'allure" : "La puissance") + " est une tendance : c'est la sensation qui prime, on reste facile et en aisance respiratoire.",
      releve: "Suivre la dérive cardiaque : FC et RPE toutes les 5′. À " + (m.run ? "allure" : "puissance") + " égale, la FC doit rester stable d'une séance à l'autre."
    });
    out.push({
      zone: 3, titre: "Tempo long", prescription: "3 × 8–10′ / 2′", rpe: A(z[3][0], z[3][1]),
      stats: [["50–55′", "durée totale"], [Ash(z[3][0], z[3][1]), LAB], ["4–5", "RPE cible"]], segments: blocs(3, 8, 2, 2, 3),
      label_bloc: "3 × 8–10′ / 2′", objectif: "Travailler juste au-dessus du 1er seuil : beaucoup de volume soutenu pour un coût maîtrisé.",
      releve: "RPE et FC à la fin de chaque bloc."
    });
    var s4lo = 95, s4hi = 100;
    out.push({
      zone: 4, titre: "Seuil", ey: "SÉANCE REPÈRE", prescription: "3 × 6–8′ / 2′", rpe: A(s4lo, s4hi),
      stats: [["45–50′", "durée totale"], [Ash(s4lo, s4hi), LAB], ["6–7", "RPE cible"]], segments: blocs(4, 6, 2, 2, 3),
      label_bloc: "3 × 6–8′ / 2′",
      objectif: (m.run ? "Courir" : "Travailler") + " juste sous ta " + m.R + ", proche de ton S2 : effort soutenu mais contrôlé, " + (m.run ? "allure" : "puissance") + " stable du premier au dernier bloc.",
      releve: (m.run ? "Allure" : "Puissance") + " moyenne et FC de chaque bloc."
    });
    var v30 = m.main(m.at(115));
    out.push({
      zone: 5, titre: "VO2max court", prescription: "2 × (8–12 × 30″/30″)", rpe: v30,
      stats: [["~45′", "durée totale"], [v30.replace(" /km", "").replace(" W", ""), LAB + " sur les 30″"], ["8–10", "RPE cible"]], segments: vo2court(),
      label_bloc: "2 × (8–12 × 30″/30″) · 3′ entre les blocs",
      objectif: "Accumuler du temps à haute intensité en limitant la fatigue. Commencer à 8 répétitions, monter jusqu'à 12.",
      releve: "Variante : 4 × 4′ à " + A(105, 110) + ", récup 3′."
    });
    var s6 = warmup(6, true);
    for (var k = 0; k < 6; k++) s6.push([1, 6, k < 4 ? "work" : "opt"], [4, 2, "rec"]);
    s6[s6.length - 1] = [6, 2, "cd"];
    out.push({
      zone: 6, titre: "Sprint long", prescription: "4–6 × 1′ / 4′", rpe: m.run ? "< " + pace(+d.a3) + " /km" : "RPE 9,5", segments: s6,
      stats: [["40–50′", "durée totale"], ["4′", "de récup"], ["9,5", "RPE cible"]], label_bloc: "4–6 × 1′ / 4′ · RPE 9,5",
      objectif: "Développer ta capacité tampon : supporter et relancer malgré l'acidité. Plus " + (m.run ? "vite que ton allure" : "fort que ta puissance") + " du 3′.",
      releve: m.run ? "Distance de chaque 1′ et RPE de séance : la distance doit rester proche d'une répétition à l'autre."
        : "Puissance moyenne de chaque 1′ et RPE de séance." + (bikeLike ? " Variante vélo : 3 × 30″ all out / 5′." : "")
    });
    var s7 = warmup(7, true);
    for (var j = 0; j < 12; j++) s7.push([0.2, 7, j < 6 ? "work" : "opt"], [2.5, 2, "rec"]);
    s7.pop(); s7.push([5, 2, "cd"]);
    out.push({
      zone: 7, titre: "Sprint court", prescription: "6–12 × 12″ / 2′30", rpe: "all out", segments: s7,
      stats: [["~50′", "durée totale"], ["2′30", "de récup"], ["100 %", "effort"]], label_bloc: "6–12 × 12″ / 2′30 · all out",
      objectif: "Qualités neuromusculaires et fibres rapides. Arrêter la série si la " + (m.run ? "vitesse" : "puissance") + " chute nettement.",
      releve: m.run ? "Allure de pointe de chaque sprint (montre ou GPS)." : "Pic de puissance de chaque sprint."
    });
    return out;
  }
  function pSeance(s) {
    var zc = ZC[s.zone];
    var stats = s.stats.map(function (st, i) {
      return '<div class="ucard qst"><div class="qsv" style="color:' + (i === 2 ? zc : CREAM) + ";font-size:" + (st[0].length <= 6 ? 56 : 46) + 'px">' + esc(st[0]) + '</div><div class="qsl">' + esc(st[1]) + "</div></div>";
    }).join("");
    return '<div class="uc" style="top:104px">' + continuum(s.zone, 30) + "</div>" +
      '<div class="uc uey" style="top:170px;font-size:22px">ZONE ' + s.zone + (s.ey ? " · " + s.ey : "") + "</div>" +
      '<div class="uc" style="top:204px"><div class="uti" data-fit="940" style="font-size:112px">' + esc(s.titre) + "</div></div>" +
      '<div class="uc" style="top:328px"><div class="ubar"></div></div>' +
      '<div class="uc" style="top:350px;font-weight:700;font-size:40px;white-space:nowrap" data-fitw="960">' + esc(s.prescription) + '<span style="color:' + zc + '"> · ' + esc(s.rpe) + "</span></div>" +
      '<div class="ucard" style="position:absolute;left:60px;top:418px;width:960px;height:466px;overflow:hidden">' + chartSvg(s, 960, 466) + "</div>" +
      '<div style="position:absolute;left:60px;right:60px;top:904px;display:flex;gap:20px">' + stats + "</div>" +
      '<div class="uc" style="top:1066px;font-size:29px;line-height:1.38">' + esc(s.objectif) + "</div>" +
      '<div class="uc uacc" style="top:1196px;font-size:24px;line-height:1.4">' + esc(s.releve) + "</div>";
  }
  function pSuite(m) {
    var d = m.d, o = orientation(m), win = "";
    if (d.date) { var a = addDays(d.date, 42), b = addDays(d.date, 56); win = " : " + a.getDate() + " " + MOIS[a.getMonth()] + " – " + b.getDate() + " " + MOIS[b.getMonth()] + " " + b.getFullYear(); }
    var steps = [["On construit ton plan", "Un plan d'entraînement calé sur tes zones et tes " + (m.run ? "allures" : "puissances") + "."],
      ["On choisit la direction", "On travaille ensemble l'orientation à prendre : " + o.title.charAt(0).toLowerCase() + o.title.slice(1) + "."],
      ["On re-teste", "Nouveau test 3′ / 12′ pour mesurer la progression" + win + "."]];
    return head("LA SUITE", "ET MAINTENANT ?", 150, 116) +
      '<div class="ucard" style="position:absolute;left:60px;top:360px;width:960px;padding:14px 32px">' +
      steps.map(function (s, i) { return '<div class="qpr qpr2"><b>' + (i + 1) + "</b><span>" + esc(s[0]) + "<small>" + esc(s[1]) + "</small></span></div>"; }).join("") + "</div>" +
      '<div class="uc" style="top:920px;font-size:30px;line-height:1.4">On en parle ?<br><span class="uacc">Réserve un call.</span></div>';
  }

  function pages(d) {
    var m = Model(d), list = [["Couverture", pCover(m)], ["Ta courbe", pTest(m)], ["Tes 7 zones", pZones(m)], ["Ton profil", pProfil(m)]];
    seances(m).forEach(function (s) { list.push(["Z" + s.zone + " · " + s.titre, pSeance(s)]); });
    list.push(["Et maintenant ?", pSuite(m)]);
    return { m: m, list: list };
  }

  /* ---------- styles (préfixés pour ne pas toucher l'app) ---------- */
  var CSS = FONTS.map(function (f) { return "@font-face{font-family:'" + f[0] + "';font-weight:" + f[1] + ";font-style:normal;font-display:block;src:url(" + f[2] + ") format('woff2')}"; }).join("") +
    ".udp{width:1080px;height:1350px;position:relative;overflow:hidden;color:" + CREAM + ";font-family:" + F_SG + ";font-weight:500;font-size:16px;line-height:normal;letter-spacing:normal;text-align:left;" +
    "background:#161616 url(img/fond-gris.jpg) center/cover;-webkit-font-smoothing:antialiased}" +
    ".udp *{box-sizing:border-box;margin:0;padding:0}" +
    ".udp .ulogo{position:absolute;right:62px;top:70px;width:56px;height:auto}" +
    ".udp .uc{position:absolute;left:60px;right:60px;text-align:center}" +
    ".udp .uey{font-weight:700;font-size:27px;letter-spacing:.24em;color:" + ACC + "}" +
    ".udp .uti{display:inline-block;font-family:" + F_ANTON + ";font-weight:400;line-height:1;transform:skewX(-11deg);white-space:nowrap;text-transform:uppercase}" +
    ".udp .ubar{width:240px;height:8px;background:" + ACC + ";margin:0 auto}" +
    ".udp .ucard{background:rgba(0,0,0,.34);border:1px solid rgba(246,244,232,.08);border-radius:16px}" +
    ".udp .uacc{color:" + ACC + "}" +
    ".udp .ucont{display:inline-flex;align-items:flex-start;gap:.5em;font-family:" + F_ANTON + ";transform:skewX(-11deg)}" +
    ".udp .ucs{display:inline-flex;flex-direction:column;align-items:center;line-height:1;margin:0 .15em}" +
    ".udp .ucs small{font-family:" + F_SG + ";font-weight:700;font-size:.42em;letter-spacing:.12em;margin-top:.25em;transform:skewX(11deg)}.udp .ucz{line-height:1}" +
    ".udp .ukc{flex:1;padding:20px 14px;text-align:center;display:flex;flex-direction:column;justify-content:center}" +
    ".udp .ukv{font-family:" + F_ANTON + ";font-size:52px;line-height:1.05;transform:skewX(-10deg)}" +
    ".udp .ukl{font-size:19px;color:" + SAGE + ";margin-top:6px;line-height:1.3}" +
    ".udp .usp{display:flex;align-items:center;gap:16px}.udp .usp i{flex:1;height:2px;border-radius:1px;opacity:.85}" +
    ".udp .usp span{font-weight:700;font-size:17px;letter-spacing:.22em;white-space:nowrap}" +
    ".udp .qdm{font-weight:700;font-size:15px;letter-spacing:.24em;color:" + SAGE + ";padding:8px 0 0}" +
    ".udp .qzr{display:flex;align-items:center;gap:20px;height:88px;position:relative}" +
    ".udp .qzr i{width:8px;height:54px;border-radius:4px;flex:none}" +
    ".udp .qzn{flex:1;font-weight:700;font-size:27px}.udp .qzn b{font-family:" + F_ANTON + ";font-weight:400;font-size:34px;display:inline-block;transform:skewX(-11deg);margin-right:8px}" +
    ".udp .qzn small{display:block;font-weight:500;font-size:18px;color:" + SAGE + ";margin-top:2px}" +
    ".udp .qzw{text-align:right;font-family:" + F_ANTON + ";font-size:36px;color:" + ACC + ";white-space:nowrap;transform:skewX(-8deg)}" +
    ".udp .qzw small{display:block;font-family:" + F_SG + ";font-weight:500;font-size:18px;color:" + SAGE + ";transform:skewX(8deg)}" +
    ".udp .qpr{display:flex;align-items:center;gap:22px;min-height:104px;border-bottom:1px solid rgba(246,244,232,.1)}.udp .qpr:last-child{border-bottom:none}" +
    ".udp .qpr b{font-family:" + F_ANTON + ";font-weight:400;font-size:46px;color:" + ACC + ";transform:skewX(-10deg);width:40px;text-align:center;flex:none}" +
    ".udp .qpr span{font-weight:700;font-size:26px;line-height:1.35;text-align:left}" +
    ".udp .qpr2{min-height:170px;gap:26px}.udp .qpr2 b{font-size:64px;width:52px}.udp .qpr2 span{font-size:32px;line-height:1.3}" +
    ".udp .qpr2 small{display:block;font-weight:500;font-size:23px;color:" + SAGE + ";margin-top:6px;line-height:1.35}" +
    ".udp .qst{flex:1;padding:18px 10px 16px;text-align:center}.udp .qsv{font-family:" + F_ANTON + ";font-size:56px;line-height:1.05;transform:skewX(-11deg)}" +
    ".udp .qsl{font-size:20px;color:" + SAGE + ";margin-top:4px}" +
    /* panneau d'aperçu */
    ".udpx{position:fixed;inset:0;z-index:9999;background:rgba(10,10,10,.96);overflow:auto;-webkit-overflow-scrolling:touch;font-family:" + F_SG + ";color:" + CREAM + "}" +
    ".udpx-bar{position:sticky;top:0;z-index:2;display:flex;gap:8px;align-items:center;padding:12px 14px;background:rgba(14,14,14,.96);border-bottom:1px solid rgba(246,244,232,.1)}" +
    ".udpx-bar b{flex:1;font:400 20px " + F_ANTON + ";text-transform:uppercase;transform:skewX(-9deg);letter-spacing:.01em}" +
    ".udpx button{font:700 14px " + F_SG + ";border-radius:10px;padding:10px 14px;border:1px solid rgba(246,244,232,.18);background:transparent;color:" + CREAM + ";cursor:pointer}" +
    ".udpx button.pri{background:" + ACC + ";border-color:" + ACC + ";color:#fff}.udpx button:disabled{opacity:.45;cursor:default}" +
    ".udpx-msg{padding:10px 16px;font-size:13px;color:" + SAGE + "}" +
    ".udpx-list{display:flex;flex-wrap:wrap;gap:22px;justify-content:center;padding:12px 12px 60px}" +
    ".udpx-it{display:flex;flex-direction:column;gap:8px;align-items:stretch}" +
    ".udpx-pv{position:relative;overflow:hidden;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5)}" +
    ".udpx-pv>div{position:absolute;left:0;top:0;transform-origin:0 0}" +
    ".udpx-row{display:flex;gap:8px;align-items:center}.udpx-row span{flex:1;font-size:13px;color:" + SAGE + "}";

  function injectCSS() { if (document.getElementById("udp-css")) return; var s = document.createElement("style"); s.id = "udp-css"; s.textContent = CSS; document.head.appendChild(s); }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) { var t = setInterval(function () { if ((src === LIB_IMG && window.htmlToImage) || (src === LIB_PDF && window.jspdf)) { clearInterval(t); res(); } }, 50); return; }
      var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { rej(new Error("Chargement impossible : " + src)); }; document.head.appendChild(s);
    });
  }
  var fontCSS = null;
  function toDataURL(url) { return fetch(url).then(function (r) { return r.blob(); }).then(function (b) { return new Promise(function (res) { var fr_ = new FileReader(); fr_.onload = function () { res(fr_.result); }; fr_.readAsDataURL(b); }); }); }
  function getFontCSS() {
    if (fontCSS) return Promise.resolve(fontCSS);
    return Promise.all(FONTS.map(function (f) { return toDataURL(f[2]).then(function (u) { return "@font-face{font-family:'" + f[0] + "';font-weight:" + f[1] + ";font-style:normal;src:url(" + u + ") format('woff2')}"; }); }))
      .then(function (a) { fontCSS = a.join(""); return fontCSS; });
  }
  function fit(root) {
    root.querySelectorAll("[data-fit]").forEach(function (e) { var s = parseFloat(getComputedStyle(e).fontSize), mx = +e.dataset.fit; while (e.scrollWidth > mx && s > 40) { s -= 2; e.style.fontSize = s + "px"; } });
    root.querySelectorAll("[data-fitw]").forEach(function (e) { var s = parseFloat(getComputedStyle(e).fontSize), mx = +e.dataset.fitw; while (e.scrollWidth > mx && s > 22) { s -= 1; e.style.fontSize = s + "px"; } });
  }
  function dataURLtoBlob(u) { var p = u.split(","), mime = p[0].match(/:(.*?);/)[1], b = atob(p[1]), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return new Blob([a], { type: mime }); }
  function shareOrDownload(blob, name) {
    var file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: name }).catch(function (e) { if (!e || e.name !== "AbortError") download(blob, name); });
    }
    download(blob, name); return Promise.resolve();
  }
  function download(blob, name) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }

  /* ---------- aperçu + exports ---------- */
  function open(d) {
    injectCSS();
    var P = pages(d), base = "dossier-" + (P.m.run ? "vc" : "pc") + (d.athlete ? "-" + slug(d.athlete) : "");
    var old = document.querySelector(".udpx"); if (old) old.remove();
    var ov = document.createElement("div"); ov.className = "udpx"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Dossier de profilage");
    var W = Math.min(window.innerWidth - 32, 380), sc = W / 1080;
    ov.innerHTML = '<div class="udpx-bar"><b>Dossier de profilage</b><button class="pri" data-x="pdf" disabled>PDF complet</button><button data-x="close" aria-label="Fermer">✕</button></div>' +
      '<div class="udpx-msg">Préparation des pages…</div><div class="udpx-list">' +
      P.list.map(function (p, i) {
        return '<div class="udpx-it" style="width:' + W + 'px"><div class="udpx-pv" style="width:' + W + "px;height:" + Math.round(W * 1.25) + 'px"><div style="transform:scale(' + sc + ')"><div class="udp" data-i="' + i + '"><img class="ulogo" src="img/logo-creme.png" alt="">' + p[1] + "</div></div></div>" +
          '<div class="udpx-row"><span>' + (i + 1) + ". " + esc(p[0]) + '</span><button data-x="img" data-i="' + i + '" disabled>Partager</button></div></div>';
      }).join("") + "</div>";
    document.body.appendChild(ov);
    var prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    var msg = ov.querySelector(".udpx-msg"), shots = [];
    function close() { ov.remove(); document.body.style.overflow = prevOverflow; }
    var ready = (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () {
      return Promise.all(FONTS.map(function (f) { return document.fonts ? document.fonts.load(f[1] + " 20px '" + f[0] + "'") : null; }));
    }).then(function () { fit(ov); return Promise.all([loadScript(LIB_IMG), getFontCSS()]); }).then(function (r) {
      var nodes = ov.querySelectorAll(".udp"), fcss = r[1], i = 0;
      function next() {
        if (i >= nodes.length) return Promise.resolve();
        msg.textContent = "Préparation des pages… " + (i + 1) + " / " + nodes.length;
        return window.htmlToImage.toJpeg(nodes[i], { width: 1080, height: 1350, pixelRatio: 1, quality: 0.92, backgroundColor: "#161616", fontEmbedCSS: fcss, cacheBust: false })
          .then(function (u) { shots[i] = u; var b = ov.querySelector('button[data-x="img"][data-i="' + i + '"]'); if (b) b.disabled = false; i++; return next(); });
      }
      return next();
    }).then(function () {
      msg.textContent = "Prêt. « Partager » envoie la page (WhatsApp, e-mail…) ou la télécharge ; « PDF complet » regroupe les " + shots.length + " pages.";
      ov.querySelector('[data-x="pdf"]').disabled = false;
      loadScript(LIB_PDF).catch(function () {});
    }).catch(function (e) { msg.textContent = "Impossible de préparer le dossier : " + (e && e.message || e); });

    ov.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-x]"); if (!b || b.disabled) return;
      var x = b.dataset.x;
      if (x === "close") return close();
      if (x === "img") { var i = +b.dataset.i; return shareOrDownload(dataURLtoBlob(shots[i]), base + "-" + String(i + 1).padStart(2, "0") + ".jpg"); }
      if (x === "pdf") {
        b.disabled = true; b.textContent = "PDF…";
        return ready.then(function () { return loadScript(LIB_PDF); }).then(function () {
          var J = window.jspdf.jsPDF, doc = new J({ orientation: "portrait", unit: "px", format: [1080, 1350], hotfixes: ["px_scaling"], compress: true });
          shots.forEach(function (u, i) { if (i) doc.addPage([1080, 1350], "portrait"); doc.addImage(u, "JPEG", 0, 0, 1080, 1350); });
          return shareOrDownload(doc.output("blob"), base + ".pdf");
        }).catch(function (e) { msg.textContent = "PDF impossible : " + (e && e.message || e); })
          .then(function () { b.disabled = false; b.textContent = "PDF complet"; });
      }
    });
    ov.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    return ov;
  }

  window.udtDossier = { open: open, pages: function (d) { injectCSS(); return pages(d).list; }, version: "2026-11-26a" };
})();
