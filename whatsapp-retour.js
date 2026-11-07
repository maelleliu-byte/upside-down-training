/* ============================================================================
 * whatsapp-retour.js — Retour de séance envoyé à l'athlète sur WhatsApp
 * ----------------------------------------------------------------------------
 * POSE : une ligne dans index.html, APRÈS wellness.js et profil-layout.js
 *     <script src="whatsapp-retour.js?v=20261105a"></script>
 *
 * Script classique, aucune dépendance, aucune migration SQL.
 * Ne modifie ni admin.js, ni wellness.js, ni core.js : enveloppe
 * loadPersoRetours(), persoRetourBlock() et _injectProfilExtras().
 *
 * DEUX MOITIÉS
 *   1. ATHLÈTE — champ « Mon numéro WhatsApp » sur la page Profil.
 *      Écrit dans coach_contacts (user_id, whatsapp_phone), la même table que
 *      le numéro du coach : RLS déjà en place (écriture de sa propre ligne,
 *      lecture par les membres du même studio). Rien à migrer.
 *
 *   2. COACH — dans l'espace perso d'un athlète, sous le bloc « Retour
 *      athlète » de chaque séance : une zone de texte + un bouton qui ouvre
 *      WhatsApp avec le message déjà écrit. Pas d'API Meta, pas de template,
 *      pas de fenêtre de 24 h : c'est un lien wa.me, le coach appuie sur
 *      envoyer.
 *
 * Le numéro est stocké en format international (+33612345678) : wa.me ne
 * comprend pas le 06.
 * ========================================================================== */
(function(){
'use strict';

if(window.__patchBound_whatsappRetour) return;
window.__patchBound_whatsappRetour = true;

/* ========================= OUTILS ========================= */

function esc(s){
  return (s==null?'':String(s))
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function toast(msg){
  if(typeof showToast==='function') showToast(msg);
}

function me(){
  return (typeof currentUser!=='undefined' && currentUser) ? currentUser : null;
}
function myProfile(){
  return (typeof currentProfile!=='undefined' && currentProfile) ? currentProfile : null;
}
function isCoach(){
  const p = myProfile();
  return !!(p && (p.role==='admin' || p.role==='coach'));
}
function db(){
  return (typeof sb!=='undefined' && sb) ? sb : null;
}

/* 06 12 34 56 78 → +33612345678 · 0033… → +33… · 33612… → +33612… */
function normalizePhone(raw){
  if(!raw) return '';
  let s = String(raw).replace(/[\s.\-() ]/g,'');
  if(/^00/.test(s)) s = '+'+s.slice(2);
  if(/^0\d{9}$/.test(s)) s = '+33'+s.slice(1);
  if(/^\d{9,15}$/.test(s) && s[0]!=='0') s = '+'+s;
  return s;
}
function phoneValid(p){
  return /^\+\d{8,15}$/.test(p||'');
}

function firstName(full){
  return String(full||'').trim().split(/\s+/)[0] || '';
}

function prettyDate(iso){
  try{
    const d = new Date(iso+'T12:00:00');
    return d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  }catch(e){ return iso; }
}

/* ===================================================================
 * 1. ATHLÈTE — « Mon numéro WhatsApp » sur la page Profil
 * =================================================================== */

const PROFIL_BLOCK_ID = 'wr-profil-block';

function profilBlockHTML(){
  return ''+
    '<button type="button" class="pf-fold-head" id="wr-pf-toggle" aria-expanded="true">'+
      '<span class="pf-ic">📲</span><span class="pf-t">Mon numéro WhatsApp</span>'+
      '<span class="pf-sum" id="wr-pf-sum"><span class="pf-chip wr-todo">À renseigner</span></span><span class="pf-chev">›</span></button>'+
    '<div class="pf-fold-body">'+
    '<div class="wr-pf-sub">Pour que ton coach puisse t\'envoyer ses retours de séance '+
      'sur WhatsApp. Visible uniquement par les coachs de ton studio. '+
      'Laisse vide pour le retirer.</div>'+
    '<input type="tel" inputmode="tel" class="wr-pf-input" id="wr-pf-phone" '+
      'placeholder="06 12 34 56 78" autocomplete="tel">'+
    '<button type="button" class="wr-pf-save" id="wr-pf-save">Enregistrer mon numéro</button>'+
    '<div class="wr-pf-status" id="wr-pf-status"></div>'+
    '</div>';
}

function ensureProfilBlock(){
  const page = document.getElementById('page-profil');
  if(!page || document.getElementById(PROFIL_BLOCK_ID)) return;

  const box = document.createElement('div');
  box.id = PROFIL_BLOCK_ID;
  box.className = 'pf-fold wr-pf-fold open';
  box.innerHTML = profilBlockHTML();

  /* On se place à l'intérieur du même parent que les sections existantes,
     pour que profil-layout.js ne déplace pas le bloc (il ne réorganise que
     les enfants directs de #page-profil). */
  const anchor = document.getElementById('pf-fold-badges')
              || document.getElementById('pf-fold-perf')
              || page.querySelector('.profil-stats');
  if(anchor && anchor.parentNode) anchor.insertAdjacentElement('afterend', box);
  else page.appendChild(box);

  loadMyPhone();
}

/* En-tête repliable : ✓ Vérifié (vert) quand un numéro valide est enregistré, sinon « À renseigner ». */
function setPhoneState(phone){
  const box = document.getElementById(PROFIL_BLOCK_ID), sum = document.getElementById('wr-pf-sum');
  if(!box || !sum) return;
  const ok = phoneValid(phone||'');
  sum.innerHTML = ok
    ? '<span class="pf-chip wr-ok">✓ Vérifié</span>'
    : '<span class="pf-chip wr-todo">À renseigner</span>';
  box.classList.toggle('open', !ok);
  const h = document.getElementById('wr-pf-toggle'); if(h) h.setAttribute('aria-expanded', String(!ok));
}

function pfStatus(msg, bad){
  const el = document.getElementById('wr-pf-status');
  if(!el) return;
  el.style.color = bad ? 'var(--red,#ff4747)' : 'var(--muted)';
  el.textContent = msg || '';
}

async function loadMyPhone(){
  const inp = document.getElementById('wr-pf-phone');
  const u = me(), s = db();
  if(!inp || !u || !s) return;
  try{
    const {data} = await s.from('coach_contacts')
      .select('whatsapp_phone').eq('user_id',u.id).maybeSingle();
    if(data && data.whatsapp_phone) inp.value = data.whatsapp_phone;
    setPhoneState(data && data.whatsapp_phone);
  }catch(e){ console.warn('wr load phone',e); }
}

async function saveMyPhone(){
  const inp = document.getElementById('wr-pf-phone');
  const u = me(), s = db();
  if(!inp || !s) return;
  if(!u || !u.id){
    pfStatus('Session expirée — recharge la page et reconnecte-toi.', true);
    return;
  }

  const raw = inp.value.trim();

  if(!raw){
    const {error} = await s.from('coach_contacts').delete().eq('user_id',u.id);
    if(error){ pfStatus('Suppression refusée : '+error.message, true); return; }
    pfStatus('🗑 Numéro retiré');
    toast('🗑 Numéro retiré');
    setPhoneState('');
    return;
  }

  const phone = normalizePhone(raw);
  if(!phoneValid(phone)){
    pfStatus('Numéro non reconnu : « '+raw+' » devient « '+phone+' ». '+
             'Attendu 06 12 34 56 78 ou +33612345678.', true);
    return;
  }

  pfStatus('Enregistrement en cours…');
  const {data,error} = await s.from('coach_contacts')
    .upsert({user_id:u.id, whatsapp_phone:phone, updated_at:new Date().toISOString()},
            {onConflict:'user_id'})
    .select('user_id,whatsapp_phone');

  if(error){
    pfStatus('Refus de la base : '+error.message+(error.code?' ['+error.code+']':''), true);
    return;
  }
  if(!data || !data.length){
    pfStatus('Aucune ligne écrite — la règle d\'accès a bloqué l\'enregistrement.', true);
    return;
  }
  inp.value = data[0].whatsapp_phone;
  pfStatus('✅ Numéro enregistré : '+data[0].whatsapp_phone);
  toast('✅ Numéro WhatsApp enregistré');
  setPhoneState(data[0].whatsapp_phone);
}

/* Délégation : insensible au moment où le bloc est construit. */
document.addEventListener('click', function(ev){
  const t = ev.target && ev.target.closest ? ev.target.closest('button') : null;
  if(!t) return;
  if(t.id === 'wr-pf-toggle'){
    ev.preventDefault();
    const box = document.getElementById(PROFIL_BLOCK_ID);
    if(box){ const o = !box.classList.contains('open'); box.classList.toggle('open', o); t.setAttribute('aria-expanded', String(o)); }
    return;
  }
  if(t.id === 'wr-pf-save'){
    ev.preventDefault();
    saveMyPhone().catch(e=>pfStatus('Erreur : '+(e.message||e), true));
  }
  else if(t.classList.contains('wr-send')){
    ev.preventDefault();
    ev.stopPropagation();
    sendRetour(t.getAttribute('data-sid'), t.getAttribute('data-iso'));
  }
}, true);

/* ===================================================================
 * 2. COACH — bouton d'envoi dans le bloc « Retour athlète »
 * =================================================================== */

let _athPhone = null;   // numéro de l'athlète affiché dans l'espace perso
let _athId    = null;   // à qui ce numéro appartient

function viewedAthlete(){
  const a = (typeof currentPersoAthlete!=='undefined' && currentPersoAthlete)
          ? currentPersoAthlete : (window.currentPersoAthlete||null);
  return a || null;
}

/* Affiché seulement au coach, et jamais sur son propre espace perso. */
function canSend(){
  const u = me(), a = viewedAthlete();
  if(!u || !a || !isCoach()) return false;
  return a.id !== u.id;
}

async function loadAthletePhone(athleteId){
  const s = db();
  _athPhone = null; _athId = athleteId || null;
  if(!athleteId || !s || !isCoach()) return;
  const u = me();
  if(u && athleteId === u.id) return;
  try{
    const {data} = await s.from('coach_contacts')
      .select('whatsapp_phone').eq('user_id',athleteId).maybeSingle();
    if(data && data.whatsapp_phone) _athPhone = data.whatsapp_phone;
  }catch(e){ console.warn('wr load athlete phone',e); }
}

function sendBoxHTML(sid, iso){
  const a = viewedAthlete();
  const who = firstName(a && a.full_name) || 'ton athlète';

  if(!_athPhone){
    return '<div class="wr-box wr-box-off">'+
      '<span class="wr-off">📲 '+esc(who)+' n\'a pas encore renseigné son numéro WhatsApp '+
      '(à remplir depuis son profil).</span></div>';
  }

  return '<div class="wr-box">'+
    '<textarea class="wr-ta" id="wr-ta-'+esc(sid)+'" rows="3" '+
      'placeholder="Ton retour pour '+esc(who)+'…"></textarea>'+
    '<button type="button" class="wr-send" data-sid="'+esc(sid)+'" data-iso="'+esc(iso)+'">'+
      '📲 Envoyer sur WhatsApp</button>'+
  '</div>';
}

/* Contexte de la séance repris en tête du message, pour que l'athlète sache
   de quelle séance on parle. */
function contextLine(sid){
  const cache = window._persoRetoursCache
             || (typeof _persoRetoursCache!=='undefined' ? _persoRetoursCache : null);
  const sc = cache && cache.scoresBySid ? cache.scoresBySid[sid] : null;
  if(!sc) return '';
  const v = sc.score_text || (typeof sc.score_value==='number' ? sc.score_value : '');
  if(v==='' || v==null) return '';
  let out = 'Score : '+String(v);
  if(sc.level) out += ' ('+String(sc.level).toUpperCase()+')';
  return out;
}

function sendRetour(sid, iso){
  if(!sid) return;
  const ta = document.getElementById('wr-ta-'+sid);
  const txt = ta ? ta.value.trim() : '';
  if(!txt){
    toast('⚠️ Écris ton retour avant d\'envoyer');
    if(ta) ta.focus();
    return;
  }
  if(!_athPhone){
    toast('⚠️ Cet athlète n\'a pas renseigné son numéro WhatsApp');
    return;
  }

  const a = viewedAthlete();
  const who = firstName(a && a.full_name);

  const head = [];
  if(who) head.push('Salut '+who+' 👋');
  const dateLine = iso ? ('Séance du '+prettyDate(iso)) : '';
  const ctx = contextLine(sid);
  const sub = [dateLine, ctx].filter(Boolean).join(' — ');
  if(sub) head.push(sub);

  const msg = (head.length ? head.join('\n')+'\n\n' : '') + txt;

  const url = 'https://wa.me/'+_athPhone.replace(/\D/g,'')+'?text='+encodeURIComponent(msg);
  window.open(url,'_blank');
}
window.wrSendRetour = sendRetour;

/* ========================= STYLES ========================= */

function injectStyles(){
  if(document.getElementById('wr-styles')) return;
  const st = document.createElement('style');
  st.id = 'wr-styles';
  st.textContent =
    /* page Profil */
    '.wr-pf-box{margin:0 20px 16px;background:var(--card);border:1px solid var(--border);'+
      'border-radius:12px;padding:14px}'+
    '.wr-pf-head{font-family:"Bebas Neue",sans-serif;font-size:16px;letter-spacing:1.5px;margin-bottom:6px}'+
    '.wr-pf-fold .pf-chip.wr-ok{color:#2ecc71;border-color:rgba(46,204,113,.5);background:rgba(46,204,113,.12);font-weight:700}'+
    '.wr-pf-fold .pf-chip.wr-todo{color:var(--orange,#ff8c47);border-color:rgba(255,140,71,.5)}'+
    '.wr-pf-sub{font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px}'+
    '.wr-pf-input{width:100%;background:var(--dark);border:1.5px solid var(--border2);'+
      'border-radius:10px;color:var(--text);font-family:inherit;font-size:14px;padding:10px;'+
      'box-sizing:border-box}'+
    '.wr-pf-save{width:100%;margin-top:10px;background:transparent;border:1px solid var(--border2);'+
      'border-radius:10px;color:var(--text);font-family:inherit;font-size:13px;font-weight:600;'+
      'padding:10px;cursor:pointer}'+
    '.wr-pf-save:active{transform:scale(.99)}'+
    '.wr-pf-status{font-size:11px;color:var(--muted);margin-top:10px;line-height:1.5;word-break:break-word}'+
    /* espace perso — bloc d'envoi */
    '.wr-box{margin-top:10px;padding-top:10px;border-top:1px dashed var(--border2)}'+
    '.wr-box-off{padding-top:8px}'+
    '.wr-off{font-size:11px;color:var(--muted);font-style:italic;line-height:1.4}'+
    '.wr-ta{width:100%;background:var(--dark);border:1.5px solid var(--border2);border-radius:10px;'+
      'color:var(--text);font-family:inherit;font-size:13px;padding:9px;resize:vertical;'+
      'box-sizing:border-box}'+
    '.wr-send{width:100%;margin-top:8px;background:transparent;border:1px solid #25D366;'+
      'border-radius:10px;color:#25D366;font-family:inherit;font-size:13px;font-weight:600;'+
      'padding:9px;cursor:pointer}'+
    '.wr-send:active{transform:scale(.99)}';
  document.head.appendChild(st);
}

/* ========================= GREFFES ========================= */

function bind(){
  injectStyles();

  /* a) page Profil : _injectProfilExtras() est appelé par core.js à chaque
        passage sur la page. */
  const origExtras = window._injectProfilExtras;
  window._injectProfilExtras = function(){
    try{ if(typeof origExtras==='function') origExtras.apply(this, arguments); }
    catch(e){ console.warn('wr extras',e); }
    try{ ensureProfilBlock(); }catch(e){ console.warn('wr profil block',e); }
  };

  /* b) espace perso : on charge le numéro de l'athlète en même temps que ses
        retours, pour que persoRetourBlock() (synchrone) l'ait sous la main. */
  const origLoad = window.loadPersoRetours;
  if(typeof origLoad==='function'){
    window.loadPersoRetours = async function(sessionIds, athleteId, isos){
      const r = await origLoad.apply(this, arguments);
      try{ await loadAthletePhone(athleteId); }catch(e){ console.warn('wr phone',e); }
      return r;
    };
  }

  /* c) le bloc d'envoi s'ajoute dans le tiroir « Retour athlète ». */
  const origBlock = window.persoRetourBlock;
  if(typeof origBlock==='function'){
    window.persoRetourBlock = function(sid, iso, autoOpen){
      const html = origBlock.apply(this, arguments);
      if(!canSend()) return html;
      /* séance sans aucun retour : pas de tiroir, rien à greffer */
      if(html.indexOf('perso-r-drawer') < 0) return html;
      const box = sendBoxHTML(sid, iso);
      /* le tiroir est le dernier </div> du bloc rendu */
      const i = html.lastIndexOf('</div>');
      if(i < 0) return html;
      return html.slice(0,i) + box + html.slice(i);
    };
  }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bind);
else bind();

})();
