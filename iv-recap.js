/* Récap de séance des blocs ENGINE / RUN en intervalles :
   valeur par intervalle (barres) + évolution du RPE (courbe, couleur = zone de la fiche « Calibre ton RPE ») */
(function () {
  function css() {
    if (document.getElementById('ivr-css')) return;
    var st = document.createElement('style'); st.id = 'ivr-css';
    st.textContent = [
      '.ivr{margin-top:12px}',
      '.ivr .t{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:6px}',
      '.ivr .k{display:flex;gap:6px;margin-bottom:8px}',
      '.ivr .k div{flex:1;background:var(--card2);border-radius:8px;padding:6px 8px;min-width:0}',
      '.ivr .k small{display:block;font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ivr .k b{font-family:"Bebas Neue",sans-serif;font-size:20px;font-weight:400;letter-spacing:.5px}',
      '.ivr .lg{display:flex;gap:14px;font-size:10px;color:var(--muted);margin-top:2px}',
      '.ivr .lg i{display:inline-block;width:9px;height:9px;border-radius:2px;vertical-align:-1px;margin-right:4px}',
      '.ivr .rd{margin-top:8px;font-size:12px;line-height:1.5;color:var(--text2);background:var(--card2);border-radius:8px;padding:7px 10px}'
    ].join('');
    document.head.appendChild(st);
  }
  function zoneCol(r) { return r <= 1 ? '#2e6da4' : r <= 3 ? '#3fa35b' : r < 6 ? '#e3b23c' : r < 8 ? '#d8872a' : '#c0392b'; }
  function fr(x) { return String(Math.round(x * 10) / 10).replace('.', ','); }
  function sgn(x, u) { return (x > 0 ? '+' : x < 0 ? '−' : '') + fr(Math.abs(x)) + (u ? ' ' + u : ''); }

  /* sd = sets_data d'un score (tableau ou JSON). Renvoie '' si ce n'est pas un score par intervalles. */
  window.ivRecapHtml = function (sd, opts) {
    try { if (typeof sd === 'string') sd = JSON.parse(sd); } catch (e) { return ''; }
    if (!Array.isArray(sd) || sd.length < 2 || !sd.some(function (x) { return x && 'rpe' in x; })) return '';
    css();
    opts = opts || {};
    var unit = (sd[0] && sd[0].unit) || 'W', sum = /^(m|cal)$/.test(unit);
    var vals = sd.map(function (x) { return x.value == null ? null : +x.value; });
    var rpes = sd.map(function (x) { return x.rpe == null ? null : +x.rpe; });
    var vv = vals.filter(function (x) { return x != null; }), rr = rpes.filter(function (x) { return x != null; });
    var n = sd.length, W = 320, H = 162, L = 34, R = 296, B = 140, T = 18;
    var vmax = vv.length ? Math.max.apply(null, vv) : 1, vmin = vv.length ? Math.min.apply(null, vv) : 0;
    var lo = Math.max(0, Math.floor(vmin * 0.8 / 10) * 10), hi = Math.ceil(vmax * 1.06 / 10) * 10; if (hi <= lo) hi = lo + 10;
    var y = function (v) { return B - (v - lo) / (hi - lo) * (B - T); };
    var yr = function (r) { return B - r / 10 * (B - T); };
    var slot = (R - L) / n, bw = Math.min(46, slot * 0.55);
    var cx = function (i) { return L + slot * (i + 0.5); };
    var g = '';
    [lo, (lo + hi) / 2, hi].forEach(function (v, k) {
      var yy = y(v).toFixed(1);
      g += '<line x1="' + L + '" y1="' + yy + '" x2="' + R + '" y2="' + yy + '" stroke="var(--border)"' + (k ? ' stroke-dasharray="3 4"' : '') + '/>' +
        '<text x="' + (L - 5) + '" y="' + (+yy + 3) + '" fill="var(--muted)" font-size="10" text-anchor="end">' + Math.round(v) + '</text>';
    });
    g += '<text x="' + (R + 6) + '" y="' + (yr(10) + 3) + '" fill="var(--muted)" font-size="10">10</text><text x="' + (R + 6) + '" y="' + (yr(5) + 3) + '" fill="var(--muted)" font-size="10">5</text>';
    vals.forEach(function (v, i) {
      if (v != null) {
        var yy = y(v);
        g += '<rect x="' + (cx(i) - bw / 2).toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (B - yy).toFixed(1) + '" rx="4" fill="var(--accent)" fill-opacity=".85"/>';
        if (B - yy > 16) g += '<text x="' + cx(i).toFixed(1) + '" y="' + (B - 6) + '" fill="#000" font-size="' + (n > 6 ? 9 : 11) + '" font-weight="700" text-anchor="middle">' + fr(v) + '</text>';
      }
      g += '<text x="' + cx(i).toFixed(1) + '" y="' + (B + 16) + '" fill="var(--text2)" font-size="' + (n > 6 ? 9 : 11) + '" text-anchor="middle">' + (n > 6 ? '' : 'INT ') + (i + 1) + '</text>';
    });
    var pts = [];
    rpes.forEach(function (r, i) { if (r != null) pts.push(cx(i).toFixed(1) + ',' + yr(r).toFixed(1)); });
    if (pts.length > 1) g += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#ff8c47" stroke-width="2"/>';
    rpes.forEach(function (r, i) {
      if (r == null) return;
      g += '<circle cx="' + cx(i).toFixed(1) + '" cy="' + yr(r).toFixed(1) + '" r="9" fill="' + zoneCol(r) + '"/>' +
        '<text x="' + cx(i).toFixed(1) + '" y="' + (yr(r) + 3.5).toFixed(1) + '" fill="#fff" font-size="' + (String(r).length > 2 ? 8 : 10) + '" font-weight="700" text-anchor="middle">' + fr(r) + '</text>';
    });

    var avg = vv.length ? vv.reduce(function (a, b) { return a + b; }, 0) / vv.length : null;
    var tot = vv.reduce(function (a, b) { return a + b; }, 0);
    var fv = vals[0], lv = vals[n - 1], fR = rpes[0], lR = rpes[n - 1];
    var dW = fv != null && lv != null ? lv - fv : null, dR = fR != null && lR != null ? lR - fR : null;
    var k = '<div class="k">' +
      '<div><small>' + (sum ? 'Total' : 'Moyenne') + '</small><b style="color:var(--accent)">' + (vv.length ? fr(sum ? tot : avg) + ' ' + unit : '–') + '</b></div>' +
      '<div><small>Écart INT 1 → ' + n + '</small><b>' + (dW == null ? '–' : sgn(dW, unit)) + '</b></div>' +
      '<div><small>Dérive RPE</small><b style="color:#ff8c47">' + (dR == null ? '–' : sgn(dR)) + '</b></div></div>';

    var rd = '';
    if (dW != null && dR != null && fv) {
      var p = dW / fv;
      if (Math.abs(p) <= 0.03 && dR >= 1.5) rd = 'Valeur stable, RPE qui monte de ' + fr(dR) + ' : l\'effort s\'accumule, normal en fin de séance au seuil.';
      else if (Math.abs(p) <= 0.03) rd = 'Valeur et RPE stables : effort bien réparti sur tous les intervalles.';
      else if (p < -0.03 && dR >= 0) rd = 'Valeur qui baisse à RPE égal ou plus haut : départ trop rapide ou fatigue.';
      else if (p > 0.03 && dR <= 1) rd = 'Valeur qui monte sans faire grimper le RPE : marge sous le pied, la cible peut monter.';
      else if (p > 0.03) rd = 'Valeur et RPE qui montent ensemble : progression maîtrisée.';
      else rd = 'Valeur qui baisse et RPE qui descend : intervalles de fin en dessous de la cible.';
    }
    return '<div class="ivr">' + (opts.noTitle ? '' : '<div class="t">Récap de séance</div>') + k +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block" role="img" aria-label="Valeur et RPE par intervalle">' + g + '</svg>' +
      '<div class="lg"><span><i style="background:var(--accent)"></i>' + unit + '</span><span><i style="background:#d8872a;border-radius:50%"></i>RPE (couleur = zone)</span></div>' +
      (rd ? '<div class="rd">' + rd + '</div>' : '') + '</div>';
  };
})();
