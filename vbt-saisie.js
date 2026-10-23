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
    if (cache.uid !== uid) { cache = { sessions: {}, docs: {}, settings: null, uid: uid, all: null }; }
    var missing = ids.filter(function (id) { return !(id in cache.sessions); });
    if (missing.length) {
      var res = await Promise.all([
        sb.from('sessions').select('id,date,title,vbt,score_type').in('id', missing).not('vbt', 'is', null),
        sb.from('personal_sessions').select('id,date,title,vbt,score_type').in('id', missing).not('vbt', 'is', null)
      ]);
      missing.forEach(function (id) { cache.sessions[id] = null; });
      res.forEach(function (r) {
        (r.data || []).forEach(function (row) {
          if (row.vbt && Array.isArray(row.vbt.blocks) && row.vbt.blocks.length) cache.sessions[row.id] = row;
        });
      });
    }
    var vbtIds = ids.filter(function (id) { return cache.sessions[id]; });
    if (vbtIds.length && !cache.all) {
      var ra = await sb.from('vbt_journal').select('doc_key,data').eq('user_id', uid).like('doc_key', 's-%');
      cache.all = {};
      (ra.data || []).forEach(function (row) { cache.all[row.doc_key] = row.data; });
    }
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
      '<div class="vbx-sug" id="vbx-sug-' + sid + '-' + bi + '">' + _sugHTML(sid, b, bi) + '</div>' +
    '</div>';
  }

  /* ---------- Charge suggérée (même calcul que le Journal VBT) ----------
   * Pente charge-vitesse tirée, dans l'ordre : du profil de l'athlète
   * (même mouvement et même résistance, 90 j puis tout l'historique),
   * de ses séries du jour, de son 1RM de référence (force, barre seule),
   * ou de son profil barre seule si résistance accommodante. */
  function _stats(st) {
    var vals = (st.v || []).filter(function (x) { return x != null && x > 0; });
    if (!vals.length) return null;
    var best = Math.max.apply(null, vals), last = vals[vals.length - 1];
    return { n: vals.length, best: best, last: last, vl: vals.length > 1 ? (best - last) / best * 100 : null };
  }
  function _moveMeta(mv) {
    var list = cache.settings && cache.settings.moves;
    var m = Array.isArray(list) ? list.find(function (x) { return x.id === mv; }) : null;
    return m || { id: mv, type: _isHalt(mv) ? 'haltero' : 'force', rm: null, mvt: null };
  }
  function _points(mv, acc, days, skipKey) {
    var pts = [], now = Date.now();
    Object.keys(cache.all || {}).forEach(function (k) {
      if (k === skipKey) return;
      var s = cache.all[k]; if (!s) return;
      if (days && s.date && (now - new Date(s.date + 'T12:00:00').getTime()) / 864e5 > days) return;
      (s.blocks || []).forEach(function (b) {
        if (b.mv !== mv || (b.acc || '') !== (acc || '')) return;
        (b.sets || []).forEach(function (st) { var k2 = _stats(st); if (k2 && st.load > 0) pts.push({ load: st.load, v: k2.best }); });
      });
    });
    return pts;
  }
  function _fit(pts, minLoads) {
    var n = pts.length; if (n < 2) return null;
    var L = {}; pts.forEach(function (p) { L[p.load] = 1; });
    if (Object.keys(L).length < minLoads) return null;
    var sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(function (p) { sx += p.load; sy += p.v; sxx += p.load * p.load; sxy += p.load * p.v; });
    var den = n * sxx - sx * sx; if (!den) return null;
    var b = (n * sxy - sx * sy) / den;
    return b < 0 ? b : null;
  }
  function _profileSlope(mv, acc, skipKey) {
    var p = _points(mv, acc, 90, skipKey);
    if (p.length < 4) p = _points(mv, acc, 0, skipKey);
    return p.length >= 3 ? _fit(p, 3) : null;
  }
  function _suggest(sid, b) {
    var done = b.sets.filter(function (st) { return _stats(st); });
    if (!done.length) return null;
    var st = done[done.length - 1], k = _stats(st);
    if (!(st.load > 0)) return { need: 'load' };
    var lo = _num(b.vmin), hi = _num(b.vmax);
    if (lo == null && hi == null) return { need: 'target' };
    var vt = lo != null && hi != null ? (lo + hi) / 2 : lo != null ? lo + 0.05 : hi - 0.05;
    var m = _moveMeta(b.mv), acc = b.acc || '', skip = _key(sid), slope = null, src = '';
    var today = done.filter(function (x) { return x.load > 0; }).map(function (x) { return { load: x.load, v: _stats(x).best }; });
    var fp = _profileSlope(b.mv, acc, skip);
    if (fp != null) { slope = fp; src = acc ? 'ton profil avec ' + (ACC[acc] || 'résistance') : 'ton profil charge-vitesse'; }
    else if (_fit(today, 2) != null) { slope = _fit(today, 2); src = 'tes séries du jour'; }
    else if (!acc && m.type !== 'haltero' && m.rm > st.load && m.mvt != null && k.best > m.mvt) { slope = (m.mvt - k.best) / (m.rm - st.load); src = 'ton 1RM de référence'; }
    else if (acc) { var f0 = _profileSlope(b.mv, '', skip); if (f0 != null) { slope = f0; src = 'ton profil barre seule (approximatif avec résistance)'; } }
    if (slope == null) return { need: 'data' };
    var step = m.type === 'haltero' ? 1 : 2.5;
    var load = st.load + (vt - k.best) / slope;
    load = Math.max(st.load * 0.75, Math.min(st.load * 1.25, load));
    load = Math.round(load / step) * step;
    var idx = b.sets.indexOf(st);
    return { load: load, vt: vt, src: src, same: Math.abs(load - st.load) < step / 2, next: idx + 1 < b.sets.length, vlStop: b.vlMax != null && k.vl != null && k.vl > _num(b.vlMax), vl: k.vl };
  }
  function _sugHTML(sid, b, bi) {
    if (b.calibrated === false) return '';
    var g = _suggest(sid, b);
    if (!g) return '';
    var msg = function (txt) { return '<div class="vbx-sugt">' + txt + '</div>'; };
    if (g.need === 'load') return msg('Indique la charge de la série pour obtenir la charge suivante.');
    if (g.need === 'target') return '';
    if (g.need === 'data') return msg('Fais une 2e série à une autre charge pour obtenir une charge suggérée.');
    var stop = g.vlStop ? '<div class="vbx-sugstop">Perte de vitesse ' + Math.round(g.vl) + ' % &gt; ' + _show(_num(b.vlMax)) + ' % : stop sur cette série.</div>' : '';
    return stop + '<div class="vbx-sugrow"><div class="vbx-sugt"><b>Série suivante : ' + (g.same ? 'garde ' + _show(g.load) + ' kg' : '≈ ' + _show(g.load) + ' kg') + '</b>' +
      ' pour viser ' + _fmt(g.vt) + ' m/s<br><span>Calcul basé sur ' + _esc(g.src) + '</span></div>' +
      (!g.same && g.next ? '<button type="button" class="vbx-apply" data-vbx-apply="' + sid + '" data-b="' + bi + '" data-l="' + g.load + '">Appliquer</button>' : '') + '</div>';
  }
  function _refreshSug(sid, bi) {
    var el = document.getElementById('vbx-sug-' + sid + '-' + bi), d = drafts[sid];
    if (el && d) el.innerHTML = _sugHTML(sid, d.blocks[bi], bi);
  }
  // « Appliquer » : la charge suggérée passe sur toutes les séries pas encore mesurées
  function _apply(sid, bi, load) {
    var d = drafts[sid]; if (!d) return;
    var b = d.blocks[bi], lastDone = -1;
    b.sets.forEach(function (st, i) { if (_stats(st)) lastDone = i; });
    for (var i = lastDone + 1; i < b.sets.length; i++) {
      b.sets[i].load = load;
      var inp = document.querySelector('[data-vx="load"][data-sid="' + sid + '"][data-b="' + bi + '"][data-s="' + i + '"]');
      if (inp) inp.value = _show(load);
    }
    _refreshSug(sid, bi);
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
    if (el.dataset.vx === 'load') { st.load = _num(el.value); _refreshSug(el.dataset.sid, +el.dataset.b); return; }
    st.v = st.v || [];
    st.v[+el.dataset.r] = _num(el.value);
    for (var i = 0; i < st.v.length; i++) if (st.v[i] === undefined) st.v[i] = null;
    el.className = 'vbx-v ' + _repCls(b, st.v[+el.dataset.r]);
    var out = document.getElementById('vbx-st-' + el.dataset.sid + '-' + el.dataset.b + '-' + el.dataset.s);
    if (out) out.innerHTML = _setStats(b, st);
    _refreshSug(el.dataset.sid, +el.dataset.b);
  }

  // Résumé des vitesses joint au score (wod_scores.vbt) : visible dans le classement
  function _summary(d) {
    return {
      v: 1,
      blocks: d.blocks.map(function (b) {
        return {
          name: _moveName(b.mv), acc: ACC[b.acc] || '', halt: _isHalt(b.mv),
          vmin: _num(b.vmin), vmax: _num(b.vmax), vlMax: _num(b.vlMax),
          sets: b.sets.map(function (st) {
            return { load: st.load == null ? null : st.load, v: (st.v || []).filter(function (x) { return x != null && x > 0; }) };
          }).filter(function (st) { return st.v.length; })
        };
      }).filter(function (b) { return b.sets.length; })
    };
  }

  async function _syncScore(sid, d) {
    var uid = _uid(), s = cache.sessions[sid];
    var vbt = _summary(d);
    var ex = await sb.from('wod_scores').select('id').eq('session_id', sid).eq('athlete_id', uid).maybeSingle();
    if (ex.error) throw ex.error;
    if (ex.data) {
      var u = await sb.from('wod_scores').update({ vbt: vbt }).eq('id', ex.data.id);
      if (u.error) throw u.error;
      return;
    }
    // Pas encore de score : on en crée un, avec la charge max de la séance
    var loads = [];
    d.blocks.forEach(function (b) { b.sets.forEach(function (st) { if ((st.v || []).some(function (x) { return x > 0; }) && st.load > 0) loads.push(st.load); }); });
    var maxLoad = loads.length ? Math.max.apply(null, loads) : 0;
    var types = ['time', 'reps', 'rounds', 'weight', 'calories', 'text', 'watt'];
    var level = 'rx';
    try { if (typeof getSelectedLevel === 'function') level = getSelectedLevel(sid) || 'rx'; } catch (e) {}
    var payload = {
      session_id: sid, athlete_id: uid,
      score_type: s && types.indexOf(s.score_type) >= 0 ? s.score_type : 'weight',
      score_value: maxLoad, score_text: maxLoad ? _show(maxLoad) + ' kg' : 'VBT',
      level: level, vbt: vbt
    };
    if (d.date) payload.done_at = d.date;
    var ins = await sb.from('wod_scores').insert(payload);
    if (ins.error) throw ins.error;
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
    if (cache.all) cache.all[_key(sid)] = JSON.parse(JSON.stringify(d));
    var scoreOk = true;
    try { await _syncScore(sid, d); } catch (e) { scoreOk = false; console.error('[vbt] score', e); }
    if (msg) msg.textContent = scoreOk
      ? '✅ Enregistré : visible dans le classement et dans ton Journal VBT.'
      : '✅ Enregistré dans ton Journal VBT (le classement n\'a pas pu être mis à jour).';
    if (scoreOk && typeof currentScoresSession !== 'undefined' && currentScoresSession && currentScoresSession.sessionId === sid
        && typeof renderScoresModal === 'function') {
      try { renderScoresModal(sid, currentScoresSession.scoreType, currentScoresSession.sets); } catch (e) {}
    }
    var state = document.querySelector('[data-vbx="' + sid + '"] .vbx-state');
    if (state) state.textContent = 'Enregistrées ✓';
    if (typeof showToast === 'function') showToast('⚡ Vitesses enregistrées');
  }

  function _bindDoc() {
    if (window.__vbxBound) return;
    window.__vbxBound = true;
    document.addEventListener('input', _onInput);
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-vbx-open],[data-vbx-save],[data-vbx-apply]');
      if (!t) return;
      if (t.dataset.vbxApply) { _apply(t.dataset.vbxApply, +t.dataset.b, Number(t.dataset.l)); return; }
      if (t.dataset.vbxOpen) {
        var body = document.getElementById('vbx-body-' + t.dataset.vbxOpen);
        if (body) body.style.display = body.style.display === 'none' ? 'block' : 'none';
      } else if (t.dataset.vbxSave) {
        _save(t.dataset.vbxSave).catch(function (err) { console.error('[vbt] save', err); });
      }
    });
  }

  // ---------- classement : vitesses de chaque athlète ----------

  // Récap de la séance : meilleure rep par série (barre), dernière rep (trait), cible (bande)
  function _chartSVG(b) {
    var W = 340, H = 168, L = 34, R = 8, T = 18, B = 34;
    var lo = b.vmin, hi = b.vmax;
    var sets = b.sets.map(function (st) {
      var best = Math.max.apply(null, st.v), last = st.v[st.v.length - 1];
      return { load: st.load, best: best, last: last, n: st.v.length, vl: st.v.length > 1 ? (best - last) / best * 100 : null };
    });
    var vmaxData = Math.max.apply(null, sets.map(function (x) { return x.best; }).concat([hi || 0, lo || 0]));
    var step = Math.ceil(vmaxData * 1.15 / 4 * 10) / 10 || 0.3, ymax = step * 4;
    var Y = function (v) { return T + (1 - v / ymax) * (H - T - B); };
    var n = sets.length, slot = (W - L - R) / n, bw = Math.min(34, slot * 0.6);
    var g = '';
    for (var i = 0; i <= 4; i++) {
      var v = ymax * i / 4;
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="var(--border)"/>' +
        '<text x="' + (L - 5) + '" y="' + (Y(v) + 3.5) + '" text-anchor="end" font-size="9.5" fill="var(--muted)">' + v.toFixed(1).replace('.', ',') + '</text>';
    }
    if (lo != null || hi != null) {
      var top = hi != null ? Math.min(hi, ymax) : ymax, bot = lo != null ? lo : 0;
      g += '<rect x="' + L + '" y="' + Y(top) + '" width="' + (W - L - R) + '" height="' + Math.max(0, Y(bot) - Y(top)) + '" fill="#2dd4bf" opacity=".13"/>';
    }
    sets.forEach(function (k, i) {
      var cx = L + slot * (i + 0.5);
      var col = lo != null && k.best < lo ? 'var(--orange)' : hi != null && k.best > hi ? 'var(--blue)' : '#2dd4bf';
      var stop = b.vlMax != null && k.vl != null && k.vl > b.vlMax;
      g += '<rect x="' + (cx - bw / 2) + '" y="' + Y(k.best) + '" width="' + bw + '" height="' + (Y(0) - Y(k.best)) + '" rx="3" fill="' + col + '"/>';
      if (k.n > 1) g += '<line x1="' + (cx - bw / 2 - 3) + '" x2="' + (cx + bw / 2 + 3) + '" y1="' + Y(k.last) + '" y2="' + Y(k.last) + '" stroke="' + (stop ? 'var(--red)' : 'var(--text)') + '" stroke-width="2"/>';
      g += '<text x="' + cx + '" y="' + (Y(k.best) - 5) + '" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--text)">' + _fmt(k.best) + '</text>' +
        '<text x="' + cx + '" y="' + (H - 19) + '" text-anchor="middle" font-size="9.5" fill="var(--muted)">S' + (i + 1) + '</text>' +
        '<text x="' + cx + '" y="' + (H - 7) + '" text-anchor="middle" font-size="9.5" fill="var(--text)">' + (k.load != null ? _show(k.load) + ' kg' : '–') + '</text>';
    });
    return '<svg class="vbl-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Meilleure vitesse par série, ' + _esc(b.name) + '">' + g + '</svg>' +
      '<div class="vbl-leg"><span><i style="background:#2dd4bf"></i>Meilleure rep</span><span><i class="ln"></i>Dernière rep</span>' +
      (lo != null || hi != null ? '<span><i style="background:#2dd4bf;opacity:.3"></i>Cible</span><span><i style="background:var(--blue)"></i>Trop rapide</span><span><i style="background:var(--orange)"></i>Trop lent</span>' : '') + '</div>';
  }

  function _lbHTML(vbt) {
    if (!vbt || !Array.isArray(vbt.blocks) || !vbt.blocks.length) return '';
    return '<div class="vbl">' + vbt.blocks.map(function (b) {
      var lo = b.vmin, hi = b.vmax;
      var cls = function (v) {
        if (lo != null && v < lo) return 'slow';
        if (hi != null && v > hi) return 'fast';
        return (lo != null || hi != null) ? 'ok' : '';
      };
      var bests = b.sets.map(function (st) { return Math.max.apply(null, st.v); });
      var inT = (lo != null || hi != null) ? bests.filter(function (v) { return cls(v) === 'ok'; }).length : null;
      var avg = bests.reduce(function (a, x) { return a + x; }, 0) / bests.length;
      var tgt = _target(b);
      return '<div class="vbl-b">' +
        '<div class="vbl-h">⚡ ' + _esc(b.name) + (b.acc ? ' + ' + _esc(b.acc) : '') +
          '<span>' + (tgt ? 'cible ' + tgt + ' · ' : '') + 'moy. ' + _fmt(avg) + (inT != null ? ' · ' + inT + '/' + bests.length + ' dans la cible' : '') + '</span></div>' +
        _chartSVG(b) +
        '<details class="vbl-det"><summary>Détail des reps</summary>' +
        b.sets.map(function (st, i) {
          var vl = st.v.length > 1 ? (Math.max.apply(null, st.v) - st.v[st.v.length - 1]) / Math.max.apply(null, st.v) * 100 : null;
          return '<div class="vbl-s"><span class="vbl-n">S' + (i + 1) + '</span>' +
            '<span class="vbl-l">' + (st.load != null ? _show(st.load) + ' kg' : '–') + '</span>' +
            '<span class="vbl-v">' + st.v.map(function (v) { return '<i class="' + cls(v) + '">' + _fmt(v) + '</i>'; }).join('') + '</span>' +
            (vl != null ? '<span class="vbl-p' + (b.vlMax != null && vl > b.vlMax ? ' bad' : '') + '">-' + Math.round(vl) + '%</span>' : '') +
          '</div>';
        }).join('') +
        '</details>' +
      '</div>';
    }).join('') + '</div>';
  }

  async function _decorateLeaderboard(sessionId) {
    var el = document.getElementById('smodal-leaderboard');
    if (!el || !sessionId) return;
    var r = await sb.from('wod_scores').select('id,vbt').eq('session_id', sessionId).not('vbt', 'is', null);
    (r.data || []).forEach(function (sc) {
      var row = document.getElementById('sr-' + sc.id);
      if (!row || document.querySelector('[data-vbl-for="' + sc.id + '"]')) return;
      row.insertAdjacentHTML('afterend', _lbHTML(sc.vbt));
      var box = row.nextElementSibling; if (box) box.dataset.vblFor = sc.id;
    });
  }

  function _wrapLeaderboard() {
    if (window.__vbxLbWrapped || typeof window.renderScoresModal !== 'function') return;
    window.__vbxLbWrapped = true;
    var prev = window.renderScoresModal;
    window.renderScoresModal = async function (sessionId) {
      var r = await prev.apply(this, arguments);
      try { await _decorateLeaderboard(sessionId); } catch (e) { console.error('[vbt] classement', e); }
      return r;
    };
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
      '.vbx-msg:empty{display:none}',
      '.vbx-sug:empty{display:none}',
      '.vbx-sug{margin-top:4px;padding:8px 10px;border-radius:9px;background:var(--card2);border:1px solid var(--border2)}',
      '.vbx-sugrow{display:flex;align-items:center;gap:10px}',
      '.vbx-sugt{flex:1;font-size:12px;color:var(--text2);line-height:1.45}',
      '.vbx-sugt b{color:var(--text)}',
      '.vbx-sugt span{font-size:10px;color:var(--muted)}',
      '.vbx-sugstop{font-size:12px;font-weight:700;color:var(--red);margin-bottom:6px}',
      '.vbx-apply{flex:0 0 auto;border:0;border-radius:8px;background:var(--accent);color:#000;font-weight:700;font-size:12px;padding:8px 12px;font-family:inherit;cursor:pointer}',
      '.vbl{margin:2px 0 6px;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:var(--card)}',
      '.vbl-chart{display:block;width:100%;height:auto;margin-top:6px}',
      '.vbl-leg{display:flex;gap:10px;flex-wrap:wrap;font-size:10px;color:var(--muted);margin-top:2px}',
      '.vbl-leg i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px;vertical-align:0}',
      '.vbl-leg i.ln{width:12px;height:2px;background:var(--text);vertical-align:3px}',
      '.vbl-det{margin-top:6px}',
      '.vbl-det summary{font-size:11px;font-weight:700;color:var(--text2);cursor:pointer}',
      '.vbl-b{margin-top:4px}',
      '.vbl-h{font-size:11px;font-weight:700;color:var(--text2)}',
      '.vbl-h span{display:block;font-weight:500;color:var(--muted)}',
      '.vbl-s{display:flex;align-items:center;gap:6px;font-size:11px;margin-top:3px;flex-wrap:wrap}',
      '.vbl-n{color:var(--muted);font-weight:700;width:18px}',
      '.vbl-l{color:#2dd4bf;font-weight:700;min-width:46px}',
      '.vbl-v{display:flex;gap:3px;flex-wrap:wrap}',
      '.vbl-v i{font-style:normal;font-weight:700;padding:1px 5px;border-radius:5px;background:var(--card2);color:var(--text)}',
      '.vbl-v i.ok{color:#2dd4bf}.vbl-v i.slow{color:var(--orange)}.vbl-v i.fast{color:var(--blue)}',
      '.vbl-p{color:var(--muted)}.vbl-p.bad{color:var(--red);font-weight:700}'
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
    _wrapLeaderboard();
    setTimeout(function () { decorate().catch(function (e) { console.error('[vbt] decorate', e); }); }, 400);
  }

  if (window.__STUDIO__) bind();
  else if (typeof window.waitForStudioReady === 'function') window.waitForStudioReady(8000).then(bind);
  else window.addEventListener('studio:ready', bind, { once: true });
  setTimeout(function () { if (!document.getElementById('vbx-css')) bind(); }, 10000);
})();
