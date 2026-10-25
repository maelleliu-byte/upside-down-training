/* ============================================================
 * ENDURANCE FONDAMENTALE — SAISIE DE LA FC SUR LA CARTE DE SÉANCE
 * ------------------------------------------------------------
 * Sous « 📊 Mon score », pour toute séance qui a un suivi
 * endurance fondamentale (colonne ef de sessions / personal_sessions) :
 *   🫀 Ma FC → FC moyenne 1re / 2e moitié (ou relevés réguliers),
 *   avec la puissance / l'allure en option. Dérive en direct.
 *
 * À l'enregistrement, les FC et la dérive vont dans wod_scores.ef :
 * visibles dans le classement et dans les retours de l'espace perso.
 *
 * Calcul (window.efCalc), identique au Journal EF :
 *   - dérive = FC du dernier relevé / FC du premier relevé compté − 1
 *     (l'échauffement n'est pas saisi, il est exclu) ;
 *   - à partir de 4 relevés : 1re moitié vs 2e moitié en complément ;
 *   - variation de la puissance / de l'allure début → fin, RPE moyen.
 *   Couleurs : < 5 % vert · 5–10 % orange · > 10 % rouge.
 * Chargé APRÈS charge.js et vbt-saisie.js.
 * ============================================================ */
(function () {
  if (window.__patchBound_efSaisie) return;
  window.__patchBound_efSaisie = true;

  var MODS = { run: 'Run', bike: 'Bike', row: 'Row', ski: 'Ski', autre: 'Engine' };
  var cache = { sessions: {}, scores: {}, uid: null };
  var drafts = {};

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
  // « 40:00 » -> 40 (min) ; « 1:30:00 » -> 90 ; « 45 » -> 45
  function _minutes(s) {
    var t = String(s == null ? '' : s).trim();
    if (!t) return null;
    var p = t.split(':').map(function (x) { return parseFloat(x.replace(',', '.')); });
    if (p.some(function (x) { return !isFinite(x); })) return null;
    if (p.length === 1) return p[0];
    if (p.length === 2) return p[0] + p[1] / 60;
    return p[0] * 60 + p[1] + p[2] / 60;
  }
  // allure « 5:30 » -> 330 s ; « 330 » -> 330
  function _paceSec(s) {
    var t = String(s == null ? '' : s).trim();
    if (!t) return null;
    if (t.indexOf(':') >= 0) {
      var p = t.split(':').map(function (x) { return parseFloat(x.replace(',', '.')); });
      if (p.length !== 2 || !isFinite(p[0]) || !isFinite(p[1])) return null;
      return p[0] * 60 + p[1];
    }
    return _num(t);
  }
  // Unité dans laquelle l'athlète saisit son intensité réelle
  function _outUnit(ef) {
    if (!ef) return 'W';
    if (ef.unit && ef.unit !== '%') return ef.unit;
    return ef.mod === 'run' ? 'km/h' : 'W';
  }
  function _isPace(u) { return u === 'min/km' || u === '/500m'; }
  // Intensité comparable (plus grand = plus dur)
  function _intensity(raw, unit) {
    if (raw == null || raw === '') return null;
    if (_isPace(unit)) { var s = _paceSec(raw); return s > 0 ? 1 / s : null; }
    var n = _num(raw);
    return n > 0 ? n : null;
  }
  function _avg(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }

  // ---------- calcul ----------

  function _r1(x) { return Math.round(x * 10) / 10; }

  // data : { mode, unit, hr: [...], out: [...], rpe: [...] }
  function efCalc(data) {
    if (!data || !Array.isArray(data.hr)) return null;
    var unit = data.unit || 'W';
    var rows = data.hr.map(function (h, i) {
      return {
        i: i, hr: _num(h), out: _intensity(data.out && data.out[i], unit),
        raw: data.out && data.out[i] != null && data.out[i] !== '' ? data.out[i] : null,
        rpe: _num(data.rpe && data.rpe[i])
      };
    }).filter(function (r) { return r.hr > 0; });
    if (rows.length < 2) return null;
    var a = rows[0], b = rows[rows.length - 1];
    var k = {
      drift: _r1((b.hr - a.hr) / a.hr * 100), dbpm: Math.round(b.hr - a.hr),
      hr1: Math.round(a.hr), hr2: Math.round(b.hr), i1: a.i, i2: b.i, n: rows.length,
      out1: a.raw, out2: b.raw, dOut: a.out > 0 && b.out > 0 ? _r1((b.out - a.out) / a.out * 100) : null,
      dec: null, method: 'fc'
    };
    if (rows.length >= 4) {
      var h = Math.floor(rows.length / 2);
      var hA = _avg(rows.slice(0, h).map(function (r) { return r.hr; }));
      var hB = _avg(rows.slice(rows.length - h).map(function (r) { return r.hr; }));
      k.dec = _r1((hB - hA) / hA * 100); k.hrA = Math.round(hA); k.hrB = Math.round(hB);
    }
    var rp = rows.map(function (r) { return r.rpe; }).filter(function (x) { return x > 0; });
    k.rpe = rp.length ? _r1(_avg(rp)) : null;
    var outs = rows.map(function (r) { return _num(r.raw); }).filter(function (x) { return x > 0; });
    k.outAvg = !_isPace(unit) && outs.length ? Math.round(_avg(outs)) : null;
    return k;
  }
  function efTone(d) { return d == null ? '' : d < 5 ? 'ok' : d <= 10 ? 'mid' : 'bad'; }
  function efFmt(d) { return d == null ? '–' : (d > 0 ? '+' : d < 0 ? '−' : '') + _show(Math.abs(d).toFixed(1)) + ' %'; }
  window.efCalc = efCalc;
  window.efTone = efTone;
  window.efFmt = efFmt;

  // ---------- rendu partagé (classement, retours de l'espace perso) ----------

  function _sparkSVG(sc) {
    var hr = (sc.hr || []).map(_num);
    var allIdx = hr.every(function (x) { return x > 0; });
    if (!allIdx) hr = hr.filter(function (x) { return x > 0; });
    if (hr.length < 3) return '';
    var W = 300, H = 92, L = 30, R = 8, T = 10, B = 20;
    var lo = Math.min.apply(null, hr), hi = Math.max.apply(null, hr);
    var pad = Math.max(3, (hi - lo) * 0.2); lo = Math.floor(lo - pad); hi = Math.ceil(hi + pad);
    var X = function (i) { return L + (W - L - R) * (hr.length === 1 ? 0.5 : i / (hr.length - 1)); };
    var Y = function (v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); };
    var g = '';
    [lo, Math.round((lo + hi) / 2), hi].forEach(function (v) {
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="var(--border)"/>' +
        '<text x="' + (L - 5) + '" y="' + (Y(v) + 3.5) + '" text-anchor="end" font-size="9.5" fill="var(--muted)">' + v + '</text>';
    });
    var half = Math.floor(hr.length / 2);
    g += '<line x1="' + X(half - 0.5) + '" x2="' + X(half - 0.5) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--border2)" stroke-dasharray="3 3"/>';
    g += '<polyline fill="none" stroke="#2dd4bf" stroke-width="2" points="' + hr.map(function (v, i) { return X(i) + ',' + Y(v); }).join(' ') + '"/>';
    hr.forEach(function (v, i) {
      g += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="3" fill="#2dd4bf"/>' +
        '<text x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="9" fill="var(--muted)">' + (allIdx ? _lbl(sc, i) : '') + '</text>';
    });
    return '<svg class="efl-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Fréquence cardiaque à chaque relevé">' + g + '</svg>';
  }

  // Minute du relevé i : échauffement + pas × (i + 1) ; en mode 2 valeurs : Début / Fin
  function _lbl(sc, i) {
    if (sc.mode !== 'splits') return i === 0 ? 'Début' : 'Fin';
    return Math.round((_minutes(sc.warmup) || 0) + (sc.every || 10) * (i + 1)) + '′';
  }

  // Détail : dérive début vs fin, FC, intensité, moitiés, RPE
  function efDetailHTML(sc) {
    if (!sc) return '';
    var k = efCalc(sc);
    if (!k) return '';
    var unit = sc.unit || 'W';
    var parts = [];
    if (k.out1 != null && k.out2 != null) parts.push(_esc(_show(k.out1)) + ' → ' + _esc(_show(k.out2)) + ' ' + _esc(unit));
    if (k.dec != null) parts.push('1re vs 2e moitié ' + efFmt(k.dec));
    if (k.rpe != null) parts.push('RPE moy. ' + _show(k.rpe));
    return '<div class="efl">' +
      '<div class="efl-h">🫀 Endurance fondamentale' + (sc.mod ? ' · ' + _esc(MODS[sc.mod] || sc.mod) : '') +
        (sc.duration ? ' · ' + _esc(sc.duration) : '') + '</div>' +
      '<div class="efl-r"><span class="efl-d ' + efTone(k.drift) + '">' + efFmt(k.drift) + '</span>' +
        '<span>FC ' + k.hr1 + ' → ' + k.hr2 + ' bpm (' + (k.dbpm > 0 ? '+' : '') + k.dbpm + ' bpm) · ' + _lbl(sc, k.i1) + ' → ' + _lbl(sc, k.i2) + '</span></div>' +
      (parts.length ? '<div class="efl-m">' + parts.join(' · ') + '</div>' : '') +
      (sc.notes ? '<div class="efl-m">« ' + _esc(sc.notes) + ' »</div>' : '') +
      _sparkSVG(sc) +
    '</div>';
  }
  window.efDetailHTML = efDetailHTML;

  // ---------- données ----------

  async function _loadFor(ids) {
    var uid = _uid();
    if (!uid || !ids.length || typeof sb === 'undefined') return;
    if (cache.uid !== uid) cache = { sessions: {}, scores: {}, uid: uid };
    var missing = ids.filter(function (id) { return !(id in cache.sessions); });
    if (!missing.length) return;
    var res = await Promise.all([
      sb.from('sessions').select('id,date,title,ef,score_type').in('id', missing).not('ef', 'is', null),
      sb.from('personal_sessions').select('id,date,title,ef,score_type').in('id', missing).not('ef', 'is', null)
    ]);
    missing.forEach(function (id) { cache.sessions[id] = null; });
    res.forEach(function (r) {
      (r.data || []).forEach(function (row) { if (row.ef && typeof row.ef === 'object') cache.sessions[row.id] = row; });
    });
    var efIds = missing.filter(function (id) { return cache.sessions[id]; });
    if (efIds.length) {
      var sc = await sb.from('wod_scores').select('session_id,ef').eq('athlete_id', uid).in('session_id', efIds);
      (sc.data || []).forEach(function (row) { if (row.ef) cache.scores[row.session_id] = row.ef; });
    }
  }

  function _rowsCount(ef) {
    if (ef.mode !== 'splits') return 2;
    var dur = _minutes(ef.duration), wu = _minutes(ef.warmup) || 0, every = ef.every || 10;
    var n = dur ? Math.floor((dur - wu) / every + 1e-6) : 4;
    return Math.max(2, Math.min(24, n));
  }

  function _draft(s) {
    var ef = s.ef, prev = cache.scores[s.id] || {}, n = _rowsCount(ef);
    var hr = [], out = [], rpe = [];
    for (var i = 0; i < n; i++) {
      hr.push(prev.hr && prev.hr[i] != null ? prev.hr[i] : null);
      out.push(prev.out && prev.out[i] != null ? prev.out[i] : null);
      rpe.push(prev.rpe && prev.rpe[i] != null ? prev.rpe[i] : null);
    }
    return { mode: ef.mode === 'splits' ? 'splits' : 'halves', every: ef.every || null, warmup: ef.warmup || null,
      unit: _outUnit(ef), hr: hr, out: out, rpe: rpe, notes: prev.notes || '' };
  }

  // ---------- carte de séance ----------

  function _targetHTML(ef) {
    if (ef.unit === '%' && ef.pct != null && ef.ref) {
      var f = _show(ef.pct).replace(',', '.') + '%|' + (ef.fmt || '') + '|' + String(ef.ref).toUpperCase() + '|';
      try { if (typeof renderContentWithCharges === 'function') return renderContentWithCharges(f); } catch (e) {}
      return _esc(f);
    }
    if (ef.target) return _esc(ef.target) + ' ' + _esc(ef.unit || '');
    return '';
  }

  function _resultHTML(d) {
    var k = efCalc(d);
    if (!k) return '<span class="efx-wait">Saisis tes FC pour voir ta dérive.</span>';
    return '<span class="efx-d ' + efTone(k.drift) + '">Dérive ' + efFmt(k.drift) + '</span>' +
      '<span class="efx-sub">' + _lbl(d, k.i1) + ' → ' + _lbl(d, k.i2) + ' : ' + k.hr1 + ' → ' + k.hr2 + ' bpm (' + (k.dbpm > 0 ? '+' : '') + k.dbpm + ' bpm)' +
      (k.dec != null ? ' · 1re vs 2e moitié ' + efFmt(k.dec) : '') + '</span>';
  }

  function _cardHTML(s, d) {
    var ef = s.ef, done = !!cache.scores[s.id];
    var unit = d.unit;
    var tgt = _targetHTML(ef);
    var info = [MODS[ef.mod] || '', ef.duration ? _esc(ef.duration) : '', ef.warmup ? 'échauffement ' + _esc(ef.warmup) + ' exclu' : '', tgt ? 'cible ' + tgt : '']
      .filter(Boolean).join(' · ');
    var rows = d.hr.map(function (h, i) {
      var lbl = _lbl(d, i);
      return '<div class="efx-row">' +
        '<div class="efx-l">' + lbl + '</div>' +
        '<input class="efx-in" inputmode="numeric" placeholder="bpm" aria-label="FC ' + lbl + '" data-efx="hr" data-sid="' + s.id + '" data-i="' + i + '" value="' + _show(h) + '">' +
        '<input class="efx-in efx-out" inputmode="' + (_isPace(unit) ? 'text' : 'decimal') + '" placeholder="' + _esc(unit) + '" aria-label="Intensité ' + lbl + ' en ' + _esc(unit) + '" data-efx="out" data-sid="' + s.id + '" data-i="' + i + '" value="' + _show(d.out[i]) + '">' +
        '<input class="efx-in efx-out" inputmode="decimal" placeholder="RPE" aria-label="RPE ' + lbl + '" data-efx="rpe" data-sid="' + s.id + '" data-i="' + i + '" value="' + _show(d.rpe[i]) + '">' +
      '</div>';
    }).join('');
    return '<div class="efx" data-efx-card="' + s.id + '">' +
      '<button type="button" class="efx-toggle" data-efx-open="' + s.id + '">' +
        '<span>🫀 Ma FC</span><span class="efx-state">' + (done ? 'Enregistrée ✓' : 'Ajouter') + '</span></button>' +
      '<div class="efx-body" id="efx-body-' + s.id + '" style="display:none">' +
        (info ? '<div class="efx-info">' + info + '</div>' : '') +
        (ef.note ? '<div class="efx-note">' + _esc(ef.note) + '</div>' : '') +
        '<div class="efx-row efx-head"><div></div><div>FC' + (d.mode === 'splits' ? ' fin' : '') + '</div><div>' + _esc(unit) + '</div><div>RPE</div></div>' +
        rows +
        '<div class="efx-res" id="efx-res-' + s.id + '">' + _resultHTML(d) + '</div>' +
        '<button type="button" class="efx-save" data-efx-save="' + s.id + '">Enregistrer ma FC</button>' +
        '<div class="efx-msg" id="efx-msg-' + s.id + '"></div>' +
      '</div>' +
    '</div>';
  }

  // ---------- interactions ----------

  function _onInput(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.efx) return;
    var d = drafts[el.dataset.sid]; if (!d) return;
    var i = +el.dataset.i, v = el.value.trim();
    if (el.dataset.efx === 'hr') d.hr[i] = _num(v);
    else if (el.dataset.efx === 'rpe') d.rpe[i] = _num(v);
    else d.out[i] = v === '' ? null : (_isPace(d.unit) ? v : _num(v));
    var r = document.getElementById('efx-res-' + el.dataset.sid);
    if (r) r.innerHTML = _resultHTML(d);
  }

  async function _save(sid) {
    var d = drafts[sid], uid = _uid(), s = cache.sessions[sid];
    var msg = document.getElementById('efx-msg-' + sid);
    if (!d || !uid || !s) return;
    var k = efCalc(d);
    if (!k) { if (msg) msg.textContent = d.mode === 'splits' ? 'Saisis au moins 2 relevés de FC.' : 'Saisis ta FC de début et de fin.'; return; }
    var ef = s.ef;
    var payloadEf = {
      v: 1, mode: d.mode, every: d.every, unit: d.unit, mod: ef.mod || null,
      duration: ef.duration || null, warmup: ef.warmup || null,
      hr: d.hr.map(function (x) { return x == null ? null : x; }),
      out: d.out.map(function (x) { return x == null || x === '' ? null : x; }),
      rpe: d.rpe.map(function (x) { return x == null ? null : x; }),
      notes: d.notes || '', drift: k.drift, dbpm: k.dbpm, dec: k.dec, method: k.method
    };
    var btn = document.querySelector('[data-efx-save="' + sid + '"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }
    try {
      var ex = await sb.from('wod_scores').select('id').eq('session_id', sid).eq('athlete_id', uid).maybeSingle();
      if (ex.error) throw ex.error;
      var r;
      if (ex.data) {
        r = await sb.from('wod_scores').update({ ef: payloadEf }).eq('id', ex.data.id);
      } else {
        var types = ['time', 'reps', 'rounds', 'weight', 'calories', 'text', 'watt', 'distance'];
        var level = 'rx';
        try { if (typeof getSelectedLevel === 'function') level = getSelectedLevel(sid) || 'rx'; } catch (e2) {}
        var dateEl = document.getElementById('done-at-' + sid);
        var payload = {
          session_id: sid, athlete_id: uid,
          score_type: types.indexOf(s.score_type) >= 0 ? s.score_type : 'text',
          score_value: s.score_type === 'watt' && k.outAvg ? k.outAvg : 0,
          score_text: (k.outAvg && d.unit === 'W' ? k.outAvg + ' W · ' : '') + 'dérive ' + efFmt(k.drift), level: level, ef: payloadEf
        };
        if (dateEl && dateEl.value) payload.done_at = dateEl.value;
        r = await sb.from('wod_scores').insert(payload);
      }
      if (r.error) throw r.error;
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer ma FC'; }
      if (msg) msg.textContent = '❌ ' + (err.message || err);
      return;
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer ma FC'; }
    cache.scores[sid] = payloadEf;
    if (msg) msg.textContent = '✅ Enregistré : ton coach voit ta dérive dans tes retours.';
    var st = document.querySelector('[data-efx-card="' + sid + '"] .efx-state');
    if (st) st.textContent = 'Enregistrée ✓';
    if (typeof currentScoresSession !== 'undefined' && currentScoresSession && currentScoresSession.sessionId === sid
        && typeof renderScoresModal === 'function') {
      try { renderScoresModal(sid, currentScoresSession.scoreType, currentScoresSession.sets); } catch (e3) {}
    }
    if (typeof showToast === 'function') showToast('🫀 FC enregistrée');
  }

  function _bindDoc() {
    if (window.__efxBound) return;
    window.__efxBound = true;
    document.addEventListener('input', _onInput);
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-efx-open],[data-efx-save]');
      if (!t) return;
      if (t.dataset.efxOpen) {
        var body = document.getElementById('efx-body-' + t.dataset.efxOpen);
        if (body) body.style.display = body.style.display === 'none' ? 'block' : 'none';
      } else if (t.dataset.efxSave) {
        _save(t.dataset.efxSave).catch(function (err) { console.error('[ef] save', err); });
      }
    });
  }

  // ---------- classement ----------

  async function _decorateLeaderboard(sessionId) {
    var el = document.getElementById('smodal-leaderboard');
    if (!el || !sessionId) return;
    var r = await sb.from('wod_scores').select('id,ef').eq('session_id', sessionId).not('ef', 'is', null);
    (r.data || []).forEach(function (sc) {
      var row = document.getElementById('sr-' + sc.id);
      if (!row || document.querySelector('[data-efl-for="' + sc.id + '"]')) return;
      var html = efDetailHTML(sc.ef);
      if (!html) return;
      row.insertAdjacentHTML('afterend', html);
      var box = row.nextElementSibling; if (box) box.dataset.eflFor = sc.id;
    });
  }

  function _wrapLeaderboard() {
    if (window.__efxLbWrapped || typeof window.renderScoresModal !== 'function') return;
    window.__efxLbWrapped = true;
    var prev = window.renderScoresModal;
    window.renderScoresModal = async function (sessionId) {
      var r = await prev.apply(this, arguments);
      try { await _decorateLeaderboard(sessionId); } catch (e) { console.error('[ef] classement', e); }
      return r;
    };
  }

  // ---------- décoration des cartes ----------

  async function decorate() {
    var area = document.getElementById('sessions-area');
    if (!area || !_uid()) return;
    var cards = Array.prototype.slice.call(area.querySelectorAll('.session-card'))
      .filter(function (c) { return !c.dataset.efxBound && /^sc-/.test(c.id || ''); });
    if (!cards.length) return;
    var ids = cards.map(function (c) { return c.id.replace(/^sc-/, ''); });
    await _loadFor(ids);
    cards.forEach(function (card) {
      var sid = card.id.replace(/^sc-/, '');
      card.dataset.efxBound = '1';
      var s = cache.sessions[sid];
      if (!s) return;
      var d = _draft(s);
      drafts[sid] = d;
      var btn = card.querySelector('.btn-score');
      var anchor = btn ? btn.parentElement : card.querySelector('.btn-open-scores');
      if (!anchor) return;
      anchor.insertAdjacentHTML(btn ? 'beforeend' : 'beforebegin', _cardHTML(s, d));
    });
  }

  function _injectCSS() {
    if (document.getElementById('efx-css')) return;
    var st = document.createElement('style');
    st.id = 'efx-css';
    st.textContent = [
      '.efx{margin-top:10px;border:1px solid var(--border2);border-radius:10px;overflow:hidden}',
      '.efx-toggle{width:100%;display:flex;justify-content:space-between;align-items:center;padding:11px 12px;background:var(--card2);',
      'border:0;color:var(--text);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer}',
      '.efx-state{font-size:11px;color:var(--muted);font-weight:600}',
      '.efx-body{padding:10px 12px 12px}',
      '.efx-info{font-size:11px;color:var(--muted);line-height:1.5}',
      '.efx-note{font-size:12px;color:var(--text2);margin-top:4px;line-height:1.45}',
      '.efx-row{display:grid;grid-template-columns:52px minmax(0,1.1fr) minmax(0,1fr) minmax(0,.8fr);gap:6px;align-items:center;margin-top:6px}',
      '.efx-head{font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-top:10px}',
      '.efx-head i{font-style:normal;font-weight:500;text-transform:none}',
      '.efx-l{font-size:12px;font-weight:700;color:var(--text2)}',
      '.efx-in{width:100%;min-width:0;background:var(--dark);border:1.5px solid var(--border2);border-radius:8px;color:var(--text);',
      'font-family:inherit;font-size:14px;font-weight:600;padding:8px 4px;text-align:center;outline:none}',
      '.efx-in:focus{border-color:var(--accent)}',
      '.efx-out{color:var(--text2);font-weight:500}',
      '.efx-res{margin:10px 0;padding:9px 10px;border-radius:9px;background:var(--card2);border:1px solid var(--border2);display:flex;flex-direction:column;gap:2px}',
      '.efx-d{font-size:15px;font-weight:800}',
      '.efx-sub,.efx-wait{font-size:11px;color:var(--muted)}',
      '.efx-d.ok,.efl-d.ok{color:#2dd4bf}.efx-d.mid,.efl-d.mid{color:var(--orange)}.efx-d.bad,.efl-d.bad{color:var(--red)}',
      '.efx-save{width:100%;padding:10px;border:0;border-radius:10px;background:var(--accent);color:#000;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer}',
      '.efx-save:disabled{opacity:.6}',
      '.efx-msg{font-size:12px;color:var(--muted);margin-top:8px;text-align:center}',
      '.efx-msg:empty{display:none}',
      '.efl{margin:2px 0 6px;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:var(--card)}',
      '.efl-h{font-size:11px;font-weight:700;color:var(--text2)}',
      '.efl-r{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-top:3px;font-size:12px;color:var(--text2)}',
      '.efl-d{font-size:14px;font-weight:800}',
      '.efl-m{font-size:10.5px;color:var(--muted);margin-top:2px;line-height:1.45}',
      '.efl-chart{display:block;width:100%;height:auto;margin-top:6px}',
      '.perso-r-pill.ef.ok .v{color:#2dd4bf}.perso-r-pill.ef.mid .v{color:var(--orange)}.perso-r-pill.ef.bad .v{color:var(--red)}',
      '.perso-r-row .val .efl{margin:0;border:0;padding:0;background:transparent}'
    ].join('');
    document.head.appendChild(st);
  }

  function _wrap(name) {
    var flag = '__efxWrapped_' + name;
    if (window[flag] || typeof window[name] !== 'function') return;
    window[flag] = true;
    var prev = window[name];
    window[name] = async function () {
      var r = await prev.apply(this, arguments);
      try { await decorate(); } catch (e) { console.error('[ef] decorate', e); }
      return r;
    };
  }

  function bind() {
    _injectCSS();
    _bindDoc();
    _wrap('renderSessions');
    _wrap('renderPersoSessions');
    _wrapLeaderboard();
    setTimeout(function () { decorate().catch(function (e) { console.error('[ef] decorate', e); }); }, 400);
  }

  _injectCSS();
  if (window.__STUDIO__) bind();
  else if (typeof window.waitForStudioReady === 'function') window.waitForStudioReady(8000).then(bind);
  else window.addEventListener('studio:ready', bind, { once: true });
  setTimeout(function () { if (!window.__efxBound) bind(); }, 10000);
})();
