/* ============================================================
 * Zones dans les séances : « allure EF », « allure tempo », « allure seuil »…
 *
 * Dès qu'une ligne d'une séance contient « allure <zone> » (majuscules, accents
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
  var PC_RUN = { Z1: [45, 78], Z2: [78, 88], Z3: [88, 93], Z4: [93, 103], Z5: [103, null] };
  var MV = { row: 'Row', ski: 'Ski Erg', bike: 'Bike Erg', assault: 'Assault Bike', echo: 'Echo Bike', run: 'Run' };
  var LABEL = { row: 'Row', ski: 'Ski', bike: 'Bike Erg', assault: 'Assault', echo: 'Echo', velo: 'Vélo', run: 'Course' };

  var data = { tests: [], ov: [], ready: false };

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
    var m = t.match(/allure[\s:\-–]*([a-z0-9₂ .]{1,30})/);
    if (!m) return null;
    var w = m[1].replace(/\./g, '');
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
    if (!MV[mod] || typeof movements === 'undefined' || typeof myPRs === 'undefined') return null;
    var mv = (movements || []).find(function (m) { return m.name === MV[mod]; });
    if (!mv) return null;
    var fmt = mod === 'run' ? 'vitessecritique' : 'puissancecritique';
    var l = (myPRs[mv.id] || []).filter(function (p) { return String(p.format || '').toLowerCase().replace(/\s+/g, '') === fmt; });
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
    var b = bounds(zone, mod);
    var head = '<b>' + zone + ' · ' + Z[zone].n + '</b>';
    if (!b) {
      return chip(head + ' · RPE ' + Z[zone].rpe + ' <span style="opacity:.75">· pas encore de profilage ' + (mod === 'run' ? 'ni de VC' : 'ni de PC') + ' en ' + (LABEL[mod] || 'course') + '</span>', true);
    }
    var v, sub = '';
    if (b.unit === 'km/h') {
      v = b.hi == null ? '> ' + fr(b.lo, 1) + ' km/h' : fr(b.lo, 1) + ' – ' + fr(b.hi, 1) + ' km/h';
      sub = b.hi == null ? '< ' + mmss(3600 / b.lo) + ' /km' : mmss(3600 / b.hi) + ' – ' + mmss(3600 / b.lo) + ' /km';
    } else {
      v = b.lo == null ? '< ' + Math.round(b.hi) + ' W' : b.hi == null ? '> ' + Math.round(b.lo) + ' W' : Math.round(b.lo) + ' – ' + Math.round(b.hi) + ' W';
      if (mod === 'row' || mod === 'ski') {
        sub = b.lo == null ? '> ' + mmss(pace500(b.hi)) + ' /500m' : b.hi == null ? '< ' + mmss(pace500(b.lo)) + ' /500m' : mmss(pace500(b.hi)) + ' – ' + mmss(pace500(b.lo)) + ' /500m';
      }
    }
    var fc = '';
    if (b.fcAt) {
      if (b.lo == null) fc = 'FC < ' + b.fcAt(b.hi);
      else if (zone === 'Z5') fc = 'FC > ' + b.fcAt(b.lo);
      else fc = 'FC ' + b.fcAt(b.lo) + '–' + b.fcAt(b.hi);
    }
    var parts = [head, v, sub, 'RPE ' + Z[zone].rpe, fc].filter(Boolean);
    return chip(parts.join(' · ') + ' <span style="opacity:.6;font-weight:400;font-size:11px">(' + b.src + ')</span>');
  }
  function chip(inner, muted) {
    return ' <span class="allure-zone" style="display:inline-block;margin:2px 0;background:' + (muted ? 'rgba(255,255,255,.06)' : 'rgba(232,255,71,.15)') +
      ';color:' + (muted ? 'var(--muted)' : 'var(--accent)') + ';padding:2px 8px;border-radius:6px;font-size:12.5px;line-height:1.45">' + inner + '</span>';
  }

  /* ---------- application au contenu rendu (lignes séparées par <br>) ---------- */
  function apply(html) {
    if (!html || !/allure/i.test(strip(html.replace(/<[^>]+>/g, ' ')))) return html;
    var plain = strip(html.replace(/<[^>]+>/g, ' '));
    var defMod = modOf(plain) || 'run';
    return html.split(/(<br>)/).map(function (seg) {
      if (seg === '<br>' || seg.indexOf('allure-zone') >= 0) return seg;
      var txt = seg.replace(/<[^>]+>/g, ' ');
      var z = zoneOf(txt);
      if (!z) return seg;
      return seg + rangeHTML(z, modOf(txt) || defMod);
    }).join('');
  }

  async function load() {
    try {
      if (typeof sb === 'undefined' || typeof currentUser === 'undefined' || !currentUser) return;
      var id = currentUser.id;
      var r = await Promise.all([
        sb.from('endurance_tests').select('kind,modality,test_date,s1,s2,fc1,fc2,created_at').eq('athlete_id', id),
        sb.from('pc_zone_overrides').select('modality,z2_hi').eq('athlete_id', id)
      ]);
      data.tests = (r[0] && r[0].data) || [];
      data.ov = (r[1] && r[1].data) || [];
      data.ready = true;
    } catch (e) { /* zones indisponibles : la séance s'affiche sans plage */ }
  }

  window.udtAllure = { apply: apply, load: load, zoneOf: zoneOf, modOf: modOf };
})();
