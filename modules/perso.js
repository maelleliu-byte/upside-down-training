// ===================================================
// ESPACE PERSO — gestion des séances personnalisées
// Dépend de : utils.js, core.js (getWeekDates, getWeekNum,
//   buildSessionCard, buildSeparatorCard, renderContentWithCharges,
//   TYPE_LABELS, DAYS, MONTHS, sb, currentUser, currentProfile,
//   saveSession, editingSessionId, setEditorContent, clearEditor,
//   getFormVideos, setFormVideos, multiScoreEnabled, selectedSessionColor)
// ===================================================

// --- STATE ---
let persoAthletesCache=[];
let currentPersoAthlete=null;
let persoView='week';
let persoOffset=0;
let persoSessionsCache=[];
let personalAthleteId=null;
let personalEditingId=null;
let personalSessionCounts={};
let personalLastDate={};
let persoChip=(()=>{try{return localStorage.getItem('perso_chip')||'all';}catch(e){return 'all';}})();
let persoCollapsed=(()=>{try{return JSON.parse(localStorage.getItem('perso_collapsed')||'{"inactive":true}');}catch(e){return {inactive:true};}})();

// --- LISTE ATHLÈTES ---
async function loadPersoAthletes(){
  document.getElementById('perso-list-view').style.display='';
  document.getElementById('perso-fiche-view').style.display='none';
  document.getElementById('perso-form-view').style.display='none';
  const _pStudioId=currentProfile?.studio_id??null;
  let _pq=sb.from('profiles').select('*');
  if(_pStudioId){_pq=_pq.eq('studio_id',_pStudioId);}
  else{_pq=_pq.is('studio_id',null);}
  const {data}=await _pq.order('full_name');
  persoAthletesCache=data||[];
  const {data:favRows}=await sb.from('coach_favorites').select('athlete_id').eq('coach_id',currentUser.id);
  const favSet=new Set((favRows||[]).map(r=>r.athlete_id));
  persoAthletesCache.forEach(a=>{a.coach_favorite=favSet.has(a.id);});
  const {data:rows}=await sb.from('personal_sessions').select('athlete_id,date');
  personalSessionCounts={};
  personalLastDate={};
  (rows||[]).forEach(r=>{
    personalSessionCounts[r.athlete_id]=(personalSessionCounts[r.athlete_id]||0)+1;
    if(!personalLastDate[r.athlete_id]||r.date>personalLastDate[r.athlete_id])personalLastDate[r.athlete_id]=r.date;
  });
  renderPersoAthletes();
}

function filterPersoAthletes(){renderPersoAthletes();}

function renderPersoAthletes(){
  const q=(document.getElementById('perso-search')?.value||'').trim().toLowerCase();
  const el=document.getElementById('perso-athletes-list');
  if(!el)return;
  const all=persoAthletesCache.filter(a=>a.role!=='admin');
  const favs=[],actifs=[],inactifs=[];
  all.forEach(a=>{
    const cnt=personalSessionCounts[a.id]||0;
    if(a.coach_favorite)favs.push(a);
    else if(cnt>0)actifs.push(a);
    else inactifs.push(a);
  });
  const byName=(a,b)=>(a.full_name||'').localeCompare(b.full_name||'');
  favs.sort(byName);
  actifs.sort((a,b)=>{const da=personalLastDate[a.id]||'',db=personalLastDate[b.id]||'';if(da!==db)return db.localeCompare(da);return byName(a,b);});
  inactifs.sort(byName);
  if(q){
    const match=a=>(a.full_name||'').toLowerCase().includes(q)||(a.email||'').toLowerCase().includes(q);
    const flat=all.filter(match).sort((a,b)=>{if(!!b.coach_favorite-!!a.coach_favorite)return !!b.coach_favorite-!!a.coach_favorite;return byName(a,b);});
    el.innerHTML=_persoChipsHTML(favs.length,actifs.length,inactifs.length)+(flat.length?flat.map(_renderPersoCard).join(''):'<div class="empty"><p>Aucun athlète trouvé.</p></div>');
    return;
  }
  const visible=new Set();
  if(persoChip==='all'||persoChip==='fav')favs.forEach(a=>visible.add(a.id));
  if(persoChip==='all'||persoChip==='actifs')actifs.forEach(a=>visible.add(a.id));
  if(persoChip==='all'||persoChip==='inactifs')inactifs.forEach(a=>visible.add(a.id));
  const sec=(key,lbl,ic,icCls,list)=>{
    if(!list.length||!list.some(a=>visible.has(a.id)))return '';
    const collapsed=!!persoCollapsed[key];
    const body=collapsed?'':list.filter(a=>visible.has(a.id)).map(_renderPersoCard).join('');
    return `<div class="perso-section"><div class="perso-sec-bar ${collapsed?'collapsed':''} ${key}" onclick="togglePersoSection('${key}')"><span class="perso-sec-ic ${icCls}">${ic}</span><span class="perso-sec-lb">${lbl}</span><span class="perso-sec-ct">${list.length}</span><span class="perso-sec-arr">▾</span></div><div class="perso-sec-body">${body}</div></div>`;
  };
  let html=_persoChipsHTML(favs.length,actifs.length,inactifs.length)+sec('fav','Favoris','★','fav',favs)+sec('actifs','Actifs récents','🔥','act',actifs)+sec('inactive','Sans séance perso','○','oth',inactifs);
  if(!favs.length&&!actifs.length&&!inactifs.length)html+='<div class="empty"><p>Aucun athlète.</p></div>';
  el.innerHTML=html;
}

function _persoChipsHTML(nFav,nAct,nIna){
  const c=(key,lbl,n,extra='')=>`<span class="perso-chip ${extra} ${persoChip===key?'on':''}" onclick="setPersoChip('${key}')">${lbl} <span class="n">${n}</span></span>`;
  return `<div class="perso-chips">${c('all','Tous',nFav+nAct+nIna)}${c('fav','★ Favoris',nFav,'fav')}${c('actifs','Actifs',nAct)}${c('inactifs','Sans séance',nIna)}</div>`;
}

function setPersoChip(chip){
  persoChip=chip;
  try{localStorage.setItem('perso_chip',chip);}catch(e){}
  if(chip!=='all'){const key=chip==='fav'?'fav':chip==='actifs'?'actifs':'inactive';persoCollapsed[key]=false;try{localStorage.setItem('perso_collapsed',JSON.stringify(persoCollapsed));}catch(e){}}
  renderPersoAthletes();
}

function togglePersoSection(key){
  persoCollapsed[key]=!persoCollapsed[key];
  try{localStorage.setItem('perso_collapsed',JSON.stringify(persoCollapsed));}catch(e){}
  renderPersoAthletes();
}

async function togglePersoFavorite(athleteId,ev){
  if(ev){ev.stopPropagation();ev.preventDefault();}
  const a=persoAthletesCache.find(x=>x.id===athleteId);
  if(!a)return;
  const next=!a.coach_favorite;
  a.coach_favorite=next;
  renderPersoAthletes();
  let error;
  if(next){({error}=await sb.from('coach_favorites').insert({coach_id:currentUser.id,athlete_id:athleteId}));}
  else{({error}=await sb.from('coach_favorites').delete().eq('coach_id',currentUser.id).eq('athlete_id',athleteId));}
  if(error){a.coach_favorite=!next;renderPersoAthletes();if(typeof showToast==='function')showToast('❌ '+error.message);return;}
  if(typeof showToast==='function')showToast(next?'★ Ajouté aux favoris':'Retiré des favoris');
}

function _renderPersoCard(a){
  const init=(a.full_name||a.email||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const cnt=personalSessionCounts[a.id]||0;
  const last=personalLastDate[a.id];
  const fav=!!a.coach_favorite;
  let pill='';
  if(last){const d=_persoDaysAgo(last);pill=`<span class="perso-activity-pill ${d>=15?'warn':''}">${_persoRelLabel(d)}</span>`;}
  const sub=cnt>0?`${cnt} séance${cnt>1?'s':''}${last?' · '+_persoRelLabel(_persoDaysAgo(last),true):''}`:escapeHtml(a.email||'aucune séance perso');
  return `<div class="perso-athlete-card${fav?' fav':''}" onclick="openPersoFiche('${a.id}')"><div class="athlete-avatar">${init}</div><div class="perso-meta"><div class="perso-name">${escapeHtml(a.full_name||'—')}</div><div class="perso-sub">${sub}</div></div>${pill}<button class="perso-fav-btn${fav?' on':''}" onclick="togglePersoFavorite('${a.id}',event)" aria-label="${fav?'Retirer des favoris':'Mettre en favori'}">${fav?'★':'☆'}</button><div class="chev">›</div></div>`;
}

function _persoDaysAgo(iso){const d=new Date(iso+'T12:00:00');return Math.floor((Date.now()-d.getTime())/86400000);}
function _persoRelLabel(d,long){if(d<=0)return long?'aujourd\'hui':'auj.';if(d===1)return long?'hier':'1j';if(d<30)return long?'il y a '+d+'j':d+'j';return long?'> 30j':'30+';}

// --- FICHE ATHLÈTE ---
async function openPersoFiche(athleteId,targetDate){
  currentPersoAthlete=persoAthletesCache.find(a=>a.id===athleteId);
  if(!currentPersoAthlete){
    const {data}=await sb.from('profiles').select('*').eq('id',athleteId).single();
    currentPersoAthlete=data;
    if(!persoAthletesCache.length)persoAthletesCache=[data];
  }
  document.getElementById('perso-list-view').style.display='none';
  document.getElementById('perso-fiche-view').style.display='';
  document.getElementById('perso-form-view').style.display='none';
  const init=(currentPersoAthlete.full_name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('perso-fiche-avatar').textContent=init;
  document.getElementById('perso-fiche-name').textContent=currentPersoAthlete.full_name||'—';
  document.getElementById('perso-fiche-sub').textContent=currentPersoAthlete.email||'';
  persoView='week';
  if(targetDate){const now=new Date(),day=now.getDay();const monNow=new Date(now);monNow.setDate(now.getDate()-(day===0?6:day-1));monNow.setHours(0,0,0,0);const tgt=new Date(targetDate+'T12:00:00'),tgtDay=tgt.getDay();const monTgt=new Date(tgt);monTgt.setDate(tgt.getDate()-(tgtDay===0?6:tgtDay-1));monTgt.setHours(0,0,0,0);persoOffset=Math.round((monTgt-monNow)/(7*24*60*60*1000));}else{persoOffset=0;}
  document.getElementById('perso-view-week').classList.add('active');
  document.getElementById('perso-view-month').classList.remove('active');
  await renderPersoCalendar();
}

function persoBackToList(){loadPersoAthletes();}
function persoBackToFiche(){
  if(currentPersoAthlete){
    document.getElementById('perso-list-view').style.display='none';
    document.getElementById('perso-fiche-view').style.display='';
    document.getElementById('perso-form-view').style.display='none';
    if(personalAthleteId)exitPersoForm();
    renderPersoCalendar();
  } else {loadPersoAthletes();}
}
function persoSetView(v){persoView=v;persoOffset=0;document.getElementById('perso-view-week').classList.toggle('active',v==='week');document.getElementById('perso-view-month').classList.toggle('active',v==='month');renderPersoCalendar();}
function persoNav(dir){persoOffset+=dir;renderPersoCalendar();}

// --- CALENDRIER ---
async function renderPersoCalendar(){
  if(!currentPersoAthlete)return;
  const area=document.getElementById('perso-calendar-area');
  area.innerHTML='<div class="spinner"></div>';
  if(persoView==='week'){
    const dates=getWeekDates(persoOffset);
    const wk=getWeekNum(dates[0]);
    document.getElementById('perso-period-label').textContent=`Sem. ${wk} — ${MONTHS[dates[0].getMonth()]}`;
    const isos=dates.map(d=>d.toISOString().split('T')[0]);
    const {data}=await sb.from('personal_sessions').select('*').eq('athlete_id',currentPersoAthlete.id).in('date',isos).order('sort_order',{ascending:true,nullsFirst:false}).order('created_at');
    persoSessionsCache=data||[];
    const byDate={};isos.forEach(iso=>byDate[iso]=[]);
    (data||[]).forEach(s=>{if(byDate[s.date])byDate[s.date].push(s);});
    const _sidsW=(data||[]).filter(s=>s.type!=='separator').map(s=>s.id);
    await loadPersoRetours(_sidsW,currentPersoAthlete.id,isos);
    const today=new Date().toISOString().split('T')[0];
    const headers=dates.map(d=>`<div class="cal-day-header">${DAYS[d.getDay()]}</div>`).join('');
    const dateRow=dates.map(d=>{const iso=d.toISOString().split('T')[0];return`<div class="cal-day-date ${iso===today?'today':''}">${d.getDate()}</div>`;}).join('');
    const sessionCols=dates.map(d=>{
      const iso=d.toISOString().split('T')[0];
      const sessions=byDate[iso]||[];
      const blocks=sessions.length>0?sessions.map(s=>{
        if(s.type==='separator'){
          return`<div class="cal-rich separator" draggable="true" data-sid="${s.id}" data-date="${iso}" ondragstart="persoDragStart(event,'${s.id}','${iso}')" ondragend="persoDragEnd(event)" ondragover="persoDragOver(event)" ondrop="persoDrop(event,'${iso}','${s.id}')" onclick="openReadSession('${s.id}','personal')" style="position:relative;cursor:grab"><div class="cal-rich-actions" style="display:flex;position:absolute;top:2px;right:2px"><button class="cal-action-btn" onclick="event.stopPropagation();persoEditSession('${s.id}','${currentPersoAthlete.id}')">✏</button><button class="cal-action-btn" onclick="event.stopPropagation();persoDeleteSession('${s.id}')">✕</button></div><div class="cal-rich-title">— ${escapeHtml(s.title||'Séparateur')} —</div></div>`;
        }
        const color=s.color||'#e8ff47';
        const typeLabel=TYPE_LABELS[s.type]||s.type;
        const preview=stripHtml(renderContentWithCharges(s.content||'')).slice(0,160);
        const intensity=s.intensity?`<span>I${s.intensity}/10</span><span class="dot"></span>`:'';
        const sets=s.sets?`<span>${s.sets} séries</span><span class="dot"></span>`:'';
        const yt=s.youtube_url?`<span>▶ vidéo</span>`:'';
        return`<div class="cal-rich" draggable="true" data-sid="${s.id}" data-date="${iso}" ondragstart="persoDragStart(event,'${s.id}','${iso}')" ondragend="persoDragEnd(event)" ondragover="persoDragOver(event)" ondrop="persoDrop(event,'${iso}','${s.id}')" onclick="openReadSession('${s.id}','personal')" style="cursor:grab"><div class="cal-accent" style="background:${color}"></div><div class="cal-rich-head"><span class="cal-rich-type" style="background:${color}22;color:${color}">${typeLabel}</span><div class="cal-rich-actions"><button class="cal-action-btn" onclick="event.stopPropagation();persoEditSession('${s.id}','${currentPersoAthlete.id}')" title="Modifier">✏</button><button class="cal-action-btn" onclick="event.stopPropagation();persoDuplicateSession('${s.id}')" title="Dupliquer">📋</button><button class="cal-action-btn" onclick="event.stopPropagation();persoDeleteSession('${s.id}')" title="Supprimer">✕</button></div></div><div class="cal-rich-title">${escapeHtml(s.title||'')}</div>${preview?`<div class="cal-rich-content">${escapeHtml(preview)}</div>`:''}<div class="cal-rich-meta">${intensity}${sets}${yt}</div><div class="cal-rich-nav"><button class="cal-action-btn" onclick="event.stopPropagation();persoMoveToDay('${s.id}',-1)" title="Jour précédent">‹</button><button class="cal-action-btn" onclick="event.stopPropagation();persoMoveSession('${s.id}',-1)" title="Monter">↑</button><button class="cal-action-btn" onclick="event.stopPropagation();persoMoveSession('${s.id}',1)" title="Descendre">↓</button><button class="cal-action-btn" onclick="event.stopPropagation();persoMoveToDay('${s.id}',1)" title="Jour suivant">›</button></div>${persoRetourBlock(s.id,iso)}</div>`;
      }).join(''):`<div class="cal-empty-day" ondragover="persoDragOver(event)" ondrop="persoDrop(event,'${iso}',null)" onclick="persoNewSessionOn('${iso}')">+</div>`;
      const addMore=sessions.length>0?`<button class="cal-add-more" onclick="persoNewSessionOn('${iso}')" title="Ajouter une séance perso"><span class="plus">+</span>Séance</button>`:'';
      return`<div class="cal-day-col rich" data-date="${iso}" ondragover="persoDragOver(event)" ondrop="persoDrop(event,'${iso}',null)">${blocks}${addMore}</div>`;
    }).join('');
    area.innerHTML=`<div class="cal-grid">${headers}</div><div class="cal-grid">${dateRow}</div><div class="cal-grid" style="align-items:start">${sessionCols}</div>`;
  } else {
    // Vue MOIS
    const now=new Date();
    const ref=new Date(now.getFullYear(),now.getMonth()+persoOffset,1);
    const year=ref.getFullYear(),month=ref.getMonth();
    document.getElementById('perso-period-label').textContent=`${['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][month]} ${year}`;
    const first=new Date(year,month,1);
    const startDay=(first.getDay()===0?6:first.getDay()-1);
    const startDate=new Date(Date.UTC(year,month,1-startDay));
    const cells=[];
    for(let i=0;i<42;i++){const d=new Date(startDate);d.setUTCDate(startDate.getUTCDate()+i);cells.push(d);}
    const firstIso=`${year}-${String(month+1).padStart(2,'0')}-01`;
    const lastDay=new Date(year,month+1,0).getDate();
    const lastIso=`${year}-${String(month+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    const {data:allSess}=await sb.from('personal_sessions').select('id,date,title,color').eq('athlete_id',currentPersoAthlete.id).gte('date',firstIso).lte('date',lastIso);
    const byDate={};
    (allSess||[]).forEach(s=>{(byDate[s.date]=byDate[s.date]||[]).push(s);});
    // Charger retours pour les dots
    const allIds=(allSess||[]).map(s=>s.id);
    if(allIds.length){
      const {data:sc}=await sb.from('wod_scores').select('session_id').eq('athlete_id',currentPersoAthlete.id).in('session_id',allIds);
      const {data:nt}=await sb.from('session_notes').select('session_id').eq('athlete_id',currentPersoAthlete.id).in('session_id',allIds);
      _persoRetoursCache.scoresBySid={};
      _persoRetoursCache.notesBySid={};
      (sc||[]).forEach(x=>{_persoRetoursCache.scoresBySid[x.session_id]=x;});
      (nt||[]).forEach(x=>{_persoRetoursCache.notesBySid[x.session_id]=x;});
    }
    const today=new Date().toISOString().split('T')[0];
    const headers=['L','M','M','J','V','S','D'].map(h=>`<div class="h">${h}</div>`).join('');
    const cellsHtml=cells.map(d=>{
      const iso=d.toISOString().split('T')[0];
      const isOther=d.getUTCMonth()!==month;
      const isToday=iso===today;
      const sess=byDate[iso]||[];
      const pills=sess.map(s=>{
        const c=s.color||'#e8ff47';
        const _hasR=!!(_persoRetoursCache.scoresBySid[s.id]||_persoRetoursCache.notesBySid[s.id]);
        const _rdot=_hasR?'<span class="perso-pill-dot"></span>':'';
        return`<div class="pill" style="background:${c}22;color:${c}" onclick="event.stopPropagation();openReadSession('${s.id}','personal')">${_rdot}${escapeHtml(s.title||'—').slice(0,18)}</div>`;
      }).join('');
      return`<div class="perso-month-cell ${isOther?'other':''} ${isToday?'today':''}" onclick="persoMonthCellClick('${iso}')"><div class="num">${d.getUTCDate()}</div>${pills}</div>`;
    }).join('');
    area.innerHTML=`<div class="perso-month"><div class="perso-month-grid">${headers}</div><div class="perso-month-grid" style="margin-top:6px">${cellsHtml}</div></div>`;
  }
}

// --- RETOURS ATHLÈTE ---
let _persoRetoursCache={scoresBySid:{},notesBySid:{},wellnessByDate:{}};

async function loadPersoRetours(sessionIds,athleteId,isos){
  _persoRetoursCache={scoresBySid:{},notesBySid:{},wellnessByDate:{}};
  if(!athleteId)return;
  try{
    if(sessionIds&&sessionIds.length){
      const {data:scores}=await sb.from('wod_scores').select('id,session_id,score_value,score_text,score_type,level,sets_data,created_at').eq('athlete_id',athleteId).in('session_id',sessionIds);
      (scores||[]).forEach(sc=>{_persoRetoursCache.scoresBySid[sc.session_id]=sc;});
      const {data:notes}=await sb.from('session_notes').select('id,session_id,content,created_at').eq('athlete_id',athleteId).in('session_id',sessionIds);
      (notes||[]).forEach(n=>{_persoRetoursCache.notesBySid[n.session_id]=n;});
    }
    if(isos&&isos.length){
      const {data:well}=await sb.from('wellness_entries').select('date,sleep_quality,energy,fatigue,soreness,motivation,stress,notes').eq('athlete_id',athleteId).in('date',isos);
      (well||[]).forEach(w=>{_persoRetoursCache.wellnessByDate[w.date]=w;});
    }
  }catch(e){console.warn('perso retours load',e);}
}

function _persoWellMean(e){if(!e)return null;const inv={fatigue:1,soreness:1,stress:1};const vals=[];['sleep_quality','energy','fatigue','soreness','motivation','stress'].forEach(k=>{if(typeof e[k]==='number')vals.push(inv[k]?11-e[k]:e[k]);});if(!vals.length)return null;return vals.reduce((a,b)=>a+b,0)/vals.length;}
function _persoWellTone(e){if(!e)return '';const red=['fatigue','soreness','stress'].some(k=>typeof e[k]==='number'&&e[k]>=8)||['energy','motivation','sleep_quality'].some(k=>typeof e[k]==='number'&&e[k]<=3);if(red)return 'red';const ora=['fatigue','soreness','stress'].some(k=>typeof e[k]==='number'&&e[k]>=6)||['energy','motivation','sleep_quality'].some(k=>typeof e[k]==='number'&&e[k]<=5);return ora?'ora':'';}

function persoRetourBlock(sid,iso){
  const sc=_persoRetoursCache.scoresBySid[sid];
  const nt=_persoRetoursCache.notesBySid[sid];
  const w=_persoRetoursCache.wellnessByDate[iso];
  if(!sc&&!nt&&!w)return `<div class="perso-retour-strip empty" onclick="event.stopPropagation()"><span class="perso-r-pill miss">— pas encore de retour</span></div>`;
  const pills=[];
  if(sc){let v=sc.score_text||(typeof sc.score_value==='number'?sc.score_value:'');v=String(v||'').slice(0,16);pills.push(`<span class="perso-r-pill score" title="Score athlète">✓ <span class="v">${escapeHtml(v)||'fait'}</span></span>`);}
  if(nt)pills.push(`<span class="perso-r-pill note" title="Note de séance">📝 note</span>`);
  if(w){const mean=_persoWellMean(w);const tone=_persoWellTone(w);if(mean!=null)pills.push(`<span class="perso-r-pill well ${tone}" title="Wellness du jour">💪 <span class="v">${mean.toFixed(1)}</span></span>`);}
  return `<div class="perso-retour-strip" onclick="event.stopPropagation();togglePersoRetour('${sid}')">${pills.join('')}<span class="perso-r-tog">›</span></div><div class="perso-r-drawer" id="perso-r-d-${sid}" onclick="event.stopPropagation()">${_persoDrawerInner(sc,nt,w)}</div>`;
}

function _persoDrawerInner(sc,nt,w){
  const rows=[];
  if(sc){let scoreV=sc.score_text||(typeof sc.score_value==='number'?sc.score_value:'—');let scoreHtml=`<b>${escapeHtml(String(scoreV))}</b>`;if(sc.level)scoreHtml+=` <span class="lvl">${escapeHtml(String(sc.level).toUpperCase())}</span>`;let setsHtml='';try{const sd=sc.sets_data?(typeof sc.sets_data==='string'?JSON.parse(sc.sets_data):sc.sets_data):null;if(Array.isArray(sd)&&sd.length)setsHtml=`<div class="sets">${sd.map(s=>`S${s.set}: ${s.value}${s.unit||'kg'}`).join(' · ')}</div>`;}catch(e){}rows.push(`<div class="perso-r-row"><div class="lbl">Score</div><div class="val">${scoreHtml}${setsHtml}</div></div>`);}
  if(nt)rows.push(`<div class="perso-r-row"><div class="lbl">Note</div><div class="val note">${escapeHtml(nt.content||'')}</div></div>`);
  if(w){const tone=(k,inv)=>{const v=w[k];if(typeof v!=='number')return '';if(inv){if(v>=7)return 'r';if(v>=5)return 'o';return 'g';}if(v<=3)return 'r';if(v<=5)return 'o';return 'g';};const meta=[['sleep_quality','😴',false],['energy','🔥',false],['fatigue','💤',true],['soreness','🤕',true],['motivation','🎯',false],['stress','😰',true]];const chips=meta.filter(m=>typeof w[m[0]]==='number').map(([k,ic,inv])=>`<span class="c ${tone(k,inv)}">${ic} ${w[k]}</span>`).join('');const wnotes=w.notes?`<div class="wnotes">« ${escapeHtml(w.notes)} »</div>`:'';rows.push(`<div class="perso-r-row"><div class="lbl">Wellness</div><div class="val"><div class="perso-well-chips">${chips}</div>${wnotes}</div></div>`);}
  if(!rows.length)rows.push(`<div class="perso-r-row"><div class="val" style="color:var(--muted);font-style:italic">Pas encore de retour pour cette séance.</div></div>`);
  return `<div class="perso-r-eb">Retour athlète</div>${rows.join('')}`;
}

function togglePersoRetour(sid){const el=document.getElementById('perso-r-d-'+sid);if(!el)return;const open=el.classList.toggle('open');const strip=el.previousElementSibling;if(strip&&strip.classList.contains('perso-retour-strip'))strip.classList.toggle('open',open);}

// --- DRAG & DROP ---
let _persoDrag=null;
function persoDragStart(ev,sid,fromIso){_persoDrag={sid,fromIso};ev.dataTransfer.effectAllowed='move';try{ev.dataTransfer.setData('text/plain',sid);}catch(e){}ev.currentTarget.classList.add('dragging');}
async function persoMoveSession(sid,direction){const sess=persoSessionsCache.find(s=>s.id===sid);if(!sess)return;const sameDay=persoSessionsCache.filter(s=>s.date===sess.date).sort((a,b)=>(a.sort_order??999)-(b.sort_order??999));const idx=sameDay.findIndex(s=>s.id===sid);const ni=idx+direction;if(ni<0||ni>=sameDay.length)return;[sameDay[idx],sameDay[ni]]=[sameDay[ni],sameDay[idx]];await Promise.all(sameDay.map((s,i)=>sb.from('personal_sessions').update({sort_order:i}).eq('id',s.id)));await renderPersoCalendar();}
async function persoMoveToDay(sid,delta){const sess=persoSessionsCache.find(s=>s.id===sid);if(!sess)return;const[y,m,da]=sess.date.split('-').map(Number);const d=new Date(Date.UTC(y,m-1,da));d.setUTCDate(d.getUTCDate()+delta);const newIso=d.toISOString().split('T')[0];await sb.from('personal_sessions').update({date:newIso,sort_order:9999}).eq('id',sid);await renderPersoCalendar();}
function persoDragEnd(ev){ev.currentTarget.classList.remove('dragging');document.querySelectorAll('.cal-day-col.drag-over').forEach(el=>el.classList.remove('drag-over'));}
function persoDragOver(ev){if(!_persoDrag)return;ev.preventDefault();ev.dataTransfer.dropEffect='move';const col=ev.currentTarget.closest('.cal-day-col');if(col){document.querySelectorAll('.cal-day-col.drag-over').forEach(el=>{if(el!==col)el.classList.remove('drag-over');});col.classList.add('drag-over');}}
async function persoDrop(ev,toIso,targetSid){ev.preventDefault();ev.stopPropagation();if(!_persoDrag)return;const{sid,fromIso}=_persoDrag;_persoDrag=null;document.querySelectorAll('.cal-day-col.drag-over,.cal-rich.dragging').forEach(el=>el.classList.remove('drag-over','dragging'));if(sid===targetSid)return;const target=persoSessionsCache.filter(s=>s.date===toIso&&s.id!==sid);const moved=persoSessionsCache.find(s=>s.id===sid);if(!moved)return;let insertAt=target.length;if(targetSid){const idx=target.findIndex(s=>s.id===targetSid);if(idx>=0)insertAt=idx;}target.splice(insertAt,0,{...moved,date:toIso});try{await Promise.all(target.map((s,i)=>sb.from('personal_sessions').update({date:toIso,sort_order:i}).eq('id',s.id)));if(fromIso!==toIso){const src=persoSessionsCache.filter(s=>s.date===fromIso&&s.id!==sid);await Promise.all(src.map((s,i)=>sb.from('personal_sessions').update({sort_order:i}).eq('id',s.id)));}}catch(e){showToast('❌ '+(e.message||'Erreur'));return;}if(typeof renderPersoFiche==='function')renderPersoFiche();}

function persoMonthCellClick(iso){persoNewSessionOn(iso);}

// --- NOUVELLES SÉANCES ---
function persoNewSession(){persoNewSessionOn(new Date().toISOString().split('T')[0]);}
function persoNewSessionOn(iso){
  if(!currentPersoAthlete)return;
  enterPersoFormMode(currentPersoAthlete.id);
  resetSessionForm();
  document.getElementById('f-date').value=iso||new Date().toISOString().split('T')[0];
  document.getElementById('perso-list-view').style.display='none';
  document.getElementById('perso-fiche-view').style.display='none';
  document.getElementById('perso-form-view').style.display='';
  document.getElementById('perso-form-title').textContent='Nouvelle séance perso';
  document.getElementById('perso-form-sub').textContent=`Pour ${currentPersoAthlete.full_name||'—'}`;
  const container=document.getElementById('perso-form-container');
  const form=document.getElementById('admin-new-session');
  container.appendChild(form);
  form.classList.add('active');
  form.style.display='';
  document.getElementById('page-admin').scrollTop=0;
}

async function persoEditSession(id,athleteId){
  const {data}=await sb.from('personal_sessions').select('*').eq('id',id).single();
  if(!data){showToast('❌ Séance introuvable');return;}
  if(!currentPersoAthlete||currentPersoAthlete.id!==athleteId){
    const {data:ath}=await sb.from('profiles').select('*').eq('id',athleteId).single();
    currentPersoAthlete=ath;
    if(!persoAthletesCache.find(a=>a.id===athleteId))persoAthletesCache.push(ath);
  }
  enterPersoFormMode(athleteId);
  personalEditingId=id;
  resetSessionForm();
  document.getElementById('f-date').value=data.date;
  document.getElementById('f-type').value=data.type;
  document.getElementById('f-title').value=data.title||'';
  setEditorContent(data.content||'');
  document.getElementById('f-intensity').value=data.intensity||7;
  document.getElementById('f-int-val').textContent=data.intensity||7;
  document.getElementById('f-target').value=data.target||'';
  document.getElementById('f-tips').value=data.tips||'';
  document.getElementById('f-score-type').value=data.score_type||'reps';
  let _vids=[];try{_vids=Array.isArray(data.videos)?data.videos:(typeof data.videos==='string'?JSON.parse(data.videos):[]);}catch(e){_vids=[];}
  if((!_vids||!_vids.length)&&data.youtube_url){_vids=[{url:data.youtube_url,label:data.youtube_label||''}];}
  setFormVideos(_vids);
  document.getElementById('f-scaling-inter').value=data.scaling_inter||'';
  document.getElementById('f-scaling-scaled').value=data.scaling_scaled||'';
  document.getElementById('f-scaling-foundation').value=data.scaling_foundation||'';
  if(data.color){selectedSessionColor=data.color;document.querySelectorAll('#f-colors .color-swatch').forEach(s=>s.classList.toggle('selected',s.dataset.color===data.color));}
  if(data.type==='strength'){document.getElementById('sets-field').style.display='block';document.getElementById('f-sets').value=data.sets||'';}
  document.getElementById('perso-list-view').style.display='none';
  document.getElementById('perso-fiche-view').style.display='none';
  document.getElementById('perso-form-view').style.display='';
  document.getElementById('perso-form-title').textContent='Modifier la séance perso';
  document.getElementById('perso-form-sub').textContent=`Pour ${currentPersoAthlete.full_name||'—'}`;
  const container=document.getElementById('perso-form-container');
  const form=document.getElementById('admin-new-session');
  container.appendChild(form);
  form.classList.add('active');
  form.style.display='';
  const btn=document.querySelector('#admin-new-session .btn-primary');
  btn.textContent='💾 Sauvegarder les modifications';
  btn.style.background='var(--blue)';
  document.getElementById('page-admin').scrollTop=0;
}

async function persoDeleteSession(id){
  if(!confirm('Supprimer cette séance perso ?'))return;
  await sb.from('wod_scores').delete().eq('session_id',id).then(r=>r.error&&console.warn('cascade wod_scores',r.error.message));
  await sb.from('session_notes').delete().eq('session_id',id).then(r=>r.error&&console.warn('cascade session_notes',r.error.message));
  const {error}=await sb.from('personal_sessions').delete().eq('id',id);
  if(error){showToast('❌ '+error.message);return;}
  showToast('🗑 Séance supprimée');
  renderPersoCalendar();
}

// --- DUPLICATION ---
let persoSessionToDuplicate=null;
async function persoDuplicateSession(id){
  const {data,error}=await sb.from('personal_sessions').select('*').eq('id',id).single();
  if(error||!data){showToast('❌ Séance introuvable');return;}
  persoSessionToDuplicate=data;
  document.getElementById('dup-perso-session-name').textContent=data.title||'Séance';
  document.getElementById('dup-perso-date').value=data.date;
  document.getElementById('dup-perso-modal').classList.add('open');
}
function closeDupPersoModal(){document.getElementById('dup-perso-modal').classList.remove('open');persoSessionToDuplicate=null;}
async function confirmPersoDuplicate(){
  if(!persoSessionToDuplicate)return;
  const newDate=document.getElementById('dup-perso-date').value;
  if(!newDate){showToast('⚠️ Choisis une date');return;}
  const data=persoSessionToDuplicate;
  const{id:_id,created_at,...rest}=data;
  const sameDay=persoSessionsCache.filter(s=>s.date===newDate).sort((a,b)=>(a.sort_order??999)-(b.sort_order??999));
  let newOrder;
  if(newDate===data.date){const idx=sameDay.findIndex(s=>s.id===data.id);newOrder=idx>=0?(sameDay[idx].sort_order??idx)+1:9999;if(idx>=0){const toShift=sameDay.slice(idx+1);await Promise.all(toShift.map((s,i)=>sb.from('personal_sessions').update({sort_order:newOrder+1+i}).eq('id',s.id)));}}
  else{const last=sameDay.length?(sameDay[sameDay.length-1].sort_order??sameDay.length-1):-1;newOrder=last+1;}
  const payload={...rest,date:newDate,sort_order:newOrder,created_by:currentUser.id};
  const {error}=await sb.from('personal_sessions').insert(payload);
  if(error){showToast('❌ '+error.message);return;}
  showToast(newDate===data.date?'📋 Séance dupliquée':'📋 Séance dupliquée au '+formatDateShort(newDate));
  closeDupPersoModal();
  renderPersoCalendar();
}

function openDupPersoWeekModal(){
  if(persoView!=='week'){showToast('⚠️ Passe en vue semaine d\'abord');return;}
  const dates=getWeekDates(persoOffset);
  const wk=getWeekNum(dates[0]);
  document.getElementById('dup-perso-week-source-label').textContent=`Sem. ${wk} — ${MONTHS[dates[0].getMonth()]} ${dates[0].getFullYear()}`;
  const nextMon=new Date(dates[0]);nextMon.setDate(dates[0].getDate()+7);
  document.getElementById('dup-perso-week-target-date').value=nextMon.toISOString().split('T')[0];
  document.getElementById('dup-perso-week-modal').classList.add('open');
}
function closeDupPersoWeekModal(){document.getElementById('dup-perso-week-modal')?.classList.remove('open');}
async function confirmDupPersoWeek(){
  if(!currentPersoAthlete)return;
  const tgtDateStr=document.getElementById('dup-perso-week-target-date').value;
  if(!tgtDateStr){showToast('⚠️ Choisis une date');return;}
  const srcMon=getWeekDates(persoOffset)[0];
  const srcDates=getWeekDates(persoOffset).map(d=>d.toISOString().split('T')[0]);
  const tgtPicked=new Date(tgtDateStr+'T12:00:00');
  const tgtDay=tgtPicked.getDay();
  const tgtMon=new Date(tgtPicked);tgtMon.setDate(tgtPicked.getDate()-(tgtDay===0?6:tgtDay-1));
  const diffDays=Math.round((tgtMon-srcMon)/(24*60*60*1000));
  if(diffDays===0){showToast('⚠️ Choisis une semaine différente');return;}
  const btn=document.querySelector('#dup-perso-week-modal .btn-modal-save');
  if(btn){btn.disabled=true;btn.textContent='Copie...';}
  try{
    const {data,error}=await sb.from('personal_sessions').select('*').eq('athlete_id',currentPersoAthlete.id).in('date',srcDates);
    if(error){showToast('❌ '+error.message);return;}
    if(!data||!data.length){showToast('⚠️ Aucune séance à copier');return;}
    const rows=data.map(({id,created_at,...rest})=>{const newDate=new Date(rest.date+'T12:00:00');newDate.setDate(newDate.getDate()+diffDays);return{...rest,date:newDate.toISOString().split('T')[0],created_by:currentUser.id};});
    const {error:e2}=await sb.from('personal_sessions').insert(rows);
    if(e2){showToast('❌ '+e2.message);return;}
    showToast(`✅ ${rows.length} séance${rows.length>1?'s':''} copiée${rows.length>1?'s':''}`);
    closeDupPersoWeekModal();
    const now=new Date();const nowDay=now.getDay();const nowMon=new Date(now);nowMon.setDate(now.getDate()-(nowDay===0?6:nowDay-1));nowMon.setHours(0,0,0,0);tgtMon.setHours(0,0,0,0);
    persoOffset=Math.round((tgtMon-nowMon)/(7*24*60*60*1000));
    renderPersoCalendar();
  }finally{if(btn){btn.disabled=false;btn.textContent='📋 Dupliquer la semaine';}}
}

// --- MODE FORMULAIRE PERSO ---
function enterPersoFormMode(athleteId){
  personalAthleteId=athleteId;
  const ath=persoAthletesCache.find(a=>a.id===athleteId)||currentPersoAthlete;
  document.getElementById('form-perso-banner').style.display='flex';
  document.getElementById('form-prog-group').style.display='none';
  if(ath){const init=(ath.full_name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);document.getElementById('form-perso-avatar').textContent=init;document.getElementById('form-perso-name').textContent=ath.full_name||'—';}
}
function exitPersoForm(){
  personalAthleteId=null;personalEditingId=null;
  document.getElementById('form-perso-banner').style.display='none';
  document.getElementById('form-prog-group').style.display='';
  const form=document.getElementById('admin-new-session');
  const sessionsPanel=document.getElementById('admin-sessions');
  if(sessionsPanel&&sessionsPanel.parentElement&&form.parentElement!==sessionsPanel.parentElement)sessionsPanel.parentElement.insertBefore(form,sessionsPanel);
  form.classList.remove('active');
  resetSessionForm();
  if(currentPersoAthlete&&document.getElementById('perso-form-view').style.display!=='none'){document.getElementById('perso-form-view').style.display='none';document.getElementById('perso-fiche-view').style.display='';renderPersoCalendar();}
}
function resetSessionForm(){
  ['f-title','f-target','f-tips','f-scaling-inter','f-scaling-scaled','f-scaling-foundation','f-sets'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  setFormVideos([]);clearEditor();
  document.getElementById('score-labels-container').innerHTML='';
  document.getElementById('f-intensity').value=7;document.getElementById('f-int-val').textContent='7';
  document.getElementById('f-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('f-score-type').value='time';
  document.getElementById('f-type').value='wod';
  document.getElementById('sets-field').style.display='none';
  multiScoreEnabled=false;
  document.getElementById('multi-score-toggle').classList.remove('on');
  document.getElementById('multi-score-fields').style.display='none';
  selectedSessionColor='#e8ff47';
  document.querySelectorAll('#f-colors .color-swatch').forEach(s=>s.classList.toggle('selected',s.dataset.color==='#e8ff47'));
  const btn=document.querySelector('#admin-new-session .btn-primary');
  if(btn){btn.textContent='Publier la séance';btn.style.background='';}
  const cancelBtn=document.getElementById('edit-cancel-btn');
  if(cancelBtn)cancelBtn.remove();
  editingSessionId=null;
}

// --- ESPACE PERSO côté ATHLÈTE (onglet planning) ---
const PERSO_PROG={id:'__perso__',name:'Espace perso',color:'#e8ff47',icon:'👤',slug:'__perso__'};

const __origRenderProgTabs=renderProgTabs;
renderProgTabs=function(){
  __origRenderProgTabs();
  const tabs=document.getElementById('prog-tabs');
  if(!tabs)return;
  if(tabs.querySelector('[data-id="__perso__"]'))return;
  const btn=document.createElement('button');
  btn.className='prog-tab';btn.dataset.id='__perso__';btn.textContent='👤 Espace perso';
  btn.onclick=()=>selectProg('__perso__');
  tabs.insertBefore(btn,tabs.firstChild);
};

const __origSelectProg=selectProg;
selectProg=function(id){
  if(id==='__perso__'){currentProg=PERSO_PROG;activatePersoTab();renderPersoDayStrip();renderPersoSessions();return;}
  __origSelectProg(id);
};

function activatePersoTab(){
  document.querySelectorAll('.prog-tab').forEach(t=>{if(t.dataset.id==='__perso__'){t.style.borderColor=PERSO_PROG.color;t.style.color=PERSO_PROG.color;t.style.background=PERSO_PROG.color+'18';}else{t.style.cssText='';}});
  document.getElementById('prog-topbar-title').textContent='ESPACE PERSO';
}

async function renderPersoDayStrip(){
  const dates=getWeekDates(currentWeekOffset);
  const wk=getWeekNum(dates[0]);
  document.getElementById('week-label').textContent=`Sem. ${wk} — ${MONTHS[dates[0].getMonth()]}`;
  const isos=dates.map(d=>d.toISOString().split('T')[0]);
  const {data}=await sb.from('personal_sessions').select('date').eq('athlete_id',currentUser.id).in('date',isos);
  const withContent=new Set((data||[]).map(s=>s.date));
  document.getElementById('day-strip').innerHTML=dates.map(d=>{const iso=d.toISOString().split('T')[0];return`<div class="day-pill ${iso===selectedDate?'active':''} ${withContent.has(iso)?'has-content':''}" onclick="selectDate('${iso}')"><div class="day-name">${DAYS[d.getDay()]}</div><div class="day-num">${d.getDate()}</div></div>`;}).join('');
}

async function renderPersoSessions(){
  const area=document.getElementById('sessions-area');
  area.innerHTML='<div class="spinner"></div>';
  const {data:sessions}=await sb.from('personal_sessions').select('*').eq('athlete_id',currentUser.id).eq('date',selectedDate).order('sort_order',{ascending:true,nullsFirst:false}).order('created_at');
  if(!sessions||sessions.length===0){area.innerHTML=`<div class="empty fade-up"><div class="empty-icon">👤</div><p>Pas de séance perso<br>programmée ce jour.</p><div style="font-size:11px;color:var(--muted);margin-top:8px">Ton coach peut t'en ajouter depuis son espace admin.</div></div>`;return;}
  area.innerHTML='';
  for(const s of sessions){if(s.type==='separator'){area.insertAdjacentHTML('beforeend',buildSeparatorCard(s));}else{area.insertAdjacentHTML('beforeend',await buildSessionCard(s));}}
}

const __origRenderDayStrip=renderDayStrip;
renderDayStrip=async function(){if(currentProg?.id==='__perso__')return renderPersoDayStrip();return __origRenderDayStrip();};
const __origRenderSessions=renderSessions;
renderSessions=async function(){if(currentProg?.id==='__perso__')return renderPersoSessions();return __origRenderSessions();};
