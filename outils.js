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
  var VBT_VERSION = '2026-11-05a';
  // Idem pour ef.html (profil endurance fondamentale)
  var EF_VERSION = '2026-10-25b';
  // Idem pour pc.html (profil puissance / vitesse critique)
  var PC_VERSION = '2026-11-05f';

  // Onglets de la boîte à outils (ordre d'affichage)
  var CATS = [
    { id: 'force', label: 'Strength continuum' },
    { id: 'endurance', label: 'Endurance' },
    { id: 'kids', label: 'Prog kids' }
  ];

  var TOOLS = [
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
      sub: 'Puissance critique (Row, Ski, Bike Erg, Assault, Echo) et vitesse critique (course) depuis les tests 3′ et 12′ : W′, profil énergétique, zones et formules Séance+.',
      url: '/pc.html?v=' + PC_VERSION,
      tall: true
    }
  ];

  var _openTool = null;   // outil actuellement ouvert (objet de TOOLS)
  var _cat = 'force';     // onglet actif
  try { var _sc = localStorage.getItem('udt_outils_cat'); if (_sc && CATS.some(function (c) { return c.id === _sc; })) _cat = _sc; } catch (e) {}

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

    panel.innerHTML =
      '<div class="ot-head">' +
        '<div class="ot-title">Outils coach</div>' +
        '<div class="ot-sub">Les calculateurs Upside Down, directement dans l\'admin.</div>' +
      '</div>' +
      '<div class="ot-tabs" role="tablist">' +
        CATS.map(function (c) {
          return '<button class="ot-tab' + (c.id === _cat ? ' active' : '') + '" role="tab" data-cat="' + _esc(c.id) + '">' +
            _esc(c.label) + '</button>';
        }).join('') +
      '</div>' +
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
        if (t) { _openTool = t; _renderTool(t); }
      });
    });
  }

  function _renderTool(t) {
    var panel = _byId('admin-outils-panel');
    if (!panel) return;

    panel.innerHTML =
      '<div class="ot-bar">' +
        '<button class="ot-back" id="ot-back-btn">' + (t.fromPerso ? '‹ Espace perso' : '‹ Outils') + '</button>' +
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
      '.ot-foot a{color:var(--accent);text-decoration:none}'
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

  function _activate(btn) {
    if (_openTool && _openTool.fromPerso) _openTool = null;
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
