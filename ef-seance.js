/* ============================================================
 * ENDURANCE FONDAMENTALE DANS SÉANCE + — « 🫀 Suivi endurance fondamentale »
 * ------------------------------------------------------------
 * Pour le type Engine : modalité, durée, échauffement exclu du
 * calcul, intensité cible (valeur fixe ou % via %|FORMAT|MOUVEMENT|),
 * mode de saisie de la FC (2 moyennes ou relevés réguliers), consigne.
 *
 * Enregistré dans la colonne `ef` de la séance (sessions /
 * personal_sessions). L'athlète saisit ses bpm sous « Mon score »
 * (ef-saisie.js) ; la dérive arrive dans wod_scores.ef.
 *
 * API utilisée par admin.js :
 *   efGetFormData(type) -> objet ef ou null
 *   efFormReset()
 * ============================================================ */
(function () {
  if (window.__patchBound_efSeance) return;
  window.__patchBound_efSeance = true;

  var EF_TYPES = ['engine'];
  var MODS = [['run', 'Run'], ['bike', 'Bike'], ['row', 'Row'], ['ski', 'Ski'], ['autre', 'Autre']];
  var UNITS = ['W', 'km/h', 'min/km', '/500m', '%'];
  var FORMATS = ['VITESSE CRITIQUE', 'PUISSANCE CRITIQUE', 'TEST 20MIN / FTP', 'TEST 12MIN'];
  var REF = { run: 'Run', bike: 'Bike Erg', row: 'Row', ski: 'Ski Erg' };

  var state = { on: false, d: null };

  function _byId(id) { return document.getElementById(id); }
  function _esc(s) {
    return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function _num(s) {
    if (s == null || s === '') return null;
    var n = parseFloat(String(s).replace(',', '.').trim());
    return isFinite(n) ? n : null;
  }
  function _show(v) { return v == null ? '' : String(v).replace('.', ','); }
  function _type() { var el = _byId('f-type'); return el ? el.value : ''; }
  function _appMoves() {
    try { return (movements || []).map(function (m) { return m.name; }).filter(Boolean); } catch (e) { return []; }
  }
  function _defaultRef(mod) {
    var want = REF[mod] || '';
    var norm = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); };
    var list = _appMoves();
    return list.find(function (n) { return norm(n) === norm(want); }) || want;
  }
  function _defaultUnit(mod) { return mod === 'run' ? 'km/h' : 'W'; }
  function _defaultFmt(mod) { return mod === 'run' ? 'VITESSE CRITIQUE' : 'PUISSANCE CRITIQUE'; }

  function _new() {
    return {
      mod: 'bike', duration: '40:00', warmup: '10:00', unit: 'W', target: null,
      pct: null, fmt: 'PUISSANCE CRITIQUE', ref: _defaultRef('bike'),
      mode: 'halves', every: 10, note: ''
    };
  }

  // ---------- rendu ----------

  function _formula(d) {
    if (d.unit !== '%' || _num(d.pct) == null) return '';
    return _show(_num(d.pct)).replace(',', '.') + '%|' + (d.fmt || '') + '|' + String(d.ref || '').toUpperCase() + '|';
  }

  function _bodyHTML(d) {
    var pct = d.unit === '%';
    var list = _appMoves(), ref = d.ref || _defaultRef(d.mod);
    if (pct && ref && list.indexOf(ref) < 0) list = [ref].concat(list);
    var fmts = FORMATS.indexOf(d.fmt) < 0 && d.fmt ? [d.fmt].concat(FORMATS) : FORMATS;
    var f = _formula(d);
    return '' +
      '<div class="efs-block">' +
        '<div class="efs-grid3">' +
          '<div><label class="form-label">Modalité</label><select class="form-select" data-ef="mod">' +
            MODS.map(function (m) { return '<option value="' + m[0] + '"' + (m[0] === d.mod ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select></div>' +
          '<div><label class="form-label">Durée</label><input class="form-input" data-ef="duration" value="' + _esc(d.duration) + '" placeholder="40:00"></div>' +
          '<div><label class="form-label">Échauff. exclu</label><input class="form-input" data-ef="warmup" value="' + _esc(d.warmup) + '" placeholder="10:00"></div>' +
        '</div>' +
        '<div class="efs-row">' +
          '<div><label class="form-label">Intensité cible</label><select class="form-select" data-ef="unit">' +
            UNITS.map(function (u) { return '<option' + (u === d.unit ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></div>' +
          (pct
            ? '<div class="efs-grow"><label class="form-label">%</label><input class="form-input" inputmode="decimal" data-ef="pct" value="' + _show(d.pct) + '" placeholder="70"></div>'
            : '<div class="efs-grow"><label class="form-label">Valeur</label><input class="form-input" data-ef="target" value="' + _esc(d.target) + '" placeholder="' + (d.unit === 'W' ? '150' : d.unit === 'km/h' ? '10,5' : '5:30') + '"></div>') +
        '</div>' +
        (pct
          ? '<div class="efs-grid2">' +
              '<div><label class="form-label">Format</label><select class="form-select" data-ef="fmt">' +
                fmts.map(function (x) { return '<option' + (x === d.fmt ? ' selected' : '') + '>' + _esc(x) + '</option>'; }).join('') + '</select></div>' +
              '<div><label class="form-label">Du mouvement (PR de l\'athlète)</label><select class="form-select" data-ef="ref">' +
                list.map(function (n) { return '<option' + (n === ref ? ' selected' : '') + '>' + _esc(n) + '</option>'; }).join('') + '</select></div>' +
            '</div>' +
            '<div class="efs-formula">' + (f ? 'Formule : <code>' + _esc(f) + '</code> → cible calculée pour chaque athlète' : '') + '</div>'
          : '') +
        '<div class="efs-mode">' +
          '<span class="efs-lbl">Saisie FC</span>' +
          '<button type="button" data-efmode="halves" class="' + (d.mode !== 'splits' ? 'on' : '') + '">2 moyennes</button>' +
          '<button type="button" data-efmode="splits" class="' + (d.mode === 'splits' ? 'on' : '') + '">Relevés réguliers</button>' +
          (d.mode === 'splits'
            ? '<select class="form-select efs-every" data-ef="every">' + [5, 10].map(function (n) {
                return '<option value="' + n + '"' + (n === d.every ? ' selected' : '') + '>toutes les ' + n + ' min</option>'; }).join('') + '</select>'
            : '') +
        '</div>' +
        '<div class="efs-hint">' + (d.mode === 'splits'
          ? 'L\'athlète note sa FC à chaque relevé après l\'échauffement. Dérive = moyenne 2e moitié vs 1re moitié.'
          : 'L\'athlète note sa FC moyenne de la 1re et de la 2e moitié (après l\'échauffement).') +
          ' S\'il saisit aussi ' + (d.unit === 'W' || d.unit === '%' && d.mod !== 'run' ? 'ses watts' : 'son allure') + ', la dérive tient compte de l\'intensité réelle.</div>' +
        '<input class="form-input efs-note" data-ef="note" value="' + _esc(d.note) + '" placeholder="Consigne (ex. si dérive > 5 % ou RPE > 3, baisse de 0,2 à 0,3 km/h)">' +
      '</div>';
  }

  function _render() {
    var box = _byId('ef-field');
    if (!box) return;
    var show = EF_TYPES.indexOf(_type()) >= 0;
    box.style.display = show ? 'block' : 'none';
    if (!show) return;
    var tg = _byId('ef-toggle');
    if (tg) tg.classList.toggle('on', state.on);
    var body = _byId('ef-body');
    if (!body) return;
    if (!state.on) { body.innerHTML = ''; body.style.display = 'none'; return; }
    if (!state.d) state.d = _new();
    body.style.display = 'block';
    body.innerHTML = _bodyHTML(state.d);
  }

  // ---------- événements ----------

  function _bind() {
    var box = _byId('ef-field');
    if (!box || box.__bound) return;
    box.__bound = true;
    box.addEventListener('click', function (e) {
      var t = e.target.closest('button');
      if (!t || !box.contains(t)) return;
      if (t.id === 'ef-toggle') { state.on = !state.on; if (state.on && !state.d) state.d = _new(); _render(); return; }
      if (t.dataset.efmode && state.d) { state.d.mode = t.dataset.efmode; _render(); }
    });
    function onField(e) {
      var el = e.target, f = el.dataset && el.dataset.ef, d = state.d;
      if (!f || !d) return;
      if (f === 'mod') {
        d.mod = el.value;
        if (d.unit !== '%') d.unit = _defaultUnit(d.mod);
        d.fmt = _defaultFmt(d.mod); d.ref = _defaultRef(d.mod);
        _render(); return;
      }
      if (f === 'unit') {
        d.unit = el.value;
        if (d.unit === '%') { if (!d.ref) d.ref = _defaultRef(d.mod); if (!d.fmt) d.fmt = _defaultFmt(d.mod); }
        _render(); return;
      }
      if (f === 'fmt' || f === 'ref') { d[f] = el.value; _render(); return; }
      if (f === 'every') { d.every = parseInt(el.value, 10) || 10; return; }
      if (f === 'pct') {
        d.pct = _num(el.value);
        var fe = box.querySelector('.efs-formula');
        var fx = _formula(d);
        if (fe) fe.innerHTML = fx ? 'Formule : <code>' + _esc(fx) + '</code> → cible calculée pour chaque athlète' : '';
        return;
      }
      d[f] = el.value;
    }
    box.addEventListener('input', onField);
    box.addEventListener('change', onField);
  }

  // ---------- API ----------

  window.efGetFormData = function (type) {
    if (EF_TYPES.indexOf(type || _type()) < 0 || !state.on || !state.d) return null;
    var d = state.d, pct = d.unit === '%';
    return {
      v: 1, mod: d.mod, duration: (d.duration || '').trim(), warmup: (d.warmup || '').trim(),
      unit: d.unit, target: pct ? null : (String(d.target == null ? '' : d.target).trim() || null),
      pct: pct ? _num(d.pct) : null, fmt: pct ? d.fmt : null, ref: pct ? d.ref : null,
      mode: d.mode === 'splits' ? 'splits' : 'halves', every: d.mode === 'splits' ? (d.every || 10) : null,
      note: (d.note || '').trim()
    };
  };

  window.efSetFormData = function (ef) {
    if (ef && typeof ef === 'object') {
      state.d = Object.assign(_new(), ef);
      if (state.d.target != null) state.d.target = String(state.d.target);
      state.on = true;
    } else { state.d = null; state.on = false; }
    _render();
  };

  window.efFormReset = function () { state = { on: false, d: null }; _render(); };

  // ---------- injection ----------

  function _injectStyles() {
    if (_byId('efs-styles')) return;
    var st = document.createElement('style');
    st.id = 'efs-styles';
    st.textContent = [
      '#ef-field{border:1px solid var(--border2);border-radius:12px;padding:12px;background:var(--card2)}',
      '.efs-head{display:flex;align-items:center;gap:10px}',
      '.efs-head label{font-size:13px;color:var(--text);font-weight:700;cursor:pointer;flex:1}',
      '.efs-head small{display:block;font-weight:400;color:var(--muted);font-size:11px;margin-top:2px}',
      '#ef-body{margin-top:12px}',
      '.efs-block{border:1px solid var(--border);border-radius:10px;padding:10px;background:var(--card)}',
      '.efs-grid3,.efs-grid2{display:grid;gap:8px;margin-top:8px}',
      '.efs-grid3{grid-template-columns:repeat(3,minmax(0,1fr))}',
      '.efs-grid2{grid-template-columns:minmax(0,1fr) minmax(0,1.4fr)}',
      '.efs-grid3:first-child{margin-top:0}',
      '.efs-row{display:flex;gap:8px;align-items:flex-end;margin-top:8px}',
      '.efs-row>div:first-child{flex:0 0 110px}',
      '.efs-grow{flex:1;min-width:0}',
      '#ef-field .form-label{font-size:9px;letter-spacing:1px;margin-bottom:4px}',
      '#ef-field .form-input,#ef-field .form-select{padding:9px 10px;font-size:13px}',
      '.efs-formula{font-size:11px;color:var(--muted);margin-top:6px}',
      '.efs-formula:empty{display:none}',
      '.efs-formula code{color:var(--text2);font-size:11px}',
      '.efs-mode{display:flex;align-items:center;gap:6px;margin-top:10px;flex-wrap:wrap}',
      '.efs-lbl{font-size:11px;font-weight:700;color:var(--text2);margin-right:2px}',
      '.efs-mode button{flex:0 0 auto;border:1px solid var(--border2);background:transparent;color:var(--text2);',
      'border-radius:8px;padding:6px 9px;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap}',
      '.efs-mode button.on{background:var(--accent);border-color:var(--accent);color:#000}',
      '#ef-field .efs-every{width:auto;padding:6px 8px;font-size:12px}',
      '.efs-hint{font-size:11px;color:var(--muted);margin-top:6px;line-height:1.5}',
      '.efs-note{margin-top:8px}',
      '@media(max-width:420px){.efs-grid3{grid-template-columns:repeat(2,minmax(0,1fr))}.efs-grid2{grid-template-columns:1fr}}'
    ].join('');
    document.head.appendChild(st);
  }

  function _inject() {
    var sets = _byId('sets-field');
    if (!sets) return false;
    if (!_byId('ef-field')) {
      var box = document.createElement('div');
      box.className = 'form-group';
      box.id = 'ef-field';
      box.style.display = 'none';
      box.innerHTML =
        '<div class="efs-head">' +
          '<button type="button" class="toggle-cb" id="ef-toggle" style="flex-shrink:0"></button>' +
          '<label onclick="document.getElementById(\'ef-toggle\').click()">🫀 Suivi endurance fondamentale' +
            '<small>L\'athlète saisit sa FC, tu vois la dérive dans ses retours</small></label>' +
        '</div>' +
        '<div id="ef-body" style="display:none"></div>';
      var after = _byId('vbt-field') || sets;
      after.insertAdjacentElement('afterend', box);
    }
    _bind();
    _render();
    return true;
  }

  function _hookType() {
    if (window.__efsTypeHooked) return;
    var typeSel = _byId('f-type');
    if (!typeSel) return;
    window.__efsTypeHooked = true;
    typeSel.addEventListener('change', function () { _render(); });
    if (typeof window.toggleSetsField === 'function') {
      var orig = window.toggleSetsField;
      window.toggleSetsField = function () { var r = orig.apply(this, arguments); _render(); return r; };
    }
  }

  function _hookReset() {
    if (window.__efsResetHooked || typeof window.resetSessionForm !== 'function') return;
    window.__efsResetHooked = true;
    var orig = window.resetSessionForm;
    window.resetSessionForm = function () { var r = orig.apply(this, arguments); window.efFormReset(); return r; };
  }

  function _hookEdit(name, table, idGetter) {
    var flag = '__efsEditHooked_' + name;
    if (window[flag] || typeof window[name] !== 'function') return;
    window[flag] = true;
    var orig = window[name];
    window[name] = async function () {
      window.efFormReset();
      var r = await orig.apply(this, arguments);
      try {
        var id = idGetter();
        if (id) {
          var res = await sb.from(table).select('ef').eq('id', id).maybeSingle();
          window.efSetFormData(res && res.data ? res.data.ef : null);
        }
      } catch (e) {}
      _render();
      return r;
    };
  }

  function _init() {
    _injectStyles();
    var ok = _inject();
    _hookType();
    _hookReset();
    _hookEdit('editSession', 'sessions', function () { try { return editingSessionId; } catch (e) { return null; } });
    _hookEdit('persoEditSession', 'personal_sessions', function () { try { return personalEditingId; } catch (e) { return null; } });
    return ok;
  }

  function _boot() {
    if (_init()) return;
    var tries = 0;
    var iv = setInterval(function () { tries++; if (_init() || tries > 40) clearInterval(iv); }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();
  window.addEventListener('studio:ready', function () { _init(); });
})();
