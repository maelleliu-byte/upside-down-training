/* ============================================================
 * CONVERTISSEUR D'UNITÉS DANS LES SÉANCES ENGINE
 * Panneau « 🔄 Convertisseur · <machine> » sous la séance (à côté de
 * « Mes zones d'intensité »), pour tous les athlètes.
 * - Row / Ski Erg  : watts ↔ split /500 m ↔ cal/h   (formules Concept2)
 * - Bike Erg       : watts ↔ split /1000 m           (formule Concept2 ; les calories
 *                    du BikeErg ne suivent pas la formule du rameur → non affichées)
 * - Echo / Assault : renvoi vers le calculateur Assault ↔ Echo
 * Les valeurs en watts affichées dans la séance deviennent des raccourcis.
 * ============================================================ */
(function () {
  'use strict';

  /* Concept2 : watts = 2,80 / (allure en s/m)³ ; cal/h = watts × 4 × 0,8604 + 300 */
  var C2 = {
    row:  { label: 'Row Erg',  dist: 500,  half: 1 },
    ski:  { label: 'Ski Erg',  dist: 500,  half: 1 },
    bike: { label: 'Bike Erg', dist: 1000, nocal: true }   /* BikeErg : à watts égaux, l'allure /1000 m = l'allure /500 m du rameur */
  };
  /* allure en s/m : split /500 m ÷ 500 (Row, Ski) ; BikeErg : split /1000 m ÷ 500 (vérifié sur des logs Concept2 : 1:35.4/1000 m = 403 W) */
  function wFromSplit(sec) { var p = sec / 500; return 2.8 / (p * p * p); }
  function splitFromW(w) { return Math.cbrt(2.8 / w) * 500; }
  function calhFromW(w) { return w * 4 * 0.8604 + 300; }
  function wFromCalh(c) { return (c - 300) / (4 * 0.8604); }
  function fmt(sec) {
    if (!isFinite(sec) || sec <= 0) return '';
    var t = Math.round(sec * 10) / 10, m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }
  function parseSplit(v) {
    v = String(v || '').trim().replace(',', '.'); if (!v) return NaN;
    if (v.indexOf(':') >= 0) { var a = v.split(':'); return (+a[0]) * 60 + (+a[1]); }
    return +v;
  }
  function r1(x) { return Math.round(x * 10) / 10; }

  function modOf(s) {
    var txt = ((s && s.title) || '') + ' ' + ((s && s.content) || '').replace(/<[^>]+>/g, ' ');
    try { if (window.udtAllure && udtAllure.modOf) return udtAllure.modOf((s && s.title) || '') || udtAllure.modOf(txt); } catch (e) { }
    var t = txt.toLowerCase();
    if (/\bski\b|skierg/.test(t)) return 'ski';
    if (/\b(row|rameur)\b/.test(t)) return 'row';
    if (/assault|air ?bike/.test(t)) return 'assault';
    if (/\becho\b/.test(t)) return 'echo';
    if (/bike ?erg|\bbike\b/.test(t)) return 'bike';
    return null;
  }

  function css() {
    if (document.getElementById('ec-css')) return;
    var st = document.createElement('style'); st.id = 'ec-css';
    st.textContent = [
      '.ec{margin:10px 0 0;border:1px solid rgba(45,212,191,.35);border-radius:12px;background:rgba(45,212,191,.05)}',
      '.ec>summary{list-style:none;cursor:pointer;padding:11px 14px;font-size:11px;font-weight:700;letter-spacing:2px;color:#2dd4bf;display:flex;justify-content:space-between;align-items:center}',
      '.ec>summary::-webkit-details-marker{display:none}',
      '.ec-b{padding:2px 14px 14px}',
      '.ec-g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}',
      '.ec-f label{display:block;font-size:9.5px;letter-spacing:1.2px;color:var(--muted);font-weight:700;margin-bottom:5px;text-transform:uppercase}',
      '.ec-f input{width:100%;box-sizing:border-box;background:var(--dark);border:1.5px solid var(--border2);border-radius:10px;color:var(--text);font-size:16px;font-weight:700;padding:10px 8px;text-align:center;font-family:inherit}',
      '.ec-f input:focus{border-color:#2dd4bf;outline:none}',
      '.ec-q{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}',
      '.ec-q button{font-size:11.5px;font-weight:700;padding:5px 9px;border-radius:999px;border:1px solid rgba(45,212,191,.5);background:transparent;color:#2dd4bf;cursor:pointer;font-family:inherit}',
      '.ec-h{font-size:11px;color:var(--muted);margin-top:8px;line-height:1.45}',
      '.ec-m{display:flex;gap:6px;margin:0 0 10px}',
      '.ec-m button{flex:1;font-size:11.5px;font-weight:700;padding:7px 6px;border-radius:9px;border:1px solid var(--border2);background:var(--card2);color:var(--text2);cursor:pointer;font-family:inherit}',
      '.ec-m button.on{border-color:#2dd4bf;color:#2dd4bf;background:rgba(45,212,191,.1)}'
    ].join('');
    document.head.appendChild(st);
  }

  /* panneau HTML pour une séance (vide si pas une séance machine) */
  function panel(s) {
    if (!s) return '';
    var mod = modOf(s);
    var engine = /engine/.test(String(s.type || ''));
    var hasWatts = /\bwatts?\b|\d\s*w\b|split|\/500|\/1000|puissance critique/i.test(((s.title || '') + ' ' + (s.content || '')).replace(/<[^>]+>/g, ' '));
    if (!(mod in C2) && mod !== 'echo' && mod !== 'assault') { if (!(engine && hasWatts)) return ''; mod = 'row'; }
    css();
    var id = 'ec' + Math.random().toString(36).slice(2, 8);
    var label = mod === 'echo' ? 'Echo Bike' : mod === 'assault' ? 'Assault Bike' : C2[mod].label;
    var body;
    if (!(mod in C2)) {
      body = '<div class="ec-h">Équivalences watts, calories et cadence entre Assault et Echo :</div>' +
        '<a href="https://calculateur-echo.vercel.app/" target="_blank" rel="noopener" style="display:block;text-align:center;margin-top:8px;padding:11px;border-radius:10px;border:1px solid #2dd4bf;color:#2dd4bf;font-weight:700;font-size:13px;text-decoration:none">Ouvrir le calculateur Assault ↔ Echo</a>';
    } else {
      body = '<div class="ec-m">' + Object.keys(C2).map(function (k) {
          return '<button type="button" data-ecm="' + k + '"' + (k === mod ? ' class="on"' : '') + '>' + C2[k].label + '</button>';
        }).join('') + '</div>' +
        '<div class="ec-q" data-ecq></div>' +
        '<div class="ec-g">' +
        '<div class="ec-f"><label>Watts</label><input inputmode="decimal" data-ec="w" placeholder="200"></div>' +
        '<div class="ec-f"><label data-ecsl>Split /' + C2[mod].dist + ' m</label><input inputmode="decimal" data-ec="s" placeholder="' + (mod === 'bike' ? '2:00.0' : '1:50.0') + '"></div>' +
        '<div class="ec-f"><label>Cal / h</label><input inputmode="decimal" data-ec="c" placeholder="' + (C2[mod].nocal ? '—' : '1000') + '"' + (C2[mod].nocal ? ' disabled' : '') + '></div>' +
        '</div><div class="ec-h">Tape une valeur, les deux autres se calculent (formules Concept2). Touche une puissance de la séance pour la convertir.</div>';
    }
    return '<details class="ec" id="' + id + '" data-mod="' + mod + '" ontoggle="udtConv.init(this)">' +
      '<summary><span>🔄 CONVERTISSEUR · ' + label.toUpperCase() + '</span><span>▾</span></summary>' +
      '<div class="ec-b">' + body + '</div></details>';
  }

  function init(el) {
    if (!el || !el.open || el.dataset.ready) return;
    el.dataset.ready = '1';
    var mod = el.dataset.mod; if (!(mod in C2)) return;
    var inW = el.querySelector('[data-ec=w]'), inS = el.querySelector('[data-ec=s]'), inC = el.querySelector('[data-ec=c]');
    function fromW(w, skip) {
      var m = C2[mod];
      if (!(w > 0)) return;
      if (skip !== 'w') inW.value = r1(w);
      if (skip !== 's') inS.value = fmt(splitFromW(w, m));
      if (skip !== 'c') inC.value = m.nocal ? '' : Math.round(calhFromW(w));
    }
    inW.addEventListener('input', function () { fromW(parseFloat(inW.value.replace(',', '.')), 'w'); });
    inS.addEventListener('input', function () { var t = parseSplit(inS.value); if (t > 20) fromW(wFromSplit(t, C2[mod]), 's'); });
    inC.addEventListener('input', function () { if (C2[mod].nocal) return; var c = parseFloat(inC.value.replace(',', '.')); if (c > 300) fromW(wFromCalh(c), 'c'); });
    el.querySelectorAll('[data-ecm]').forEach(function (b) {
      b.addEventListener('click', function () {
        mod = b.getAttribute('data-ecm');
        el.querySelectorAll('[data-ecm]').forEach(function (x) { x.classList.toggle('on', x === b); });
        el.querySelector('[data-ecsl]').textContent = 'Split /' + C2[mod].dist + ' m';
        var hl = el.querySelector('summary span'); if (hl) hl.textContent = '🔄 CONVERTISSEUR · ' + C2[mod].label.toUpperCase();
        inC.disabled = !!C2[mod].nocal; inC.placeholder = C2[mod].nocal ? '—' : '1000';
        var w = parseFloat(inW.value.replace(',', '.')); if (w > 0) fromW(w, 'w');
      });
    });
    /* raccourcis : puissances affichées dans la séance (pastilles de zones, % de PC) */
    var card = el.closest('.session-card') || el.closest('.read-modal-body') || el.parentElement;
    var txt = card ? card.innerText : '';
    var seen = {}, vals = [];
    (txt.match(/\d+(?:[.,]\d+)?\s?(?:watts|W)\b/g) || []).forEach(function (t) {
      var v = parseFloat(t.replace(',', '.')); if (v >= 40 && v <= 2000 && !seen[v]) { seen[v] = 1; vals.push(v); }
    });
    var q = el.querySelector('[data-ecq]');
    if (q && vals.length) {
      q.innerHTML = vals.slice(0, 10).map(function (v) { return '<button type="button" data-ecv="' + v + '">' + v + ' W</button>'; }).join('');
      q.querySelectorAll('[data-ecv]').forEach(function (b) { b.addEventListener('click', function () { fromW(+b.getAttribute('data-ecv')); }); });
      fromW(vals[0]);
    }
  }

  window.udtConv = { panel: panel, init: init, wFromSplit: wFromSplit, splitFromW: splitFromW };
})();
