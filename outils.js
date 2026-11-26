/* ============================================================
 * OUTILS — Onglet admin « 🧰 Outils »
 * ------------------------------------------------------------
 * Regroupe les outils coach (calculateurs, convertisseurs…)
 * dans le panel Admin, juste à côté de « ⚙️ Paramètres ».
 *
 * Fichier autonome — ne touche pas à admin.js.
 * Injecte son onglet + son panel dans page-admin, à la manière
 * de wellness-config.js / badges.
 *
 * Pour ajouter un outil : une entrée dans TOOLS, rien d'autre.
 * ============================================================ */
(function () {
  if (window.__patchBound_outils) return;
  window.__patchBound_outils = true;

  // ---------- catalogue des outils ----------

  // À changer à chaque mise à jour de vbt.html : force le rechargement (cache navigateur)
  var VBT_VERSION = '2026-11-25h';
  // Idem pour ef.html (profil endurance fondamentale)
  var EF_VERSION = '2026-11-25h';
  // Idem pour pc.html (profil puissance / vitesse critique)
  var PC_VERSION = '2026-11-25h';
  // Idem pour lv-test.html (profil charge-vitesse · test standardisé)
  var LV_VERSION = '2026-11-25h';
  // Idem pour lactate.html (profilage lactate · profilage RPE, protocole 41)
  var ENDU_VERSION = '2026-11-26a';

  // Onglets de la boîte à outils (ordre d'affichage)
  var CATS = [
    { id: 'force', label: 'Strength continuum' },
    { id: 'endurance', label: 'Endurance' },
    { id: 'kids', label: 'Prog kids' }
  ];

  var TOOLS = [
    {
      id: 'lvtest',
      cat: 'force',
      emoji: '🎯',
      title: 'Profil charge-vitesse · Test',
      sub: 'Protocole standardisé par athlète (RM all time, 8 paliers) : profil de référence, zones VBT et suivi des re-tests datés.',
      url: '/lv-test.html?v=' + LV_VERSION,
      tall: true
    },
    {
      id: 'echo',
      cat: 'endurance',
      emoji: '🚴',
      title: 'Assault ↔ Echo Bike',
      sub: 'Équivalences cadence, watts et calories entre les deux vélos.',
      url: 'https://calculateur-echo.vercel.app/'
    },
    {
      id: 'erg',
      cat: 'endurance',
      emoji: '🚣',
      title: 'Calculateur Erg',
      sub: 'Conversions et splits sur les machines Concept2.',
      url: 'https://calculateur-erg.vercel.app/'
    },
    {
      id: 'vbt',
      cat: 'force',
      emoji: '⚡',
      title: 'Journal VBT',
      sub: 'Séances au capteur de vitesse, profil charge-vitesse et zones. Enregistré sur ton compte UDT.',
      url: '/vbt.html?v=' + VBT_VERSION,
      tall: true
    },
    {
      id: 'ef',
      cat: 'endurance',
      emoji: '🫀',
      title: 'Profil EF',
      sub: 'Endurance fondamentale : dérive de la FC, FC moyenne et efficience par athlète. Lecture seule, coach référent.',
      url: '/ef.html?v=' + EF_VERSION,
      tall: true
    },
    {
      id: 'pc',
      cat: 'endurance',
      emoji: '📈',
      title: 'Profil PC / VC',
      sub: 'Protocole standardisé par athlète (test 3′ puis 12′ sur deux jours) : PC / VC de référence, W′, profil énergétique, zones, formules Séance+ et suivi des re-tests.',
      url: '/pc.html?v=' + PC_VERSION,
      tall: true
    },
    {
      id: 'lactate',
      cat: 'endurance',
      emoji: '🩸',
      title: 'Profilage lactate',
      sub: 'Protocole 41 (paliers 4′/1′) : lactate, FC et RPE par palier, import du fichier FC, seuils S1 / S2 (Bsln+0,5 · ModDmax) validés façon ExPhysLab, zones et suivi des re-tests.',
      url: '/lactate.html?v=' + ENDU_VERSION,
      tall: true
    },
    {
      id: 'rpe',
      cat: 'endurance',
      emoji: '🫁',
      title: 'Profilage RPE',
      sub: 'Version simplifiée du protocole 41 sans lactate : FC et RPE (jambes, cardio, respi), S1 au passage 3→4, S2 au passage 7→8, zones et suivi.',
      url: '/lactate.html?mode=rpe&v=' + ENDU_VERSION,
      tall: true
    }
  ];

  var _openTool = null;   // outil actuellement ouvert (objet de TOOLS)
  var _cat = 'force';     // onglet actif
  try { var _sc = localStorage.getItem('udt_outils_cat'); if (_sc && CATS.some(function (c) { return c.id === _sc; })) _cat = _sc; } catch (e) {}

  // ---------- récap « Profils endurance » (dernier test par modalité) ----------
  var _recapAth = '';        // '' = moi, sinon id de l'athlète choisi dans le menu
  var _recapPerso = null;    // athlète ouvert depuis son espace perso (vue coach)
  var _athList = null;       // cache ef_my_athletes
  var ENDU_MODS = { bike: 'Bike Erg', row: 'Row', ski: 'Ski Erg', assault: 'Assault', echo: 'Echo', velo: 'Vélo', run: 'Course' };

  function _sb() { try { return typeof sb !== 'undefined' ? sb : null; } catch (e) { return null; } }
  function _me() { try { return typeof currentUser !== 'undefined' && currentUser ? currentUser.id : null; } catch (e) { return null; } }
  function _recapKind() { return _recapPerso ? _recapPerso.kind : (_cat === 'force' ? 'force' : 'endu'); }
  var LV_MOVES = { bsq: 'Back Squat', fsq: 'Front Squat', bench: 'Bench Press', dl: 'Deadlift', ohp: 'Shoulder Press' };
  function _recapTarget() { return _recapPerso ? _recapPerso.id : (_recapAth || _me()); }
  function _dFR(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }

  function _recapShell() {
    var who = '';
    if (!_recapPerso) {
      who = '<select class="ot-rc-who" id="ot-rc-who"><option value="">Moi</option>' +
        (_athList || []).map(function (a) {
          return '<option value="' + _esc(a.id) + '"' + (a.id === _recapAth ? ' selected' : '') + '>' + _esc(a.name) + '</option>';
        }).join('') + '</select>';
    }
    return '<div class="ot-rc">' +
      '<div class="ot-rc-head"><div class="ot-rc-ti">' + (_recapPerso ? 'Derniers profils' : 'Mes profils') + '</div>' + who + '</div>' +
      '<div id="ot-rc-body"><div class="ot-rc-empty">Chargement…</div></div>' +
    '</div>';
  }

  async function _fillRecap() {
    var body = _byId('ot-rc-body');
    var cli = _sb();
    if (!body) return;
    if (!cli) { body.innerHTML = '<div class="ot-rc-empty">Connexion indisponible.</div>'; return; }
    if (!_recapPerso && _athList === null) {
      try { var ra = await cli.rpc('ef_my_athletes'); _athList = (ra.data || []).sort(function (a, b) { return String(a.name).localeCompare(b.name, 'fr'); }); }
      catch (e) { _athList = []; }
      var w = _byId('ot-rc-who');
      if (w && _athList.length) w.outerHTML = _recapShell().match(/<select[\s\S]*<\/select>/)[0];
      _bindWho();
    }
    var id = _recapTarget();
    if (!id) { body.innerHTML = '<div class="ot-rc-empty">Connecte-toi pour voir les profils.</div>'; return; }
    if (_recapKind() === 'force') return _fillForce(cli, id);
    var r, c;
    try {
      var res = await Promise.all([
        cli.from('endurance_tests').select('id,kind,modality,test_date,created_at,s1,s2,fc1,fc2')
          .eq('athlete_id', id).order('test_date', { ascending: false }).order('created_at', { ascending: false }),
        cli.from('cp_tests').select('id,modality,date3,date12,created_at,cp')
          .eq('athlete_id', id).order('created_at', { ascending: false })
      ]);
      r = res[0]; c = res[1];
    } catch (e) { r = { error: e }; c = {}; }
    if (id !== _recapTarget()) return;
    body = _byId('ot-rc-body');
    if (!body) return;
    if (r.error && (!c || c.error)) { body.innerHTML = '<div class="ot-rc-empty">Lecture impossible.</div>'; return; }

    // une entrée par modalité : dernier seuil (lactate / RPE) + dernière PC / VC
    var by = {};
    function slot(m) { return by[m] || (by[m] = { m: m, th: null, pc: null, d: '' }); }
    ((r && r.data) || []).forEach(function (t) {
      var x = slot(t.modality);
      if (!x.th) { x.th = t; if ((t.test_date || '') > x.d) x.d = t.test_date || ''; }
    });
    var cps = ((c && c.data) || []).map(function (t) { t._d = t.date12 || t.date3 || String(t.created_at || '').slice(0, 10); return t; })
      .sort(function (a, b) { return a._d < b._d ? 1 : a._d > b._d ? -1 : 0; });
    cps.forEach(function (t) {
      var x = slot(t.modality);
      if (!x.pc) { x.pc = t; if (t._d > x.d) x.d = t._d; }
    });
    var list = Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; });

    if (!list.length) {
      body.innerHTML = '<div class="ot-rc-empty">Aucun test enregistré. Lance un profilage ci-dessous.</div>';
      return;
    }
    function bpm(v) { return v ? ' <span class="ot-rc-bpm">· ' + v + ' bpm</span>' : ''; }
    body.innerHTML = list.map(function (x) {
      var run = x.m === 'run';
      var right = '';
      if (x.th) {
        var t = x.th;
        right += '<button class="ot-rc-val" data-open="' + (t.kind === 'rpe' ? 'rpe' : 'lactate') + '" data-mod="' + _esc(x.m) + '">' +
          '<span class="ot-rc-tag ' + (t.kind === 'rpe' ? 'rpe' : 'lac') + '">' + (t.kind === 'rpe' ? 'RPE' : 'Lactate') + '</span> ' +
          'S1 <b>' + t.s1 + ' W</b>' + bpm(t.fc1) + ' · S2 ' +
          (t.s2 != null ? '<b>' + t.s2 + ' W</b>' + bpm(t.fc2) : '<span class="ot-rc-na">non atteint</span>') +
          ' <span class="ot-rc-d">' + _dFR(t.test_date) + '</span></button>';
      }
      if (x.pc) {
        var v = run ? String(Number(x.pc.cp).toFixed(1)).replace('.', ',') + ' km/h' : Math.round(x.pc.cp) + ' W';
        right += '<button class="ot-rc-val" data-open="pc" data-mod="' + _esc(x.m) + '">' +
          '<span class="ot-rc-tag pc">' + (run ? 'VC' : 'PC') + '</span> <b>' + v + '</b>' +
          ' <span class="ot-rc-d">' + _dFR(x.pc._d) + '</span></button>';
      }
      return '<div class="ot-rc-row"><span class="ot-rc-mn">' + _esc(ENDU_MODS[x.m] || x.m) + '</span>' +
        '<span class="ot-rc-vals">' + right + '</span></div>';
    }).join('') + '<div class="ot-rc-hint">Touche un résultat pour ouvrir son profil et ses zones.</div>';
    body.querySelectorAll('.ot-rc-val').forEach(function (b) {
      b.addEventListener('click', function () { _openEndu(b.dataset.open, { mod: b.dataset.mod, tab: 'profil' }); });
    });
  }

  async function _fillForce(cli, id) {
    var r, j;
    try {
      var res = await Promise.all([
        cli.from('lv_tests').select('id,movement,test_date,created_at,rm,e1rm')
          .eq('athlete_id', id).order('test_date', { ascending: false }).order('created_at', { ascending: false }),
        cli.from('vbt_journal').select('doc_key,data').eq('user_id', id)
      ]);
      r = res[0]; j = res[1];
    } catch (e) { r = { error: e }; j = {}; }
    if (id !== _recapTarget()) return;
    var body = _byId('ot-rc-body');
    if (!body) return;
    if (r.error && (!j || j.error)) { body.innerHTML = '<div class="ot-rc-empty">Lecture impossible.</div>'; return; }

    // charge-vitesse : dernier test par mouvement
    var last = {}, order = [];
    ((r && r.data) || []).forEach(function (t) { if (!last[t.movement]) { last[t.movement] = t; order.push(t.movement); } });
    // journal VBT : séances terminées, plus récentes d'abord
    var names = {}, sess = [];
    ((j && j.data) || []).forEach(function (x) {
      if (x.doc_key === 'settings' && x.data && Array.isArray(x.data.moves)) x.data.moves.forEach(function (m) { names[m.id] = m.name; });
      else if (String(x.doc_key).indexOf('s-') === 0 && x.data) sess.push(x.data);
    });
    var done = sess.filter(function (s) { return s.status === 'done'; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });

    if (!order.length && !done.length) {
      body.innerHTML = '<div class="ot-rc-empty">Aucun test ni séance VBT enregistré. Lance un outil ci-dessous.</div>';
      return;
    }
    var kg = function (v) { return v != null && v > 0 ? (Math.round(v * 2) / 2).toString().replace('.', ',') + ' kg' : '–'; };
    var h = '';
    order.forEach(function (k) {
      var t = last[k];
      h += '<div class="ot-rc-row"><span class="ot-rc-mn">' + _esc(LV_MOVES[k] || k) + '</span><span class="ot-rc-vals">' +
        '<button class="ot-rc-val" data-open="lvtest" data-mv="' + _esc(k) + '"><span class="ot-rc-tag lac">Charge-vitesse</span> ' +
        '1RM <b>' + kg(t.rm) + '</b> · e1RM <b>' + kg(t.e1rm) + '</b> <span class="ot-rc-d">' + _dFR(t.test_date) + '</span></button>' +
        '</span></div>';
    });
    if (done.length) {
      var top3 = done.slice(0, 3).map(function (s) {
        var mv = [];
        (s.blocks || []).forEach(function (b) { var n = names[b.mv] || b.mv; if (n && mv.indexOf(n) < 0) mv.push(n); });
        var lab = s.title || mv.join(' · ') || 'Séance';
        return '<button class="ot-rc-val" data-open="vbt"><span class="ot-rc-tag rpe">VBT</span> <b>' + _esc(lab) + '</b>' +
          ' <span class="ot-rc-d">' + _dFR(s.date) + '</span></button>';
      }).join('');
      h += '<div class="ot-rc-row"><span class="ot-rc-mn">Journal VBT <span class="ot-rc-bpm">· ' + done.length + ' séance' + (done.length > 1 ? 's' : '') + '</span></span>' +
        '<span class="ot-rc-vals">' + top3 + '</span></div>';
    }
    body.innerHTML = h + '<div class="ot-rc-hint">Touche un résultat pour ouvrir le profil ou le journal.</div>';
    body.querySelectorAll('.ot-rc-val').forEach(function (b) {
      b.addEventListener('click', function () {
        _openEndu(b.dataset.open, b.dataset.mv ? { mv: b.dataset.mv, tab: 'profil' } : null);
      });
    });
  }

  function _bindWho() {
    var w = _byId('ot-rc-who');
    if (!w || w.__b) return;
    w.__b = true;
    w.addEventListener('change', function () { _recapAth = w.value; _fillRecap(); });
  }

  /* Ouvre lactate.html (kind lactate | rpe) sur l'athlète du récap. */
  function _openEndu(kind, opt) {
    var id = ['rpe', 'pc', 'lvtest', 'vbt'].indexOf(kind) > -1 ? kind : 'lactate';
    var base = TOOLS.find(function (x) { return x.id === id; });
    if (base) _openFor(base, opt);
  }

  function _openFor(base, opt) {
    var t = {}, k;
    for (k in base) t[k] = base[k];
    var q = [];
    var ath = _recapPerso ? _recapPerso.id : _recapAth;
    if (ath && (base.cat === 'endurance' || base.cat === 'force')) q.push('athlete=' + encodeURIComponent(ath));
    if (opt && opt.mod) q.push('mod=' + encodeURIComponent(opt.mod));
    if (opt && opt.mv) q.push('mv=' + encodeURIComponent(opt.mv));
    if (opt && opt.tab) q.push('tab=' + encodeURIComponent(opt.tab));
    if (q.length) t.url = base.url + (base.url.indexOf('?') > -1 ? '&' : '?') + q.join('&');
    if (_recapPerso) { t.title = base.title + ' · ' + _recapPerso.name; t.fromRecap = true; }
    _openTool = t;
    _renderTool(t);
  }

  // ---------- utilitaires ----------

  function _esc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _byId(id) { return document.getElementById(id); }

  // ---------- rendu ----------

  function renderOutilsTab() {
    var panel = _byId('admin-outils-panel');
    if (!panel) return;
    if (_openTool) _renderTool(_openTool);
    else _renderGrid();
  }

  function _renderGrid() {
    var panel = _byId('admin-outils-panel');
    if (!panel) return;

    var list = TOOLS.filter(function (t) { return t.cat === _cat; });
    // La grille « .ot-grid » n'existe que dans l'onglet Prog kids :
    // kids-scaling.js y ajoute sa carte « Scaling Kids & Teens ».
    var gridCls = _cat === 'kids' ? 'ot-grid' : 'ot-list';

    if (_recapPerso) list = TOOLS.filter(function (t) {
      return _recapPerso.kind === 'force' ? (t.id === 'lvtest' || t.id === 'vbt') : (t.id === 'lactate' || t.id === 'rpe' || t.id === 'pc');
    });
    var top = _recapPerso
      ? '<div class="ot-bar">' +
          '<button class="ot-back" id="ot-back-perso">‹ Espace perso</button>' +
          '<div class="ot-bar-ti">' + (_recapPerso.kind === 'force' ? '🏋️ Profils force · ' : '🫀 Profils endurance · ') + _esc(_recapPerso.name) + '</div>' +
        '</div>'
      : '<div class="ot-head">' +
          '<div class="ot-title">Outils coach</div>' +
          '<div class="ot-sub">Les calculateurs Upside Down, directement dans l\'admin.</div>' +
        '</div>' +
        '<div class="ot-tabs" role="tablist">' +
          CATS.map(function (c) {
            return '<button class="ot-tab' + (c.id === _cat ? ' active' : '') + '" role="tab" data-cat="' + _esc(c.id) + '">' +
              _esc(c.label) + '</button>';
          }).join('') +
        '</div>';
    var showRecap = _recapPerso || _cat === 'endurance' || _cat === 'force';

    panel.innerHTML =
      top +
      (showRecap ? _recapShell() + '<div class="ot-rc-sec">' + (_recapPerso && _recapPerso.kind === 'endu' ? 'Nouveau test' : 'Outils') + '</div>' : '') +
      '<div class="' + gridCls + '">' +
        list.map(function (t) {
          return '' +
            '<button class="ot-card" data-tool="' + _esc(t.id) + '">' +
              '<span class="ot-card-ic">' + _esc(t.emoji) + '</span>' +
              '<span class="ot-card-txt">' +
                '<span class="ot-card-ti">' + _esc(t.title) + '</span>' +
                '<span class="ot-card-sub">' + _esc(t.sub) + '</span>' +
              '</span>' +
              '<span class="ot-card-go">›</span>' +
            '</button>';
        }).join('') +
      '</div>' +
      '<div class="ot-empty">Aucun outil dans cet onglet pour l\'instant.</div>';

    panel.querySelectorAll('.ot-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        _cat = tab.dataset.cat;
        try { localStorage.setItem('udt_outils_cat', _cat); } catch (e) {}
        _renderGrid();
      });
    });

    panel.querySelectorAll('.ot-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var t = TOOLS.find(function (x) { return x.id === card.dataset.tool; });
        if (!t) return;
        if (_recapPerso || (_recapAth && (t.cat === 'endurance' || t.cat === 'force'))) _openFor(t);
        else { _openTool = t; _renderTool(t); }
      });
    });

    var bp = _byId('ot-back-perso');
    if (bp) bp.addEventListener('click', function () { _recapPerso = null; _openTool = null; _renderGrid(); _backToPerso(); });
    if (showRecap) { _bindWho(); _fillRecap(); }
  }

  function _renderTool(t) {
    var panel = _byId('admin-outils-panel');
    if (!panel) return;

    panel.innerHTML =
      '<div class="ot-bar">' +
        '<button class="ot-back" id="ot-back-btn">' + (t.fromPerso ? '‹ Espace perso' : t.fromRecap ? '‹ Profils' : '‹ Outils') + '</button>' +
        '<div class="ot-bar-ti">' + _esc(t.emoji) + ' ' + _esc(t.title) + '</div>' +
        '<a class="ot-ext" href="' + _esc(t.url) + '" target="_blank" rel="noopener" ' +
           'title="Ouvrir dans un nouvel onglet">↗</a>' +
      '</div>' +
      '<div class="ot-frame-wrap' + (t.tall ? ' ot-tall' : '') + '">' +
        '<div class="ot-frame-load" id="ot-frame-load"><div class="spinner"></div></div>' +
        '<iframe class="ot-frame" id="ot-frame" src="' + _esc(t.url) + '" ' +
          'loading="lazy" referrerpolicy="no-referrer-when-downgrade" ' +
          'title="' + _esc(t.title) + '"></iframe>' +
      '</div>' +
      '<div class="ot-foot">' +
        'L\'outil ne s\'affiche pas ? ' +
        '<a href="' + _esc(t.url) + '" target="_blank" rel="noopener">Ouvre-le dans un onglet</a>.' +
      '</div>';

    var back = _byId('ot-back-btn');
    if (back) back.addEventListener('click', function () {
      if (t.fromPerso) { _openTool = null; _renderGrid(); _backToPerso(); return; }
      _openTool = null; _renderGrid();
    });

    var frame = _byId('ot-frame');
    var load = _byId('ot-frame-load');
    if (frame && load) {
      frame.addEventListener('load', function () { load.style.display = 'none'; });
      // filet de sécurité : on ne laisse pas tourner le spinner indéfiniment
      setTimeout(function () { if (load) load.style.display = 'none'; }, 8000);
    }

    var p = _byId('page-admin');
    if (p) p.scrollTop = 0;
  }

  // ---------- styles ----------

  function _injectStyles() {
    if (_byId('ot-styles')) return;
    var st = document.createElement('style');
    st.id = 'ot-styles';
    st.textContent = [
      '.ot-head{margin-bottom:14px}',
      '.ot-title{font-family:"Bebas Neue",sans-serif;font-size:20px;letter-spacing:2px;margin-bottom:4px}',
      '.ot-sub{font-size:12px;color:var(--muted)}',
      '.ot-grid,.ot-list{display:flex;flex-direction:column;gap:10px}',
      '.ot-empty{display:none;font-size:12px;color:var(--muted);text-align:center;padding:24px 10px;',
      'border:1px dashed var(--border2);border-radius:14px}',
      '.ot-grid:empty+.ot-empty,.ot-list:empty+.ot-empty{display:block}',
      '.ot-tabs{display:flex;gap:6px;margin-bottom:14px;overflow-x:auto;scrollbar-width:none}',
      '.ot-tabs::-webkit-scrollbar{display:none}',
      '.ot-tab{flex:1 0 auto;background:var(--card);border:1px solid var(--border);color:var(--muted);',
      'border-radius:10px;padding:9px 12px;font-family:"Bebas Neue",sans-serif;font-size:15px;letter-spacing:1.5px;',
      'cursor:pointer;white-space:nowrap;transition:border-color .15s,color .15s,background .15s}',
      '.ot-tab:hover{border-color:var(--accent)}',
      '.ot-tab.active{border-color:var(--accent);color:var(--accent);background:var(--card2)}',
      '.ot-card{display:flex;align-items:center;gap:12px;width:100%;text-align:left;',
      'background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px;',
      'color:var(--text);font-family:inherit;cursor:pointer;transition:border-color .15s,background .15s}',
      '.ot-card:hover{border-color:var(--accent);background:var(--card2)}',
      '.ot-card-ic{font-size:26px;line-height:1;flex:0 0 auto;width:46px;height:46px;border-radius:12px;',
      'background:var(--card2);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center}',
      '.ot-card-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}',
      '.ot-card-ti{font-size:14px;font-weight:700;color:var(--text)}',
      '.ot-card-sub{font-size:12px;color:var(--muted);line-height:1.45}',
      '.ot-card-go{flex:0 0 auto;color:var(--muted);font-size:20px;line-height:1}',
      '.ot-bar{display:flex;align-items:center;gap:10px;margin-bottom:12px}',
      '.ot-back{flex:0 0 auto;background:var(--card2);border:1px solid var(--border2);color:var(--text2);',
      'border-radius:9px;padding:8px 12px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer}',
      '.ot-bar-ti{flex:1;min-width:0;font-family:"Bebas Neue",sans-serif;font-size:17px;letter-spacing:1.5px;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ot-ext{flex:0 0 auto;width:34px;height:34px;border-radius:9px;background:var(--card2);',
      'border:1px solid var(--border2);color:var(--text2);text-decoration:none;font-size:15px;',
      'display:flex;align-items:center;justify-content:center}',
      '.ot-frame-wrap{position:relative;border:1px solid var(--border);border-radius:14px;overflow:hidden;',
      'background:var(--dark);height:calc(100vh - 290px);min-height:480px}',
      '.ot-frame-wrap.ot-tall{height:calc(100vh - 200px);min-height:620px}',
      '.ot-frame{width:100%;height:100%;border:0;display:block;background:var(--dark)}',
      '.ot-frame-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;',
      'background:var(--dark);z-index:2}',
      '.ot-foot{font-size:11px;color:var(--muted);margin-top:10px;text-align:center;line-height:1.5}',
      '.ot-foot a{color:var(--accent);text-decoration:none}',
      '.ot-rc{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px 14px;margin-bottom:14px}',
      '.ot-rc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px}',
      '.ot-rc-ti{font-family:"Bebas Neue",sans-serif;font-size:18px;letter-spacing:1.5px}',
      '.ot-rc-who{max-width:55%;background:var(--card2);border:1px solid var(--border2);color:var(--text);',
      'border-radius:9px;padding:6px 8px;font-family:inherit;font-size:12px}',
      '.ot-rc-row{display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--border);padding:10px 0}',
      '.ot-rc-vals{display:flex;flex-direction:column;gap:4px}',
      '.ot-rc-val{display:block;width:100%;text-align:left;background:var(--card2);border:1px solid var(--border2);',
      'border-radius:9px;padding:7px 10px;color:var(--muted);font-family:inherit;font-size:12px;line-height:1.5;cursor:pointer}',
      '.ot-rc-val:hover{border-color:var(--accent)}',
      '.ot-rc-val b{color:var(--text);font-size:13px}',
      '.ot-rc-d{float:right;font-size:11px;color:var(--muted)}',
      '.ot-rc-tag.pc{background:rgba(245,138,31,.18);color:#f5a04f}',
      '#ot-rc-body .ot-rc-row:first-child{border-top:0}',
      '.ot-rc-mn{font-size:14px;font-weight:700}',
      '.ot-rc-tag{display:inline-block;font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px;margin-right:2px}',
      '.ot-rc-tag.lac{background:rgba(45,212,191,.16);color:#2dd4bf}',
      '.ot-rc-tag.rpe{background:rgba(155,108,240,.18);color:#b9a0f5}',
      '.ot-rc-bpm{font-size:11px}',
      '.ot-rc-na{color:var(--muted);font-style:italic}',
      '.ot-rc-empty,.ot-rc-hint{font-size:12px;color:var(--muted);padding:8px 0 2px}',
      '.ot-rc-sec{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin:0 0 8px}'
    ].join('');
    document.head.appendChild(st);
  }

  // ---------- injection dans l'UI admin ----------

  function _tabBar() {
    return document.querySelector('.admin-tabs') ||
           document.querySelector('.admin-tab-bar') ||
           (document.querySelector('.admin-tab-btn') || {}).parentElement ||
           null;
  }

  // Place le bouton juste après « ⚙️ Paramètres » si cet onglet existe
  // (il est créé à la volée par wellness.js), sinon en fin de barre.
  function _place(btn) {
    var bar = _tabBar();
    if (!bar) return;
    var settings = _byId('admin-colors-tab-btn');
    if (settings && settings.parentElement === bar) {
      if (settings.nextElementSibling !== btn) settings.insertAdjacentElement('afterend', btn);
    } else if (btn.parentElement !== bar) {
      bar.appendChild(btn);
    }
  }

  /* Depuis l'espace perso d'un athlète : ouvre l'outil directement sur lui. */
  function _backToPerso() {
    var pBtn = Array.prototype.find.call(document.querySelectorAll('.admin-tab-btn'), function (b) {
      return (b.getAttribute('onclick') || '').indexOf("'perso'") > -1;
    });
    var pPanel = _byId('admin-perso');
    if (!pBtn || !pPanel) return;
    document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.admin-panel').forEach(function (p) { p.classList.remove('active'); });
    pBtn.classList.add('active');
    pPanel.classList.add('active');
    try { pBtn.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}
  }
  window.openOutilAthlete = function (toolId) {
    var ath = window.currentPersoAthlete || (typeof currentPersoAthlete !== 'undefined' ? currentPersoAthlete : null);
    var base = TOOLS.find(function (x) { return x.id === toolId; });
    if (!base) return;
    _inject();
    var btn = _byId('admin-outils-tab-btn');
    if (!btn) return;
    document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.admin-panel').forEach(function (p) { p.classList.remove('active'); });
    btn.classList.add('active');
    var panel = _byId('admin-outils');
    if (panel) panel.classList.add('active');
    _injectStyles();
    var t = {};
    for (var k in base) t[k] = base[k];
    if (ath && ath.id) {
      t.url = base.url + (base.url.indexOf('?') > -1 ? '&' : '?') + 'athlete=' + encodeURIComponent(ath.id);
      t.title = base.title + ' · ' + (ath.full_name || ath.email || 'Athlète');
      t.fromPerso = true;
    }
    _openTool = t;
    _renderTool(t);
    try { btn.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}
  };

  /* Boutons « Profils endurance » / « Profils force » de l'espace perso (vue coach). */
  function _openProfils(kind) {
    var ath = window.currentPersoAthlete || (typeof currentPersoAthlete !== 'undefined' ? currentPersoAthlete : null);
    if (!ath || !ath.id) return;
    _inject();
    var btn = _byId('admin-outils-tab-btn');
    if (!btn) return;
    document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.admin-panel').forEach(function (p) { p.classList.remove('active'); });
    btn.classList.add('active');
    var panel = _byId('admin-outils');
    if (panel) panel.classList.add('active');
    _injectStyles();
    _recapPerso = { id: ath.id, name: ath.full_name || ath.email || 'Athlète', kind: kind };
    _openTool = null;
    _renderGrid();
    try { btn.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}
    var p = _byId('page-admin');
    if (p) p.scrollTop = 0;
  }
  window.openProfilsEndurance = function () { _openProfils('endu'); };
  window.openProfilsForce = function () { _openProfils('force'); };

  function _activate(btn) {
    if (_openTool && (_openTool.fromPerso || _openTool.fromRecap)) _openTool = null;
    _recapPerso = null;
    document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.admin-panel').forEach(function (p) { p.classList.remove('active'); });
    btn.classList.add('active');
    var panel = _byId('admin-outils');
    if (panel) panel.classList.add('active');
    renderOutilsTab();
  }

  function _inject() {
    var bar = _tabBar();
    var adminPage = _byId('page-admin');
    if (!bar || !adminPage) return false;

    var btn = _byId('admin-outils-tab-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'admin-tab-btn';
      btn.id = 'admin-outils-tab-btn';
      btn.textContent = '🧰 Outils';
      btn.onclick = function () { _activate(this); };
    }
    _place(btn);

    if (!_byId('admin-outils')) {
      var panel = document.createElement('div');
      panel.className = 'admin-panel';
      panel.id = 'admin-outils';
      panel.innerHTML = '<div id="admin-outils-panel"></div>';
      var panels = adminPage.querySelectorAll('.admin-panel');
      var last = panels[panels.length - 1];
      if (last) last.insertAdjacentElement('afterend', panel);
      else adminPage.appendChild(panel);
    }

    return true;
  }

  // Replace le bouton après « Paramètres » quand on (re)vient sur l'admin,
  // car cet onglet-là est créé tardivement.
  function _hookGoPage() {
    if (window.__otGoPageHooked || typeof window.goPage !== 'function') return;
    window.__otGoPageHooked = true;
    var _orig = window.goPage;
    window.goPage = async function (p) {
      var r = await _orig.apply(this, arguments);
      if (p === 'admin') setTimeout(function () { _init(); }, 250);
      return r;
    };
  }

  function _init() {
    _injectStyles();
    var ok = _inject();
    _hookGoPage();
    return ok;
  }

  function _boot() {
    if (_init()) return;
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (_init() || tries > 40) clearInterval(iv);
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }
  window.addEventListener('studio:ready', function () { _init(); });

  // exposé pour debug / ajout d'outil à chaud
  window.renderOutilsTab = renderOutilsTab;
  window.__OUTILS__ = TOOLS;
})();
