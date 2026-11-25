/* Export des zones d'entraînement (Profil L-V et PC / VC).
   udtZonesExport.png(data) : fiche image 1080 px de large, partagée sur mobile ou téléchargée.
   udtZonesExport.csv(data) : tableau ouvrable dans Excel / Google Sheets.
   data = {
     kind: "Profilage charge-vitesse",        // titre de la fiche
     title: "Back Squat",                     // mouvement ou modalité
     athlete: "Prénom Nom",                   // optionnel
     date: "12 nov. 2026",                    // date du test de référence
     refs: [["1RM estimé","142,5 kg"], ...],  // valeurs de référence
     head: ["Zone","Plage","Charges"],        // colonnes du tableau
     rows: [{c:"#hex", cells:["...", "...", "..."], sub:"texte secondaire"}],
     note: "texte en bas de fiche",
     file: "zones-back-squat"                 // nom de fichier sans extension
   } */
/* CHARTE VISUELLE UDT — toute fiche exportée passe par ce modèle et sort identique :
   fond teal, logo Upside Down, palette de zones officielle (bleu, vert, jaune, orange, rouge, violet).
   Un module qui envoie une couleur hors palette ou pas de logo est corrigé automatiquement
   ET une alerte « non harmonisé » s'affiche (et dans la console) pour qu'on le corrige à la source.
   Voir CHARTE-VISUELLE.md. */
(function () {
  "use strict";
  var PALETTE = ["#3B8FEA", "#22B35E", "#E8C21C", "#F58A1F", "#E5483B", "#9B6CF0"];
  var LOGO_DEFAULT = "M21.25 26.56 L20.94 27.06 L20.94 27.94 L21.75 30.00 L22.00 31.81 L22.44 32.50 L23.06 32.38 L23.56 31.88 L24.31 30.44 L24.69 30.44 L25.06 30.75 L25.38 31.81 L25.69 32.25 L26.56 32.19 L28.06 28.88 L29.00 27.25 L28.75 26.62 L28.19 26.69 L27.50 27.69 L26.88 29.19 L26.38 29.56 L25.88 29.06 L25.44 27.38 L25.00 26.81 L24.50 26.62 L24.12 27.25 L23.94 29.06 L23.44 29.62 L22.81 29.12 L22.00 26.81 L21.69 26.56Z M35.56 26.38 L35.00 26.44 L34.62 26.94 L34.50 27.62 L34.62 28.81 L34.31 29.38 L33.75 29.31 L33.19 28.94 L30.75 26.62 L30.19 26.56 L29.94 26.81 L29.75 38.31 L30.00 39.50 L30.44 39.94 L30.81 39.94 L31.19 39.31 L31.19 30.12 L31.50 29.75 L32.25 30.00 L35.00 32.56 L35.69 32.69 L36.00 32.19 L36.06 27.38 L35.94 26.81Z M6.62 26.25 L6.19 26.56 L5.88 27.56 L6.00 32.50 L6.38 32.94 L7.12 33.12 L9.50 32.94 L11.00 31.81 L12.00 29.88 L12.00 29.56 L11.06 27.62 L10.31 26.88 L8.81 26.19Z M8.19 27.75 L8.69 27.75 L9.44 28.06 L9.81 28.44 L10.12 29.38 L10.12 30.06 L9.88 30.69 L9.38 31.25 L8.56 31.62 L7.75 31.38 L7.38 30.44 L7.38 28.62 L7.62 28.12Z M15.75 26.06 L14.50 26.50 L13.25 27.56 L12.38 29.81 L13.06 31.50 L14.06 32.56 L14.81 33.00 L16.19 33.19 L17.44 32.88 L18.88 31.62 L19.44 30.12 L19.44 29.25 L19.00 27.94 L18.12 26.94 L16.81 26.19Z M15.88 27.62 L16.38 27.69 L17.44 28.31 L17.94 29.31 L17.94 30.12 L17.62 30.75 L16.69 31.56 L16.06 31.75 L15.25 31.50 L14.62 31.00 L14.06 30.00 L14.38 28.50Z M29.38 13.88 L28.69 13.94 L27.50 15.50 L26.12 16.00 L25.06 17.75 L25.06 18.00 L26.06 19.25 L26.69 19.75 L28.44 19.94 L29.19 19.69 L29.56 19.25 L29.75 18.38 L29.81 14.56Z M27.50 17.00 L27.94 17.12 L28.25 17.50 L28.12 18.06 L27.69 18.44 L27.38 18.44 L26.94 17.81 L27.00 17.38Z M13.31 13.81 L12.50 14.31 L12.00 14.94 L11.31 16.38 L11.31 17.06 L12.12 18.69 L13.38 19.69 L14.38 19.94 L16.06 19.81 L16.56 19.44 L16.81 18.50 L16.69 14.31 L16.31 13.81 L15.62 13.56 L14.38 13.56Z M14.25 15.00 L14.81 15.12 L15.31 15.88 L15.25 17.56 L15.00 18.12 L14.56 18.50 L14.19 18.50 L13.56 18.12 L12.94 17.19 L12.94 16.38 L13.25 15.62 L13.69 15.19Z M6.44 13.69 L6.12 14.12 L6.25 14.69 L6.94 14.94 L8.44 14.94 L8.81 15.31 L8.81 15.62 L8.38 16.06 L7.19 16.12 L6.75 16.44 L6.69 16.75 L6.88 17.06 L7.44 17.38 L8.31 17.44 L8.62 17.81 L8.62 18.19 L8.25 18.62 L6.94 18.62 L6.50 18.81 L6.25 19.19 L6.31 19.62 L6.88 19.94 L9.19 19.94 L9.81 19.75 L10.31 19.00 L10.31 14.44 L10.12 14.06 L9.31 13.56Z M32.31 13.81 L31.31 14.75 L30.94 15.69 L30.94 18.94 L31.12 19.50 L31.69 19.75 L32.12 19.44 L32.31 18.94 L32.38 15.88 L32.81 15.25 L33.62 15.00 L34.06 15.19 L34.62 16.00 L34.75 19.31 L35.25 19.75 L35.75 19.62 L36.06 18.81 L36.06 15.81 L35.75 14.81 L34.88 13.94 L34.06 13.56 L33.19 13.50Z M23.25 13.50 L22.38 13.50 L21.62 13.81 L21.12 14.25 L20.75 15.06 L20.75 15.75 L21.12 16.56 L22.31 17.31 L22.69 17.94 L22.50 18.56 L21.56 18.56 L21.19 18.88 L21.25 19.62 L21.75 19.94 L22.88 19.94 L23.38 19.75 L24.06 19.12 L24.69 18.19 L24.62 17.75 L23.94 16.94 L22.25 15.56 L22.31 15.12 L22.62 14.88 L24.06 14.94 L24.56 14.56 L24.31 14.00Z M18.44 5.88 L18.12 6.19 L18.00 6.94 L18.06 18.75 L18.31 19.50 L18.94 19.62 L19.38 19.25 L19.56 18.38 L19.56 7.06 L19.25 6.31 L18.75 5.88Z";
  function hexRgb(h) { h = String(h || "").trim().replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); var n = parseInt(h, 16); return /^[0-9a-f]{6}$/i.test(h) ? [n >> 16 & 255, n >> 8 & 255, n & 255] : null; }
  function nearest(c) {
    var rgb = hexRgb(c); if (!rgb) return PALETTE[0];
    var best = PALETTE[0], bd = 1e9;
    PALETTE.forEach(function (p) { var q = hexRgb(p), d = 0; for (var i = 0; i < 3; i++) d += (q[i] - rgb[i]) * (q[i] - rgb[i]); if (d < bd) { bd = d; best = p; } });
    return best;
  }
  function alertCharte(issues, d) {
    var msg = "Attention : cette fiche n'était pas harmonisée avec la charte UDT (" + issues.join(", ") + "). Corrigée automatiquement, à reprendre dans le module « " + (d.kind || "?") + " ».";
    try { console.warn("[charte UDT] " + msg, d); } catch (e) {}
    try {
      var el = document.createElement("div");
      el.setAttribute("role", "alert");
      el.textContent = "⚠️ " + msg;
      el.style.cssText = "position:fixed;left:12px;right:12px;bottom:16px;z-index:99999;padding:12px 14px;border-radius:12px;background:#E5483B;color:#fff;font:600 13px/1.4 Inter,system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)";
      document.body.appendChild(el); setTimeout(function () { el.remove(); }, 7000);
    } catch (e) {}
  }
  // Applique la charte : thème teal imposé, logo par défaut, couleurs ramenées à la palette
  function harmonize(d) {
    var issues = [], out = Object.assign({}, d);
    if (d.theme && d.theme !== "teal" && d.theme !== "gris") issues.push("thème « " + d.theme + " »");
    out.theme = "gris"; // charte v2 : toutes les fiches sur fond gris (voir CHARTE-VISUELLE.md)
    if (!d.logo) { out.logo = LOGO_DEFAULT; if (d.logo !== undefined) issues.push("logo manquant"); }
    var bad = 0;
    out.rows = (d.rows || []).map(function (r) {
      var c = String(r.c || "").toUpperCase();
      if (PALETTE.indexOf(c) >= 0) return r;
      bad++; return Object.assign({}, r, { c: nearest(r.c) });
    });
    if (bad) issues.push(bad + " couleur" + (bad > 1 ? "s" : "") + " hors palette");
    if (issues.length) alertCharte(issues, d);
    return out;
  }
  var LIGHT = { bg: "#FBFAF7", ink: "#0D3B33", teal: "#0B9488", muted: "#5C6F6A", line: "#E3E6E1", card: "#FFFFFF", hero: "#0D3B33", heroLab: "#9FE3D8", heroTxt: "#FFFFFF" };
  // Fiche plein teal (charte Upside Down Training) : data.theme = "teal"
  var TEAL = { bg: "#0B9488", ink: "#FFFFFF", teal: "#FFFFFF", muted: "rgba(255,255,255,.78)", line: "rgba(255,255,255,.22)", card: "rgba(3,52,46,.30)", hero: "#05453E", heroLab: "#9FE3D8", heroTxt: "#FFFFFF" };
  // Fiche charte v2 « gris » : fond gris flouté, cartes sombres, titre Anton italique, teal en accent
  var GRIS = { bg: "#161616", ink: "#F6F4E8", teal: "#14A595", logo: "#F6F4E8", muted: "rgba(246,244,232,.66)", line: "rgba(246,244,232,.10)", card: "rgba(0,0,0,.34)", hero: "#14A595", heroLab: "rgba(255,255,255,.85)", heroTxt: "#FFFFFF", gris: true };
  var C = LIGHT;

  function slug(s) {
    return String(s || "zones").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "zones";
  }
  function deliver(blob, name) {
    var file = null;
    try { file = new File([blob], name, { type: blob.type }); } catch (e) {}
    var touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).catch(function () {});
      return;
    }
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function wrap(ctx, text, maxW) {
    var words = String(text || "").split(/\s+/), lines = [], cur = "";
    words.forEach(function (w) {
      var t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function draw(d, ctx, W, measureOnly) {
    var P = 64, y = 72, colW = W - 2 * P;
    var SG = "'Space Grotesk', system-ui, sans-serif", IN = "Inter, system-ui, sans-serif";
    function txt(s, x, yy, font, color, align) {
      if (measureOnly) return;
      ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || "left"; ctx.fillText(s, x, yy);
    }
    // en-tête
    if (d.logo && typeof Path2D !== "undefined") {
      if (!measureOnly) {
        ctx.save(); ctx.translate(P - 8, y - 50); ctx.scale(1.6, 1.6);
        ctx.fillStyle = C.logo || C.teal; ctx.fill(new Path2D(d.logo), "evenodd"); ctx.restore();
      }
      txt("UPSIDE DOWN TRAINING", P + 72, y, "700 24px " + SG, C.logo || C.teal); y += 60;
    } else { txt("UPSIDE DOWN TRAINING", P, y, "700 22px " + SG, C.teal); y += 56; }
    if (C.gris) {
      y += 8;
      if (!measureOnly) {
        ctx.save(); ctx.translate(P, y); ctx.transform(1, 0, -0.16, 1, 0, 0);
        ctx.font = "400 58px Anton, " + SG; ctx.fillStyle = C.ink; ctx.textAlign = "left";
        ctx.fillText(String(d.kind || "Zones d'entraînement").toUpperCase(), 0, 0); ctx.restore();
        ctx.fillStyle = C.teal; ctx.fillRect(P, y + 16, 160, 6);
      }
      y += 60;
    } else { txt(d.kind || "Zones d'entraînement", P, y, "700 46px " + SG, C.ink); y += 46; }
    txt(d.title || "", P, y, "700 34px " + SG, C.teal); y += 40;
    var meta = [d.athlete, d.date ? "Test du " + d.date : "Test en cours (non enregistré)"].filter(Boolean).join("  ·  ");
    if (meta) { txt(meta, P, y, "500 24px " + IN, C.muted); y += 20; }
    y += 28;
    // références
    var refs = d.refs || [];
    if (refs.length) {
      var n = refs.length, gap = 16, bw = (colW - gap * (n - 1)) / n, bh = 112;
      refs.forEach(function (r, i) {
        var x = P + i * (bw + gap);
        if (!measureOnly) {
          ctx.fillStyle = i === 0 ? C.hero : C.card; roundRect(ctx, x, y, bw, bh, 18); ctx.fill();
          if (i) { ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke(); }
        }
        txt(String(r[0]).toUpperCase(), x + 22, y + 38, "700 17px " + SG, i === 0 ? C.heroLab : C.muted);
        var fs = 38; ctx.font = "700 " + fs + "px " + SG;
        while (fs > 20 && ctx.measureText(String(r[1])).width > bw - 44) { fs -= 2; ctx.font = "700 " + fs + "px " + SG; }
        txt(String(r[1]), x + 22, y + 86, "700 " + fs + "px " + SG, i === 0 ? C.heroTxt : C.ink);
      });
      y += bh + 34;
    }
    // tableau
    var head = d.head || [], rows = d.rows || [], cols = head.length || 3;
    var cw = [0.42, 0.29, 0.29]; if (cols !== 3) { cw = []; for (var k = 0; k < cols; k++) cw.push(1 / cols); }
    var cx = [P + 28]; for (var j = 1; j < cols; j++) cx.push(cx[j - 1] + cw[j - 1] * (colW - 28));
    head.forEach(function (h, j) { txt(String(h).toUpperCase(), j ? cx[j] + cw[j] * (colW - 28) - 24 : cx[0], y, "700 17px " + SG, C.muted, j ? "right" : "left"); });
    y += 18;
    rows.forEach(function (r) {
      ctx.font = "400 20px " + IN;
      var subLines = r.sub ? wrap(ctx, r.sub, cw[0] * (colW - 28) - 10) : [];
      var rh = 74 + subLines.length * 26;
      if (!measureOnly) {
        ctx.fillStyle = C.card; roundRect(ctx, P, y, colW, rh, 16); ctx.fill();
        ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = r.c || C.teal; roundRect(ctx, P, y, 10, rh, 5); ctx.fill();
      }
      (r.cells || []).forEach(function (c, j) {
        if (!j) txt(String(c), cx[0], y + 46, "700 27px " + SG, C.ink);
        else txt(String(c), cx[j] + cw[j] * (colW - 28) - 24, y + 46, (j === 1 ? "600 " : "700 ") + "25px " + (j === 1 ? IN : SG), j === 1 ? C.muted : C.ink, "right");
      });
      subLines.forEach(function (l, i) { txt(l, cx[0], y + 76 + i * 26, "400 20px " + IN, C.muted); });
      y += rh + 12;
    });
    // note
    if (d.note) {
      y += 34; ctx.font = "400 20px " + IN;
      wrap(ctx, d.note, colW).forEach(function (l) { txt(l, P, y, "400 20px " + IN, C.muted); y += 28; });
    }
    y += 26;
    txt("Upside Down Training · app.upsidedown-training.fr", P, y, "500 19px " + IN, C.teal);
    return y + 56;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function png(d) {
    d = harmonize(d);
    var W = 1080, c = document.createElement("canvas"), ctx = c.getContext("2d");
    var go = function () {
      C = d.theme === "gris" ? GRIS : d.theme === "teal" ? TEAL : LIGHT;
      c.width = W; c.height = 10; var H = draw(d, ctx, W, true);
      c.width = W; c.height = Math.ceil(H);
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, c.height);
      if (C.gris) { // halo gris clair au centre = rendu « fond flouté » de la charte
        var g = ctx.createRadialGradient(W * 0.45, c.height * 0.32, 40, W * 0.5, c.height * 0.45, Math.max(W, c.height) * 0.75);
        g.addColorStop(0, "rgba(120,120,120,.38)"); g.addColorStop(1, "rgba(120,120,120,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, c.height);
      }
      draw(d, ctx, W, false);
      C = LIGHT;
      c.toBlob(function (b) { if (b) deliver(b, slug(d.file || d.title) + ".png"); }, "image/png");
    };
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    if (d.theme === "gris" && typeof FontFace !== "undefined" && document.fonts) {
      ready = ready.then(function () {
        if (document.fonts.check("40px Anton")) return;
        var f = new FontFace("Anton", "url(/fonts/anton-latin-400-normal.woff2)");
        return f.load().then(function (ff) { document.fonts.add(ff); }).catch(function () {});
      });
    }
    ready.then(go, go);
  }

  function csv(d) {
    var q = function (v) { v = String(v == null ? "" : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [[d.kind || "Zones"], [d.title || ""]];
    if (d.athlete) lines.push(["Athlète", d.athlete]);
    if (d.date) lines.push(["Date du test", d.date]); else lines.push(["Date du test", "test en cours (non enregistré)"]);
    (d.refs || []).forEach(function (r) { lines.push([r[0], r[1]]); });
    lines.push([]);
    lines.push((d.head || []).concat(["Détail"]));
    (d.rows || []).forEach(function (r) { lines.push((r.cells || []).concat([r.sub || ""])); });
    if (d.note) { lines.push([]); lines.push([d.note]); }
    var body = "﻿" + lines.map(function (l) { return l.map(q).join(";"); }).join("\r\n");
    deliver(new Blob([body], { type: "text/csv;charset=utf-8" }), slug(d.file || d.title) + ".csv");
  }

  window.udtZonesExport = { png: png, csv: csv, palette: PALETTE.slice(), logo: LOGO_DEFAULT };
})();
