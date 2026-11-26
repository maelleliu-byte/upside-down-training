/* Profil complet post-profilage — charte v2 « gris » (voir CHARTE-VISUELLE.md).
   udtDossier.open(data) ouvre l'aperçu plein écran du profil complet (14 fiches 1080 × 1350) :
   chaque fiche se partage (WhatsApp…) ou se télécharge en image, les 7 séances clés d'un coup, et le profil complet en PDF.

   Deux sources :
   • PC / VC (pc.html) : data = { type:"pc", athlete, gender, run, mv, k, p500, date, a3, a12,
       zones:[{z,lo,hi}×5 en % de PC/VC], orient:{title, why, prio[]} }
   • Seuils lactate / RPE (lactate.html) : data = { type:"seuils", lac, athlete, mv, k, date, s1, s2, fcMax,
       b:[6 bornes W], fcAt:function(w), pts:[{w, la, fc, rj, rc, rr, rpe}], plat, limiter, ratio, orient:{title, why, prio[]} }
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
  var ADAPT = {
    1: ["Circulation sanguine ↑ : récupération accélérée", "Relâchement musculaire et nerveux", "Aucune fatigue ajoutée"],
    2: ["Plus de mitochondries et de capillaires dans le muscle", "Meilleure utilisation des graisses comme carburant", "Cœur plus efficace : plus de sang à chaque battement"],
    3: ["Endurance musculaire sur effort soutenu", "Meilleur recyclage du lactate", "Tenir plus longtemps au-dessus de ton S1"],
    4: ["Repousser ton S2", "Tenir une intensité élevée sans exploser", "Transport et réutilisation du lactate"],
    5: ["Développer ta VO2max (consommation max d'O2)", "Débit cardiaque maximal", "Plus de temps près de VO2max, moins de fatigue"],
    6: ["Capacité tampon : tolérer l'acidité musculaire", "Puissance glycolytique (énergie rapide sans O2)", "Savoir relancer en fin d'effort"],
    7: ["Vitesse maximale et fibres rapides", "Puissance neuromusculaire", "Filière phosphocréatine (efforts < 15″)"]
  };
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
  function r5(x) { return Math.round(x / 5) * 5; }
  function pace(kmh) { var s = Math.round(3600 / kmh); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function p500(w) { var s = Math.round(500 * Math.cbrt(2.8 / w)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function dateFR(iso) { if (!iso) return ""; var d = new Date(iso + "T12:00:00"); return d.getDate() + " " + MOIS[d.getMonth()] + " " + d.getFullYear(); }
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d; }
  function rgba(h, a) { h = h.replace("#", ""); return "rgba(" + parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," + parseInt(h.slice(4, 6), 16) + "," + a + ")"; }
  function slug(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase(); }
  function strip(s) { return String(s == null ? "" : s).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }
  function tuLimiter(t) {
    if (/musculaire/i.test(t)) return "En fin de test, ce sont tes jambes qui coincent : souvent un manque d'endurance fondamentale (travail sous S1).";
    if (/respir/i.test(t)) return "En fin de test, c'est ta respiration qui domine : l'entraînement respiratoire est une piste prioritaire.";
    if (/cardio/i.test(t)) return "En fin de test, c'est ton cardio qui domine : à croiser avec ta FC et le travail en Z3–Z5.";
    if (/proches/i.test(t)) return "Tes perceptions sont proches en fin de test : pas de facteur limitant net.";
    return t;
  }
  function isBike(d) { return /bike|velo|vélo|assault|echo/i.test((d.k || "") + " " + (d.mv || "")); }

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
    var s = SEUILS[k];
    return '<div class="usp" style="padding:' + pad + '"><i style="background:' + s[2] + '"></i><span style="color:' + s[2] + '">// ' + (s[1] === "S1" ? "SEUIL 1" : "SEUIL 2") + '</span><i style="background:' + s[2] + '"></i></div>';
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

  /* ---------- fiches communes ---------- */
  function pCover(M) {
    var lines = M.kind.split("<br>"), size = 132, th = size * 1.08 * lines.length, top = 200, y = top + th + 206, out;
    out = '<div class="uc uey" style="top:' + (top - 56) + 'px">TON PROFILAGE</div>' +
      '<div class="uc" style="top:' + top + 'px"><div class="uti" data-fit="960" style="font-size:' + size + 'px;line-height:1.08">' + M.kind + "</div></div>" +
      '<div class="uc" style="top:' + Math.round(top + th + 18) + 'px"><div class="uti" data-fit="940" style="font-size:62px;color:' + ACC + '">' + esc((M.name || "TON PROFIL").toUpperCase()) + "</div></div>" +
      '<div class="uc" style="top:' + Math.round(top + th + 104) + 'px;font-weight:700;font-size:26px;color:' + SAGE + '">' + esc(M.sub) + "</div>" +
      '<div class="uc" style="top:' + Math.round(top + th + 160) + 'px"><div class="ubar"></div></div>';
    M.cards.forEach(function (r) { var h = r.length <= 2 ? 150 : 140; out += cards(r, Math.round(y), h); y += h + 18; });
    return out + '<div class="uc" style="top:' + Math.round(Math.max(y + 40, 1150)) + 'px">' + continuum(null, 32) + "</div>";
  }
  function pZones(M) {
    var parts = [];
    DOMAINES.forEach(function (dm, k) {
      parts.push('<div class="qdm">DOMAINE ' + dm[0] + "</div>");
      dm[1].forEach(function (z) {
        var r = M.zone(z);
        parts.push('<div class="qzr"><i style="background:' + ZC[z] + '"></i><div class="qzn"><b style="color:' + ZC[z] + '">Z' + z + "</b> " + ZN[z] +
          "<small>RPE " + ZRPE[z] + (r[2] || "") + '</small></div><div class="qzw">' + esc(r[0]) + "<small>" + esc(r[1]) + "</small></div></div>");
      });
      if (k < DOMAINES.length - 1) parts.push(sep(k, "6px 0"));
    });
    return '<div class="uc" style="top:100px">' + continuum(null, 30) + "</div>" +
      '<div class="uc" style="top:156px"><div class="uti" style="font-size:104px">TES 7 ZONES</div></div>' +
      '<div class="uc" style="top:274px"><div class="ubar"></div></div>' +
      '<div class="ucard" style="position:absolute;left:60px;top:302px;width:960px;padding:8px 30px">' + parts.join("") + "</div>";
  }
  function pCourbe(M) {
    return head(M.courbeEy, "TA COURBE", 110, 110) +
      '<div class="ucard" style="position:absolute;left:60px;top:320px;width:960px;height:540px;overflow:hidden">' + M.courbe() + "</div>" +
      cards(M.courbeCards, 884, 130) +
      '<div class="uc" style="top:1050px;font-size:26px;line-height:1.45">' + M.courbeTxt + "</div>" +
      (M.courbeFoot ? '<div class="uc" style="top:1210px;font-size:21px;color:' + SAGE + ';line-height:1.4">' + esc(M.courbeFoot) + "</div>" : "");
  }
  function gaugeSvg(G) {
    var W = 960, Hh = 230, lo = G.lo, hi = G.hi, x0 = 40, x1 = W - 40, yb = 110;
    var X = function (r) { return x0 + (Math.min(Math.max(r, lo), hi) - lo) / (hi - lo) * (x1 - x0); };
    var cuts = [lo].concat(G.cuts, [hi]), cols = [ZC[7], ZC[6], ZC[3], ZC[2], ZC[1]];
    var o = ['<svg width="' + W + '" height="' + Hh + '" viewBox="0 0 ' + W + " " + Hh + '" xmlns="http://www.w3.org/2000/svg">'];
    var mid = function (i) { return (X(cuts[i]) + X(cuts[i + 1])) / 2; };
    for (var i = 0; i < 5; i++) {
      var a = X(cuts[i]), b = X(cuts[i + 1]);
      o.push('<rect x="' + n1(a + 2) + '" y="' + yb + '" width="' + n1(b - a - 4) + '" height="26" rx="6" fill="' + cols[i] + '" fill-opacity="' + (i === G.ei ? 1 : .28) + '"/>');
    }
    [0, 4].forEach(function (i) { if (i !== G.ei) o.push('<text x="' + n1(Math.min(Math.max(mid(i), 110), W - 110)) + '" y="' + (yb + 64) + '" text-anchor="middle" font-family="' + F_SG + '" font-weight="700" font-size="16" fill="' + SAGE + '">' + esc(G.labs[i]) + "</text>"); });
    o.push('<text x="' + n1(Math.min(Math.max(mid(G.ei), 130), W - 130)) + '" y="' + (yb + 66) + '" text-anchor="middle" font-family="' + F_SG + '" font-weight="700" font-size="21" fill="' + CREAM + '">' + esc(G.labs[G.ei]) + "</text>");
    G.cuts.forEach(function (c) { o.push('<text x="' + n1(X(c)) + '" y="' + (yb - 12) + '" text-anchor="middle" font-family="' + F_SG + '" font-size="15" fill="' + SAGE + '">' + c + " %</text>"); });
    var xr = X(G.ratio);
    o.push('<path d="M' + n1(xr - 16) + " " + (yb - 58) + " L" + n1(xr + 16) + " " + (yb - 58) + " L" + n1(xr) + " " + (yb - 30) + ' Z" fill="' + CREAM + '"/>');
    o.push('<text x="' + n1(xr) + '" y="' + (yb - 70) + '" text-anchor="middle" font-family="' + F_ANTON + '" font-size="40" fill="' + CREAM + '">' + fr(G.ratio, 0) + " %</text>");
    return o.join("") + "</svg>";
  }
  function pProfil(M) {
    var G = M.gauge;
    return head("TON PROFIL · ENDURANT OU PUISSANT ?", G.labs[G.ei].toUpperCase(), 110, 112) +
      '<div class="ucard" style="position:absolute;left:60px;top:320px;width:960px;height:230px">' + gaugeSvg(G) + "</div>" +
      '<div class="uc" style="top:600px;font-weight:700;font-size:34px">' + esc(G.what) + "</div>" +
      '<div class="uc" style="top:664px;font-size:27px;line-height:1.45;color:' + SAGE + '">' + esc(strip(M.orient.why)) + "</div>" +
      '<div class="ucard" style="position:absolute;left:60px;top:900px;width:960px;padding:26px 34px;text-align:left">' +
      '<div style="font-weight:700;font-size:21px;letter-spacing:.2em;color:' + ACC + '">COMMENT LIRE TON RATIO</div>' +
      '<div style="font-weight:700;font-size:26px;line-height:1.42;margin-top:10px">' + esc(G.read) + "</div></div>";
  }
  function pOrientation(M) {
    var items = M.orient.prio.slice(0, 4).map(function (p, i) { return '<div class="qpr"><b>' + (i + 1) + "</b><span>" + esc(strip(p)) + "</span></div>"; }).join("");
    return head("TES PRIORITÉS · " + M.gauge.labs[M.gauge.ei].toUpperCase(), "ORIENTATION", 110, 118) +
      '<div class="uc" style="top:340px;font-weight:700;font-size:34px">' + esc(strip(M.orient.title)) + "</div>" +
      '<div class="uc" style="top:412px;font-weight:700;font-size:28px;letter-spacing:.14em;color:' + ACC + '">ORIENTATION DES ENTRAÎNEMENTS</div>' +
      '<div class="ucard" style="position:absolute;left:60px;top:472px;width:960px;padding:12px 32px">' + items + "</div>" +
      '<div class="uc" style="top:1150px">' + continuum(null, 32) + "</div>";
  }
  function pSeancesOverview(M) {
    var by = {}, parts = [];
    M.seances.forEach(function (s) { by[s.zone] = s; });
    DOMAINES.forEach(function (dm, k) {
      parts.push('<div class="qdm">DOMAINE ' + dm[0] + "</div>");
      dm[1].forEach(function (z) {
        var s = by[z];
        parts.push('<div class="qzr"><i style="background:' + ZC[z] + '"></i><div class="qzn"><b style="color:' + ZC[z] + '">Z' + z + "</b> " + esc(s.titre) +
          "<small>" + esc(s.prescription) + '</small></div><div class="qzw" style="color:' + ZC[z] + ';font-size:32px">' + esc(s.rpe) + "</div></div>");
      });
      if (k < DOMAINES.length - 1) parts.push(sep(k, "6px 0"));
    });
    return '<div class="uc uey" style="top:110px">TES SÉANCES CLÉS</div>' +
      '<div class="uc" style="top:156px"><div class="uti" data-fit="960" style="font-size:96px">PAR ZONE</div></div>' +
      '<div class="uc" style="top:268px"><div class="ubar"></div></div>' +
      '<div class="ucard" style="position:absolute;left:60px;top:302px;width:960px;padding:8px 30px">' + parts.join("") + "</div>";
  }

  /* ---------- séances : segments + graphique ---------- */
  function warmup(top, accels) {
    var s = [[10, 2, "wu"]];
    if (accels) { [5, 6, 7].forEach(function (z) { s.push([0.2, z, "wu"], [1, 2, "rec"]); }); s[s.length - 1][0] = 2.4; }
    else { ({ 3: [3, 3, 3, 3], 4: [3, 3, 4, 4], 5: [3, 4, 4, 5] })[top].forEach(function (z) { s.push([0.5, z, "wu"], [0.5, 2, "rec"]); }); s[s.length - 1][0] = 1.5; }
    return s;
  }
  function blocs(top, work, opt, rec, n) {
    var s = warmup(top);
    for (var k = 0; k < n; k++) { s.push([work, top, "work"]); if (opt) s.push([opt, top, "opt"]); s.push([rec, 2, "rec"]); }
    s[s.length - 1] = [5, 2, "cd"];
    return s;
  }
  function vo2court() {
    var s = warmup(5);
    for (var b = 0; b < 2; b++) { for (var i = 0; i < 12; i++) s.push([0.5, 5, i < 8 ? "work" : "opt"], [0.5, 2, "rec"]); s[s.length - 1][0] = b === 0 ? 3 : 0.5; }
    return s.concat([[5, 2, "cd"]]);
  }
  function sprintLong(bike) {
    var s = warmup(6, true), k;
    if (bike) for (k = 0; k < 3; k++) s.push([0.5, 6, "work"], [5, 2, "rec"]);
    else for (k = 0; k < 6; k++) s.push([1, 6, k < 4 ? "work" : "opt"], [4, 2, "rec"]);
    s[s.length - 1] = [6, 2, "cd"];
    return s;
  }
  function sprintCourt() {
    var s = warmup(7, true);
    for (var j = 0; j < 12; j++) s.push([0.2, 7, j < 6 ? "work" : "opt"], [2.5, 2, "rec"]);
    s.pop(); s.push([5, 2, "cd"]);
    return s;
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
      o.push('<rect x="' + n1(x) + '" y="' + n1(base - h) + '" width="' + n1(Math.max(w - (w > 6 ? 1.2 : 0), 2)) + '" height="' + n1(h) + '" rx="2" fill="' + fill + '"' + extra + "/>");
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
  function pSeance(s) {
    var zc = ZC[s.zone];
    var stats = s.stats.map(function (st, i) {
      return '<div class="ucard qst"><div class="qsv" style="color:' + (i === 2 ? zc : CREAM) + ";font-size:" + (st[0].length <= 6 ? 56 : 46) + 'px">' + esc(st[0]) + '</div><div class="qsl">' + esc(st[1]) + "</div></div>";
    }).join("");
    var ad = (s.adapt || ADAPT[s.zone]).map(function (a) { return '<div class="qad"><i style="background:' + zc + '"></i>' + esc(a) + "</div>"; }).join("");
    return '<div class="uc" style="top:104px">' + continuum(s.zone, 30) + "</div>" +
      '<div class="uc uey" style="top:170px;font-size:22px">ZONE ' + s.zone + (s.ey ? " · " + s.ey : "") + "</div>" +
      '<div class="uc" style="top:204px"><div class="uti" data-fit="940" style="font-size:112px">' + esc(s.titre) + "</div></div>" +
      '<div class="uc" style="top:328px"><div class="ubar"></div></div>' +
      '<div class="uc" style="top:350px;font-weight:700;font-size:40px;white-space:nowrap" data-fitw="960">' + esc(s.prescription) + '<span style="color:' + zc + '"> · ' + esc(s.rpe) + "</span></div>" +
      '<div class="ucard" style="position:absolute;left:60px;top:418px;width:960px;height:466px;overflow:hidden">' + chartSvg(s, 960, 466) + "</div>" +
      '<div style="position:absolute;left:60px;right:60px;top:904px;display:flex;gap:20px">' + stats + "</div>" +
      '<div class="uc" style="top:1046px;font-weight:700;font-size:21px;letter-spacing:.22em;color:' + ACC + '">ADAPTATIONS VISÉES</div>' +
      '<div style="position:absolute;left:110px;right:80px;top:1086px">' + ad + "</div>" +
      '<div class="uc uacc" style="top:1250px;font-size:21px;line-height:1.38">' + esc(s.releve) + "</div>";
  }
  function pSuite(M) {
    var win = "";
    if (M.date) { var a = addDays(M.date, 42), b = addDays(M.date, 56); win = " : " + a.getDate() + " " + MOIS[a.getMonth()] + " – " + b.getDate() + " " + MOIS[b.getMonth()] + " " + b.getFullYear(); }
    var t = strip(M.orient.title);
    var steps = [["On construit ton plan", "Un plan d'entraînement calé sur tes zones et tes " + M.unitWord + "."],
      ["On choisit la direction", "On travaille ensemble l'orientation à prendre : " + t.charAt(0).toLowerCase() + t.slice(1) + "."],
      ["On re-teste", M.retest + win + "."]];
    return head("LA SUITE", "ET MAINTENANT ?", 150, 116) +
      '<div class="ucard" style="position:absolute;left:60px;top:360px;width:960px;padding:14px 32px">' +
      steps.map(function (s, i) { return '<div class="qpr qpr2"><b>' + (i + 1) + "</b><span>" + esc(s[0]) + "<small>" + esc(s[1]) + "</small></span></div>"; }).join("") + "</div>" +
      '<div class="uc" style="top:920px;font-size:30px;line-height:1.4">On en parle ?<br><span class="uacc">Réserve un call.</span></div>';
  }

  /* ---------- modèle PC / VC ---------- */
  function modelPC(d) {
    var run = !!d.run, a3 = +d.a3, a12 = +d.a12, cp = (a12 * 12 - a3 * 3) / 9, wp = run ? (a3 - cp) * 50 : (a3 - cp) * 180, ratio = a12 / a3 * 100;
    var f = d.gender === "female", th = f ? [73, 76, 79, 82] : [71, 74, 77, 80];
    var ei = ratio < th[0] ? 0 : ratio < th[1] ? 1 : ratio < th[2] ? 2 : ratio < th[3] ? 3 : 4;
    var P = f ? "Puissante" : "Puissant", E = f ? "Endurante" : "Endurant", labs = [P + " ++", P + " +", "Intermédiaire", E + " +", E + " ++"];
    var R = run ? "VC" : "PC";
    var def = run ? [[1, 45, 72], [2, 72, 80], [3, 80, 88], [4, 88, 100], [5, 100, null]] : [[1, 45, 60], [2, 60, 75], [3, 75, 88], [4, 88, 103], [5, 103, null]];
    var zl = (d.zones && d.zones.length >= 5) ? d.zones.slice(0, 5).map(function (z) { return [+String(z.z).replace(/\D/g, ""), +z.lo, z.hi == null ? null : +z.hi]; }) : def, zr = {};
    zl.forEach(function (z) { zr[z[0]] = [z[1], z[2]]; });
    var at = function (pc) { return cp * pc / 100; };
    var main = function (v) { return run ? pace(v) + " /km" : Math.round(v) + " W"; };
    var rngMain = function (lo, hi) { return run ? pace(at(lo)) + " – " + pace(at(hi)) + " /km" : Math.round(at(lo)) + " – " + Math.round(at(hi)) + " W"; };
    var rngSub = function (lo, hi) { return run ? fr(at(lo)) + "–" + fr(at(hi)) + " km/h" : d.p500 ? p500(at(lo)) + "–" + p500(at(hi)) + " /500m" : ""; };
    var sh = function (s) { return s.replace(" /km", "").replace(" W", ""); };
    var LAB = run ? "allure /km" : "puissance (W)", word = run ? "allure" : "puissance";
    var val = function (pc) { return run ? fr(at(pc)) + " km/h" : Math.round(at(pc)) + " W"; };
    var res = run ? Math.round(wp) + " m" : fr(wp / 1000) + " kJ", big = run ? wp > 250 : wp > 20000, small = run ? wp < 120 : wp < 10000;
    var ori = ei <= 1 ? { title: "Profil puissant : priorité à ta " + R,
        why: "Tu produis beaucoup sur 3′ grâce à ta réserve, mais ta " + R + " est basse par rapport à ce potentiel : tu t'uses vite dès que l'effort dure.",
        prio: ["Monter ta " + R + " : volume en Z2 et blocs longs proches de ta " + R, "Tempo / seuil : 2 × 20′ à " + val(88) + "–" + val(95) + ", puis 4 × 10′ à " + val(95) + "–" + val(100), "Ta réserve s'entretient avec une séance courte par semaine, pas plus"] }
      : ei >= 3 ? { title: "Profil endurant : développer ta réserve",
        why: "Ta " + R + " est haute par rapport à ton 3′ : tu tiens longtemps, mais tu manques de « carburant » au-dessus de ta " + R + " pour les attaques, les relances et les fins de course.",
        prio: ["Travail au-dessus de ta " + R + " (domaine sévère) : 1 à 2 séances par semaine", "Intervalles courts et VO2max, sprints, et force-vitesse en salle", "Garder la Z2 pour ne pas perdre ta base"] }
      : { title: "Profil intermédiaire : alterner les blocs",
        why: "Ta " + R + " et ta réserve sont en bon rapport : on alterne les blocs pour faire monter toute ta courbe.",
        prio: ["Bloc de 4–6 semaines orienté seuil, puis bloc orienté VO2max", "Z2 majoritaire (environ 75 % de ton volume)", "Re-tester à la fin de chaque bloc"] };
    if (big) ori.prio.push("Grosse réserve (" + res + ") : soigne ton pacing, les départs trop rapides te coûtent cher, et travaille ta " + R + ".");
    if (small) ori.prio.push("Petite réserve (" + res + ") : peu de marge au-dessus de ta " + R + ", à développer par des efforts de 30″ à 2′.");
    var M = {
      kind: run ? "VITESSE<br>CRITIQUE" : "PUISSANCE<br>CRITIQUE", name: d.athlete, date: d.date, unitWord: run ? "allures" : "puissances",
      sub: (run ? "Course à pied" : (d.mv || "Ergo")) + (d.date ? " · test du " + dateFR(d.date) : ""),
      orient: ori,
      retest: "Nouveau test 3′ / 12′ pour mesurer la progression",
      cards: run ? [[[main(cp), "vitesse critique ≈ S2 · " + fr(cp) + " km/h", S2C], [fr(ratio, 0) + " %", "ratio 12′ / 3′ · " + labs[ei].toLowerCase(), ACC]],
        [["3′ · " + main(a3), "test 3′ · " + fr(a3, 2) + " km/h", CREAM], ["12′ · " + main(a12), "test 12′ · " + fr(a12, 2) + " km/h", CREAM]]]
        : [[[main(cp), "puissance critique ≈ S2" + (d.p500 ? " · " + p500(cp) + " /500m" : ""), S2C], [fr(ratio, 0) + " %", "ratio 12′ / 3′ · " + labs[ei].toLowerCase(), ACC]],
          [["3′ · " + main(a3), "test 3′", CREAM], ["12′ · " + main(a12), "test 12′", CREAM]]],
      gauge: { lo: 64, hi: 90, cuts: th, labs: labs, ei: ei, ratio: ratio, what: "Ratio 12′ / 3′ : " + fr(ratio, 0) + " %",
        read: "Plus ton 12′ est proche de ton 3′, plus tu es endurant. Un ratio bas veut dire une grosse réserve au-dessus de ta " + R + " : profil puissant." },
      zone: function (z) {
        if (z >= 6) return [run ? "< " + pace(a3) + " /km" : "effort max", run ? "plus vite que ton 3′" : "au-delà du 3′", ""];
        var lo = zr[z][0], hi = zr[z][1], pc = " · " + lo + (hi != null ? "–" + hi : "+") + " % " + R;
        if (hi == null) return [run ? "< " + pace(at(lo)) + " /km" : "> " + Math.round(at(lo)) + " W", run ? "> " + fr(at(lo)) + " km/h" : d.p500 ? "< " + p500(at(lo)) + " /500m" : "", pc];
        if (z === 1) return [run ? "> " + pace(at(hi)) + " /km" : "< " + Math.round(at(hi)) + " W", run ? "< " + fr(at(hi)) + " km/h" : d.p500 ? "> " + p500(at(hi)) + " /500m" : "", pc];
        return [rngMain(lo, hi), rngSub(lo, hi), pc];
      },
      courbeEy: "TON TEST · 3′ PUIS 12′ À FOND",
      courbeCards: [["3′ · " + main(a3), run ? fr(a3, 2) + " km/h · " + Math.round(a3 / 3.6 * 180) + " m" : d.p500 ? p500(a3) + " /500m" : "", ACC],
        ["12′ · " + main(a12), run ? fr(a12, 2) + " km/h · " + Math.round(a12 / 3.6 * 720) + " m" : d.p500 ? p500(a12) + " /500m" : "", ACC]],
      courbeTxt: 'Ta <b style="color:' + S2C + '">' + (run ? "vitesse" : "puissance") + " critique</b> se rapproche de ton S2.<br><span class=\"uacc\">Au-dessus, l'effort devient vite limité dans le temps.</span>",
      courbeFoot: "",
      courbe: function () {
        var W = 960, Hh = 520, x0 = 96, x1 = W - 40, y0 = 60, y1 = Hh - 80, tmin = 1.5, tmax = 20, k = run ? 3.6 : 1;
        var vOf = function (tm) { return cp + (wp / (tm * 60)) * k; };
        var vmax = cp + wp / (tmin * 60) * k * 1.04, vmin = cp * 0.9;
        var X = function (tm) { return x0 + (tm - tmin) / (tmax - tmin) * (x1 - x0); };
        var Y = function (v) { return y1 - (v - vmin) / (vmax - vmin) * (y1 - y0); };
        var pts = [];
        for (var t = tmin * 10; t <= tmax * 10; t++) pts.push(n1(X(t / 10)) + " " + n1(Y(vOf(t / 10))));
        var curve = "M" + pts.join(" L"), area = curve + " L" + n1(X(tmax)) + " " + n1(Y(cp)) + " L" + n1(X(tmin)) + " " + n1(Y(cp)) + " Z";
        var unit = run ? "/km" : "W", step = run ? 1 : 25, o = ['<svg width="' + W + '" height="' + Hh + '" viewBox="0 0 ' + W + " " + Hh + '" xmlns="http://www.w3.org/2000/svg">'];
        var txt = function (x, y, s, a) { return '<text x="' + n1(x) + '" y="' + n1(y) + '" font-family="' + F_SG + '" ' + (a || "") + ">" + s + "</text>"; };
        for (var v = Math.ceil(vmin / step) * step; v <= vmax; v += step) {
          o.push('<line x1="' + x0 + '" x2="' + x1 + '" y1="' + n1(Y(v)) + '" y2="' + n1(Y(v)) + '" stroke="rgba(246,244,232,.08)"/>');
          o.push(txt(x0 - 14, Y(v) + 6, run ? pace(v) : String(v), 'text-anchor="end" font-size="18" fill="' + SAGE + '"'));
        }
        o.push(txt(x0 - 14, y0 - 22, unit, 'text-anchor="end" font-weight="700" font-size="16" fill="' + SAGE + '"'));
        o.push('<path d="' + area + '" fill="' + ZC[5] + '" fill-opacity=".18"/>');
        o.push('<line x1="' + x0 + '" x2="' + x1 + '" y1="' + n1(Y(cp)) + '" y2="' + n1(Y(cp)) + '" stroke="' + S2C + '" stroke-width="3" stroke-dasharray="12 8"/>');
        o.push('<path d="' + curve + '" fill="none" stroke="' + CREAM + '" stroke-width="4"/>');
        [[3, a3], [12, a12]].forEach(function (p) {
          o.push('<circle cx="' + n1(X(p[0])) + '" cy="' + n1(Y(p[1])) + '" r="11" fill="' + ACC + '" stroke="#161616" stroke-width="3"/>');
          o.push(txt(X(p[0]) + 18, Y(p[1]) - 16, p[0] + "′ · " + (run ? pace(p[1]) : Math.round(p[1])) + " " + unit, 'font-weight="700" font-size="24" fill="' + CREAM + '"'));
        });
        o.push(txt(x1, Y(cp) + 32, R + " " + (run ? pace(cp) : Math.round(cp)) + " " + unit, 'text-anchor="end" font-weight="700" font-size="22" fill="' + S2C + '"'));
        o.push(txt(X(5.2), (Y(vOf(5.2)) + Y(cp)) / 2 + 8, "réserve " + (run ? "D′" : "W′"), 'font-weight="700" font-size="20" fill="' + ZC[5] + '"'));
        [2, 5, 10, 15, 20].forEach(function (tm) { o.push(txt(X(tm), y1 + 34, tm + "′", 'text-anchor="middle" font-size="18" fill="' + SAGE + '"')); });
        o.push('<line x1="' + x0 + '" x2="' + x1 + '" y1="' + y1 + '" y2="' + y1 + '" stroke="' + CREAM + '" stroke-width="2"/>');
        o.push(txt(x1, y1 + 64, "durée de l'effort", 'text-anchor="end" font-size="16" fill="' + SAGE + '"'));
        return o.join("") + "</svg>";
      }
    };
    var bike = isBike(d), v30 = main(at(115));
    M.seances = [
      run ? { zone: 1, titre: "Récupération active", prescription: "20–30′ footing très facile", rpe: "> " + pace(at(zr[1][1])) + " /km",
        stats: [["20–30′", "durée totale"], ["> " + pace(at(zr[1][1])), LAB], ["1", "RPE cible"]], segments: [[20, 1, "work"], [10, 1, "opt"]],
        label_bloc: "20–30′ très facile · RPE 1", releve: "FC et RPE en fin de séance : la FC doit rester basse et stable." }
        : { zone: 1, titre: "Récupération active", prescription: "30′ continu" + (bike ? " · > 75 rpm" : ""), rpe: "< " + Math.round(at(zr[1][1])) + " W",
          stats: [["30′", "durée totale"], bike ? ["> 75", "rpm (cadence)"] : ["< " + Math.round(at(zr[1][1])), LAB], ["1", "RPE cible"]], segments: [[30, 1, "work"]],
          label_bloc: "30′ très facile · RPE 1", releve: "FC et RPE en fin de séance : la FC doit rester basse et stable." },
      { zone: 2, titre: "Endurance fondamentale", ey: "SÉANCE REPÈRE", prescription: "30–40′ continu", rpe: rngMain(zr[2][0], zr[2][1]),
        stats: [["30–40′", "durée totale"], [sh(rngMain(zr[2][0], zr[2][1])), LAB], ["2–3", "RPE cible"]], segments: [[30, 2, "work"], [10, 2, "opt"]], marqueurs: 5,
        label_bloc: "FC + RPE toutes les 5′", releve: "Suivre la dérive cardiaque : FC et RPE toutes les 5′, à " + word + " égale la FC doit rester stable." },
      { zone: 3, titre: "Tempo long", prescription: "3 × 8–10′ / 2′", rpe: rngMain(zr[3][0], zr[3][1]),
        stats: [["50–55′", "durée totale"], [sh(rngMain(zr[3][0], zr[3][1])), LAB], ["4–5", "RPE cible"]], segments: blocs(3, 8, 2, 2, 3),
        label_bloc: "3 × 8–10′ / 2′", releve: "RPE et FC à la fin de chaque bloc." },
      { zone: 4, titre: "Seuil", ey: "SÉANCE REPÈRE", prescription: "3 × 6–8′ / 2′", rpe: rngMain(95, 100),
        stats: [["45–50′", "durée totale"], [sh(rngMain(95, 100)), LAB], ["6–7", "RPE cible"]], segments: blocs(4, 6, 2, 2, 3), label_bloc: "3 × 6–8′ / 2′",
        adapt: ["Repousser ton S2 et ta " + (run ? "vitesse" : "puissance") + " critique", "Tenir une intensité élevée sans exploser", "Transport et réutilisation du lactate"],
        releve: (run ? "Allure" : "Puissance") + " moyenne et FC de chaque bloc, " + word + " stable du premier au dernier." },
      { zone: 5, titre: "VO2max court", prescription: "2 × (8–12 × 30″/30″)", rpe: v30,
        stats: [["~45′", "durée totale"], [sh(v30), LAB + " sur les 30″"], ["8–10", "RPE cible"]], segments: vo2court(),
        label_bloc: "2 × (8–12 × 30″/30″) · 3′ entre les blocs", releve: "Commencer à 8 répétitions, monter jusqu'à 12. Variante : 4 × 4′ à " + rngMain(105, 110) + ", récup 3′." },
      bike && !run ? { zone: 6, titre: "Sprint long", prescription: "3 × 30″ all out / 5′", rpe: "all out", segments: sprintLong(true),
        stats: [["~35′", "durée totale"], ["5′", "de récup"], ["10", "RPE cible"]], label_bloc: "3 × 30″ all out / 5′", releve: "Puissance moyenne de chaque 30″ : elle doit rester proche d'une répétition à l'autre." }
        : { zone: 6, titre: "Sprint long", prescription: "4–6 × 1′ / 4′", rpe: run ? "< " + pace(a3) + " /km" : "RPE 9,5", segments: sprintLong(false),
          stats: [["40–50′", "durée totale"], ["4′", "de récup"], ["9,5", "RPE cible"]], label_bloc: "4–6 × 1′ / 4′ · RPE 9,5",
          releve: run ? "Plus vite que ton allure du 3′. Distance de chaque 1′ : elle doit rester proche d'une répétition à l'autre." : "Plus fort que ta puissance du 3′. Puissance moyenne de chaque 1′." },
      { zone: 7, titre: "Sprint court", prescription: "6–12 × 12″ / 2′30", rpe: "all out", segments: sprintCourt(),
        stats: [["~50′", "durée totale"], ["2′30", "de récup"], ["100 %", "effort"]], label_bloc: "6–12 × 12″ / 2′30 · all out",
        releve: run ? "Allure de pointe de chaque sprint : arrêter la série si elle chute nettement." : "Pic de puissance de chaque sprint : arrêter la série s'il chute nettement." }
    ];
    return M;
  }

  /* ---------- modèle seuils (lactate / RPE) ---------- */
  function modelSeuils(d) {
    var lac = !!d.lac, s1 = +d.s1, s2 = +d.s2, b = d.b, pts = d.pts || [], ratio = s1 / s2 * 100;
    var fc = function (w) { var f = d.fcAt ? d.fcAt(w) : NaN; return isFinite(f) ? Math.round(f) : null; };
    var fcs = function (w) { var f = fc(w); return f == null ? "" : "FC " + f + " bpm"; };
    var labs = ["Puissant ++", "Puissant +", "Intermédiaire", "Endurant +", "Endurant ++"];
    var ei = ratio < 70 ? 0 : ratio < 75 ? 1 : ratio < 80 ? 2 : ratio < 85 ? 3 : 4;
    var W = function (a, c) { return r5(a) + " – " + r5(c) + " W"; }, Wsh = function (a, c) { return r5(a) + "–" + r5(c); };
    var bike = isBike(d);
    var z2 = b[0] + "–" + Math.round(s1) + " W" + (fc(s1) != null ? " · FC < " + fc(s1) : ""), rr = fr(ratio, 0);
    var noPlat = lac && d.plat === "non" ? " Pas de plateau de lactate : ta base aérobie est à surveiller." : "";
    var ori = ei >= 3 ? { title: "Base aérobie solide",
        why: "Ton S1 est à " + rr + " % de ton S2 : tu tiens beaucoup d'intensité sans accumuler, mais ton domaine élevé, entre S1 et S2, est étroit : au-delà de S2, la fatigue arrive vite." + noPlat,
        prio: ["Relever ton S2 : 1 séance seuil + 1 séance VO2max par semaine", "Garder la Z2 (" + z2 + ") autour de 70 % de ton volume", "Le tempo n'est pas ta priorité : il est déjà « facile » pour toi"] }
      : ei === 2 ? { title: "Profil équilibré",
        why: "Ton S1 est à " + rr + " % de ton S2 : ta base et ta tolérance au-dessus du seuil sont en bon rapport. On fait monter toute ta courbe." + noPlat,
        prio: ["Environ 80 % de ton volume en Z2 (" + z2 + ")", "1 séance seuil et 1 séance VO2max par semaine, en alternant les blocs", "Allonger progressivement tes blocs au seuil"] }
      : { title: "Base aérobie à développer",
        why: "Ton S1 est à " + rr + " % de ton S2 : tu tiens haut grâce à ta puissance, mais tu sors tôt du domaine modéré. Ton moteur aérobie limite ta récupération et tes efforts longs." + noPlat,
        prio: ["75–80 % de ton volume en Z2 (" + z2 + "), RPE 2–3", "Sorties longues continues de 45 à 90′, strictement sous ton S1", "Limiter le tempo et garder une seule séance intense courte par semaine"] };
    var M = {
      kind: lac ? "PROFILAGE<br>LACTATE" : "PROFILAGE<br>RPE", name: d.athlete, date: d.date, unitWord: "puissances",
      sub: (d.mv || "Ergo") + (d.date ? " · test du " + dateFR(d.date) : ""),
      orient: ori,
      retest: "Nouveau profilage pour mesurer la montée de S1 et de S2",
      cards: [[[Math.round(s1) + " W", "seuil 1" + (fc(s1) != null ? " · FC " + fc(s1) + " bpm" : ""), S1C], [Math.round(s2) + " W", "seuil 2" + (fc(s2) != null ? " · FC " + fc(s2) + " bpm" : ""), S2C],
        [fr(ratio, 0) + " %", "ratio S1 / S2 · " + labs[ei].toLowerCase(), ACC]],
        [[pts.length + " paliers", (pts.length ? pts[0].w + " → " + pts[pts.length - 1].w + " W" : "") + " · 4′ / 1′", CREAM], [isFinite(d.fcMax) ? Math.round(d.fcMax) + " bpm" : "–", "FC max du test", CREAM]]],
      gauge: { lo: 60, hi: 95, cuts: [70, 75, 80, 85], labs: labs, ei: ei, ratio: ratio, what: "Ratio S1 / S2 : " + fr(ratio, 0) + " %",
        read: "Plus ton S1 est proche de ton S2, plus tu es endurant. Un ratio bas veut dire un grand écart entre tes deux seuils : profil puissant." },
      zone: function (z) {
        if (z >= 6) return ["> " + b[5] + " W", "effort max · FC non pertinente", ""];
        if (z === 1) return ["< " + b[0] + " W", fc(b[0]) != null ? "FC < " + fc(b[0]) + " bpm" : "", ""];
        if (z === 5) return [b[4] + " – " + b[5] + " W", fc(b[4]) != null ? "FC > " + fc(b[4]) + " bpm" : "", ""];
        var lo = [null, null, b[0], b[1], b[2]][z], hi = [null, null, b[1], b[2], b[4]][z];
        return [lo + " – " + hi + " W", fc(lo) != null && fc(hi) != null ? "FC " + fc(lo) + " – " + fc(hi) + " bpm" : "", ""];
      },
      courbeEy: "TON TEST · PALIERS 4′ / 1′ · " + (lac ? "LACTATE" : "RPE") + " + FC",
      courbeCards: [["S1 · " + Math.round(s1) + " W", (fcs(s1) ? fcs(s1) + " · " : "") + "facile → soutenu", S1C], ["S2 · " + Math.round(s2) + " W", (fcs(s2) ? fcs(s2) + " · " : "") + "au-delà, effort limité", S2C]],
      courbeTxt: 'Sous <b style="color:' + S1C + '">S1</b> : on peut parler, RPE ≤ 3. Entre S1 et <b style="color:' + S2C + '">S2</b> : soutenu mais stable.<br><span class="uacc">Au-dessus de S2 : la fatigue s\'accumule vite.</span>',
      courbeFoot: lac ? (d.plat === "non" ? "Pas de plateau de lactate : base aérobie à surveiller." : "Plateau de lactate sur les premiers paliers : bonne base de départ.") : tuLimiter(strip(d.limiter || "")),
      courbe: function () {
        var Wd = 960, Hh = 540, x0 = 86, x1 = Wd - 86, y0 = 50, y1 = Hh - 92;
        if (!pts.length) return "";
        var ws = pts.map(function (p) { return p.w; }), wmin = ws[0] - 10, wmax = ws[ws.length - 1] + 10;
        var mainK = lac ? "la" : "rpe", mx = 10;
        if (lac) pts.forEach(function (p) { if (isFinite(p.la)) mx = Math.max(mx, Math.ceil(p.la / 2) * 2); });
        var fcv = pts.map(function (p) { return p.fc; }).filter(isFinite), fmin = 100, fmax = Math.max(200, fcv.length ? Math.ceil((Math.max.apply(null, fcv) + 1) / 25) * 25 : 200);
        var X = function (w) { return x0 + (w - wmin) / (wmax - wmin) * (x1 - x0); }, Y = function (r) { return y1 - r / mx * (y1 - y0); }, YF = function (f) { return y1 - (f - fmin) / (fmax - fmin) * (y1 - y0); };
        var o = ['<svg width="' + Wd + '" height="' + Hh + '" viewBox="0 0 ' + Wd + " " + Hh + '" xmlns="http://www.w3.org/2000/svg">'];
        var T = function (x, y, s, a) { return '<text x="' + n1(x) + '" y="' + n1(y) + '" font-family="' + F_SG + '" ' + a + ">" + s + "</text>"; };
        [[wmin, s1, ZC[2], "MODÉRÉ"], [s1, s2, ZC[4], "ÉLEVÉ"], [s2, wmax, ZC[5], "SÉVÈRE"]].forEach(function (r) {
          if (r[1] <= r[0]) return;
          o.push('<rect x="' + n1(X(r[0])) + '" y="' + y0 + '" width="' + n1(X(r[1]) - X(r[0])) + '" height="' + (y1 - y0) + '" fill="' + r[2] + '" fill-opacity=".10"/>');
          o.push(T((X(r[0]) + X(r[1])) / 2, y0 + 24, r[3], 'text-anchor="middle" font-weight="700" font-size="15" letter-spacing="2.5" fill="' + r[2] + '"'));
        });
        for (var r = 0; r <= mx; r += 2) {
          o.push('<line x1="' + x0 + '" x2="' + x1 + '" y1="' + n1(Y(r)) + '" y2="' + n1(Y(r)) + '" stroke="rgba(246,244,232,.08)"/>');
          o.push(T(x0 - 14, Y(r) + 6, r, 'text-anchor="end" font-size="18" fill="' + SAGE + '"'));
        }
        for (var f = fmin; f <= fmax; f += 25) o.push(T(x1 + 14, YF(f) + 6, f, 'font-size="16" fill="rgba(246,244,232,.5)"'));
        o.push(T(x0 - 14, y0 - 18, lac ? "mmol/L" : "RPE", 'text-anchor="end" font-weight="700" font-size="16" fill="' + SAGE + '"'));
        o.push(T(x1 + 14, y0 - 18, "FC", 'font-weight="700" font-size="16" fill="rgba(246,244,232,.5)"'));
        var line = function (k, col, wd, dash) {
          var pp = pts.filter(function (p) { return isFinite(k === "fc" ? p.fc : p[k]); }).map(function (p) { return n1(X(p.w)) + "," + n1(k === "fc" ? YF(p.fc) : Y(p[k])); });
          if (pp.length > 1) o.push('<polyline points="' + pp.join(" ") + '" fill="none" stroke="' + col + '" stroke-width="' + wd + '" stroke-linejoin="round"' + (dash ? ' stroke-dasharray="' + dash + '"' : "") + "/>");
        };
        line("fc", "rgba(246,244,232,.45)", 2.5, "6 6");
        if (!lac) { line("rj", "#E86BB4", 2.5); line("rc", "#E5483B", 2.5); line("rr", "#3B8FEA", 2.5); }
        line(mainK, CREAM, 5);
        pts.forEach(function (p) { if (isFinite(p[mainK])) o.push('<circle cx="' + n1(X(p.w)) + '" cy="' + n1(Y(p[mainK])) + '" r="6" fill="' + CREAM + '" stroke="#161616" stroke-width="2"/>'); });
        [[s1, "S1", S1C], [s2, "S2", S2C]].forEach(function (s) {
          o.push('<line x1="' + n1(X(s[0])) + '" x2="' + n1(X(s[0])) + '" y1="' + y0 + '" y2="' + y1 + '" stroke="' + s[2] + '" stroke-width="3" stroke-dasharray="12 8"/>');
          o.push('<text x="' + n1(X(s[0])) + '" y="' + (y0 + 50) + '" text-anchor="middle" font-family="' + F_ANTON + '" font-size="30" fill="' + s[2] + '">' + s[1] + "</text>");
        });
        ws.forEach(function (w, i) { if (i % 2 === 0) o.push(T(X(w), y1 + 32, w, 'text-anchor="middle" font-size="17" fill="' + SAGE + '"')); });
        o.push('<line x1="' + x0 + '" x2="' + x1 + '" y1="' + y1 + '" y2="' + y1 + '" stroke="' + CREAM + '" stroke-width="2"/>');
        o.push(T(x1, y1 + 60, "puissance par palier (W)", 'text-anchor="end" font-size="16" fill="' + SAGE + '"'));
        var leg = (lac ? [["Lactate", CREAM, ""]] : [["RPE moyen", CREAM, ""], ["Jambes", "#E86BB4", ""], ["Cardio", "#E5483B", ""], ["Respiration", "#3B8FEA", ""]]).concat([["FC", "rgba(246,244,232,.45)", ' stroke-dasharray="5 4"']]);
        var lx = x0, ly = y1 + 60;
        leg.forEach(function (l) {
          o.push('<line x1="' + lx + '" x2="' + (lx + 22) + '" y1="' + (ly - 6) + '" y2="' + (ly - 6) + '" stroke="' + l[1] + '" stroke-width="4"' + l[2] + "/>");
          o.push('<text x="' + (lx + 30) + '" y="' + ly + '" font-family="' + F_IN + '" font-size="16" fill="' + SAGE + '">' + l[0] + "</text>");
          lx += 30 + l[0].length * 8.6 + 26;
        });
        return o.join("") + "</svg>";
      }
    };
    var v30 = r5(s2 * 1.15) + " W";
    M.seances = [
      { zone: 1, titre: "Récupération active", prescription: "30′ continu" + (bike ? " · > 75 rpm" : ""), rpe: "< " + b[0] + " W",
        stats: [["30′", "durée totale"], ["< " + b[0], "puissance (W)"], ["1", "RPE cible"]], segments: [[30, 1, "work"]], label_bloc: "30′ très facile · RPE 1",
        releve: "FC et RPE en fin de séance : la FC doit rester basse et stable." },
      { zone: 2, titre: "Endurance fondamentale", ey: "SÉANCE REPÈRE", prescription: "30–40′ continu", rpe: b[0] + " – " + b[1] + " W",
        stats: [["30–40′", "durée totale"], [b[0] + "–" + b[1], "puissance (W)"], fc(b[1]) != null ? ["< " + fc(b[1]), "FC (bpm)"] : ["2–3", "RPE cible"]],
        segments: [[30, 2, "work"], [10, 2, "opt"]], marqueurs: 5, label_bloc: "FC + RPE toutes les 5′",
        releve: "Suivre la dérive cardiaque : FC et RPE toutes les 5′, à puissance égale la FC doit rester stable." },
      { zone: 3, titre: "Tempo long", prescription: "3 × 8–10′ / 2′", rpe: W(s1, s2 * .9),
        stats: [["50–55′", "durée totale"], [Wsh(s1, s2 * .9), "puissance (W)"], ["4–5", "RPE cible"]], segments: blocs(3, 8, 2, 2, 3),
        label_bloc: "3 × 8–10′ / 2′", releve: "RPE et FC à la fin de chaque bloc." },
      { zone: 4, titre: "Seuil", ey: "SÉANCE REPÈRE", prescription: "3 × 6–8′ / 2′", rpe: W(s2 * .95, s2),
        stats: [["45–50′", "durée totale"], [Wsh(s2 * .95, s2), "puissance (W)"], ["6–7", "RPE cible"]], segments: blocs(4, 6, 2, 2, 3), label_bloc: "3 × 6–8′ / 2′",
        releve: "Puissance moyenne et FC de chaque bloc, puissance stable du premier au dernier." },
      { zone: 5, titre: "VO2max court", prescription: "2 × (8–12 × 30″/30″)", rpe: v30,
        stats: [["~45′", "durée totale"], [String(r5(s2 * 1.15)), "W sur les 30″"], ["8–10", "RPE cible"]], segments: vo2court(),
        label_bloc: "2 × (8–12 × 30″/30″) · 3′ entre les blocs", releve: "Commencer à 8 répétitions, monter jusqu'à 12. Variante : 4 × 4′ à " + W(s2 * 1.05, s2 * 1.1) + ", récup 3′." },
      bike ? { zone: 6, titre: "Sprint long", prescription: "3 × 30″ all out / 5′", rpe: "> " + b[5] + " W", segments: sprintLong(true),
        stats: [["~35′", "durée totale"], ["5′", "de récup"], ["10", "RPE cible"]], label_bloc: "3 × 30″ all out / 5′", releve: "Puissance moyenne de chaque 30″ : elle doit rester proche d'une répétition à l'autre." }
        : { zone: 6, titre: "Sprint long", prescription: "4–6 × 1′ / 4′", rpe: "> " + b[5] + " W", segments: sprintLong(false),
          stats: [["40–50′", "durée totale"], ["4′", "de récup"], ["9,5", "RPE cible"]], label_bloc: "4–6 × 1′ / 4′ · RPE 9,5", releve: "Puissance moyenne de chaque 1′ et RPE de séance." },
      { zone: 7, titre: "Sprint court", prescription: "6–12 × 12″ / 2′30", rpe: "all out", segments: sprintCourt(),
        stats: [["~50′", "durée totale"], ["2′30", "de récup"], ["100 %", "effort"]], label_bloc: "6–12 × 12″ / 2′30 · all out",
        releve: "Pic de puissance de chaque sprint : arrêter la série s'il chute nettement." }
    ];
    return M;
  }

  function pages(d) {
    var M = d.type === "seuils" ? modelSeuils(d) : modelPC(d);
    var list = [["profil", "Couverture", pCover(M)], ["profil", "Tes 7 zones", pZones(M)], ["profil", "Ta courbe", pCourbe(M)],
      ["profil", "Ton profil", pProfil(M)], ["profil", "Orientation", pOrientation(M)], ["profil", "Séances par zone", pSeancesOverview(M)]];
    M.seances.forEach(function (s) { list.push(["seance", "Z" + s.zone + " · " + s.titre, pSeance(s)]); });
    list.push(["profil", "Et maintenant ?", pSuite(M)]);
    return { M: M, list: list };
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
    ".udp .qpr{display:flex;align-items:center;gap:24px;min-height:118px;border-bottom:1px solid rgba(246,244,232,.1)}.udp .qpr:last-child{border-bottom:none}" +
    ".udp .qpr b{font-family:" + F_ANTON + ";font-weight:400;font-size:56px;color:" + ACC + ";transform:skewX(-10deg);width:46px;text-align:center;flex:none}" +
    ".udp .qpr span{font-weight:700;font-size:30px;line-height:1.32;text-align:left}" +
    ".udp .qpr2{min-height:170px;gap:26px}.udp .qpr2 b{font-size:64px;width:52px}.udp .qpr2 span{font-size:32px;line-height:1.3}" +
    ".udp .qpr2 small{display:block;font-weight:500;font-size:23px;color:" + SAGE + ";margin-top:6px;line-height:1.35}" +
    ".udp .qst{flex:1;padding:18px 10px 16px;text-align:center}.udp .qsv{font-family:" + F_ANTON + ";font-size:56px;line-height:1.05;transform:skewX(-11deg)}" +
    ".udp .qsl{font-size:20px;color:" + SAGE + ";margin-top:4px}" +
    ".udp .qad{display:flex;align-items:center;gap:18px;font-weight:700;font-size:25px;line-height:1.3;margin:0 0 12px;text-align:left}.udp .qad i{width:12px;height:12px;border-radius:50%;flex:none}" +
    /* panneau d'aperçu */
    ".udpx{position:fixed;inset:0;z-index:9999;background:#0e0e0e;overflow:auto;-webkit-overflow-scrolling:touch;font-family:" + F_SG + ";color:" + CREAM + "}" +
    ".udpx-bar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 14px;background:rgba(14,14,14,.96);border-bottom:1px solid rgba(246,244,232,.1)}" +
    ".udpx-bar b{flex:1 1 100%;font:400 20px " + F_ANTON + ";text-transform:uppercase;transform:skewX(-9deg);letter-spacing:.01em}" +
    ".udpx button{font:700 14px " + F_SG + ";border-radius:10px;padding:10px 14px;border:1px solid rgba(246,244,232,.18);background:transparent;color:" + CREAM + ";cursor:pointer}" +
    ".udpx button.pri{background:" + ACC + ";border-color:" + ACC + ";color:#fff}.udpx button:disabled{opacity:.45;cursor:default}" +
    ".udpx-x{position:absolute;right:12px;top:10px}" +
    ".udpx-msg{padding:10px 16px;font-size:13px;color:" + SAGE + "}" +
    ".udpx-h{padding:14px 16px 0;font:700 12px " + F_SG + ";letter-spacing:.2em;color:" + ACC + ";text-transform:uppercase}" +
    ".udpx-list{display:flex;flex-wrap:wrap;gap:22px;justify-content:center;padding:12px 12px 30px}" +
    ".udpx-it{display:flex;flex-direction:column;gap:8px;align-items:stretch}" +
    ".udpx-pv{position:relative;overflow:hidden;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5)}" +
    ".udpx-pv>div{position:absolute;left:0;top:0;transform-origin:0 0}" +
    ".udpx-row{display:flex;gap:8px;align-items:center}.udpx-row span{flex:1;font-size:13px;color:" + SAGE + "}";

  function injectCSS() { if (document.getElementById("udp-css")) return; var s = document.createElement("style"); s.id = "udp-css"; s.textContent = CSS; document.head.appendChild(s); }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var ok = function () { return (src === LIB_IMG && window.htmlToImage) || (src === LIB_PDF && window.jspdf); };
      if (ok()) return res();
      if (document.querySelector('script[src="' + src + '"]')) { var t = setInterval(function () { if (ok()) { clearInterval(t); res(); } }, 50); return; }
      var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { rej(new Error("Chargement impossible : " + src)); }; document.head.appendChild(s);
    });
  }
  var fontCSS = null;
  function toDataURL(url) { return fetch(url).then(function (r) { return r.blob(); }).then(function (b) { return new Promise(function (res) { var f = new FileReader(); f.onload = function () { res(f.result); }; f.readAsDataURL(b); }); }); }
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
  function download(blob, name) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  function share(files) {
    if (navigator.canShare && navigator.canShare({ files: files })) {
      return navigator.share({ files: files }).catch(function (e) { if (!e || e.name !== "AbortError") files.forEach(function (f, i) { setTimeout(function () { download(f, f.name); }, i * 400); }); });
    }
    files.forEach(function (f, i) { setTimeout(function () { download(f, f.name); }, i * 400); });
    return Promise.resolve();
  }

  /* ---------- aperçu + exports ---------- */
  function open(d) {
    injectCSS();
    var P = pages(d), base = "profil-" + (d.type === "seuils" ? (d.lac ? "lactate" : "rpe") : (d.run ? "vc" : "pc")) + (d.athlete ? "-" + slug(d.athlete) : "");
    var old = document.querySelector(".udpx"); if (old) old.remove();
    var ov = document.createElement("div"); ov.className = "udpx"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Profil complet");
    var W = Math.min(window.innerWidth - 32, 360), sc = W / 1080;
    var item = function (p, i) {
      return '<div class="udpx-it" style="width:' + W + 'px"><div class="udpx-pv" style="width:' + W + "px;height:" + Math.round(W * 1.25) + 'px"><div style="transform:scale(' + sc + ')"><div class="udp" data-i="' + i + '"><img class="ulogo" src="img/logo-creme.png" alt="">' + p[2] + "</div></div></div>" +
        '<div class="udpx-row"><span>' + esc(p[1]) + '</span><button data-x="img" data-i="' + i + '" disabled>Partager</button></div></div>';
    };
    var prof = [], sea = [];
    P.list.forEach(function (p, i) { (p[0] === "seance" ? sea : prof).push(item(p, i)); });
    ov.innerHTML = '<div class="udpx-bar"><b>Profil complet' + (d.athlete ? " · " + esc(d.athlete) : "") + '</b>' +
      '<button class="pri" data-x="pdf" disabled>Profil complet (PDF)</button><button data-x="seances" disabled>Les 7 séances clés</button>' +
      '<button class="udpx-x" data-x="close" aria-label="Fermer">✕</button></div>' +
      '<div class="udpx-msg">Préparation des fiches…</div>' +
      '<div class="udpx-h">Profil, zones et orientation</div><div class="udpx-list">' + prof.join("") + "</div>" +
      '<div class="udpx-h">Séances clés</div><div class="udpx-list">' + sea.join("") + "</div>";
    document.body.appendChild(ov);
    var prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    var msg = ov.querySelector(".udpx-msg"), shots = [];
    function close() { ov.remove(); document.body.style.overflow = prevOverflow; }
    function fileOf(i) { return new File([dataURLtoBlob(shots[i])], base + "-" + String(i + 1).padStart(2, "0") + "-" + slug(P.list[i][1]) + ".jpg", { type: "image/jpeg" }); }
    var ready = (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () {
      return Promise.all(FONTS.map(function (f) { return document.fonts ? document.fonts.load(f[1] + " 20px '" + f[0] + "'") : null; }));
    }).then(function () { fit(ov); return Promise.all([loadScript(LIB_IMG), getFontCSS()]); }).then(function (r) {
      var fcss = r[1], i = 0, n = P.list.length;
      function next() {
        if (i >= n) return Promise.resolve();
        var node = ov.querySelector('.udp[data-i="' + i + '"]');
        msg.textContent = "Préparation des fiches… " + (i + 1) + " / " + n;
        return window.htmlToImage.toJpeg(node, { width: 1080, height: 1350, pixelRatio: 1, quality: 0.92, backgroundColor: "#161616", fontEmbedCSS: fcss, cacheBust: false })
          .then(function (u) { shots[i] = u; var b = ov.querySelector('button[data-x="img"][data-i="' + i + '"]'); if (b) b.disabled = false; i++; return next(); });
      }
      return next();
    }).then(function () {
      msg.textContent = "Prêt. « Partager » envoie la fiche (WhatsApp, e-mail…) ou la télécharge. « Les 7 séances clés » les envoie toutes d'un coup.";
      ov.querySelector('[data-x="pdf"]').disabled = false; ov.querySelector('[data-x="seances"]').disabled = false;
      loadScript(LIB_PDF).catch(function () {});
    }).catch(function (e) { msg.textContent = "Impossible de préparer les fiches : " + (e && e.message || e); });

    ov.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-x]"); if (!b || b.disabled) return;
      var x = b.dataset.x;
      if (x === "close") return close();
      if (x === "img") return share([fileOf(+b.dataset.i)]);
      if (x === "seances") return share(P.list.map(function (p, i) { return p[0] === "seance" ? fileOf(i) : null; }).filter(Boolean));
      if (x === "pdf") {
        b.disabled = true; b.textContent = "PDF…";
        return ready.then(function () { return loadScript(LIB_PDF); }).then(function () {
          var J = window.jspdf.jsPDF, doc = new J({ orientation: "portrait", unit: "px", format: [1080, 1350], hotfixes: ["px_scaling"], compress: true });
          shots.forEach(function (u, i) { if (i) doc.addPage([1080, 1350], "portrait"); doc.addImage(u, "JPEG", 0, 0, 1080, 1350); });
          return share([new File([doc.output("blob")], base + ".pdf", { type: "application/pdf" })]);
        }).catch(function (e) { msg.textContent = "PDF impossible : " + (e && e.message || e); })
          .then(function () { b.disabled = false; b.textContent = "Profil complet (PDF)"; });
      }
    });
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape" && document.body.contains(ov)) { close(); document.removeEventListener("keydown", k); } });
    return ov;
  }

  window.udtDossier = { open: open, pages: function (d) { injectCSS(); return pages(d).list; }, version: "2026-11-26c" };
})();
