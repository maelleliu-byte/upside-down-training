/* ============================================================
 * VITRINE DES PROGRAMMATIONS
 * - Présentation de chaque programmation (photo N&B, accroche, pastilles,
 *   description, points forts, aperçu de la semaine, prix, essai gratuit).
 * - Utilisée dans l'app (page « Accès aux programmations ») et par la page
 *   publique programme.html (liens courts /p/<lien>).
 * - Les textes, la photo, l'ordre, le lien court et la visibilité viennent de la
 *   table programmes (colonnes vitrine_*), modifiables dans Admin → Programmations.
 *   Le dictionnaire VITRINE ci-dessous ne sert que de secours si la base ne répond pas.
 * ============================================================ */
(function () {
  'use strict';

  var VITRINE = {
    'training': {
      link: 'training', photo: 'img/progs/training.jpg', pos: '55% 42%',
      title: 'TRAINING', tag: 'Programmation des athlètes Upside Down.',
      chips: ['Cycles structurés', '5 à 6 séances / sem.'],
      desc: "Une programmation accessible à tous, qui permet de progresser grâce à des cycles structurés, avec un accès et un échange direct avec le coach.",
      features: ['Suivi des performances', 'Périodisation structurée', 'Accès direct au coach', 'Groupe WhatsApp dédié']
    },
    'affiliate': {
      link: 'affiliate', photo: 'img/progs/affiliate.jpg', pos: '50% 40%',
      title: 'AFFILIATE', tag: 'Programmation générale CrossFit pour les salles.',
      chips: ['Programmation salle', 'WOD quotidien', '4 niveaux'],
      desc: "Le WOD du jour et les blocs complémentaires, prêts à coacher : tips coach, targets et scaling pour chaque niveau.",
      features: ['WOD quotidien', 'Blocs supplémentaires : haltérophilie, gymnastique', 'Team WOD', 'Coaching tips & targets', 'Suivi des scores']
    },
    'hyrox': {
      link: 'hyrox', photo: 'img/progs/hyrox.jpg', pos: '50% 30%',
      title: 'HYROX', tag: 'Prépare ta prochaine course hybride.',
      chips: ['Solo', 'Force', 'Skill', 'Engine', 'Run'],
      desc: "Une programmation HYROX en solo, pour les athlètes qui préparent une hybrid race ou un HYROX.",
      features: ['Séances course à pied spécifiques', 'Séances engine (ergo spécifique)', 'HYROX simulation', 'Skill', 'Force']
    },
    '3-days-prgm': {
      link: '3days', photo: 'img/progs/3days.jpg', pos: '50% 30%',
      title: '3 DAYS<br><span class="v-c2">PRGM</span>', tag: 'Maintenir ou développer ton fitness en 3 séances par semaine.',
      chips: ['3 séances / sem.', '45 à 75 min', 'Structure fixe', '3 niveaux'],
      desc: "Pour ceux qui veulent conserver ou développer leur fitness global avec un format court et régulier.",
      features: ['Force', 'Workouts', 'Scaling intégré : débutant, intermédiaire, avancé', 'Programmation basée sur les 3 modalités du CrossFit : monostructurel, gymnastique, haltérophilie']
    },
    'running-club': {
      link: 'running', photo: 'img/progs/running.jpg', pos: '50% 38%',
      title: 'RUNNING<br><span class="v-c2">CLUB</span>', tag: 'Courir plus vite, plus longtemps, sans se blesser.',
      chips: ['2 à 4 séances / sem.', '1 à 2 RUN', '1 COMPROMISED RUN', '1 RENFO CAP'],
      desc: "Une programmation running construite sur tes allures : zones calculées depuis ta vitesse critique, tests réguliers pour suivre ta progression.",
      features: ['Séances calibrées', 'Allures personnalisées', 'Renfo spécifique course à pied', "Tests et suivi des allures réguliers tout au long de l'année"]
    },
    'fix-toes-to-bar': {
      link: 't2b', photo: 'img/progs/t2b.jpg', pos: '45% 50%',
      title: 'TOES<br><span class="v-c2">TO BAR</span>', tag: 'Débloquer ton premier toes to bar et le rendre fiable.',
      chips: ['3 séances / sem.', 'Programme ciblé', 'Achat unique'],
      desc: "Programmation spécifique pour débloquer ton premier toes to bar et le rendre fiable.",
      features: ['Mobilité épaule + chaîne postérieure', 'Renfo abdos et fléchisseurs de hanche', 'Technique de kipping et progressions T2B']
    },
    'kids': {
      link: 'kids', photo: 'img/progs/kids.jpg', pos: '30% 40%',
      title: 'KIDS<br><span class="v-c2">&amp; TEENS</span>', tag: 'Bouger, progresser et prendre confiance, de 8 à 16 ans.',
      chips: ['8 – 16 ans', 'Fondamentaux', 'Coordination'],
      desc: "Programmation jeunes athlètes, adaptée au développement de chacun.",
      features: ['Adapté au développement', 'Mouvements fondamentaux', 'Coordination & motricité', 'Suivi de la progression']
    }
  };
  /* ordre de la rangée des programmations et de la vitrine */
  var VITRINE_ORDER = ['training', 'affiliate', 'hyrox', '3-days-prgm', 'running-club', 'fix-toes-to-bar'];
  var VITRINE_HIDDEN = ['kids']; /* présentation prête, pas encore affichée dans la vitrine */
  var TRIAL_DAYS = 7;
  var PUBLIC_BASE = 'https://app.upsidedown-training.fr';

  var DAY = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  var ICON = { wod: '🔥', strength: '🏋️', weightlifting: '⚡', gymnastics: '🤸', renforcement: '💪', bodybuilding: '💎', skill: '🎯', warmup: '🌀', mobility: '🧘', engine: '🚀', run: '🏃' };

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function rgba(hex, a) {
    var h = String(hex || '#999999').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
  }
  function isLight(hex) {
    var h = String(hex || '').replace('#', ''); if (h.length !== 6) return false;
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 170;
  }
  /* ---------- données : base (colonnes vitrine_*) puis secours statique ---------- */
  var ROWS = null;                       /* lignes fournies par la page publique */
  function setRows(list) { ROWS = list || null; }
  function allRows() {
    if (ROWS) return ROWS;
    try { if (typeof programmes !== 'undefined' && Array.isArray(programmes)) return programmes; } catch (e) { }
    return [];
  }
  function rowOf(slug) { var r = allRows(); for (var i = 0; i < r.length; i++) if (r[i].slug === slug) return r[i]; return null; }
  function photoURL(ph) { if (!ph) return ''; return /^(https?:)?\//.test(ph) ? ph : '/' + ph; }
  function titleHTML(t) {
    var lines = String(t || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    if (lines.length < 2) return esc(lines[0] || '');
    return esc(lines[0]) + '<br><span class="v-c2">' + esc(lines.slice(1).join(' ')) + '</span>';
  }
  function cfgOf(slug, row) {
    row = row || rowOf(slug);
    if (row && row.vitrine_title) {
      return {
        link: row.vitrine_link || slug, title: titleHTML(row.vitrine_title),
        titleText: String(row.vitrine_title).replace(/\s+/g, ' ').trim(),
        tag: row.vitrine_tagline || '', chips: row.vitrine_chips || [], desc: row.vitrine_desc || '',
        features: row.vitrine_features || [], photo: photoURL(row.vitrine_photo), pos: row.vitrine_pos || '50% 40%'
      };
    }
    var c = VITRINE[slug]; if (!c) return null;
    return {
      link: c.link, title: c.title, titleText: c.title.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(),
      tag: c.tag, chips: c.chips, desc: c.desc, features: c.features, photo: photoURL(c.photo), pos: c.pos
    };
  }
  function slugFromLink(link) {
    link = String(link || '').toLowerCase(); if (!link) return null;
    var r = allRows();
    for (var i = 0; i < r.length; i++) if (String(r[i].vitrine_link || '').toLowerCase() === link || r[i].slug === link) return r[i].slug;
    for (var k in VITRINE) if (VITRINE[k].link === link || k === link) return k;
    return null;
  }
  function linkOf(slug) { var c = cfgOf(slug); return c ? PUBLIC_BASE + '/p/' + c.link : ''; }
  function orderIndex(slug) {
    var r = rowOf(slug);
    if (r && r.vitrine_order != null) return r.vitrine_order;
    var i = VITRINE_ORDER.indexOf(slug); return i < 0 ? 999 : i + 1;
  }

  function css() {
    if (document.getElementById('vitrine-css')) return;
    var st = document.createElement('style'); st.id = 'vitrine-css';
    st.textContent = [
      '.v-card{--c:#e8ff47;--ct:rgba(232,255,71,.12);background:#0b0b0c;color:#ededed;border:1px solid #1f2023;border-radius:22px;overflow:hidden;max-width:460px;margin:0 auto;font-family:"DM Sans",sans-serif}',
      '.v-hw{position:relative;height:400px;overflow:hidden;background:#141416}',
      '.v-hero{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat}',
      '.v-gfx{position:absolute;inset:0;background:var(--c)}',
      '.v-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,11,12,.5) 0%,rgba(11,11,12,0) 26%,rgba(11,11,12,0) 48%,rgba(11,11,12,.93) 86%,#0b0b0c 100%)}',
      '.v-top{position:absolute;left:18px;top:16px;font-size:9px;letter-spacing:2.5px;font-weight:700;color:rgba(255,255,255,.88)}',
      '.v-ttl{position:absolute;left:18px;right:18px;bottom:48px;font-family:"Bebas Neue",sans-serif;letter-spacing:1px;font-size:54px;line-height:.9;color:#fff}',
      '.v-ttl .v-c2{color:var(--c)}',
      '.v-tag{position:absolute;left:18px;right:18px;bottom:16px;font-size:13px;font-weight:700;font-style:italic;color:#fff}',
      '.v-chips{display:flex;gap:6px;padding:6px 18px 0;flex-wrap:wrap}',
      '.v-chip{font-size:11px;font-weight:700;padding:5px 10px;border-radius:999px;border:1px solid var(--c);color:var(--c);background:var(--ct)}',
      '.v-desc{padding:14px 18px 0;font-size:13.5px;line-height:1.6;color:#c9cdd2}',
      '.v-sec{padding:16px 18px 0}',
      '.v-cap{font-size:10px;letter-spacing:2px;color:#8a8f96;font-weight:700;margin-bottom:8px}',
      '.v-ft{display:flex;gap:10px;align-items:center;font-size:13.5px;padding:8px 0;border-top:1px solid #1f2023}',
      '.v-ft i{width:7px;height:7px;border-radius:2px;background:var(--c);flex:none}',
      '.v-dw{display:flex;gap:4px}',
      '.v-day{flex:1;background:#18191b;border:1px solid #2a2b2e;border-radius:8px;padding:6px 2px;text-align:center;font-size:9px;color:#8a8f96;line-height:1.6}',
      '.v-price{margin:18px 18px 18px;border:1px solid #2a2b2e;border-radius:14px;padding:14px;background:#141416}',
      '.v-pr{display:flex;align-items:baseline;justify-content:space-between;gap:10px}',
      '.v-pv{font-family:"Bebas Neue",sans-serif;font-size:40px;letter-spacing:1px;color:var(--c)}',
      '.v-pp{font-size:11px;color:#8a8f96}',
      '.v-pn{font-size:10.5px;color:#8a8f96;text-align:right}',
      '.v-cta{display:block;width:100%;margin-top:12px;background:var(--c);font-weight:700;font-size:14px;border:none;border-radius:11px;padding:14px;text-align:center;cursor:pointer;font-family:inherit}',
      '.v-cta.v-off{background:#2a2b2e;color:#8a8f96;cursor:default}',
      '.v-cta.v-ok{background:transparent;border:1px solid var(--c);color:var(--c)}',
      '.v-link{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:8px;background:transparent;border:1px dashed #3a3b3e;color:#c9cdd2;border-radius:11px;padding:10px;font-size:12.5px;cursor:pointer;font-family:inherit}',
      '.v-list{display:flex;flex-direction:column;gap:18px;padding:6px 16px 30px}',
      '.v-head{padding:18px 20px 6px}',
      '.v-head h2{font-family:"Bebas Neue",sans-serif;letter-spacing:2px;font-weight:400;font-size:30px;margin:0;color:var(--text,#ededed)}',
      '.v-head p{margin:4px 0 0;font-size:13px;color:var(--muted,#8a8f96)}',
      '.v-back{background:none;border:none;color:var(--muted,#8a8f96);font-size:13px;padding:0;margin-bottom:8px;cursor:pointer}',
      '@media (min-width:980px){.v-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));align-items:start}}',
      '.vg{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:4px 16px 26px;max-width:720px;margin:0 auto}',
      '@media (min-width:760px){.vg{grid-template-columns:repeat(3,1fr)}}',
      '.vg-t{position:relative;height:215px;border-radius:16px;overflow:hidden;border:1px solid #1f2023;background:#141416;cursor:pointer;padding:0;text-align:left;font-family:inherit}',
      '.vg-t:active{transform:scale(.98)}',
      '.vg-ph{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat}',
      '.vg-sh{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 30%,rgba(11,11,12,.95) 92%)}',
      '.vg-bar{position:absolute;left:0;right:0;top:0;height:3px}',
      '.vg-nm{position:absolute;left:11px;right:10px;bottom:30px;font-family:"Bebas Neue",sans-serif;font-size:27px;letter-spacing:.5px;line-height:.9;color:#fff}',
      '.vg-pr{position:absolute;left:11px;bottom:10px;font-size:12px;font-weight:700}',
      '.vg-ok{position:absolute;right:8px;top:10px;font-size:10px;font-weight:700;background:rgba(11,11,12,.75);color:#fff;border-radius:999px;padding:3px 8px}',
      '.vt-tabs{display:flex;gap:8px;overflow-x:auto;padding:4px 16px 14px;scrollbar-width:none;max-width:720px;margin:0 auto}',
      '.vt-tabs::-webkit-scrollbar{display:none}',
      '.vt-tab{flex:none;font-size:12.5px;font-weight:700;padding:8px 14px;border-radius:999px;border:1px solid #2a2b2e;color:#9aa0a6;background:#111214;font-family:inherit;cursor:pointer}',
      '.vt-tab.on{color:var(--tc);border-color:var(--tc);background:color-mix(in srgb,var(--tc) 14%,transparent)}',
      '.vt-card{padding:0 16px}',
      '.vt-dots{display:flex;justify-content:center;gap:6px;padding:14px 0 28px}',
      '.vt-dots i{width:6px;height:6px;border-radius:3px;background:#2a2b2e;transition:width .2s}',
      '.vt-dots i.on{width:18px;background:var(--tc)}'
    ].join('');
    document.head.appendChild(st);
  }

  /* p = ligne programmes (id, slug, name, color, type, price_monthly, price_oneshot, is_free, stripe_price_id/has_stripe)
     opts = { week: [{date,type}], access: bool, staff: bool, ctaAction: 'js code', base: '' } */
  function cardHTML(p, opts) {
    var c = cfgOf(p.slug, p); if (!c) return '';
    opts = opts || {};
    var col = p.color || '#e8ff47';
    var oneshot = p.type === 'oneshot';
    var val = oneshot ? p.price_oneshot : p.price_monthly;
    var price = p.is_free ? 'Gratuit' : (val ? (Math.round(+val * 100) / 100) + '€' : '—');
    var hasStripe = !!(p.stripe_price_id || p.has_stripe);
    var base = opts.base || '/';
    var hero = c.photo
      ? '<div class="v-hero" style="background-image:url(' + c.photo + ');background-position:' + esc(c.pos) + '"></div>'
      : '<div class="v-gfx"></div>';
    var week = '';
    if (opts.week && opts.week.length) {
      var by = {}; opts.week.forEach(function (s) { (by[s.dow] = by[s.dow] || []).push(s.type); });
      week = '<div class="v-sec"><div class="v-cap">CETTE SEMAINE</div><div class="v-dw">' +
        DAY.map(function (d, i) { var t = by[i]; return '<div class="v-day">' + d + '<br>' + (t ? t.slice(0, 2).map(function (x) { return ICON[x] || '📋'; }).join('') : '—') + '</div>'; }).join('') +
        '</div></div>';
    }
    var cta;
    if (opts.access) cta = '<button class="v-cta v-ok" onclick="' + (opts.openAction || '') + '">✓ Accès actif · ouvrir la programmation</button>';
    else if (p.is_free) cta = '<button class="v-cta" style="color:' + (isLight(col) ? '#0b0b0c' : '#fff') + '" onclick="' + (opts.ctaAction || '') + '">Accéder gratuitement</button>';
    else if (!hasStripe) cta = '<button class="v-cta v-off" disabled>Bientôt disponible</button>';
    else cta = '<button class="v-cta" style="color:' + (isLight(col) ? '#0b0b0c' : '#fff') + '" onclick="' + (opts.ctaAction || '') + '">' +
      (oneshot ? 'Acheter le programme' : 'Commencer mes ' + TRIAL_DAYS + ' jours gratuits') + '</button>';
    var link = opts.staff ? '<button class="v-link" onclick="udtVitrine.copyLink(\'' + p.slug + '\',this)">🔗 Copier le lien · ' + esc(linkOf(p.slug).replace(/^https?:\/\//, '')) + '</button>' : '';
    return '<div class="v-card" id="v-' + esc(p.slug) + '" style="--c:' + col + ';--ct:' + rgba(col, 0.12) + '">' +
      '<div class="v-hw">' + hero + '<div class="v-shade"></div>' +
      '<div class="v-top">UPSIDE DOWN TRAINING · PROGRAMMATION</div>' +
      '<div class="v-ttl">' + c.title + '</div><div class="v-tag">' + esc(c.tag) + '</div></div>' +
      '<div class="v-chips">' + c.chips.map(function (x) { return '<span class="v-chip">' + esc(x) + '</span>'; }).join('') + '</div>' +
      '<div class="v-desc">' + esc(c.desc) + '</div>' +
      '<div class="v-sec"><div class="v-cap">CE QUE TU TROUVES DEDANS</div>' + c.features.map(function (f) { return '<div class="v-ft"><i></i>' + esc(f) + '</div>'; }).join('') + '</div>' +
      week +
      '<div class="v-price"><div class="v-pr"><div><span class="v-pv">' + price + '</span><span class="v-pp">' + (oneshot || p.is_free ? '' : ' /mois') + '</span></div>' +
      '<div class="v-pn">' + (oneshot ? 'Paiement unique<br>Accès au programme complet' : 'Sans engagement<br>Résiliable à tout moment') + '</div></div>' +
      cta + link + '</div></div>';
  }

  function copyLink(slug, btn) {
    var url = linkOf(slug); if (!url) return;
    var done = function () {
      if (btn) { var t = btn.innerHTML; btn.innerHTML = '✓ Lien copié'; setTimeout(function () { btn.innerHTML = t; }, 1600); }
      if (typeof showToast === 'function') showToast('🔗 Lien copié : ' + url.replace(/^https?:\/\//, ''));
    };
    try { navigator.clipboard.writeText(url).then(done, function () { prompt('Lien à copier :', url); }); }
    catch (e) { prompt('Lien à copier :', url); }
  }

  /* ---------- dans l'app ---------- */
  function isStaff() { return typeof currentProfile !== 'undefined' && currentProfile && currentProfile.role === 'admin'; }
  function access(p) { try { return typeof hasAccess === 'function' ? hasAccess(p) : false; } catch (e) { return false; } }

  async function weekOf(progId) {
    try {
      var now = new Date(), dow = now.getDay(), mon = new Date(now);
      mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
      var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      var iso = function (d) { return d.toISOString().split('T')[0]; };
      var r = await sb.from('sessions').select('date,type').eq('programme_id', progId).neq('type', 'separator')
        .gte('date', iso(mon)).lte('date', iso(sun));
      return ((r && r.data) || []).map(function (s) { var d = new Date(s.date + 'T12:00:00'); return { dow: (d.getDay() + 6) % 7, type: s.type }; });
    } catch (e) { return []; }
  }

  function inVitrine(slug) {
    var r = rowOf(slug);
    if (r && 'vitrine_visible' in r) return !!r.vitrine_visible && !!cfgOf(slug, r);
    return !!VITRINE[slug] && VITRINE_ORDER.indexOf(slug) >= 0;
  }
  function vitrineProgs() {
    if (typeof programmes === 'undefined') return [];
    return programmes.filter(function (p) { return inVitrine(p.slug); })
      .sort(function (a, b) { return orderIndex(a.slug) - orderIndex(b.slug); });
  }

  /* ---------- navigateur : grille de vignettes → vue détaillée avec onglets ----------
     root : élément conteneur ; list : programmes ; o.cardOpts(p) → options de cardHTML ;
     o.access(p) → bool ; o.base ; o.onChange(slug|null) */
  function mountBrowser(root, list, o) {
    css(); o = o || {};
    var state = { sel: -1 };
    function gridHTML() {
      return '<div class="vg">' + list.map(function (p, i) {
        var c = cfgOf(p.slug, p), col = p.color || '#e8ff47';
        var one = p.type === 'oneshot', v = one ? p.price_oneshot : p.price_monthly;
        var pr = p.is_free ? 'Gratuit' : (v ? (Math.round(+v * 100) / 100) + '€' + (one ? '' : '/mois') : '');
        var ok = o.access && o.access(p) ? '<span class="vg-ok">✓ Accès actif</span>' : '';
        return '<button class="vg-t" data-i="' + i + '">' +
          '<div class="vg-ph" style="background-image:url(' + c.photo + ');background-position:' + esc(c.pos) + '"></div>' +
          '<div class="vg-sh"></div><div class="vg-bar" style="background:' + col + '"></div>' + ok +
          '<div class="vg-nm">' + c.title.replace(/<br>/g, ' ') + '</div><div class="vg-pr" style="color:' + col + '">' + pr + '</div></button>';
      }).join('') + '</div>';
    }
    function detailHTML(i) {
      var p = list[i], col = p.color || '#e8ff47';
      return (o.noGrid ? '' : '<div style="max-width:720px;margin:0 auto;padding:0 16px 10px"><button class="v-back" data-grid="1">‹ Toutes les programmations</button></div>') +
        '<div class="vt-tabs">' + list.map(function (x, k) {
          return '<button class="vt-tab' + (k === i ? ' on' : '') + '" data-i="' + k + '" style="--tc:' + (x.color || '#e8ff47') + '">' + esc(cfgOf(x.slug, x).titleText) + '</button>';
        }).join('') + '</div>' +
        '<div class="vt-card">' + cardHTML(p, o.cardOpts ? o.cardOpts(p) : {}) + '</div>' +
        '<div class="vt-dots" style="--tc:' + col + '">' + list.map(function (x, k) { return '<i class="' + (k === i ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    }
    function show(i) {
      if (o.noGrid && i < 0) i = 0;   /* option 1 : toujours une programmation affichée */
      state.sel = i;
      root.innerHTML = i < 0 ? gridHTML() : detailHTML(i);
      if (i >= 0) {
        var t = root.querySelector('.vt-tab.on');
        if (t) t.scrollIntoView({ block: 'nearest', inline: 'center' });
      }
      if (o.onChange) o.onChange(i < 0 ? null : list[i].slug);
      var top = root.getBoundingClientRect().top;
      if (top < 0) root.scrollIntoView({ block: 'start' });
    }
    root.onclick = function (e) {
      var b = e.target.closest('[data-i],[data-grid]'); if (!b || !root.contains(b)) return;
      if (b.hasAttribute('data-grid')) { show(-1); return; }
      if (b.classList.contains('vg-t') || b.classList.contains('vt-tab')) show(+b.getAttribute('data-i'));
    };
    /* glisser gauche / droite dans la vue détaillée */
    var x0 = null, y0 = null;
    root.addEventListener('touchstart', function (e) { if (state.sel < 0) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (state.sel < 0 || x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
        var n = state.sel + (dx < 0 ? 1 : -1);
        if (n >= 0 && n < list.length) show(n);
      }
    }, { passive: true });
    return {
      show: show,
      showSlug: function (slug) { var i = -1; list.forEach(function (p, k) { if (p.slug === slug) i = k; }); show(i); }
    };
  }

  async function render(focusSlug) {
    css();
    var page = document.getElementById('page-vitrine'); if (!page) return;
    try { if (typeof loadMyAccess === 'function') await loadMyAccess(); } catch (e) { }
    var list = vitrineProgs();
    var staff = isStaff();
    page.innerHTML = '<div class="v-head"><button class="v-back" onclick="goPage(\'prog\')">‹ Retour</button>' +
      '<h2>ACCÈS AUX PROGRAMMATIONS</h2><p>Choisis ta programmation. ' + TRIAL_DAYS + ' jours d\'essai gratuits sur les abonnements.</p></div>' +
      '<div id="v-browser"><div class="spinner"></div></div>';
    if (!list.length) { document.getElementById('v-browser').innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Aucune programmation disponible</div>'; return; }
    var weeks = await Promise.all(list.map(function (p) { return weekOf(p.id); }));
    var wk = {}; list.forEach(function (p, i) { wk[p.id] = weeks[i]; });
    var br = mountBrowser(document.getElementById('v-browser'), list, {
      noGrid: true, access: access,
      cardOpts: function (p) {
        return {
          week: wk[p.id], access: access(p), staff: staff,
          ctaAction: (p.is_free ? 'claimFreeAccess' : 'subscribeToProg') + "('" + p.id + "')",
          openAction: "udtVitrine.openProg('" + p.id + "')"
        };
      }
    });
    br.showSlug(focusSlug || null);
  }

  function open(focusSlug) {
    if (typeof goPage === 'function') goPage('vitrine');
    render(focusSlug);
  }
  function openProg(id) {
    if (typeof goPage === 'function') goPage('prog');
    if (typeof selectProg === 'function') selectProg(id);
  }

  /* programme demandé par un lien /p/<lien> avant connexion */
  function consumePending() {
    var slug = null;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('prog') && !q.get('subscription')) slug = slugFromLink(q.get('prog'));
      if (!slug) slug = slugFromLink(localStorage.getItem('udt_pending_prog'));
      localStorage.removeItem('udt_pending_prog');
    } catch (e) { }
    if (slug) open(slug);
    return !!slug;
  }

  window.udtVitrine = {
    VITRINE: VITRINE, ORDER: VITRINE_ORDER, TRIAL_DAYS: TRIAL_DAYS, PUBLIC_BASE: PUBLIC_BASE,
    css: css, cardHTML: cardHTML, cfgOf: cfgOf, slugFromLink: slugFromLink, linkOf: linkOf,
    orderIndex: orderIndex, inVitrine: inVitrine, setRows: setRows, titleHTML: titleHTML, photoURL: photoURL, copyLink: copyLink, open: open, render: render, openProg: openProg,
    consumePending: consumePending, isStaff: isStaff, mountBrowser: mountBrowser
  };
})();
