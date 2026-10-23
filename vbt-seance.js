/* ============================================================
 * VBT DANS SÉANCE + — section « ⚡ Séance VBT »
 * ------------------------------------------------------------
 * Pour les types Force et Weightlifting : exercices VBT avec
 * mouvement, résistance, séries × reps, repos, charge, cible de
 * vitesse min/max, perte max et mode (calibrée / charge fixe).
 *
 * Les réglages sont enregistrés dans la colonne `vbt` de la
 * séance (sessions / personal_sessions). Le trigger SQL
 * vbt_sync_session() crée ou met à jour la séance « Planifiée »
 * dans le Journal VBT (table vbt_journal) quand elle est pour
 * un coach : son espace perso, ou un programme avec la case
 * « Ajouter à mon journal VBT » cochée.
 *
 * API utilisée par admin.js :
 *   vbtGetFormData(type) -> objet vbt ou null
 *   vbtFormReset()
 * ============================================================ */
(function () {
  if (window.__patchBound_vbtSeance) return;
  window.__patchBound_vbtSeance = true;

  var VBT_TYPES = ['strength', 'weightlifting'];

  var DEFAULT_MOVES = [
    ['bsq', 'Back Squat', 'force'], ['boxsq', 'Box Squat', 'force'], ['pinbsq', 'Pin Back Squat', 'force'],
    ['fsq', 'Front Squat', 'force'], ['pinfsq', 'Pin Front Squat', 'force'], ['bench', 'Bench Press', 'force'],
    ['pinpress', 'Pin Press', 'force'], ['dl', 'Deadlift', 'force'], ['dldef', 'Deficit Deadlift', 'force'],
    ['blockdl', 'Block Deadlift', 'force'], ['ohp', 'Shoulder Press', 'force'], ['sn', 'Snatch', 'haltero'],
    ['psn', 'Power Snatch', 'haltero'], ['hsn', 'Hang Snatch', 'haltero'], ['hpsn', 'Hang Power Snatch', 'haltero'],
    ['cl', 'Clean', 'haltero'], ['pcl', 'Power Clean', 'haltero'], ['hcl', 'Hang Clean', 'haltero'],
    ['hpcl', 'Hang Power Clean', 'haltero'], ['bpcl', 'Block Power Clean', 'haltero'], ['pp', 'Push Press', 'haltero'],
    ['pj', 'Push Jerk', 'haltero'], ['jk', 'Split Jerk', 'haltero'], ['snp', 'Snatch Pull', 'haltero'],
    ['clp', 'Clean Pull', 'haltero']
  ].map(function (m) { return { id: m[0], name: m[1], type: m[2] }; });

  var ACC = [
    ['', 'Barre seule'], ['bl', 'Bandes légères'], ['bm', 'Bandes moyennes'], ['bh', 'Bandes lourdes'],
    ['ch', 'Chaînes'], ['bc', 'Bandes + chaînes'], ['rb', 'Reverse bands']
  ];

  var ZONES = [
    ['Force max', null, 0.50], ['Force-accél.', 0.50, 0.75], ['Force-vitesse', 0.75, 1.00],
    ['Vitesse-force', 1.00, 1.30], ['Vitesse max', 1.30, null]
  ];

  // Mouvement de référence par défaut pour une charge en % (doit exister dans les mouvements de l'app)
  var REF = {
    bsq: 'Back Squat', boxsq: 'Back Squat', pinbsq: 'Back Squat', fsq: 'Front Squat', pinfsq: 'Front Squat',
    bench: 'Bench Press', pinpress: 'Bench Press', dl: 'Deadlift', dldef: 'Deadlift', blockdl: 'Deadlift',
    ohp: 'Shoulder Press', sn: 'Snatch', psn: 'Power Snatch', hsn: 'Snatch', hpsn: 'Hang Power Snatch',
    cl: 'Clean', pcl: 'Power Clean', hcl: 'Clean', hpcl: 'Hang Power Clean', bpcl: 'Power Clean',
    pp: 'Push Press', pj: 'PUSH JERK', jk: 'SPLIT JERK', snp: 'Snatch', clp: 'Clean'
  };
  var FORMATS = ['1RM', '2RM', '3RM', '5RM'];

  var state = { on: false, toJournal: true, blocks: [] };
  var moves = DEFAULT_MOVES.slice();
  var movesLoaded = false;

  // ---------- utilitaires ----------

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
  function _isPerso() { try { return !!personalAthleteId; } catch (e) { return false; } }
  // Mouvements de l'app (table movements, chargée par core.js)
  function _appMoves() {
    try { return (movements || []).map(function (m) { return m.name; }).filter(Boolean); } catch (e) { return []; }
  }
  function _defaultRef(mv) {
    var want = REF[mv] || _move(mv).name;
    var list = _appMoves();
    var norm = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); };
    return list.find(function (n) { return norm(n) === norm(want); }) || want;
  }
  function _move(id) { return moves.find(function (m) { return m.id === id; }) || { id: id, name: id, type: 'force' }; }

  // Mouvements du Journal VBT du coach (noms modifiés, mouvements ajoutés)
  async function _loadMoves() {
    if (movesLoaded) return;
    movesLoaded = true;
    try {
      var uid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null;
      if (!uid || typeof sb === 'undefined') return;
      var r = await sb.from('vbt_journal').select('data').eq('user_id', uid).eq('doc_key', 'settings').maybeSingle();
      var list = r && r.data && r.data.data && r.data.data.moves;
      if (Array.isArray(list) && list.length) {
        moves = list.map(function (m) { return { id: m.id, name: m.name, type: m.type === 'haltero' ? 'haltero' : 'force' }; });
        _render();
      }
    } catch (e) { /* liste par défaut */ }
  }

  function _newBlock() {
    var sets = parseInt((_byId('f-sets') || {}).value, 10);
    var halt = _type() === 'weightlifting';
    var mv = (moves.find(function (m) { return m.type === (halt ? 'haltero' : 'force'); }) || moves[0]).id;
    return {
      mv: mv, acc: '', sets: sets > 0 ? sets : 5, reps: halt ? 2 : 3, rest: '', load: null,
      loadMode: 'pct', pct: null, ref: _defaultRef(mv), fmt: '1RM',
      vmin: null, vmax: null, vlMax: halt ? null : 20, calibrated: true, note: ''
    };
  }

  // ---------- rendu ----------

  function _moveOptions(sel) {
    var groups = [['force', 'Force'], ['haltero', 'Haltéro']];
    return groups.map(function (g) {
      var opts = moves.filter(function (m) { return m.type === g[0]; }).map(function (m) {
        return '<option value="' + _esc(m.id) + '"' + (m.id === sel ? ' selected' : '') + '>' + _esc(m.name) + '</option>';
      }).join('');
      return opts ? '<optgroup label="' + g[1] + '">' + opts + '</optgroup>' : '';
    }).join('');
  }

  function _blockHTML(b, i) {
    var halt = _move(b.mv).type === 'haltero';
    var zones = halt ? '' : '<div class="vbs-zones">' + ZONES.map(function (z, k) {
      var on = _num(b.vmin) === z[1] && _num(b.vmax) === z[2];
      return '<button type="button" data-vz="' + k + '" data-i="' + i + '" class="' + (on ? 'on' : '') + '">' + z[0] + '</button>';
    }).join('') + '</div>';
    return '' +
      '<div class="vbs-block" data-i="' + i + '">' +
        '<div class="vbs-row">' +
          '<div class="vbs-grow"><label class="form-label">Exercice ' + (i + 1) + '</label>' +
            '<select class="form-select" data-vf="mv" data-i="' + i + '">' + _moveOptions(b.mv) + '</select></div>' +
          (halt ? '' : '<div class="vbs-grow"><label class="form-label">Résistance</label>' +
            '<select class="form-select" data-vf="acc" data-i="' + i + '">' + ACC.map(function (a) {
              return '<option value="' + a[0] + '"' + ((b.acc || '') === a[0] ? ' selected' : '') + '>' + a[1] + '</option>';
            }).join('') + '</select></div>') +
          '<button type="button" class="vbs-del" data-vdel="' + i + '" aria-label="Supprimer l\'exercice">✕</button>' +
        '</div>' +
        '<div class="vbs-grid3">' +
          '<div><label class="form-label">Séries</label><input class="form-input" inputmode="numeric" data-vf="sets" data-i="' + i + '" value="' + _show(b.sets) + '"></div>' +
          '<div><label class="form-label">Reps</label><input class="form-input" inputmode="numeric" data-vf="reps" data-i="' + i + '" value="' + _show(b.reps) + '"></div>' +
          '<div><label class="form-label">Repos</label><input class="form-input" data-vf="rest" data-i="' + i + '" value="' + _esc(b.rest) + '" placeholder="1:20"></div>' +
        '</div>' +
        _loadHTML(b, i) +
        '<div class="vbs-grid3">' +
          '<div><label class="form-label">Cible min m/s</label><input class="form-input" inputmode="decimal" data-vf="vmin" data-i="' + i + '" value="' + _show(b.vmin) + '" placeholder="0,70"></div>' +
          '<div><label class="form-label">Cible max m/s</label><input class="form-input" inputmode="decimal" data-vf="vmax" data-i="' + i + '" value="' + _show(b.vmax) + '" placeholder="0,80"></div>' +
          '<div><label class="form-label">Perte max %</label><input class="form-input" inputmode="decimal" data-vf="vlMax" data-i="' + i + '" value="' + _show(b.vlMax) + '" placeholder="20"></div>' +
        '</div>' +
        zones +
        '<div class="vbs-mode">' +
          '<button type="button" data-vcal="1" data-i="' + i + '" class="' + (b.calibrated !== false ? 'on' : '') + '">Calibrée</button>' +
          '<button type="button" data-vcal="0" data-i="' + i + '" class="' + (b.calibrated === false ? 'on' : '') + '">Charge fixe</button>' +
          '<span class="vbs-hint">' + (b.calibrated === false
            ? 'La charge ne bouge pas, la vitesse est mesurée.'
            : 'La charge s\'ajuste pour rester dans la plage.') + '</span>' +
        '</div>' +
        '<input class="form-input vbs-note" data-vf="note" data-i="' + i + '" value="' + _esc(b.note) + '" placeholder="Consigne (setup, bandes, hauteur des pins…)">' +
      '</div>';
  }

  function _loadHTML(b, i) {
    var pct = b.loadMode !== 'kg';
    var seg = '<div class="vbs-seg">' +
      '<button type="button" data-vlm="pct" data-i="' + i + '" class="' + (pct ? 'on' : '') + '">%</button>' +
      '<button type="button" data-vlm="kg" data-i="' + i + '" class="' + (pct ? '' : 'on') + '">kg</button></div>';
    if (!pct) {
      return '<div class="vbs-load"><div><label class="form-label">Charge</label>' + seg + '</div>' +
        '<div class="vbs-grow"><label class="form-label">Charge kg</label><input class="form-input" inputmode="decimal" data-vf="load" data-i="' + i + '" value="' + _show(b.load) + '" placeholder="180"></div></div>';
    }
    var list = _appMoves();
    var ref = b.ref || _defaultRef(b.mv);
    if (list.indexOf(ref) < 0) list = [ref].concat(list);
    return '<div class="vbs-load"><div><label class="form-label">Charge</label>' + seg + '</div>' +
      '<div class="vbs-grow"><label class="form-label">%</label><input class="form-input" inputmode="decimal" data-vf="pct" data-i="' + i + '" value="' + _show(b.pct) + '" placeholder="85"></div>' +
      '<div class="vbs-grow"><label class="form-label">Format</label><select class="form-select" data-vf="fmt" data-i="' + i + '">' +
        FORMATS.map(function (f) { return '<option' + (f === (b.fmt || '1RM') ? ' selected' : '') + '>' + f + '</option>'; }).join('') + '</select></div>' +
      '</div>' +
      '<div style="margin-top:8px"><label class="form-label">Du mouvement (PR de l\'athlète)</label><select class="form-select" data-vf="ref" data-i="' + i + '">' +
        list.map(function (n) { return '<option' + (n === ref ? ' selected' : '') + '>' + _esc(n) + '</option>'; }).join('') + '</select></div>' +
      (_num(b.pct) != null ? '<div class="vbs-formula">Dans la séance : <code>' + _esc(_show(_num(b.pct)).replace(',', '.') + '%|' + (b.fmt || '1RM') + '|' + ref.toUpperCase() + '|') + '</code> → charge calculée pour chaque athlète</div>' : '');
  }

  function _destText() {
    if (!_isPerso()) return '';
    var me = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null;
    var forMe = false;
    try { forMe = personalAthleteId === me; } catch (e) {}
    return forMe
      ? '<div class="vbs-dest">→ Arrive dans ton Journal VBT en « Planifiée ».</div>'
      : '<div class="vbs-dest">Réglages VBT enregistrés avec la séance. Elle arrive dans le Journal VBT seulement si cet espace perso est celui d\'un coach.</div>';
  }

  function _render() {
    var box = _byId('vbt-field');
    if (!box) return;
    var show = VBT_TYPES.indexOf(_type()) >= 0;
    box.style.display = show ? 'block' : 'none';
    if (!show) return;
    var tg = _byId('vbt-toggle');
    if (tg) tg.classList.toggle('on', state.on);
    var body = _byId('vbt-body');
    if (!body) return;
    if (!state.on) { body.innerHTML = ''; body.style.display = 'none'; return; }
    body.style.display = 'block';
    body.innerHTML =
      (_isPerso() ? _destText() :
        '<label class="vbs-journal"><input type="checkbox" id="vbt-to-journal"' + (state.toJournal ? ' checked' : '') + '> Ajouter à mon Journal VBT</label>') +
      state.blocks.map(_blockHTML).join('') +
      '<button type="button" class="vbs-add" id="vbt-add">+ Ajouter un exercice VBT</button>';
  }

  // ---------- événements ----------

  function _bind() {
    var box = _byId('vbt-field');
    if (!box || box.__bound) return;
    box.__bound = true;

    box.addEventListener('click', function (e) {
      var t = e.target.closest('button');
      if (!t || !box.contains(t)) return;
      if (t.id === 'vbt-toggle') {
        state.on = !state.on;
        if (state.on && !state.blocks.length) state.blocks.push(_newBlock());
        _render(); return;
      }
      if (t.id === 'vbt-add') { state.blocks.push(_newBlock()); _render(); return; }
      var i = parseInt(t.dataset.i, 10);
      if (t.dataset.vdel != null) {
        state.blocks.splice(parseInt(t.dataset.vdel, 10), 1);
        if (!state.blocks.length) state.on = false;
        _render(); return;
      }
      if (t.dataset.vlm != null && state.blocks[i]) {
        state.blocks[i].loadMode = t.dataset.vlm;
        if (t.dataset.vlm === 'pct' && !state.blocks[i].ref) state.blocks[i].ref = _defaultRef(state.blocks[i].mv);
        _render(); return;
      }
      if (t.dataset.vcal != null && state.blocks[i]) { state.blocks[i].calibrated = t.dataset.vcal === '1'; _render(); return; }
      if (t.dataset.vz != null && state.blocks[i]) {
        var z = ZONES[parseInt(t.dataset.vz, 10)];
        state.blocks[i].vmin = z[1]; state.blocks[i].vmax = z[2]; _render(); return;
      }
    });

    function onField(e) {
      var el = e.target;
      if (el.id === 'vbt-to-journal') { state.toJournal = el.checked; return; }
      var f = el.dataset.vf; if (!f) return;
      var b = state.blocks[parseInt(el.dataset.i, 10)]; if (!b) return;
      if (f === 'mv') {
        b.mv = el.value;
        b.ref = _defaultRef(b.mv);
        if (_move(b.mv).type === 'haltero') { b.acc = ''; if (b.vlMax === 20) b.vlMax = null; }
        _render(); return;
      }
      if (f === 'acc' || f === 'rest' || f === 'note') { b[f] = el.value; return; }
      if (f === 'ref' || f === 'fmt') { b[f] = el.value; _render(); return; }
      if (f === 'pct') { b.pct = _num(el.value); _refreshFormula(el, b); return; }
      if (f === 'sets' || f === 'reps') { var n = parseInt(el.value, 10); b[f] = n > 0 ? n : null; return; }
      b[f] = _num(el.value);
    }
    box.addEventListener('input', onField);
    box.addEventListener('change', onField);
  }

  function _refreshFormula(el, b) {
    var blk = el.closest('.vbs-block');
    if (!blk) return;
    var old = blk.querySelector('.vbs-formula');
    var html = _num(b.pct) != null ? '<div class="vbs-formula">Dans la séance : <code>' + _esc(_show(_num(b.pct)).replace(',', '.') + '%|' + (b.fmt || '1RM') + '|' + (b.ref || '').toUpperCase() + '|') + '</code> → charge calculée pour chaque athlète</div>' : '';
    if (old) old.outerHTML = html || '<span></span>';
    else if (html) { var sel = blk.querySelector('[data-vf=ref]'); (sel ? sel.parentElement : blk.querySelector('.vbs-load')).insertAdjacentHTML('afterend', html); }
  }

  // ---------- API ----------

  window.vbtGetFormData = function (type) {
    if (VBT_TYPES.indexOf(type || _type()) < 0 || !state.on || !state.blocks.length) return null;
    var out = {
      blocks: state.blocks.map(function (b) {
        return {
          mv: b.mv, acc: b.acc || '', sets: b.sets || 1, reps: b.reps || 1, rest: (b.rest || '').trim(),
          loadMode: b.loadMode === 'kg' ? 'kg' : 'pct',
          load: b.loadMode === 'kg' ? _num(b.load) : null,
          pct: b.loadMode === 'kg' ? null : _num(b.pct),
          ref: b.loadMode === 'kg' ? null : (b.ref || _defaultRef(b.mv)),
          fmt: b.loadMode === 'kg' ? null : (b.fmt || '1RM'),
          vmin: _num(b.vmin), vmax: _num(b.vmax), vlMax: _num(b.vlMax),
          calibrated: b.calibrated !== false, note: (b.note || '').trim()
        };
      })
    };
    if (!_isPerso()) out.to_journal = !!state.toJournal;
    return out;
  };

  window.vbtSetFormData = function (vbt) {
    var blocks = vbt && Array.isArray(vbt.blocks) ? vbt.blocks : [];
    state.blocks = blocks.map(function (b) {
      var c = Object.assign({}, b);
      if (!c.loadMode) c.loadMode = c.load != null ? 'kg' : 'pct';
      if (c.loadMode === 'pct' && !c.ref) c.ref = _defaultRef(c.mv);
      if (!c.fmt) c.fmt = '1RM';
      return c;
    });
    state.on = state.blocks.length > 0;
    state.toJournal = vbt && vbt.to_journal != null ? !!vbt.to_journal : true;
    _render();
  };

  window.vbtFormReset = function () {
    state = { on: false, toJournal: true, blocks: [] };
    _render();
  };

  // ---------- injection ----------

  function _injectStyles() {
    if (_byId('vbs-styles')) return;
    var st = document.createElement('style');
    st.id = 'vbs-styles';
    st.textContent = [
      '#vbt-field{border:1px solid var(--border2);border-radius:12px;padding:12px;background:var(--card2)}',
      '.vbs-head{display:flex;align-items:center;gap:10px}',
      '.vbs-head label{font-size:13px;color:var(--text);font-weight:700;cursor:pointer;flex:1}',
      '.vbs-head small{display:block;font-weight:400;color:var(--muted);font-size:11px;margin-top:2px}',
      '#vbt-body{margin-top:12px}',
      '.vbs-journal{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2);margin-bottom:10px;cursor:pointer}',
      '.vbs-dest{font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.5}',
      '.vbs-block{border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:10px;background:var(--card)}',
      '.vbs-row{display:flex;gap:8px;align-items:flex-end}',
      '.vbs-grow{flex:1;min-width:0}',
      '.vbs-del{flex:0 0 auto;width:38px;height:40px;border-radius:9px;border:1px solid var(--border2);background:transparent;color:var(--muted);cursor:pointer}',
      '.vbs-grid4,.vbs-grid3{display:grid;gap:8px;margin-top:8px}',
      '.vbs-grid4{grid-template-columns:repeat(4,minmax(0,1fr))}',
      '.vbs-grid3{grid-template-columns:repeat(3,minmax(0,1fr))}',
      '@media(max-width:420px){.vbs-grid4{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '#vbt-field .form-label{font-size:9px;letter-spacing:1px;margin-bottom:4px}',
      '#vbt-field .form-input,#vbt-field .form-select{padding:9px 10px;font-size:13px}',
      '.vbs-zones{display:flex;gap:6px;overflow-x:auto;margin-top:8px;scrollbar-width:none}',
      '.vbs-zones button,.vbs-mode button{flex:0 0 auto;border:1px solid var(--border2);background:transparent;color:var(--text2);',
      'border-radius:8px;padding:6px 9px;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap}',
      '.vbs-zones button.on,.vbs-mode button.on{background:var(--accent);border-color:var(--accent);color:#000}',
      '.vbs-mode{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap}',
      '.vbs-hint{font-size:11px;color:var(--muted);flex:1;min-width:150px}',
      '.vbs-note{margin-top:8px}',
      '.vbs-load{display:flex;gap:8px;align-items:flex-end;margin-top:8px}',
      '.vbs-seg{display:flex;border:1px solid var(--border2);border-radius:9px;overflow:hidden;height:38px}',
      '.vbs-seg button{border:0;background:transparent;color:var(--text2);padding:0 11px;font-weight:700;font-size:12px;font-family:inherit;cursor:pointer}',
      '.vbs-seg button.on{background:var(--accent);color:#000}',
      '.vbs-formula{font-size:11px;color:var(--muted);margin-top:6px}',
      '.vbs-formula code{color:var(--text2);font-size:11px}',
      '.vbs-add{width:100%;padding:10px;border:1.5px dashed var(--border2);border-radius:10px;background:transparent;',
      'color:var(--accent);font-weight:700;font-size:12px;font-family:inherit;cursor:pointer}'
    ].join('');
    document.head.appendChild(st);
  }

  function _inject() {
    var sets = _byId('sets-field');
    if (!sets) return false;
    if (!_byId('vbt-field')) {
      var box = document.createElement('div');
      box.className = 'form-group';
      box.id = 'vbt-field';
      box.style.display = 'none';
      box.innerHTML =
        '<div class="vbs-head">' +
          '<button type="button" class="toggle-cb" id="vbt-toggle" style="flex-shrink:0"></button>' +
          '<label onclick="document.getElementById(\'vbt-toggle\').click()">⚡ Séance VBT' +
            '<small>Cibles de vitesse, séries et repos, envoyés au Journal VBT</small></label>' +
        '</div>' +
        '<div id="vbt-body" style="display:none"></div>';
      sets.insertAdjacentElement('afterend', box);
    }
    _bind();
    _render();
    return true;
  }

  // Affichage selon le type (Force / Weightlifting)
  function _hookType() {
    if (window.__vbsTypeHooked || typeof window.toggleSetsField !== 'function') return;
    window.__vbsTypeHooked = true;
    var orig = window.toggleSetsField;
    window.toggleSetsField = function () { var r = orig.apply(this, arguments); _render(); return r; };
    var typeSel = _byId('f-type');
    if (typeSel) typeSel.addEventListener('change', function () { _render(); });
  }

  // Formulaire remis à zéro
  function _hookReset() {
    if (window.__vbsResetHooked || typeof window.resetSessionForm !== 'function') return;
    window.__vbsResetHooked = true;
    var orig = window.resetSessionForm;
    window.resetSessionForm = function () { var r = orig.apply(this, arguments); window.vbtFormReset(); return r; };
  }

  // Chargement d'une séance à modifier
  function _hookEdit(name, table, idGetter) {
    var flag = '__vbsEditHooked_' + name;
    if (window[flag] || typeof window[name] !== 'function') return;
    window[flag] = true;
    var orig = window[name];
    window[name] = async function () {
      window.vbtFormReset();
      var r = await orig.apply(this, arguments);
      try {
        var id = idGetter();
        if (id) {
          var res = await sb.from(table).select('vbt').eq('id', id).maybeSingle();
          window.vbtSetFormData(res && res.data ? res.data.vbt : null);
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
    if (ok) _loadMoves();
    return ok;
  }

  function _boot() {
    if (_init()) return;
    var tries = 0;
    var iv = setInterval(function () { tries++; if (_init() || tries > 40) clearInterval(iv); }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();
  window.addEventListener('studio:ready', function () { movesLoaded = false; _init(); });
})();
