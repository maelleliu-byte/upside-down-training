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
(function () {
  "use strict";
  var C = { bg: "#FBFAF7", ink: "#0D3B33", teal: "#0B9488", muted: "#5C6F6A", line: "#E3E6E1", card: "#FFFFFF" };

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
    txt("UPSIDE DOWN TRAINING", P, y, "700 22px " + SG, C.teal); y += 56;
    txt(d.kind || "Zones d'entraînement", P, y, "700 46px " + SG, C.ink); y += 46;
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
          ctx.fillStyle = i === 0 ? C.ink : C.card; roundRect(ctx, x, y, bw, bh, 18); ctx.fill();
          if (i) { ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke(); }
        }
        txt(String(r[0]).toUpperCase(), x + 22, y + 38, "700 17px " + SG, i === 0 ? "#9FE3D8" : C.muted);
        var fs = 38; ctx.font = "700 " + fs + "px " + SG;
        while (fs > 20 && ctx.measureText(String(r[1])).width > bw - 44) { fs -= 2; ctx.font = "700 " + fs + "px " + SG; }
        txt(String(r[1]), x + 22, y + 86, "700 " + fs + "px " + SG, i === 0 ? "#FFFFFF" : C.ink);
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
    txt("Upside Down Training · upside-down-training.netlify.app", P, y, "500 19px " + IN, C.teal);
    return y + 56;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function png(d) {
    var W = 1080, c = document.createElement("canvas"), ctx = c.getContext("2d");
    var go = function () {
      c.width = W; c.height = 10; var H = draw(d, ctx, W, true);
      c.width = W; c.height = Math.ceil(H);
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, c.height);
      draw(d, ctx, W, false);
      c.toBlob(function (b) { if (b) deliver(b, slug(d.file || d.title) + ".png"); }, "image/png");
    };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go, go);
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

  window.udtZonesExport = { png: png, csv: csv };
})();
