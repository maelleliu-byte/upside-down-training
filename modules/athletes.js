// ===================================================
// FICHE ATHLÈTE — vue admin
// Dépend de : utils.js, wellness.js (module), core.js
// ===================================================

// --- DNF toggle ---
function onDnfToggle(sid){
  const cb=document.getElementById('dnf-'+sid);
  const row=document.getElementById('dnf-reps-row-'+sid);
  const inp=document.getElementById('score-input-'+sid);
  const minEl=document.getElementById('time-min-'+sid);
  const secEl=document.getElementById('time-sec-'+sid);
  if(!row)return;
  if(cb&&cb.checked){row.style.display='';if(inp){inp.value='';inp.disabled=true;inp.style.opacity=.4;}[minEl,secEl].forEach(e=>{if(e){e.value='';e.disabled=true;e.style.opacity=.4;}});}
  else{row.style.display='none';if(inp){inp.disabled=false;inp.style.opacity=1;}[minEl,secEl].forEach(e=>{if(e){e.disabled=false;e.style.opacity=1;}});}
}

// --- Fiche athlète ---
async function openAthleteCard(id){
  const card=document.getElementById('admin-athlete-card');
  const list=document.getElementById('admin-athletes-list');
  if(!card||!list)return;
  list.style.display='none';card.style.display='block';
  document.getElementById('page-admin').scrollTop=0;
  const {data:p}=await sb.from('profiles').select('*').eq('id',id).single();
  if(!p)return;
  document.getElementById('ac-avatar').textContent=_initials(p.full_name||p.email);
  document.getElementById('ac-name').textContent=(p.full_name||'—').toUpperCase();
  const since=p.created_at?new Date(p.created_at).toLocaleDateString('fr-FR',{month:'short',year:'numeric'}):'';
  document.getElementById('ac-sub').textContent=`${p.email||''}${since?' · Athlète depuis '+since:''}`;
  await Promise.all([_loadAthleteCardStats(id),_loadAthleteCardPRs(id),_loadAthleteCardWellness(id)]);
}

function closeAthleteCard(){
  document.getElementById('admin-athlete-card').style.display='none';
  document.getElementById('admin-athletes-list').style.display='';
  const panel=document.getElementById('admin-athletes');
  if(panel&&panel.dataset.returnTo==='dashboard'){delete panel.dataset.returnTo;const tabBtn=document.querySelector('.admin-tab-btn[onclick*="dashboard"]');if(tabBtn)adminTab('dashboard',tabBtn);}
}

async function openAthleteFicheFromDash(id){
  document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
  const panel=document.getElementById('admin-athletes');
  panel.classList.add('active');panel.dataset.returnTo='dashboard';
  document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.remove('active'));
  if(typeof loadAdminAthletes==='function'){try{await loadAdminAthletes();}catch(e){}}
  openAthleteCard(id);
}

async function _loadAthleteCardStats(id){
  const today=new Date();
  const wkStart=_weekStart(today);
  const monthStart=new Date(today.getFullYear(),today.getMonth(),1);
  const last30=_addDays(today,-30);
  const iso30=_isoDate(last30);
  const isoWeek=_isoDate(wkStart);
  const isoMonth=_isoDate(monthStart);
  let weekDone=[],monthCount=0,scores30=[];
  try{
    let res=await sb.from('wod_scores').select('session_id,created_at,done_at').eq('athlete_id',id).or(`done_at.gte.${iso30},and(done_at.is.null,created_at.gte.${last30.toISOString()})`);
    if(res.error&&/done_at/.test(res.error.message||''))res=await sb.from('wod_scores').select('session_id,created_at').eq('athlete_id',id).gte('created_at',last30.toISOString());
    if(res.error)console.warn('wod_scores fetch',res.error);
    scores30=res.data||[];
    const scoresWithDay=scores30.map(s=>({...s,_day:s.done_at||(s.created_at?_isoDate(new Date(s.created_at)):null)})).filter(s=>s._day);
    const monthScores=scoresWithDay.filter(s=>s._day>=isoMonth);
    monthCount=monthScores.length;
    weekDone=monthScores.filter(s=>s._day>=isoWeek);
    scores30=scoresWithDay;
  }catch(e){console.warn('wod_scores fetch',e);}
  document.getElementById('ac-week').textContent=weekDone.length;
  document.getElementById('ac-month').textContent=monthCount;
  let attendance='0%';
  if(scores30.length){const days=new Set(scores30.map(s=>s._day));attendance=Math.round(days.size/30*100)+'%';}
  document.getElementById('ac-attendance').textContent=attendance;
  const cal=document.getElementById('ac-cal');
  const labels=['L','M','M','J','V','S','D'];
  const todayIso=_isoDate(today);
  const weekDoneSet=new Set(weekDone.map(s=>s._day));
  cal.innerHTML=labels.map((lab,i)=>{const d=_addDays(wkStart,i);const iso=_isoDate(d);const isToday=iso===todayIso;const done=weekDoneSet.has(iso);return `<div class="afiche-cal-day ${done?'done':''} ${isToday?'today':''}">${lab}</div>`;}).join('');
}

async function _loadAthleteCardPRs(id){
  const wrap=document.getElementById('ac-prs');
  wrap.innerHTML='<div style="color:var(--muted);font-size:12px;padding:8px 0">Chargement…</div>';
  let prs=[];
  try{const {data,error}=await sb.from('athlete_prs').select('movement_id,value,recorded_at,format,created_at').eq('athlete_id',id).order('recorded_at',{ascending:true,nullsFirst:false});if(error)console.warn('athlete_prs fetch',error);prs=data||[];}catch(e){console.warn(e);}
  if(!prs.length){wrap.innerHTML='<div style="color:var(--muted);font-size:12px;padding:8px 0">Aucun PR enregistré.</div>';return;}
  const byMov={};
  prs.forEach(pr=>{(byMov[pr.movement_id]=byMov[pr.movement_id]||[]).push(pr);});
  const movIds=Object.keys(byMov);
  let movs={};
  if(movIds.length){try{const {data:m}=await sb.from('movements').select('id,name,unit').in('id',movIds);(m||[]).forEach(x=>{movs[x.id]={name:x.name,unit:x.unit||''};});}catch(e){}}
  const items=movIds.map(mid=>{
    const series=byMov[mid].slice().sort((a,b)=>((a.recorded_at||a.created_at||'')+'').localeCompare((b.recorded_at||b.created_at||'')+''));
    return{mid,series,last:series[series.length-1]};
  }).sort((a,b)=>((b.last.recorded_at||b.last.created_at||'')+'').localeCompare((a.last.recorded_at||a.last.created_at||'')+'')).slice(0,6);
  wrap.innerHTML=items.map(it=>{
    const{series,last}=it;
    const mov=movs[it.mid]||{};
    const name=mov.name||'Mouvement';const unit=mov.unit||'';
    const first=series[0]?.value;const lastV=last.value;
    const isTime=unit==='s'||unit==='min';
    const delta=(typeof first==='number'&&typeof lastV==='number')?(lastV-first):null;
    const trend=delta==null?'':(isTime?(delta>0?'down':'up'):(delta>0?'up':'down'));
    const deltaTxt=(delta==null||delta===0)?'':(isTime?(delta>0?`+${Math.abs(delta).toFixed(0)}${unit}`:`-${Math.abs(delta).toFixed(0)}${unit}`):(delta>0?`+${Math.abs(delta).toFixed(1)}${unit}`:`-${Math.abs(delta).toFixed(1)}${unit}`));
    const points=_sparkPoints(series.map(s=>s.value),isTime?'time':'val');
    const color=delta==null?'var(--accent)':(trend==='up'?'#47ff8c':'#ff8c47');
    const valTxt=(typeof lastV==='number'?lastV:lastV)+(unit||'');
    return `<div class="afiche-pr"><div class="afiche-pr-head"><div><div class="afiche-pr-name">${escapeHtml(name)}${last.format?` <span style="color:var(--muted);font-size:11px">· ${escapeHtml(last.format)}</span>`:''}</div>${deltaTxt?`<div class="afiche-pr-trend ${trend==='down'?'down':''}">${deltaTxt} sur ${series.length} entrée${series.length>1?'s':''}</div>`:''}</div><div class="afiche-pr-val">${escapeHtml(String(valTxt))}</div></div><svg class="afiche-spark" viewBox="0 0 300 32" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/></svg></div>`;
  }).join('');
}

function _sparkPoints(values,kind){
  if(!values||!values.length)return '0,16';
  const min=Math.min(...values),max=Math.max(...values);const range=max-min||1;const w=300,h=32,pad=4;
  return values.map((v,i)=>{const x=values.length===1?w/2:(i/(values.length-1))*w;let y;if(kind==='time'){y=pad+((v-min)/range)*(h-2*pad);}else{y=h-pad-((v-min)/range)*(h-2*pad);}return `${x.toFixed(0)},${y.toFixed(1)}`;}).join(' ');
}

async function _loadAthleteCardWellness(id){
  const wrap=document.getElementById('ac-wellness');
  const since=_isoDate(_addDays(new Date(),-14));
  let entries=[];
  try{const {data}=await sb.from('wellness_entries').select('*').eq('athlete_id',id).gte('date',since).order('date',{ascending:true});entries=data||[];}catch(e){console.warn('wellness fetch',e);}
  if(!entries.length){wrap.innerHTML='<div style="color:var(--muted);font-size:12px;padding:8px 0">Pas de saisie wellness sur les 14 derniers jours.</div>';return;}
  const metrics=[{key:'fatigue',name:'Fatigue générale',color:'#ff8c47',inv:true},{key:'sleep_quality',name:'Qualité du sommeil',color:'#47c8ff'},{key:'soreness',name:'Courbatures',color:'#ff4747',inv:true},{key:'energy',name:'Énergie',color:'#e8ff47'}];
  wrap.innerHTML=metrics.map(m=>{
    const vals=entries.map(e=>e[m.key]).filter(v=>typeof v==='number');if(!vals.length)return '';
    const avg=(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(1);
    return `<div class="afiche-pr"><div class="afiche-pr-head"><div class="afiche-pr-name">${m.name}</div><div class="afiche-pr-val" style="color:${m.color}">${avg}/10</div></div><svg class="afiche-spark" viewBox="0 0 300 32" preserveAspectRatio="none"><polyline points="${_sparkPoints(vals,'val')}" fill="none" stroke="${m.color}" stroke-width="2"/></svg></div>`;
  }).join('')||'<div style="color:var(--muted);font-size:12px">Pas assez de données.</div>';
}

// --- Override loadAdminAthletes pour rendre les rows cliquables ---
const __origLoadAdminAthletes=loadAdminAthletes;
loadAdminAthletes=async function(){
  await __origLoadAdminAthletes();
  document.querySelectorAll('#admin-athletes-list .athlete-row').forEach(row=>{
    if(row._wired)return;row._wired=1;
    row.addEventListener('click',(e)=>{
      if(e.target.closest('.btn-delete'))return;
      const btn=row.querySelector('.btn-delete');
      const m=btn&&btn.getAttribute('onclick')&&btn.getAttribute('onclick').match(/deleteAthlete\('([^']+)'/);
      if(m)openAthleteCard(m[1]);
    });
  });
};
