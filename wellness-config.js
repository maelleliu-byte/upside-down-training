/* ============================================================
 * WELLNESS CONFIG — Onglet admin « Suivi »
 * ------------------------------------------------------------
 * Permet à chaque studio de définir ses propres champs de suivi
 * (libellé, icône, sens) sur une échelle 1-5, et à chaque coach
 * d'enregistrer son numéro WhatsApp.
 *
 * Écrit dans : studios.wellness_config (jsonb)
 *              coach_contacts.whatsapp_phone
 *
 * Fichier autonome — n'entre pas en conflit avec admin.js.
 * Injecte son onglet + son panel dans page-admin, à la manière
 * de badges.js.
 * ============================================================ */
(function () {
  if (window.__patchBound_wellnessConfig) return;
  window.__patchBound_wellnessConfig = true;

  var UPSIDE_SLUG = 'upside';
  var MAX_FIELDS = 5;
  var WARN_FIELDS = 3;

  var _wcStudios = [];       // studios éditables (pour le sélecteur Upside)
  var _wcStudioId = null;    // studio en cours d'édition
  var _wcConfig = null;      // config en cours d'édition (brouillon local)
  var _wcDirty = false;

  // ---------- utilitaires ----------

  function _esc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else console.log(msg);
  }

  function _isUpsideAdmin() {
    try {
      return currentProfile && currentProfile.role === 'admin' && !currentProfile.studio_id;
    } catch (e) { return false; }
  }

  // Slug à partir d'un libellé : "Charge mentale" -> "charge_mentale"
  function _slugify(label) {
    return (label || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || ('champ_' + Date.now().toString(36).slice(-4));
  }

  function _defaultConfig() {
    return {
      scale_max: 5,
      fields: [
        { key: 'sommeil', label: 'Sommeil', icon: '😴', inverted: false, active: true },
        { key: 'energie', label: 'Énergie', icon: '🔥', inverted: false, active: true },
        { key: 'courbatures', label: 'Courbatures', icon: '🦵', inverted: true, active: true }
      ]
    };
  }

  // Normalise un numéro saisi en format international sans espaces.
  // "06 12 34 56 78" -> "+33612345678" ; "+41 79 ..." conservé tel quel.
  function _normalizePhone(raw) {
    if (!raw) return '';
    var s = String(raw).replace(/[\s.\-()]/g, '');
    if (/^00/.test(s)) s = '+' + s.slice(2);
    if (/^0\d{9}$/.test(s)) s = '+33' + s.slice(1);          // FR
    if (/^\d{9,15}$/.test(s) && s[0] !== '0') s = '+' + s;   // déjà international sans +
    return s;
  }

  function _phoneValid(p) {
    return /^\+\d{8,15}$/.test(p || '');
  }

  // ---------- résolution du studio ----------

  // Les athlètes/admins d'Upside ont studio_id = NULL, mais une ligne
  // 'upside' existe bien dans studios : c'est elle qui porte la config.
  async function _resolveOwnStudioId() {
    var sid = null;
    try { sid = (typeof getStudioId === 'function') ? getStudioId() : null; } catch (e) { sid = null; }
    if (!sid && currentProfile && currentProfile.studio_id) sid = currentProfile.studio_id;
    if (sid) return sid;
    if (currentProfile && currentProfile.own_studio_id) return currentProfile.own_studio_id;
    var r = await sb.from('studios').select('id').eq('slug', UPSIDE_SLUG).maybeSingle();
    return r.data ? r.data.id : null;
  }

  // ---------- chargement ----------

  async function loadWellnessConfigTab() {
    var panel = document.getElementById('admin-suivi-panel');
    if (!panel) return;
    panel.innerHTML = '<div class="spinner"></div>';

    try {
      var own = await _resolveOwnStudioId();

      if (_isUpsideAdmin()) {
        var r = await sb.from('studios').select('id,name,slug,wellness_config').order('name');
        _wcStudios = r.data || [];
      } else {
        var r2 = await sb.from('studios').select('id,name,slug,wellness_config').eq('id', own).maybeSingle();
        _wcStudios = r2.data ? [r2.data] : [];
      }

      if (!_wcStudios.length) {
        panel.innerHTML = '<div class="empty"><p>Aucun studio accessible.</p></div>';
        return;
      }

      if (!_wcStudioId || !_wcStudios.some(function (s) { return s.id === _wcStudioId; })) {
        _wcStudioId = (own && _wcStudios.some(function (s) { return s.id === own; })) ? own : _wcStudios[0].id;
      }

      _loadDraftForStudio();
      await _renderPanel();
    } catch (e) {
      console.warn('wellness config load', e);
      panel.innerHTML = '<div class="empty"><p>Erreur de chargement : ' + _esc(e.message || e) + '</p></div>';
    }
  }

  function _loadDraftForStudio() {
    var st = _wcStudios.find(function (s) { return s.id === _wcStudioId; });
    var cfg = st && st.wellness_config;
    if (!cfg || !Array.isArray(cfg.fields) || !cfg.fields.length) cfg = _defaultConfig();
    // copie profonde pour éditer sans toucher au cache
    _wcConfig = JSON.parse(JSON.stringify(cfg));
    if (!_wcConfig.scale_max) _wcConfig.scale_max = 5;
    _wcDirty = false;
  }

  // ---------- rendu ----------

  async function _renderPanel() {
    var panel = document.getElementById('admin-suivi-panel');
    if (!panel) return;

    var studioPicker = '';
    if (_isUpsideAdmin() && _wcStudios.length > 1) {
      studioPicker =
        '<div class="wc-card">' +
          '<div class="wc-lab">Studio à configurer</div>' +
          '<select class="wc-select" id="wc-studio-select">' +
            _wcStudios.map(function (s) {
              return '<option value="' + _esc(s.id) + '"' + (s.id === _wcStudioId ? ' selected' : '') + '>' +
                     _esc(s.name || s.slug) + '</option>';
            }).join('') +
          '</select>' +
          '<div class="wc-hint">Réservé aux admins Upside — chaque studio ne voit que le sien.</div>' +
        '</div>';
    }

    var activeCount = _wcConfig.fields.filter(function (f) { return f.active; }).length;

    var warn = '';
    if (activeCount > WARN_FIELDS) {
      warn = '<div class="wc-warn">⚠️ ' + activeCount + ' champs actifs. Au-delà de ' + WARN_FIELDS +
             ', les athlètes remplissent nettement moins. ' + MAX_FIELDS + ' maximum.</div>';
    }

    var rows = _wcConfig.fields.map(function (f, i) {
      return '' +
        '<div class="wc-row' + (f.active ? '' : ' off') + '" data-i="' + i + '">' +
          '<div class="wc-row-top">' +
            '<input class="wc-icon" type="text" maxlength="2" value="' + _esc(f.icon || '') + '" ' +
                   'data-i="' + i + '" data-k="icon" aria-label="Icône">' +
            '<input class="wc-label" type="text" value="' + _esc(f.label || '') + '" ' +
                   'data-i="' + i + '" data-k="label" placeholder="Nom du champ" aria-label="Libellé">' +
            '<button class="wc-mini" data-act="up" data-i="' + i + '" title="Monter"' +
                   (i === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button class="wc-mini" data-act="down" data-i="' + i + '" title="Descendre"' +
                   (i === _wcConfig.fields.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '<button class="wc-mini danger" data-act="del" data-i="' + i + '" title="Supprimer">✕</button>' +
          '</div>' +
          '<div class="wc-row-opts">' +
            '<label class="wc-chk"><input type="checkbox" data-i="' + i + '" data-k="active"' +
              (f.active ? ' checked' : '') + '> Actif</label>' +
            '<label class="wc-chk"><input type="checkbox" data-i="' + i + '" data-k="inverted"' +
              (f.inverted ? ' checked' : '') + '> Une note haute est <b>mauvaise</b></label>' +
          '</div>' +
        '</div>';
    }).join('');

    panel.innerHTML =
      '<div class="wc-head">' +
        '<div class="wc-title">Suivi athlète</div>' +
        '<div class="wc-sub">Tes athlètes renseignent toujours leur état au réveil. ' +
          'Ajoute ici les champs supplémentaires qu\'ils notent de 1 à 5, dans leur espace perso.</div>' +
      '</div>' +
      studioPicker +
      '<div class="wc-card">' +
        '<div class="wc-lab">Champs supplémentaires</div>' +
        '<div class="wc-hint" style="margin-bottom:10px">Facultatif — sans aucun champ actif, ' +
          'la saisie se limite à l\'état au réveil.</div>' +
        warn +
        '<div id="wc-rows">' + rows + '</div>' +
        '<button class="wc-add" id="wc-add-btn"' +
          (_wcConfig.fields.length >= MAX_FIELDS ? ' disabled' : '') + '>+ Ajouter un champ</button>' +
      '</div>' +
      '<div class="wc-card">' +
        '<div class="wc-lab">Aperçu côté athlète</div>' +
        '<div id="wc-preview"></div>' +
      '</div>' +
      '<button class="btn-primary" id="wc-save-btn">' +
        (_wcDirty ? '💾 Enregistrer les modifications' : 'Enregistrer') + '</button>' +
      '<div class="wc-card" style="margin-top:18px">' +
        '<div class="wc-lab">Mon numéro WhatsApp</div>' +
        '<div class="wc-hint">Utilisé par le bouton « Envoyer à mon coach ». ' +
          'Visible uniquement par les membres de ton studio.</div>' +
        '<input class="wc-phone" id="wc-phone" type="tel" inputmode="tel" ' +
               'placeholder="06 12 34 56 78" value="">' +
        '<button class="wc-add" id="wc-phone-save">Enregistrer mon numéro</button>' +
      '</div>';

    _renderPreview();
    _wireEvents();
    _loadMyPhone();
  }

  function _renderPreview() {
    var box = document.getElementById('wc-preview');
    if (!box) return;
    var fields = _wcConfig.fields.filter(function (f) { return f.active; });
    // Toujours en tête : l'état au réveil, commun à tous les studios.
    var wake =
      '<div class="wc-prev-row">' +
        '<div class="wc-prev-lab">Au réveil</div>' +
        '<div class="wc-dots">' +
          '<span class="wc-dot">💪</span><span class="wc-dot">😊</span>' +
          '<span class="wc-dot">😮‍💨</span><span class="wc-dot">🥵</span>' +
        '</div>' +
      '</div>';
    if (!fields.length) {
      box.innerHTML = wake +
        '<div class="wc-hint">Aucun champ supplémentaire — l\'athlète renseigne seulement son état au réveil.</div>';
      return;
    }
    var max = _wcConfig.scale_max || 5;
    box.innerHTML = wake + fields.map(function (f) {
      var dots = '';
      for (var v = 1; v <= max; v++) dots += '<span class="wc-dot">' + v + '</span>';
      return '<div class="wc-prev-row">' +
               '<div class="wc-prev-lab">' + _esc(f.icon || '') + ' ' + _esc(f.label || '—') + '</div>' +
               '<div class="wc-dots">' + dots + '</div>' +
             '</div>';
    }).join('');
  }

  function _wireEvents() {
    var panel = document.getElementById('admin-suivi-panel');
    if (!panel) return;

    var sel = document.getElementById('wc-studio-select');
    if (sel) sel.addEventListener('change', function () {
      if (_wcDirty && !confirm('Modifications non enregistrées. Changer de studio quand même ?')) {
        sel.value = _wcStudioId;
        return;
      }
      _wcStudioId = sel.value;
      _loadDraftForStudio();
      _renderPanel();
    });

    // saisie texte (icône / libellé)
    panel.querySelectorAll('.wc-icon, .wc-label').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var i = parseInt(inp.dataset.i, 10);
        var k = inp.dataset.k;
        if (isNaN(i) || !_wcConfig.fields[i]) return;
        _wcConfig.fields[i][k] = inp.value;
        _wcDirty = true;
        _renderPreview();
      });
    });

    // cases à cocher
    panel.querySelectorAll('.wc-chk input').forEach(function (chk) {
      chk.addEventListener('change', function () {
        var i = parseInt(chk.dataset.i, 10);
        var k = chk.dataset.k;
        if (isNaN(i) || !_wcConfig.fields[i]) return;
        if (k === 'active' && chk.checked) {
          var active = _wcConfig.fields.filter(function (f) { return f.active; }).length;
          if (active >= MAX_FIELDS) {
            chk.checked = false;
            _toast('⚠️ ' + MAX_FIELDS + ' champs actifs maximum');
            return;
          }
        }
        _wcConfig.fields[i][k] = chk.checked;
        _wcDirty = true;
        _renderPanel();
      });
    });

    // boutons de ligne
    panel.querySelectorAll('.wc-mini').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = parseInt(btn.dataset.i, 10);
        var act = btn.dataset.act;
        if (isNaN(i) || !_wcConfig.fields[i]) return;
        if (act === 'up' && i > 0) {
          var t = _wcConfig.fields[i - 1];
          _wcConfig.fields[i - 1] = _wcConfig.fields[i];
          _wcConfig.fields[i] = t;
        } else if (act === 'down' && i < _wcConfig.fields.length - 1) {
          var t2 = _wcConfig.fields[i + 1];
          _wcConfig.fields[i + 1] = _wcConfig.fields[i];
          _wcConfig.fields[i] = t2;
        } else if (act === 'del') {
          if (!confirm('Supprimer « ' + (_wcConfig.fields[i].label || 'ce champ') + ' » ?\n' +
                       'Les saisies déjà enregistrées sont conservées.')) return;
          _wcConfig.fields.splice(i, 1);
        }
        _wcDirty = true;
        _renderPanel();
      });
    });

    var add = document.getElementById('wc-add-btn');
    if (add) add.addEventListener('click', function () {
      if (_wcConfig.fields.length >= MAX_FIELDS) return;
      _wcConfig.fields.push({ key: '', label: '', icon: '📋', inverted: false, active: true });
      _wcDirty = true;
      _renderPanel();
    });

    var save = document.getElementById('wc-save-btn');
    if (save) save.addEventListener('click', _saveConfig);

    var pSave = document.getElementById('wc-phone-save');
    if (pSave) pSave.addEventListener('click', _saveMyPhone);
  }

  // ---------- enregistrement ----------

  async function _saveConfig() {
    // validation
    var seen = {};
    for (var i = 0; i < _wcConfig.fields.length; i++) {
      var f = _wcConfig.fields[i];
      var label = (f.label || '').trim();
      if (!label) { _toast('⚠️ Un champ est sans nom'); return; }
      // la clé est figée à la création pour ne pas casser l'historique
      if (!f.key) f.key = _slugify(label);
      if (seen[f.key]) { _toast('⚠️ Deux champs portent le même nom : ' + label); return; }
      seen[f.key] = 1;
      f.label = label;
      f.icon = (f.icon || '').trim();
      f.inverted = !!f.inverted;
      f.active = !!f.active;
    }
    var active = _wcConfig.fields.filter(function (f) { return f.active; }).length;
    // Zéro champ actif est permis : l'athlète renseigne alors seulement son
    // état au réveil, qui ne dépend pas de cette config.
    if (active > MAX_FIELDS) { _toast('⚠️ ' + MAX_FIELDS + ' champs actifs maximum'); return; }

    _wcConfig.scale_max = 5;

    var btn = document.getElementById('wc-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }

    var r = await sb.from('studios')
      .update({ wellness_config: _wcConfig })
      .eq('id', _wcStudioId)
      .select('id,wellness_config');

    if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }

    if (r.error) { _toast('❌ ' + r.error.message); return; }
    if (!r.data || !r.data.length) {
      _toast('❌ Rien n\'a été enregistré — droits insuffisants sur ce studio');
      return;
    }

    // met à jour le cache local
    var st = _wcStudios.find(function (s) { return s.id === _wcStudioId; });
    if (st) st.wellness_config = JSON.parse(JSON.stringify(_wcConfig));
    _wcDirty = false;
    _toast('✅ Suivi mis à jour');
    _renderPanel();
  }

  async function _loadMyPhone() {
    var inp = document.getElementById('wc-phone');
    if (!inp || !window.currentUser) return;
    try {
      var r = await sb.from('coach_contacts')
        .select('whatsapp_phone')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (r.data && r.data.whatsapp_phone) inp.value = r.data.whatsapp_phone;
    } catch (e) { console.warn('coach phone load', e); }
  }

  async function _saveMyPhone() {
    var inp = document.getElementById('wc-phone');
    if (!inp) return;
    var raw = inp.value.trim();

    if (!raw) {
      var rDel = await sb.from('coach_contacts').delete().eq('user_id', currentUser.id);
      if (rDel.error) { _toast('❌ ' + rDel.error.message); return; }
      _toast('🗑 Numéro retiré');
      return;
    }

    var phone = _normalizePhone(raw);
    if (!_phoneValid(phone)) {
      _toast('⚠️ Numéro invalide — format attendu 06 12 34 56 78 ou +33612345678');
      return;
    }

    var r = await sb.from('coach_contacts')
      .upsert({ user_id: currentUser.id, whatsapp_phone: phone, updated_at: new Date().toISOString() },
              { onConflict: 'user_id' })
      .select('user_id');

    if (r.error) { _toast('❌ ' + r.error.message); return; }
    inp.value = phone;
    _toast('✅ Numéro enregistré');
  }

  // ---------- injection dans l'UI admin ----------

  function _injectStyles() {
    if (document.getElementById('wc-styles')) return;
    var st = document.createElement('style');
    st.id = 'wc-styles';
    st.textContent = [
      '.wc-head{margin-bottom:14px}',
      '.wc-title{font-family:"Bebas Neue",sans-serif;font-size:20px;letter-spacing:2px;margin-bottom:4px}',
      '.wc-sub{font-size:12px;color:var(--muted)}',
      '.wc-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px}',
      '.wc-lab{font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:var(--muted);margin-bottom:10px;font-weight:700}',
      '.wc-hint{font-size:11px;color:var(--muted);margin-top:8px;line-height:1.5}',
      '.wc-warn{background:rgba(255,140,71,.08);border:1px solid rgba(255,140,71,.3);color:var(--orange,#ff8c47);',
      'border-radius:10px;padding:9px 11px;font-size:12px;line-height:1.5;margin-bottom:12px}',
      '.wc-select,.wc-phone{width:100%;background:var(--dark);border:1.5px solid var(--border2);border-radius:10px;',
      'color:var(--text);font-family:inherit;font-size:14px;padding:10px}',
      '.wc-row{border:1px solid var(--border);border-radius:12px;padding:10px;margin-bottom:8px;background:var(--dark)}',
      '.wc-row.off{opacity:.45}',
      '.wc-row-top{display:flex;gap:6px;align-items:center}',
      '.wc-icon{width:44px;text-align:center;background:var(--card);border:1.5px solid var(--border2);',
      'border-radius:8px;color:var(--text);font-size:16px;padding:8px 4px;flex:0 0 auto}',
      '.wc-label{flex:1;min-width:0;background:var(--card);border:1.5px solid var(--border2);border-radius:8px;',
      'color:var(--text);font-family:inherit;font-size:14px;padding:8px 10px}',
      '.wc-mini{flex:0 0 auto;width:30px;height:34px;background:transparent;border:1px solid var(--border2);',
      'border-radius:8px;color:var(--muted);font-size:13px;cursor:pointer}',
      '.wc-mini:disabled{opacity:.3;cursor:default}',
      '.wc-mini.danger{color:var(--red)}',
      '.wc-row-opts{display:flex;flex-wrap:wrap;gap:14px;margin-top:9px;padding-left:2px}',
      '.wc-chk{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer}',
      '.wc-chk b{color:var(--text);font-weight:700}',
      '.wc-add{width:100%;margin-top:8px;background:transparent;border:1px dashed var(--border2);',
      'color:var(--muted);border-radius:10px;padding:10px;font-size:13px;font-weight:600;cursor:pointer}',
      '.wc-add:disabled{opacity:.4;cursor:default}',
      '.wc-prev-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;',
      'border-bottom:1px solid var(--border)}',
      '.wc-prev-row:last-child{border-bottom:0}',
      '.wc-prev-lab{font-size:13px;font-weight:600}',
      '.wc-dots{display:flex;gap:6px}',
      '.wc-dot{width:30px;height:30px;border-radius:50%;border:1.5px solid var(--border2);color:var(--muted);',
      'font-size:12px;display:flex;align-items:center;justify-content:center}'
    ].join('');
    document.head.appendChild(st);
  }

  function _injectTab() {
    if (document.getElementById('admin-suivi-tab-btn')) return true;

    var tabBar = document.querySelector('.admin-tab-bar');
    if (!tabBar) {
      var anyBtn = document.querySelector('.admin-tab-btn');
      tabBar = anyBtn ? anyBtn.parentElement : null;
    }
    if (!tabBar) return false;

    var adminPage = document.getElementById('page-admin');
    if (!adminPage) return false;

    var btn = document.createElement('button');
    btn.className = 'admin-tab-btn';
    btn.id = 'admin-suivi-tab-btn';
    btn.textContent = '⚙️ Suivi';
    btn.onclick = function () {
      if (typeof adminTab === 'function') {
        adminTab('suivi', this);
      } else {
        // repli : bascule manuelle si adminTab n'est pas joignable
        document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.admin-panel').forEach(function (p) { p.classList.remove('active'); });
        this.classList.add('active');
        document.getElementById('admin-suivi').classList.add('active');
      }
      // appel direct : ne dépend pas du hook sur adminTab
      loadWellnessConfigTab();
    };
    tabBar.appendChild(btn);

    var panel = document.createElement('div');
    panel.className = 'admin-panel';
    panel.id = 'admin-suivi';
    panel.innerHTML = '<div id="admin-suivi-panel"><div class="spinner"></div></div>';
    adminPage.appendChild(panel);

    return true;
  }

  function _hookAdminTab() {
    if (typeof window.adminTab !== 'function' || window.__wcAdminTabHooked) return;
    window.__wcAdminTabHooked = true;
    var _orig = window.adminTab;
    window.adminTab = function (tab, btn) {
      _orig.apply(this, arguments);
      // le panel « suivi » est aussi chargé par le onclick du bouton :
      // ce hook couvre les appels à adminTab('suivi') venus d'ailleurs.
      if (tab === 'suivi' && !_wcConfig) loadWellnessConfigTab();
    };
  }

  function _init() {
    _injectStyles();
    var ok = _injectTab();
    _hookAdminTab();
    return ok;
  }

  // L'injection a besoin du DOM admin ; la lecture des données attend
  // studio:ready (elle n'a lieu qu'au clic sur l'onglet, bien après).
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

  // exposé pour debug / rechargement manuel
  window.loadWellnessConfigTab = loadWellnessConfigTab;
})();
