/* ============================================================
 * Zones dans les séances : « allure EF », « puissance seuil », « allure tempo »…
 *
 * Dès qu'une ligne d'une séance contient « allure <zone> », « Z1…Z5 <modalité> »
 * (ex. Z2 RUN, Z3 ROW) ou « endurance fondamentale » (majuscules, accents
 * et tirets indifférents), l'app affiche la plage personnelle de l'athlète :
 * watts (et /500m) sur les ergos, vitesse et allure en course, RPE visé et FC
 * quand un profilage la fournit.
 *
 * Source des zones, par modalité :
 *   1. dernier profilage lactate  (public.endurance_tests, kind = 'lactate')
 *   2. dernier profilage RPE      (kind = 'rpe'), associé à la PC / VC
 *   3. PC / VC de référence       (PR auto « Puissance / Vitesse Critique »,
 *                                  issue du test standardisé ou, à défaut, des PR 3′ / 12′)
 * La course n'a pas de profilage lactate / RPE : elle passe par la VC.
 * Les formules %|…|…| existantes ne sont pas touchées.
 * ============================================================ */
(function () {
  'use strict';

  var Z = {
    Z1: { n: 'Récupération active', rpe: '1–2' },
    Z2: { n: 'Endurance fondamentale', rpe: '2–3' },
    Z3: { n: 'Tempo', rpe: '4–5' },
    Z4: { n: 'Seuil', rpe: '6–7' },
    Z5: { n: 'VO₂max', rpe: '8–9' }
  };
  /* Bornes PC / VC (identiques à l'outil Profil PC / VC) */
  var PC_ERG = { Z1: [45, 60], Z2: [60, 75], Z3: [75, 88], Z4: [88, 103], Z5: [103, null] };
  var PC_RUN = { Z1: [45, 72], Z2: [72, 80], Z3: [80, 88], Z4: [88, 100], Z5: [100, null] };  // S1 ≈ 82 % VC, MLSS ≈ 93 % VC
  var MV = { row: 'Row', ski: 'Ski Erg', bike: 'Bike Erg', assault: 'Assault Bike', echo: 'Echo Bike', run: 'Run' };
  var LABEL = { row: 'Row', ski: 'Ski', bike: 'Bike Erg', assault: 'Assault', echo: 'Echo', velo: 'Vélo', run: 'Course' };

  /* données par athlète : le coach qui ouvre l'espace d'un athlète voit les zones de CET athlète */
  var cache = {};          // id → { tests, ov, prs }
  var active = null;       // athlète dont on affiche les zones
  var ctxMod = null;       // modalité lue dans le titre de la séance en cours de rendu
  var data = { tests: [], ov: [], prs: null, ready: false };
  function setActive(id) { active = id; data = cache[id] || { tests: [], ov: [], prs: null, ready: false }; }

  function strip(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function r5(x) { return Math.round(x / 5) * 5; }
  function fr(v, d) { return Number(v).toFixed(d).replace('.', ','); }
  function mmss(s) { if (!(s > 0) || !isFinite(s)) return '–'; s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  var pace500 = function (w) { return w > 0 ? 500 * Math.cbrt(2.8 / w) : null; };

  /* ---------- lecture de la ligne ---------- */
  function zoneOf(txt) {
    var t = strip(txt);
    var m = t.match(/(?:allure|puissance|intensite)[\s:\-–]*([a-z0-9₂ .]{1,30})/);
    var w = m ? m[1].replace(/\./g, '') : '';
    var z0 = zoneWord(w);
    if (z0) return z0;
    /* écriture courte : « Z2 RUN », « Z3 ROW », « Z2 BIKE »… */
    var zc = t.match(/(?:^|[^a-z0-9|%])z ?([1-5])(?![0-9a-z])/);
    if (zc) return 'Z' + zc[1];
    /* nom de zone écrit seul (sans « allure ») : sans ambiguïté uniquement */
    if (/endurance fondamentale/.test(t)) return 'Z2';
    if (/recuperation active/.test(t)) return 'Z1';
    return null;
  }
  function zoneWord(w) {
    if (!w) return null;
    if (/^(z ?1\b|recup|recuperation)/.test(w)) return 'Z1';
    if (/^(z ?2\b|ef\b|endurance|fondamentale|fonda\b|e\.f)/.test(w)) return 'Z2';
    if (/^(z ?3\b|tempo)/.test(w)) return 'Z3';
    if (/^(z ?4\b|seuil|threshold|sv2|s2\b)/.test(w)) return 'Z4';
    if (/^(z ?5\b|vo2|vo₂|vma|pma)/.test(w)) return 'Z5';
    return null;
  }
  function modOf(txt) {
    var t = strip(txt);
    if (/\b(row|rameur|rowing)\b/.test(t)) return 'row';
    if (/\bski\b|skierg|ski erg/.test(t)) return 'ski';
    if (/assault|air ?bike|airbike/.test(t)) return 'assault';
    if (/\becho\b/.test(t)) return 'echo';
    if (/bike ?erg|bikeerg/.test(t)) return 'bike';
    if (/\b(velo|cyclisme|home ?trainer|vtt)\b/.test(t)) return 'velo';
    if (/\bbike\b/.test(t)) return 'bike';
    if (/\b(run|course|cap|footing|running|jog|piste|tapis)\b/.test(t)) return 'run';
    return null;
  }

  /* ---------- sources ---------- */
  function latestTest(kind, mod) {
    var l = data.tests.filter(function (t) { return t.kind === kind && t.modality === mod && +t.s1 > 0 && +t.s2 > +t.s1; });
    l.sort(function (a, b) { return String(b.test_date).localeCompare(String(a.test_date)) || String(b.created_at).localeCompare(String(a.created_at)); });
    return l[0] || null;
  }
  function critical(mod) {
    if (!MV[mod] || typeof movements === 'undefined') return null;
    var prs = data.prs || (typeof myPRs !== 'undefined' ? myPRs : null);
    if (!prs) return null;
    var mv = (movements || []).find(function (m) { return m.name === MV[mod]; });
    if (!mv) return null;
    var fmt = mod === 'run' ? 'vitessecritique' : 'puissancecritique';
    var l = (prs[mv.id] || []).filter(function (p) { return String(p.format || '').toLowerCase().replace(/\s+/g, '') === fmt; });
    if (!l.length) return null;
    var auto = l.filter(function (p) { return /^auto:cp/.test(p.note || ''); });
    var p = (auto.length ? auto : l).reduce(function (a, b) { return String(b.recorded_at) > String(a.recorded_at) ? b : a; });
    return { v: +p.value, date: p.recorded_at, std: /\|std\|/.test(p.note || '') };
  }
  function bounds(zone, mod) {
    /* 1 · lactate, 2 · RPE */
    var t = latestTest('lactate', mod) || latestTest('rpe', mod);
    if (t) {
      var s1 = +t.s1, s2 = +t.s2;
      var b = [r5(s1 * 0.65), r5(s1), r5(s2 * 0.9), r5(s2), r5(s2 * 1.05), r5(s2 * 1.5)];
      var lohi = { Z1: [null, b[0]], Z2: [b[0], b[1]], Z3: [b[1], b[2]], Z4: [b[2], b[4]], Z5: [b[4], b[5]] }[zone];
      var f1 = +t.fc1, f2 = +t.fc2, fcAt = null;
      if (f1 > 0 && f2 > f1) fcAt = function (w) { return Math.round(f1 + (w - s1) * (f2 - f1) / (s2 - s1)); };
      var ref = t.data && Array.isArray(t.data.fcRef) ? t.data.fcRef.map(function (p) { return [+p[0], +p[1]]; }).sort(function (a, b) { return a[0] - b[0]; }) : null;
      if (ref && ref.length >= 2) fcAt = function (w) {
        var i = 0; while (i < ref.length - 2 && w > ref[i + 1][0]) i++;
        var a = ref[i], b = ref[i + 1]; return Math.round(a[1] + (w - a[0]) * (b[1] - a[1]) / (b[0] - a[0]));
      };
      return { lo: lohi[0], hi: lohi[1], unit: 'W', fcAt: fcAt, src: (t.kind === 'lactate' ? 'profilage lactate' : 'profilage RPE') + ' du ' + dateFR(t.test_date) };
    }
    /* 3 · PC / VC */
    var c = critical(mod);
    if (!c) return null;
    var run = mod === 'run';
    var pct = (run ? PC_RUN : PC_ERG)[zone].slice();
    var o = data.ov.find(function (x) { return x.modality === mod; });
    if (o && +o.z2_hi > 0) {
      var v = Math.min(+o.z2_hi, (run ? PC_RUN : PC_ERG).Z3[1] - 1);
      if (zone === 'Z2') pct[1] = v;
      if (zone === 'Z3') pct[0] = v;
    }
    var lo = c.v * pct[0] / 100, hi = pct[1] ? c.v * pct[1] / 100 : null;
    return { lo: lo, hi: hi, unit: run ? 'km/h' : 'W', fcAt: null,
      src: (run ? 'VC' : 'PC') + ' ' + (run ? fr(c.v, 1) + ' km/h' : Math.round(c.v) + ' W') + (c.std ? ' · test standardisé' : ' · PR 3′/12′') };
  }
  function dateFR(iso) {
    if (!iso) return '';
    var d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  /* ---------- texte de la plage ---------- */
  function rangeHTML(zone, mod) {
    /* Pastille courte : juste l'allure (course) ou la puissance (ergo). Le détail est dans « Mes zones ». */
    var b = bounds(zone, mod);
    if (!b) return chip(mod === 'run' ? 'pas encore de VC en course' : 'pas encore de profil ni de PC en ' + (LABEL[mod] || mod), true);
    var v;
    if (b.unit === 'km/h') {
      v = b.hi == null ? '&lt; ' + mmss(3600 / b.lo) + ' /km' : mmss(3600 / b.lo) + ' – ' + mmss(3600 / b.hi) + ' /km';
    } else if (mod === 'row' || mod === 'ski') {
      /* watts en premier, allure /500m à côté */
      v = b.lo == null ? '&lt; ' + Math.round(b.hi) + ' W · &gt; ' + mmss(pace500(b.hi)) + ' /500m'
        : b.hi == null ? '&gt; ' + Math.round(b.lo) + ' W · &lt; ' + mmss(pace500(b.lo)) + ' /500m'
        : Math.round(b.lo) + ' – ' + Math.round(b.hi) + ' W · ' + mmss(pace500(b.lo)) + ' – ' + mmss(pace500(b.hi)) + ' /500m';
    } else {
      v = b.lo == null ? '&lt; ' + Math.round(b.hi) + ' W' : b.hi == null ? '&gt; ' + Math.round(b.lo) + ' W' : Math.round(b.lo) + ' – ' + Math.round(b.hi) + ' W';
    }
    return chip(v);
  }
  function chip(inner, muted) {
    return ' <span class="allure-zone" style="display:inline-block;margin:2px 0;background:' + (muted ? 'rgba(255,255,255,.06)' : 'color-mix(in srgb, var(--accent) 15%, transparent)') +
      ';color:' + (muted ? 'var(--muted)' : 'var(--accent)') + ';padding:1px 8px;border-radius:6px;font-size:12.5px;font-weight:700;line-height:1.45">' + inner + '</span>';
  }

  /* ---------- application au contenu rendu (lignes séparées par <br>) ---------- */
  function apply(html) {
    if (!html || !/allure|puissance|intensite|endurance fondamentale|recuperation active|(?:^|[^a-z0-9|%])z ?[1-5](?![0-9a-z])/i.test(strip(html.replace(/<[^>]+>/g, ' ')))) return html;
    var plain = strip(html.replace(/<[^>]+>/g, ' '));
    var defMod = modOf(plain) || ctxMod || 'run';
    return html.split(/(<br>)/).map(function (seg) {
      if (seg === '<br>' || seg.indexOf('allure-zone') >= 0) return seg;
      var txt = seg.replace(/<[^>]+>/g, ' ');
      var z = zoneOf(txt);
      if (!z) return seg;
      return seg + rangeHTML(z, modOf(txt) || defMod);
    }).join('');
  }

  async function fetchFor(id, withPrs) {
    var q = [
      sb.from('endurance_tests').select('kind,modality,test_date,s1,s2,fc1,fc2,created_at,data').eq('athlete_id', id),
      sb.from('pc_zone_overrides').select('modality,z2_hi').eq('athlete_id', id)
    ];
    if (withPrs) q.push(sb.from('athlete_prs').select('movement_id,format,value,recorded_at,note').eq('athlete_id', id));
    var r = await Promise.all(q);
    var d = { tests: (r[0] && r[0].data) || [], ov: (r[1] && r[1].data) || [], prs: null, ready: true };
    if (withPrs) {
      d.prs = {};
      ((r[2] && r[2].data) || []).forEach(function (p) { (d.prs[p.movement_id] = d.prs[p.movement_id] || []).push(p); });
    }
    cache[id] = d;
    return d;
  }
  /* zones de l'utilisateur connecté (ses PR sont déjà dans myPRs) */
  async function load() {
    try {
      if (typeof sb === 'undefined' || typeof currentUser === 'undefined' || !currentUser) return;
      await fetchFor(currentUser.id, false);
      setActive(currentUser.id);
    } catch (e) { /* zones indisponibles : la séance s'affiche sans plage */ }
  }
  /* à appeler avant de rendre une séance : bascule sur l'athlète de la séance */
  async function use(id, title) {
    ctxMod = modOf(title || '');
    try {
      if (typeof currentUser === 'undefined' || !currentUser) return;
      id = id || currentUser.id;
      if (!cache[id]) await fetchFor(id, id !== currentUser.id);
      setActive(id);
    } catch (e) { }
  }

  /* ---------- onglet « Mes zones » sous les blocs ENGINE / RUN ---------- */
  var ORDER = ['run', 'row', 'ski', 'bike', 'assault', 'echo'];
  function modsOf(s) {
    var t = strip(String((s.title || '') + ' ' + (s.content || '')).replace(/<[^>]+>/g, ' '));
    var found = [];
    var tests = {
      row: /\b(row|rameur|rowing)\b/, ski: /\bski\b|skierg/, assault: /assault|air ?bike/, echo: /\becho\b/,
      bike: /bike ?erg|\bbike\b/, run: /\b(run|course|footing|running|piste|tapis)\b/
    };
    ORDER.forEach(function (m) { if (tests[m].test(t)) found.push(m); });
    if (String(s.type).toLowerCase() === 'run' && found.indexOf('run') < 0) found.unshift('run');
    return found.slice(0, 3);
  }
  function zoneRow(zone, mod) {
    var b = bounds(zone, mod);
    if (!b) return '';
    var v, sub = '';
    if (b.unit === 'km/h') {
      // allure en premier (teal), dans le même ordre que la vitesse : vitesse basse ↔ allure lente
      v = b.hi == null ? '&lt; ' + mmss(3600 / b.lo) + ' /km' : mmss(3600 / b.lo) + ' – ' + mmss(3600 / b.hi) + ' /km';
      sub = b.hi == null ? '&gt; ' + fr(b.lo, 1) + ' km/h' : fr(b.lo, 1) + ' – ' + fr(b.hi, 1) + ' km/h';
    } else {
      v = b.lo == null ? '&lt; ' + Math.round(b.hi) + ' W' : b.hi == null ? '&gt; ' + Math.round(b.lo) + ' W' : Math.round(b.lo) + ' – ' + Math.round(b.hi) + ' W';
      if (mod === 'row' || mod === 'ski') sub = b.lo == null ? '&gt; ' + mmss(pace500(b.hi)) + ' /500m' : b.hi == null ? '&lt; ' + mmss(pace500(b.lo)) + ' /500m' : mmss(pace500(b.hi)) + ' – ' + mmss(pace500(b.lo)) + ' /500m';
    }
    var fc = '';
    if (b.fcAt) fc = b.lo == null ? '&lt; ' + b.fcAt(b.hi) + ' bpm' : zone === 'Z5' ? '&gt; ' + b.fcAt(b.lo) + ' bpm' : b.fcAt(b.lo) + '–' + b.fcAt(b.hi) + ' bpm';
    var ZCOL = { Z1: '#3B8FEA', Z2: '#22B35E', Z3: '#E8C21C', Z4: '#F58A1F', Z5: '#E5483B' };
    return '<div style="display:flex;gap:8px;align-items:baseline;padding:6px 0 6px 8px;border-top:1px solid rgba(255,255,255,.06);border-left:3px solid ' + ZCOL[zone] + '">' +
      '<span style="min-width:150px;font-weight:700;font-size:12px">' + zone + ' · ' + Z[zone].n + '</span>' +
      '<span style="flex:1;font-size:12.5px;color:' + (b.unit === 'km/h' ? '#2dd4bf' : 'var(--accent)') + ';font-weight:700">' + v + (sub ? ' <span style="color:var(--muted);font-weight:400;font-size:11.5px">(' + sub + ')</span>' : '') + '</span>' +
      '<span style="font-size:11px;color:var(--muted);white-space:nowrap">' + (fc ? fc + ' · ' : '') + 'RPE ' + Z[zone].rpe + '</span></div>';
  }
  /* modalités citées dans les formules %|VITESSE / PUISSANCE CRITIQUE|<MOUVEMENT>| */
  function formulaMods(s) {
    var out = [], re = /%\|\s*(vitesse|puissance)\s+critique\s*\|([^|\n<]+)\|/gi, m;
    var txt = String(s.content || '');
    while ((m = re.exec(txt))) {
      var md = modOf(m[2]) || (/vitesse/i.test(m[1]) ? 'run' : null);
      if (md && out.indexOf(md) < 0) out.push(md);
    }
    return out;
  }
  function panel(s) {
    if (!s || s.vbt) return '';
    if (s.athlete_id && cache[s.athlete_id]) setActive(s.athlete_id);
    var isEnd = /^(engine|run)$/i.test(s.type || '');
    var fm = formulaMods(s);
    if (!isEnd && !fm.length) return '';
    var mods = isEnd ? modsOf(s) : fm;
    if (!mods.length) return '';
    var body = mods.map(function (mod) {
      var b = bounds('Z2', mod);
      var head = '<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin:8px 0 2px">' + (LABEL[mod] || mod) +
        (b ? ' <span style="text-transform:none;letter-spacing:0;font-weight:400">· ' + b.src + '</span>' : '') + '</div>';
      if (!b) return head + '<div style="font-size:12px;color:var(--muted);padding:4px 0">' + (mod === 'run' ? 'Pas encore de VC en course' : 'Pas encore de profilage (lactate / RPE) ni de PC en ' + (LABEL[mod] || mod)) + ' : fais le test critique pour voir tes zones.</div>';
      return head + ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map(function (z) { return zoneRow(z, mod); }).join('');
    }).join('');
    return '<details class="zones-panel" onclick="event.stopPropagation()" style="margin-top:10px">' +
      '<summary style="list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#2dd4bf;padding:8px 10px;border:1px solid rgba(45,212,191,.4);border-radius:8px;background:rgba(45,212,191,.08)">' +
      '<span>🎯 Mes zones d\'intensité · ' + mods.map(function (m) { return LABEL[m] || m; }).join(' / ') + '</span><span style="font-size:12px">▾</span></summary>' +
      '<div style="padding:4px 10px 2px">' + body + '</div></details>';
  }

  /* version synchrone pour les vues calendrier (données déjà chargées par use) */
  function ctx(id, title) {
    ctxMod = modOf(title || '');
    id = id || (typeof currentUser !== 'undefined' && currentUser ? currentUser.id : null);
    if (id && cache[id]) setActive(id);
  }

  /* rend fn() avec les zones ET les PR de l'athlète id (puis restaure l'état) */
  function renderAs(id, title, fn) {
    var prevActive = active, prevMod = ctxMod, swapped = false, saved;
    ctx(id, title);
    try {
      var me = typeof currentUser !== 'undefined' && currentUser ? currentUser.id : null;
      if (id && id !== me && cache[id] && cache[id].prs && typeof myPRs !== 'undefined') {
        saved = myPRs; myPRs = cache[id].prs; swapped = true;
      }
      return fn();
    } finally {
      if (swapped) myPRs = saved;
      if (prevActive) setActive(prevActive);
      ctxMod = prevMod;
    }
  }

  /* ---------- comparatif « TES VALEURS » (vue coach, séance perso d'un athlète) ---------- */
  function esc(t) { return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var VAL_SEL = '.allure-zone, span[style*="232,255,71"], span[data-pr-mv]';
  function lineVals(html) {
    var d = document.createElement('div'); d.innerHTML = html;
    var vals = [];
    d.querySelectorAll(VAL_SEL).forEach(function (el) {
      var muted = /pas encore|Entrer/i.test(el.textContent);
      vals.push(muted ? '—' : el.textContent.trim());
      el.remove();
    });
    var label = d.textContent.replace(/\s+/g, ' ').trim();
    return { vals: vals, label: label };
  }
  function compareHtml(s, athleteName) {
    try {
      if (!s || !s.athlete_id || typeof currentUser === 'undefined' || !currentUser || s.athlete_id === currentUser.id) return '';
      if (typeof renderContentWithCharges !== 'function') return '';
      var me = currentUser.id;
      var a = renderAs(s.athlete_id, s.title, function () { return renderContentWithCharges(s.content || ''); });
      var c = renderAs(me, s.title, function () { return renderContentWithCharges(s.content || ''); });
      var la = a.split('<br>'), lc = c.split('<br>');
      if (la.length !== lc.length) return '';
      var rows = [];
      for (var i = 0; i < la.length; i++) {
        var A = lineVals(la[i]);
        if (!A.vals.length) continue;
        var C = lineVals(lc[i]);
        var lab = A.label.length > 42 ? A.label.slice(0, 40) + '…' : A.label;
        rows.push('<tr><td class="rmc-l">' + esc(lab) + '</td><td class="rmc-a">' + A.vals.map(esc).join('<br>') +
          '</td><td class="rmc-c">' + (C.vals.length ? C.vals.map(esc).join('<br>') : '—') + '</td></tr>');
      }
      if (!rows.length) return '';
      var nm = esc(String(athleteName || 'Athlète').split(' ')[0]).toUpperCase();
      var open = (typeof window !== 'undefined' && window.innerWidth >= 760) ? ' open' : '';
      return '<details class="rm-cmp"' + open + '><summary><span class="rmc-t">⇄ TES VALEURS</span><span class="rmc-chev">▾</span></summary>' +
        '<div class="rmc-sub">La même séance, calculée sur toi · vue coach</div>' +
        '<table class="rmc-tab"><tr class="rmc-h"><td>LIGNE</td><td class="rmc-ha">' + nm + '</td><td class="rmc-hc">TES VALEURS</td></tr>' + rows.join('') + '</table></details>';
    } catch (e) { return ''; }
  }

  window.udtAllure = { apply: apply, load: load, use: use, ctx: ctx, renderAs: renderAs, compareHtml: compareHtml, zoneOf: zoneOf, modOf: modOf, panel: panel };
})();
