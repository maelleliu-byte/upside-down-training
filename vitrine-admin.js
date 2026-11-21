/* ============================================================
 * ÉDITEUR DE PROGRAMMATION (Admin → Programmations → ✏)
 * Nom, description, prix + tout ce qui s'affiche dans la vitrine
 * (« Accès aux programmations » et pages publiques /p/<lien>) :
 * visibilité, ordre, lien court, titre, accroche, pastilles, description,
 * « Ce que tu trouves dedans », photo (convertie en noir et blanc) et cadrage.
 * Aperçu en direct à droite (en dessous sur téléphone).
 * ============================================================ */
(function () {
  'use strict';

  var cur = null;        // programme en cours d'édition
  var photoBlob = null;  // nouvelle photo (déjà en N&B), envoyée à l'enregistrement

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(id) { return document.getElementById(id); }
  function lines(v) { return String(v || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  function slugify(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

  function css() {
    if ($('pe-css')) return;
    var st = document.createElement('style'); st.id = 'pe-css';
    st.textContent = [
      '#pe-ov{position:fixed;inset:0;z-index:400;background:rgba(0,0,0,.88);display:flex;justify-content:center;align-items:flex-start;overflow-y:auto;padding:20px 10px 40px}',
      '#pe-box{background:var(--card);border:1px solid var(--border2);border-radius:18px;width:100%;max-width:1040px;padding:18px 18px 22px;position:relative}',
      '#pe-box h3{font-family:"Bebas Neue",sans-serif;letter-spacing:2px;font-weight:400;font-size:26px;margin:0 0 2px}',
      '.pe-sub{font-size:12px;color:var(--muted);margin-bottom:14px}',
      '.pe-x{position:absolute;top:10px;right:14px;background:none;border:none;color:var(--muted);font-size:26px;cursor:pointer}',
      '.pe-grid{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:20px;align-items:start}',
      '@media (max-width:860px){.pe-grid{grid-template-columns:1fr}}',
      '.pe-sec{font-size:10px;font-weight:700;letter-spacing:2px;color:var(--accent);text-transform:uppercase;margin:18px 0 10px;padding-top:12px;border-top:1px solid var(--border)}',
      '.pe-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.pe-help{font-size:11px;color:var(--muted);margin-top:5px;line-height:1.45}',
      '.pe-prev{position:sticky;top:10px}',
      '.pe-prev .v-card{max-width:400px}',
      '.pe-photo{display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
      '.pe-thumb{width:64px;height:64px;border-radius:10px;background:#141416 center/cover;border:1px solid var(--border2);flex:none}',
      '.pe-actions{display:flex;gap:10px;margin-top:18px}',
      '.pe-actions button{flex:1}',
      '.pe-switch{display:flex;align-items:center;gap:10px;font-size:13.5px;cursor:pointer}',
      '.pe-switch input{width:18px;height:18px;accent-color:var(--accent)}',
      'input[type=range].pe-range{width:100%}'
    ].join('');
    document.head.appendChild(st);
  }

  function field(id, label, html, help) {
    return '<div class="form-group"><label class="form-label" for="' + id + '">' + label + '</label>' + html +
      (help ? '<div class="pe-help">' + help + '</div>' : '') + '</div>';
  }

  function posXY(pos) {
    var m = String(pos || '').match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
    return m ? [+m[1], +m[2]] : [50, 40];
  }

  /* objet programme reconstitué depuis le formulaire, pour l'aperçu et l'enregistrement */
  function formRow() {
    var x = +$('pe-px').value, y = +$('pe-py').value;
    return Object.assign({}, cur, {
      name: $('pe-name').value.trim() || cur.name,
      vitrine_visible: $('pe-vis').checked,
      vitrine_order: $('pe-order').value === '' ? null : +$('pe-order').value,
      vitrine_link: slugify($('pe-link').value) || null,
      vitrine_title: $('pe-title').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).join('\n') || null,
      vitrine_tagline: $('pe-tag').value.trim() || null,
      vitrine_chips: lines($('pe-chips').value),
      vitrine_desc: $('pe-desc').value.trim() || null,
      vitrine_features: lines($('pe-feats').value),
      vitrine_photo: $('pe-photo').dataset.url || null,
      vitrine_pos: Math.round(x) + '% ' + Math.round(y) + '%'
    });
  }

  function preview() {
    if (!window.udtVitrine) return;
    var r = formRow();
    var box = $('pe-prev');
    if (!r.vitrine_title) { box.innerHTML = '<div class="pe-help" style="padding:30px;text-align:center">Renseigne au moins le titre pour voir l\'aperçu.</div>'; return; }
    udtVitrine.css();
    box.innerHTML = '<div class="form-label" style="margin-bottom:8px">Aperçu</div>' + udtVitrine.cardHTML(r, { ctaAction: '', staff: false });
    $('pe-linkprev').textContent = r.vitrine_link ? 'app.upsidedown-training.fr/p/' + r.vitrine_link : '—';
  }

  /* photo : redimensionnée (1000 px max) et convertie en noir et blanc avant envoi */
  function onPhoto(file) {
    if (!file) return;
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var W = Math.min(1000, img.naturalWidth), H = Math.round(img.naturalHeight * W / img.naturalWidth);
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, W, H);
      var d = ctx.getImageData(0, 0, W, H), a = d.data;
      for (var i = 0; i < a.length; i += 4) {
        var g = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
        g = Math.max(0, Math.min(255, (g - 128) * 1.1 + 128));   /* léger contraste */
        a[i] = a[i + 1] = a[i + 2] = g;
      }
      ctx.putImageData(d, 0, 0);
      c.toBlob(function (b) {
        photoBlob = b;
        var local = URL.createObjectURL(b);
        var el = $('pe-photo'); el.dataset.url = local; el.dataset.local = '1';
        $('pe-thumb').style.backgroundImage = 'url(' + local + ')';
        preview();
      }, 'image/jpeg', 0.82);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  window.openProgEditor = function (id) {
    var p = (typeof programmes !== 'undefined' ? programmes : []).find(function (x) { return x.id === id; });
    if (!p) { if (typeof showToast === 'function') showToast('❌ Programme introuvable'); return; }
    cur = p; photoBlob = null; css();
    var c = window.udtVitrine ? udtVitrine.cfgOf(p.slug, p) : null;   /* textes actuels (base ou secours) */
    var xy = posXY(p.vitrine_pos || (c && c.pos));
    var title = p.vitrine_title || (c ? c.titleText : '');
    var photo = p.vitrine_photo || (c ? c.photo : '');
    var isSub = p.type === 'subscription';
    var ov = document.createElement('div'); ov.id = 'pe-ov';
    ov.innerHTML = '<div id="pe-box"><button class="pe-x" onclick="closeProgEditor()">×</button>' +
      '<h3 style="color:' + esc(p.color) + '">✏ ' + esc(p.name) + '</h3>' +
      '<div class="pe-sub">Ce que tu modifies ici s\'affiche dans « Accès aux programmations » et sur la page publique du programme.</div>' +
      '<div class="pe-grid"><div>' +
      '<div class="pe-row">' +
      field('pe-name', 'Nom du programme', '<input class="form-input" id="pe-name" value="' + esc(p.name) + '">', 'Nom dans la rangée des programmations.') +
      (isSub ? field('pe-price', 'Prix mensuel (€)', '<input class="form-input" id="pe-price" type="number" step="0.01" min="0" value="' + esc(p.price_monthly || '') + '">', 'Synchronisé avec Stripe à l\'enregistrement.')
        : field('pe-price1', 'Prix', '<input class="form-input" disabled value="' + esc(p.price_oneshot ? p.price_oneshot + ' € (achat unique)' : '—') + '">')) +
      '</div>' +
      field('pe-adesc', 'Description courte (admin)', '<input class="form-input" id="pe-adesc" value="' + esc(p.description || '') + '">') +

      '<div class="pe-sec">Vitrine</div>' +
      '<div class="pe-row">' +
      '<div class="form-group"><label class="pe-switch"><input type="checkbox" id="pe-vis"' + (p.vitrine_visible ? ' checked' : '') + '> Visible dans la vitrine</label>' +
      '<div class="pe-help">Décoché : le programme n\'apparaît ni dans « Accès aux programmations » ni en public.</div></div>' +
      field('pe-order', 'Ordre', '<input class="form-input" id="pe-order" type="number" min="1" value="' + esc(p.vitrine_order != null ? p.vitrine_order : '') + '">', '1 = premier onglet. Sert aussi à ordonner la rangée.') +
      '</div>' +
      field('pe-link', 'Lien court', '<input class="form-input" id="pe-link" value="' + esc(p.vitrine_link || (c ? c.link : '')) + '">', 'Adresse : <b id="pe-linkprev"></b>') +
      field('pe-title', 'Titre affiché', '<textarea class="form-textarea" id="pe-title" rows="2">' + esc(title) + '</textarea>', 'Une ligne par ligne du titre. La 2ᵉ ligne prend la couleur du programme (ex. RUNNING / CLUB).') +
      field('pe-tag', 'Accroche', '<input class="form-input" id="pe-tag" value="' + esc(p.vitrine_tagline || (c ? c.tag : '')) + '">', 'Phrase en italique sous le titre.') +
      field('pe-chips', 'Pastilles', '<textarea class="form-textarea" id="pe-chips" rows="5">' + esc((p.vitrine_chips || (c ? c.chips : [])).join('\n')) + '</textarea>', 'Une pastille par ligne (ex. 3 séances / sem.).') +
      field('pe-desc', 'Description', '<textarea class="form-textarea" id="pe-desc" rows="3">' + esc(p.vitrine_desc || (c ? c.desc : '')) + '</textarea>') +
      field('pe-feats', 'Ce que tu trouves dedans', '<textarea class="form-textarea" id="pe-feats" rows="5">' + esc((p.vitrine_features || (c ? c.features : [])).join('\n')) + '</textarea>', 'Un point par ligne.') +

      '<div class="form-group"><label class="form-label">Photo</label><div class="pe-photo">' +
      '<div class="pe-thumb" id="pe-thumb" style="background-image:url(' + esc(photo) + ')"></div>' +
      '<input type="file" id="pe-file" accept="image/*" style="display:none">' +
      '<button class="btn-secondary" type="button" onclick="document.getElementById(\'pe-file\').click()">📷 Changer la photo</button>' +
      '<span id="pe-photo" data-url="' + esc(photo) + '"></span></div>' +
      '<div class="pe-help">Convertie automatiquement en noir et blanc. Évite les visages de personnes qui n\'ont pas donné leur accord.</div></div>' +
      '<div class="pe-row">' +
      field('pe-px', 'Cadrage horizontal', '<input type="range" class="pe-range" id="pe-px" min="0" max="100" value="' + xy[0] + '">', 'Gauche ↔ droite') +
      field('pe-py', 'Cadrage vertical', '<input type="range" class="pe-range" id="pe-py" min="0" max="100" value="' + xy[1] + '">', 'Haut ↕ bas') +
      '</div>' +
      '<div class="pe-actions"><button class="btn-secondary" onclick="closeProgEditor()">Annuler</button>' +
      '<button class="btn-primary" id="pe-save" onclick="saveProgEditor()">Enregistrer</button></div>' +
      '</div><div class="pe-prev" id="pe-prev"></div></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('input', function (e) { if (e.target.id !== 'pe-file') preview(); });
    $('pe-file').addEventListener('change', function (e) { onPhoto(e.target.files && e.target.files[0]); });
    preview();
  };

  window.closeProgEditor = function () { var o = $('pe-ov'); if (o) o.remove(); cur = null; photoBlob = null; };

  window.saveProgEditor = async function () {
    if (!cur) return;
    var p = cur, btn = $('pe-save');
    var r = formRow();
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    try {
      /* 1. photo */
      var photo = $('pe-photo').dataset.local ? null : (r.vitrine_photo || null);
      if (photoBlob) {
        var path = (p.slug || p.id) + '-' + Date.now() + '.jpg';
        var up = await sb.storage.from('vitrine').upload(path, photoBlob, { contentType: 'image/jpeg', upsert: true });
        if (up.error) throw new Error('Photo : ' + up.error.message);
        photo = sb.storage.from('vitrine').getPublicUrl(path).data.publicUrl;
      }
      /* 2. lien court unique */
      if (r.vitrine_link) {
        var dup = (typeof programmes !== 'undefined' ? programmes : []).find(function (x) { return x.id !== p.id && String(x.vitrine_link || '').toLowerCase() === r.vitrine_link; });
        if (dup) throw new Error('Le lien « ' + r.vitrine_link + ' » est déjà utilisé par ' + dup.name);
      }
      var upd = {
        name: r.name, description: $('pe-adesc').value.trim(),
        vitrine_visible: r.vitrine_visible, vitrine_order: r.vitrine_order, vitrine_link: r.vitrine_link,
        vitrine_title: r.vitrine_title, vitrine_tagline: r.vitrine_tagline,
        vitrine_chips: r.vitrine_chips.length ? r.vitrine_chips : null, vitrine_desc: r.vitrine_desc,
        vitrine_features: r.vitrine_features.length ? r.vitrine_features : null,
        vitrine_photo: photo, vitrine_pos: r.vitrine_pos
      };
      var newPrice = null;
      if (p.type === 'subscription' && $('pe-price')) {
        var v = $('pe-price').value.trim();
        newPrice = v === '' ? null : parseFloat(v);
        upd.price_monthly = newPrice;
      }
      var res = await sb.from('programmes').update(upd).eq('id', p.id);
      if (res.error) throw new Error(res.error.message);
      if (typeof showToast === 'function') showToast('✅ Programme mis à jour');

      /* 3. Stripe si le prix ou le nom a changé */
      var priceChanged = p.type === 'subscription' && newPrice && +newPrice !== +p.price_monthly;
      if (priceChanged || (upd.name !== p.name && p.stripe_product_id)) {
        try {
          var sess = (await sb.auth.getSession()).data.session;
          var fnUrl = (window.SUPABASE_URL || sb.supabaseUrl || '').replace(/\/$/, '') + '/functions/v1/create-stripe-product';
          var rr = await fetch(fnUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (sess ? sess.access_token : '') },
            body: JSON.stringify({ programme_id: p.id, name: upd.name, description: upd.description, price_monthly: newPrice || p.price_monthly, currency: 'eur' })
          });
          var dj = await rr.json();
          if (typeof showToast === 'function') showToast(dj.error ? '⚠️ Stripe : ' + dj.error : '✅ Stripe synchronisé');
        } catch (e) { console.warn(e); }
      }
      closeProgEditor();
      if (typeof loadProgrammes === 'function') await loadProgrammes();
      if (typeof loadAdminProgs === 'function') await loadAdminProgs();
    } catch (e) {
      if (typeof showToast === 'function') showToast('❌ ' + e.message); else alert(e.message);
      btn.disabled = false; btn.textContent = 'Enregistrer';
    }
  };
})();
