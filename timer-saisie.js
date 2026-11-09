/* =====================================================================
   Saisie des scores dans le timer
   ---------------------------------------------------------------------
   Pendant le timer, l'athlète rentre ses valeurs série par série
   (hauteurs, charges, vitesses VBT, scores multiples…) et, à la fin,
   son score global + sa charge (temps, RPE), puis « Valider le bloc ».

   Principe : le timer ne garde rien lui-même. Chaque champ affiché est
   le miroir d'un champ de la carte de séance (formulaire « Mon score »,
   module VBT, volet « Ma charge »). Une saisie dans le timer écrit dans
   la carte et déclenche ses événements : les modules existants (VBT,
   charge, enregistrement) font le reste. Rien ne se perd en fermant le
   timer, tant que la page n'est pas rechargée.
   ===================================================================== */
(function () {
  if (window.__tmSaisieBound) return;
  window.__tmSaisieBound = true;

  var TEAL = '#2DD4BF';
  var cur = { key: '', sid: null, sel: null, auto: -1, info: null };

  function css() {
    if (document.getElementById('tms-css')) return;
    var st = document.createElement('style'); st.id = 'tms-css';
    st.textContent = [
      '#tm-ov .tm-sc{width:100%}',
      '#tm-ov .tms{width:100%;background:#151515;border:1px solid #262626;border-radius:16px;padding:12px 14px;margin:0 0 14px;box-sizing:border-box}',
      '#tm-ov .tms-h{display:flex;align-items:center;gap:8px}',
      '#tm-ov .tms-h .t{flex:1;min-width:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#999;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#tm-ov .tms-h .st{font-size:11px;letter-spacing:1.5px;font-weight:700;color:' + TEAL + '}',
      '#tm-ov .tms-h .st.ok{color:#2ecc71}',
      '#tm-ov .tms-nav{width:32px;height:32px;flex:none;border-radius:9px;border:1px solid #333;background:#0b0b0b;color:#f0f0f0;font-size:18px;cursor:pointer}',
      '#tm-ov .tms-nav:disabled{opacity:.25}',
      '#tm-ov .tms-row{display:flex;gap:8px;margin-top:10px;align-items:flex-end}',
      '#tm-ov .tms-f{flex:1;min-width:0}',
      '#tm-ov .tms-f small{display:block;font-size:10px;color:#888;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#tm-ov .tms input.tms-in{width:100%;height:48px;border-radius:10px;background:#0f0f0f;border:1.5px solid #333;color:#f0f0f0;text-align:center;font-size:20px;font-weight:700;font-family:inherit;font-variant-numeric:tabular-nums;box-sizing:border-box;padding:0 4px}',
      '#tm-ov .tms input.tms-in:focus{outline:none;border-color:' + TEAL + '}',
      '#tm-ov .tms input.tms-in.fill{border-color:' + TEAL + '}',
      '#tm-ov .tms input.tms-in.g{color:#2ecc71}#tm-ov .tms input.tms-in.o{color:#ff8c47}',
      '#tm-ov .tms input.tms-in::placeholder{color:#555;font-weight:500}',
      '#tm-ov .tms-pm{display:flex;gap:6px}',
      '#tm-ov .tms-pm button{width:48px;height:48px;border-radius:10px;border:1px solid #333;background:#0b0b0b;color:#f0f0f0;font-size:22px;cursor:pointer}',
      '#tm-ov .tms-hist{margin-top:10px;border-top:1px solid #262626;padding-top:4px;max-height:118px;overflow:auto}',
      '#tm-ov .tms-hr{display:flex;align-items:center;gap:8px;font-size:13px;padding:4px 6px;margin:0 -6px;border-radius:8px;cursor:pointer;font-variant-numeric:tabular-nums}',
      '#tm-ov .tms-hr.cur{background:#1e1e1e}',
      '#tm-ov .tms-hr .tn{width:46px;flex:none;color:#888;font-size:11px;letter-spacing:1px}',
      '#tm-ov .tms-hr .tv{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#tm-ov .tms-hr .tv.e{color:#555}',
      '#tm-ov .tms-hr .ok{color:' + TEAL + ';font-size:12px;font-weight:700}',
      '#tm-ov .tms-hr .best{color:#ffd147;font-size:10px;font-weight:700;letter-spacing:1px}',
      '#tm-ov .tms-sep{height:1px;background:#262626;margin:12px 0 2px}',
      '#tm-ov .tms-rpe{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin-top:4px}',
      '#tm-ov .tms-rpe button{height:38px;border-radius:8px;border:1px solid #333;background:#0b0b0b;color:#f0f0f0;font-weight:700;font-size:13px;cursor:pointer;padding:0}',
      '#tm-ov .tms-rpe button.on{background:' + TEAL + ';border-color:' + TEAL + ';color:#04201c}',
      '#tm-ov .tms-go{width:100%;height:52px;margin-top:12px;border-radius:12px;border:0;background:' + TEAL + ';color:#04201c;font-weight:800;font-size:15px;letter-spacing:1px;cursor:pointer;font-family:inherit}',
      '#tm-ov .tms-note{font-size:11px;color:#777;margin-top:8px;line-height:1.45}',
      '#tm-ov .tms-done{font-size:13px;color:#2ecc71;font-weight:700;text-align:center;margin-top:10px}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ---------- lecture de la carte ----------
  function card(sid) { return document.getElementById('sc-' + sid); }
  function zoneOf(c) { var b = c && c.querySelector('.btn-score'); return b ? b.parentElement : (c ? c.querySelector('.ms-body') : null); }
  function lbl(el) {
    var f = el.closest('.multi-score-row'); if (f) { var l = f.querySelector('.multi-score-lbl'); if (l) return l.textContent.trim(); }
    f = el.closest('.rounds-field'); if (f) { var l2 = f.querySelector('.rounds-lbl'); if (l2) return l2.textContent.trim(); }
    f = el.closest('.set-row'); if (f) { var l3 = f.querySelector('.set-label'); if (l3) return l3.textContent.trim(); }
    return (el.getAttribute('aria-label') || el.placeholder || 'Score').trim();
  }
  function stepFor(el, kind) {
    if (kind === 'v') return 0.01;
    if (kind === 'kg') return 2.5;
    var t = el.dataset && el.dataset.stype;
    if (t === 'weight') return 2.5;
    if (t === 'distance') { var x = num(el.value) || num(el.placeholder); return x != null && x < 20 ? 0.05 : 1; }
    if (t === 'time' || t === 'text') return 0;
    return 1;
  }

  /* Séries de la carte : VBT (charge + vitesses), scores multiples, séries en kg */
  function slotsOf(c, sid) {
    var out = [];
    var vb = c.querySelectorAll('.vbx input[data-vx][data-sid="' + sid + '"]');
    if (vb.length) {
      vb.forEach(function (el) {
        var k = +el.dataset.s; out[k] = out[k] || { fields: [], vbt: true };
        var isLoad = el.dataset.vx === 'load';
        out[k].fields.push({ el: el, kind: isLoad ? 'kg' : 'v', label: isLoad ? 'Charge (kg)' : 'Rep ' + (+el.dataset.r + 1), b: +el.dataset.b });
      });
      return out.filter(Boolean);
    }
    var i = 0, el;
    while ((el = document.getElementById('score-' + i + '-' + sid))) { out.push({ fields: [{ el: el, kind: 'm', label: lbl(el) }] }); i++; }
    if (out.length) return out;
    i = 0;
    while ((el = document.getElementById('set-' + sid + '-' + i))) { out.push({ fields: [{ el: el, kind: 'kg', label: 'Charge (kg)' }] }); i++; }
    if (out.length) return out;
    return virtualSlots(sid);
  }
  /* Score unique (distance, charge, reps…) mais bloc en séries : saisie série par série
     dans le timer, et le score de la carte reçoit le meilleur (distance, charge, watts)
     ou le total (reps, calories). */
  var AGG = { distance: 'max', weight: 'max', watt: 'max', reps: 'sum', calories: 'sum' };
  cur.virt = {};
  function virtualSlots(sid) {
    var n = cur.info && cur.info.nSets, real = document.getElementById('score-input-' + sid);
    if (!n || n < 2 || !real || real.type === 'hidden' || real.tagName === 'TEXTAREA') return [];
    var c = card(sid), ty = (c && c.dataset.stype) || real.dataset.stype || guessType(real);
    if (!AGG[ty]) return [];
    var arr = cur.virt[sid] = cur.virt[sid] || [];
    var out = [];
    for (var i = 0; i < n; i++) {
      arr[i] = arr[i] || fakeEl(ty);
      out.push({ fields: [{ el: arr[i], kind: 'm', label: (ty === 'distance' ? 'Distance' : ty === 'weight' ? 'Charge (kg)' : ty === 'reps' ? 'Reps' : ty === 'calories' ? 'Calories' : 'Watts') }], virt: { real: real, ty: ty, arr: arr } });
    }
    return out;
  }
  function guessType(real) {
    var ph = String(real.placeholder || '');
    var map = { distance: /m\b|2\.45/, weight: /kg/, reps: /rep/i, calories: /cal/i, watt: /w\b|watt/i };
    for (var k in map) if (map[k].test(ph)) return k;
    return '';
  }
  function fakeEl(ty) {
    return { value: '', placeholder: '', dataset: { stype: ty }, className: '', fake: true,
      getAttribute: function () { return null; }, dispatchEvent: function () {}, closest: function () { return null; } };
  }
  function syncVirt(slot) {
    if (!slot || !slot.virt) return;
    var v = slot.virt, nums = v.arr.map(function (x) { return num(x.value); }).filter(function (x) { return x != null; });
    var agg = !nums.length ? '' : AGG[v.ty] === 'max' ? Math.max.apply(null, nums) : nums.reduce(function (a, b) { return a + b; }, 0);
    setVal(v.real, agg === '' ? '' : String(Math.round(agg * 100) / 100));
  }
  /* Champs de score « globaux » (temps, rounds, reps, texte…) */
  function finalsOf(c, sid) {
    var z = zoneOf(c); if (!z) return [];
    return Array.prototype.filter.call(z.querySelectorAll('input,textarea'), function (el) {
      if (!el.id || el.id.indexOf(sid) < 0) return false;
      if (/^done-at-|^set-|^score-\d+-/.test(el.id)) return false;
      if (el.type === 'hidden' || el.type === 'checkbox' || el.type === 'date') return false;
      if (el.closest('.chg-inline') || el.closest('.vbx') || el.closest('.efx')) return false;
      for (var p = el.parentElement; p && p !== z.parentElement; p = p.parentElement) if (p.style && p.style.display === 'none') return false;
      return true;
    });
  }
  function chargeOf(c, sid) {
    var w = c.querySelector('.chg-inline[data-chg="' + sid + '"]');
    return w ? { w: w, min: w.querySelector('[data-min]'), rpe: w.querySelectorAll('[data-rpe]') } : null;
  }
  function rpeVal(ch) {
    var v = 0; if (!ch) return 0;
    ch.rpe.forEach(function (b) { if (b.getAttribute('style') && /background/.test(b.getAttribute('style'))) v = +b.dataset.rpe; });
    return v;
  }

  function setVal(el, v) {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; }
  function show(v) { return v == null ? '' : String(v); }
  function filled(slot) { return slot.fields.some(function (f) { return String(f.el.value || '').trim() !== ''; }); }
  function slotDone(slot) { return slot.fields.every(function (f) { return String(f.el.value || '').trim() !== ''; }); }
  // ---------- rendu ----------
  function render(info, force) {
    var c = card(info.sid), box = info.el; if (!c || !box) { if (box) box.innerHTML = ''; return; }
    var slots = slotsOf(c, info.sid), finals = finalsOf(c, info.sid), ch = chargeOf(c, info.sid);
    var btn = c.querySelector('.btn-score');
    var showFinal = info.done || (!slots.length && info.started && (info.kind === 'up' || info.kind === 'down'));
    if (!slots.length && !showFinal) { box.innerHTML = ''; cur.key = ''; compact(box, false); return; }
    var k = cur.sel != null ? cur.sel : Math.min(info.slot, Math.max(0, slots.length - 1));
    if (slots.length && info.nSets && slots.length !== info.nSets && cur.sel == null) k = Math.min(slots.length - 1, Math.floor(info.slot * slots.length / info.nSets));
    var key = [info.sid, info.part, k, info.done ? 1 : 0, showFinal ? 1 : 0, slots.length].join('|');
    if (!force && key === cur.key) { paintHist(box, slots, k); return; }
    cur.key = key; cur.k = k; cur.slots = slots; cur.finals = finals; cur.ch = ch;

    // pré-remplissage de fin : temps (FOR TIME), rounds (AMRAP), temps de séance
    if (info.done && !cur.prefilled) {
      cur.prefilled = true;
      var tm = document.getElementById('time-min-' + info.sid), ts = document.getElementById('time-sec-' + info.sid);
      if (info.secs != null && tm && ts && !tm.value && !ts.value) { setVal(tm, Math.floor(info.secs / 60)); setVal(ts, Math.floor(info.secs % 60)); }
      var rd = document.getElementById('rounds-' + info.sid);
      if (rd && !rd.value && info.rounds) setVal(rd, info.rounds);
      if (ch && ch.min && !ch.min.value && info.minutes >= 1) setVal(ch.min, Math.round(info.minutes));
    }

    var h = '';
    if (slots.length) {
      var s = slots[k], prev = slots[k - 1];
      // VBT : la charge de la série d'avant est reprise d'office (calibrée = on ajuste ensuite)
      if (s.vbt && prev) s.fields.forEach(function (f, fi) {
        var pf = prev.fields[fi];
        if (f.kind === 'kg' && !String(f.el.value || '').trim() && pf && String(pf.el.value || '').trim()) setVal(f.el, pf.el.value);
      });
      h += '<div class="tms"><div class="tms-h">' +
        '<button class="tms-nav" data-tms="prev"' + (k ? '' : ' disabled') + '>‹</button>' +
        '<div class="t" data-tms="fold">SET ' + (k + 1) + ' / ' + slots.length + (s.vbt ? ' · vitesses' : '') + ' <span style="color:#666">' + (cur.fold ? '▸' : '▾') + '</span></div>' +
        '<span class="st' + (slotDone(s) ? ' ok' : '') + '">' + (slotDone(s) ? '✓ SAISI' : 'À SAISIR') + '</span>' +
        '<button class="tms-nav" data-tms="next"' + (k < slots.length - 1 ? '' : ' disabled') + '>›</button></div>';
      var single = s.fields.length === 1;
      h += '<div class="tms-body"' + (cur.fold ? ' style="display:none"' : '') + '>';
      h += '<div class="tms-row">' + s.fields.map(function (f, fi) {
        var ph = prev && prev.fields[fi] ? show(prev.fields[fi].el.value) : '';
        if (!ph && f.kind !== 'm') ph = f.el.placeholder || '';
        var step = stepFor(f.el, f.kind);
        var mode = step && step < 1 ? 'decimal' : (step ? 'decimal' : 'text');
        return '<div class="tms-f"' + (f.kind === 'kg' && !single ? ' style="flex:1.15"' : '') + '><small>' + f.label + '</small>' +
          '<input class="tms-in' + (f.el.value ? ' fill' : '') + '" data-fi="' + fi + '" inputmode="' + mode + '" value="' + show(f.el.value) + '" placeholder="' + ph + '"></div>';
      }).join('') +
        (single && stepFor(s.fields[0].el, s.fields[0].kind) ? '<div class="tms-pm"><button data-tms="minus">−</button><button data-tms="plus">+</button></div>' : '') +
        '</div>';
      if (s.vbt) h += '<div class="tms-note">Charge pré-remplie avec la série d\'avant. Les vitesses partent dans ton Journal VBT à la validation.</div>';
      h += '<div class="tms-hist"></div></div>';
      if (!showFinal) h += '</div>';
    }
    if (showFinal) {
      if (!slots.length) h += '<div class="tms">';
      else h += '<div class="tms-sep"></div>';
      if (finals.length) {
        h += '<div class="tms-h"><div class="t">MON SCORE</div></div><div class="tms-row" style="flex-wrap:wrap">' + finals.map(function (el, fi) {
          return '<div class="tms-f" style="min-width:42%"><small>' + lbl(el) + '</small><input class="tms-in' + (el.value ? ' fill' : '') + '" data-fin="' + fi + '" value="' + show(el.value).replace(/"/g, '&quot;') + '" placeholder="' + (el.placeholder || '') + '"></div>';
        }).join('') + '</div>';
      }
      if (ch) {
        var rp = rpeVal(ch);
        h += '<div class="tms-h" style="margin-top:12px"><div class="t">MA CHARGE</div></div>' +
          '<div class="tms-row"><div class="tms-f"><small>Temps de séance (min)</small><input class="tms-in' + (ch.min && ch.min.value ? ' fill' : '') + '" data-chmin inputmode="numeric" value="' + show(ch.min && ch.min.value) + '" placeholder="min"></div></div>' +
          '<div class="tms-f" style="margin-top:10px"><small>RPE du bloc</small></div><div class="tms-rpe">' +
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<button data-tms-rpe="' + n + '" class="' + (n === rp ? 'on' : '') + '">' + n + '</button>'; }).join('') + '</div>';
      }
      if (btn) h += '<button class="tms-go" data-tms="valider">✓ VALIDER LE BLOC</button>';
      h += '<div class="tms-done" data-tms-msg></div></div>';
    }
    box.innerHTML = h;
    paintHist(box, slots, k);
    compact(box, !!h);
  }
  // Tout sur un écran : chrono plus compact, « LE BLOC » replié tant qu'on saisit
  function compact(box, on) {
    var tm = box.closest('.tm'); if (!tm) return;
    tm.classList.toggle('compact', on);
    var nx = tm.querySelector('.nx');
    if (nx && !nx.dataset.user) nx.classList.toggle('shut', on);
  }

  function summary(slot) {
    var vals = slot.fields.map(function (f) { return String(f.el.value || '').trim(); });
    if (!vals.some(Boolean)) return '';
    if (slot.vbt) {
      var load = slot.fields.filter(function (f) { return f.kind === 'kg'; }).map(function (f) { return f.el.value; })[0];
      var vs = slot.fields.filter(function (f) { return f.kind === 'v' && f.el.value; }).map(function (f) { return f.el.value; });
      return (load ? load + ' kg' : '–') + (vs.length ? ' · ' + vs.join(' / ') : '');
    }
    var f0 = slot.fields[0], u = f0.kind === 'kg' || (f0.el.dataset && f0.el.dataset.stype === 'weight') ? ' kg' : '';
    return vals[0] + u;
  }
  function okMark(s) {
    if (s.vbt) return s.fields.some(function (f) { return f.kind === 'v' && String(f.el.value || '').trim(); });
    return filled(s);
  }
  function paintHist(box, slots, k) {
    var el = box.querySelector('.tms-hist'); if (!el) return;
    var best = -1, bv = null;
    if (slots.length && slots[0].fields.length === 1 && stepFor(slots[0].fields[0].el, slots[0].fields[0].kind)) {
      slots.forEach(function (s, i) { var v = num(s.fields[0].el.value); if (v != null && (bv == null || v > bv)) { bv = v; best = i; } });
      if (slots.filter(function (s) { return num(s.fields[0].el.value) != null; }).length < 2) best = -1;
    }
    el.innerHTML = slots.map(function (s, i) {
      var sm = summary(s);
      return '<div class="tms-hr' + (i === k ? ' cur' : '') + '" data-tms-go="' + i + '"><span class="tn">SET ' + (i + 1) + '</span>' +
        '<span class="tv' + (sm ? '' : ' e') + '">' + (sm || '–') + '</span>' +
        (i === best ? '<span class="best">MEILLEUR</span>' : (okMark(s) ? '<span class="ok">✓</span>' : '')) + '</div>';
    }).join('');
    var c = el.querySelector('.cur'); if (c && c.scrollIntoView && el.scrollHeight > el.clientHeight) el.scrollTop = c.offsetTop - el.offsetTop - 40;
  }

  // ---------- événements ----------
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t.closest || !t.closest('#tm-ov .tms')) return;
    var box = t.closest('.tm-sc');
    if (t.dataset.fi != null && cur.slots) {
      var f = cur.slots[cur.k].fields[+t.dataset.fi]; setVal(f.el, t.value); syncVirt(cur.slots[cur.k]); t.classList.toggle('fill', !!t.value);
      var stEl = box.querySelector('.tms-h .st'); if (stEl) { var d = slotDone(cur.slots[cur.k]); stEl.textContent = d ? '✓ SAISI' : 'À SAISIR'; stEl.classList.toggle('ok', d); }
      paintHist(box, cur.slots, cur.k);
    } else if (t.dataset.fin != null && cur.finals) {
      setVal(cur.finals[+t.dataset.fin], t.value); t.classList.toggle('fill', !!t.value);
    } else if (t.hasAttribute('data-chmin') && cur.ch && cur.ch.min) {
      setVal(cur.ch.min, t.value); t.classList.toggle('fill', !!t.value);
    }
  }, true);

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('#tm-ov [data-tms],#tm-ov [data-tms-go],#tm-ov [data-tms-rpe]'); if (!t || !cur.info) return;
    e.stopPropagation();
    var a = t.getAttribute('data-tms');
    if (t.hasAttribute('data-tms-go')) { cur.sel = +t.getAttribute('data-tms-go'); return render(cur.info, true); }
    if (t.hasAttribute('data-tms-rpe')) {
      var n = +t.getAttribute('data-tms-rpe');
      if (cur.ch) { var b = cur.ch.w.querySelector('[data-rpe="' + n + '"]'); if (b) b.click(); }
      t.parentElement.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === t); });
      return;
    }
    if (a === 'fold') { cur.fold = !cur.fold; return render(cur.info, true); }
    if (a === 'prev' || a === 'next') { cur.sel = Math.max(0, Math.min(cur.slots.length - 1, cur.k + (a === 'next' ? 1 : -1))); return render(cur.info, true); }
    if (a === 'plus' || a === 'minus') {
      var f = cur.slots[cur.k].fields[0], step = stepFor(f.el, f.kind);
      var inp = document.querySelector('#tm-ov .tms-in[data-fi="0"]');
      var base = num(f.el.value); if (base == null) base = num(inp && inp.placeholder); if (base == null) base = 0;
      if (f.el.dataset && f.el.dataset.stype === 'distance') step = base < 20 ? 0.05 : 1;
      var v = Math.max(0, Math.round((base + (a === 'plus' ? step : -step)) * 100) / 100);
      setVal(f.el, String(v)); syncVirt(cur.slots[cur.k]); if (inp) { inp.value = v; inp.classList.add('fill'); }
      var box = t.closest('.tm-sc'); paintHist(box, cur.slots, cur.k);
      var stEl = box.querySelector('.tms-h .st'); if (stEl) { var d = slotDone(cur.slots[cur.k]); stEl.textContent = d ? '✓ SAISI' : 'À SAISIR'; stEl.classList.toggle('ok', d); }
      return;
    }
    if (a === 'valider') {
      var c = card(cur.info.sid), btn = c && c.querySelector('.btn-score'); if (!btn) return;
      t.disabled = true; t.textContent = 'Enregistrement…';
      btn.click();
      setTimeout(function () {
        t.disabled = false; t.textContent = '✓ VALIDER LE BLOC';
        var pill = c.querySelector('.chg-pill'), msg = document.querySelector('#tm-ov [data-tms-msg]');
        var toast = document.getElementById('toast');
        if (msg) msg.textContent = (toast && toast.textContent) || (pill ? pill.textContent : '');
      }, 1500);
    }
  }, true);

  // ---------- branchement sur le timer ----------
  window.tmScoreHook = function (info) {
    css();
    if (info.sid !== cur.sid || info.part !== (cur.info && cur.info.part)) { cur.sel = null; cur.key = ''; cur.prefilled = false; cur.sid = info.sid; }
    var moved = info.slot !== cur.auto || info.done !== (cur.info && cur.info.done);
    if (info.slot !== cur.auto) { cur.auto = info.slot; cur.sel = null; }
    if (!info.done) cur.prefilled = false;
    cur.info = info;
    var a = document.activeElement;
    if (a && a.closest && a.closest('#tm-ov .tms') && cur.key) {
      if (!moved) return;            // ne pas casser une saisie en cours…
      a.blur();                      // …sauf quand le timer passe à la série suivante
    }
    render(info, moved);
  };
})();
