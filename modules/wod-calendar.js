// ===================================================
// CALENDRIER WOD — onglet profil athlète
// Dépend de : utils.js, core.js (sb, currentUser, myAccessIds)
// ===================================================

const WC_MONTHS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const WC_DAYS=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
let wodCalState={y:new Date().getFullYear(),m:new Date().getMonth(),selectedKey:null,data:null};
let wodCalSearchTimer=null;
let wodCalSearchToken=0;

function wcIso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function wcEsc(s){return (s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function openWodCalendar(){
  if(!currentUser){showToast('Connecte-toi pour voir ton calendrier');return;}
  const now=new Date();
  wodCalState={y:now.getFullYear(),m:now.getMonth(),selectedKey:wcIso(now),data:null};
  const inp=document.getElementById('wod-cal-search-input');if(inp)inp.value='';
  const cb=document.getElementById('wod-cal-search-clear');if(cb)cb.style.display='none';
  const cal=document.getElementById('wod-cal-cal-area');if(cal)cal.style.display='';
  const res=document.getElementById('wod-cal-search-results');if(res){res.style.display='none';res.innerHTML='';}
  document.getElementById('wod-cal-modal').classList.add('open');
  await renderWodCalendar();
}
function closeWodCalendar(){document.getElementById('wod-cal-modal').classList.remove('open');}
function wodCalPrev(){if(wodCalState.m===0){wodCalState.m=11;wodCalState.y--;}else wodCalState.m--;renderWodCalendar();}
function wodCalNext(){if(wodCalState.m===11){wodCalState.m=0;wodCalState.y++;}else wodCalState.m++;renderWodCalendar();}

async function loadWodCalData(){
  const {y,m}=wodCalState;
  const firstIso=`${y}-${String(m+1).padStart(2,'0')}-01`;
  const lastDay=new Date(y,m+1,0).getDate();
  const lastIso=`${y}-${String(m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  let scoresRes=await sb.from('wod_scores').select('id,score_value,score_text,score_type,level,created_at,done_at,session_id').eq('athlete_id',currentUser.id);
  if(scoresRes.error&&/done_at/.test(scoresRes.error.message||''))scoresRes=await sb.from('wod_scores').select('id,score_value,score_text,score_type,level,created_at,session_id').eq('athlete_id',currentUser.id);
  const scoresList=scoresRes.data||[];
  if(scoresRes.error)console.warn('wod_scores fetch',scoresRes.error);
  const sessIdsAll=Array.from(new Set(scoresList.map(s=>s.session_id).filter(Boolean)));
  const sessById={};
  if(sessIdsAll.length){const sRes=await sb.from('sessions').select('id,date,title,type,color,programme_id').in('id',sessIdsAll);for(const s of (sRes.data||[]))sessById[s.id]=s;}
  const progIdsFromScores=Array.from(new Set(Object.values(sessById).map(s=>s.programme_id).filter(Boolean)));
  const progById={};
  if(progIdsFromScores.length){const pRes=await sb.from('programmes').select('id,name,icon,color').in('id',progIdsFromScores);for(const p of (pRes.data||[]))progById[p.id]=p;}
  for(const s of scoresList){const sess=sessById[s.session_id];if(sess){s.sessions={...sess,programmes:progById[sess.programme_id]||null};}else{s.sessions=null;}}
  const doneByDate={};const doneSessionIds=new Set();
  for(const s of scoresList){
    const doneIso=s.done_at?s.done_at:(s.sessions?.date||(s.created_at?wcIso(new Date(s.created_at)):null));
    if(!doneIso)continue;
    s._doneIso=doneIso;s._plannedIso=s.sessions?.date||null;
    if(s.session_id)doneSessionIds.add(s.session_id);
    if(doneIso<firstIso||doneIso>lastIso)continue;
    (doneByDate[doneIso]=doneByDate[doneIso]||[]).push(s);
  }
  const progIds=Array.from(myAccessIds||new Set());
  const progByDate={};
  if(progIds.length){
    const sRes=await sb.from('sessions').select('id,date,title,type,color,programme_id').in('programme_id',progIds).gte('date',firstIso).lte('date',lastIso);
    const sessionsList=sRes.data||[];
    const needProgIds=Array.from(new Set(sessionsList.map(s=>s.programme_id).filter(pid=>pid&&!progById[pid])));
    if(needProgIds.length){const pRes=await sb.from('programmes').select('id,name,icon,color').in('id',needProgIds);for(const p of (pRes.data||[]))progById[p.id]=p;}
    for(const s of sessionsList){if(!s.date||s.type==='separator')continue;s.programmes=progById[s.programme_id]||null;s._wasDone=doneSessionIds.has(s.id);(progByDate[s.date]=progByDate[s.date]||[]).push(s);}
  }
  const pRes=await sb.from('personal_sessions').select('id,date,title,type,color,content,score_type').eq('athlete_id',currentUser.id).gte('date',firstIso).lte('date',lastIso);
  const persoByDate={};
  for(const p of (pRes.data||[]))(persoByDate[p.date]=persoByDate[p.date]||[]).push(p);
  return {doneByDate,progByDate,persoByDate,doneSessionIds};
}

async function renderWodCalendar(){
  const grid=document.getElementById('wod-cal-grid');
  const label=document.getElementById('wod-cal-month-label');
  if(!grid||!label)return;
  const {y,m}=wodCalState;
  label.textContent=`${WC_MONTHS[m]} ${y}`;
  grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:30px 0;color:var(--muted)">Chargement…</div>';
  let data;
  try{data=await loadWodCalData();}catch(e){console.error('wod cal load',e);grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:30px 0;color:var(--red);font-size:12px">Erreur de chargement</div>';return;}
  wodCalState.data=data;
  const daysInMonth=new Date(y,m+1,0).getDate();
  const firstDow=new Date(y,m,1).getDay();
  const startOffset=(firstDow+6)%7;
  const cells=Math.ceil((startOffset+daysInMonth)/7)*7;
  const todayIso=wcIso(new Date());
  let doneCount=0,manualCount=0,skipCount=0;
  for(const k in data.doneByDate)doneCount+=data.doneByDate[k].length;
  for(const k in data.persoByDate)manualCount+=data.persoByDate[k].length;
  for(const k in data.progByDate){if(k>todayIso)continue;for(const s of data.progByDate[k])if(!s._wasDone)skipCount++;}
  document.getElementById('wod-cal-done').textContent=doneCount;
  document.getElementById('wod-cal-manual').textContent=manualCount;
  document.getElementById('wod-cal-skip').textContent=skipCount;
  let html='';
  for(let i=0;i<cells;i++){
    const dayNum=i-startOffset+1;
    if(dayNum<1||dayNum>daysInMonth){html+='<div class="wod-cal-cell empty"></div>';continue;}
    const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
    const isToday=iso===todayIso,isFuture=iso>todayIso;
    const done=data.doneByDate[iso]||[],progAll=data.progByDate[iso]||[];
    const progUnfinished=progAll.filter(s=>!s._wasDone);
    const perso=data.persoByDate[iso]||[];
    let cls='wod-cal-cell',dot='';
    if(done.length){cls+=' done';dot='<span class="wcd done"></span>';}
    else if(perso.length){cls+=' manual';dot='<span class="wcd manual"></span>';}
    else if(progUnfinished.length&&!isFuture&&!isToday){cls+=' skipped';dot='<span class="wcd skip">✕</span>';}
    else if(progAll.length){cls+=' prog';dot='<span class="wcd prog"></span>';}
    if(isToday)cls+=' today';if(iso===wodCalState.selectedKey)cls+=' selected';
    html+=`<div class="${cls}" onclick="selectWodCalDay('${iso}')"><div class="wcn">${dayNum}</div><div class="wcdot">${dot}</div></div>`;
  }
  grid.innerHTML=html;
  renderWodCalDetail();
}

function selectWodCalDay(iso){
  wodCalState.selectedKey=iso;
  document.querySelectorAll('#wod-cal-grid .wod-cal-cell').forEach(el=>el.classList.remove('selected'));
  document.querySelectorAll('#wod-cal-grid .wod-cal-cell').forEach(c=>{if((c.getAttribute('onclick')||'').indexOf(`'${iso}'`)!==-1)c.classList.add('selected');});
  renderWodCalDetail();
}

function renderWodCalDetail(){
  const wrap=document.getElementById('wod-cal-detail');
  if(!wrap||!wodCalState.data)return;
  const iso=wodCalState.selectedKey;if(!iso){wrap.innerHTML='';return;}
  const data=wodCalState.data;
  const done=data.doneByDate[iso]||[],progAll=data.progByDate[iso]||[];
  const progUnfinished=progAll.filter(s=>!s._wasDone);
  const progDoneElsewhere=progAll.filter(s=>s._wasDone&&!done.some(d=>d.session_id===s.id));
  const perso=data.persoByDate[iso]||[];
  const todayIso=wcIso(new Date());const isFuture=iso>todayIso,isToday=iso===todayIso;
  const [Y,M,D]=iso.split('-').map(Number);
  const dt=new Date(Y,M-1,D);
  const dayLabel=`${isToday?"Aujourd'hui · ":''}${WC_DAYS[dt.getDay()]} ${D} ${WC_MONTHS[M-1]}`;
  let html=`<div class="wod-cal-day-label">${dayLabel}</div>`;
  for(const s of done){
    const sess=s.sessions||{},prog=sess.programmes||{};
    const color=sess.color||prog.color||'var(--accent)';const score=s.score_text||s.score_value||'';
    let extraMeta='';if(s._plannedIso&&s._plannedIso!==iso){const[py,pm,pd]=s._plannedIso.split('-').map(Number);const pdt=new Date(py,pm-1,pd);extraMeta=` · <span style="color:var(--muted);font-size:11px">prévu ${WC_DAYS[pdt.getDay()].toLowerCase()} ${pd} ${WC_MONTHS[pm-1].slice(0,3)}</span>`;}
    html+=`<div class="wod-cal-session" onclick="openReadSession('${sess.id}','session')"><div class="wcs-icon" style="background:${color}22;color:${color}">${wcEsc(prog.icon||'✓')}</div><div class="wcs-body"><div class="wcs-title">${wcEsc(sess.title||'Séance')}</div><div class="wcs-meta">${wcEsc(prog.name||(sess.type||'').toUpperCase())} · <span style="color:var(--accent)">FAIT</span>${extraMeta}</div></div>${score?`<div class="wcs-score">${wcEsc(score)}</div>`:''}</div>`;
  }
  for(const p of perso){html+=`<div class="wod-cal-session" onclick="openReadSession('${p.id}','personal')"><div class="wcs-icon" style="background:rgba(71,255,140,.16);color:var(--green)">●</div><div class="wcs-body"><div class="wcs-title">${wcEsc(p.title||'Séance perso')}</div><div class="wcs-meta">${wcEsc((p.type||'wod').toUpperCase())} · <span style="color:var(--green)">MANUEL</span></div></div><button class="wcs-del" onclick="event.stopPropagation();deleteWodCalManual('${p.id}')" title="Supprimer">✕</button></div>`;}
  for(const s of progDoneElsewhere){const pInfo=s.programmes||{};html+=`<div class="wod-cal-session" onclick="openReadSession('${s.id}','session')" style="opacity:.7"><div class="wcs-icon" style="background:rgba(71,200,255,.14);color:#47c8ff">↪</div><div class="wcs-body"><div class="wcs-title">${wcEsc(s.title||'Séance')}</div><div class="wcs-meta">${wcEsc(pInfo.name||'Programme')} · <span style="color:#47c8ff">FAITE UN AUTRE JOUR</span></div></div></div>`;}
  if(!isFuture){for(const s of progUnfinished){const pInfo=s.programmes||{};html+=`<div class="wod-cal-session skipped" onclick="openReadSession('${s.id}','session')"><div class="wcs-icon" style="background:rgba(255,68,68,.12);color:var(--red)">✕</div><div class="wcs-body"><div class="wcs-title">${wcEsc(s.title||'Séance')}</div><div class="wcs-meta">${wcEsc(pInfo.name||'Programme')} · <span style="color:var(--red)">NON FAIT</span></div></div></div>`;}}
  if(isFuture&&progAll.length){for(const s of progAll){const pInfo=s.programmes||{};html+=`<div class="wod-cal-session upcoming" onclick="openReadSession('${s.id}','session')"><div class="wcs-icon" style="background:var(--card2);color:var(--muted)">○</div><div class="wcs-body"><div class="wcs-title">${wcEsc(s.title||'Séance')}</div><div class="wcs-meta">${wcEsc(pInfo.name||'Programme')} · <span style="color:var(--muted)">À VENIR</span></div></div></div>`;}}
  if(!done.length&&!perso.length&&!progAll.length)html+=`<div class="wod-cal-empty">Rien ce jour-là.</div>`;
  wrap.innerHTML=html;
}

async function deleteWodCalManual(id){
  if(!confirm('Supprimer cette séance ?'))return;
  const {error}=await sb.from('personal_sessions').delete().eq('id',id);
  if(error){showToast('❌ '+error.message);return;}
  showToast('🗑 Supprimé');
  await renderWodCalendar();
}

// --- Recherche ---
function onWodCalSearchInput(){
  const q=(document.getElementById('wod-cal-search-input')?.value||'').trim();
  document.getElementById('wod-cal-search-clear').style.display=q?'':'none';
  clearTimeout(wodCalSearchTimer);
  const out=document.getElementById('wod-cal-search-results');
  if(q.length<2){document.getElementById('wod-cal-cal-area').style.display='';out.style.display='none';out.innerHTML='';if(q.length>0){out.style.display='block';out.innerHTML=`<div class="wod-cal-search-empty">Tape <strong>2 caractères</strong> minimum<br/><span style="font-size:11px;opacity:.7">ex: muscle up, snatch, Fran, 5km…</span></div>`;}return;}
  wodCalSearchTimer=setTimeout(()=>runWodCalSearch(q),220);
}
function clearWodCalSearch(){const input=document.getElementById('wod-cal-search-input');if(input)input.value='';document.getElementById('wod-cal-search-clear').style.display='none';document.getElementById('wod-cal-cal-area').style.display='';document.getElementById('wod-cal-search-results').style.display='none';}
function wcHighlight(text,terms){if(!text)return '';let safe=wcEsc(text);for(const t of terms){if(!t)continue;const re=new RegExp('('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig');safe=safe.replace(re,'<mark>$1</mark>');}return safe;}
function wcSnippet(content,terms,maxLen=160){if(!content)return '';const lower=content.toLowerCase();let pos=-1;for(const t of terms){if(!t)continue;const p=lower.indexOf(t.toLowerCase());if(p!==-1&&(pos===-1||p<pos))pos=p;}if(pos===-1)return wcHighlight(content.length>maxLen?content.slice(0,maxLen)+'…':content,terms);const start=Math.max(0,pos-50),end=Math.min(content.length,pos+110);let snip=(start>0?'…':'')+content.slice(start,end)+(end<content.length?'…':'');return wcHighlight(snip,terms);}
function wcFormatShortDate(iso){if(!iso)return '';const [Y,M,D]=iso.split('-').map(Number);const dt=new Date(Y,M-1,D);return `${String(D).padStart(2,'0')} ${WC_MONTHS[M-1].slice(0,3)}.<br>${Y}`;}

async function runWodCalSearch(query){
  if(!currentUser)return;
  const out=document.getElementById('wod-cal-search-results');
  document.getElementById('wod-cal-cal-area').style.display='none';
  out.style.display='block';out.innerHTML='<div style="text-align:center;padding:30px;color:var(--muted);font-size:12px">Recherche…</div>';
  const q=(query||'').trim();if(!q){clearWodCalSearch();return;}
  const token=++wodCalSearchToken;
  const terms=q.split(/\s+/).filter(Boolean);
  const like=`%${q.replace(/[%_]/g,'\\$&')}%`;
  try{
    const scoresRes=await sb.from('wod_scores').select('id,session_id,score_value,score_text,created_at').eq('athlete_id',currentUser.id);
    if(token!==wodCalSearchToken)return;
    const scores=scoresRes.data||[];
    const sessionIds=Array.from(new Set(scores.map(s=>s.session_id).filter(Boolean)));
    let sessions=[];
    if(sessionIds.length){const sRes=await sb.from('sessions').select('id,date,title,content,type,color,programme_id,programmes(name,icon,color)').in('id',sessionIds).or(`title.ilike.${like},content.ilike.${like}`);sessions=sRes.data||[];}
    if(token!==wodCalSearchToken)return;
    const sessionById={};sessions.forEach(s=>sessionById[s.id]=s);
    const doneHits=scores.filter(sc=>sessionById[sc.session_id]).map(sc=>{const sess=sessionById[sc.session_id];return{kind:'done',date:sess.date,session:sess,score:sc,scoreId:sc.id};});
    const persoRes=await sb.from('personal_sessions').select('id,date,title,content,type,color').eq('athlete_id',currentUser.id).or(`title.ilike.${like},content.ilike.${like}`);
    if(token!==wodCalSearchToken)return;
    const persoHits=(persoRes.data||[]).map(p=>({kind:'perso',date:p.date,perso:p}));
    const all=[...doneHits,...persoHits].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    if(!all.length){out.innerHTML=`<div class="wod-cal-search-empty">Aucun résultat pour <strong>« ${wcEsc(q)} »</strong><br/><span style="font-size:11px;opacity:.7">Essaie un autre mot-clé, ou vérifie l'orthographe.</span></div>`;return;}
    const byYear={};for(const h of all){const y=(h.date||'').slice(0,4)||'—';(byYear[y]=byYear[y]||[]).push(h);}
    const years=Object.keys(byYear).sort((a,b)=>b.localeCompare(a));
    let html=`<div class="wcsi-header">${all.length} résultat${all.length>1?'s':''} pour « ${wcEsc(q)} »</div>`;
    for(const y of years){
      if(years.length>1)html+=`<div class="wcsi-header" style="padding-top:14px">${y}</div>`;
      for(const h of byYear[y]){
        if(h.kind==='done'){const s=h.session,p=s.programmes||{};const score=h.score.score_text||h.score.score_value||'';const color=s.color||p.color||'#e8ff47';html+=`<div class="wod-cal-search-item" onclick="openReadSession('${s.id}','session')"><div class="wcsi-date">${wcFormatShortDate(h.date)}</div><div class="wcsi-body"><div class="wcsi-title">${wcHighlight(s.title||'Séance',terms)}</div><div class="wcsi-meta">${wcEsc(p.icon||'')} ${wcEsc(p.name||(s.type||'').toUpperCase())} · <span style="color:var(--accent)">FAIT</span></div>${s.content?`<div class="wcsi-snippet">${wcSnippet(s.content,terms)}</div>`:''}</div>${score?`<div class="wcsi-score">${wcEsc(score)}</div>`:''}</div>`;}
        else{const p=h.perso;html+=`<div class="wod-cal-search-item" onclick="openReadSession('${p.id}','personal')"><div class="wcsi-date">${wcFormatShortDate(h.date)}</div><div class="wcsi-body"><div class="wcsi-title">${wcHighlight(p.title||'Séance perso',terms)}</div><div class="wcsi-meta">${wcEsc((p.type||'wod').toUpperCase())} · <span style="color:var(--green)">MANUEL</span></div>${p.content?`<div class="wcsi-snippet">${wcSnippet(p.content,terms)}</div>`:''}</div></div>`;}
      }
    }
    out.innerHTML=html;
  }catch(e){console.error('wod cal search',e);out.innerHTML=`<div class="wod-cal-search-empty" style="color:var(--red)">Erreur : ${wcEsc(e.message||'recherche impossible')}</div>`;}
}
