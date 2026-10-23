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
  var VBT_VERSION = '2026-10-23c';

  var TOOLS = [
    {
      id: 'echo',
      emoji: '🚴',
      title: 'Assault ↔ Echo Bike',
      sub: 'Équivalences cadence, watts et calories entre les deux vélos.',
      url: 'https://calculateur-echo.vercel.app/'
    },
    {
      id: 'erg',
      emoji: '🚣',
      title: 'Calculateur Erg',
      sub: 'Conversions et splits sur les machines Concept2.',
      url: 'https://calculateur-erg.vercel.app/'
    },
    {
      id: 'vbt',
      emoji: '⚡',
      title: 'Journal VBT',
      sub: 'Séances au capteur de vitesse, profil charge-vitesse et zones. Enregistré sur ton compte UDT.',
      url: '/vbt.html?v=' + VBT_VERSION,
      tall: true
    }
  ];

  var _openTool = null;   // outil actuellement ouvert (objet de TOOLS)

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

    panel.innerHTML =
      '<div class="ot-head">' +
        '<div class="ot-title">Outils coach</div>' +
        '<div class="ot-sub">Les calculateurs Upside Down, directement dans l\'admin.</div>' +
      '</div>' +
      '<div class="ot-grid">' +
        TOOLS.map(function (t) {
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
      '</div>';

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
        '<button class="ot-back" id="ot-back-btn">‹ Outils</button>' +
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
    if (back) back.addEventListener('click', function () { _openTool = null; _renderGrid(); });

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
      '.ot-grid{display:flex;flex-direction:column;gap:10px}',
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

  function _activate(btn) {
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
