const SUPABASE_URL='https://tltqtpbaaxiwwpvuzszt.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsdHF0cGJhYXhpd3dwdnV6c3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDA5NTQsImV4cCI6MjA5MzUxNjk1NH0.5LVedQ-ktLcTC6z2X0XIoqY-mqP9_tw-gzrt-KNfuuY';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const STRIPE_PK='pk_live_51TTgoeGfW5FegIxCCDUZQvm2EakuXj3rC2UFYiRDXfvuaE42WwX3Hjys4734FK0p9Dqe5ngaCNKpR35ssPKRUVSH004VamRL0F';
const stripe=Stripe(STRIPE_PK);

// STATE
let currentUser=null,currentProfile=null,programmes=[],movements=[],benchmarks=[],myPRs={},myAccess=new Set(),myAccessIds=new Set();
let currentProg=null,currentWeekOffset=0,selectedDate=new Date().toISOString().split('T')[0];
let currentModalMovement=null,currentBenchmark=null,currentBLevel='rx';
let selectedColor='#e8ff47',selectedIcon='';
let currentCat='all',searchQuery='',currentBcat='all';

const DAYS=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const MONTHS=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const TYPE_LABELS={wod:'WOD',strength:'Force',weightlifting:'Weightlifting',gymnastics:'Gymnastics',renforcement:'Renforcement',bodybuilding:'Bodybuilding',skill:'Skill',warmup:'Échauffement',mobility:'Mobilité',engine:'Engine',run:'Run',separator:'Séparateur'};
const CAT_LABELS={haltero:'Haltérophilie',force:'Force',gymnastic:'Gymnastics',cardio:'Cardio / Mono',autre:'Autre'};
const HALTERO_SUBCATS=[
  {key:'snatch',  label:'SNATCH',   match:n=>/snatch/i.test(n)},
  {key:'clean',   label:'CLEAN',    match:n=>/clean/i.test(n) && !/jerk/i.test(n)},
  {key:'jerk',    label:'JERK',     match:n=>/jerk/i.test(n)},
  {key:'squat',   label:'SQUAT',    match:n=>/squat/i.test(n) && !/clean|snatch/i.test(n)},
  {key:'deadlift',label:'DEADLIFT', match:n=>/deadlift|soulev/i.test(n)},
  {key:'press',   label:'PRESS',    match:n=>/press|bench/i.test(n) && !/jerk/i.test(n)},
  {key:'autre',   label:'AUTRE',    match:_=>true}
];
function getHalteroSubCat(name){
  for(const s of HALTERO_SUBCATS){if(s.match(name||''))return s.key;}
  return 'autre';
}
const FORCE_SUBCATS=[
  {key:'squat',   label:'SQUAT',    match:n=>/squat/i.test(n)},
  {key:'bench',   label:'BENCH',    match:n=>/bench/i.test(n)},
  {key:'deadlift',label:'DEADLIFT', match:n=>/deadlift|soulev/i.test(n)},
  {key:'press',   label:'PRESS',    match:n=>/press|jerk/i.test(n)},
  {key:'pull',    label:'PULL / ROW',match:n=>/pull[\s-]?up|chin[\s-]?up|row|tirage|traction/i.test(n)},
  {key:'autre',   label:'AUTRE',    match:_=>true}
];
function getForceSubCat(name){
  for(const s of FORCE_SUBCATS){if(s.match(name||''))return s.key;}
  return 'autre';
}
const LEVEL_LABELS={rx:'RX',intermediate:'Inter',scaled:'Scaled',foundation:'Fond.'};
const LEVEL_COLORS={rx:'#111',intermediate:'var(--red)',scaled:'var(--blue)',foundation:'var(--purple)'};
const SCORE_HINTS={time:'Format: mm:ss (ex: 14:32)',reps:'Nombre de répétitions',rounds:'Ex: 12 + 5',weight:'Charge en kg (ex: 85)',calories:'Nombre de calories',watt:'Puissance en watts (ex: 250)'};
// STRIPE — clé publique LIVE + price IDs
const STRIPE_PUBLIC_KEY='pk_live_51TTgoeGfW5FegIxCCDUZQvm2EakuXj3rC2UFYiRDXfvuaE42WwX3Hjys4734FK0p9Dqe5ngaCNKpR35ssPKRUVSH004VamRL0F';
const STRIPE_PLANS={
  affiliate:{priceId:'price_1TThBIGfW5FegIxCy3Bd5zmi',name:'Affiliate',icon:'',price:'120€',period:'/mois',trial:14,desc:'Programmation salle complète — CrossFit Sandglass.',features:['WOD quotidien','Séances force & skill','Coaching tips & targets','Suivi des scores','PR tracking','14 jours d\'essai gratuit'],color:'#e8ff47'},
  hyrox:{priceId:'price_1TVVEsGfW5FegIxCD0fssSlu',name:'Hyrox',icon:'',price:'30€',period:'/mois',trial:14,desc:'Programmation Hyrox — endurance & compromised running.',features:['Sessions Hyrox spécifiques','Compromised running','Sled push/pull','Wall balls & burpees','14 jours d\'essai gratuit'],color:'#ff4444'},
  training:{priceId:'price_1TThDzGfW5FegIxCGRb4q1tN',name:'Training',icon:'',price:'45€',period:'/mois',trial:14,desc:'Préparation compétition Upside Down.',features:['Programmation compétition','Haltérophilie avancée','Périodisation structurée','Suivi performances','Accès coach direct','14 jours d\'essai gratuit'],color:'#ff8c47'},
  kids:{priceId:'price_1TVVFiGfW5FegIxCmwl0GkBV',name:'Kids & Teens',icon:'',price:'30€',period:'/mois',trial:14,desc:'Programmation jeunes athlètes (8-16 ans).',features:['Adapté au développement','Mouvements fondamentaux','Coordination & motricité','Suivi progression','14 jours d\'essai gratuit'],color:'#47b8ff'}
};

// SPLASH SCREEN — branding dynamique selon le studio
window.addEventListener('load',()=>{
  // Appliquer logo/couleur du studio au splash dès que disponible
  function applySplashBranding(){
    const studio=window.__STUDIO__;
    if(!studio)return;
    const splash=document.getElementById('splash-screen');
    if(!splash)return;
    if(studio.logo_url){
      const img=splash.querySelector('img');
      if(img){img.src=studio.logo_url;img.style.maxWidth='200px';}
    }
  }
  window.addEventListener('studio:ready',applySplashBranding);
  applySplashBranding();
  setTimeout(()=>{
    const splash=document.getElementById('splash-screen');
    if(splash){splash.style.opacity='0';setTimeout(()=>splash.style.display='none',600);}
  },2000);
});

// INIT
window.onload=async()=>{
  const {data:{session}}=await sb.auth.getSession();
  if(session){currentUser=session.user;await loadProfile();await _redirectToProfileStudio();await initApp();}
};

// AUTH
let authMode='login';
function authTab(mode){
  authMode=mode;
  document.querySelectorAll('.auth-tab').forEach((t,i)=>t.classList.toggle('active',(i===0&&mode==='login')||(i===1&&mode==='signup')));
  document.getElementById('auth-name').style.display=mode==='signup'?'block':'none';
  document.querySelector('.btn-auth').textContent=mode==='login'?'Se connecter':'Créer mon compte';
  document.getElementById('auth-error').textContent='';
}
async function doAuth(){
  const email=document.getElementById('auth-email').value.trim();
  const pwd=document.getElementById('auth-pwd').value;
  const name=document.getElementById('auth-name').value.trim();
  const errEl=document.getElementById('auth-error');
  errEl.textContent='';
  if(!email||!pwd){errEl.textContent='Email et mot de passe requis';return;}
  let res;
  if(authMode==='login'){res=await sb.auth.signInWithPassword({email,password:pwd});}
  else{if(!name){errEl.textContent='Prénom et nom requis';return;}res=await sb.auth.signUp({email,password:pwd,options:{data:{full_name:name}}});}
  if(res.error){errEl.textContent=res.error.message;return;}
  currentUser=res.data.user;await loadProfile();await _redirectToProfileStudio();await initApp();
}
async function doLogout(){await sb.auth.signOut();currentUser=null;currentProfile=null;location.reload();}
async function loadProfile(){
  const {data}=await sb.from('profiles').select('*').eq('id',currentUser.id).single();
  currentProfile=data;
  window.currentProfile=data; // exposé pour index.html et autres scripts
}

// Helper global — retourne le studio_id du profil courant (null pour Upside Down)
function getStudioId(){return currentProfile?.studio_id??null;}

// Après login, vérifie que l'URL correspond au studio du profil.
// Si Maxime se connecte sur "/" alors qu'il appartient à CF Sandglass,
// on le redirige vers "/crossfit-sandglass".
async function _redirectToProfileStudio(){
  const studioId=currentProfile?.studio_id;
  if(!studioId)return; // Upside Down — pas de redirection
  // Récupérer le slug du studio
  const {data:studio}=await sb.from('studios').select('slug').eq('id',studioId).single();
  if(!studio?.slug)return;
  const currentSlug=location.pathname.split('/').filter(Boolean)[0]||'';
  if(currentSlug!==studio.slug){
    // Rediriger vers le bon slug en conservant le chemin éventuel
    location.replace('/'+studio.slug);
  }
}
function toggleTheme(){
  const cur=document.documentElement.getAttribute('data-theme')||'dark';
  const next=cur==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  try{localStorage.setItem('upside-theme',next);}catch(e){}
  const lbl=document.getElementById('theme-label');
  if(lbl)lbl.textContent=next==='dark'?'🌙 Mode clair':'☀️ Mode sombre';
}
(function initTheme(){
  try{
    const saved=localStorage.getItem('upside-theme')||'dark';
    document.documentElement.setAttribute('data-theme',saved);
  }catch(e){}
})();
async function uploadAvatar(ev){
  const file=ev.target.files?.[0];
  if(!file||!currentUser)return;
  if(file.size>2*1024*1024){alert('Image trop lourde (max 2 Mo)');return;}
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
  const path=`${currentUser.id}/avatar.${ext}`;
  const {error}=await sb.storage.from('avatars').upload(path,file,{upsert:true,contentType:file.type});
  if(error){alert('Erreur upload : '+error.message);return;}
  const {data:pub}=sb.storage.from('avatars').getPublicUrl(path);
  const url=pub.publicUrl+'?t='+Date.now();
  await sb.from('profiles').update({avatar_url:url}).eq('id',currentUser.id);
  currentProfile=currentProfile||{};
  currentProfile.avatar_url=url;
  applyAvatarToUI(url);
}
function avatarHtml(profile,opts){
  const cls=(opts&&opts.cls)||'score-avatar';
  const url=profile&&profile.avatar_url;
  const name=(profile&&profile.full_name)||'';
  const initials=name?name.split(' ').filter(Boolean).map(w=>w[0]).join('').toUpperCase().slice(0,2):'?';
  if(url)return `<div class="${cls} has-img" style="background-image:url('${url.replace(/'/g,"\\'")}')"></div>`;
  return `<div class="${cls}">${initials}</div>`;
}
function refreshMyGenderUI(){
  const g=(currentProfile?.gender||'').toLowerCase();
  const norm=(g==='m'||g==='homme')?'male':(g==='f'||g==='femme')?'female':g;
  document.querySelectorAll('[data-mygender]').forEach(b=>{
    b.classList.toggle('active',b.dataset.mygender===norm);
  });
}
async function setMyGender(g){
  if(!currentUser)return;
  const {error}=await sb.from('profiles').update({gender:g}).eq('id',currentUser.id);
  if(error){showToast('❌ '+error.message);return;}
  currentProfile=currentProfile||{};
  currentProfile.gender=g;
  refreshMyGenderUI();
  showToast(g==='male'?'♂ Catégorie Hommes':'♀ Catégorie Femmes');
}
function applyAvatarToUI(url){
  ['profil-avatar','avatar-btn','wellness-avatar'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    if(url){
      el.style.backgroundImage=`url("${url}")`;
      el.style.backgroundSize='cover';
      el.style.backgroundPosition='center';
      el.textContent='';
    }
  });
}

async function initApp(){
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-app').style.display='block';
  const init=(currentProfile?.full_name||currentUser.email||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('avatar-btn').textContent=init;
  document.getElementById('profil-avatar').textContent=init;
  if(currentProfile?.avatar_url)applyAvatarToUI(currentProfile.avatar_url);
  const tlbl=document.getElementById('theme-label');
  if(tlbl){const cur=document.documentElement.getAttribute('data-theme')||'dark';tlbl.textContent=cur==='dark'?'🌙 Mode clair':'☀️ Mode sombre';}
  document.getElementById('profil-name').textContent=currentProfile?.full_name||'Athlète';
  document.getElementById('profil-email').textContent=currentUser.email;
  refreshMyGenderUI();
  if(currentProfile?.role==='admin'){
    document.getElementById('admin-menu-item').style.display='flex';
    if(!document.querySelector('[data-page="admin"]')){
      const nav=document.getElementById('bottom-nav');
      const btn=document.createElement('button');
      btn.className='nav-btn';btn.dataset.page='admin';
      btn.innerHTML='<span class="nav-icon">⚙️</span><span class="nav-label">Admin</span>';
      btn.onclick=()=>goPage('admin');
      nav.appendChild(btn);
    }
    // Afficher l'onglet Studios uniquement pour le superadmin Upside Down
    // (profil sans studio_id = admin natif Upside)
    if(!currentProfile?.studio_id){
      const studiosTabBtn=document.getElementById('admin-studios-tab-btn');
      if(studiosTabBtn)studiosTabBtn.style.display='';
    }
  }
  await loadMovements();
  await loadBenchmarks();
  await loadVideos();
  // Charger les PR AVANT les programmes : loadProgrammes() déclenche le premier
  // rendu des séances (renderSessions), qui a besoin de myPRs pour calculer les
  // charges (% × 1RM). Sinon les % n'apparaissent qu'au changement de jour.
  await loadMyPRs();
  await loadProgrammes();
  const d=new Date();
  document.getElementById('prog-topbar-date').textContent=`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  // FUN FEATURES — init après login
  if(typeof initColorTheme==='function')initColorTheme();
  if(typeof _injectColorThemeButton==='function')setTimeout(_injectColorThemeButton,400);
  if(typeof _injectAdminBadgesTab==='function')setTimeout(_injectAdminBadgesTab,400);
  if(typeof checkAutoBadges==='function')setTimeout(checkAutoBadges,2000);
  if(typeof _showUnseenBadges==='function')setTimeout(_showUnseenBadges,2200);
  if(typeof _startBadgeRealtime==='function')setTimeout(_startBadgeRealtime,1000);
}

// NAVIGATION
async function goPage(page){
  document.querySelectorAll('.page').forEach(p=>{p.classList.remove('active');p.style.display='none';p.style.overflowY='';});
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const pg=document.getElementById(`page-${page}`);
  if(pg){pg.style.display='block';pg.classList.add('active');pg.style.overflowY='auto';requestAnimationFrame(()=>{pg.scrollTop=0;});}
  const btn=document.querySelector(`[data-page="${page}"]`);
  if(btn)btn.classList.add('active');
  if(page==='pr'){await loadMyPRs();await loadMyBenchScores();renderAll();}
  if(page==='profil'){loadProfilStats();if(typeof _injectProfilExtras==='function')_injectProfilExtras();}
  if(page==='admin'){loadAdminProgs();loadAdminSessions();loadAdminAthletes();loadAdminBenchmarks();if(typeof _injectAdminBadgesTab==='function')_injectAdminBadgesTab();}
  if(page==='abos')renderPlans();
  if(page==='videos'){await loadVideos();renderVideosAthlete();}
}

// PROGRAMMES
async function loadProgrammes(){
  // MULTI-TENANT : filtrer par studio_id du profil courant.
  // Upside Down (studio_id NULL) → .is('studio_id',null)
  // Studio tiers (studio_id = UUID) → .eq('studio_id', uuid)
  const studioId=currentProfile?.studio_id??null;
  let q=sb.from('programmes').select('*').eq('is_active',true);
  if(studioId){q=q.eq('studio_id',studioId);}
  else{q=q.is('studio_id',null);}
  const {data}=await q.order('name');
  programmes=data||[];

  // Gérer retour Stripe ici, après chargement des programmes
  const params=new URLSearchParams(window.location.search);
  if(params.get('success')==='1'||params.get('subscription')==='success'){
    const progSlug=params.get('prog');
    const progId=params.get('prog_id');
    if(currentUser){
      // Trouve le programme via slug OU id (selon ce que renvoie l'URL Stripe)
      const programme=programmes.find(p=>(progSlug&&p.slug===progSlug)||(progId&&p.id===progId));
      if(programme){
        // Upsert client-side en fallback du webhook (au cas où il met du temps / échoue)
        const {error:upsertErr}=await sb.from('programme_access').upsert({
          athlete_id:currentUser.id,
          programme_id:programme.id
        },{onConflict:'athlete_id,programme_id'});
        if(upsertErr)console.error('programme_access upsert failed:',upsertErr);
      }
      // Poll loadMyAccess() jusqu'à ce que l'accès apparaisse (webhook peut prendre 1-3s)
      showToast('🎉 Abonnement activé !');
      let granted=false;
      for(let i=0;i<6;i++){
        await loadMyAccess();
        if(programme?(myAccessIds.has(programme.id)||myAccess.has(programme.slug)):myAccessIds.size>0){granted=true;break;}
        await new Promise(r=>setTimeout(r,1500));
      }
      if(!granted){
        showToast('⏳ Accès en cours d\'activation — réessaie dans quelques secondes');
      }
    }
    window.history.replaceState({},'','/');
  }
  if(params.get('canceled')==='1'){
    showToast('Paiement annulé.');
    window.history.replaceState({},'','/');
  }

  await loadMyAccess();
  renderProgTabs();
  if(programmes.length>0){
    const isAdmin=currentProfile?.role==='admin';
    let first;
    if(isAdmin){
      first=programmes.find(p=>p.slug==='training')||programmes[0];
    } else {
      first=programmes.find(p=>hasAccess(p))||programmes[0];
    }
    currentProg=first;
    activateProgTab(first.id);
    await renderDayStrip();
    await renderSessions();
  }
}
function renderProgTabs(){
  const tabs=document.getElementById('prog-tabs');
  const sel=document.getElementById('f-prog');
  const sel2=document.getElementById('admin-filter-prog');

  // Trier : accessibles en premier, puis verrouillés
  // Pour admins : Training en premier
  const isAdmin=currentProfile?.role==='admin';
  const sorted=[...programmes].sort((a,b)=>{
    if(isAdmin){
      // Training en premier pour les admins
      if(a.slug==='training')return -1;
      if(b.slug==='training')return 1;
      return a.name.localeCompare(b.name);
    }
    // Athlètes : accessibles en premier
    const aAccess=hasAccess(a)?0:1;
    const bAccess=hasAccess(b)?0:1;
    if(aAccess!==bAccess)return aAccess-bAccess;
    return a.name.localeCompare(b.name);
  });

  tabs.innerHTML=sorted.map(p=>{
    const locked=!hasAccess(p);
    return`<button class="prog-tab ${locked?'prog-tab-locked':''}" data-id="${p.id}" onclick="selectProg('${p.id}')">${p.name}${locked?' 🔒':''}</button>`;
  }).join('');
  sel.innerHTML=programmes.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  sel2.innerHTML='<option value="">Tous</option>'+programmes.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  if(sorted.length>0)activateProgTab(sorted[0].id);
}
function selectProg(id){currentProg=programmes.find(p=>p.id===id);activateProgTab(id);renderDayStrip();renderSessions();}
function activateProgTab(id){
  document.querySelectorAll('.prog-tab').forEach(t=>{
    const p=programmes.find(p=>p.id===t.dataset.id);if(!p)return;
    if(t.dataset.id===id){t.style.borderColor=p.color;t.style.color=p.color;t.style.background=p.color+'18';}
    else{t.style.cssText='';}
  });
  if(currentProg)document.getElementById('prog-topbar-title').textContent=currentProg.name.toUpperCase();
}

// WEEK / DAY
function getWeekDates(off=0){
  const now=new Date(),day=now.getDay(),mon=new Date(now);
  mon.setDate(now.getDate()-(day===0?6:day-1)+off*7);
  return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
}
function getWeekNum(d){
  const dt=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  dt.setUTCDate(dt.getUTCDate()+4-(dt.getUTCDay()||7));
  const y=new Date(Date.UTC(dt.getUTCFullYear(),0,1));
  return Math.ceil((((dt-y)/86400000)+1)/7);
}
async function renderDayStrip(){
  if(!currentProg)return;
  // === ONE-SHOT : navigation par semaine relative basée sur start_date athlète ===
  if(isOneshotProg(currentProg)){
    const total=currentProg.total_weeks||8;
    // Récupérer la start_date de l'athlète pour ce programme
    let startISO=null;
    if(currentUser){
      const {data:acc}=await sb.from('programme_access').select('start_date').eq('athlete_id',currentUser.id).eq('programme_id',currentProg.id).maybeSingle();
      startISO=acc?.start_date||null;
    }
    // Calcul de la semaine courante de l'athlète si on a une start_date
    let athleteCurWeek=1;
    if(startISO){
      const start=new Date(startISO+'T12:00:00');
      const today=new Date();
      const diffDays=Math.floor((today-start)/86400000);
      athleteCurWeek=Math.max(1,Math.min(total,Math.floor(diffDays/7)+1));
    }
    if(currentWeekOffset===0&&!window.__oneshotInit){window.__oneshotInit=true;currentWeekOffset=athleteCurWeek-1;}
    const weekNum=Math.max(1,Math.min(total,currentWeekOffset+1));
    // Dates réelles pour cette semaine (depuis start_date)
    let weekDates=null;
    if(startISO){
      const wkStart=new Date(startISO+'T12:00:00');
      wkStart.setDate(wkStart.getDate()+(weekNum-1)*7);
      weekDates=Array.from({length:7},(_,i)=>{const d=new Date(wkStart);d.setDate(wkStart.getDate()+i);return d;});
    }
    const label=weekDates
      ? `Sem. ${weekNum}/${total} — ${weekDates[0].getDate()} ${MONTHS[weekDates[0].getMonth()]} au ${weekDates[6].getDate()} ${MONTHS[weekDates[6].getMonth()]}`
      : `Semaine ${weekNum} / ${total}`;
    document.getElementById('week-label').textContent=label;
    // Sessions du programme pour cette semaine
    const {data}=await sb.from('sessions').select('day_of_week').eq('programme_id',currentProg.id).eq('week_number',weekNum);
    const withContent=hasAccess(currentProg)?new Set((data||[]).map(s=>s.day_of_week)):new Set();
    const dayLabels=['LUN','MAR','MER','JEU','VEN','SAM','DIM'];
    const pillsHtml=Array.from({length:7},(_,dow)=>{
      const dateNum=weekDates?weekDates[dow].getDate():`J${dow+1}`;
      const isActive=selectedDate===`__w${weekNum}d${dow}`;
      return `<div class="day-pill ${isActive?'active':''} ${withContent.has(dow)?'has-content':''}" onclick="selectDateOneshot(${weekNum},${dow})">
        <div class="day-name">${dayLabels[dow]}</div><div class="day-num">${dateNum}</div>
      </div>`;
    }).join('');
    document.getElementById('day-strip').innerHTML=pillsHtml+`<div class="day-pill day-pick-trigger" onclick="toggleDatePicker(event)" title="Choisir une semaine">
      <div class="pick-cal">📅</div><div class="pick-arrow">▾</div>
    </div>`;
    return;
  }
  const dates=getWeekDates(currentWeekOffset);
  const wk=getWeekNum(dates[0]);
  document.getElementById('week-label').textContent=`Sem. ${wk} — ${MONTHS[dates[0].getMonth()]}`;
  const isos=dates.map(d=>d.toISOString().split('T')[0]);
  const {data}=await sb.from('sessions').select('date').eq('programme_id',currentProg.id).in('date',isos);
  const withContent=hasAccess(currentProg)?new Set((data||[]).map(s=>s.date)):new Set();
  const pillsHtml=dates.map(d=>{
    const iso=d.toISOString().split('T')[0];
    return `<div class="day-pill ${iso===selectedDate?'active':''} ${withContent.has(iso)?'has-content':''}" onclick="selectDate('${iso}')">
      <div class="day-name">${DAYS[d.getDay()]}</div><div class="day-num">${d.getDate()}</div>
    </div>`;
  }).join('');
  document.getElementById('day-strip').innerHTML=pillsHtml+`<div class="day-pill day-pick-trigger" onclick="toggleDatePicker(event)" title="Choisir une date">
    <div class="pick-cal">📅</div><div class="pick-arrow">▾</div>
  </div>`;
}
function selectDate(iso){selectedDate=iso;renderDayStrip();renderSessions();}
function selectDateOneshot(weekNum,dow){selectedDate=`__w${weekNum}d${dow}`;renderDayStrip();renderSessions();}
function changeWeek(dir){
  if(isOneshotProg(currentProg)){
    const total=currentProg.total_weeks||8;
    currentWeekOffset=Math.max(0,Math.min(total-1,currentWeekOffset+dir));
  } else {
    currentWeekOffset+=dir;
  }
  renderDayStrip();renderSessions();
}

// ====================================================================
// SÉLECTEUR DE DATE RAPIDE (mini-calendrier déroulant)
// ====================================================================
let _dpState={year:null,month:null}; // mois affiché dans le picker

function toggleDatePicker(ev){
  if(ev){ev.stopPropagation();}
  const pop=document.getElementById('date-picker-pop');
  if(!pop)return;
  const isOpen=pop.style.display!=='none';
  if(isOpen){closeDatePicker();return;}
  // Init : mois affiché = celui de la semaine courante
  if(isOneshotProg(currentProg)){
    _dpState.year=null;_dpState.month=null;
  } else {
    const dates=getWeekDates(currentWeekOffset);
    const ref=dates[0];
    _dpState.year=ref.getFullYear();
    _dpState.month=ref.getMonth();
  }
  renderDatePicker();
  pop.style.display='';
  document.querySelectorAll('.day-pick-trigger').forEach(el=>el.classList.add('open'));
  // Fermeture au clic ailleurs
  setTimeout(()=>document.addEventListener('click',_dpOutsideClick),0);
}

function closeDatePicker(){
  const pop=document.getElementById('date-picker-pop');
  if(pop)pop.style.display='none';
  document.querySelectorAll('.day-pick-trigger').forEach(el=>el.classList.remove('open'));
  document.removeEventListener('click',_dpOutsideClick);
}

function _dpOutsideClick(e){
  const pop=document.getElementById('date-picker-pop');
  if(!pop)return;
  if(pop.contains(e.target))return;
  if(e.target.closest('.day-pick-trigger'))return;
  closeDatePicker();
}

function _dpPad(n){return n<10?'0'+n:''+n;}
function _dpIso(d){return d.getFullYear()+'-'+_dpPad(d.getMonth()+1)+'-'+_dpPad(d.getDate());}

function dpChangeMonth(dir){
  let m=_dpState.month+dir, y=_dpState.year;
  if(m<0){m=11;y--;}
  if(m>11){m=0;y++;}
  _dpState.month=m;_dpState.year=y;
  renderDatePicker();
}

function renderDatePicker(){
  const pop=document.getElementById('date-picker-pop');
  if(!pop)return;

  // ===== MODE ONE-SHOT : liste des semaines du programme =====
  if(isOneshotProg(currentProg)){
    const total=currentProg.total_weeks||8;
    const currentWeek=currentWeekOffset+1;
    let sel=null;
    if(typeof selectedDate==='string'&&selectedDate.startsWith('__w')){
      const m=selectedDate.match(/^__w(\d+)d(\d+)$/);
      if(m)sel=parseInt(m[1]);
    }
    let html=`<div class="dp-head"><div class="dp-title">${currentProg.name||'Programme'} — ${total} semaines</div></div>`;
    html+='<div class="dp-weeks">';
    for(let w=1;w<=total;w++){
      const isActive=(sel===w)||(!sel&&w===currentWeek);
      html+=`<button class="dp-week-btn ${isActive?'dp-active':''}" onclick="pickOneshotWeek(${w})">S${w}</button>`;
    }
    html+='</div>';
    pop.innerHTML=html;
    return;
  }

  // ===== MODE CALENDRIER NORMAL =====
  const y=_dpState.year,m=_dpState.month;
  const monthsLong=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const dow=['L','M','M','J','V','S','D'];
  const firstDow=new Date(y,m,1).getDay();
  const startOffset=(firstDow+6)%7; // Lundi = 0
  const daysInMonth=new Date(y,m+1,0).getDate();
  const todayIso=_dpIso(new Date());
  let html=`<div class="dp-head">
    <button class="dp-arrow" onclick="dpChangeMonth(-1)">‹</button>
    <div class="dp-title">${monthsLong[m]} ${y}</div>
    <button class="dp-arrow" onclick="dpChangeMonth(1)">›</button>
  </div>`;
  html+='<div class="dp-grid">';
  for(const d of dow)html+=`<div class="dp-dow">${d}</div>`;
  // Cases du mois précédent (greyed)
  for(let i=0;i<startOffset;i++){
    const d=new Date(y,m,1-(startOffset-i));
    html+=`<div class="dp-cell dp-other" onclick="pickCalendarDate('${_dpIso(d)}')">${d.getDate()}</div>`;
  }
  // Cases du mois courant
  for(let day=1;day<=daysInMonth;day++){
    const d=new Date(y,m,day);
    const iso=_dpIso(d);
    const isToday=iso===todayIso;
    const isActive=iso===selectedDate;
    html+=`<div class="dp-cell ${isToday?'dp-today':''} ${isActive?'dp-active':''}" onclick="pickCalendarDate('${iso}')">${day}</div>`;
  }
  // Cases du mois suivant (pour remplir la grille)
  const used=startOffset+daysInMonth;
  const trail=(7-(used%7))%7;
  for(let i=1;i<=trail;i++){
    const d=new Date(y,m+1,i);
    html+=`<div class="dp-cell dp-other" onclick="pickCalendarDate('${_dpIso(d)}')">${i}</div>`;
  }
  html+='</div>';
  html+=`<div class="dp-foot"><button class="dp-today-btn" onclick="pickCalendarDate('${todayIso}')">Aujourd'hui</button></div>`;
  pop.innerHTML=html;
}

function pickCalendarDate(iso){
  // Calcule l'offset de semaine entre aujourd'hui et la date choisie
  const today=new Date();
  const todayDay=today.getDay();
  const todayMon=new Date(today);
  todayMon.setDate(today.getDate()-(todayDay===0?6:todayDay-1));
  todayMon.setHours(0,0,0,0);

  const [yy,mm,dd]=iso.split('-').map(Number);
  const picked=new Date(yy,mm-1,dd);
  const pDay=picked.getDay();
  const pMon=new Date(picked);
  pMon.setDate(picked.getDate()-(pDay===0?6:pDay-1));
  pMon.setHours(0,0,0,0);

  const diffMs=pMon-todayMon;
  currentWeekOffset=Math.round(diffMs/(7*86400000));
  selectedDate=iso;
  closeDatePicker();
  renderDayStrip();
  renderSessions();
}

function pickOneshotWeek(weekNum){
  currentWeekOffset=weekNum-1;
  // Sélectionne le 1er jour de la semaine choisie (lundi = dow 0 côté one-shot)
  selectedDate=`__w${weekNum}d0`;
  closeDatePicker();
  renderDayStrip();
  renderSessions();
}

