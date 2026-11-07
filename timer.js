/* Timer intégré aux blocs de séance.
   Lit le format dans le contenu du bloc (EVERY, EMOM, AMRAP, FOR TIME, TABATA, Nx AMRAP / REST)
   et ouvre un timer plein écran. N'enregistre aucun score. */
(function () {
  'use strict';
  var specs = {};

  function sec(t) { var p = String(t).split(':').map(Number); return p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60; }
  function fmt(s) { s = Math.max(0, Math.round(s)); var m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r; }
  function plain(html) {
    return String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ');
  }

  // Renvoie {kind, label, phases|dur|cap} ou null
  function parse(content) {
    var t = plain(content).toUpperCase();
    var T = '(\\d{1,2}:\\d{2}|\\d{1,2})';
    var cands = [];
    function add(re, fn) { var m = t.match(re); if (m) { var r = fn(m); if (r) { r.pos = m.index; cands.push(r); } } }

    add(new RegExp('(\\d+)\\s*SETS?\\s+EVERY\\s+' + T + '\\s*\\(\\s*' + T + '\\s*ON\\s*\\/\\s*' + T + '\\s*OFF'), function (m) {
      var n = +m[1], d = sec(m[2]), on = sec(m[3]), off = sec(m[4]); if (!n || !d || !on || on + off !== d) return null;
      var ph = []; for (var i = 1; i <= n; i++) { ph.push({ d: on, lab: 'SET ' + i + ' / ' + n, work: true }); if (off) ph.push({ d: off, lab: 'REPOS', rest: true }); }
      return { kind: 'int', label: 'EVERY ' + fmt(d) + ' × ' + n + ' · ' + fmt(on) + ' ON', short: n + ' × ' + fmt(d), phases: ph };
    });
    add(new RegExp('(\\d+)\\s*SETS?\\s+EVERY\\s+' + T), function (m) {
      var n = +m[1], d = sec(m[2]); if (!n || !d) return null;
      return { kind: 'int', label: 'EVERY ' + fmt(d) + ' × ' + n, short: n + ' × ' + fmt(d), phases: rep(n, d, 'SET') };
    });
    add(new RegExp('EVERY\\s+' + T + '\\s*[X×]\\s*(\\d+)'), function (m) {
      var n = +m[2], d = sec(m[1]); if (!n || !d) return null;
      return { kind: 'int', label: 'EVERY ' + fmt(d) + ' × ' + n, short: n + ' × ' + fmt(d), phases: rep(n, d, 'SET') };
    });
    add(new RegExp('(\\d+)\\s*[X×]\\s*AMRAP\\s+' + T + '\\s*\\/?\\s*REST\\s+' + T), function (m) {
      var n = +m[1], w = sec(m[2]), r = sec(m[3]); if (!n || !w) return null;
      var ph = []; for (var i = 1; i <= n; i++) { ph.push({ d: w, lab: 'ROUND ' + i + ' / ' + n, work: true }); if (r && i < n) ph.push({ d: r, lab: 'REPOS', rest: true }); }
      return { kind: 'int', label: n + ' × AMRAP ' + fmt(w) + ' / REST ' + fmt(r), short: n + ' × ' + fmt(w), phases: ph };
    });
    // Séries avec repos : le chrono de repos part dès que l'athlète a fini sa série
    add(new RegExp('(\\d+)\\s*(?:SETS?|S[EÉ]RIES?)\\s*[-–]?\\s*(?:REST|REPOS)\\s+' + T), function (m) {
      var n = +m[1], r = sec(m[2]); if (!n || !r || n > 40) return null;
      return { kind: 'rest', label: n + ' SETS · REST ' + fmt(r), short: n + ' SETS', n: n, rest: r };
    });
    add(/E(\d)MOM\s+(\d{1,2})(?::(\d{2}))?/, function (m) {
      var k = +m[1], tot = +m[2] * 60 + (+m[3] || 0); var n = Math.floor(tot / (k * 60)); if (!n) return null;
      return { kind: 'int', label: 'E' + k + 'MOM ' + fmt(tot), short: 'E' + k + 'MOM ' + Math.round(tot / 60), phases: rep(n, k * 60, 'MINUTE', k) };
    });
    add(/(?:^|[^E\d])EMOM\s+(\d{1,2})(?::(\d{2}))?/, function (m) {
      var tot = +m[1] * 60 + (+m[2] || 0); var n = Math.floor(tot / 60); if (!n) return null;
      return { kind: 'int', label: 'EMOM ' + fmt(tot), short: 'EMOM ' + n, phases: rep(n, 60, 'MINUTE') };
    });
    add(/TABATA/, function () {
      var ph = []; for (var i = 1; i <= 8; i++) { ph.push({ d: 20, lab: 'ROUND ' + i + ' / 8', work: true, hot: true }); if (i < 8) ph.push({ d: 10, lab: 'REPOS', rest: true }); }
      return { kind: 'int', label: 'TABATA 8 × 20″ / 10″', short: 'TABATA', phases: ph };
    });
    add(new RegExp('AMRAP\\s+' + T), function (m) {
      var d = sec(m[1]); if (!d) return null;
      return { kind: 'down', label: 'AMRAP ' + fmt(d), short: 'AMRAP ' + fmt(d), dur: d };
    });
    add(new RegExp('FOR\\s+TIME[^\\n]{0,20}?CAP\\s+' + T), function (m) {
      var d = sec(m[1]); if (!d) return null;
      return { kind: 'up', label: 'FOR TIME · CAP ' + fmt(d), short: 'CAP ' + fmt(d), cap: d };
    });
    add(/FOR\s+TIME/, function () { return { kind: 'up', label: 'FOR TIME', short: 'FOR TIME', cap: 0 }; });

    if (!cands.length) return null;
    // le premier format écrit dans le bloc ; à position égale, le plus précis (ordre d'ajout)
    cands.sort(function (a, b) { return a.pos - b.pos; });
    return cands[0];
  }

  // Découpe un bloc en parties chronométrées, dans l'ordre d'écriture
  function rawLines(content) {
    return String(content || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').split('\n');
  }
  function parseParts(content) {
    var L = rawLines(content), out = [], section = '', sub = '', secIdx = 0, subIdx = -1, afterSep = true;
    var isSep = function (s) { return /^\s*[_\-=]{3,}\s*$/.test(s); };
    for (var i = 0; i < L.length; i++) {
      var raw = L[i], s = raw.trim(); if (!s) continue;
      if (isSep(s)) { afterSep = true; continue; }
      var sp = /^\(/.test(s) ? null : parse(s);
      if (sp) {
        var start = subIdx >= 0 ? subIdx : (section ? secIdx : i);
        sp.name = [section, sub].filter(Boolean).join(' · ');
        sp.start = Math.min(start, i); out.push(sp);
        sub = ''; subIdx = -1; afterSep = false; continue;
      }
      var short = s.length <= 40, num = /^\d+\s*[.)]\s+[A-ZÀ-Ü]/i.test(s);
      if (short && num) { sub = s; subIdx = i; }
      else if (afterSep && short) { section = s; secIdx = i; sub = ''; subIdx = -1; }
      afterSep = false;
    }
    for (var k = 0; k < out.length; k++) {
      var end = k + 1 < out.length ? out[k + 1].start : L.length;
      out[k].raw = L.slice(out[k].start, end).filter(function (x) { return !isSep(x.trim()); }).join('\n').replace(/^\n+|\n+$/g, '').replace(/\n{3,}/g, '\n\n').replace(/\n/g, '<br>');
    }
    return out;
  }
  function rep(n, d, word, k) {
    var a = []; for (var i = 1; i <= n; i++) a.push({ d: d, lab: word + ' ' + (k ? (i - 1) * k + 1 : i) + ' / ' + (k ? n * k : n), work: true });
    return a;
  }

  // ---------- pastille dans l'en-tête du bloc ----------
  window.blockTimerPill = function (s) {
    try {
      var parts = parseParts(s && s.content); if (!parts.length) return '';
      css();
      var html = function (raw) { try { return typeof renderContentWithCharges === 'function' ? renderContentWithCharges(raw) : raw; } catch (e) { return raw; } };
      parts.forEach(function (p) { p.html = html(p.raw); });
      specs[s.id] = { parts: parts, title: s.title || '' };
      return '<span class="tm-pill" role="button" onclick="event.stopPropagation();openBlockTimer(\'' + s.id + '\')"><i>▶</i> TIMER</span>';
    } catch (e) { return ''; }
  };

  // ---------- styles ----------
  function css() {
    if (document.getElementById('tm-styles')) return;
    var st = document.createElement('style'); st.id = 'tm-styles';
    st.textContent = [
      '.tm-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;letter-spacing:1px;color:#000;background:var(--accent);border-radius:20px;padding:6px 12px 6px 10px;box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 14%,transparent);cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent}',
      '.tm-pill i{font-style:normal;font-size:10px}',
      '.tm-pill:active{transform:scale(.96)}',
      '#tm-ov{position:fixed;inset:0;z-index:10050;background:#0b0b0b;color:#f0f0f0;display:flex;justify-content:center;overflow:auto;font-family:"DM Sans",sans-serif}',
      '#tm-ov .tm{width:100%;max-width:460px;min-height:100%;display:flex;flex-direction:column;align-items:center;padding:calc(18px + env(safe-area-inset-top,0px)) 18px calc(18px + env(safe-area-inset-bottom,0px));box-sizing:border-box}',
      '#tm-ov .top{width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px}',
      '#tm-ov .x{width:38px;height:38px;flex:none;border-radius:50%;border:1px solid #333;background:none;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:15px;cursor:pointer}',
      '#tm-ov .x.off{opacity:.4}',
      '#tm-ov .lab{text-align:center;min-width:0}',
      '#tm-ov .lab .k{font-size:10px;letter-spacing:2px;font-weight:700;color:#777;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#tm-ov .lab .t{font-family:"Bebas Neue",sans-serif;font-size:24px;letter-spacing:1.5px;line-height:1.1}',
      '#tm-ov .ring{position:relative;width:min(270px,70vw);aspect-ratio:1;margin:18px 0 10px}',
      '#tm-ov .ring svg{width:100%;height:100%;transform:rotate(-90deg)}',
      '#tm-ov .ring circle{transition:stroke .3s,stroke-dashoffset .2s linear}',
      '#tm-ov .ring .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}',
      '#tm-ov .v{font-weight:700;font-size:min(78px,20vw);letter-spacing:-2px;line-height:1;font-variant-numeric:tabular-nums}',
      '#tm-ov .ph{font-size:11px;letter-spacing:2.5px;font-weight:700;margin-bottom:6px;text-transform:uppercase}',
      '#tm-ov .s{font-family:"Bebas Neue",sans-serif;font-size:22px;letter-spacing:2px;color:#777;margin-top:8px}',
      '#tm-ov .sets{display:flex;gap:6px;margin:4px 0 16px;width:100%;max-width:340px;justify-content:center}',
      '#tm-ov .sets i{flex:0 1 30px;height:5px;border-radius:3px;background:#333}',
      '#tm-ov .sets i.on{background:var(--tm-c)}#tm-ov .sets i.cur{background:color-mix(in srgb,var(--tm-c) 45%,#333)}',
      '#tm-ov .cnt{display:flex;align-items:center;gap:14px;margin:4px 0 16px}',
      '#tm-ov .cnt button{width:60px;height:60px;border-radius:50%;border:1px solid #333;background:#161616;color:#f0f0f0;font-size:26px;cursor:pointer}',
      '#tm-ov .cnt button.p{background:var(--tm-c);color:#000;border-color:var(--tm-c)}',
      '#tm-ov .cnt .n{font-family:"Bebas Neue",sans-serif;font-size:44px;min-width:90px;text-align:center;line-height:1}',
      '#tm-ov .cnt .n small{display:block;font-family:"DM Sans",sans-serif;font-size:10px;letter-spacing:2px;color:#777}',
      '#tm-ov .nx{width:100%;background:#161616;border:1px solid #252525;border-radius:14px;padding:12px 14px;box-sizing:border-box}',
      '#tm-ov .nx .k{font-size:10px;letter-spacing:2px;font-weight:700;color:#777;padding-bottom:6px;margin-bottom:8px;border-bottom:1px solid #252525}',
      '#tm-ov .nx .body{font-size:14px;line-height:1.55;color:#ddd;max-height:30vh;overflow:auto}',
      '#tm-ov .btns{display:flex;gap:10px;margin-top:auto;padding-top:18px;width:100%}',
      '#tm-ov .btns button{flex:1;height:58px;border-radius:14px;font-family:"Bebas Neue",sans-serif;font-size:22px;letter-spacing:2px;border:1px solid #333;background:#161616;color:#f0f0f0;cursor:pointer}',
      '#tm-ov .btns .pri{background:var(--tm-c);color:#000;border-color:var(--tm-c);flex:2}',
      '#tm-ov .pnav{width:100%;display:flex;align-items:center;gap:8px;margin-top:14px;background:#161616;border:1px solid #252525;border-radius:14px;padding:6px}',
      '#tm-ov .pnav button{width:40px;height:40px;flex:none;border-radius:10px;border:1px solid #333;background:#0b0b0b;color:#f0f0f0;font-size:22px;cursor:pointer}',
      '#tm-ov .pnav button:disabled{opacity:.25}',
      '#tm-ov .pnav .pn{flex:1;min-width:0;text-align:center}',
      '#tm-ov .pnav .pn b{display:block;font-size:10px;letter-spacing:2px;color:var(--accent)}',
      '#tm-ov .pnav .pn span{display:block;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#tm-ov .hint{font-size:11px;color:#777;margin-top:10px;text-align:center}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ---------- moteur ----------
  var st = null, raf = null, ac = null, wl = null;
  var R = 126, C = 2 * Math.PI * R;
  var TEAL = '#2DD4BF', ORANGE = '#ff8c47', GREY = '#5b6470', GREEN = '#2ecc71';

  function beep(f, d) {
    if (!st || !st.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      var o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f; o.type = 'sine'; o.connect(g); g.connect(ac.destination);
      var t0 = ac.currentTime; g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.5, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
      o.start(t0); o.stop(t0 + d + .02);
    } catch (e) {}
  }
  function lock() { try { if (navigator.wakeLock && !wl) navigator.wakeLock.request('screen').then(function (w) { wl = w; }).catch(function () {}); } catch (e) {} }
  function unlock() { try { if (wl) wl.release(); } catch (e) {} wl = null; }

  function now() { return Date.now() / 1000; }
  function elapsed() { return st.acc + (st.running ? now() - st.t0 : 0); }

  window.openBlockTimer = function (id, idx) {
    var o = specs[id]; if (!o) return;
    css();
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {}
    var snd = st ? st.sound : true;
    st = { id: id, parts: o.parts, title: o.title, sound: snd };
    var ov = document.getElementById('tm-ov'); if (!ov) { ov = document.createElement('div'); ov.id = 'tm-ov'; document.body.appendChild(ov); }
    ov.style.display = 'flex';
    document.documentElement.style.overflow = 'hidden';
    setPart(idx || 0);
  };
  function setPart(i) {
    if (raf) clearInterval(raf); raf = null; unlock();
    var p = st.parts[i];
    st.pi = i; st.sp = p; st.body = p.html; st.running = false; st.acc = 0; st.t0 = 0; st.pre = 3; st.rounds = 0; st.done = false; st.lastBeep = null; st._rest = false;
    st.total = p.kind === 'int' ? p.phases.reduce(function (a, q) { return a + q.d; }, 0) : 0;
    st.rs = { set: 1, phase: 'ready', t0: 0, rest: p.rest || 0 };
    shell(); draw();
    var ov = document.getElementById('tm-ov'); if (ov) ov.scrollTop = 0;
  }

  function close() {
    if (raf) clearInterval(raf); raf = null; unlock();
    var ov = document.getElementById('tm-ov'); if (ov) { ov.style.display = 'none'; ov.innerHTML = ''; }
    document.documentElement.style.overflow = '';
    st = null;
  }

  function shell() {
    var sp = st.sp, ov = document.getElementById('tm-ov');
    var nPh = sp.kind === 'int' ? sp.phases.filter(function (p) { return !p.rest; }).length : sp.kind === 'rest' ? sp.n : 0;
    ov.innerHTML = '<div class="tm">' +
      '<div class="top"><button class="x" data-a="close" aria-label="Fermer">✕</button><div class="lab"><div class="k"></div><div class="t"></div></div><button class="x' + (st.sound ? '' : ' off') + '" data-a="snd" aria-label="Son">' + (st.sound ? '🔊' : '🔇') + '</button></div>' +
      (st.parts.length > 1 ? '<div class="pnav"><button data-a="prev"' + (st.pi ? '' : ' disabled') + '>‹</button><div class="pn"><b>PARTIE ' + (st.pi + 1) + ' / ' + st.parts.length + '</b><span></span></div><button data-a="next"' + (st.pi < st.parts.length - 1 ? '' : ' disabled') + '>›</button></div>' : '') +
      '<div class="ring"><svg viewBox="0 0 280 280"><circle cx="140" cy="140" r="' + R + '" stroke="#1f1f1f" stroke-width="12" fill="none"/><circle class="arc" cx="140" cy="140" r="' + R + '" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '"/></svg>' +
      '<div class="c"><div class="ph"></div><div class="v">0:00</div><div class="s"></div></div></div>' +
      (nPh > 1 && nPh <= 40 ? '<div class="sets">' + new Array(nPh + 1).join('<i></i>') + '</div>' : '') +
      (sp.kind === 'down' ? '<div class="cnt"><button data-a="minus">−</button><div class="n"><span>0</span><small>ROUNDS</small></div><button class="p" data-a="plus">+</button></div>' : '') +
      (st.body ? '<div class="nx"><div class="k">' + (st.parts.length > 1 ? 'CETTE PARTIE' : 'LE BLOC') + '</div><div class="body">' + st.body + '</div></div>' : '') +
      '<div class="btns"></div><div class="hint"></div></div>';
    ov.querySelector('.lab .k').textContent = st.title;
    ov.querySelector('.lab .t').textContent = sp.label;
    var pn = ov.querySelector('.pnav .pn span'); if (pn) pn.textContent = sp.name || '';
    ov.onclick = function (e) {
      var b = e.target.closest('[data-a]'); if (!b || !st) return;
      var a = b.getAttribute('data-a');
      if (a === 'close') return close();
      if (a === 'snd') { st.sound = !st.sound; b.textContent = st.sound ? '🔊' : '🔇'; b.classList.toggle('off', !st.sound); return; }
      if (a === 'plus') { st.rounds++; return paintRounds(); }
      if (a === 'minus') { st.rounds = Math.max(0, st.rounds - 1); return paintRounds(); }
      if (a === 'play') return toggle();
      if (a === 'reset') return reset();
      if (a === 'skip') return skip();
      if (a === 'finish') return finish();
      if (a === 'setdone') return restSetDone();
      if (a === 'skiprest') return restNext();
      if (a === 'plus15') { if (st.rs && st.rs.phase === 'rest') { st.rs.rest += 15; draw(); } return; }
      if (a === 'next' && st.pi < st.parts.length - 1) return setPart(st.pi + 1);
      if (a === 'prev' && st.pi > 0) return setPart(st.pi - 1);
    };
    buttons();
  }
  function paintRounds() { var n = document.querySelector('#tm-ov .cnt .n span'); if (n) n.textContent = st.rounds; }

  function buttons() {
    var b = document.querySelector('#tm-ov .btns'), h = document.querySelector('#tm-ov .hint'); if (!b) return;
    var started = st.running || st.acc > 0 || st.pre < 3;
    if (st.sp.kind === 'rest' && !st.done) {
      var rs = st.rs, last = rs.set >= st.sp.n;
      if (rs.phase === 'ready') {
        b.innerHTML = '<button class="pri" data-a="play">▶ GO · SET 1</button>';
        h.textContent = 'Appuie sur « Série finie » à la fin de chaque série : le repos démarre tout de suite.';
      } else if (rs.phase === 'work') {
        b.innerHTML = '<button data-a="reset" aria-label="Recommencer">↺</button><button class="pri" data-a="setdone">' + (last ? '✓ DERNIÈRE SÉRIE FINIE' : '✓ SÉRIE FINIE · REPOS') + '</button>';
        h.textContent = 'Écran maintenu allumé pendant le timer';
      } else {
        b.innerHTML = '<button data-a="plus15">+15″</button><button class="pri" data-a="skiprest">⏭ GO SET ' + (rs.set + 1) + '</button>';
        h.textContent = 'Bip à 3-2-1, puis le chrono de la série suivante démarre.';
      }
      return;
    }
    if (st.done) {
      var hasNext = st.pi < st.parts.length - 1;
      b.innerHTML = '<button data-a="reset"' + (hasNext ? ' aria-label="Recommencer">↺' : '>↺ RECOMMENCER') + '</button>' + (hasNext ? '<button class="pri" data-a="next">PARTIE SUIVANTE ›</button>' : '');
      h.textContent = st.sp.kind === 'up' ? 'Le timer n’enregistre rien : saisis ton score dans « Mon score ».' : '';
      return;
    }
    var play = st.running ? '❚❚ PAUSE' : (started ? '▶ REPRENDRE' : '▶ GO');
    var third = st.sp.kind === 'int' ? '<button data-a="skip" aria-label="Suivant">⏭</button>' : (st.sp.kind === 'up' ? '<button data-a="finish">✓ FINI</button>' : '');
    b.innerHTML = '<button data-a="reset" aria-label="Recommencer">↺</button><button class="pri" data-a="play">' + play + '</button>' + third;
    h.textContent = started ? 'Écran maintenu allumé pendant le timer' : 'Décompte 3-2-1 avant le départ';
  }

  function toggle() {
    if (st.done) return;
    if (st.sp.kind === 'rest') {
      if (st.rs.phase === 'ready') { st.rs.phase = 'work'; st.rs.t0 = now(); st.running = true; lock(); beep(990, .4); loop(); buttons(); }
      return;
    }
    if (st.running) { st.acc = elapsed(); st.running = false; unlock(); }
    else { st.t0 = now(); st.running = true; lock(); loop(); }
    buttons();
  }
  function reset() {
    if (st.sp.kind === 'rest') st.rs = { set: 1, phase: 'ready', t0: 0, rest: st.sp.rest };
    st.running = false; st.acc = 0; st.pre = 3; st.done = false; st.rounds = 0; st.lastBeep = null; unlock();
    if (raf) clearInterval(raf); raf = null;
    paintRounds(); buttons(); draw();
  }
  // ---- séries avec repos ----
  function restSetDone() {
    var rs = st.rs; if (!rs || rs.phase !== 'work') return;
    if (rs.set >= st.sp.n) { st.done = true; st.running = false; unlock(); beep(880, .8); buttons(); draw(); return; }
    rs.phase = 'rest'; rs.t0 = now(); rs.rest = st.sp.rest; st.lastBeep = null; beep(520, .4);
    buttons(); draw();
  }
  function restNext() {
    var rs = st.rs; if (!rs || rs.phase !== 'rest') return;
    rs.set++; rs.phase = 'work'; rs.t0 = now(); st.lastBeep = null; beep(990, .4);
    buttons(); draw();
  }
  function finish() { st.acc = elapsed(); st.running = false; st.done = true; unlock(); beep(880, .6); buttons(); draw(); }
  function skip() {
    var e = elapsed() - 3, acc = 0, ph = st.sp.phases;
    if (e < 0) { st.acc += -e + 0.001; if (st.running) { st.acc = elapsed(); st.t0 = now(); } return draw(); }
    for (var i = 0; i < ph.length; i++) { acc += ph[i].d; if (e < acc) { st.acc += acc - e + 0.001; if (st.running) { st.acc = elapsed(); st.t0 = now(); } break; } }
    draw();
  }

  function loop() { if (raf) clearInterval(raf); draw(); raf = setInterval(function () { if (!st || !st.running) { clearInterval(raf); raf = null; return; } draw(); }, 200); }

  // l'état affiché découle uniquement du temps écoulé (3 s de décompte compris)
  function draw() {
    if (!st) return;
    var ov = document.getElementById('tm-ov'); if (!ov) return;
    var sp = st.sp, E = elapsed(), e = E - 3;
    var arc = ov.querySelector('.arc'), v = ov.querySelector('.v'), ph = ov.querySelector('.ph'), s = ov.querySelector('.s');
    var col = TEAL, p = 0, big = '0:00', top = '', sub = '', beepKey = null, curWork = -1;

    if (sp.kind === 'rest') {
      var rs = st.rs, n2 = sp.n, tt = now() - rs.t0;
      if (st.done) { top = '✓ TERMINÉ'; col = GREEN; p = 1; big = String(n2) + '/' + n2; sub = sp.label; curWork = 999; }
      else if (rs.phase === 'ready') { top = 'PRÊT'; col = GREY; p = 1; big = fmt(sp.rest); sub = 'SET 1 / ' + n2 + ' · REPOS ' + fmt(sp.rest); curWork = 0; }
      else if (rs.phase === 'work') { top = 'SET ' + rs.set + ' / ' + n2; col = TEAL; p = (tt % 60) / 60; big = fmt(Math.floor(tt)); sub = 'EN COURS'; curWork = rs.set - 1; st._rest = false; }
      else {
        var left = rs.rest - tt;
        if (left <= 0) { restNext(); return; }
        var rr = Math.ceil(left);
        if (rr <= 3) { beepKey = 'r' + rs.set + ':' + rr; if (st.lastBeep !== beepKey) { st.lastBeep = beepKey; beep(660, .15); } }
        top = 'REPOS'; col = GREY; p = left / rs.rest; big = fmt(rr); sub = 'SET ' + (rs.set + 1) + ' / ' + n2 + ' ENSUITE'; curWork = rs.set; st._rest = true;
      }
    } else if (!st.done && E < 3 && (st.running || st.acc > 0)) {
      var n = Math.ceil(3 - E); big = String(n); top = 'PRÊT'; col = GREY; p = (3 - E) / 3; beepKey = 'pre' + n;
      if (st.lastBeep !== beepKey) { st.lastBeep = beepKey; beep(660, .15); }
      sub = sp.kind === 'int' ? sp.phases[0].lab : '';
    } else if (!st.running && st.acc === 0 && !st.done) {
      top = 'PRÊT'; col = GREY; p = 1;
      big = sp.kind === 'int' ? fmt(sp.phases[0].d) : sp.kind === 'down' ? fmt(sp.dur) : '0:00';
      sub = sp.kind === 'int' ? sp.phases[0].lab : sp.kind === 'up' && sp.cap ? 'CAP ' + fmt(sp.cap) : sp.kind === 'down' ? 'SUR ' + fmt(sp.dur) : '';
    } else if (sp.kind === 'int') {
      var acc = 0, i, cur = null, rem = 0;
      for (i = 0; i < sp.phases.length; i++) { if (e < acc + sp.phases[i].d) { cur = sp.phases[i]; rem = acc + sp.phases[i].d - e; break; } acc += sp.phases[i].d; }
      var wi = 0; for (var j = 0; j < i && j < sp.phases.length; j++) if (!sp.phases[j].rest) wi++;
      if (!cur || st.done) {
        if (!st.done) { st.done = true; st.running = false; st.acc = elapsed(); unlock(); beep(880, .8); buttons(); }
        big = fmt(st.total); top = '✓ TERMINÉ'; col = GREEN; p = 1; sub = sp.short; curWork = 999;
      } else {
        curWork = wi; st._rest = !!cur.rest;
        col = cur.rest ? GREY : cur.hot ? ORANGE : TEAL;
        big = fmt(Math.ceil(rem)); p = rem / cur.d;
        top = cur.rest ? 'REPOS' : (cur.hot ? 'EFFORT' : 'EN COURS');
        sub = cur.rest ? (sp.phases[i + 1] ? sp.phases[i + 1].lab + ' ENSUITE' : '') : cur.lab;
        var r = Math.ceil(rem);
        if (r <= 3 && r >= 1) { beepKey = i + ':' + r; if (st.lastBeep !== beepKey) { st.lastBeep = beepKey; beep(660, .15); } }
        if (rem > cur.d - 0.25 && st.lastBeep !== 'go' + i) { st.lastBeep = 'go' + i; beep(cur.rest ? 520 : 990, .4); }
      }
    } else if (sp.kind === 'down') {
      var left = sp.dur - e;
      if (left <= 0 || st.done) {
        if (!st.done) { st.done = true; st.running = false; st.acc = elapsed(); unlock(); beep(880, .8); buttons(); }
        big = '0:00'; top = '✓ TERMINÉ'; col = GREEN; p = 0; sub = 'SUR ' + fmt(sp.dur);
      } else {
        big = fmt(Math.ceil(left)); top = 'TEMPS RESTANT'; p = left / sp.dur; sub = 'SUR ' + fmt(sp.dur);
        if (left <= 3) { beepKey = 'd' + Math.ceil(left); if (st.lastBeep !== beepKey) { st.lastBeep = beepKey; beep(660, .15); } }
        if (e < 0.25 && st.lastBeep !== 'go') { st.lastBeep = 'go'; beep(990, .4); }
      }
    } else {
      var cap = sp.cap, t = Math.max(0, e);
      if (cap && t >= cap && !st.done) { st.done = true; st.running = false; st.acc = 3 + cap; unlock(); beep(880, .8); buttons(); t = cap; }
      if (st.done) { t = Math.min(Math.max(0, st.acc - 3), cap || 1e9); top = cap && t >= cap ? 'CAP ATTEINT' : '✓ TERMINÉ'; col = cap && t >= cap ? ORANGE : GREEN; }
      else { top = 'EN COURS'; if (e < 0.25 && st.lastBeep !== 'go') { st.lastBeep = 'go'; beep(990, .4); } }
      big = fmt(Math.floor(t)); p = cap ? Math.min(1, t / cap) : (t % 60) / 60; sub = cap ? 'CAP ' + fmt(cap) : '';
    }

    arc.setAttribute('stroke', col);
    arc.setAttribute('stroke-dashoffset', String(C * (1 - Math.max(0, Math.min(1, p)))));
    ov.style.setProperty('--tm-c', col === GREY || col === GREEN ? TEAL : col);
    v.textContent = big; ph.textContent = top; ph.style.color = col === GREY ? '#888' : col; s.textContent = sub;
    var bars = ov.querySelectorAll('.sets i');
    if (bars.length) {
      if (curWork < 0) curWork = 0;
      for (var k = 0; k < bars.length; k++) bars[k].className = k < curWork ? 'on' : (k === curWork && !st._rest ? 'cur' : '');
      if (curWork === 999) for (k = 0; k < bars.length; k++) bars[k].className = 'on';
    }
  }

  document.addEventListener('keydown', function (e) { if (st && e.key === 'Escape') close(); });
  document.addEventListener('visibilitychange', function () { if (st && st.running && document.visibilityState === 'visible') lock(); });

  window.__blockTimerParse = parse; window.__blockTimerParts = parseParts; // pour les tests
})();
