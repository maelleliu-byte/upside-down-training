/* ============================================================
 * VBT — SAISIE DES VITESSES SUR LA CARTE DE SÉANCE
 * ------------------------------------------------------------
 * Sous « 📊 Mon score », pour toute séance qui a des réglages
 * VBT (colonne vbt de sessions / personal_sessions) :
 *   ⚡ Mes vitesses → par exercice et par série : charge + une
 *   vitesse par rep (m/s), avec la cible rappelée.
 *
 * À l'enregistrement, la séance est écrite dans le Journal VBT de
 * l'utilisateur connecté (table vbt_journal, même clé que la
 * séance créée par le trigger vbt_sync_session) et passe en
 * « Faite » : elle alimente le Profil L-V du journal.
 * Chargé APRÈS charge.js (on surcharge renderSessions à notre tour).
 * ============================================================ */
(function () {
  if (window.__patchBound_vbtSaisie) return;
  window.__patchBound_vbtSaisie = true;

  var NAMES = {
    bsq: 'Back Squat', boxsq: 'Box Squat', pinbsq: 'Pin Back Squat', fsq: 'Front Squat', pinfsq: 'Pin Front Squat',
    bench: 'Bench Press', pinpress: 'Pin Press', pinbench: 'Pin Bench Press', dl: 'Deadlift', dldef: 'Deficit Deadlift', blockdl: 'Block Deadlift',
    ohp: 'Shoulder Press', sn: 'Snatch', psn: 'Power Snatch', hsn: 'Hang Snatch', hpsn: 'Hang Power Snatch',
    cl: 'Clean', pcl: 'Power Clean', hcl: 'Hang Clean', hpcl: 'Hang Power Clean', bpcl: 'Block Power Clean',
    pp: 'Push Press', pj: 'Push Jerk', jk: 'Split Jerk', snp: 'Snatch Pull', clp: 'Clean Pull'
  };
  var ACC = { bl: 'bandes L', bm: 'bandes M', bh: 'bandes H', ch: 'chaînes', bc: 'bandes + chaînes', rb: 'reverse bands' };

  var cache = { sessions: {}, docs: {}, settings: null, uid: null };

  // ---------- utilitaires ----------

  function _uid() { try { return currentUser ? currentUser.id : null; } catch (e) { return null; } }
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
  function _fmt(v) { return v == null ? '–' : v.toFixed(2).replace('.', ','); }
  function _key(id) { return 's-x' + String(id).replace(/-/g, ''); }
  function _salt(id) { var h = 0; String(id).split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) | 0; }); return Math.abs(h).toString(36).slice(0, 6); }

  function _moveName(mv) {
    var list = cache.settings && cache.settings.moves;
    var m = Array.isArray(list) ? list.find(function (x) { return x.id === mv; }) : null;
    return (m && m.name) || NAMES[mv] || mv || 'Mouvement';
  }
  function _isHalt(mv) {
    var list = cache.settings && cache.settings.moves;
    var m = Array.isArray(list) ? list.find(function (x) { return x.id === mv; }) : null;
    if (m) return m.type === 'haltero';
    return ['sn', 'psn', 'hsn', 'hpsn', 'cl', 'pcl', 'hcl', 'hpcl', 'bpcl', 'pp', 'pj', 'jk', 'snp', 'clp'].indexOf(mv) >= 0;
  }

  // Charge en % : même calcul que l'affichage des séances (PR de l'athlète, arrondi 0,5)
  function _pctLoad(b) {
    if (b.loadMode === 'kg' || _num(b.pct) == null || !b.ref) return null;
    try {
      var pr = typeof findPRByName === 'function' ? findPRByName(b.ref, b.fmt || '1RM') : null;
      if (!pr || !(pr.value > 0)) return null;
      return Math.round(_num(b.pct) / 100 * pr.value * 2) / 2;
    } catch (e) { return null; }
  }

  function _target(b) {
    var lo = _num(b.vmin), hi = _num(b.vmax);
    if (lo != null && hi != null) return _fmt(lo) + ' – ' + _fmt(hi) + ' m/s';
    if (lo != null) return '≥ ' + _fmt(lo) + ' m/s';
    if (hi != null) return '≤ ' + _fmt(hi) + ' m/s';
    return '';
  }

  // ---------- données ----------

  async function _loadFor(ids) {
    var uid = _uid();
    if (!uid || !ids.length || typeof sb === 'undefined') return;
    if (cache.uid !== uid) { cache = { sessions: {}, docs: {}, settings: null, uid: uid }; }
    var missing = ids.filter(function (id) { return !(id in cache.sessions); });
    if (missing.length) {
      var res = await Promise.all([
        sb.from('sessions').select('id,date,title,vbt').in('id', missing).not('vbt', 'is', null),
        sb.from('personal_sessions').select('id,date,title,vbt').in('id', missing).not('vbt', 'is', null)
      ]);
      missing.forEach(function (id) { cache.sessions[id] = null; });
      res.forEach(function (r) {
        (r.data || []).forEach(function (row) {
          if (row.vbt && Array.isArray(row.vbt.blocks) && row.vbt.blocks.length) cache.sessions[row.id] = row;
        });
      });
    }
    var vbtIds = ids.filter(function (id) { return cache.sessions[id]; });
    var keys = vbtIds.map(_key).filter(function (k) { return !(k in cache.docs); });
    if (keys.length || !cache.settings) {
      var r2 = await sb.from('vbt_journal').select('doc_key,data').eq('user_id', uid).in('doc_key', keys.concat(['settings']));
      keys.forEach(function (k) { cache.docs[k] = null; });
      (r2.data || []).forEach(function (row) {
        if (row.doc_key === 'settings') cache.settings = row.data;
        else cache.docs[row.doc_key] = row.data;
      });
      if (!cache.settings) cache.settings = {};
    }
  }

  // Séance du journal : celle qui existe, ou construite depuis les réglages VBT
  function _doc(s) {
    var k = _key(s.id), d = cache.docs[k];
    if (d && Array.isArray(d.blocks) && d.blocks.length === s.vbt.blocks.length) return JSON.parse(JSON.stringify(d));
    var salt = _salt(s.id);
    return {
      id: k.slice(2), date: s.date, title: s.title || 'Séance VBT', status: 'planned',
      sensor: (cache.settings && cache.settings.sensor) || '', notes: (d && d.notes) || '', folder: (d && d.folder) || '',
      order: (d && d.order) || Date.now(), createdAt: (d && d.createdAt) || Date.now(), updatedAt: Date.now(),
      source: { table: 'card', id: s.id },
      blocks: s.vbt.blocks.map(function (b, i) {
        var load = b.loadMode === 'kg' ? _num(b.load) : _pctLoad(b);
        var n = Math.max(1, Math.min(30, parseInt(b.sets, 10) || 1));
        var sets = [];
        for (var j = 0; j < n; j++) sets.push({ id: 'x' + (i + 1) + 's' + (j + 1) + salt, load: load, reps: b.reps || 1, v: [], rpe: '', note: '' });
        return {
          id: 'x' + (i + 1) + salt, mv: b.mv, acc: b.acc || '', vmin: _num(b.vmin), vmax: _num(b.vmax), vlMax: _num(b.vlMax),
          rest: b.rest || '', calibrated: b.calibrated !== false, note: b.note || '', sets: sets
        };
      })
    };
  }

  // ---------- rendu ----------

  function _repCls(b, v) {
    if (v == null) return '';
    var lo = _num(b.vmin), hi = _num(b.vmax);
    if (lo != null && v < lo) return 'slow';
    if (hi != null && v > hi) return 'fast';
    return (lo != null || hi != null) ? 'ok' : '';
  }

  function _setStats(b, st) {
    var vals = (st.v || []).filter(function (x) { return x != null && x > 0; });
    if (!vals.length) return '';
    var best = Math.max.apply(null, vals), last = vals[vals.length - 1];
    var vl = vals.length > 1 ? (best - last) / best * 100 : null;
    var out = 'Meilleure ' + _fmt(best);
    if (vl != null) out += ' · perte ' + Math.round(vl) + ' %';
    var vlm = _num(b.vlMax);
    if (vlm != null && vl != null && vl > vlm) out += ' · <b class="vbx-bad">stop</b>';
    return out;
  }

  function _blockHTML(sid, b, bi, halt) {
    var tgt = _target(b);
    var info = [b.rest ? 'Repos ' + _esc(b.rest) : '', tgt ? 'Cible ' + tgt : '', b.calibrated === false ? 'Charge fixe' : 'Calibrée'].filter(Boolean).join(' · ');
    return '<div class="vbx-block">' +
      '<div class="vbx-name">' + _esc(_moveName(b.mv)) + (b.acc && ACC[b.acc] ? ' <span>+ ' + ACC[b.acc] + '</span>' : '') + '</div>' +
      '<div class="vbx-info">' + info + ' · ' + (halt ? 'vitesse pic' : 'vitesse moyenne') + '</div>' +
      (b.sets || []).map(function (st, si) {
        var reps = Math.max(1, st.reps || 1), v = st.v || [], inputs = '';
        for (var r = 0; r < reps; r++) {
          inputs += '<input class="vbx-v ' + _repCls(b, v[r]) + '" inputmode="decimal" placeholder="R' + (r + 1) + '" aria-label="Série ' + (si + 1) + ' rep ' + (r + 1) + '"' +
            ' data-vx="v" data-sid="' + sid + '" data-b="' + bi + '" data-s="' + si + '" data-r="' + r + '" value="' + _show(v[r]) + '">';
        }
        return '<div class="vbx-set">' +
          '<div class="vbx-sl">S' + (si + 1) + '</div>' +
          '<input class="vbx-load" inputmode="decimal" placeholder="kg" aria-label="Charge série ' + (si + 1) + '"' +
            ' data-vx="load" data-sid="' + sid + '" data-b="' + bi + '" data-s="' + si + '" value="' + _show(st.load) + '">' +
          '<div class="vbx-reps">' + inputs + '</div>' +
          '<div class="vbx-st" id="vbx-st-' + sid + '-' + bi + '-' + si + '">' + _setStats(b, st) + '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function _cardHTML(s, doc) {
    var done = doc.status === 'done';
    return '<div class="vbx" data-vbx="' + s.id + '">' +
      '<button type="button" class="vbx-toggle" data-vbx-open="' + s.id + '">' +
        '<span>⚡ Mes vitesses</span><span class="vbx-state">' + (done ? 'Enregistrées ✓' : 'Ajouter') + '</span></button>' +
      '<div class="vbx-body" id="vbx-body-' + s.id + '" style="display:none">' +
        doc.blocks.map(function (b, bi) { return _blockHTML(s.id, b, bi, _isHalt(b.mv)); }).join('') +
        '<div class="vbx-legend"><span><i class="ok"></i>Dans la cible</span><span><i class="slow"></i>Trop lent</span><span><i class="fast"></i>Trop rapide</span></div>' +
        '<button type="button" class="vbx-save" data-vbx-save="' + s.id + '">Enregistrer mes vitesses</button>' +
        '<div class="vbx-msg" id="vbx-msg-' + s.id + '"></div>' +
      '</div>' +
    '</div>';
  }

  // ---------- interactions ----------

  var drafts = {}; // séance -> doc en cours de saisie

  function _onInput(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.vx) return;
    var d = drafts[el.dataset.sid]; if (!d) return;
    var b = d.blocks[+el.dataset.b], st = b && b.sets[+el.dataset.s]; if (!st) return;
    if (el.dataset.vx === 'load') { st.load = _num(el.value); return; }
    st.v = st.v || [];
    st.v[+el.dataset.r] = _num(el.value);
    for (var i = 0; i < st.v.length; i++) if (st.v[i] === undefined) st.v[i] = null;
    el.className = 'vbx-v ' + _repCls(b, st.v[+el.dataset.r]);
    var out = document.getElementById('vbx-st-' + el.dataset.sid + '-' + el.dataset.b + '-' + el.dataset.s);
    if (out) out.innerHTML = _setStats(b, st);
  }

  async function _save(sid) {
    var d = drafts[sid], uid = _uid(), msg = document.getElementById('vbx-msg-' + sid);
    if (!d || !uid) return;
    var any = d.blocks.some(function (b) { return b.sets.some(function (st) { return (st.v || []).some(function (x) { return x > 0; }); }); });
    if (!any) { if (msg) msg.textContent = 'Saisis au moins une vitesse.'; return; }
    var dateEl = document.getElementById('done-at-' + sid);
    if (dateEl && dateEl.value) d.date = dateEl.value;
    d.status = 'done';
    d.updatedAt = Date.now();
    var btn = document.querySelector('[data-vbx-save="' + sid + '"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }
    var r = await sb.from('vbt_journal').upsert(
      { user_id: uid, doc_key: _key(sid), data: d, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,doc_key' });
    if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer mes vitesses'; }
    if (r.error) { if (msg) msg.textContent = '❌ ' + r.error.message; return; }
    cache.docs[_key(sid)] = JSON.parse(JSON.stringify(d));
    if (msg) msg.textContent = '✅ Enregistré dans ton Journal VBT (profil charge-vitesse mis à jour).';
    var state = document.querySelector('[data-vbx="' + sid + '"] .vbx-state');
    if (state) state.textContent = 'Enregistrées ✓';
    if (typeof showToast === 'function') showToast('⚡ Vitesses enregistrées');
  }

  function _bindDoc() {
    if (window.__vbxBound) return;
    window.__vbxBound = true;
    document.addEventListener('input', _onInput);
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-vbx-open],[data-vbx-save]');
      if (!t) return;
      if (t.dataset.vbxOpen) {
        var body = document.getElementById('vbx-body-' + t.dataset.vbxOpen);
        if (body) body.style.display = body.style.display === 'none' ? 'block' : 'none';
      } else if (t.dataset.vbxSave) {
        _save(t.dataset.vbxSave).catch(function (err) { console.error('[vbt] save', err); });
      }
    });
  }

  // ---------- décoration des cartes ----------

  async function decorate() {
    var area = document.getElementById('sessions-area');
    if (!area || !_uid()) return;
    var cards = Array.prototype.slice.call(area.querySelectorAll('.session-card'))
      .filter(function (c) { return !c.dataset.vbxBound && /^sc-/.test(c.id || ''); });
    if (!cards.length) return;
    var ids = cards.map(function (c) { return c.id.replace(/^sc-/, ''); });
    await _loadFor(ids);
    cards.forEach(function (card) {
      var sid = card.id.replace(/^sc-/, '');
      card.dataset.vbxBound = '1';
      var s = cache.sessions[sid];
      if (!s) return;
      var doc = _doc(s);
      drafts[sid] = doc;
      var btn = card.querySelector('.btn-score');
      var anchor = btn ? btn.parentElement : card.querySelector('.btn-open-scores');
      if (!anchor) return;
      anchor.insertAdjacentHTML(btn ? 'beforeend' : 'beforebegin', _cardHTML(s, doc));
    });
  }

  function _injectCSS() {
    if (document.getElementById('vbx-css')) return;
    var st = document.createElement('style');
    st.id = 'vbx-css';
    st.textContent = [
      '.vbx{margin-top:10px;border:1px solid var(--border2);border-radius:10px;overflow:hidden}',
      '.vbx-toggle{width:100%;display:flex;justify-content:space-between;align-items:center;padding:11px 12px;background:var(--card2);',
      'border:0;color:var(--text);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer}',
      '.vbx-state{font-size:11px;color:var(--muted);font-weight:600}',
      '.vbx-body{padding:10px 12px 12px}',
      '.vbx-block{margin-bottom:12px}',
      '.vbx-name{font-size:13px;font-weight:700;color:var(--text)}',
      '.vbx-name span{color:var(--muted);font-weight:600;font-size:12px}',
      '.vbx-info{font-size:11px;color:var(--muted);margin:2px 0 8px;line-height:1.5}',
      '.vbx-set{display:grid;grid-template-columns:28px 64px 1fr;gap:6px;align-items:center;margin-bottom:6px}',
      '.vbx-sl{font-size:11px;font-weight:700;color:var(--muted)}',
      '.vbx-load,.vbx-v{width:100%;min-width:0;background:var(--dark);border:1.5px solid var(--border2);border-radius:8px;color:var(--text);',
      'font-family:inherit;font-size:14px;font-weight:600;padding:8px 4px;text-align:center;outline:none}',
      '.vbx-load:focus,.vbx-v:focus{border-color:var(--accent)}',
      '.vbx-reps{display:grid;grid-template-columns:repeat(auto-fit,minmax(48px,1fr));gap:5px}',
      '.vbx-v.ok{border-color:#2dd4bf;color:#2dd4bf}',
      '.vbx-v.slow{border-color:var(--orange);color:var(--orange)}',
      '.vbx-v.fast{border-color:var(--blue);color:var(--blue)}',
      '.vbx-st{grid-column:2/4;font-size:11px;color:var(--muted);min-height:0}',
      '.vbx-st:empty{display:none}',
      '.vbx-bad{color:var(--red)}',
      '.vbx-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:10px;color:var(--muted);margin:4px 0 10px}',
      '.vbx-legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:0}',
      '.vbx-legend i.ok{background:#2dd4bf}.vbx-legend i.slow{background:var(--orange)}.vbx-legend i.fast{background:var(--blue)}',
      '.vbx-save{width:100%;padding:10px;border:0;border-radius:10px;background:var(--accent);color:#000;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer}',
      '.vbx-save:disabled{opacity:.6}',
      '.vbx-msg{font-size:12px;color:var(--muted);margin-top:8px;text-align:center}',
      '.vbx-msg:empty{display:none}'
    ].join('');
    document.head.appendChild(st);
  }

  // ---------- branchements ----------

  function _wrap(name) {
    var flag = '__vbxWrapped_' + name;
    if (window[flag] || typeof window[name] !== 'function') return;
    window[flag] = true;
    var prev = window[name];
    window[name] = async function () {
      var r = await prev.apply(this, arguments);
      try { await decorate(); } catch (e) { console.error('[vbt] decorate', e); }
      return r;
    };
  }

  function bind() {
    _injectCSS();
    _bindDoc();
    _wrap('renderSessions');
    _wrap('renderPersoSessions');
    setTimeout(function () { decorate().catch(function (e) { console.error('[vbt] decorate', e); }); }, 400);
  }

  if (window.__STUDIO__) bind();
  else if (typeof window.waitForStudioReady === 'function') window.waitForStudioReady(8000).then(bind);
  else window.addEventListener('studio:ready', bind, { once: true });
  setTimeout(function () { if (!document.getElementById('vbx-css')) bind(); }, 10000);
})();
