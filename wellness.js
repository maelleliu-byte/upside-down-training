// UTILS
function getScorePlaceholder(type){return{time:'14:32',reps:'87',rounds:'12 + 5',weight:'85',calories:'42'}[type]||'—';}
function extractYTId(url){const m=url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);return m?m[1]:null;}
function formatDate(iso){if(!iso)return'—';const d=new Date(iso+'T12:00:00');return`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}

// ===================================================
// HELPERS — escape / strip
// ===================================================
function escapeHtml(s){if(s==null)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function stripHtml(s){if(!s)return'';const d=document.createElement('div');d.innerHTML=s;return(d.textContent||d.innerText||'').replace(/\s+/g,' ').trim();}

// ===================================================
// MODAL LECTURE SÉANCE — vue identique à l'athlète
// ===================================================
let readModalSession=null;
let readModalIsPerso=false;
async function openReadSession(id, source){
  // source: 'session' (table sessions) ou 'personal' (personal_sessions)
  let data;
  if(source==='personal'){
    const r=await sb.from('personal_sessions').select('*').eq('id',id).single();
    data=r.data;
  } else {
    const r=await sb.from('sessions').select('*,programmes(name,icon,color)').eq('id',id).single();
    data=r.data;
  }
  if(!data){showToast('❌ Séance introuvable');return;}
  readModalSession=data;
  readModalIsPerso=(source==='personal');
  // En-tête
  if(readModalIsPerso){
    const ath=currentPersoAthlete||persoAthletesCache.find(a=>a.id===data.athlete_id);
    document.getElementById('read-modal-prog').textContent='👤 '+(ath?.full_name||'Athlète');
  } else {
    const p=data.programmes;
    document.getElementById('read-modal-prog').textContent=p?`${p.icon||''} ${p.name}`:'Programme';
  }
  document.getElementById('read-modal-date').textContent=formatDate(data.date);
  // Corps : on réutilise buildSessionCard pour rendu identique athlète
  const body=document.getElementById('read-modal-body');
  body.innerHTML='<div class="spinner"></div>';
  if(data.type==='separator'){
    body.innerHTML=buildSeparatorCard(data);
  } else {
    body.innerHTML=await buildSessionCard(data);
  }
  // Bouton "Éditer" : visible uniquement si admin (toutes séances)
  // OU athlète propriétaire d'une séance perso (manuelle/coach-poussée)
  const editBtn=document.getElementById('read-modal-edit-btn');
  if(editBtn){
    const isAdmin=currentProfile?.role==='admin';
    const isOwnPerso=readModalIsPerso && currentUser && data.athlete_id===currentUser.id;
    editBtn.style.display=(isAdmin||isOwnPerso)?'':'none';
  }
  document.getElementById('read-modal').classList.add('open');
}
function closeReadModal(){
  document.getElementById('read-modal').classList.remove('open');
  readModalSession=null;
}
function readModalEdit(){
  if(!readModalSession)return;
  const s=readModalSession;
  const isPerso=readModalIsPerso;
  closeReadModal();
  if(isPerso){
    persoEditSession(s.id, s.athlete_id);
  } else {
    editSession(s.id);
  }
}

// ===================================================
// ESPACE PERSO — STATE
// ===================================================
let persoAthletesCache=[];
let currentPersoAthlete=null;
let persoView='week';        // 'week' | 'month'
let persoOffset=0;            // semaines ou mois selon view
let persoSessionsCache=[];
let personalAthleteId=null;   // si non-null → form en mode perso
let personalEditingId=null;
let personalSessionCounts={}; // map athlete_id → count

async function loadPersoAthletes(){
  // Reset à la vue liste
  document.getElementById('perso-list-view').style.display='';
  document.getElementById('perso-fiche-view').style.display='none';
  document.getElementById('perso-form-view').style.display='none';

  const {data}=await sb.from('profiles').select('*').order('full_name');
  persoAthletesCache=data||[];
  // Compter les séances perso par athlète
  const {data:counts}=await sb.from('personal_sessions').select('athlete_id');
  personalSessionCounts={};
  (counts||[]).forEach(r=>{personalSessionCounts[r.athlete_id]=(personalSessionCounts[r.athlete_id]||0)+1;});
  renderPersoAthletes();
}
function filterPersoAthletes(){renderPersoAthletes();}
function renderPersoAthletes(){
  const q=(document.getElementById('perso-search')?.value||'').toLowerCase();
  const list=persoAthletesCache.filter(a=>!q||(a.full_name||'').toLowerCase().includes(q)||(a.email||'').toLowerCase().includes(q));
  const el=document.getElementById('perso-athletes-list');
  if(!list.length){el.innerHTML='<div class="empty"><p>Aucun athlète.</p></div>';return;}
  el.innerHTML=list.map(a=>{
    const init=(a.full_name||a.email||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const cnt=personalSessionCounts[a.id]||0;
    return`<div class="perso-athlete-card" onclick="openPersoFiche('${a.id}')">
      <div class="athlete-avatar">${init}</div>
      <div class="perso-meta">
        <div class="perso-name">${escapeHtml(a.full_name||'—')}</div>
        <div class="perso-sub">${escapeHtml(a.email||'')}</div>
      </div>
      <div style="text-align:right">
        <div class="perso-count">${cnt}</div>
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">séance${cnt>1?'s':''}</div>
      </div>
      <div class="chev">›</div>
    </div>`;
  }).join('');
}

async function openPersoFiche(athleteId, targetDate){
  currentPersoAthlete=persoAthletesCache.find(a=>a.id===athleteId);
  if(!currentPersoAthlete){
    // Au cas où on arrive directement (post-save), reload
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
  if(targetDate){
    const now=new Date(); const day=now.getDay();
    const monNow=new Date(now); monNow.setDate(now.getDate()-(day===0?6:day-1)); monNow.setHours(0,0,0,0);
    const tgt=new Date(targetDate+'T12:00:00'); const tgtDay=tgt.getDay();
    const monTgt=new Date(tgt); monTgt.setDate(tgt.getDate()-(tgtDay===0?6:tgtDay-1)); monTgt.setHours(0,0,0,0);
    persoOffset=Math.round((monTgt-monNow)/(7*24*60*60*1000));
  } else {
    persoOffset=0;
  }
  document.getElementById('perso-view-week').classList.add('active');
  document.getElementById('perso-view-month').classList.remove('active');
  await renderPersoCalendar();
}
function persoBackToList(){loadPersoAthletes();}
function persoBackToFiche(){
  // On ne nettoie pas le form ici (savéSession l'aura fait), juste on switche
  if(currentPersoAthlete){
    document.getElementById('perso-list-view').style.display='none';
    document.getElementById('perso-fiche-view').style.display='';
    document.getElementById('perso-form-view').style.display='none';
    // Quitter le mode perso si on n'a pas sauvegardé
    if(personalAthleteId){
      exitPersoForm();
    }
    renderPersoCalendar();
  } else {
    loadPersoAthletes();
  }
}
function persoSetView(v){
  persoView=v;
  persoOffset=0;
  document.getElementById('perso-view-week').classList.toggle('active',v==='week');
  document.getElementById('perso-view-month').classList.toggle('active',v==='month');
  renderPersoCalendar();
}
function persoNav(dir){persoOffset+=dir;renderPersoCalendar();}

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
    const today=new Date().toISOString().split('T')[0];
    const headers=dates.map(d=>`<div class="cal-day-header">${DAYS[d.getDay()]}</div>`).join('');
    const dateRow=dates.map(d=>{
      const iso=d.toISOString().split('T')[0];
      return`<div class="cal-day-date ${iso===today?'today':''}">${d.getDate()}</div>`;
    }).join('');
    const sessionCols=dates.map(d=>{
      const iso=d.toISOString().split('T')[0];
      const sessions=byDate[iso]||[];
      const blocks=sessions.length>0?sessions.map(s=>{
        if(s.type==='separator'){
          return`<div class="cal-rich separator" draggable="true" data-sid="${s.id}" data-date="${iso}" ondragstart="persoDragStart(event,'${s.id}','${iso}')" ondragend="persoDragEnd(event)" ondragover="persoDragOver(event)" ondrop="persoDrop(event,'${iso}','${s.id}')" onclick="openReadSession('${s.id}','personal')" style="position:relative;cursor:grab">
            <div class="cal-rich-actions" style="display:flex;position:absolute;top:2px;right:2px">
              <button class="cal-action-btn" onclick="event.stopPropagation();persoEditSession('${s.id}','${currentPersoAthlete.id}')">✏</button>
              <button class="cal-action-btn" onclick="event.stopPropagation();persoDeleteSession('${s.id}')">✕</button>
            </div>
            <div class="cal-rich-title">— ${escapeHtml(s.title||'Séparateur')} —</div>
          </div>`;
        }
        const color=s.color||'#e8ff47';
        const typeLabel=TYPE_LABELS[s.type]||s.type;
        const preview=stripHtml(renderContentWithCharges(s.content||'')).slice(0,160);
        const intensity=s.intensity?`<span>I${s.intensity}/10</span><span class="dot"></span>`:'';
        const sets=s.sets?`<span>${s.sets} séries</span><span class="dot"></span>`:'';
        const yt=s.youtube_url?`<span>▶ vidéo</span>`:'';
        return`<div class="cal-rich" draggable="true" data-sid="${s.id}" data-date="${iso}" ondragstart="persoDragStart(event,'${s.id}','${iso}')" ondragend="persoDragEnd(event)" ondragover="persoDragOver(event)" ondrop="persoDrop(event,'${iso}','${s.id}')" onclick="openReadSession('${s.id}','personal')" style="cursor:grab">
          <div class="cal-accent" style="background:${color}"></div>
          <div class="cal-rich-head">
            <span class="cal-rich-type" style="background:${color}22;color:${color}">${typeLabel}</span>
            <div class="cal-rich-actions">
              <button class="cal-action-btn" onclick="event.stopPropagation();persoEditSession('${s.id}','${currentPersoAthlete.id}')" title="Modifier">✏</button>
              <button class="cal-action-btn" onclick="event.stopPropagation();persoDuplicateSession('${s.id}')" title="Dupliquer">📋</button>
              <button class="cal-action-btn" onclick="event.stopPropagation();persoDeleteSession('${s.id}')" title="Supprimer">✕</button>
            </div>
          </div>
          <div class="cal-rich-title">${escapeHtml(s.title||'')}</div>
          ${preview?`<div class="cal-rich-content">${escapeHtml(preview)}</div>`:''}
          <div class="cal-rich-meta">${intensity}${sets}${yt}</div>
          <div class="cal-rich-nav">
            <button class="cal-action-btn" onclick="event.stopPropagation();persoMoveToDay('${s.id}',-1)" title="Jour précédent">‹</button>
            <button class="cal-action-btn" onclick="event.stopPropagation();persoMoveSession('${s.id}',-1)" title="Monter">↑</button>
            <button class="cal-action-btn" onclick="event.stopPropagation();persoMoveSession('${s.id}',1)" title="Descendre">↓</button>
            <button class="cal-action-btn" onclick="event.stopPropagation();persoMoveToDay('${s.id}',1)" title="Jour suivant">›</button>
          </div>
        </div>`;
      }).join(''):`<div class="cal-empty-day" ondragover="persoDragOver(event)" ondrop="persoDrop(event,'${iso}',null)" onclick="persoNewSessionOn('${iso}')">+</div>`;
      const addMore=sessions.length>0
        ? `<button class="cal-add-more" onclick="persoNewSessionOn('${iso}')" title="Ajouter une séance perso"><span class="plus">+</span>Séance</button>`
        : '';
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
    const startDay=(first.getDay()===0?6:first.getDay()-1); // lundi=0
    const startDate=new Date(Date.UTC(year,month,1-startDay));
    const cells=[];
    for(let i=0;i<42;i++){
      const d=new Date(startDate);d.setUTCDate(startDate.getUTCDate()+i);
      cells.push(d);
    }
    const isos=cells.map(d=>d.toISOString().split('T')[0]);
    const {data}=await sb.from('personal_sessions').select('*').eq('athlete_id',currentPersoAthlete.id).in('date',isos).order('sort_order',{ascending:true,nullsFirst:false}).order('created_at');
    const byDate={};isos.forEach(iso=>byDate[iso]=[]);
    (data||[]).forEach(s=>{if(byDate[s.date])byDate[s.date].push(s);});
    const tNow=new Date();const today=`${tNow.getFullYear()}-${String(tNow.getMonth()+1).padStart(2,'0')}-${String(tNow.getDate()).padStart(2,'0')}`;
    const headers=['L','M','M','J','V','S','D'].map(h=>`<div class="h">${h}</div>`).join('');
    const cellsHtml=cells.map(d=>{
      const iso=d.toISOString().split('T')[0];
      const isOther=d.getUTCMonth()!==month;
      const isToday=iso===today;
      const sess=byDate[iso]||[];
      const pills=sess.map(s=>{
        const c=s.color||'#e8ff47';
        return`<div class="pill" style="background:${c}22;color:${c}" onclick="event.stopPropagation();openReadSession('${s.id}','personal')">${escapeHtml(s.title||'—').slice(0,18)}</div>`;
      }).join('');
      const more='';
      return`<div class="perso-month-cell ${isOther?'other':''} ${isToday?'today':''}" onclick="persoMonthCellClick('${iso}')">
        <div class="num">${d.getUTCDate()}</div>
        ${pills}${more}
      </div>`;
    }).join('');
    area.innerHTML=`<div class="perso-month"><div class="perso-month-grid">${headers}</div><div class="perso-month-grid" style="margin-top:6px">${cellsHtml}</div></div>`;
  }
  if(persoSessionsCache?.length===0&&persoView==='week'){
    // Pas vide totalement — on a déjà rendu les colonnes
  }
}

let _persoDrag=null;
let _persoTouch=null;
function persoDragStart(ev,sid,fromIso){
  _persoDrag={sid,fromIso};
  ev.dataTransfer.effectAllowed='move';
  try{ev.dataTransfer.setData('text/plain',sid);}catch(e){}
  ev.currentTarget.classList.add('dragging');
}
async function persoMoveSession(sid,direction){
  const sess=persoSessionsCache.find(s=>s.id===sid);if(!sess)return;
  const sameDay=persoSessionsCache.filter(s=>s.date===sess.date).sort((a,b)=>(a.sort_order??999)-(b.sort_order??999));
  const idx=sameDay.findIndex(s=>s.id===sid);
  const ni=idx+direction;if(ni<0||ni>=sameDay.length)return;
  [sameDay[idx],sameDay[ni]]=[sameDay[ni],sameDay[idx]];
  await Promise.all(sameDay.map((s,i)=>sb.from('personal_sessions').update({sort_order:i}).eq('id',s.id)));
  await renderPersoCalendar();
}
async function persoMoveToDay(sid,delta){
  const sess=persoSessionsCache.find(s=>s.id===sid);if(!sess)return;
  const [y,m,da]=sess.date.split('-').map(Number);
  const d=new Date(Date.UTC(y,m-1,da));
  d.setUTCDate(d.getUTCDate()+delta);
  const newIso=d.toISOString().split('T')[0];
  await sb.from('personal_sessions').update({date:newIso,sort_order:9999}).eq('id',sid);
  await renderPersoCalendar();
}
function persoDragEnd(ev){
  ev.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.cal-day-col.drag-over').forEach(el=>el.classList.remove('drag-over'));
}
function persoDragOver(ev){
  if(!_persoDrag)return;
  ev.preventDefault();
  ev.dataTransfer.dropEffect='move';
  const col=ev.currentTarget.closest('.cal-day-col');
  if(col){
    document.querySelectorAll('.cal-day-col.drag-over').forEach(el=>{if(el!==col)el.classList.remove('drag-over');});
    col.classList.add('drag-over');
  }
}
async function persoDrop(ev,toIso,targetSid){
  ev.preventDefault();ev.stopPropagation();
  if(!_persoDrag)return;
  const {sid,fromIso}=_persoDrag;_persoDrag=null;
  document.querySelectorAll('.cal-day-col.drag-over,.cal-rich.dragging').forEach(el=>el.classList.remove('drag-over','dragging'));
  if(sid===targetSid)return;
  const target=persoSessionsCache.filter(s=>s.date===toIso&&s.id!==sid);
  const moved=persoSessionsCache.find(s=>s.id===sid);if(!moved)return;
  let insertAt=target.length;
  if(targetSid){const idx=target.findIndex(s=>s.id===targetSid);if(idx>=0)insertAt=idx;}
  target.splice(insertAt,0,{...moved,date:toIso});
  try{
    await Promise.all(target.map((s,i)=>sb.from('personal_sessions').update({date:toIso,sort_order:i}).eq('id',s.id)));
    if(fromIso!==toIso){
      const src=persoSessionsCache.filter(s=>s.date===fromIso&&s.id!==sid);
      await Promise.all(src.map((s,i)=>sb.from('personal_sessions').update({sort_order:i}).eq('id',s.id)));
    }
  }catch(e){showToast('❌ '+(e.message||'Erreur'));return;}
  if(typeof renderPersoFiche==='function')renderPersoFiche();
}

function persoMonthCellClick(iso){
  // Ouvre directement le formulaire perso avec la date pré-remplie
  persoNewSessionOn(iso);
}

function persoNewSession(){
  persoNewSessionOn(new Date().toISOString().split('T')[0]);
}
function persoNewSessionOn(iso){
  if(!currentPersoAthlete)return;
  enterPersoFormMode(currentPersoAthlete.id);
  // Reset form
  resetSessionForm();
  document.getElementById('f-date').value=iso||new Date().toISOString().split('T')[0];
  // Switch panel
  document.getElementById('perso-list-view').style.display='none';
  document.getElementById('perso-fiche-view').style.display='none';
  document.getElementById('perso-form-view').style.display='';
  document.getElementById('perso-form-title').textContent='Nouvelle séance perso';
  document.getElementById('perso-form-sub').textContent=`Pour ${currentPersoAthlete.full_name||'—'}`;
  // Déplacer le formulaire dans le container perso
  const container=document.getElementById('perso-form-container');
  const form=document.getElementById('admin-new-session');
  container.appendChild(form);
  form.classList.add('active');
  form.style.display='';
  document.getElementById('page-admin').scrollTop=0;
}

async function persoEditSession(id, athleteId){
  // Charger
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
  // Remplir avec les données
  document.getElementById('f-date').value=data.date;
  document.getElementById('f-type').value=data.type;
  document.getElementById('f-title').value=data.title||'';
  setEditorContent(data.content||'');
  document.getElementById('f-intensity').value=data.intensity||7;
  document.getElementById('f-int-val').textContent=data.intensity||7;
  document.getElementById('f-target').value=data.target||'';
  document.getElementById('f-tips').value=data.tips||'';
  document.getElementById('f-score-type').value=data.score_type||'reps';
  // Multi-vidéos
  let _vids=[];
  try{_vids=Array.isArray(data.videos)?data.videos:(typeof data.videos==='string'?JSON.parse(data.videos):[]);}catch(e){_vids=[];}
  if((!_vids||!_vids.length)&&data.youtube_url){_vids=[{url:data.youtube_url,label:data.youtube_label||''}];}
  setFormVideos(_vids);
  document.getElementById('f-scaling-inter').value=data.scaling_inter||'';
  document.getElementById('f-scaling-scaled').value=data.scaling_scaled||'';
  document.getElementById('f-scaling-foundation').value=data.scaling_foundation||'';
  if(data.color){
    selectedSessionColor=data.color;
    document.querySelectorAll('#f-colors .color-swatch').forEach(s=>s.classList.toggle('selected',s.dataset.color===data.color));
  }
  if(data.type==='strength'){
    document.getElementById('sets-field').style.display='block';
    document.getElementById('f-sets').value=data.sets||'';
  }
  // Switch panel
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
  // Bouton sauvegarder en mode édition
  const btn=document.querySelector('#admin-new-session .btn-primary');
  btn.textContent='💾 Sauvegarder les modifications';
  btn.style.background='var(--blue)';
  document.getElementById('page-admin').scrollTop=0;
}

async function persoDeleteSession(id){
  if(!confirm('Supprimer cette séance perso ?'))return;
  // Cascade manuelle (pas de FK car session_id peut référencer sessions OU personal_sessions)
  await sb.from('wod_scores').delete().eq('session_id',id).then(r=>r.error&&console.warn('cascade wod_scores',r.error.message));
  await sb.from('session_notes').delete().eq('session_id',id).then(r=>r.error&&console.warn('cascade session_notes',r.error.message));
  const {error}=await sb.from('personal_sessions').delete().eq('id',id);
  if(error){showToast('❌ '+error.message);return;}
  showToast('🗑 Séance supprimée');
  renderPersoCalendar();
}

async function persoDuplicateSession(id){
  const {data,error:e1}=await sb.from('personal_sessions').select('*').eq('id',id).single();
  if(e1||!data){showToast('❌ Séance introuvable');return;}
  // On retire les champs auto/uniques et on insère une copie sur la même date / même athlète
  const {id:_id,created_at,...rest}=data;
  // Place la copie juste après l'originale dans la journée
  const sameDay=persoSessionsCache.filter(s=>s.date===data.date).sort((a,b)=>(a.sort_order??999)-(b.sort_order??999));
  const idx=sameDay.findIndex(s=>s.id===id);
  const newOrder=idx>=0?(sameDay[idx].sort_order??idx)+1:9999;
  const payload={...rest,sort_order:newOrder,created_by:currentUser.id};
  // Re-décaler les séances suivantes pour laisser la place
  if(idx>=0){
    const toShift=sameDay.slice(idx+1);
    await Promise.all(toShift.map((s,i)=>sb.from('personal_sessions').update({sort_order:newOrder+1+i}).eq('id',s.id)));
  }
  const {error}=await sb.from('personal_sessions').insert(payload);
  if(error){showToast('❌ '+error.message);return;}
  showToast('📋 Séance dupliquée');
  renderPersoCalendar();
}

function enterPersoFormMode(athleteId){
  personalAthleteId=athleteId;
  const ath=persoAthletesCache.find(a=>a.id===athleteId)||currentPersoAthlete;
  document.getElementById('form-perso-banner').style.display='flex';
  document.getElementById('form-prog-group').style.display='none';
  if(ath){
    const init=(ath.full_name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    document.getElementById('form-perso-avatar').textContent=init;
    document.getElementById('form-perso-name').textContent=ath.full_name||'—';
  }
}
function exitPersoForm(){
  personalAthleteId=null;
  personalEditingId=null;
  document.getElementById('form-perso-banner').style.display='none';
  document.getElementById('form-prog-group').style.display='';
  // Réintégrer le form dans son emplacement d'origine
  const form=document.getElementById('admin-new-session');
  const adminContainer=document.querySelector('#page-admin > .admin-tabs')?.parentElement;
  // Remet le form dans le page-admin (juste après les onglets, à sa position originelle)
  // On le réinjecte avant #admin-sessions si présent
  const sessionsPanel=document.getElementById('admin-sessions');
  if(sessionsPanel&&sessionsPanel.parentElement&&form.parentElement!==sessionsPanel.parentElement){
    sessionsPanel.parentElement.insertBefore(form,sessionsPanel);
  }
  form.classList.remove('active');
  resetSessionForm();
  // Si on était dans la vue form perso, retour à la fiche
  if(currentPersoAthlete&&document.getElementById('perso-form-view').style.display!=='none'){
    document.getElementById('perso-form-view').style.display='none';
    document.getElementById('perso-fiche-view').style.display='';
    renderPersoCalendar();
  }
}
function resetSessionForm(){
  ['f-title','f-target','f-tips','f-scaling-inter','f-scaling-scaled','f-scaling-foundation','f-sets'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  setFormVideos([]);
  clearEditor();
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

function quickAddSession(iso,weekNum,dow){
  // Quand on clique sur un jour vide (ou sur "+ Séance" sous des blocs existants) du calendrier admin
  // Mémorise qu'on doit revenir à l'onglet "Séances" après publication
  window._returnToSessionsAfterSave=true;
  adminTab('new-session',document.querySelector('.admin-tab-btn:nth-child(2)'));
  resetSessionForm();
  // Pré-sélectionner le programme du calendrier admin
  const progId=document.getElementById('admin-filter-prog')?.value;
  if(progId){
    const fProg=document.getElementById('f-prog');
    if(fProg)fProg.value=progId;
    onFProgChange();
  }
  if(weekNum!=null){
    const w=document.getElementById('f-week');if(w)w.value=weekNum;
    const d=document.getElementById('f-dow');if(d&&dow!=null)d.value=dow;
  } else {
    document.getElementById('f-date').value=iso;
  }
}

// ===================================================
// HOOK CÔTÉ ATHLÈTE — onglet "Espace perso" virtuel
// ===================================================
// On surcharge renderProgTabs pour ajouter un pseudo-prog,
// et selectProg / renderDayStrip / renderSessions pour le supporter.
const PERSO_PROG={id:'__perso__',name:'Espace perso',color:'#e8ff47',icon:'👤',slug:'__perso__'};

const __origRenderProgTabs=renderProgTabs;
renderProgTabs=function(){
  __origRenderProgTabs();
  // Ajouter l'onglet Espace perso en PREMIER (visible pour tous : athlètes ET admins peuvent voir leur propre espace)
  const tabs=document.getElementById('prog-tabs');
  if(!tabs)return;
  // Ne pas dupliquer
  if(tabs.querySelector('[data-id="__perso__"]'))return;
  const btn=document.createElement('button');
  btn.className='prog-tab';
  btn.dataset.id='__perso__';
  btn.textContent='👤 Espace perso';
  btn.onclick=()=>selectProg('__perso__');
  tabs.insertBefore(btn, tabs.firstChild);
};

const __origSelectProg=selectProg;
selectProg=function(id){
  if(id==='__perso__'){
    currentProg=PERSO_PROG;
    activatePersoTab();
    renderPersoDayStrip();
    renderPersoSessions();
    return;
  }
  __origSelectProg(id);
};

function activatePersoTab(){
  document.querySelectorAll('.prog-tab').forEach(t=>{
    if(t.dataset.id==='__perso__'){
      t.style.borderColor=PERSO_PROG.color;t.style.color=PERSO_PROG.color;t.style.background=PERSO_PROG.color+'18';
    } else {
      t.style.cssText='';
    }
  });
  document.getElementById('prog-topbar-title').textContent='ESPACE PERSO';
}

async function renderPersoDayStrip(){
  const dates=getWeekDates(currentWeekOffset);
  const wk=getWeekNum(dates[0]);
  document.getElementById('week-label').textContent=`Sem. ${wk} — ${MONTHS[dates[0].getMonth()]}`;
  const isos=dates.map(d=>d.toISOString().split('T')[0]);
  const {data}=await sb.from('personal_sessions').select('date').eq('athlete_id',currentUser.id).in('date',isos);
  const withContent=new Set((data||[]).map(s=>s.date));
  document.getElementById('day-strip').innerHTML=dates.map(d=>{
    const iso=d.toISOString().split('T')[0];
    return `<div class="day-pill ${iso===selectedDate?'active':''} ${withContent.has(iso)?'has-content':''}" onclick="selectDate('${iso}')">
      <div class="day-name">${DAYS[d.getDay()]}</div><div class="day-num">${d.getDate()}</div>
    </div>`;
  }).join('');
}

async function renderPersoSessions(){
  const area=document.getElementById('sessions-area');
  area.innerHTML='<div class="spinner"></div>';
  const {data:sessions}=await sb.from('personal_sessions').select('*').eq('athlete_id',currentUser.id).eq('date',selectedDate).order('sort_order',{ascending:true,nullsFirst:false}).order('created_at');
  if(!sessions||sessions.length===0){
    area.innerHTML=`<div class="empty fade-up">
      <div class="empty-icon">👤</div>
      <p>Pas de séance perso<br>programmée ce jour.</p>
      <div style="font-size:11px;color:var(--muted);margin-top:8px">Ton coach peut t'en ajouter depuis son espace admin.</div>
    </div>`;
    return;
  }
  area.innerHTML='';
  for(const s of sessions){
    if(s.type==='separator'){
      area.insertAdjacentHTML('beforeend',buildSeparatorCard(s));
    } else {
      area.insertAdjacentHTML('beforeend',await buildSessionCard(s));
    }
  }
}

// Surcharger renderDayStrip / renderSessions pour rerouter quand currentProg=__perso__
const __origRenderDayStrip=renderDayStrip;
renderDayStrip=async function(){
  if(currentProg?.id==='__perso__'){return renderPersoDayStrip();}
  return __origRenderDayStrip();
};
const __origRenderSessions=renderSessions;
renderSessions=async function(){
  if(currentProg?.id==='__perso__'){return renderPersoSessions();}
  return __origRenderSessions();
};

/* ===================================================== */
/* === V2 FEATURES : athlete card + wellness === */
/* ===================================================== */

// --- DNF toggle pour score type=time ---
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

// --- Helpers ---
function _initials(s){return (s||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);}
function _isoDate(d){return d.toISOString().split('T')[0];}
function _weekStart(d){const x=new Date(d);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);x.setHours(0,0,0,0);return x;}
function _addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}

// --- adminTab override : wire wellness + close fiche on tab switch ---
const __origAdminTab=adminTab;
adminTab=function(tab,btn){
  // Quand on change d'onglet, ferme la fiche athlète si ouverte
  const card=document.getElementById('admin-athlete-card');
  const list=document.getElementById('admin-athletes-list');
  if(card)card.style.display='none';
  if(list)list.style.display='';
  __origAdminTab(tab,btn);
  if(tab==='wellness')loadWellnessAdmin();
};

// ============================================
// FICHE ATHLÈTE (clic depuis liste athlètes)
// ============================================
async function openAthleteCard(id){
  const card=document.getElementById('admin-athlete-card');
  const list=document.getElementById('admin-athletes-list');
  if(!card||!list)return;
  list.style.display='none';
  card.style.display='block';
  document.getElementById('page-admin').scrollTop=0;

  const {data:p}=await sb.from('profiles').select('*').eq('id',id).single();
  if(!p)return;
  document.getElementById('ac-avatar').textContent=_initials(p.full_name||p.email);
  document.getElementById('ac-name').textContent=(p.full_name||'—').toUpperCase();
  const since=p.created_at?new Date(p.created_at).toLocaleDateString('fr-FR',{month:'short',year:'numeric'}):'';
  document.getElementById('ac-sub').textContent=`${p.email||''}${since?' · Athlète depuis '+since:''}`;

  await Promise.all([
    _loadAthleteCardStats(id),
    _loadAthleteCardPRs(id),
    _loadAthleteCardWellness(id),
  ]);
}
function closeAthleteCard(){
  document.getElementById('admin-athlete-card').style.display='none';
  document.getElementById('admin-athletes-list').style.display='';
  const panel=document.getElementById('admin-athletes');
  if(panel&&panel.dataset.returnTo==='dashboard'){
    delete panel.dataset.returnTo;
    const tabBtn=document.querySelector('.admin-tab-btn[onclick*="dashboard"]');
    if(tabBtn)adminTab('dashboard',tabBtn);
  }
}
// Ouvre la fiche athlète depuis le dashboard (sans onglet Athlètes)
async function openAthleteFicheFromDash(id){
  document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
  const panel=document.getElementById('admin-athletes');
  panel.classList.add('active');
  panel.dataset.returnTo='dashboard';
  document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.remove('active'));
  if(typeof loadAdminAthletes==='function'){try{await loadAdminAthletes();}catch(e){}}
  openAthleteCard(id);
}

async function _loadAthleteCardStats(id){
  const today=new Date();
  const wkStart=_weekStart(today);
  const monthStart=new Date(today.getFullYear(),today.getMonth(),1);

  // wod_scores : tentative principale (inclut tous types de séances faites)
  const isoMonth=_isoDate(monthStart);
  const isoWeek=_isoDate(wkStart);
  let weekDone=[];
  let monthCount=0;
  try{
    const {data:scores}=await sb.from('wod_scores').select('session_id,date,created_at')
      .eq('athlete_id',id)
      .gte('date',isoMonth);
    if(scores){
      monthCount=scores.length;
      weekDone=scores.filter(s=>s.date>=isoWeek);
    }
  }catch(e){console.warn('wod_scores fetch',e);}

  document.getElementById('ac-week').textContent=weekDone.length;
  document.getElementById('ac-month').textContent=monthCount;
  // assiduité : nb jours uniques avec au moins 1 wod / 30 derniers jours
  const last30=_addDays(today,-30);
  let attendance='—';
  try{
    const {data:s30}=await sb.from('wod_scores').select('date').eq('athlete_id',id).gte('date',_isoDate(last30));
    if(s30){
      const days=new Set((s30||[]).map(x=>x.date));
      attendance=Math.round(days.size/30*100)+'%';
    }
  }catch(e){}
  document.getElementById('ac-attendance').textContent=attendance;

  // calendrier semaine
  const cal=document.getElementById('ac-cal');
  const labels=['L','M','M','J','V','S','D'];
  const todayIso=_isoDate(today);
  const weekDoneSet=new Set(weekDone.map(x=>x.date));
  cal.innerHTML=labels.map((lab,i)=>{
    const d=_addDays(wkStart,i);
    const iso=_isoDate(d);
    const isToday=iso===todayIso;
    const done=weekDoneSet.has(iso);
    return `<div class="afiche-cal-day ${done?'done':''} ${isToday?'today':''}">${lab}</div>`;
  }).join('');
}

async function _loadAthleteCardPRs(id){
  const wrap=document.getElementById('ac-prs');
  wrap.innerHTML='<div style="color:var(--muted);font-size:12px;padding:8px 0">Chargement…</div>';
  // Récupère tous les PR de l'athlète, joint au mouvement
  let prs=[];
  try{
    const {data}=await sb.from('athlete_prs').select('movement_id,value,unit,date,created_at').eq('athlete_id',id).order('date',{ascending:true,nullsFirst:false});
    prs=data||[];
  }catch(e){console.warn(e);}
  if(!prs.length){wrap.innerHTML='<div style="color:var(--muted);font-size:12px;padding:8px 0">Aucun PR enregistré.</div>';return;}
  // grouper par mouvement
  const byMov={};
  prs.forEach(pr=>{(byMov[pr.movement_id]=byMov[pr.movement_id]||[]).push(pr);});
  // trier par date DESC pour pickle dernier
  const movIds=Object.keys(byMov);
  // résoudre noms mvt
  let movs={};
  if(movIds.length){
    try{
      const {data:m}=await sb.from('movements').select('id,name').in('id',movIds);
      (m||[]).forEach(x=>{movs[x.id]=x.name;});
    }catch(e){}
  }
  // garder top 6 mvts (par récence du dernier PR)
  const items=movIds.map(mid=>{
    const series=byMov[mid].slice().sort((a,b)=>(a.date||a.created_at).localeCompare(b.date||b.created_at));
    return {mid,series,last:series[series.length-1]};
  }).sort((a,b)=>(b.last.date||'').localeCompare(a.last.date||'')).slice(0,6);

  wrap.innerHTML=items.map(it=>{
    const {series,last}=it;
    const name=movs[it.mid]||'Mouvement';
    const unit=last.unit||'';
    const first=series[0]?.value;
    const lastV=last.value;
    const isTime=unit==='s'||unit==='min';
    const delta=(typeof first==='number'&&typeof lastV==='number')?(lastV-first):null;
    const trend=delta==null?'':(isTime?(delta>0?'down':'up'):(delta>0?'up':'down'));
    const deltaTxt=(delta==null||delta===0)?'':(isTime
      ? (delta>0?`+${Math.abs(delta).toFixed(0)}${unit}`:`-${Math.abs(delta).toFixed(0)}${unit}`)
      : (delta>0?`+${Math.abs(delta).toFixed(1)}${unit}`:`-${Math.abs(delta).toFixed(1)}${unit}`));
    const points=_sparkPoints(series.map(s=>s.value),isTime?'time':'val');
    const color=delta==null?'var(--accent)':(trend==='up'?'#47ff8c':'#ff8c47');
    const valTxt=(typeof lastV==='number'?lastV:lastV)+(unit||'');
    return `<div class="afiche-pr">
      <div class="afiche-pr-head">
        <div>
          <div class="afiche-pr-name">${escapeHtml(name)}</div>
          ${deltaTxt?`<div class="afiche-pr-trend ${trend==='down'?'down':''}">${deltaTxt} sur ${series.length} entrée${series.length>1?'s':''}</div>`:''}
        </div>
        <div class="afiche-pr-val">${escapeHtml(String(valTxt))}</div>
      </div>
      <svg class="afiche-spark" viewBox="0 0 300 32" preserveAspectRatio="none">
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>
      </svg>
    </div>`;
  }).join('');
}

function _sparkPoints(values,kind){
  if(!values||!values.length)return '0,16';
  const min=Math.min(...values),max=Math.max(...values);
  const range=max-min||1;
  const w=300,h=32,pad=4;
  return values.map((v,i)=>{
    const x=values.length===1?w/2:(i/(values.length-1))*w;
    // pour temps : moins haut = mieux donc on inverse pour visu progression descendante = positif
    let y;
    if(kind==='time'){y=pad+((v-min)/range)*(h-2*pad);}
    else{y=h-pad-((v-min)/range)*(h-2*pad);}
    return `${x.toFixed(0)},${y.toFixed(1)}`;
  }).join(' ');
}

async function _loadAthleteCardWellness(id){
  const wrap=document.getElementById('ac-wellness');
  const since=_isoDate(_addDays(new Date(),-14));
  let entries=[];
  try{
    const {data}=await sb.from('wellness_entries').select('*').eq('athlete_id',id).gte('date',since).order('date',{ascending:true});
    entries=data||[];
  }catch(e){console.warn('wellness fetch',e);}
  if(!entries.length){wrap.innerHTML='<div style="color:var(--muted);font-size:12px;padding:8px 0">Pas de saisie wellness sur les 14 derniers jours.</div>';return;}

  const metrics=[
    {key:'fatigue',name:'Fatigue générale',color:'#ff8c47',inv:true},
    {key:'sleep_quality',name:'Qualité du sommeil',color:'#47c8ff'},
    {key:'soreness',name:'Courbatures',color:'#ff4747',inv:true},
    {key:'energy',name:'Énergie',color:'#e8ff47'},
  ];
  wrap.innerHTML=metrics.map(m=>{
    const vals=entries.map(e=>e[m.key]).filter(v=>typeof v==='number');
    if(!vals.length)return '';
    const avg=(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(1);
    const last=vals[vals.length-1];
    return `<div class="afiche-pr">
      <div class="afiche-pr-head"><div class="afiche-pr-name">${m.name}</div><div class="afiche-pr-val" style="color:${m.color}">${avg}/10</div></div>
      <svg class="afiche-spark" viewBox="0 0 300 32" preserveAspectRatio="none">
        <polyline points="${_sparkPoints(vals,'val')}" fill="none" stroke="${m.color}" stroke-width="2"/>
      </svg>
    </div>`;
  }).join('')||'<div style="color:var(--muted);font-size:12px">Pas assez de données.</div>';
}

// Override loadAdminAthletes pour rendre les rows cliquables
const __origLoadAdminAthletes=loadAdminAthletes;
loadAdminAthletes=async function(){
  await __origLoadAdminAthletes();
  // post-process : ajoute onclick sur chaque row (sauf bouton delete)
  document.querySelectorAll('#admin-athletes-list .athlete-row').forEach(row=>{
    if(row._wired)return;row._wired=1;
    const delBtn=row.querySelector('.btn-delete');
    row.addEventListener('click',(e)=>{
      if(e.target.closest('.btn-delete'))return;
      // récupère l'id depuis le bouton delete (qui contient l'id) ou via data-attr — fallback : skip
      const btn=row.querySelector('.btn-delete');
      const m=btn&&btn.getAttribute('onclick')&&btn.getAttribute('onclick').match(/deleteAthlete\('([^']+)'/);
      if(m)openAthleteCard(m[1]);
    });
  });
};

// ============================================
// WELLNESS ATHLÈTE — saisie quotidienne
// ============================================
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
  // val 1..10 — pour métriques normales : haut=vert ; pour inversées (fatigue/courbatures/stress) : haut=rouge
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
  try{
    const {data}=await sb.from('wellness_entries').select('*').eq('athlete_id',currentUser.id).eq('date',iso).maybeSingle();
    existing=data;
  }catch(e){console.warn('wellness load',e);}
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
    return `<div class="well-row">
      <div class="lab"><div class="name">${f.icon} ${f.name}</div><div class="val" style="color:${c}" id="wv-${f.key}">${val}/10</div></div>
      <input type="range" min="1" max="10" step="1" value="${val}" class="well-slider" data-key="${f.key}" data-inv="${f.inv?1:0}" oninput="_onWellSlide(this)" style="--c:${c}">
    </div>`;
  }).join('');
  html+=`<div class="well-row" style="margin-bottom:0">
    <div class="lab"><div class="name">📝 Note libre</div></div>
    <textarea id="wv-notes" placeholder="Petit mot pour le coach... (optionnel)">${escapeHtml(v.notes||'')}</textarea>
  </div>`;
  wrap.innerHTML=html;
  // colorise le thumb (chrome)
  document.querySelectorAll('#wellness-form .well-slider').forEach(s=>{
    const inv=s.dataset.inv==='1';
    const v=parseInt(s.value);
    const c=_wellnessColor(v,inv);
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
  WELLNESS_FIELDS.forEach(f=>{
    const el=document.querySelector(`#wellness-form [data-key="${f.key}"]`);
    if(el)payload[f.key]=parseInt(el.value);
  });
  const notes=document.getElementById('wv-notes')?.value?.trim()||null;
  payload.notes=notes;
  // upsert sur (athlete_id,date)
  const {error}=await sb.from('wellness_entries').upsert(payload,{onConflict:'athlete_id,date'});
  if(error){
    console.error('wellness save',error);
    const msg=(error.message||'').toLowerCase();
    if(msg.includes('schema')||msg.includes('does not exist')||msg.includes('not find')){
      showToast('⚠️ Table wellness manquante — exécute sql/wellness_entries.sql dans Supabase');
    } else {
      showToast('❌ '+error.message);
    }
    return;
  }
  showToast('✅ Wellness enregistré');
  _wellnessToday=payload;
  document.getElementById('wellness-save-btn').textContent='Mettre à jour';
  document.getElementById('wellness-banner-sub').textContent='Tu peux mettre à jour jusqu\'à minuit';
}

// hook into goPage
const __origGoPage=goPage;
goPage=async function(p){
  await __origGoPage(p);
  if(p==='wellness')loadWellnessPage();
};

// ============================================
// WELLNESS ADMIN — tableau global
// ============================================
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
  // tous les athlètes
  const {data:profs}=await sb.from('profiles').select('id,full_name,email').order('full_name');
  let entries=[];
  try{
    const {data}=await sb.from('wellness_entries').select('*').gte('date',since);
    entries=data||[];
  }catch(e){console.warn('wellness admin',e);}

  // pour chaque athlète : prendre la saisie la plus récente (sur la période)
  const lastByAth={};
  entries.forEach(e=>{
    const cur=lastByAth[e.athlete_id];
    if(!cur||e.date>cur.date)lastByAth[e.athlete_id]=e;
  });

  const rows=(profs||[]).filter(p=>p.id!==currentUser.id||true).map(p=>{
    const e=lastByAth[p.id];
    return {p,e,sev:_wellnessSeverity(e)};
  });
  // tri : alertes rouges, oranges, vert, puis non saisis
  const sevOrder={red:0,orange:1,green:2,none:3};
  rows.sort((a,b)=>(sevOrder[a.sev]-sevOrder[b.sev])||(a.p.full_name||'').localeCompare(b.p.full_name||''));

  // résumé
  const filled=rows.filter(r=>r.e).length;
  const alerts=rows.filter(r=>r.sev==='red').length;
  const fatigues=rows.filter(r=>r.e&&typeof r.e.fatigue==='number').map(r=>r.e.fatigue);
  const fAvg=fatigues.length?(fatigues.reduce((s,v)=>s+v,0)/fatigues.length).toFixed(1):'—';
  document.getElementById('wa-alerts').textContent=alerts;
  document.getElementById('wa-fills').textContent=`${filled} / ${rows.length}`;
  document.getElementById('wa-fatigue').textContent=fAvg;

  document.getElementById('wa-list').innerHTML=rows.map(r=>{
    if(!r.e){
      return `<div class="well-alert muted">
        <div class="av">${_initials(r.p.full_name||r.p.email)}</div>
        <div class="mid"><div class="nm">${escapeHtml(r.p.full_name||'—')}</div><div class="meta"><span class="well-chip">Pas de saisie</span></div></div>
      </div>`;
    }
    const ic=r.sev==='red'?'🚨':(r.sev==='orange'?'⚠️':(r.sev==='green'?'✅':''));
    const chips=_wellnessChips(r.e);
    return `<div class="well-alert ${r.sev}" onclick="openAthleteFicheFromDash('${r.p.id}')">
      <div class="av">${_initials(r.p.full_name||r.p.email)}</div>
      <div class="mid">
        <div class="nm">${escapeHtml(r.p.full_name||'—')}</div>
        <div class="meta">${chips}</div>
      </div>
      <div class="ic">${ic}</div>
    </div>`;
  }).join('')||'<div class="empty"><p>Aucune donnée.</p></div>';
}

function _wellnessSeverity(e){
  if(!e)return 'none';
  const reds=[];
  if(e.fatigue>=8)reds.push('fat');
  if(e.soreness>=8)reds.push('sor');
  if(e.stress>=8)reds.push('str');
  if(e.sleep_quality<=4)reds.push('slp');
  if(e.energy<=3)reds.push('eng');
  if(reds.length>=2)return 'red';
  if(reds.length===1)return 'orange';
  if((e.energy>=7||e.motivation>=7)&&e.fatigue<=5)return 'green';
  return 'orange';
}
function _wellnessChips(e){
  const out=[];
  const push=(name,v,inv)=>{
    if(typeof v!=='number')return;
    let cls='';
    const norm=inv?v:(11-v);
    if((inv&&v>=8)||(!inv&&v<=3))cls='r';
    else if((inv&&v>=6)||(!inv&&v<=5))cls='o';
    else cls='g';
    out.push(`<span class="well-chip ${cls}">${name} ${v}</span>`);
  };
  push('Fatigue',e.fatigue,true);
  push('Courb.',e.soreness,true);
  push('Sommeil',e.sleep_quality,false);
  push('Stress',e.stress,true);
  push('Énergie',e.energy,false);
  return out.slice(0,4).join(' ');
}

/* ============================================================
 * WOD CALENDAR — profil → clic sur la stat "WODs"
 * Affiche un calendrier mensuel avec les WOD faits / programmés
 * non faits / manuels. Permet d'ajouter une séance perso.
 * ============================================================ */
const WC_MONTHS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const WC_DAYS=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
let wodCalState={y:new Date().getFullYear(),m:new Date().getMonth(),selectedKey:null,data:null};

function wcIso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function wcEsc(s){return (s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function openWodCalendar(){
  if(!currentUser){showToast('Connecte-toi pour voir ton calendrier');return;}
  const now=new Date();
  wodCalState={y:now.getFullYear(),m:now.getMonth(),selectedKey:wcIso(now),data:null};
  // Reset recherche
  const inp=document.getElementById('wod-cal-search-input');
  if(inp)inp.value='';
  const cb=document.getElementById('wod-cal-search-clear');
  if(cb)cb.style.display='none';
  const cal=document.getElementById('wod-cal-cal-area');
  if(cal)cal.style.display='';
  const res=document.getElementById('wod-cal-search-results');
  if(res){res.style.display='none';res.innerHTML='';}
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

  // 1) WOD scores de l'athlète sur le mois (via session.date)
  const scoresRes=await sb.from('wod_scores')
    .select('id,score_value,score_text,score_type,level,created_at,sessions(id,date,title,type,color,programme_id,programmes(name,icon,color))')
    .eq('athlete_id',currentUser.id);
  const doneByDate={};
  for(const s of (scoresRes.data||[])){
    const date=s.sessions?.date;
    if(!date||date<firstIso||date>lastIso)continue;
    (doneByDate[date]=doneByDate[date]||[]).push(s);
  }

  // 2) Séances programmées du mois sur les programmes accessibles
  const progIds=Array.from(myAccessIds||new Set());
  const progByDate={};
  if(progIds.length){
    const sRes=await sb.from('sessions')
      .select('id,date,title,type,color,programme_id,programmes(name,icon,color)')
      .in('programme_id',progIds).gte('date',firstIso).lte('date',lastIso);
    for(const s of (sRes.data||[])){
      if(!s.date||s.type==='separator')continue;
      (progByDate[s.date]=progByDate[s.date]||[]).push(s);
    }
  }

  // 3) Séances personnelles (manuelles ou poussées par un coach)
  const pRes=await sb.from('personal_sessions')
    .select('id,date,title,type,color,content,score_type')
    .eq('athlete_id',currentUser.id).gte('date',firstIso).lte('date',lastIso);
  const persoByDate={};
  for(const p of (pRes.data||[])){
    (persoByDate[p.date]=persoByDate[p.date]||[]).push(p);
  }
  return {doneByDate,progByDate,persoByDate};
}

async function renderWodCalendar(){
  const grid=document.getElementById('wod-cal-grid');
  const label=document.getElementById('wod-cal-month-label');
  if(!grid||!label)return;
  const {y,m}=wodCalState;
  label.textContent=`${WC_MONTHS[m]} ${y}`;
  grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:30px 0;color:var(--muted)">Chargement…</div>';

  let data;
  try{data=await loadWodCalData();}
  catch(e){console.error('wod cal load',e);grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:30px 0;color:var(--red);font-size:12px">Erreur de chargement</div>';return;}
  wodCalState.data=data;

  const daysInMonth=new Date(y,m+1,0).getDate();
  const firstDow=new Date(y,m,1).getDay();
  const startOffset=(firstDow+6)%7; // Lundi en premier
  const cells=Math.ceil((startOffset+daysInMonth)/7)*7;
  const todayIso=wcIso(new Date());

  // Stats
  let doneCount=0,manualCount=0,skipCount=0;
  for(const k in data.doneByDate)doneCount+=data.doneByDate[k].length;
  for(const k in data.persoByDate)manualCount+=data.persoByDate[k].length;
  for(const k in data.progByDate){
    if(k>todayIso)continue;
    if(!(data.doneByDate[k]&&data.doneByDate[k].length))skipCount++;
  }
  document.getElementById('wod-cal-done').textContent=doneCount;
  document.getElementById('wod-cal-manual').textContent=manualCount;
  document.getElementById('wod-cal-skip').textContent=skipCount;

  let html='';
  for(let i=0;i<cells;i++){
    const dayNum=i-startOffset+1;
    if(dayNum<1||dayNum>daysInMonth){html+='<div class="wod-cal-cell empty"></div>';continue;}
    const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
    const isToday=iso===todayIso;
    const isFuture=iso>todayIso;
    const done=data.doneByDate[iso]||[];
    const prog=data.progByDate[iso]||[];
    const perso=data.persoByDate[iso]||[];
    let cls='wod-cal-cell',dot='';
    if(done.length){cls+=' done';dot='<span class="wcd done"></span>';}
    else if(perso.length){cls+=' manual';dot='<span class="wcd manual"></span>';}
    else if(prog.length&&!isFuture&&!isToday){cls+=' skipped';dot='<span class="wcd skip">✕</span>';}
    else if(prog.length){cls+=' prog';dot='<span class="wcd prog"></span>';}
    if(isToday)cls+=' today';
    if(iso===wodCalState.selectedKey)cls+=' selected';
    html+=`<div class="${cls}" onclick="selectWodCalDay('${iso}')"><div class="wcn">${dayNum}</div><div class="wcdot">${dot}</div></div>`;
  }
  grid.innerHTML=html;
  renderWodCalDetail();
}

function selectWodCalDay(iso){
  wodCalState.selectedKey=iso;
  // Refresh classes sur la grille
  document.querySelectorAll('#wod-cal-grid .wod-cal-cell').forEach(el=>el.classList.remove('selected'));
  // Re-render pour mettre selected — simple
  const cells=document.querySelectorAll('#wod-cal-grid .wod-cal-cell');
  // Trouve celle dont l'onclick contient iso
  cells.forEach(c=>{
    const oc=c.getAttribute('onclick')||'';
    if(oc.indexOf(`'${iso}'`)!==-1)c.classList.add('selected');
  });
  renderWodCalDetail();
}

function renderWodCalDetail(){
  const wrap=document.getElementById('wod-cal-detail');
  if(!wrap||!wodCalState.data)return;
  const iso=wodCalState.selectedKey;
  if(!iso){wrap.innerHTML='';return;}
  const data=wodCalState.data;
  const done=data.doneByDate[iso]||[];
  const prog=data.progByDate[iso]||[];
  const perso=data.persoByDate[iso]||[];
  const todayIso=wcIso(new Date());
  const isFuture=iso>todayIso;
  const isToday=iso===todayIso;
  const [Y,M,D]=iso.split('-').map(Number);
  const dt=new Date(Y,M-1,D);
  const dayLabel=`${isToday?"Aujourd'hui · ":''}${WC_DAYS[dt.getDay()]} ${D} ${WC_MONTHS[M-1]}`;

  let html=`<div class="wod-cal-day-label">${dayLabel}</div>`;

  // 1) Séances faites (wod_scores)
  for(const s of done){
    const sess=s.sessions||{};
    const prog=sess.programmes||{};
    const color=sess.color||prog.color||'var(--accent)';
    const score=s.score_text||s.score_value||'';
    html+=`<div class="wod-cal-session" onclick="openReadSession('${sess.id}','session')"><div class="wcs-icon" style="background:${color}22;color:${color}">${wcEsc(prog.icon||'✓')}</div>
      <div class="wcs-body"><div class="wcs-title">${wcEsc(sess.title||'Séance')}</div>
      <div class="wcs-meta">${wcEsc(prog.name||(sess.type||'').toUpperCase())} · <span style="color:var(--accent)">FAIT</span></div></div>
      ${score?`<div class="wcs-score">${wcEsc(score)}</div>`:''}</div>`;
  }
  // 2) Séances perso (manuelles)
  for(const p of perso){
    html+=`<div class="wod-cal-session" onclick="openReadSession('${p.id}','personal')"><div class="wcs-icon" style="background:rgba(71,255,140,.16);color:var(--green)">●</div>
      <div class="wcs-body"><div class="wcs-title">${wcEsc(p.title||'Séance perso')}</div>
      <div class="wcs-meta">${wcEsc((p.type||'wod').toUpperCase())} · <span style="color:var(--green)">MANUEL</span></div></div>
      <button class="wcs-del" onclick="event.stopPropagation();deleteWodCalManual('${p.id}')" title="Supprimer">✕</button></div>`;
  }
  // 3) Séances programmées non faites (passé/aujourd'hui)
  if(!done.length && !isFuture){
    for(const s of prog){
      const pInfo=s.programmes||{};
      html+=`<div class="wod-cal-session skipped" onclick="openReadSession('${s.id}','session')"><div class="wcs-icon" style="background:rgba(255,68,68,.12);color:var(--red)">✕</div>
        <div class="wcs-body"><div class="wcs-title">${wcEsc(s.title||'Séance')}</div>
        <div class="wcs-meta">${wcEsc(pInfo.name||'Programme')} · <span style="color:var(--red)">NON FAIT</span></div></div></div>`;
    }
  }
  // 4) Programme à venir
  if(isFuture && prog.length){
    for(const s of prog){
      const pInfo=s.programmes||{};
      html+=`<div class="wod-cal-session upcoming" onclick="openReadSession('${s.id}','session')"><div class="wcs-icon" style="background:var(--card2);color:var(--muted)">○</div>
        <div class="wcs-body"><div class="wcs-title">${wcEsc(s.title||'Séance')}</div>
        <div class="wcs-meta">${wcEsc(pInfo.name||'Programme')} · <span style="color:var(--muted)">À VENIR</span></div></div></div>`;
    }
  }
  // 5) Rien
  if(!done.length && !perso.length && !prog.length){
    html+=`<div class="wod-cal-empty">Rien ce jour-là.</div>`;
  }

  // Bouton ajout
  if(!isFuture){
    const has=done.length||perso.length;
    html+=`<button class="wod-cal-add-btn" onclick="openWodCalAddForm()">＋ ${has?'Ajouter une autre séance':'Ajouter une séance manuelle'}</button>`;
  }

  // Formulaire d'ajout (caché par défaut)
  html+=`<div id="wod-cal-add-form" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
    <div class="wod-cal-form-title">＋ Nouvelle séance</div>
    <div class="wod-cal-type-chips">
      ${[['wod','WOD'],['strength','Force'],['weightlifting','Haltéro'],['gymnastics','Gym'],['cardio','Cardio'],['mobility','Mobilité'],['skill','Skill']].map(([k,l])=>`<button type="button" class="wod-cal-chip${k==='wod'?' active':''}" data-type="${k}" onclick="selWodCalType('${k}',this)">${l}</button>`).join('')}
    </div>
    <input id="wod-cal-add-title" class="wod-cal-input" placeholder="Titre — ex: Course 5km, Fran, EMOM 20…" />
    <input id="wod-cal-add-score" class="wod-cal-input" placeholder="Score / temps / charge (optionnel)" />
    <textarea id="wod-cal-add-note" class="wod-cal-input wod-cal-textarea" placeholder="Notes (optionnel)"></textarea>
    <div style="display:flex;gap:8px">
      <button class="wod-cal-btn-cancel" onclick="closeWodCalAddForm()">Annuler</button>
      <button class="wod-cal-btn-save" onclick="saveWodCalManual()">Enregistrer</button>
    </div>
  </div>`;

  wrap.innerHTML=html;
}

function openWodCalAddForm(){
  const f=document.getElementById('wod-cal-add-form');
  if(f){f.style.display='block';setTimeout(()=>{document.getElementById('wod-cal-add-title')?.focus();},50);}
}
function closeWodCalAddForm(){
  const f=document.getElementById('wod-cal-add-form');
  if(f){f.style.display='none';
    document.getElementById('wod-cal-add-title').value='';
    document.getElementById('wod-cal-add-score').value='';
    document.getElementById('wod-cal-add-note').value='';
  }
}
function selWodCalType(t,btn){
  document.querySelectorAll('.wod-cal-chip').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

async function saveWodCalManual(){
  if(!currentUser){showToast('Connecte-toi');return;}
  const iso=wodCalState.selectedKey;
  if(!iso)return;
  const type=document.querySelector('.wod-cal-chip.active')?.dataset.type||'wod';
  const title=document.getElementById('wod-cal-add-title').value.trim();
  const score=document.getElementById('wod-cal-add-score').value.trim();
  const note=document.getElementById('wod-cal-add-note').value.trim();
  if(!title){showToast('⚠️ Titre requis');return;}
  const content=[score?`Score : ${score}`:'',note].filter(Boolean).join('\n\n')||null;
  const payload={
    athlete_id:currentUser.id,
    date:iso,
    type,
    title,
    content,
    created_by:currentUser.id,
  };
  const {error}=await sb.from('personal_sessions').insert(payload);
  if(error){showToast('❌ '+error.message);console.error('save manual',error);return;}
  showToast('✅ Séance ajoutée');
  await renderWodCalendar();
  if(typeof loadProfilStats==='function')loadProfilStats();
}

async function deleteWodCalManual(id){
  if(!confirm('Supprimer cette séance manuelle ?'))return;
  const {error}=await sb.from('personal_sessions').delete().eq('id',id);
  if(error){showToast('❌ '+error.message);return;}
  showToast('🗑 Supprimée');
  await renderWodCalendar();
}

/* ============================================================
 * WOD CALENDAR — Search engine
 * Cherche dans tous les WOD faits + séances perso (titre + content)
 * ============================================================ */
let wodCalSearchTimer=null;
let wodCalSearchToken=0;

function onWodCalSearch(){
  const input=document.getElementById('wod-cal-search-input');
  const clearBtn=document.getElementById('wod-cal-search-clear');
  const q=(input.value||'').trim();
  if(clearBtn)clearBtn.style.display=q?'flex':'none';
  clearTimeout(wodCalSearchTimer);
  if(!q){
    // Retour vue calendrier
    document.getElementById('wod-cal-cal-area').style.display='';
    document.getElementById('wod-cal-search-results').style.display='none';
    return;
  }
  // Pas de recherche si moins de 2 caractères
  if(q.length<2){
    const out=document.getElementById('wod-cal-search-results');
    document.getElementById('wod-cal-cal-area').style.display='none';
    out.style.display='block';
    out.innerHTML=`<div class="wod-cal-search-empty">Tape <strong>2 caractères</strong> minimum<br/><span style="font-size:11px;opacity:.7">ex: muscle up, snatch, Fran, 5km…</span></div>`;
    return;
  }
  wodCalSearchTimer=setTimeout(()=>runWodCalSearch(q),220);
}

function clearWodCalSearch(){
  const input=document.getElementById('wod-cal-search-input');
  if(input)input.value='';
  document.getElementById('wod-cal-search-clear').style.display='none';
  document.getElementById('wod-cal-cal-area').style.display='';
  document.getElementById('wod-cal-search-results').style.display='none';
}

function wcHighlight(text,terms){
  if(!text)return '';
  let safe=wcEsc(text);
  for(const t of terms){
    if(!t)continue;
    const re=new RegExp('('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig');
    safe=safe.replace(re,'<mark>$1</mark>');
  }
  return safe;
}

function wcSnippet(content,terms,maxLen=160){
  if(!content)return '';
  const lower=content.toLowerCase();
  let pos=-1;
  for(const t of terms){
    if(!t)continue;
    const p=lower.indexOf(t.toLowerCase());
    if(p!==-1&&(pos===-1||p<pos))pos=p;
  }
  if(pos===-1){
    return wcHighlight(content.length>maxLen?content.slice(0,maxLen)+'…':content,terms);
  }
  const start=Math.max(0,pos-50);
  const end=Math.min(content.length,pos+110);
  let snip=(start>0?'…':'')+content.slice(start,end)+(end<content.length?'…':'');
  return wcHighlight(snip,terms);
}

function wcFormatShortDate(iso){
  if(!iso)return '';
  const [Y,M,D]=iso.split('-').map(Number);
  const dt=new Date(Y,M-1,D);
  return `${String(D).padStart(2,'0')} ${WC_MONTHS[M-1].slice(0,3)}.<br>${Y}`;
}

async function runWodCalSearch(query){
  if(!currentUser)return;
  const out=document.getElementById('wod-cal-search-results');
  document.getElementById('wod-cal-cal-area').style.display='none';
  out.style.display='block';
  out.innerHTML='<div style="text-align:center;padding:30px;color:var(--muted);font-size:12px">Recherche…</div>';

  const q=(query||'').trim();
  if(!q){clearWodCalSearch();return;}
  const token=++wodCalSearchToken;
  // Termes : on split sur espaces, chaque mot doit matcher (AND)
  const terms=q.split(/\s+/).filter(Boolean);
  const like=`%${q.replace(/[%_]/g,'\\$&')}%`;

  try{
    // 1) Scores faits : on tire tous les scores de l'athlète puis on joint sessions
    // Pour rester efficace on filtre côté DB via or() sur sessions.title/content
    // mais Supabase n'expose pas le filtre sur relation ; on fait donc 2 passes :
    //  a) récupérer toutes les session_id de l'athlète
    //  b) charger ces sessions filtrées par ilike sur title/content
    const scoresRes=await sb.from('wod_scores')
      .select('id,session_id,score_value,score_text,created_at')
      .eq('athlete_id',currentUser.id);
    if(token!==wodCalSearchToken)return;
    const scores=scoresRes.data||[];
    const sessionIds=Array.from(new Set(scores.map(s=>s.session_id).filter(Boolean)));
    let sessions=[];
    if(sessionIds.length){
      // Supabase a une limite ~1000 d'IDs dans .in() — ici on est largement en-dessous
      const sRes=await sb.from('sessions')
        .select('id,date,title,content,type,color,programme_id,programmes(name,icon,color)')
        .in('id',sessionIds)
        .or(`title.ilike.${like},content.ilike.${like}`);
      sessions=sRes.data||[];
    }
    if(token!==wodCalSearchToken)return;
    const sessionById={};sessions.forEach(s=>sessionById[s.id]=s);
    const doneHits=scores.filter(sc=>sessionById[sc.session_id]).map(sc=>{
      const sess=sessionById[sc.session_id];
      return {kind:'done',date:sess.date,session:sess,score:sc,scoreId:sc.id};
    });

    // 2) Séances perso (manuelles ou coach)
    const persoRes=await sb.from('personal_sessions')
      .select('id,date,title,content,type,color')
      .eq('athlete_id',currentUser.id)
      .or(`title.ilike.${like},content.ilike.${like}`);
    if(token!==wodCalSearchToken)return;
    const persoHits=(persoRes.data||[]).map(p=>({kind:'perso',date:p.date,perso:p}));

    // Combine + tri date desc
    const all=[...doneHits,...persoHits].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    if(!all.length){
      out.innerHTML=`<div class="wod-cal-search-empty">
        Aucun résultat pour <strong>« ${wcEsc(q)} »</strong><br/>
        <span style="font-size:11px;opacity:.7">Essaie un autre mot-clé, ou vérifie l'orthographe.</span>
      </div>`;
      return;
    }

    // Regroupement par année
    const byYear={};
    for(const h of all){
      const y=(h.date||'').slice(0,4)||'—';
      (byYear[y]=byYear[y]||[]).push(h);
    }
    const years=Object.keys(byYear).sort((a,b)=>b.localeCompare(a));

    let html=`<div class="wcsi-header">${all.length} résultat${all.length>1?'s':''} pour « ${wcEsc(q)} »</div>`;
    for(const y of years){
      if(years.length>1)html+=`<div class="wcsi-header" style="padding-top:14px">${y}</div>`;
      for(const h of byYear[y]){
        if(h.kind==='done'){
          const s=h.session,p=s.programmes||{};
          const score=h.score.score_text||h.score.score_value||'';
          const color=s.color||p.color||'#e8ff47';
          html+=`<div class="wod-cal-search-item" onclick="openReadSession('${s.id}','session')">
            <div class="wcsi-date">${wcFormatShortDate(h.date)}</div>
            <div class="wcsi-body">
              <div class="wcsi-title">${wcHighlight(s.title||'Séance',terms)}</div>
              <div class="wcsi-meta">${wcEsc(p.icon||'')} ${wcEsc(p.name||(s.type||'').toUpperCase())} · <span style="color:var(--accent)">FAIT</span></div>
              ${s.content?`<div class="wcsi-snippet">${wcSnippet(s.content,terms)}</div>`:''}
            </div>
            ${score?`<div class="wcsi-score">${wcEsc(score)}</div>`:''}
          </div>`;
        } else {
          const p=h.perso;
          html+=`<div class="wod-cal-search-item" onclick="openReadSession('${p.id}','personal')">
            <div class="wcsi-date">${wcFormatShortDate(h.date)}</div>
            <div class="wcsi-body">
              <div class="wcsi-title">${wcHighlight(p.title||'Séance perso',terms)}</div>
              <div class="wcsi-meta">${wcEsc((p.type||'wod').toUpperCase())} · <span style="color:var(--green)">MANUEL</span></div>
              ${p.content?`<div class="wcsi-snippet">${wcSnippet(p.content,terms)}</div>`:''}
            </div>
          </div>`;
        }
      }
    }
    out.innerHTML=html;
  }catch(e){
    console.error('wod cal search',e);
    out.innerHTML=`<div class="wod-cal-search-empty" style="color:var(--red)">Erreur : ${wcEsc(e.message||'recherche impossible')}</div>`;
  }
}

