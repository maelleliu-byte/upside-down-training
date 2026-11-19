/* ============================================================================
 * famille.js — Profils enfants rattachés à un compte parent
 * ----------------------------------------------------------------------------
 * · Page Profil : section « Ma famille » (enfants, statut, ajout, bascule).
 * · Sur le profil d'un enfant : bandeau « Profil de Léo · Revenir à … ».
 * · La bascule passe par /.netlify/functions/family (action switch) qui
 *   vérifie le lien de parenté puis renvoie un token de connexion.
 * Chaque enfant est un vrai compte : PR, scores, abonnement lui sont propres.
 * ========================================================================== */
(function(){
'use strict';

var FN='/.netlify/functions/family';
var FAM=null;            // {parent, enfants}
var CHARGE=false;

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function prof(){return window.currentProfile||null;}
function toast(m){try{if(typeof showToast==='function')showToast(m);}catch(e){}}
function age(d){
  if(!d)return null;var b=new Date(d);if(isNaN(b))return null;
  var n=new Date(),a=n.getFullYear()-b.getFullYear(),m=n.getMonth()-b.getMonth();
  if(m<0||(m===0&&n.getDate()<b.getDate()))a--;return a;
}
function prenom(p){return ((p&&p.full_name)||'').trim().split(/\s+/)[0]||'Profil';}
function initiale(p){return (prenom(p).charAt(0)||'?').toUpperCase();}

async function token(){
  var r=await sb.auth.getSession();
  return r&&r.data&&r.data.session?r.data.session.access_token:null;
}
async function appel(corps){
  var t=await token();
  var res=await fetch(FN,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify(corps)});
  var j={};try{j=await res.json();}catch(e){}
  if(!res.ok)throw new Error(j.error||'Erreur '+res.status);
  return j;
}

/* Famille lue directement en base (les profils d'un même studio sont lisibles). */
async function chargerFamille(){
  var me=prof(); if(!me)return null;
  var cols='id,full_name,gender,birth_date,parent_id,child_status,avatar_url';
  var parentId=me.parent_id||me.id, parent=me;
  if(me.parent_id){
    var rp=await sb.from('profiles').select(cols).eq('id',parentId).maybeSingle();
    parent=(rp&&rp.data)||{id:parentId,full_name:'Parent'};
  }
  var re=await sb.from('profiles').select(cols).eq('parent_id',parentId).order('created_at',{ascending:true});
  FAM={parent:parent,enfants:(re&&re.data)||[]};
  return FAM;
}

/* ---------- Bascule ---------- */
async function basculer(id,btn){
  if(btn){btn.disabled=true;btn.textContent='…';}
  try{
    var r=await appel({action:'switch',target_id:id});
    var v=await sb.auth.verifyOtp({token_hash:r.token_hash,type:r.type||'magiclink'});
    if(v.error)throw v.error;
    location.reload();
  }catch(e){
    toast('❌ '+(e.message||'Bascule impossible'));
    if(btn){btn.disabled=false;btn.textContent='Passer';}
  }
}
window.UDTFamille={basculer:basculer,charger:chargerFamille};

/* ---------- Styles ---------- */
function style(){
  if(document.getElementById('udtf-style'))return;
  var st=document.createElement('style');st.id='udtf-style';
  st.textContent=
  '.udtf{margin:0 20px 16px;padding:14px;background:var(--card);border:1px solid var(--border);border-radius:12px}'+
  '.udtf-ti{font-size:13px;font-weight:700;color:var(--text)}'+
  '.udtf-sub{font-size:11px;color:var(--muted);margin-top:2px;line-height:1.4}'+
  '.udtf-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--border)}'+
  '.udtf-row:first-of-type{border-top:0}'+
  '.udtf-av{width:34px;height:34px;border-radius:50%;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;background:var(--card2,rgba(255,255,255,.06));color:var(--accent);background-size:cover;background-position:center}'+
  '.udtf-nm{flex:1 1 auto;min-width:0}'+
  '.udtf-n{font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
  '.udtf-m{font-size:11px;color:var(--muted);margin-top:1px}'+
  '.udtf-st{font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:2px 6px;border-radius:5px;border:1px solid currentColor}'+
  '.udtf-st.pending{color:var(--orange,#f0a020)}.udtf-st.refused{color:var(--red,#f85149)}.udtf-st.ici{color:var(--accent)}'+
  '.udtf-go{font:inherit;font-size:12px;font-weight:700;padding:7px 12px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer}'+
  '.udtf-add{font:inherit;width:100%;margin-top:10px;font-size:13px;font-weight:700;padding:11px;border-radius:10px;border:1px dashed var(--border);background:transparent;color:var(--text);cursor:pointer}'+
  '.udtf-form{margin-top:10px;display:flex;flex-direction:column;gap:8px}'+
  '.udtf-form label{font-size:11px;color:var(--muted);display:flex;flex-direction:column;gap:4px}'+
  '.udtf-form input{font:inherit;font-size:14px;padding:10px 12px;border-radius:9px;border:1px solid var(--border);background:var(--black,#0a0a0a);color:var(--text)}'+
  '.udtf-g{display:flex;gap:6px}'+
  '.udtf-g button{flex:1;font:inherit;font-size:13px;font-weight:700;padding:9px;border-radius:9px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer}'+
  '.udtf-g button.on{border-color:var(--accent);color:var(--accent)}'+
  '.udtf-btns{display:flex;gap:8px}'+
  '.udtf-ok{flex:1;font:inherit;font-size:13px;font-weight:800;padding:11px;border-radius:10px;border:0;background:var(--accent);color:#000;cursor:pointer}'+
  '.udtf-ko{font:inherit;font-size:13px;font-weight:700;padding:11px 14px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer}'+
  '.udtf-err{font-size:12px;color:var(--red,#f85149);min-height:0}'+
  '.udtf-ban{position:sticky;top:0;z-index:60;display:flex;align-items:center;gap:10px;padding:8px 16px;background:var(--accent);color:#000;font-size:12px;font-weight:700}'+
  '.udtf-ban span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
  '.udtf-ban button{font:inherit;font-size:12px;font-weight:800;padding:6px 10px;border-radius:7px;border:0;background:rgba(0,0,0,.82);color:#fff;cursor:pointer;flex:0 0 auto}';
  document.head.appendChild(st);
}

/* ---------- Bandeau sur le profil d'un enfant ---------- */
function bandeau(){
  var me=prof(); var app=document.getElementById('main-app');
  var vieux=document.getElementById('udtf-ban');
  if(!me||!me.parent_id||!app){if(vieux)vieux.remove();return;}
  if(vieux)return;
  var parent=FAM&&FAM.parent;
  var b=document.createElement('div');b.id='udtf-ban';b.className='udtf-ban';
  b.innerHTML='<span>👧 Profil de '+esc(prenom(me))+'</span>'+
    '<button type="button">Revenir à '+esc(parent?prenom(parent):'mon profil')+'</button>';
  b.querySelector('button').addEventListener('click',function(){basculer(me.parent_id,this);});
  app.insertBefore(b,app.firstChild);
}

/* ---------- Section « Ma famille » ---------- */
function ligne(p,moi){
  var a=age(p.birth_date), estEnfant=!!p.parent_id;
  var meta=estEnfant?(a!=null?a+' ans':'Enfant'):'Parent';
  var droite;
  if(p.id===moi)droite='<span class="udtf-st ici">Actif</span>';
  else if(estEnfant&&p.child_status==='pending')droite='<span class="udtf-st pending">En attente</span>';
  else if(estEnfant&&p.child_status==='refused')droite='<span class="udtf-st refused">Refusé</span>';
  else droite='<button type="button" class="udtf-go" data-udtf-go="'+esc(p.id)+'">Passer</button>';
  var av=p.avatar_url?' style="background-image:url(\''+esc(p.avatar_url)+'\')"':'';
  return '<div class="udtf-row"><div class="udtf-av"'+av+'>'+(p.avatar_url?'':esc(initiale(p)))+'</div>'+
    '<div class="udtf-nm"><div class="udtf-n">'+esc(p.full_name||'—')+'</div><div class="udtf-m">'+meta+'</div></div>'+droite+'</div>';
}

function rendre(){
  var page=document.getElementById('page-profil'), me=prof();
  if(!page||!me||!FAM)return;
  style();
  var box=document.getElementById('udtf-box');
  if(!box){
    box=document.createElement('div');box.id='udtf-box';box.className='udtf';
    var ancre=document.getElementById('charge-section');
    if(ancre)ancre.parentNode.insertBefore(box,ancre); else page.appendChild(box);
  }
  var membres=[FAM.parent].concat(FAM.enfants).filter(Boolean);
  var surEnfant=!!me.parent_id;
  var html='<div class="udtf-ti">Ma famille</div>'+
    '<div class="udtf-sub">'+(FAM.enfants.length
      ?'Passe sur le profil de ton enfant pour suivre ses PR, ses scores et gérer son abonnement.'
      :'Ajoute ton enfant pour suivre ses PR et ses séances depuis ton compte, même s\'il n\'a pas de téléphone.')+'</div>';
  if(FAM.enfants.length){
    html+='<div style="margin-top:6px">';
    for(var i=0;i<membres.length;i++)html+=ligne(membres[i],me.id);
    html+='</div>';
  }
  if(!surEnfant)html+='<button type="button" class="udtf-add" data-udtf-add="1">+ Ajouter un enfant</button>';
  box.innerHTML=html;
}

function formulaire(){
  var box=document.getElementById('udtf-box'); if(!box)return;
  var btn=box.querySelector('[data-udtf-add]'); if(!btn)return;
  var max=new Date().toISOString().slice(0,10);
  var f=document.createElement('div');f.className='udtf-form';
  f.innerHTML=
    '<label>Prénom et nom<input type="text" data-udtf-nom maxlength="80" autocomplete="off"></label>'+
    '<label>Date de naissance<input type="date" data-udtf-nais max="'+max+'"></label>'+
    '<div class="udtf-g"><button type="button" data-udtf-g="male">♂ Garçon</button><button type="button" data-udtf-g="female">♀ Fille</button></div>'+
    '<div class="udtf-sub">Ton coach reçoit une demande de validation. Dès qu\'il valide, tu peux passer sur le profil de ton enfant et prendre son abonnement Kids & Teens.</div>'+
    '<div class="udtf-err" data-udtf-err></div>'+
    '<div class="udtf-btns"><button type="button" class="udtf-ok" data-udtf-ok>Envoyer la demande</button><button type="button" class="udtf-ko" data-udtf-ko>Annuler</button></div>';
  btn.replaceWith(f);
  f.querySelector('[data-udtf-nom]').focus();
}

async function envoyer(btn){
  var f=btn.closest('.udtf-form'); if(!f)return;
  var nom=f.querySelector('[data-udtf-nom]').value.trim();
  var nais=f.querySelector('[data-udtf-nais]').value;
  var g=f.querySelector('[data-udtf-g].on'), err=f.querySelector('[data-udtf-err]');
  err.textContent='';
  if(!nom){err.textContent='Indique le prénom et le nom.';return;}
  if(!nais){err.textContent='Indique la date de naissance.';return;}
  btn.disabled=true;btn.textContent='Envoi…';
  try{
    await appel({action:'add',full_name:nom,birth_date:nais,gender:g?g.getAttribute('data-udtf-g'):null});
    toast('✅ Demande envoyée au coach');
    await chargerFamille();rendre();
  }catch(e){
    err.textContent=e.message||'Envoi impossible';
    btn.disabled=false;btn.textContent='Envoyer la demande';
  }
}

document.addEventListener('click',function(e){
  if(!e.target.closest)return;
  var t;
  if((t=e.target.closest('[data-udtf-go]'))){basculer(t.getAttribute('data-udtf-go'),t);return;}
  if(e.target.closest('[data-udtf-add]')){formulaire();return;}
  if((t=e.target.closest('[data-udtf-g]'))){
    var s=t.parentNode.querySelectorAll('[data-udtf-g]');
    for(var i=0;i<s.length;i++)s[i].classList.toggle('on',s[i]===t);
    return;
  }
  if((t=e.target.closest('[data-udtf-ok]'))){envoyer(t);return;}
  if(e.target.closest('[data-udtf-ko]')){rendre();return;}
});

/* ---------- Démarrage : attendre le profil ---------- */
async function demarrer(){
  if(CHARGE)return; CHARGE=true;
  try{await chargerFamille();}catch(e){if(window.console)console.warn('[famille]',e);}
  style();bandeau();rendre();
}
var n=0, iv=setInterval(function(){
  var me=prof();
  if(me&&me.id&&typeof sb!=='undefined'){clearInterval(iv);demarrer();}
  else if(++n>240)clearInterval(iv);
},250);

})();
