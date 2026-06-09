// ===================================================
// WELLNESS — saisie quotidienne athlète + tableau admin
// Dépend de : utils.js, core.js (sb, currentUser, currentProfile)
// ===================================================

// --- WELLNESS ATHLÈTE ---
const WELLNESS_FIELDS=[
  {key:'sleep_quality',name:'Qualité du sommeil',icon:'😴',inv:false},
  {key:'energy',name:'Énergie',icon:'🔥',inv:false},
  {key:'fatigue',name:'Fatigue générale',icon:'💪',inv:true},
  {key:'soreness',name:'Courbatures',icon:'🦵',inv:true},
  {key:'motivation',name:'Motivation',icon:'🚀',inv:false},
  {key:'mood',name:'Humeur',icon:'😊',inv:false},
  {key:'stress',name:'Stress',icon:'😰',inv:true},
];
let _wellnessToday=null;

function _wellnessColor(val,inv){
  if(typeof val!=='number')return '#7a7a7a';
  const v=inv?(11-val):val;
  if(v>=8)return '#47ff8c';
  if(v>=5)return '#e8ff47';
  if(v>=3)return '#ff8c47';
  return '#ff4747';
}

async function loadWellnessPage(){
  const today=new Date();
  document.getElementById('wellness-date').textContent=today.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}).toUpperCase();
  const av=document.getElementById('wellness-avatar');
  if(av&&currentProfile)av.textContent=_initials(currentProfile.full_name||currentProfile.email);
  const iso=_isoDate(today);
  let existing=null;
  try{const {data}=await sb.from('wellness_entries').select('*').eq('athlete_id',currentUser.id).eq('date',iso).maybeSingle();existing=data;}catch(e){console.warn('wellness load',e);}
  _wellnessToday=existing||{};
  document.getElementById('wellness-banner-sub').textContent=existing?'Tu peux mettre à jour jusqu\'à minuit':'Une saisie quotidienne pour ton coach';
  document.getElementById('wellness-save-btn').textContent=existing?'Mettre à jour':'Enregistrer ma journée';
  renderWellnessForm();
}

function renderWellnessForm(){
  const wrap=document.getElementById('wellness-form');
  const v=_wellnessToday||{};
  let html=WELLNESS_FIELDS.map(f=>{
    const val=typeof v[f.key]==='number'?v[f.key]:5;
    const c=_wellnessColor(val,f.inv);
    return `<div class="well-row"><div class="lab"><div class="name">${f.icon} ${f.name}</div><div class="val" style="color:${c}" id="wv-${f.key}">${val}/10</div></div><input type="range" min="1" max="10" step="1" value="${val}" class="well-slider" data-key="${f.key}" data-inv="${f.inv?1:0}" oninput="_onWellSlide(this)" style="--c:${c}"></div>`;
  }).join('');
  html+=`<div class="well-row" style="margin-bottom:0"><div class="lab"><div class="name">📝 Note libre</div></div><textarea id="wv-notes" placeholder="Petit mot pour le coach... (optionnel)">${escapeHtml(v.notes||'')}</textarea></div>`;
  wrap.innerHTML=html;
  document.querySelectorAll('#wellness-form .well-slider').forEach(s=>{
    const inv=s.dataset.inv==='1';const v=parseInt(s.value);const c=_wellnessColor(v,inv);
    s.style.setProperty('background',`linear-gradient(to right, ${c} 0%, ${c} ${(v-1)/9*100}%, var(--border2) ${(v-1)/9*100}%, var(--border2) 100%)`);
  });
}

function _onWellSlide(el){
  const k=el.dataset.key,inv=el.dataset.inv==='1',v=parseInt(el.value);
  const c=_wellnessColor(v,inv);
  const lab=document.getElementById('wv-'+k);
  if(lab){lab.textContent=v+'/10';lab.style.color=c;}
  el.style.background=`linear-gradient(to right, ${c} 0%, ${c} ${(v-1)/9*100}%, var(--border2) ${(v-1)/9*100}%, var(--border2) 100%)`;
}

async function saveWellness(){
  const today=_isoDate(new Date());
  const payload={athlete_id:currentUser.id,date:today};
  WELLNESS_FIELDS.forEach(f=>{const el=document.querySelector(`#wellness-form [data-key="${f.key}"]`);if(el)payload[f.key]=parseInt(el.value);});
  const notes=document.getElementById('wv-notes')?.value?.trim()||null;
  payload.notes=notes;
  const {error}=await sb.from('wellness_entries').upsert(payload,{onConflict:'athlete_id,date'});
  if(error){
    const msg=(error.message||'').toLowerCase();
    if(msg.includes('schema')||msg.includes('does not exist')||msg.includes('not find'))showToast('⚠️ Table wellness manquante — exécute sql/wellness_entries.sql dans Supabase');
    else showToast('❌ '+error.message);
    return;
  }
  showToast('✅ Wellness enregistré');
  _wellnessToday=payload;
  document.getElementById('wellness-save-btn').textContent='Mettre à jour';
  document.getElementById('wellness-banner-sub').textContent='Tu peux mettre à jour jusqu\'à minuit';
}

// --- WELLNESS ADMIN ---
let _wellnessAdminPeriod=1;

function setWellnessAdminPeriod(d,btn){
  _wellnessAdminPeriod=d;
  document.querySelectorAll('.well-period button').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  loadWellnessAdmin();
}

async function loadWellnessAdmin(){
  const today=new Date();
  document.getElementById('wellness-admin-date').textContent=today.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  const since=_isoDate(_addDays(today,-(_wellnessAdminPeriod-1)));
  const _wStudioId=getStudioId();
  let profsQ=sb.from('profiles').select('id,full_name,email');
  if(_wStudioId){profsQ=profsQ.eq('studio_id',_wStudioId);}else{profsQ=profsQ.is('studio_id',null);}
  const {data:profs}=await profsQ.order('full_name');
  const profIds=(profs||[]).map(p=>p.id);
  let entries=[];
  try{if(profIds.length){const {data}=await sb.from('wellness_entries').select('*').gte('date',since).in('athlete_id',profIds);entries=data||[];}}catch(e){console.warn('wellness admin',e);}
  const lastByAth={};
  entries.forEach(e=>{const cur=lastByAth[e.athlete_id];if(!cur||e.date>cur.date)lastByAth[e.athlete_id]=e;});
  const rows=(profs||[]).map(p=>{const e=lastByAth[p.id];return{p,e,sev:_wellnessSeverity(e)};});
  const sevOrder={red:0,orange:1,green:2,none:3};
  rows.sort((a,b)=>(sevOrder[a.sev]-sevOrder[b.sev])||(a.p.full_name||'').localeCompare(b.p.full_name||''));
  const filled=rows.filter(r=>r.e).length;
  const alerts=rows.filter(r=>r.sev==='red').length;
  const fatigues=rows.filter(r=>r.e&&typeof r.e.fatigue==='number').map(r=>r.e.fatigue);
  const fAvg=fatigues.length?(fatigues.reduce((s,v)=>s+v,0)/fatigues.length).toFixed(1):'—';
  document.getElementById('wa-alerts').textContent=alerts;
  document.getElementById('wa-fills').textContent=`${filled} / ${rows.length}`;
  document.getElementById('wa-fatigue').textContent=fAvg;
  document.getElementById('wa-list').innerHTML=rows.map(r=>{
    if(!r.e)return `<div class="well-alert muted"><div class="av">${_initials(r.p.full_name||r.p.email)}</div><div class="mid"><div class="nm">${escapeHtml(r.p.full_name||'—')}</div><div class="meta"><span class="well-chip">Pas de saisie</span></div></div></div>`;
    const ic=r.sev==='red'?'🚨':(r.sev==='orange'?'⚠️':(r.sev==='green'?'✅':''));
    return `<div class="well-alert ${r.sev}" onclick="openAthleteFicheFromDash('${r.p.id}')"><div class="av">${_initials(r.p.full_name||r.p.email)}</div><div class="mid"><div class="nm">${escapeHtml(r.p.full_name||'—')}</div><div class="meta">${_wellnessChips(r.e)}</div></div><div class="ic">${ic}</div></div>`;
  }).join('')||'<div class="empty"><p>Aucune donnée.</p></div>';
}

function _wellnessSeverity(e){
  if(!e)return 'none';
  const reds=[];
  if(e.fatigue>=8)reds.push('fat');if(e.soreness>=8)reds.push('sor');if(e.stress>=8)reds.push('str');if(e.sleep_quality<=4)reds.push('slp');if(e.energy<=3)reds.push('eng');
  if(reds.length>=2)return 'red';if(reds.length===1)return 'orange';
  if((e.energy>=7||e.motivation>=7)&&e.fatigue<=5)return 'green';
  return 'orange';
}

function _wellnessChips(e){
  const out=[];
  const push=(name,v,inv)=>{if(typeof v!=='number')return;let cls='';const norm=inv?v:(11-v);if((inv&&v>=8)||(!inv&&v<=3))cls='r';else if((inv&&v>=6)||(!inv&&v<=5))cls='o';else cls='g';out.push(`<span class="well-chip ${cls}">${name} ${v}</span>`);};
  push('Fatigue',e.fatigue,true);push('Courb.',e.soreness,true);push('Sommeil',e.sleep_quality,false);push('Stress',e.stress,true);push('Énergie',e.energy,false);
  return out.slice(0,4).join(' ');
}
