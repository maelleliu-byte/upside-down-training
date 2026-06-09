// ===================================================
// STUDIOS & MULTI-TENANT — injections UI pour admins externes
// Dépend de : utils.js, core.js (sb, currentUser, currentProfile,
//   goPage, adminTab, editSession, saveSession, loadAdminCalendar)
// ===================================================

// --- Détection admin externe ---
function _isExternalAdmin(){return !!(currentProfile&&currentProfile.role==='admin'&&currentProfile.studio_id);}

// ── 1. Menu item "Paramètres du studio" dans la page Profil ──
function _injectStudioAdminMenuItems(){
  if(!_isExternalAdmin())return;
  if(document.getElementById('studio-settings-menu-item'))return;
  const adminMenuItem=document.getElementById('admin-menu-item');if(!adminMenuItem)return;
  const slug=window.__STUDIO_SLUG__||'';
  const settingsItem=document.createElement('div');
  settingsItem.className='menu-item';settingsItem.id='studio-settings-menu-item';
  settingsItem.innerHTML=`<span class="menu-item-label">🏟 Paramètres du studio</span><span>›</span>`;
  settingsItem.onclick=()=>{window.location.href='/'+slug+'/settings';};
  adminMenuItem.insertAdjacentElement('afterend',settingsItem);
}

// ── 2. Boutons dans le topbar du panel Admin ──
function _injectAdminStudioButtons(){
  if(!_isExternalAdmin())return;
  if(document.getElementById('admin-topbar-studio-btns'))return;
  const topbar=document.querySelector('#page-admin .topbar');if(!topbar)return;
  const slug=window.__STUDIO_SLUG__||'';
  const wrap=document.createElement('div');wrap.id='admin-topbar-studio-btns';wrap.style.cssText='display:flex;gap:8px;align-items:center;flex-shrink:0';
  const btnSettings=document.createElement('a');btnSettings.href='/'+slug+'/settings';btnSettings.innerHTML='⚙️ <span style="font-size:12px">Paramètres</span>';btnSettings.style.cssText='display:inline-flex;align-items:center;gap:4px;padding:7px 11px;background:var(--card2);border:1px solid var(--border2);border-radius:8px;color:var(--text2);font-size:13px;font-weight:700;text-decoration:none;cursor:pointer;white-space:nowrap';
  const btnStripe=document.createElement('a');btnStripe.href='https://dashboard.stripe.com';btnStripe.target='_blank';btnStripe.rel='noopener noreferrer';btnStripe.innerHTML='💳 <span style="font-size:12px">Stripe</span>';btnStripe.style.cssText='display:inline-flex;align-items:center;gap:4px;padding:7px 11px;background:var(--card2);border:1px solid var(--border2);border-radius:8px;color:var(--text2);font-size:13px;font-weight:700;text-decoration:none;cursor:pointer;white-space:nowrap';
  wrap.appendChild(btnSettings);wrap.appendChild(btnStripe);
  topbar.style.display='flex';topbar.style.alignItems='center';topbar.style.justifyContent='space-between';topbar.appendChild(wrap);
}

// ── Hook goPage : charge les pages et injecte UI studio ──
const __origGoPage=goPage;
goPage=async function(p){
  await __origGoPage(p);
  if(p==='wellness')loadWellnessPage();
  if(p==='profil')_injectStudioAdminMenuItems();
  if(p==='admin')_injectAdminStudioButtons();
  if(p==='planning'){if(typeof renderDayStrip==='function')renderDayStrip();if(typeof renderSessions==='function')renderSessions();}
};

// ── Hook adminTab : ferme fiche athlète, charge wellness ──
const __origAdminTab=adminTab;
adminTab=function(tab,btn){
  const card=document.getElementById('admin-athlete-card');const list=document.getElementById('admin-athletes-list');
  if(card)card.style.display='none';if(list)list.style.display='';
  if(tab==='studios'){
    document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.remove('active'));
    if(btn)btn.classList.add('active');
    document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
    const panel=document.getElementById('admin-studios');
    if(panel){panel.classList.add('active');if(typeof loadAdminStudios==='function')loadAdminStudios();}
    return;
  }
  __origAdminTab(tab,btn);
  if(tab==='wellness')loadWellnessAdmin();
};

// ── Hook editSession : replace le form si déplacé vers perso ──
const __origEditSession=editSession;
editSession=async function(id){
  const form=document.getElementById('admin-new-session');const sessionsPanel=document.getElementById('admin-sessions');
  if(form&&sessionsPanel&&form.parentElement!==sessionsPanel.parentElement){sessionsPanel.parentElement.insertBefore(form,sessionsPanel);document.getElementById('form-perso-banner').style.display='none';document.getElementById('form-prog-group').style.display='';}
  window._returnToSessionsAfterSave=true;
  await __origEditSession(id);
  document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
  if(form)form.classList.add('active');
  document.querySelectorAll('.admin-tab-btn').forEach(b=>{const oc=b.getAttribute('onclick')||'';b.classList.toggle('active',oc.includes('new-session'));});
  const pageAdmin=document.getElementById('page-admin');if(pageAdmin)pageAdmin.scrollTop=0;
};

// ── handleSaveSession : remplace le bouton Publier ──
async function handleSaveSession(){
  const wasEditing=!!(editingSessionId||personalEditingId);
  const wasPerso=!!personalAthleteId;
  window._returnToPlanningAfterSave=false;
  window._returnToSessionsAfterSave=false;
  await saveSession();
  if(wasEditing&&!wasPerso){
    const sessionsPanel=document.getElementById('admin-sessions');const pageAdmin=document.getElementById('page-admin');
    document.querySelectorAll('.page').forEach(p=>{p.classList.remove('active');p.style.display='none';});
    if(pageAdmin){pageAdmin.style.display='block';pageAdmin.classList.add('active');pageAdmin.style.overflowY='auto';}
    const navBtn=document.querySelector('[data-page="admin"]');
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    if(navBtn)navBtn.classList.add('active');
    document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
    if(sessionsPanel)sessionsPanel.classList.add('active');
    document.querySelectorAll('.admin-tab-btn').forEach(b=>{b.classList.toggle('active',(b.getAttribute('onclick')||'').includes("'sessions'"));});
    if(typeof loadAdminCalendar==='function')loadAdminCalendar();
  }
}

// ── quickAddSession : ajouter une séance depuis le calendrier ──
function quickAddSession(iso,weekNum,dow){
  window._returnToSessionsAfterSave=true;
  adminTab('new-session',document.querySelector('.admin-tab-btn:nth-child(2)'));
  resetSessionForm();
  const progId=document.getElementById('admin-filter-prog')?.value;
  if(progId){const fProg=document.getElementById('f-prog');if(fProg)fProg.value=progId;onFProgChange();}
  if(weekNum!=null){const w=document.getElementById('f-week');if(w)w.value=weekNum;const d=document.getElementById('f-dow');if(d&&dow!=null)d.value=dow;}
  else{document.getElementById('f-date').value=iso;}
}

// ── Modal lecture séance ──
let readModalSession=null;let readModalIsPerso=false;

async function openReadSession(id,source){
  const pageAdmin=document.getElementById('page-admin');
  if(pageAdmin&&pageAdmin.classList.contains('active')&&source!=='personal'){
    window._readModalSessionId=id;
    const {data:s}=await sb.from('sessions').select('*').eq('id',id).single();if(!s)return;
    readModalSession=s;readModalIsPerso=false;
    const color=s.color||'#e8ff47';
    const typeLabel=(typeof TYPE_LABELS!=='undefined'?TYPE_LABELS[s.type]:null)||s.type||'—';
    const prog=typeof getProgById==='function'?getProgById(s.programme_id):null;
    document.getElementById('read-modal-prog').textContent=prog?((prog.icon?prog.icon+' ':'')+prog.name):'—';
    let dateLabel=s.date||'';try{if(s.date&&typeof formatDate==='function')dateLabel=formatDate(s.date);}catch(e){}
    document.getElementById('read-modal-date').textContent=dateLabel;
    const editBtn=document.getElementById('read-modal-edit-btn');if(editBtn)editBtn.style.display='';
    const rawContent=s.content||'';let withCharges=rawContent;
    try{if(typeof renderContentWithCharges==='function')withCharges=renderContentWithCharges(rawContent);}catch(e){}
    const isHtml=/<[a-z][\s\S]*>/i.test(withCharges);
    const contentHtml=isHtml?withCharges:withCharges.replace(/\n/g,'<br>');
    let intHtml='';if(s.intensity){const pct=s.intensity*10;const col=s.intensity<=4?'var(--blue)':s.intensity<=7?'var(--accent)':'var(--red)';intHtml='<div class="intensity-bar"><div class="int-row"><span class="int-label">Intensité</span><span class="int-val" style="color:'+col+'">'+s.intensity+'/10</span></div><div class="int-track"><div class="int-fill" style="width:'+pct+'%;background:'+col+'"></div></div></div>';}
    const targetHtml=s.target?'<div class="info-block"><div class="info-block-title"><span>🎯</span> Target</div><div class="info-block-text">'+s.target+'</div></div>':'';
    const tipsHtml=s.tips?'<div class="info-block"><div class="info-block-title"><span>💡</span> Coaching Tips</div><div class="info-block-text">'+s.tips+'</div></div>':'';
    const scalingParts=[];
    if(s.scaling_inter)scalingParts.push('<div class="scaling-block scaling-block-inter"><div class="scaling-label" style="color:var(--red)">Intermédiaire</div><div class="scaling-text">'+s.scaling_inter+'</div></div>');
    if(s.scaling_scaled)scalingParts.push('<div class="scaling-block scaling-block-scaled"><div class="scaling-label" style="color:var(--blue)">Scaled</div><div class="scaling-text">'+s.scaling_scaled+'</div></div>');
    if(s.scaling_foundation)scalingParts.push('<div class="scaling-block scaling-block-found"><div class="scaling-label" style="color:var(--purple)">Fondation</div><div class="scaling-text">'+s.scaling_foundation+'</div></div>');
    let _vids=[];try{_vids=Array.isArray(s.videos)?s.videos:(typeof s.videos==='string'?JSON.parse(s.videos):[]);}catch(e){_vids=[];}
    if((!_vids||!_vids.length)&&s.youtube_url){_vids=[{url:s.youtube_url,label:s.youtube_label||''}];}
    const videoHtml=_vids.length?'<div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">'+_vids.map(function(v){return'<a href="'+v.url+'" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(255,0,0,.1);border:1px solid rgba(255,0,0,.25);border-radius:10px;text-decoration:none;color:var(--text)"><span style="font-size:22px">▶️</span><div><div style="font-size:13px;font-weight:700">'+(v.label||'Voir la vidéo')+'</div></div></a>';}).join('')+'</div>':'';
    function _esc(str){return(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
    document.getElementById('read-modal-body').innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span class="badge badge-'+s.type+'" style="background:'+color+'18;color:'+color+'">'+typeLabel+'</span>'+(s.title?'<span style="font-size:16px;font-weight:700">'+_esc(s.title)+'</span>':'')+'</div><div class="session-content" style="font-size:14px;line-height:1.7;margin-bottom:12px">'+contentHtml+'</div>'+scalingParts.join('')+intHtml+targetHtml+tipsHtml+videoHtml;
    document.getElementById('read-modal').classList.add('open');return;
  }
  let data;
  if(source==='personal'){const r=await sb.from('personal_sessions').select('*').eq('id',id).single();data=r.data;}
  else{const r=await sb.from('sessions').select('*,programmes(name,icon,color)').eq('id',id).single();data=r.data;}
  if(!data){showToast('❌ Séance introuvable');return;}
  readModalSession=data;readModalIsPerso=(source==='personal');
  if(readModalIsPerso){const ath=currentPersoAthlete||persoAthletesCache.find(a=>a.id===data.athlete_id);document.getElementById('read-modal-prog').textContent='👤 '+(ath?.full_name||'Athlète');}
  else{const p=data.programmes;document.getElementById('read-modal-prog').textContent=p?`${p.icon||''} ${p.name}`:'Programme';}
  document.getElementById('read-modal-date').textContent=formatDate(data.date);
  const body=document.getElementById('read-modal-body');body.innerHTML='<div class="spinner"></div>';
  if(data.type==='separator'){body.innerHTML=buildSeparatorCard(data);}else{body.innerHTML=await buildSessionCard(data);}
  const editBtn=document.getElementById('read-modal-edit-btn');
  if(editBtn){const isAdmin=currentProfile?.role==='admin';const isOwnPerso=readModalIsPerso&&currentUser&&data.athlete_id===currentUser.id;editBtn.style.display=(isAdmin||isOwnPerso)?'':'none';}
  document.getElementById('read-modal').classList.add('open');
}
function closeReadModal(){document.getElementById('read-modal').classList.remove('open');readModalSession=null;}
function readModalEdit(){
  if(!readModalSession)return;
  const s=readModalSession;const isPerso=readModalIsPerso;closeReadModal();
  if(isPerso){persoEditSession(s.id,s.athlete_id);}
  else{
    goPage('admin');
    const _tryEdit=(attempts)=>{
      const panel=document.getElementById('admin-new-session');const fProg=document.getElementById('f-prog');
      if(panel&&fProg){window._returnToPlanningAfterSave=true;editSession(s.id);}
      else if(attempts>0)setTimeout(()=>_tryEdit(attempts-1),120);
      else{window._returnToPlanningAfterSave=true;editSession(s.id);}
    };
    setTimeout(()=>_tryEdit(8),100);
  }
}
