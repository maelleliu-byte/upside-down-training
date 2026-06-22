// UTILS
function getScorePlaceholder(type){return{time:'14:32',reps:'87',rounds:'12 + 5',weight:'85',calories:'42'}[type]||'—';}
function extractYTId(url){const m=url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);return m?m[1]:null;}
function formatDate(iso){if(!iso)return'—';const d=new Date(iso+'T12:00:00');return`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}

// ===================================================
// HELPERS — escape / strip
// ===================================================
function escapeHtml(s){if(s==null)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function stripHtml(s){if(!s)return'';const d=document.createElement('div');d.innerHTML=s.replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n').replace(/<\/div>/gi,'\n');return(d.textContent||d.innerText||'').replace(/\n{3,}/g,'\n\n').trim();}

// ===================================================
// MODAL LECTURE SÉANCE — vue identique à l'athlète
// ===================================================
let readModalSession=null;
let readModalIsPerso=false;
async function openReadSession(id, source){
  // Sur page-admin : ouvrir la modale de lecture (clic sur crayon pour éditer)
  const pageAdmin=document.getElementById('page-admin');
  if(pageAdmin&&pageAdmin.classList.contains('active')&&source!=='personal'){
    // Charger la séance et afficher la modale read-modal
    window._readModalSessionId=id;
    const {data:s}=await sb.from('sessions').select('*').eq('id',id).single();
    if(!s)return;
    readModalSession=s;
    readModalIsPerso=false;
    const color=s.color||'#e8ff47';
    const typeLabel=(typeof TYPE_LABELS!=='undefined'?TYPE_LABELS[s.type]:null)||s.type||'—';
    const prog=typeof getProgById==='function'?getProgById(s.programme_id):null;
    document.getElementById('read-modal-prog').textContent=prog?((prog.icon?prog.icon+' ':'')+prog.name):'—';
    let dateLabel=s.date||'';
    try{if(s.date&&typeof formatDate==='function')dateLabel=formatDate(s.date);}catch(e){}
    document.getElementById('read-modal-date').textContent=dateLabel;
    const editBtn=document.getElementById('read-modal-edit-btn');
    if(editBtn)editBtn.style.display='';
    const rawContent=s.content||'';
    let withCharges=rawContent;
    try{if(typeof renderContentWithCharges==='function')withCharges=renderContentWithCharges(rawContent);}catch(e){}
    const isHtml=/<[a-z][\s\S]*>/i.test(withCharges);
    const contentHtml=isHtml?withCharges:withCharges.replace(/\n/g,'<br>');
    let intHtml='';
    if(s.intensity){const pct=s.intensity*10;const col=s.intensity<=4?'var(--blue)':s.intensity<=7?'var(--accent)':'var(--red)';intHtml='<div class="intensity-bar"><div class="int-row"><span class="int-label">Intensité</span><span class="int-val" style="color:'+col+'">'+s.intensity+'/10</span></div><div class="int-track"><div class="int-fill" style="width:'+pct+'%;background:'+col+'"></div></div></div>';}
    const targetHtml=s.target?'<div class="info-block"><div class="info-block-title"><span>🎯</span> Target</div><div class="info-block-text">'+s.target+'</div></div>':'';
    const tipsHtml=s.tips?'<div class="info-block"><div class="info-block-title"><span>💡</span> Coaching Tips</div><div class="info-block-text">'+s.tips+'</div></div>':'';
    const scalingParts=[];
    if(s.scaling_inter)scalingParts.push('<div class="scaling-block scaling-block-inter"><div class="scaling-label" style="color:var(--red)">Intermédiaire</div><div class="scaling-text">'+s.scaling_inter+'</div></div>');
    if(s.scaling_scaled)scalingParts.push('<div class="scaling-block scaling-block-scaled"><div class="scaling-label" style="color:var(--blue)">Scaled</div><div class="scaling-text">'+s.scaling_scaled+'</div></div>');
    if(s.scaling_foundation)scalingParts.push('<div class="scaling-block scaling-block-found"><div class="scaling-label" style="color:var(--purple)">Fondation</div><div class="scaling-text">'+s.scaling_foundation+'</div></div>');
    const scalingHtml=scalingParts.join('');
    let _vids=[];try{_vids=Array.isArray(s.videos)?s.videos:(typeof s.videos==='string'?JSON.parse(s.videos):[]);}catch(e){_vids=[];}
    if((!_vids||!_vids.length)&&s.youtube_url){_vids=[{url:s.youtube_url,label:s.youtube_label||''}];}
    const videoHtml=_vids.length?'<div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">'+_vids.map(function(v){return'<a href="'+v.url+'" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(255,0,0,.1);border:1px solid rgba(255,0,0,.25);border-radius:10px;text-decoration:none;color:var(--text)"><span style="font-size:22px">▶️</span><div><div style="font-size:13px;font-weight:700">'+(v.label||'Voir la vidéo')+'</div></div></a>';}).join('')+'</div>':'';
    function _esc(str){return(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
    document.getElementById('read-modal-body').innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span class="badge badge-'+s.type+'" style="background:'+color+'18;color:'+color+'">'+typeLabel+'</span>'+(s.title?'<span style="font-size:16px;font-weight:700">'+_esc(s.title)+'</span>':'')+'</div><div class="session-content" style="font-size:14px;line-height:1.7;margin-bottom:12px">'+contentHtml+'</div>'+scalingHtml+intHtml+targetHtml+tipsHtml+videoHtml;
    document.getElementById('read-modal').classList.add('open');
    return;
  }
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
    // S'assurer d'être sur page-admin avant de remplir le formulaire
    goPage('admin');
    // Attendre que le DOM de page-admin soit actif (plus long sur tablette)
    // NB: le flag _returnToPlanningAfterSave est setté APRÈS goPage pour éviter
    // que adminTab() ne le remette à false (il reset le flag si tab !== 'new-session')
    const _tryEdit=(attempts)=>{
      const panel=document.getElementById('admin-new-session');
      const fProg=document.getElementById('f-prog');
      if(panel&&fProg){
        window._returnToPlanningAfterSave=true;
        editSession(s.id);
      } else if(attempts>0){
        setTimeout(()=>_tryEdit(attempts-1), 120);
      } else {
        window._returnToPlanningAfterSave=true;
        editSession(s.id); // fallback
      }
    };
    setTimeout(()=>_tryEdit(8), 100);
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
let personalLastDate={};      // map athlete_id → ISO date dernière séance perso
let persoChip=(()=>{try{return localStorage.getItem('perso_chip')||'all';}catch(e){return 'all';}})();
let persoCollapsed=(()=>{try{return JSON.parse(localStorage.getItem('perso_collapsed')||'{"inactive":true}');}catch(e){return {inactive:true};}})();

async function loadPersoAthletes(){
  // Reset à la vue liste
  document.getElementById('perso-list-view').style.display='';
  document.getElementById('perso-fiche-view').style.display='none';
  document.getElementById('perso-form-view').style.display='none';

  // MULTI-TENANT : filtrer par studio
  const _pStudioId=currentProfile?.studio_id??null;
  let _pq=sb.from('profiles').select('*');
  if(_pStudioId){_pq=_pq.eq('studio_id',_pStudioId);}
  else{_pq=_pq.is('studio_id',null);}
  const {data}=await _pq.order('full_name');
  persoAthletesCache=data||[];

  // Charger les favoris depuis la table dédiée coach_favorites
  const {data:favRows}=await sb.from('coach_favorites')
    .select('athlete_id')
    .eq('coach_id', currentUser.id);
  const favSet=new Set((favRows||[]).map(r=>r.athlete_id));
  persoAthletesCache.forEach(a=>{ a.coach_favorite=favSet.has(a.id); });

  // Compter + tracker la dernière date par athlète
  const {data:rows}=await sb.from('personal_sessions').select('athlete_id,date');
  personalSessionCounts={};
  personalLastDate={};
  (rows||[]).forEach(r=>{
    personalSessionCounts[r.athlete_id]=(personalSessionCounts[r.athlete_id]||0)+1;
    if(!personalLastDate[r.athlete_id] || r.date>personalLastDate[r.athlete_id]){
      personalLastDate[r.athlete_id]=r.date;
    }
  });
  renderPersoAthletes();
}
function filterPersoAthletes(){renderPersoAthletes();}
function renderPersoAthletes(){
  const q=(document.getElementById('perso-search')?.value||'').trim().toLowerCase();
  const el=document.getElementById('perso-athletes-list');
  if(!el)return;

  const all=persoAthletesCache.filter(a=>a.role!=='admin');

  // 3 buckets
  const favs=[]; const actifs=[]; const inactifs=[];
  all.forEach(a=>{
    const cnt=personalSessionCounts[a.id]||0;
    if(a.coach_favorite) favs.push(a);
    else if(cnt>0)       actifs.push(a);
    else                 inactifs.push(a);
  });
  const byName=(a,b)=>(a.full_name||'').localeCompare(b.full_name||'');
  favs.sort(byName);
  actifs.sort((a,b)=>{
    const da=personalLastDate[a.id]||'';
    const db=personalLastDate[b.id]||'';
    if(da!==db) return db.localeCompare(da);
    return byName(a,b);
  });
  inactifs.sort(byName);

  // Mode recherche : liste à plat, pas de sections
  if(q){
    const match=a=>(a.full_name||'').toLowerCase().includes(q)||(a.email||'').toLowerCase().includes(q);
    const flat=all.filter(match).sort((a,b)=>{
      if(!!b.coach_favorite - !!a.coach_favorite) return !!b.coach_favorite - !!a.coach_favorite;
      return byName(a,b);
    });
    el.innerHTML = _persoChipsHTML(favs.length,actifs.length,inactifs.length) +
      (flat.length ? flat.map(_renderPersoCard).join('')
                   : '<div class="empty"><p>Aucun athlète trouvé.</p></div>');
    return;
  }

  // Filtre par chip
  const visible=new Set();
  if(persoChip==='all'||persoChip==='fav') favs.forEach(a=>visible.add(a.id));
  if(persoChip==='all'||persoChip==='actifs') actifs.forEach(a=>visible.add(a.id));
  if(persoChip==='all'||persoChip==='inactifs') inactifs.forEach(a=>visible.add(a.id));

  const sec=(key,lbl,ic,icCls,list)=>{
    if(!list.length || !list.some(a=>visible.has(a.id))) return '';
    const collapsed=!!persoCollapsed[key];
    const body=collapsed?'':list.filter(a=>visible.has(a.id)).map(_renderPersoCard).join('');
    return `<div class="perso-section">
      <div class="perso-sec-bar ${collapsed?'collapsed':''} ${key}" onclick="togglePersoSection('${key}')">
        <span class="perso-sec-ic ${icCls}">${ic}</span>
        <span class="perso-sec-lb">${lbl}</span>
        <span class="perso-sec-ct">${list.length}</span>
        <span class="perso-sec-arr">▾</span>
      </div>
      <div class="perso-sec-body">${body}</div>
    </div>`;
  };

  let html =
    _persoChipsHTML(favs.length,actifs.length,inactifs.length) +
    sec('fav',     'Favoris',          '★', 'fav', favs) +
    sec('actifs',  'Actifs récents',   '🔥','act', actifs) +
    sec('inactive','Sans séance perso','○', 'oth', inactifs);

  if(!favs.length && !actifs.length && !inactifs.length){
    html += '<div class="empty"><p>Aucun athlète.</p></div>';
  }
  el.innerHTML = html;
}

function _persoChipsHTML(nFav,nAct,nIna){
  const c=(key,lbl,n,extra='')=>`<span class="perso-chip ${extra} ${persoChip===key?'on':''}" onclick="setPersoChip('${key}')">${lbl} <span class="n">${n}</span></span>`;
  return `<div class="perso-chips">
    ${c('all','Tous',nFav+nAct+nIna)}
    ${c('fav','★ Favoris',nFav,'fav')}
    ${c('actifs','Actifs',nAct)}
    ${c('inactifs','Sans séance',nIna)}
  </div>`;
}

function setPersoChip(chip){
  persoChip=chip;
  try{localStorage.setItem('perso_chip',chip);}catch(e){}
  if(chip!=='all'){
    const key = chip==='fav'?'fav':chip==='actifs'?'actifs':'inactive';
    persoCollapsed[key]=false;
    try{localStorage.setItem('perso_collapsed',JSON.stringify(persoCollapsed));}catch(e){}
  }
  renderPersoAthletes();
}

function togglePersoSection(key){
  persoCollapsed[key]=!persoCollapsed[key];
  try{localStorage.setItem('perso_collapsed',JSON.stringify(persoCollapsed));}catch(e){}
  renderPersoAthletes();
}

async function togglePersoFavorite(athleteId, ev){
  if(ev){ev.stopPropagation();ev.preventDefault();}
  const a=persoAthletesCache.find(x=>x.id===athleteId);
  if(!a)return;
  const next=!a.coach_favorite;
  a.coach_favorite=next;          // optimistic
  renderPersoAthletes();
  let error;
  if(next){
    ({error}=await sb.from('coach_favorites').insert({
      coach_id: currentUser.id,
      athlete_id: athleteId
    }));
  } else {
    ({error}=await sb.from('coach_favorites').delete()
      .eq('coach_id', currentUser.id)
      .eq('athlete_id', athleteId));
  }
  if(error){
    a.coach_favorite=!next;       // rollback
    renderPersoAthletes();
    if(typeof showToast==='function') showToast('❌ '+error.message);
    return;
  }
  if(typeof showToast==='function') showToast(next?'★ Ajouté aux favoris':'Retiré des favoris');
}

function _renderPersoCard(a){
  const init=(a.full_name||a.email||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const cnt=personalSessionCounts[a.id]||0;
  const last=personalLastDate[a.id];
  const fav=!!a.coach_favorite;
  let pill='';
  if(last){
    const d=_persoDaysAgo(last);
    pill=`<span class="perso-activity-pill ${d>=15?'warn':''}">${_persoRelLabel(d)}</span>`;
  }
  const sub = cnt>0
    ? `${cnt} séance${cnt>1?'s':''}${last?' · '+_persoRelLabel(_persoDaysAgo(last),true):''}`
    : escapeHtml(a.email||'aucune séance perso');
  return `<div class="perso-athlete-card${fav?' fav':''}" onclick="openPersoFiche('${a.id}')">
    <div class="athlete-avatar">${init}</div>
    <div class="perso-meta">
      <div class="perso-name">${escapeHtml(a.full_name||'—')}</div>
      <div class="perso-sub">${sub}</div>
    </div>
    ${pill}
    <button class="perso-fav-btn${fav?' on':''}" onclick="togglePersoFavorite('${a.id}',event)" aria-label="${fav?'Retirer des favoris':'Mettre en favori'}">${fav?'★':'☆'}</button>
    <div class="chev">›</div>
  </div>`;
}

function _persoDaysAgo(iso){
  const d=new Date(iso+'T12:00:00');
  return Math.floor((Date.now()-d.getTime())/86400000);
}
function _persoRelLabel(d,long){
  if(d<=0) return long?'aujourd\'hui':'auj.';
  if(d===1) return long?'hier':'1j';
  if(d<30)  return long?'il y a '+d+'j':d+'j';
  return long?'> 30j':'30+';
}

async function openPersoFiche(athleteId,targetDate){
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
  if(targetDate){const now=new Date(),day=now.getDay();const monNow=new Date(now);monNow.setDate(now.getDate()-(day===0?6:day-1));monNow.setHours(0,0,0,0);const tgt=new Date(targetDate+'T12:00:00'),tgtDay=tgt.getDay();const monTgt=new Date(tgt);monTgt.setDate(tgt.getDate()-(tgtDay===0?6:tgtDay-1));monTgt.setHours(0,0,0,0);persoOffset=Math.round((monTgt-monNow)/(7*24*60*60*1000));}else{persoOffset=0;}
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
    // === RETOURS ATHLÈTE : scores + notes + wellness pour la semaine ===
    const _sidsW=(data||[]).filter(s=>s.type!=='separator').map(s=>s.id);
    await loadPersoRetours(_sidsW,currentPersoAthlete.id,isos);
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
          ${persoRetourBlock(s.id, iso)}
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
    // === RETOURS ATHLÈTE : indicateurs sur les pills du mois ===
    const _sidsM=(data||[]).filter(s=>s.type!=='separator').map(s=>s.id);
    await loadPersoRetours(_sidsM,currentPersoAthlete.id,isos);
    const tNow=new Date();const today=`${tNow.getFullYear()}-${String(tNow.getMonth()+1).padStart(2,'0')}-${String(tNow.getDate()).padStart(2,'0')}`;
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

/* ============================================================
 * RETOURS ATHLÈTE — Espace perso (Option 01 : IN SITU)
 * Strip de badges + drawer inline sous chaque bloc séance
 * Sources : wod_scores · session_notes · wellness_entries
 * ============================================================ */
let _persoRetoursCache={scoresBySid:{},notesBySid:{},wellnessByDate:{}};

async function loadPersoRetours(sessionIds,athleteId,isos){
  _persoRetoursCache={scoresBySid:{},notesBySid:{},wellnessByDate:{}};
  if(!athleteId)return;
  try{
    if(sessionIds&&sessionIds.length){
      const {data:scores}=await sb.from('wod_scores')
        .select('id,session_id,score_value,score_text,score_type,level,sets_data,created_at')
        .eq('athlete_id',athleteId).in('session_id',sessionIds);
      (scores||[]).forEach(sc=>{_persoRetoursCache.scoresBySid[sc.session_id]=sc;});
      const {data:notes}=await sb.from('session_notes')
        .select('id,session_id,content,created_at')
        .eq('athlete_id',athleteId).in('session_id',sessionIds);
      (notes||[]).forEach(n=>{_persoRetoursCache.notesBySid[n.session_id]=n;});
    }
    if(isos&&isos.length){
      const {data:well}=await sb.from('wellness_entries')
        .select('date,sleep_quality,energy,fatigue,soreness,motivation,stress,notes')
        .eq('athlete_id',athleteId).in('date',isos);
      (well||[]).forEach(w=>{_persoRetoursCache.wellnessByDate[w.date]=w;});
    }
  }catch(e){console.warn('perso retours load',e);}
}

function _persoWellMean(e){
  if(!e)return null;
  const inv={fatigue:1,soreness:1,stress:1};
  const vals=[];
  ['sleep_quality','energy','fatigue','soreness','motivation','stress'].forEach(k=>{
    if(typeof e[k]==='number')vals.push(inv[k]?11-e[k]:e[k]);
  });
  if(!vals.length)return null;
  return vals.reduce((a,b)=>a+b,0)/vals.length;
}
function _persoWellTone(e){
  if(!e)return '';
  const red=['fatigue','soreness','stress'].some(k=>typeof e[k]==='number'&&e[k]>=8)
         ||['energy','motivation','sleep_quality'].some(k=>typeof e[k]==='number'&&e[k]<=3);
  if(red)return 'red';
  const ora=['fatigue','soreness','stress'].some(k=>typeof e[k]==='number'&&e[k]>=6)
         ||['energy','motivation','sleep_quality'].some(k=>typeof e[k]==='number'&&e[k]<=5);
  return ora?'ora':'';
}

function persoRetourBlock(sid,iso){
  const sc=_persoRetoursCache.scoresBySid[sid];
  const nt=_persoRetoursCache.notesBySid[sid];
  const w =_persoRetoursCache.wellnessByDate[iso];
  if(!sc&&!nt&&!w){
    return `<div class="perso-retour-strip empty" onclick="event.stopPropagation()"><span class="perso-r-pill miss">— pas encore de retour</span></div>`;
  }
  const pills=[];
  if(sc){
    let v=sc.score_text||(typeof sc.score_value==='number'?sc.score_value:'');
    v=String(v||'').slice(0,16);
    pills.push(`<span class="perso-r-pill score" title="Score athlète">✓ <span class="v">${escapeHtml(v)||'fait'}</span></span>`);
  }
  if(nt)pills.push(`<span class="perso-r-pill note" title="Note de séance">📝 note</span>`);
  if(w){
    const mean=_persoWellMean(w);
    const tone=_persoWellTone(w);
    if(mean!=null)pills.push(`<span class="perso-r-pill well ${tone}" title="Wellness du jour">💪 <span class="v">${mean.toFixed(1)}</span></span>`);
  }
  return `
    <div class="perso-retour-strip" onclick="event.stopPropagation();togglePersoRetour('${sid}')">
      ${pills.join('')}
      <span class="perso-r-tog">›</span>
    </div>
    <div class="perso-r-drawer" id="perso-r-d-${sid}" onclick="event.stopPropagation()">
      ${_persoDrawerInner(sc,nt,w)}
    </div>`;
}

function _persoDrawerInner(sc,nt,w){
  const rows=[];
  if(sc){
    let scoreV=sc.score_text||(typeof sc.score_value==='number'?sc.score_value:'—');
    let scoreHtml=`<b>${escapeHtml(String(scoreV))}</b>`;
    if(sc.level)scoreHtml+=` <span class="lvl">${escapeHtml(String(sc.level).toUpperCase())}</span>`;
    let setsHtml='';
    try{
      const sd=sc.sets_data?(typeof sc.sets_data==='string'?JSON.parse(sc.sets_data):sc.sets_data):null;
      if(Array.isArray(sd)&&sd.length){
        setsHtml=`<div class="sets">${sd.map(s=>`S${s.set}: ${s.value}${s.unit||'kg'}`).join(' · ')}</div>`;
      }
    }catch(e){}
    rows.push(`<div class="perso-r-row"><div class="lbl">Score</div><div class="val">${scoreHtml}${setsHtml}</div></div>`);
  }
  if(nt){
    rows.push(`<div class="perso-r-row"><div class="lbl">Note</div><div class="val note">${escapeHtml(nt.content||'')}</div></div>`);
  }
  if(w){
    const tone=(k,inv)=>{
      const v=w[k];if(typeof v!=='number')return '';
      if(inv){if(v>=7)return 'r';if(v>=5)return 'o';return 'g';}
      if(v<=3)return 'r';if(v<=5)return 'o';return 'g';
    };
    const meta=[['sleep_quality','😴',false],['energy','🔥',false],['fatigue','💤',true],['soreness','🤕',true],['motivation','🎯',false],['stress','😰',true]];
    const chips=meta.filter(m=>typeof w[m[0]]==='number')
                    .map(([k,ic,inv])=>`<span class="c ${tone(k,inv)}">${ic} ${w[k]}</span>`).join('');
    const wnotes=w.notes?`<div class="wnotes">« ${escapeHtml(w.notes)} »</div>`:'';
    rows.push(`<div class="perso-r-row"><div class="lbl">Wellness</div><div class="val"><div class="perso-well-chips">${chips}</div>${wnotes}</div></div>`);
  }
  if(!rows.length){
    rows.push(`<div class="perso-r-row"><div class="val" style="color:var(--muted);font-style:italic">Pas encore de retour pour cette séance.</div></div>`);
  }
  return `<div class="perso-r-eb">Retour athlète</div>${rows.join('')}`;
}

function togglePersoRetour(sid){
  const el=document.getElementById('perso-r-d-'+sid);
  if(!el)return;
  const open=el.classList.toggle('open');
  const strip=el.previousElementSibling;
  if(strip&&strip.classList.contains('perso-retour-strip'))strip.classList.toggle('open',open);
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

let persoSessionToDuplicate=null;

async function persoDuplicateSession(id){
  const {data,error}=await sb.from('personal_sessions').select('*').eq('id',id).single();
  if(error||!data){showToast('❌ Séance introuvable');return;}
  persoSessionToDuplicate=data;
  document.getElementById('dup-perso-session-name').textContent=data.title||'Séance';
  // Pré-remplir avec la date de la séance source (= comportement "même jour" par défaut)
  document.getElementById('dup-perso-date').value=data.date;
  await populatePersoDupAthletes(data.athlete_id);
  document.getElementById('dup-perso-modal').classList.add('open');
}

// Remplit le sélecteur d'athlète de destination (défaut = athlète source)
async function populatePersoDupAthletes(selectedId){
  const sel=document.getElementById('dup-perso-athlete');
  if(!sel)return;
  let list=persoAthletesCache.filter(a=>a.role!=='admin');
  if(!list.length){
    // Fallback : charger les profils du studio si le cache est vide
    const _sid=currentProfile?.studio_id??null;
    let q=sb.from('profiles').select('id,full_name,role');
    q=_sid?q.eq('studio_id',_sid):q.is('studio_id',null);
    const {data}=await q.order('full_name');
    list=(data||[]).filter(a=>a.role!=='admin');
  }
  // Garantir la présence de l'athlète source
  if(selectedId&&!list.find(a=>a.id===selectedId)){
    const src=persoAthletesCache.find(a=>a.id===selectedId);
    if(src)list=[src,...list];
  }
  list.sort((a,b)=>(a.full_name||'').localeCompare(b.full_name||''));
  sel.innerHTML=list.map(a=>`<option value="${a.id}"${a.id===selectedId?' selected':''}>${escapeHtml(a.full_name||'Athlète')}</option>`).join('');
}

function closeDupPersoModal(){
  document.getElementById('dup-perso-modal').classList.remove('open');
  persoSessionToDuplicate=null;
}

function formatDateShort(iso){
  if(!iso)return'';
  const d=new Date(iso+'T12:00:00');
  return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
}

async function confirmPersoDuplicate(){
  if(!persoSessionToDuplicate)return;
  const newDate=document.getElementById('dup-perso-date').value;
  if(!newDate){showToast('⚠️ Choisis une date');return;}
  const data=persoSessionToDuplicate;
  // Athlète de destination (par défaut : athlète source)
  const sel=document.getElementById('dup-perso-athlete');
  const targetAthleteId=(sel&&sel.value)?sel.value:data.athlete_id;
  const sameAthlete=targetAthleteId===data.athlete_id;
  const {id:_id,created_at,athlete_id:_aid,...rest}=data;
  let newOrder;
  if(sameAthlete){
    // Calcul du sort_order : on place la copie en fin de journée cible
    // (si même jour que la source, juste après l'originale ; sinon en queue du jour cible)
    const sameDay=persoSessionsCache.filter(s=>s.date===newDate).sort((a,b)=>(a.sort_order??999)-(b.sort_order??999));
    if(newDate===data.date){
      // Même jour : on insère juste après l'originale et on décale les suivantes
      const idx=sameDay.findIndex(s=>s.id===data.id);
      newOrder=idx>=0?(sameDay[idx].sort_order??idx)+1:9999;
      if(idx>=0){
        const toShift=sameDay.slice(idx+1);
        await Promise.all(toShift.map((s,i)=>sb.from('personal_sessions').update({sort_order:newOrder+1+i}).eq('id',s.id)));
      }
    } else {
      // Jour différent : on ajoute en fin de la journée cible
      const last=sameDay.length?(sameDay[sameDay.length-1].sort_order??sameDay.length-1):-1;
      newOrder=last+1;
    }
  } else {
    // Autre athlète : on place en fin de la journée cible de cet athlète
    const {data:tgtRows}=await sb.from('personal_sessions').select('sort_order').eq('athlete_id',targetAthleteId).eq('date',newDate);
    const maxOrder=(tgtRows||[]).reduce((m,r)=>Math.max(m,r.sort_order??-1),-1);
    newOrder=maxOrder+1;
  }
  const payload={...rest,athlete_id:targetAthleteId,date:newDate,sort_order:newOrder,created_by:currentUser.id};
  const {error}=await sb.from('personal_sessions').insert(payload);
  if(error){showToast('❌ '+error.message);return;}
  let who='';
  if(!sameAthlete){
    const ath=persoAthletesCache.find(a=>a.id===targetAthleteId);
    who=' → '+((ath&&ath.full_name)||'athlète');
  }
  showToast((newDate===data.date?'📋 Séance dupliquée':'📋 Séance dupliquée au '+formatDateShort(newDate))+who);
  closeDupPersoModal();
  renderPersoCalendar();
}

// ===== DUPLIQUER UNE SEMAINE ENTIÈRE (espace perso) — V2 =====
function openDupPersoWeekModal(){
  if(persoView!=='week'){showToast('⚠️ Passe en vue semaine d\'abord');return;}
  const dates=getWeekDates(persoOffset);
  const wk=getWeekNum(dates[0]);
  document.getElementById('dup-perso-week-source-label').textContent=`Sem. ${wk} — ${MONTHS[dates[0].getMonth()]} ${dates[0].getFullYear()}`;
  // Reset à destination "même perso"
  const destSel=document.getElementById('dup-perso-dest-type');
  if(destSel) destSel.value='same';
  document.getElementById('dup-perso-same-group').style.display='';
  document.getElementById('dup-perso-athlete-group').style.display='none';
  document.getElementById('dup-perso-prog-group').style.display='none';
  // Date cible par défaut = lundi semaine suivante
  const nextMon=new Date(dates[0]);nextMon.setDate(dates[0].getDate()+7);
  const nextMonStr=nextMon.toISOString().split('T')[0];
  document.getElementById('dup-perso-week-target-date').value=nextMonStr;
  document.getElementById('dup-perso-athlete-target-date').value=nextMonStr;
  // Remplir athlètes (tous sauf l'athlète courant)
  const athletes=persoAthletesCache.filter(a=>a.role!=='admin'&&a.id!==currentPersoAthlete?.id);
  document.getElementById('dup-perso-target-athlete').innerHTML=athletes.length
    ? athletes.map(a=>`<option value="${a.id}">${a.full_name||a.email||a.id}</option>`).join('')
    : '<option value="">— Aucun autre athlète —</option>';
  // Remplir programmes
  const progs=window.programmes||[];
  document.getElementById('dup-perso-target-prog').innerHTML=progs.length
    ? progs.map(p=>`<option value="${p.id}" data-type="${p.type||''}" data-weeks="${p.total_weeks||0}">${p.icon||'💪'} ${p.name}</option>`).join('')
    : '<option value="">— Aucun programme —</option>';
  if(progs.length) onDupPersoProgChange();
  document.getElementById('dup-perso-week-modal').classList.add('open');
}
function closeDupPersoWeekModal(){
  document.getElementById('dup-perso-week-modal')?.classList.remove('open');
}
function onDupPersoDestChange(){
  const dest=document.getElementById('dup-perso-dest-type').value;
  document.getElementById('dup-perso-same-group').style.display=dest==='same'?'':'none';
  document.getElementById('dup-perso-athlete-group').style.display=dest==='other_athlete'?'':'none';
  document.getElementById('dup-perso-prog-group').style.display=dest==='prog'?'':'none';
}
function onDupPersoProgChange(){
  const sel=document.getElementById('dup-perso-target-prog');
  const opt=sel.selectedOptions[0];
  if(!opt)return;
  const type=opt.getAttribute('data-type');
  const weeks=parseInt(opt.getAttribute('data-weeks')||'0');
  const oneshotDiv=document.getElementById('dup-perso-prog-oneshot');
  const dateDiv=document.getElementById('dup-perso-prog-date');
  if(type==='oneshot'&&weeks>0){
    oneshotDiv.style.display='';
    dateDiv.style.display='none';
    document.getElementById('dup-perso-prog-target-week').innerHTML=
      Array.from({length:weeks},(_,i)=>`<option value="${i+1}">Semaine ${i+1}</option>`).join('');
  } else {
    oneshotDiv.style.display='none';
    dateDiv.style.display='';
    const dates=getWeekDates(persoOffset);
    const nextMon=new Date(dates[0]);nextMon.setDate(dates[0].getDate()+7);
    document.getElementById('dup-perso-prog-target-date').value=nextMon.toISOString().split('T')[0];
  }
}
async function confirmDupPersoWeekV2(){
  if(!currentPersoAthlete)return;
  const dest=document.getElementById('dup-perso-dest-type').value;
  const btn=document.getElementById('dup-perso-confirm-btn');
  if(btn){btn.disabled=true;btn.textContent='Copie...';}
  try{
    const srcMon=getWeekDates(persoOffset)[0];
    const srcDates=getWeekDates(persoOffset).map(d=>d.toISOString().split('T')[0]);
    const {data,error}=await sb.from('personal_sessions').select('*').eq('athlete_id',currentPersoAthlete.id).in('date',srcDates);
    if(error){showToast('❌ '+error.message);return;}
    if(!data||!data.length){showToast('⚠️ Aucune séance à copier');return;}

    if(dest==='same'){
      const tgtDateStr=document.getElementById('dup-perso-week-target-date').value;
      if(!tgtDateStr){showToast('⚠️ Choisis une date');return;}
      const tgtPicked=new Date(tgtDateStr+'T12:00:00');
      const tgtDay=tgtPicked.getDay();
      const tgtMon=new Date(tgtPicked);tgtMon.setDate(tgtPicked.getDate()-(tgtDay===0?6:tgtDay-1));
      const diffDays=Math.round((tgtMon-srcMon)/(24*60*60*1000));
      if(diffDays===0){showToast('⚠️ Choisis une semaine différente');return;}
      const rows=data.map(({id,created_at,...rest})=>{
        const d=new Date(rest.date+'T12:00:00');d.setDate(d.getDate()+diffDays);
        return{...rest,date:d.toISOString().split('T')[0],created_by:currentUser.id};
      });
      const {error:e2}=await sb.from('personal_sessions').insert(rows);
      if(e2){showToast('❌ '+e2.message);return;}
      showToast(`✅ ${rows.length} séance${rows.length>1?'s':''} copiée${rows.length>1?'s':''}`);
      closeDupPersoWeekModal();
      const now=new Date();const nowDay=now.getDay();
      const nowMon=new Date(now);nowMon.setDate(now.getDate()-(nowDay===0?6:nowDay-1));nowMon.setHours(0,0,0,0);
      tgtMon.setHours(0,0,0,0);
      persoOffset=Math.round((tgtMon-nowMon)/(7*24*60*60*1000));
      renderPersoCalendar();

    } else if(dest==='other_athlete'){
      const tgtAthId=document.getElementById('dup-perso-target-athlete').value;
      if(!tgtAthId){showToast('⚠️ Aucun athlète sélectionné');return;}
      const tgtDateStr=document.getElementById('dup-perso-athlete-target-date').value;
      if(!tgtDateStr){showToast('⚠️ Choisis une date');return;}
      const tgtPicked=new Date(tgtDateStr+'T12:00:00');
      const tgtDay=tgtPicked.getDay();
      const tgtMon=new Date(tgtPicked);tgtMon.setDate(tgtPicked.getDate()-(tgtDay===0?6:tgtDay-1));
      const diffDays=Math.round((tgtMon-srcMon)/(24*60*60*1000));
      const rows=data.map(({id,created_at,...rest})=>{
        const d=new Date(rest.date+'T12:00:00');d.setDate(d.getDate()+diffDays);
        return{...rest,athlete_id:tgtAthId,date:d.toISOString().split('T')[0],created_by:currentUser.id};
      });
      const {error:e2}=await sb.from('personal_sessions').insert(rows);
      if(e2){showToast('❌ '+e2.message);return;}
      const ath=persoAthletesCache.find(a=>a.id===tgtAthId);
      showToast(`✅ ${rows.length} séance${rows.length>1?'s':''} → ${ath?.full_name||'athlète'}`);
      closeDupPersoWeekModal();

    } else if(dest==='prog'){
      const tgtProgId=document.getElementById('dup-perso-target-prog').value;
      if(!tgtProgId){showToast('⚠️ Aucun programme sélectionné');return;}
      const tgtProg=getProgById(tgtProgId);
      const tgtOneshot=isOneshotProg(tgtProg);
      let rows;
      if(tgtOneshot){
        const tgtWeek=parseInt(document.getElementById('dup-perso-prog-target-week').value);
        if(!tgtWeek){showToast('⚠️ Choisis une semaine');return;}
        rows=data.map(({id,created_at,athlete_id,...rest})=>{
          const d=new Date(rest.date+'T12:00:00');
          const dow=d.getDay()===0?7:d.getDay(); // 1=Lun … 7=Dim
          return{...rest,programme_id:tgtProgId,week_number:tgtWeek,day_of_week:dow,date:null,created_by:currentUser.id};
        });
      } else {
        const tgtDateStr=document.getElementById('dup-perso-prog-target-date').value;
        if(!tgtDateStr){showToast('⚠️ Choisis une date cible');return;}
        const tgtPicked=new Date(tgtDateStr+'T12:00:00');
        const tgtDay=tgtPicked.getDay();
        const tgtMon=new Date(tgtPicked);tgtMon.setDate(tgtPicked.getDate()-(tgtDay===0?6:tgtDay-1));
        const diffDays=Math.round((tgtMon-srcMon)/(24*60*60*1000));
        rows=data.map(({id,created_at,athlete_id,...rest})=>{
          const d=new Date(rest.date+'T12:00:00');d.setDate(d.getDate()+diffDays);
          return{...rest,programme_id:tgtProgId,date:d.toISOString().split('T')[0],created_by:currentUser.id};
        });
      }
      const {error:e2}=await sb.from('sessions').insert(rows);
      if(e2){showToast('❌ '+e2.message);return;}
      showToast(`✅ ${rows.length} séance${rows.length>1?'s':''} → ${tgtProg.name}`);
      closeDupPersoWeekModal();
    }
  } finally {
    if(btn){btn.disabled=false;btn.textContent='📋 Dupliquer la semaine';}
  }
}
// Alias rétrocompat
async function confirmDupPersoWeek(){ return confirmDupPersoWeekV2(); }

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
// FICHE ATHLÈTE (onglet Athlètes)
// ============================================
async function openAdminAthleteCard(id){
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

// ============================================
// DASHBOARD — liste athlètes + fiche enrichie
// ============================================
let _dashAllAthletes=[];
let _dashCurrentAthleteId=null;
let _dashCurrentCat='all';
let _dashPRsData=[];      // [{mid, name, cat, unit, series, last}]
let _dashBenchData=[];    // [{id, name, cat, scores:[]}]

async function loadDashboard(){
  const studioId=getStudioId();
  let q=sb.from('profiles').select('id,full_name,email,avatar_url,created_at').eq('role','athlete');
  if(studioId){q=q.eq('studio_id',studioId);}else{q=q.is('studio_id',null);}
  const {data}=await q.order('full_name');
  _dashAllAthletes=data||[];
  _renderDashList(_dashAllAthletes);
  document.getElementById('dash-athletes-view').style.display='';
  document.getElementById('dash-fiche-view').style.display='none';
}

function _renderDashList(athletes){
  const list=document.getElementById('dash-athletes-list');
  if(!athletes.length){list.innerHTML='<div style="color:var(--muted);font-size:13px;padding:8px 0">Aucun athlète.</div>';return;}
  list.innerHTML=athletes.map(p=>{
    const init=_initials(p.full_name||p.email);
    const since=p.created_at?new Date(p.created_at).toLocaleDateString('fr-FR',{month:'short',year:'numeric'}):'';
    return`<div class="athlete-row" style="cursor:pointer" onclick="dashOpenFiche('${p.id}')">
      <div class="athlete-avatar">${init}</div>
      <div style="flex:1;min-width:0">
        <div class="athlete-name">${escapeHtml(p.full_name||'—')}</div>
        <div class="athlete-email">${escapeHtml(p.email||'')}${since?' · depuis '+since:''}</div>
      </div>
      <span style="color:var(--muted);font-size:18px">›</span>
    </div>`;
  }).join('');
}

function dashFilterAthletes(){
  const q=(document.getElementById('dash-search-input')?.value||'').toLowerCase();
  if(!q){_renderDashList(_dashAllAthletes);return;}
  _renderDashList(_dashAllAthletes.filter(a=>(a.full_name||'').toLowerCase().includes(q)||(a.email||'').toLowerCase().includes(q)));
}

async function dashOpenFiche(id){
  _dashCurrentAthleteId=id;
  _dashCurrentCat='all';
  document.getElementById('dash-athletes-view').style.display='none';
  document.getElementById('dash-fiche-view').style.display='';
  document.getElementById('page-admin').scrollTop=0;
  // Reset filtre
  document.querySelectorAll('#df-cats .cat-btn').forEach(b=>b.classList.toggle('active',b.dataset.dfcat==='all'));

  const {data:p}=await sb.from('profiles').select('*').eq('id',id).single();
  if(!p)return;
  document.getElementById('df-avatar').textContent=_initials(p.full_name||p.email);
  document.getElementById('df-name').textContent=(p.full_name||'—').toUpperCase();
  const since=p.created_at?new Date(p.created_at).toLocaleDateString('fr-FR',{month:'short',year:'numeric'}):'';
  document.getElementById('df-sub').textContent=`${p.email||''}${since?' · depuis '+since:''}`;

  await Promise.all([
    _dashLoadStats(id),
    _dashLoadBadges(id),
    _dashLoadPRsAndBench(id),
  ]);
}

function dashCloseFiche(){
  document.getElementById('dash-fiche-view').style.display='none';
  document.getElementById('dash-athletes-view').style.display='';
  document.getElementById('page-admin').scrollTop=0;
}

async function _dashLoadStats(id){
  // Tous les scores de l'athlète
  const {data:scores}=await sb.from('wod_scores').select('level,session_id').eq('athlete_id',id);
  const all=scores||[];

  // Filtrer sur sessions type=wod uniquement (pas de FK → deux requêtes + join JS)
  const sessionIds=[...new Set(all.map(s=>s.session_id).filter(Boolean))];
  const wodSessionIds=new Set();
  if(sessionIds.length){
    const {data:sessions}=await sb.from('sessions').select('id,type').in('id',sessionIds);
    (sessions||[]).forEach(s=>{if(s.type==='wod')wodSessionIds.add(s.id);});
  }
  const wodScores=all.filter(s=>s.session_id&&wodSessionIds.has(s.session_id));
  const total=wodScores.length;

  const counts={rx:0,intermediate:0,scaled:0,foundation:0};
  wodScores.forEach(s=>{if(counts[s.level]!==undefined)counts[s.level]++;});
  const pct=lvl=>total?Math.round(counts[lvl]/total*100)+'%':'—';
  document.getElementById('df-total').textContent=all.length; // total tous types
  document.getElementById('df-rx').textContent=pct('rx');
  document.getElementById('df-inter').textContent=pct('intermediate');
  document.getElementById('df-scaled').textContent=pct('scaled');
  document.getElementById('df-fond').textContent=pct('foundation');
}

async function _dashLoadBadges(id){
  const wrap=document.getElementById('df-badges');
  wrap.innerHTML='<div style="color:var(--muted);font-size:12px">Chargement…</div>';
  const {data:ab}=await sb.from('athlete_badges').select('badge_id,badges(*)').eq('athlete_id',id);
  const badges=(ab||[]).map(x=>x.badges).filter(Boolean);
  if(!badges.length){wrap.innerHTML='<div style="color:var(--muted);font-size:12px">Aucun badge.</div>';return;}
  const RARITY={bronze:{color:'#cd7f32',stars:1},silver:{color:'#c0c0c0',stars:2},gold:{color:'#ffd700',stars:3},legendary:{color:'#e8ff47',stars:4}};
  wrap.innerHTML=badges.map(b=>{
    const r=RARITY[(b.rarity||'bronze').toLowerCase()]||RARITY.bronze;
    return`<div title="${escapeHtml(b.name)}" style="
      display:flex;flex-direction:column;align-items:center;gap:3px;
      background:rgba(255,255,255,0.04);border:1px solid ${r.color}44;
      border-radius:12px;padding:8px 10px;min-width:52px">
      <div style="font-size:24px">${b.icon||'🏅'}</div>
      <div style="font-size:9px;color:${r.color};font-weight:700;text-align:center;max-width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(b.name)}</div>
    </div>`;
  }).join('');
}

async function _dashLoadPRsAndBench(id){
  // PRs
  const {data:prs}=await sb.from('athlete_prs')
    .select('movement_id,value,recorded_at,format,created_at')
    .eq('athlete_id',id).order('recorded_at',{ascending:true,nullsFirst:false});
  const prRows=prs||[];
  const byMov={};
  prRows.forEach(pr=>{(byMov[pr.movement_id]=byMov[pr.movement_id]||[]).push(pr);});
  const movIds=Object.keys(byMov);
  let movMeta={};
  if(movIds.length){
    const {data:m}=await sb.from('movements').select('id,name,unit,category').in('id',movIds);
    (m||[]).forEach(x=>{movMeta[x.id]={name:x.name,unit:x.unit||'',cat:x.category||'autre'};});
  }
  _dashPRsData=movIds.map(mid=>{
    const series=byMov[mid].slice().sort((a,b)=>((a.recorded_at||a.created_at||'')+'').localeCompare((b.recorded_at||b.created_at||'')+'')); 
    return{mid,name:movMeta[mid]?.name||'—',cat:movMeta[mid]?.cat||'autre',unit:movMeta[mid]?.unit||'',series,last:series[series.length-1],type:'pr'};
  });

  // Benchmarks
  const {data:bscores}=await sb.from('benchmark_scores').select('benchmark_id,score_value,score_text,recorded_at,level').eq('athlete_id',id).order('recorded_at',{ascending:true});
  const bRows=bscores||[];
  const byBench={};
  bRows.forEach(s=>{(byBench[s.benchmark_id]=byBench[s.benchmark_id]||[]).push(s);});
  const benchIds=Object.keys(byBench);
  let benchMeta={};
  if(benchIds.length){
    const {data:bm}=await sb.from('benchmarks').select('id,name,category').in('id',benchIds);
    (bm||[]).forEach(x=>{benchMeta[x.id]={name:x.name,cat:x.category||'custom'};});
  }
  _dashBenchData=benchIds.map(bid=>{
    const series=byBench[bid];
    return{bid,name:benchMeta[bid]?.name||'—',cat:benchMeta[bid]?.cat||'custom',series,last:series[series.length-1],type:'bench'};
  });

  _dashRenderPRs();
}

function dashFilterPRCat(cat,btn){
  _dashCurrentCat=cat;
  document.querySelectorAll('#df-cats .cat-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  _dashRenderPRs();
}

const _BENCH_CATS_SET=new Set(['girl','test','hero','custom']);

function _dashRenderPRs(){
  const wrap=document.getElementById('df-prs-list');
  const cat=_dashCurrentCat;

  // filtrer PRs mouvements
  let prs=_dashPRsData;
  let bench=_dashBenchData;
  if(cat!=='all'){
    if(_BENCH_CATS_SET.has(cat)){
      prs=[];
      bench=bench.filter(b=>b.cat===cat);
    }else{
      prs=prs.filter(p=>p.cat===cat);
      bench=[];
    }
  }

  if(!prs.length&&!bench.length){
    wrap.innerHTML='<div style="color:var(--muted);font-size:13px;padding:12px 0">Aucun résultat dans cette catégorie.</div>';
    return;
  }

  const CAT_LABELS_LOCAL={haltero:'Haltérophilie',force:'Force',gymnastic:'Gymnastics',cardio:'Cardio',autre:'Autre'};

  const prHtml=prs.map(it=>{
    const {series,last,unit,name}=it;
    const first=series[0]?.value;
    const lastV=last.value;
    const isTime=unit==='s'||unit==='min';
    const delta=(typeof first==='number'&&typeof lastV==='number')?(lastV-first):null;
    const trend=delta==null?'':(isTime?(delta>0?'down':'up'):(delta>0?'up':'down'));
    const deltaTxt=!delta?'':(isTime
      ?(delta>0?`+${Math.abs(delta).toFixed(0)}${unit}`:`-${Math.abs(delta).toFixed(0)}${unit}`)
      :(delta>0?`+${Math.abs(delta).toFixed(1)}${unit}`:`-${Math.abs(delta).toFixed(1)}${unit}`));
    const color=delta==null?'var(--accent)':(trend==='up'?'#47ff8c':'#ff8c47');
    const valTxt=lastV+(unit||'');
    const points=_sparkPoints(series.map(s=>s.value),isTime?'time':'val');
    return`<div class="afiche-pr">
      <div class="afiche-pr-head">
        <div>
          <div class="afiche-pr-name">${escapeHtml(name)}${last.format?` <span style="color:var(--muted);font-size:11px">· ${escapeHtml(last.format)}</span>`:''}
            <span style="color:var(--muted);font-size:10px;margin-left:4px">${CAT_LABELS_LOCAL[it.cat]||it.cat}</span>
          </div>
          ${deltaTxt?`<div class="afiche-pr-trend ${trend==='down'?'down':''}">${deltaTxt} · ${series.length} entrée${series.length>1?'s':''}</div>`:''}
        </div>
        <div class="afiche-pr-val">${escapeHtml(String(valTxt))}</div>
      </div>
      <svg class="afiche-spark" viewBox="0 0 300 32" preserveAspectRatio="none">
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>
      </svg>
    </div>`;
  }).join('');

  const BENCH_CAT_LABELS={girl:'Girl WOD',test:'Test Force',hero:'Hero WOD',custom:'Custom'};
  const benchHtml=bench.map(it=>{
    const {series,last,name}=it;
    const lastVal=last.score_text||last.score_value||'—';
    const levelColor={rx:'var(--accent)',intermediate:'var(--red)',scaled:'var(--blue)',foundation:'var(--purple)'}[last.level]||'var(--muted)';
    return`<div class="afiche-pr">
      <div class="afiche-pr-head">
        <div>
          <div class="afiche-pr-name">${escapeHtml(name)}
            <span style="color:var(--muted);font-size:10px;margin-left:4px">${BENCH_CAT_LABELS[it.cat]||it.cat}</span>
          </div>
          <div class="afiche-pr-trend">${series.length} score${series.length>1?'s':''} · <span style="color:${levelColor}">${(last.level||'').toUpperCase()}</span></div>
        </div>
        <div class="afiche-pr-val">${escapeHtml(String(lastVal))}</div>
      </div>
    </div>`;
  }).join('');

  wrap.innerHTML=(prs.length?`<div style="font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:2px;color:var(--muted);margin-bottom:8px">PR MOUVEMENTS</div>${prHtml}`:'')
    +(bench.length?`<div style="font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:2px;color:var(--muted);margin:${prs.length?'16px':0} 0 8px">BENCHMARKS</div>${benchHtml}`:'');
}

// Ouvre la fiche athlète depuis le dashboard (legacy — redirige vers dashOpenFiche)
async function openAthleteFicheFromDash(id){
  const tabBtn=document.querySelector('.admin-tab-btn[onclick*="dashboard"]');
  if(tabBtn)adminTab('dashboard',tabBtn);
  await dashOpenFiche(id);
}

async function _loadAthleteCardStats(id){
  const today=new Date();
  const wkStart=_weekStart(today);
  const monthStart=new Date(today.getFullYear(),today.getMonth(),1);

  // wod_scores : on récupère les 30 derniers jours en se basant sur done_at
  // (date saisie par l'athlète) avec fallback sur created_at si la colonne
  // n'existe pas encore.
  const isoWeek=_isoDate(wkStart);
  const isoMonth=_isoDate(monthStart);
  const last30=_addDays(today,-30);
  const iso30=_isoDate(last30);
  let weekDone=[];
  let monthCount=0;
  let scores30=[];
  try{
    // Tentative avec done_at
    let res=await sb.from('wod_scores').select('session_id,created_at,done_at')
      .eq('athlete_id',id)
      .or(`done_at.gte.${iso30},and(done_at.is.null,created_at.gte.${last30.toISOString()})`);
    // Si done_at n'existe pas, fallback sur created_at uniquement
    if(res.error && /done_at/.test(res.error.message||'')){
      res=await sb.from('wod_scores').select('session_id,created_at')
        .eq('athlete_id',id)
        .gte('created_at',last30.toISOString());
    }
    if(res.error)console.warn('wod_scores fetch',res.error);
    scores30=res.data||[];
    // Date effective : done_at sinon date locale de created_at
    const scoresWithDay=scores30.map(s=>({
      ...s,
      _day: s.done_at || (s.created_at ? _isoDate(new Date(s.created_at)) : null)
    })).filter(s=>s._day);
    const monthScores=scoresWithDay.filter(s=>s._day>=isoMonth);
    monthCount=monthScores.length;
    weekDone=monthScores.filter(s=>s._day>=isoWeek);
    // Pour l'assiduité on garde tous ceux dans la fenêtre 30j
    scores30=scoresWithDay;
  }catch(e){console.warn('wod_scores fetch',e);}

  document.getElementById('ac-week').textContent=weekDone.length;
  document.getElementById('ac-month').textContent=monthCount;
  // assiduité : nb jours uniques avec au moins 1 wod / 30 derniers jours
  let attendance='0%';
  if(scores30.length){
    const days=new Set(scores30.map(s=>s._day));
    attendance=Math.round(days.size/30*100)+'%';
  }
  document.getElementById('ac-attendance').textContent=attendance;

  // calendrier semaine
  const cal=document.getElementById('ac-cal');
  const labels=['L','M','M','J','V','S','D'];
  const todayIso=_isoDate(today);
  const weekDoneSet=new Set(weekDone.map(s=>s._day));
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
  // Récupère tous les PR de l'athlète (la colonne s'appelle recorded_at)
  let prs=[];
  try{
    const {data,error}=await sb.from('athlete_prs')
      .select('movement_id,value,recorded_at,format,created_at')
      .eq('athlete_id',id)
      .order('recorded_at',{ascending:true,nullsFirst:false});
    if(error)console.warn('athlete_prs fetch',error);
    prs=data||[];
  }catch(e){console.warn(e);}
  if(!prs.length){wrap.innerHTML='<div style="color:var(--muted);font-size:12px;padding:8px 0">Aucun PR enregistré.</div>';return;}
  // grouper par mouvement
  const byMov={};
  prs.forEach(pr=>{(byMov[pr.movement_id]=byMov[pr.movement_id]||[]).push(pr);});
  const movIds=Object.keys(byMov);
  // résoudre noms + unités des mouvements
  let movs={};
  if(movIds.length){
    try{
      const {data:m}=await sb.from('movements').select('id,name,unit').in('id',movIds);
      (m||[]).forEach(x=>{movs[x.id]={name:x.name,unit:x.unit||''};});
    }catch(e){}
  }
  // garder top 6 mvts (par récence du dernier PR)
  const items=movIds.map(mid=>{
    const series=byMov[mid].slice().sort((a,b)=>((a.recorded_at||a.created_at||'')+'').localeCompare((b.recorded_at||b.created_at||'')+''));
    return {mid,series,last:series[series.length-1]};
  }).sort((a,b)=>((b.last.recorded_at||b.last.created_at||'')+'').localeCompare((a.last.recorded_at||a.last.created_at||'')+'')).slice(0,6);

  wrap.innerHTML=items.map(it=>{
    const {series,last}=it;
    const mov=movs[it.mid]||{};
    const name=mov.name||'Mouvement';
    const unit=mov.unit||'';
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
          <div class="afiche-pr-name">${escapeHtml(name)}${last.format?` <span style="color:var(--muted);font-size:11px">· ${escapeHtml(last.format)}</span>`:''}</div>
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
      if(m)openAdminAthleteCard(m[1]);
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
  if(p==='profil')_injectStudioAdminMenuItems();
  if(p==='admin')_injectAdminStudioButtons();
  if(p==='planning'){
    if(typeof renderDayStrip==='function')renderDayStrip();
    if(typeof renderSessions==='function')renderSessions();
  }
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BOUTONS STUDIO POUR ADMINS EXTERNES
   Injectés uniquement si studio_id non null (admin d'un studio tiers)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function _isExternalAdmin() {
  return !!(currentProfile && currentProfile.role === 'admin' && currentProfile.studio_id);
}

// ── 1. Menu item "Paramètres du studio" dans la page Profil ──
function _injectStudioAdminMenuItems() {
  if (!_isExternalAdmin()) return;
  if (document.getElementById('studio-settings-menu-item')) return;

  const adminMenuItem = document.getElementById('admin-menu-item');
  if (!adminMenuItem) return;

  const slug = window.__STUDIO_SLUG__ || '';

  const settingsItem = document.createElement('div');
  settingsItem.className = 'menu-item';
  settingsItem.id = 'studio-settings-menu-item';
  settingsItem.innerHTML = `<span class="menu-item-label">🏟 Paramètres du studio</span><span>›</span>`;
  settingsItem.onclick = () => { window.location.href = '/' + slug + '/settings'; };

  adminMenuItem.insertAdjacentElement('afterend', settingsItem);
}

// ── 2. Boutons dans le topbar du panel Admin ──
function _injectAdminStudioButtons() {
  if (!_isExternalAdmin()) return;
  if (document.getElementById('admin-topbar-studio-btns')) return;

  const topbar = document.querySelector('#page-admin .topbar');
  if (!topbar) return;

  const slug = window.__STUDIO_SLUG__ || '';

  const wrap = document.createElement('div');
  wrap.id = 'admin-topbar-studio-btns';
  wrap.style.cssText = 'display:flex;gap:8px;align-items:center;flex-shrink:0';

  // Bouton Paramètres
  const btnSettings = document.createElement('a');
  btnSettings.href = '/' + slug + '/settings';
  btnSettings.innerHTML = '⚙️ <span style="font-size:12px">Paramètres</span>';
  btnSettings.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:7px 11px;background:var(--card2);border:1px solid var(--border2);border-radius:8px;color:var(--text2);font-size:13px;font-weight:700;text-decoration:none;cursor:pointer;white-space:nowrap';

  // Bouton Stripe Dashboard
  const btnStripe = document.createElement('a');
  btnStripe.href = 'https://dashboard.stripe.com';
  btnStripe.target = '_blank';
  btnStripe.rel = 'noopener noreferrer';
  btnStripe.innerHTML = '💳 <span style="font-size:12px">Stripe</span>';
  btnStripe.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:7px 11px;background:var(--card2);border:1px solid var(--border2);border-radius:8px;color:var(--text2);font-size:13px;font-weight:700;text-decoration:none;cursor:pointer;white-space:nowrap';

  wrap.appendChild(btnSettings);
  wrap.appendChild(btnStripe);

  // Insérer dans le topbar (après le titre)
  topbar.style.display = 'flex';
  topbar.style.alignItems = 'center';
  topbar.style.justifyContent = 'space-between';
  topbar.appendChild(wrap);
}

// hook into editSession — s'assure que le form est dans page-admin et visible
const __origEditSession=editSession;
editSession=async function(id){
  // 1) Si le form a été déplacé dans perso-form-container, le remettre à sa place
  const form=document.getElementById('admin-new-session');
  const sessionsPanel=document.getElementById('admin-sessions');
  if(form&&sessionsPanel&&form.parentElement!==sessionsPanel.parentElement){
    sessionsPanel.parentElement.insertBefore(form,sessionsPanel);
    document.getElementById('form-perso-banner').style.display='none';
    document.getElementById('form-prog-group').style.display='';
  }
  // Marquer qu'on doit revenir à l'onglet Planning (Séances) après sauvegarde
  window._returnToSessionsAfterSave=true;
  await __origEditSession(id);
  // 2) Forcer l'activation du panel Séance+ de façon fiable
  //    (le querySelector [onclick*="new-session"] peut échouer sur Android)
  document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
  if(form)form.classList.add('active');
  // Activer le bon bouton d'onglet
  document.querySelectorAll('.admin-tab-btn').forEach(b=>{
    const oc=b.getAttribute('onclick')||'';
    b.classList.toggle('active', oc.includes('new-session'));
  });
  const pageAdmin=document.getElementById('page-admin');
  if(pageAdmin)pageAdmin.scrollTop=0;
};

// handleSaveSession — appelé par le bouton "Publier/Sauvegarder" à la place de saveSession()
async function handleSaveSession(){
  const wasEditing=!!(editingSessionId||personalEditingId);
  const wasPerso=!!personalAthleteId;
  // Neutraliser les flags de navigation — on gère nous-mêmes après le save
  window._returnToPlanningAfterSave=false;
  window._returnToSessionsAfterSave=false;
  await saveSession();
  // Après un edit, toujours revenir à l'onglet Planning du calendrier admin
  if(wasEditing && !wasPerso){
    const sessionsPanel=document.getElementById('admin-sessions');
    const pageAdmin=document.getElementById('page-admin');
    document.querySelectorAll('.page').forEach(p=>{p.classList.remove('active');p.style.display='none';});
    if(pageAdmin){pageAdmin.style.display='block';pageAdmin.classList.add('active');pageAdmin.style.overflowY='auto';}
    const navBtn=document.querySelector('[data-page="admin"]');
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    if(navBtn)navBtn.classList.add('active');
    document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
    if(sessionsPanel)sessionsPanel.classList.add('active');
    document.querySelectorAll('.admin-tab-btn').forEach(b=>{
      b.classList.toggle('active',(b.getAttribute('onclick')||'').includes("'sessions'"));
    });
    if(typeof loadAdminCalendar==='function')loadAdminCalendar();
  }
}

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
  // MULTI-TENANT : filtrer par studio
  const _wStudioId=getStudioId();
  let profsQ=sb.from('profiles').select('id,full_name,email');
  if(_wStudioId){profsQ=profsQ.eq('studio_id',_wStudioId);}
  else{profsQ=profsQ.is('studio_id',null);}
  const {data:profs}=await profsQ.order('full_name');
  // Si aucun profil dans ce studio, afficher vide
  const profIds=(profs||[]).map(p=>p.id);
  let entries=[];
  try{
    if(profIds.length){
      const {data}=await sb.from('wellness_entries').select('*').gte('date',since).in('athlete_id',profIds);
      entries=data||[];
    }
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

  // 1) Scores WOD de l'athlète
  //    Pas de jointure SQL (la FK a été retirée pour autoriser les séances perso),
  //    on récupère les sessions séparément puis on join côté JS.
  let scoresRes=await sb.from('wod_scores')
    .select('id,score_value,score_text,score_type,level,created_at,done_at,session_id')
    .eq('athlete_id',currentUser.id);
  // Fallback si done_at n'existe pas (migration SQL pas passée)
  if(scoresRes.error && /done_at/.test(scoresRes.error.message||'')){
    scoresRes=await sb.from('wod_scores')
      .select('id,score_value,score_text,score_type,level,created_at,session_id')
      .eq('athlete_id',currentUser.id);
  }
  const scoresList=scoresRes.data||[];
  if(scoresRes.error)console.warn('wod_scores fetch',scoresRes.error);

  // 1b) Charger les sessions correspondantes (en 1 requête)
  const sessIdsAll=Array.from(new Set(scoresList.map(s=>s.session_id).filter(Boolean)));
  const sessById={};
  if(sessIdsAll.length){
    const sRes=await sb.from('sessions')
      .select('id,date,title,type,color,programme_id')
      .in('id',sessIdsAll);
    for(const s of (sRes.data||[]))sessById[s.id]=s;
  }
  // 1c) Charger les programmes correspondants (en 1 requête)
  const progIdsFromScores=Array.from(new Set(Object.values(sessById).map(s=>s.programme_id).filter(Boolean)));
  const progById={};
  if(progIdsFromScores.length){
    const pRes=await sb.from('programmes').select('id,name,icon,color').in('id',progIdsFromScores);
    for(const p of (pRes.data||[]))progById[p.id]=p;
  }
  // 1d) Reconstituer la forme attendue: s.sessions.programmes
  for(const s of scoresList){
    const sess=sessById[s.session_id];
    if(sess){
      s.sessions={...sess,programmes:progById[sess.programme_id]||null};
    } else {
      s.sessions=null;
    }
  }

  // 1e) Indexer par date effective (done_at > sessions.date > created_at)
  const doneByDate={};
  const doneSessionIds=new Set();
  for(const s of scoresList){
    const doneIso = s.done_at
      ? s.done_at
      : (s.sessions?.date || (s.created_at ? wcIso(new Date(s.created_at)) : null));
    if(!doneIso)continue;
    s._doneIso=doneIso;
    s._plannedIso=s.sessions?.date||null;
    if(s.session_id)doneSessionIds.add(s.session_id);
    if(doneIso<firstIso||doneIso>lastIso)continue;
    (doneByDate[doneIso]=doneByDate[doneIso]||[]).push(s);
  }

  // 2) Séances programmées du mois sur les programmes accessibles
  const progIds=Array.from(myAccessIds||new Set());
  const progByDate={};
  if(progIds.length){
    const sRes=await sb.from('sessions')
      .select('id,date,title,type,color,programme_id')
      .in('programme_id',progIds).gte('date',firstIso).lte('date',lastIso);
    const sessionsList=sRes.data||[];
    // récupérer les programmes manquants
    const needProgIds=Array.from(new Set(sessionsList.map(s=>s.programme_id).filter(pid=>pid && !progById[pid])));
    if(needProgIds.length){
      const pRes=await sb.from('programmes').select('id,name,icon,color').in('id',needProgIds);
      for(const p of (pRes.data||[]))progById[p.id]=p;
    }
    for(const s of sessionsList){
      if(!s.date||s.type==='separator')continue;
      s.programmes=progById[s.programme_id]||null;
      s._wasDone=doneSessionIds.has(s.id);
      (progByDate[s.date]=progByDate[s.date]||[]).push(s);
    }
  }

  // 3) Séances personnelles
  const pRes=await sb.from('personal_sessions')
    .select('id,date,title,type,color,content,score_type')
    .eq('athlete_id',currentUser.id).gte('date',firstIso).lte('date',lastIso);
  const persoByDate={};
  for(const p of (pRes.data||[])){
    (persoByDate[p.date]=persoByDate[p.date]||[]).push(p);
  }
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
    // Une séance programmée n'est "skipped" que si elle n'a JAMAIS été faite
    // (même décalée à un autre jour).
    for(const s of data.progByDate[k]){
      if(!s._wasDone)skipCount++;
    }
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
    const progAll=data.progByDate[iso]||[];
    // Pour le calcul "skipped" sur cette case : on ne compte que les
    // sessions programmées qui n'ont pas été réalisées (même un autre jour)
    const progUnfinished=progAll.filter(s=>!s._wasDone);
    const perso=data.persoByDate[iso]||[];
    let cls='wod-cal-cell',dot='';
    if(done.length){cls+=' done';dot='<span class="wcd done"></span>';}
    else if(perso.length){cls+=' manual';dot='<span class="wcd manual"></span>';}
    else if(progUnfinished.length&&!isFuture&&!isToday){cls+=' skipped';dot='<span class="wcd skip">✕</span>';}
    else if(progAll.length){cls+=' prog';dot='<span class="wcd prog"></span>';}
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
  const progAll=data.progByDate[iso]||[];
  // Séances programmées ce jour qui n'ont PAS été faites (ni ce jour, ni un autre)
  const progUnfinished=progAll.filter(s=>!s._wasDone);
  // Séances programmées ce jour mais faites un AUTRE jour (utile pour l'info "reportée")
  const progDoneElsewhere=progAll.filter(s=>s._wasDone && !done.some(d=>d.session_id===s.id));
  const perso=data.persoByDate[iso]||[];
  const todayIso=wcIso(new Date());
  const isFuture=iso>todayIso;
  const isToday=iso===todayIso;
  const [Y,M,D]=iso.split('-').map(Number);
  const dt=new Date(Y,M-1,D);
  const dayLabel=`${isToday?"Aujourd'hui · ":''}${WC_DAYS[dt.getDay()]} ${D} ${WC_MONTHS[M-1]}`;

  let html=`<div class="wod-cal-day-label">${dayLabel}</div>`;

  // 1) Séances faites (wod_scores) ce jour-là (date de réalisation)
  for(const s of done){
    const sess=s.sessions||{};
    const prog=sess.programmes||{};
    const color=sess.color||prog.color||'var(--accent)';
    const score=s.score_text||s.score_value||'';
    // Si la séance était programmée un autre jour, on l'indique
    let extraMeta='';
    if(s._plannedIso && s._plannedIso!==iso){
      const [py,pm,pd]=s._plannedIso.split('-').map(Number);
      const pdt=new Date(py,pm-1,pd);
      extraMeta=` · <span style="color:var(--muted);font-size:11px">prévu ${WC_DAYS[pdt.getDay()].toLowerCase()} ${pd} ${WC_MONTHS[pm-1].slice(0,3)}</span>`;
    }
    html+=`<div class="wod-cal-session" onclick="openReadSession('${sess.id}','session')"><div class="wcs-icon" style="background:${color}22;color:${color}">${wcEsc(prog.icon||'✓')}</div>
      <div class="wcs-body"><div class="wcs-title">${wcEsc(sess.title||'Séance')}</div>
      <div class="wcs-meta">${wcEsc(prog.name||(sess.type||'').toUpperCase())} · <span style="color:var(--accent)">FAIT</span>${extraMeta}</div></div>
      ${score?`<div class="wcs-score">${wcEsc(score)}</div>`:''}</div>`;
  }
  // 2) Séances perso (manuelles)
  for(const p of perso){
    html+=`<div class="wod-cal-session" onclick="openReadSession('${p.id}','personal')"><div class="wcs-icon" style="background:rgba(71,255,140,.16);color:var(--green)">●</div>
      <div class="wcs-body"><div class="wcs-title">${wcEsc(p.title||'Séance perso')}</div>
      <div class="wcs-meta">${wcEsc((p.type||'wod').toUpperCase())} · <span style="color:var(--green)">MANUEL</span></div></div>
      <button class="wcs-del" onclick="event.stopPropagation();deleteWodCalManual('${p.id}')" title="Supprimer">✕</button></div>`;
  }
  // 3) Séances programmées ce jour mais faites un AUTRE jour (info "reportée")
  for(const s of progDoneElsewhere){
    const pInfo=s.programmes||{};
    html+=`<div class="wod-cal-session" onclick="openReadSession('${s.id}','session')" style="opacity:.7"><div class="wcs-icon" style="background:rgba(71,200,255,.14);color:#47c8ff">↪</div>
      <div class="wcs-body"><div class="wcs-title">${wcEsc(s.title||'Séance')}</div>
      <div class="wcs-meta">${wcEsc(pInfo.name||'Programme')} · <span style="color:#47c8ff">FAITE UN AUTRE JOUR</span></div></div></div>`;
  }
  // 4) Séances programmées non faites (passé/aujourd'hui)
  if(!isFuture){
    for(const s of progUnfinished){
      const pInfo=s.programmes||{};
      html+=`<div class="wod-cal-session skipped" onclick="openReadSession('${s.id}','session')"><div class="wcs-icon" style="background:rgba(255,68,68,.12);color:var(--red)">✕</div>
        <div class="wcs-body"><div class="wcs-title">${wcEsc(s.title||'Séance')}</div>
        <div class="wcs-meta">${wcEsc(pInfo.name||'Programme')} · <span style="color:var(--red)">NON FAIT</span></div></div></div>`;
    }
  }
  // 5) Programme à venir
  if(isFuture && progAll.length){
    for(const s of progAll){
      const pInfo=s.programmes||{};
      html+=`<div class="wod-cal-session upcoming" onclick="openReadSession('${s.id}','session')"><div class="wcs-icon" style="background:var(--card2);color:var(--muted)">○</div>
        <div class="wcs-body"><div class="wcs-title">${wcEsc(s.title||'Séance')}</div>
        <div class="wcs-meta">${wcEsc(pInfo.name||'Programme')} · <span style="color:var(--muted)">À VENIR</span></div></div></div>`;
    }
  }
  // 6) Rien
  if(!done.length && !perso.length && !progAll.length){
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


// ===================================================
// AUTO-SAVE VIDÉOS SÉANCE → BIBLIOTHÈQUE
// Quand on publie/modifie une séance, les vidéos
// saisies via URL directe sont auto-enregistrées
// dans movement_videos si elles n'y existent pas déjà.
// ===================================================
async function autoSaveSessionVideos(videos){
  if(!videos||!videos.length)return;
  if(!currentUser)return;
  const studioId=getStudioId();

  // Charger les URLs déjà connues dans movement_videos pour ce studio
  let q=sb.from('movement_videos').select('youtube_url');
  if(studioId){q=q.eq('studio_id',studioId);}
  else{q=q.is('studio_id',null);}
  const {data:existing}=await q;
  const knownUrls=new Set((existing||[]).map(v=>(v.youtube_url||'').trim()));

  // Filtrer les nouvelles uniquement (URL non vide + pas déjà en base)
  const toInsert=videos.filter(v=>{
    const url=(v.url||'').trim();
    return url&&!knownUrls.has(url);
  });
  if(!toInsert.length)return;

  // Insérer en batch
  const rows=toInsert.map(v=>({
    youtube_url:(v.url||'').trim(),
    title:(v.label||'').trim()||'Vidéo séance',
    movement_id:null,
    level:'all',
    created_by:currentUser.id,
    studio_id:studioId||null
  }));
  const {error}=await sb.from('movement_videos').insert(rows);
  if(error){console.warn('autoSaveSessionVideos',error.message);return;}

  // Rafraîchir allVideos silencieusement pour que le video picker soit à jour
  if(typeof loadVideos==='function'){
    try{await loadVideos();}catch(e){}
  }
  const n=rows.length;
  showToast(`📚 ${n} vidéo${n>1?'s':''} ajoutée${n>1?'s':''} à la bibliothèque`);
}

// Patch de saveSession : on injecte autoSaveSessionVideos juste après l'insert réussi
(function(){
  const _orig=window.saveSession;
  if(typeof _orig!=='function')return;
  window.saveSession=async function(){
    // Capturer les vidéos AVANT que saveSession les efface du formulaire
    const videos=(typeof getFormVideos==='function')?getFormVideos():[];
    await _orig.apply(this,arguments);
    // autoSave en arrière-plan (silencieux si erreur)
    if(videos.length){
      autoSaveSessionVideos(videos).catch(e=>console.warn('autoSave videos',e));
    }
  };
})();

// ===================================================
// TRANSFERT CYCLE → SÉANCE+
// Bouton "→ Séance+" dans chaque colonne-jour de la
// grille session. Mappe les lignes vers les champs du
// formulaire via leur nom (insensible à la casse).
// ===================================================

// Mapping nom de ligne → champ Séance+
const CYCLE_ROW_FIELD_MAP = [
  { keys: ['wod'],                                          field: 'wod'        },
  { keys: ['athlete', 'target', 'objectif'],               field: 'target'     },
  { keys: ['coach', 'tips', 'conseil'],                    field: 'tips'       },
  { keys: ['rpe', 'intensity', 'intensité'],               field: 'intensity'  },
  { keys: ['inter', 'intermédiaire', 'intermediaire'],     field: 'inter'      },
  { keys: ['scaled'],                                       field: 'scaled'     },
  { keys: ['foundation', 'fond', 'fondation'],             field: 'foundation' },
];

function _matchCycleRowField(rowName) {
  const n = (rowName || '').toLowerCase().trim();
  for (const entry of CYCLE_ROW_FIELD_MAP) {
    if (entry.keys.some(k => n.includes(k))) return entry.field;
  }
  return null;
}

// Convertit un texte brut de chip (avec sauts de ligne) en HTML sûr
// pour l'éditeur contenteditable : échappe < > & puis transforme les
// retours à la ligne (réels OU littéraux "\n") en <br>.
function _plainToEditorHtml(txt) {
  if (txt == null) return '';
  return String(txt)
    .replace(/\r\n?/g, '\n')   // CRLF / CR → LF
    .replace(/\\n/g, '\n')     // séquences littérales "\n" → vrai saut
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function transferCycleToSession(wk, di) {
  if (!cycleData || !cycleData.rows) { showToast('⚠️ Aucun cycle chargé'); return; }

  const rows = cycleData.rows;
  const fields = { wod: null, target: null, tips: null, intensity: null, inter: null, scaled: null, foundation: null };
  let hasContent = false;

  rows.forEach((rowName, ri) => {
    const field = _matchCycleRowField(rowName);
    if (!field) return;
    const key = `w${wk}-${ri}-${di}`;
    const chips = cycleData.sessionCells[key] || [];
    if (!chips.length) return;
    fields[field] = chips.map(c => (c && c.text != null ? c.text : '')).filter(t => t !== '').join('\n'); // toutes les chips de la case
    hasContent = true;
  });

  if (!hasContent) { showToast('⚠️ Aucun contenu dans cette colonne'); return; }

  // Aller sur l'onglet Séance+
  window._returnToSessionsAfterSave = false;
  const newSessionBtn = Array.from(document.querySelectorAll('.admin-tab-btn'))
    .find(b => (b.getAttribute('onclick') || '').includes("'new-session'"));
  if (typeof resetSessionForm === 'function') resetSessionForm();
  if (typeof adminTab === 'function' && newSessionBtn) adminTab('new-session', newSessionBtn);

  // Pré-remplir date si start_date du cycle est définie
  const startDateEl = document.getElementById('cycle-start-date');
  const startDate = startDateEl ? startDateEl.value : null;
  if (startDate) {
    try {
      const base = new Date(startDate + 'T12:00:00');
      base.setDate(base.getDate() + wk * 7 + di);
      document.getElementById('f-date').value = base.toISOString().split('T')[0];
    } catch(e) {}
  }

  // Remplir les champs
  if (fields.wod   !== null && typeof setEditorContent === 'function') setEditorContent(_plainToEditorHtml(fields.wod));
  if (fields.target !== null) { const el = document.getElementById('f-target');      if (el) el.value = fields.target; }
  if (fields.tips   !== null) { const el = document.getElementById('f-tips');        if (el) el.value = fields.tips; }
  if (fields.inter  !== null) { const el = document.getElementById('f-scaling-inter');      if (el) el.value = fields.inter; }
  if (fields.scaled !== null) { const el = document.getElementById('f-scaling-scaled');     if (el) el.value = fields.scaled; }
  if (fields.foundation !== null) { const el = document.getElementById('f-scaling-foundation'); if (el) el.value = fields.foundation; }
  if (fields.intensity !== null) {
    const v = parseInt(fields.intensity);
    if (!isNaN(v)) {
      const el = document.getElementById('f-intensity');
      const lbl = document.getElementById('f-int-val');
      if (el) el.value = v;
      if (lbl) lbl.textContent = v;
    }
  }

  showToast('✅ Champs pré-remplis depuis le cycle');
  const pageAdmin = document.getElementById('page-admin');
  if (pageAdmin) pageAdmin.scrollTop = 0;
}

// Patch renderSessionGrid : injecte le bouton "→ Séance+" dans chaque <th> de jour
(function () {
  if (window.__cycleTransferBound) return;
  window.__cycleTransferBound = true;

  const _origRender = window.renderSessionGrid;
  if (typeof _origRender !== 'function') {
    // renderSessionGrid pas encore défini → on retente après chargement
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof renderSessionGrid === 'function' && !renderSessionGrid.__transferPatched) {
        _patchRenderSessionGrid();
      }
    });
    return;
  }
  _patchRenderSessionGrid();

  function _patchRenderSessionGrid() {
    const orig = window.renderSessionGrid;
    if (orig && orig.__transferPatched) return;
    window.renderSessionGrid = function () {
      orig.apply(this, arguments);
      // Après rendu, injecter les boutons dans chaque <th> de jour (skip premier th = "Catégorie")
      const grid = document.getElementById('cycle-grid');
      if (!grid) return;
      grid.querySelectorAll('.session-grid-table').forEach((table, wk) => {
        const ths = table.querySelectorAll('thead tr th');
        // ths[0] = "Catégorie", ths[1..N] = jours
        ths.forEach((th, idx) => {
          if (idx === 0) return; // skip header ligne
          const di = idx - 1;
          if (th.querySelector('.cycle-to-session-btn')) return; // idempotent
          const btn = document.createElement('button');
          btn.className = 'cycle-to-session-btn';
          btn.title = 'Transférer vers Séance+';
          btn.innerHTML = '→ Séance+';
          btn.style.cssText = 'display:block;margin:4px auto 0;padding:2px 7px;font-size:10px;font-weight:700;background:var(--card2);border:1px solid var(--accent);color:var(--accent);border-radius:5px;cursor:pointer;white-space:nowrap;letter-spacing:.5px';
          btn.addEventListener('click', (e) => { e.stopPropagation(); transferCycleToSession(wk, di); });
          th.appendChild(btn);
        });
      });
    };
    window.renderSessionGrid.__transferPatched = true;
  }
})();

// ===================================================
// RÉORDONNEMENT DES LIGNES SESSION (↑ ↓)
// Patch renderSessionRowsConfig pour ajouter des
// boutons de déplacement. Rekeys les sessionCells
// quand deux lignes sont swappées.
// ===================================================

function moveSessionRow(ri, dir) {
  const rows = cycleData.rows;
  const newRi = ri + dir;
  if (newRi < 0 || newRi >= rows.length) return;

  // Swap noms de lignes
  [rows[ri], rows[newRi]] = [rows[newRi], rows[ri]];

  // Remap sessionCells : clé = w{wk}-{ri}-{di}
  const cells = cycleData.sessionCells;
  const weeks = cycleData.weeks || 8;
  const DAYS_N = 7; // DAYS_SESSION.length

  for (let wk = 0; wk < weeks; wk++) {
    for (let di = 0; di < DAYS_N; di++) {
      const keyA = `w${wk}-${ri}-${di}`;
      const keyB = `w${wk}-${newRi}-${di}`;
      const tmp = cells[keyA];
      if (cells[keyB] !== undefined) {
        cells[keyA] = cells[keyB];
      } else {
        delete cells[keyA];
      }
      if (tmp !== undefined) {
        cells[keyB] = tmp;
      } else {
        delete cells[keyB];
      }
    }
  }

  if (typeof renderSessionRowsConfig === 'function') renderSessionRowsConfig();
  if (typeof renderCycleGrid === 'function') renderCycleGrid();
  scheduleAutoSaveCycle();
}

// Patch renderSessionRowsConfig pour injecter les boutons ↑↓
(function () {
  if (window.__sessionRowMoveBound) return;
  window.__sessionRowMoveBound = true;

  function _patch() {
    const orig = window.renderSessionRowsConfig;
    if (!orig || orig.__movePatched) return;

    window.renderSessionRowsConfig = function () {
      const el = document.getElementById('session-rows-config');
      if (!el || !cycleData || !cycleData.rows) { orig.apply(this, arguments); return; }
      const rows = cycleData.rows;
      el.innerHTML = rows.map((r, i) => `
        <div style="display:flex;align-items:center;gap:6px">
          <div style="display:flex;flex-direction:column;gap:2px">
            <button onclick="moveSessionRow(${i},-1)" ${i === 0 ? 'disabled' : ''}
              style="padding:2px 7px;font-size:11px;line-height:1.4;background:var(--card2);border:1px solid var(--border2);color:var(--text2);border-radius:4px;cursor:pointer;${i === 0 ? 'opacity:.3' : ''}">↑</button>
            <button onclick="moveSessionRow(${i},1)" ${i === rows.length - 1 ? 'disabled' : ''}
              style="padding:2px 7px;font-size:11px;line-height:1.4;background:var(--card2);border:1px solid var(--border2);color:var(--text2);border-radius:4px;cursor:pointer;${i === rows.length - 1 ? 'opacity:.3' : ''}">↓</button>
          </div>
          <input type="text" class="form-input" value="${r}"
            oninput="cycleData.rows[${i}]=this.value;renderCycleGrid();scheduleAutoSaveCycle()"
            style="flex:1;padding:8px 12px;font-size:13px">
          <button onclick="removeSessionRow(${i})"
            style="padding:8px 10px;background:rgba(255,68,68,.1);border:1px solid rgba(255,68,68,.3);color:var(--red);border-radius:8px;font-size:12px;cursor:pointer">✕</button>
        </div>`).join('');
    };
    window.renderSessionRowsConfig.__movePatched = true;
  }

  // Tenter immédiatement, sinon attendre DOMContentLoaded
  if (typeof renderSessionRowsConfig === 'function') {
    _patch();
  } else {
    document.addEventListener('DOMContentLoaded', _patch);
  }
})();

// ===================================================
// VUE CYCLE — REFONTE LAYOUT (blocs semaine, jours
// en colonnes, thèmes en lignes) + réordonnement ↑↓
// themeCells: clé = "t{wk}-{ti}-{di}"
// ===================================================

const CYCLE_THEMES_DEFAULT = ['Weightlifting','Gymnastics','Strongman','Renforcement','Skill','Bodybuilding'];
const DAYS_CYCLE = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

// Initialise cycleData.themes + cycleData.themeCells si absents
function _ensureCycleThemes(){
  if(!cycleData.themes) cycleData.themes = [...CYCLE_THEMES_DEFAULT];
  if(!cycleData.themeCells) cycleData.themeCells = {};
}

// ── Rendu principal de la vue cycle ──────────────────
function renderCycleGridNew(){
  _ensureCycleThemes();
  const themes = cycleData.themes;
  const weeks  = parseInt(document.getElementById('cycle-weeks')?.value) || cycleData.weeks || 8;
  cycleData.weeks = weeks;

  const startInput = document.getElementById('cycle-start-date')?.value;
  const startDate  = startInput ? new Date(startInput+'T12:00:00') : (() => {
    const d = new Date(); const day = d.getDay();
    d.setDate(d.getDate() - (day===0?6:day-1)); return d;
  })();

  if(!cycleData.summaryRow) cycleData.summaryRow = {};

  // ── Ligne Résumé fixe en haut ─────────────────────
  let html = `<div style="margin-bottom:18px">
    <table class="session-grid-table"><thead><tr>
      <th class="row-header" style="color:var(--accent)">Résumé</th>
      ${DAYS_CYCLE.map(d=>`<th>${d}</th>`).join('')}
    </tr></thead><tbody><tr>
      <td class="session-row-label"><div class="session-row-label-inner"><span style="font-size:11px;font-weight:700;color:var(--muted)">Cycle</span></div></td>
      ${DAYS_CYCLE.map((_,di)=>{
        const key = `sum-${di}`;
        const chips = cycleData.summaryRow[key]||[];
        const chipsHtml = chips.map((chip,chi)=>{
          const fg = isLightColor(chip.color)?'#111':'#fff';
          return `<div class="session-chip" style="background:${chip.color};color:${fg};display:flex;align-items:center;gap:5px">
            <span class="session-chip-text" style="flex:1;min-width:0" onclick="event.stopPropagation();editSummaryChip(${di},${chi})">${chip.text}</span>
            <button class="session-chip-del" onclick="event.stopPropagation();removeSummaryChip(${di},${chi})" style="position:static;opacity:.7">✕</button>
          </div>`;
        }).join('');
        return `<td class="session-cell" data-sum="1" data-di="${di}">
          <div class="session-cell-inner">${chipsHtml}<button class="cycle-add-btn">+</button></div>
        </td>`;
      }).join('')}
    </tr></tbody></table>
  </div>`;

  for(let wk=0; wk<weeks; wk++){
    const wStart = new Date(startDate); wStart.setDate(startDate.getDate()+wk*7);
    const wEnd   = new Date(wStart);   wEnd.setDate(wStart.getDate()+6);
    const wLabel = `${wStart.getDate()}/${wStart.getMonth()+1} → ${wEnd.getDate()}/${wEnd.getMonth()+1}`;

    html += `<div style="margin-bottom:18px">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:2px;color:var(--orange);margin:6px 2px 6px;padding:4px 0;border-bottom:1px solid var(--border2)">
        SEMAINE ${wk+1} <span style="font-size:11px;color:var(--muted);font-weight:400;letter-spacing:0;font-family:inherit">${wLabel}</span>
      </div>
      <table class="session-grid-table"><thead><tr>
        <th class="row-header">Thème</th>
        ${DAYS_CYCLE.map(d=>`<th>${d}</th>`).join('')}
      </tr></thead><tbody>`;

    themes.forEach((theme,ti)=>{
      html += `<tr>
        <td class="session-row-label">
          <div class="session-row-label-inner">
            <span style="font-size:12px;font-weight:700;color:var(--text2)">${theme}</span>
          </div>
        </td>
        ${DAYS_CYCLE.map((_,di)=>{
          const key = `t${wk}-${ti}-${di}`;
          const chips = (cycleData.themeCells[key]||[]);
          const chipsHtml = chips.map((chip,chi)=>{
            const fg = isLightColor(chip.color)?'#111':'#fff';
            const themes = cycleData.themes||[];
            const DAYS_N = 7;
            const mvBtn = (label, disabled, onclick) => `<button style="padding:1px 5px;font-size:9px;background:rgba(0,0,0,.25);border:none;color:${fg};border-radius:3px;cursor:${disabled?'default':'pointer'};opacity:${disabled?'.2':'.8'};line-height:1.3" ${disabled?'disabled':''} onclick="${disabled?'event.stopPropagation()':'event.stopPropagation();'+onclick}">${label}</button>`;
            return `<div class="session-chip" style="background:${chip.color};color:${fg};${chip.done?'opacity:.55;text-decoration:line-through':''};display:flex;flex-direction:column;gap:4px;padding:6px 6px 5px">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:4px">
                <span class="chip-toggle" data-toggle-key="${key}" data-toggle-idx="${chi}" data-bucket="theme"
                  role="checkbox" aria-checked="${!!chip.done}" title="Traité"
                  style="flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1.5px solid ${fg};border-radius:3px;background:${chip.done?fg:'transparent'};color:${chip.done?(isLightColor(fg)?'#111':chip.color):fg};font-size:11px;line-height:1;cursor:pointer;user-select:none">${chip.done?'✓':''}</span>
                <div style="display:flex;gap:2px;align-items:center">
                  ${mvBtn('↑', ti===0,                  `moveThemeChip(${wk},${ti},${di},${chi},-1,0)`)}
                  ${mvBtn('↓', ti===themes.length-1,    `moveThemeChip(${wk},${ti},${di},${chi},1,0)`)}
                  ${mvBtn('←', di===0,                  `moveThemeChip(${wk},${ti},${di},${chi},0,-1)`)}
                  ${mvBtn('→', di===DAYS_N-1,           `moveThemeChip(${wk},${ti},${di},${chi},0,1)`)}
                  <button class="session-chip-del" onclick="event.stopPropagation();removeThemeChip('${key}',${chi})" style="padding:1px 5px;font-size:9px;background:rgba(0,0,0,.25);border:none;color:${fg};border-radius:3px;cursor:pointer;opacity:.8">✕</button>
                </div>
              </div>
              <span class="session-chip-text" style="white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.5" onclick="event.stopPropagation();editThemeChip(${wk},${ti},${di},${chi})">${chip.text}</span>
              <div style="display:flex;justify-content:flex-end">
                <button class="theme-chip-send" data-text=${JSON.stringify(chip.text)} title="Envoyer vers Séance+" style="padding:2px 8px;font-size:9px;font-weight:700;background:rgba(0,0,0,.25);border:1px solid ${fg}55;color:${fg};border-radius:4px;cursor:pointer;opacity:.8">→ Séance+</button>
              </div>
            </div>`;
          }).join('');
          return `<td class="session-cell" data-wk="${wk}" data-ti="${ti}" data-di="${di}">
            <div class="session-cell-inner">${chipsHtml}<button class="cycle-add-btn">+</button></div>
          </td>`;
        }).join('')}
      </tr>`;
    });
    html += '</tbody></table></div>';
  }

  const grid = document.getElementById('cycle-grid');
  if(grid){ grid.innerHTML = html; }

  // Bind toggles chips thème
  if(grid) grid.querySelectorAll('[data-bucket="theme"]').forEach(t=>{
    t.addEventListener('click', function(ev){
      ev.stopPropagation(); ev.preventDefault();
      const k = this.getAttribute('data-toggle-key');
      const i = parseInt(this.getAttribute('data-toggle-idx'));
      toggleThemeChipDone(k,i);
    });
  });

  // Bind boutons → (envoyer chip vers Séance+)
  if(grid) grid.querySelectorAll('.theme-chip-send').forEach(btn=>{
    btn.addEventListener('click', function(ev){
      ev.stopPropagation(); ev.preventDefault();
      sendThemeChipToSession(this.dataset.text);
    });
  });

  // Bind td summary
  if(grid) grid.querySelectorAll('td.session-cell[data-sum]').forEach(td=>{
    td.addEventListener('click', function(ev){
      if(ev.target.closest('.session-chip-del,.session-chip-text')) return;
      openSummaryChipModal(parseInt(this.dataset.di));
    });
  });

  // Bind td → openThemeCellModal (via delegation pour éviter conflit avec boutons internes)
  if(grid) grid.querySelectorAll('td.session-cell[data-wk]').forEach(td=>{
    td.addEventListener('click', function(ev){
      if(ev.target.closest('.theme-chip-send,.session-chip-del,.chip-toggle,.session-chip-text')) return;
      const wk=parseInt(this.dataset.wk), ti=parseInt(this.dataset.ti), di=parseInt(this.dataset.di);
      openThemeCellModal(wk,ti,di);
    });
  });

}

// ===================================================
// PATCH toggleChipDone — router vers toggleThemeChipDone
// pour les clés de la vue cycle thème (préfixe "t")
// et vers toggleSummaryChipDone pour "sum-"
// ===================================================
(function(){
  if(window.__toggleChipDoneThemePatchBound) return;
  window.__toggleChipDoneThemePatchBound = true;
  const _orig = window.toggleChipDone;
  window.toggleChipDone = async function(key, chi){
    if(typeof key === 'string' && /^t\d+/.test(key)){
      toggleThemeChipDone(key, chi);
      return;
    }
    if(typeof key === 'string' && key.startsWith('sum-')){
      const arr = (cycleData.summaryRow||{})[key];
      if(!arr||!arr[chi]) return;
      arr[chi].done = !arr[chi].done;
      renderCycleGridNew();
      scheduleAutoSaveCycle();
      return;
    }
    if(typeof _orig === 'function') return _orig.apply(this, arguments);
  };
})();

// ── Ligne Résumé — fonctions ─────────────────────────
function openSummaryChipModal(di, editIdx=null){
  if(!cycleData.summaryRow) cycleData.summaryRow={};
  _themeCellTarget = {summary:true, di, editIdx};
  document.getElementById('cycle-cell-title').textContent = `Résumé — ${DAYS_CYCLE[di]}`;
  document.getElementById('cycle-cell-subtitle').textContent = 'Résumé du cycle pour ce jour';
  document.getElementById('cycle-cell-presets').style.display='none';
  const key=`sum-${di}`;
  const chip = editIdx!=null ? (cycleData.summaryRow[key]||[])[editIdx] : null;
  document.getElementById('cycle-cell-input').value = chip?chip.text:'';
  selectedChipColor = chip?chip.color:'#e8ff47';
  document.querySelectorAll('.chip-color-btn').forEach(b=>b.classList.toggle('selected',b.dataset.color===selectedChipColor));
  document.getElementById('cycle-cell-modal').classList.add('open');
  _setChipAutoSaveStatus('idle');
  setTimeout(()=>{ autoResizeCycleInput(document.getElementById('cycle-cell-input')); document.getElementById('cycle-cell-input').focus(); },300);
}

function editSummaryChip(di,chi){ openSummaryChipModal(di,chi); }

function removeSummaryChip(di,chi){
  if(!cycleData.summaryRow) return;
  const key=`sum-${di}`;
  if(cycleData.summaryRow[key]) cycleData.summaryRow[key].splice(chi,1);
  renderCycleGridNew();
  scheduleAutoSaveCycle();
}

// ── Modale texte libre pour chips thème ─────────────
let _themeCellTarget = null;

function openThemeCellModal(wk,ti,di){
  _ensureCycleThemes();
  _themeCellTarget = {wk,ti,di,editIdx:null};
  const theme = cycleData.themes[ti]||'—';
  document.getElementById('cycle-cell-title').textContent = `Sem. ${wk+1} — ${theme} — ${DAYS_CYCLE[di]}`;
  document.getElementById('cycle-cell-subtitle').textContent = 'Ajoute une séance';
  document.getElementById('cycle-cell-presets').style.display='none';
  document.getElementById('cycle-cell-input').value='';
  selectedChipColor='#e8ff47';
  document.querySelectorAll('.chip-color-btn').forEach(b=>b.classList.toggle('selected',b.dataset.color==='#e8ff47'));
  document.getElementById('cycle-cell-modal').classList.add('open');
  _setChipAutoSaveStatus('idle');
  setTimeout(()=>{
    autoResizeCycleInput(document.getElementById('cycle-cell-input'));
    document.getElementById('cycle-cell-input').focus();
  },300);
}

function editThemeChip(wk,ti,di,chi){
  _ensureCycleThemes();
  const key=`t${wk}-${ti}-${di}`;
  const chip=(cycleData.themeCells[key]||[])[chi];
  if(!chip)return;
  _themeCellTarget={wk,ti,di,editIdx:chi};
  document.getElementById('cycle-cell-title').textContent=`Sem. ${wk+1} — ${cycleData.themes[ti]||'—'} — ${DAYS_CYCLE[di]}`;
  document.getElementById('cycle-cell-subtitle').textContent='Modifier';
  document.getElementById('cycle-cell-presets').style.display='none';
  document.getElementById('cycle-cell-input').value=chip.text;
  selectedChipColor=chip.color||'#e8ff47';
  document.querySelectorAll('.chip-color-btn').forEach(b=>b.classList.toggle('selected',b.dataset.color===chip.color));
  document.getElementById('cycle-cell-modal').classList.add('open');
  _setChipAutoSaveStatus('idle');
  setTimeout(()=>autoResizeCycleInput(document.getElementById('cycle-cell-input')),0);
}

function removeThemeChip(key,chi){
  if(cycleData.themeCells[key])cycleData.themeCells[key].splice(chi,1);
  renderCycleGridNew();
  scheduleAutoSaveCycle();
}

function toggleThemeChipDone(key,chi){
  const arr=cycleData.themeCells[key];
  if(!arr||!arr[chi])return;
  arr[chi].done=!arr[chi].done;
  renderCycleGridNew();
  scheduleAutoSaveCycle();
}

// ── Envoyer une chip thème vers l'éditeur Séance+ ───
function sendThemeChipToSession(text){
  if(!text) return;
  const newSessionBtn = Array.from(document.querySelectorAll('.admin-tab-btn'))
    .find(b=>(b.getAttribute('onclick')||'').includes("'new-session'"));
  if(typeof resetSessionForm==='function') resetSessionForm();
  if(typeof adminTab==='function'&&newSessionBtn) adminTab('new-session',newSessionBtn);
  if(typeof setEditorContent==='function'){
    setEditorContent(_plainToEditorHtml(text));
  }
  // Mémoriser le retour vers l'onglet Cycle (vue cycle ou vue session)
  window._returnToCycleAfterSave = cycleMode || 'cycle';
  showToast('✅ Séance pré-remplie');
  const pageAdmin=document.getElementById('page-admin');
  if(pageAdmin) pageAdmin.scrollTop=0;
}

// ── Auto-save chip thème depuis modale ───────────────
// Patch _doAutoSaveCycleChip pour gérer le bucket thème
(function(){
  if(window.__themeChipSaveBound) return;
  window.__themeChipSaveBound = true;
  const _origSave = window._doAutoSaveCycleChip;
  window._doAutoSaveCycleChip = function(){
    // Si une cible thème est active, gérer ici
    if(_themeCellTarget && document.getElementById('cycle-cell-modal')?.classList.contains('open')){
      _ensureCycleThemes();
      if(!cycleData.summaryRow) cycleData.summaryRow={};
      const inputEl = document.getElementById('cycle-cell-input');
      if(!inputEl) return;
      const text = inputEl.value.trim();
      const t = _themeCellTarget;

      // Cas ligne résumé
      if(t.summary){
        const key=`sum-${t.di}`;
        if(!text && t.editIdx==null) return;
        _setChipAutoSaveStatus('saving');
        if(!cycleData.summaryRow[key]) cycleData.summaryRow[key]=[];
        if(t.editIdx!=null){
          if(!text){ cycleData.summaryRow[key].splice(t.editIdx,1); _themeCellTarget.editIdx=null; }
          else { cycleData.summaryRow[key][t.editIdx]={text,color:selectedChipColor}; }
        } else {
          cycleData.summaryRow[key].push({text,color:selectedChipColor});
          _themeCellTarget.editIdx=cycleData.summaryRow[key].length-1;
        }
        renderCycleGridNew();
        scheduleAutoSaveCycle();
        setTimeout(()=>_setChipAutoSaveStatus('saved'),200);
        return;
      }
      const key = `t${t.wk}-${t.ti}-${t.di}`;
      if(!text && t.editIdx==null) return;
      _setChipAutoSaveStatus('saving');
      if(!cycleData.themeCells[key]) cycleData.themeCells[key]=[];
      if(t.editIdx!=null){
        if(!text){ cycleData.themeCells[key].splice(t.editIdx,1); _themeCellTarget.editIdx=null; }
        else { cycleData.themeCells[key][t.editIdx]={text,color:selectedChipColor,done:!!(cycleData.themeCells[key][t.editIdx]||{}).done}; }
      } else {
        cycleData.themeCells[key].push({text,color:selectedChipColor,done:false});
        _themeCellTarget.editIdx = cycleData.themeCells[key].length-1;
      }
      renderCycleGridNew();
      scheduleAutoSaveCycle();
      setTimeout(()=>_setChipAutoSaveStatus('saved'),200);
      return;
    }
    // Sinon comportement original
    if(typeof _origSave==='function') _origSave.apply(this,arguments);
  };
})();

// Fermeture modale : reset _themeCellTarget
(function(){
  if(window.__themeModalCloseBound) return;
  window.__themeModalCloseBound = true;
  const _origClose = window.closeCycleCellModal;
  window.closeCycleCellModal = function(){
    _themeCellTarget = null;
    if(typeof _origClose==='function') _origClose.apply(this,arguments);
  };
})();

// ── Patch autoSaveCycleNow pour persister themeCells ─
(function(){
  if(window.__themePersistBound) return;
  window.__themePersistBound = true;
  const _origAutoSave = window.autoSaveCycleNow;
  window.autoSaveCycleNow = async function(){
    _ensureCycleThemes();
    // Injecter themes + themeCells dans le payload avant la sauvegarde
    // On surcharge cycleData temporairement — autoSaveCycleNow lit cycleData directement
    const _origPayloadFn = window.autoSaveCycleNow;
    // Patch payload via surcharge sb.from (trop risqué) → on patch la fonction entière
    if(!currentUser) return;
    const name=(document.getElementById('cycle-name')?.value||'').trim()||cycleData.name||'Cycle sans nom';
    const weeks=parseInt(document.getElementById('cycle-weeks')?.value)||cycleData.weeks||8;
    cycleData.name=name; cycleData.weeks=weeks;
    const startDate=document.getElementById('cycle-start-date')?.value||null;
    const payload={
      name, weeks, mode:cycleMode, start_date:startDate,
      columns:cycleData.columns, rows:cycleData.rows,
      cells:cycleData.cells, session_cells:cycleData.sessionCells,
      theme_cells:cycleData.themeCells, themes:cycleData.themes,
      summary_row:cycleData.summaryRow||{},
      created_by:currentUser.id, studio_id:getStudioId()
    };
    try{
      if(cycleData.id){ await sb.from('cycle_plans').update(payload).eq('id',cycleData.id); }
      else {
        const {data,error}=await sb.from('cycle_plans').insert(payload).select('id').single();
        if(!error&&data){ cycleData.id=data.id; await loadAllCycles();
          const sel=document.getElementById('cycle-selector'); if(sel)sel.value=cycleData.id; }
      }
      const ind=document.getElementById('cycle-autosave-indicator');
      if(ind){ind.textContent='✓ Enregistré';ind.style.opacity='1';setTimeout(()=>{if(ind)ind.style.opacity='0';},1400);}
    }catch(e){console.warn('autoSaveCycleNow theme',e);}
  };
})();

// ── Patch loadCycle pour charger themes + themeCells ─
(function(){
  if(window.__themeLoadBound) return;
  window.__themeLoadBound = true;
  const _origLoad = window.loadCycle;
  window.loadCycle = async function(id){
    await _origLoad.apply(this,arguments);
    // Après chargement, récupérer themes + theme_cells depuis la DB
    if(!id) return;
    try{
      const {data}=await sb.from('cycle_plans').select('themes,theme_cells,summary_row').eq('id',id).single();
      if(data){
        if(data.themes) cycleData.themes=data.themes;
        if(data.theme_cells) cycleData.themeCells=data.theme_cells;
        if(data.summary_row) cycleData.summaryRow=data.summary_row;
      }
    }catch(e){console.warn('loadCycle themes',e);}
    if(cycleMode==='cycle') renderCycleGridNew();
  };
})();

// ── Config thèmes (panneau Vue Cycle) ────────────────
function renderCycleThemesConfig(){
  _ensureCycleThemes();
  const themes = cycleData.themes;
  let el = document.getElementById('cycle-themes-config');
  if(!el){
    // Créer le panneau de config thèmes dans cycle-config-cycle
    const container = document.getElementById('cycle-config-cycle');
    if(!container) return;
    const wrap = document.createElement('div');
    wrap.id = 'cycle-themes-config-wrap';
    wrap.style.cssText = 'width:100%;margin-top:8px;border-top:1px solid var(--border2);padding-top:10px';
    wrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:1px">Thèmes (lignes)</span>
      <button onclick="addCycleTheme()" style="padding:5px 10px;background:var(--card2);border:1px solid var(--border2);color:var(--text2);border-radius:7px;font-size:11px;cursor:pointer">+ Thème</button>
    </div>
    <div id="cycle-themes-config" style="display:flex;flex-direction:column;gap:6px"></div>`;
    container.appendChild(wrap);
    el = document.getElementById('cycle-themes-config');
  }
  el.innerHTML = themes.map((t,i)=>`
    <div style="display:flex;align-items:center;gap:6px">
      <div style="display:flex;flex-direction:column;gap:2px">
        <button onclick="moveCycleTheme(${i},-1)" ${i===0?'disabled':''} style="padding:2px 7px;font-size:11px;line-height:1.4;background:var(--card2);border:1px solid var(--border2);color:var(--text2);border-radius:4px;cursor:pointer;${i===0?'opacity:.3':''}">↑</button>
        <button onclick="moveCycleTheme(${i},1)" ${i===themes.length-1?'disabled':''} style="padding:2px 7px;font-size:11px;line-height:1.4;background:var(--card2);border:1px solid var(--border2);color:var(--text2);border-radius:4px;cursor:pointer;${i===themes.length-1?'opacity:.3':''}">↓</button>
      </div>
      <input type="text" class="form-input" value="${t}"
        oninput="cycleData.themes[${i}]=this.value;renderCycleGridNew();scheduleAutoSaveCycle()"
        style="flex:1;padding:8px 12px;font-size:13px">
      ${themes.length>1?`<button onclick="removeCycleTheme(${i})" style="padding:8px 10px;background:rgba(255,68,68,.1);border:1px solid rgba(255,68,68,.3);color:var(--red);border-radius:8px;font-size:12px;cursor:pointer">✕</button>`:''}
    </div>`).join('');
}

function addCycleTheme(){
  _ensureCycleThemes();
  cycleData.themes.push('Nouveau thème');
  renderCycleThemesConfig();
  renderCycleGridNew();
  scheduleAutoSaveCycle();
}

function removeCycleTheme(i){
  _ensureCycleThemes();
  cycleData.themes.splice(i,1);
  renderCycleThemesConfig();
  renderCycleGridNew();
  scheduleAutoSaveCycle();
}

function moveCycleTheme(ti, dir){
  _ensureCycleThemes();
  const themes = cycleData.themes;
  const newTi = ti+dir;
  if(newTi<0||newTi>=themes.length) return;
  [themes[ti],themes[newTi]] = [themes[newTi],themes[ti]];
  // Remap themeCells
  const cells = cycleData.themeCells;
  const weeks = cycleData.weeks||8;
  for(let wk=0;wk<weeks;wk++){
    for(let di=0;di<6;di++){
      const keyA=`t${wk}-${ti}-${di}`;
      const keyB=`t${wk}-${newTi}-${di}`;
      const tmp=cells[keyA];
      if(cells[keyB]!==undefined){cells[keyA]=cells[keyB];}else{delete cells[keyA];}
      if(tmp!==undefined){cells[keyB]=tmp;}else{delete cells[keyB];}
    }
  }
  renderCycleThemesConfig();
  renderCycleGridNew();
  scheduleAutoSaveCycle();
}

// ── Patch setCycleMode pour brancher la nouvelle vue ─
(function(){
  if(window.__setCycleModeBound) return;
  window.__setCycleModeBound = true;
  const _origSetMode = window.setCycleMode;
  window.setCycleMode = function(mode){
    _origSetMode.apply(this,arguments);
    if(mode==='cycle'){
      _ensureCycleThemes();
      renderCycleThemesConfig();
      renderCycleGridNew();
    }
  };
})();

// ── Patch renderCycleGrid pour intercepter mode cycle ─
(function(){
  if(window.__renderCycleGridNewBound) return;
  window.__renderCycleGridNewBound = true;
  const _origRender = window.renderCycleGrid;
  window.renderCycleGrid = function(){
    if(cycleMode!=='cycle'){ _origRender.apply(this,arguments); return; }
    renderCycleGridNew();
  };
})();

// Init au chargement si on est en mode cycle
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    if(cycleMode==='cycle'||!cycleMode){
      _ensureCycleThemes();
      renderCycleThemesConfig();
      renderCycleGridNew();
    }
  },800);
});

// ===================================================
// PATCH _cycleTopTags — lit themeCells en priorité
// pour alimenter le récap des cards de cycles
// ===================================================
(function(){
  if(window.__cycleTopTagsBound) return;
  window.__cycleTopTagsBound = true;

  const _orig = window._cycleTopTags;
  window._cycleTopTags = function(c, max=4){
    // 0) Lire summaryRow en priorité (résumé explicite par jour)
    const summaryRow = c.summary_row || {};
    if(Object.keys(summaryRow).length){
      const seen = new Set(); const tags = [];
      Object.values(summaryRow).forEach(arr=>{
        (arr||[]).forEach(chip=>{
          const k=(chip.text||'').trim().toUpperCase();
          if(!k||seen.has(k)) return;
          seen.add(k);
          tags.push({text:chip.text,color:chip.color||'#e8ff47',n:1});
        });
      });
      if(tags.length) return tags.slice(0,max);
    }
    const themeCells = c.theme_cells || {};
    const themes     = c.themes || [];
    const weeks      = parseInt(c.weeks) || 0;

    if(themes.length && Object.keys(themeCells).length){
      // Compter les jours remplis par thème
      const counts = {}; // { themeName: { n, color } }
      for(let wk=0; wk<weeks; wk++){
        themes.forEach((name,ti)=>{
          for(let di=0; di<6; di++){
            const arr = themeCells[`t${wk}-${ti}-${di}`]||[];
            if(arr.length){
              if(!counts[name]) counts[name]={n:0,color:arr[0].color||'#e8ff47'};
              counts[name].n += arr.length;
            }
          }
        });
      }
      const sorted = Object.entries(counts)
        .sort((a,b)=>b[1].n-a[1].n)
        .slice(0,max)
        .map(([text,v])=>({text,color:v.color,n:v.n}));
      if(sorted.length) return sorted;
    }

    // Pas de fallback sur l'ancienne logique
    return [];
  };
})();

// ===================================================
// PATCH loadAllCycles — inclure summary_row + themes
// dans la sélection pour alimenter _cycleTopTags
// ===================================================
(function(){
  if(window.__loadAllCyclesPatchBound) return;
  window.__loadAllCyclesPatchBound = true;
  const _orig = window.loadAllCycles;
  window.loadAllCycles = async function(){
    await _orig.apply(this, arguments);
    // Recharger summary_row + themes pour tous les cycles déjà dans allCycles
    if(!allCycles || !allCycles.length) return;
    try{
      const ids = allCycles.map(c=>c.id).filter(Boolean);
      if(!ids.length) return;
      const {data} = await sb.from('cycle_plans')
        .select('id,summary_row,themes,theme_cells')
        .in('id', ids);
      if(!data) return;
      data.forEach(row=>{
        const c = allCycles.find(x=>x.id===row.id);
        if(!c) return;
        if(row.summary_row) c.summary_row = row.summary_row;
        if(row.themes)      c.themes      = row.themes;
        if(row.theme_cells) c.theme_cells = row.theme_cells;
      });
    } catch(e){ console.warn('loadAllCycles patch summary_row', e); }
  };
})();

// ===================================================
// DÉPLACEMENT DES CHIPS ← → ↑ ↓
// Fonctionne pour vue session (sessionCells) et
// vue cycle/thème (themeCells)
// ===================================================

function _moveChip(bucket, keyFrom, chi, keyTo){
  if(!bucket[keyFrom] || !bucket[keyFrom][chi]) return false;
  const chip = bucket[keyFrom].splice(chi, 1)[0];
  if(!bucket[keyTo]) bucket[keyTo] = [];
  bucket[keyTo].push(chip);
  return true;
}

// ── Vue Session ──────────────────────────────────────
function moveSessionChip(wk, ri, di, chi, dri, ddi){
  const rows = cycleData.rows;
  const DAYS_N = 7;
  const newRi = ri + dri;
  const newDi = di + ddi;
  if(newRi < 0 || newRi >= rows.length) return;
  if(newDi < 0 || newDi >= DAYS_N) return;
  const keyFrom = `w${wk}-${ri}-${di}`;
  const keyTo   = `w${wk}-${newRi}-${newDi}`;
  if(_moveChip(cycleData.sessionCells, keyFrom, chi, keyTo)){
    if(typeof renderSessionGrid === 'function') renderSessionGrid();
    scheduleAutoSaveCycle();
  }
}

// ── Vue Cycle/Thème ──────────────────────────────────
function moveThemeChip(wk, ti, di, chi, dti, ddi){
  _ensureCycleThemes();
  const themes = cycleData.themes;
  const DAYS_N = 7;
  const newTi = ti + dti;
  const newDi = di + ddi;
  if(newTi < 0 || newTi >= themes.length) return;
  if(newDi < 0 || newDi >= DAYS_N) return;
  const keyFrom = `t${wk}-${ti}-${di}`;
  const keyTo   = `t${wk}-${newTi}-${newDi}`;
  if(_moveChip(cycleData.themeCells, keyFrom, chi, keyTo)){
    renderCycleGridNew();
    scheduleAutoSaveCycle();
  }
}

// ── Patch renderSessionGrid : restructurer chips avec barre haute ←→↑↓ ─
(function(){
  if(window.__sessionChipMoveBound) return;
  window.__sessionChipMoveBound = true;

  function _patch(){
    const orig = window.renderSessionGrid;
    if(!orig || orig.__chipMovePatchedSession) return;
    window.renderSessionGrid = function(){
      orig.apply(this, arguments);
      const grid = document.getElementById('cycle-grid');
      if(!grid) return;
      grid.querySelectorAll('.session-chip').forEach(chipEl => {
        if(chipEl.querySelector('.chip-move-btns')) return;
        const delBtn   = chipEl.querySelector('.session-chip-del');
        const toggle   = chipEl.querySelector('.chip-toggle');
        const textSpan = chipEl.querySelector('.session-chip-text');
        if(!delBtn || !toggle || !textSpan) return;

        const delOnclick = delBtn.getAttribute('onclick')||'';
        const keyMatch = delOnclick.match(/'(w\d+-(\d+)-(\d+))'/);
        const chiMatch = delOnclick.match(/,(\d+)\)/);
        if(!keyMatch || !chiMatch) return;
        const key = keyMatch[1];
        const km = key.match(/^w(\d+)-(\d+)-(\d+)$/);
        if(!km) return;
        const wk=parseInt(km[1]), ri=parseInt(km[2]), di=parseInt(km[3]);
        const chi = parseInt(chiMatch[1]);
        const rows = cycleData.rows||[];
        const DAYS_N = 7;
        const fg = chipEl.style.color;
        const mvBtn = (label, disabled, fn) => {
          const s = `padding:1px 5px;font-size:9px;background:rgba(0,0,0,.25);border:none;color:${fg||'inherit'};border-radius:3px;cursor:${disabled?'default':'pointer'};opacity:${disabled?'.2':'.8'};line-height:1.3`;
          return `<button style="${s}" ${disabled?'disabled':''} onclick="event.stopPropagation();${disabled?'':fn}">${label}</button>`;
        };

        chipEl.style.flexDirection = 'column';
        chipEl.style.alignItems    = '';
        chipEl.style.gap           = '4px';
        chipEl.style.padding       = '6px 6px 5px';

        const topBar = document.createElement('div');
        topBar.className = 'chip-move-btns';
        topBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:4px;width:100%';

        const rightBtns = document.createElement('div');
        rightBtns.style.cssText = 'display:flex;gap:2px;align-items:center';
        rightBtns.innerHTML = `
          ${mvBtn('↑', ri===0,              `moveSessionChip(${wk},${ri},${di},${chi},-1,0)`)}
          ${mvBtn('↓', ri===rows.length-1,  `moveSessionChip(${wk},${ri},${di},${chi},1,0)`)}
          ${mvBtn('←', di===0,              `moveSessionChip(${wk},${ri},${di},${chi},0,-1)`)}
          ${mvBtn('→', di===DAYS_N-1,       `moveSessionChip(${wk},${ri},${di},${chi},0,1)`)}
        `;
        rightBtns.appendChild(delBtn);

        toggle.style.flexShrink = '0';
        topBar.appendChild(toggle);
        topBar.appendChild(rightBtns);

        // Remettre dans l'ordre : barre haute, texte
        chipEl.innerHTML = '';
        chipEl.appendChild(topBar);
        textSpan.style.cssText = 'white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.5;width:100%';
        chipEl.appendChild(textSpan);
      });
    };
    window.renderSessionGrid.__chipMovePatchedSession = true;
  }

  if(typeof renderSessionGrid === 'function') _patch();
  else document.addEventListener('DOMContentLoaded', _patch);
})();

// (boutons ←→↑↓ vue cycle intégrés directement dans renderCycleGridNew)

// ===================================================
// PATCH openDuplicateCellSameCycle + openDuplicateCellToCycle
// pour supporter _themeCellTarget (vue cycle nouvelle)
// ===================================================
(function(){
  if(window.__dupCyclePatchBound) return;
  window.__dupCyclePatchBound = true;

  const _origSame = window.openDuplicateCellSameCycle;
  window.openDuplicateCellSameCycle = function(){
    // Si _themeCellTarget actif, construire un cycleCellTarget compatible
    if(_themeCellTarget && !cycleCellTarget){
      const t = _themeCellTarget;
      if(t.summary) { showToast('⚠️ Duplication non disponible sur la ligne Résumé'); return; }
      const key = `t${t.wk}-${t.ti}-${t.di}`;
      const chips = (cycleData.themeCells[key]||[]);
      if(!chips.length){ showToast('⚠️ Cette case est vide'); return; }
      const totalWeeks = parseInt(document.getElementById('cycle-weeks')?.value)||cycleData.weeks||8;
      const currentWeek = t.wk+1;
      const input = prompt(`Dupliquer ce bloc vers quelle(s) semaine(s) ? (1-${totalWeeks})\nEx: 2  ou  2,3,5  ou  2-4`, String(Math.min(currentWeek+1,totalWeeks)));
      if(!input) return;
      const targets = new Set();
      input.split(',').forEach(part=>{
        const p=part.trim(); if(!p) return;
        const range=p.match(/^(\d+)\s*-\s*(\d+)$/);
        if(range){const a=parseInt(range[1]),b=parseInt(range[2]);for(let i=Math.min(a,b);i<=Math.max(a,b);i++)targets.add(i);}
        else {const n=parseInt(p);if(!isNaN(n))targets.add(n);}
      });
      let added=0;
      targets.forEach(wkOneBased=>{
        if(wkOneBased<1||wkOneBased>totalWeeks) return;
        if(wkOneBased===currentWeek) return;
        const targetW=wkOneBased-1;
        const newKey=`t${targetW}-${t.ti}-${t.di}`;
        const cloned=JSON.parse(JSON.stringify(chips)).map(c=>({...c,done:false}));
        cycleData.themeCells[newKey]=(cycleData.themeCells[newKey]||[]).concat(cloned);
        added++;
      });
      if(!added){showToast('⚠️ Aucune semaine valide');return;}
      closeCycleCellModal();
      renderCycleGridNew();
      scheduleAutoSaveCycle();
      showToast(`✅ Bloc dupliqué sur ${added} semaine${added>1?'s':''}`);
      return;
    }
    _origSame.apply(this, arguments);
  };

  const _origToCycle = window.openDuplicateCellToCycle;
  window.openDuplicateCellToCycle = function(){
    if(_themeCellTarget && !cycleCellTarget){
      const t = _themeCellTarget;
      if(t.summary){ showToast('⚠️ Duplication non disponible sur la ligne Résumé'); return; }
      const key = `t${t.wk}-${t.ti}-${t.di}`;
      const chips = (cycleData.themeCells[key]||[]);
      if(!chips.length){ showToast('⚠️ Cette case est vide'); return; }
      const others=(allCycles||[]).filter(c=>c.id!==cycleData.id);
      if(!others.length){showToast('⚠️ Aucun autre cycle disponible');return;}
      const sel=document.getElementById('dup-cycle-select');
      sel.innerHTML=others.map(c=>`<option value="${c.id}">${(c.name||'Sans nom').replace(/</g,'&lt;')}</option>`).join('');
      document.getElementById('dup-cycle-week').value=t.wk+1;
      // Stocker la source dans _dupCellSource avec mode 'theme'
      window._dupThemeCellSource={key,chips:JSON.parse(JSON.stringify(chips)),ti:t.ti,di:t.di};
      document.getElementById('dup-cycle-modal').classList.add('open');
      return;
    }
    _origToCycle.apply(this, arguments);
  };

  // Patch confirmDuplicateCellToCycle pour gérer mode theme
  const _origConfirm = window.confirmDuplicateCellToCycle;
  window.confirmDuplicateCellToCycle = async function(){
    if(window._dupThemeCellSource){
      const src = window._dupThemeCellSource;
      const targetId = document.getElementById('dup-cycle-select').value;
      const targetWeek = Math.max(1,parseInt(document.getElementById('dup-cycle-week').value)||1)-1;
      if(!targetId){showToast('⚠️ Choisis un cycle');return;}
      const {data:tc,error}=await sb.from('cycle_plans').select('*').eq('id',targetId).single();
      if(error||!tc){showToast('⚠️ Cycle introuvable');return;}
      const themeCells=tc.theme_cells||{};
      const newKey=`t${targetWeek}-${src.ti}-${src.di}`;
      themeCells[newKey]=(themeCells[newKey]||[]).concat(src.chips.map(c=>({...c,done:false})));
      const {error:upErr}=await sb.from('cycle_plans').update({theme_cells:themeCells}).eq('id',targetId);
      if(upErr){showToast('❌ Erreur: '+upErr.message);return;}
      showToast('✅ Bloc dupliqué vers '+(tc.name||'cycle'));
      window._dupThemeCellSource=null;
      document.getElementById('dup-cycle-modal').classList.remove('open');
      closeCycleCellModal();
      return;
    }
    _origConfirm.apply(this, arguments);
  };
})();

// ===================================================
// PATCH retour vers onglet Cycle après publication
// Quand la séance vient de sendThemeChipToSession,
// _returnToCycleAfterSave = 'cycle' | 'session'
// On intercepte avant le test _returnToPlanningAfterSave
// ===================================================
(function(){
  if(window.__returnToCyclePatchBound) return;
  window.__returnToCyclePatchBound = true;

  function _doCycleReturn(){
    const mode = window._returnToCycleAfterSave;
    window._returnToCycleAfterSave = null;
    // Aller sur page-admin > onglet Cycle
    const cycleTabBtn = Array.from(document.querySelectorAll('.admin-tab-btn'))
      .find(b=>(b.getAttribute('onclick')||'').includes("'cycle'"));
    if(typeof adminTab==='function' && cycleTabBtn){
      adminTab('cycle', cycleTabBtn);
    }
    // Rétablir le bon sous-mode (vue cycle ou vue session)
    if(typeof setCycleMode === 'function'){
      setCycleMode(mode === 'session' ? 'session' : 'cycle');
    }
  }

  // Attendre que saveSession soit définie (elle l'est dans admin.js)
  function _patchSaveSession(){
    const _orig = window.saveSession;
    if(!_orig || _orig.__returnToCyclePatch) return;
    window.saveSession = async function(){
      // Si flag cycle actif, on le consomme après l'exécution originale
      const hasCycleReturn = !!window._returnToCycleAfterSave;
      if(hasCycleReturn){
        // Neutraliser les autres flags de retour pour éviter conflit
        window._returnToPlanningAfterSave = false;
        window._returnToSessionsAfterSave = false;
      }
      await _orig.apply(this, arguments);
      if(hasCycleReturn) _doCycleReturn();
    };
    window.saveSession.__returnToCyclePatch = true;
  }

  if(typeof saveSession === 'function') _patchSaveSession();
  else document.addEventListener('DOMContentLoaded', _patchSaveSession);
  // Sécurité : réessayer après un court délai si admin.js charge après wellness.js
  setTimeout(_patchSaveSession, 800);
})();


// ===================================================
// COLLAPSE / EXPAND SEMAINES - VUE CYCLE + VUE SESSION
// Bouton collapse sur chaque header semaine
// State: window.__cycleWeeksCollapsed (Set), persiste
// cle: "cycle-{wk}" ou "session-{wk}"
// ===================================================
(function(){
  if(window.__weekCollapsePatchBound) return;
  window.__weekCollapsePatchBound = true;

  function _loadC(){ try{ return new Set(JSON.parse(localStorage.getItem('__cwc')||'[]')); }catch(e){ return new Set(); } }
  function _saveC(s){ try{ localStorage.setItem('__cwc',JSON.stringify([...s])); }catch(e){} }
  window.__cycleWeeksCollapsed = _loadC();

  window.toggleCycleWeek = function(key){
    var s = window.__cycleWeeksCollapsed;
    if(s.has(key)) s.delete(key); else s.add(key);
    _saveC(s);
    if(typeof cycleMode !== 'undefined'){
      if(cycleMode==='session' && typeof renderSessionGrid==='function') renderSessionGrid();
      else if(typeof renderCycleGridNew==='function') renderCycleGridNew();
    }
  };

  function _applyCollapse(grid, prefix){
    var s = window.__cycleWeeksCollapsed;
    var wkIdx = 0;
    Array.from(grid.children).forEach(function(block){
      if(block.tagName !== 'DIV') return;
      var hdrEl = block.querySelector('div[style*="Bebas Neue"]');
      if(!hdrEl) return;
      var key = prefix + '-' + wkIdx;
      var collapsed = s.has(key);
      if(!block.getAttribute('data-wcb')){
        block.setAttribute('data-wcb', key);
        hdrEl.style.display = 'flex';
        hdrEl.style.alignItems = 'center';
        hdrEl.style.gap = '8px';
        hdrEl.style.cursor = 'pointer';
        var btn = document.createElement('button');
        btn.className = 'week-collapse-btn';
        btn.style.cssText = 'background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;padding:0 4px;line-height:1;flex-shrink:0;opacity:.8';
        (function(k){ btn.onclick = function(e){ e.stopPropagation(); window.toggleCycleWeek(k); }; })(key);
        hdrEl.insertBefore(btn, hdrEl.firstChild);
        (function(k, b){ hdrEl.addEventListener('click', function(e){ if(e.target===b || (e.target.closest && e.target.closest('.week-collapse-btn'))) return; window.toggleCycleWeek(k); }); })(key, btn);
      }
      var btnEl = block.querySelector('.week-collapse-btn');
      if(btnEl){ btnEl.innerHTML = collapsed ? '&#9654;' : '&#9660;'; btnEl.title = collapsed ? 'Developper' : 'Reduire'; }
      var tbl = block.querySelector('table');
      if(tbl) tbl.style.display = collapsed ? 'none' : '';
      wkIdx++;
    });
  }

  function _patchFn(fnName, prefix){
    var _orig = window[fnName];
    if(!_orig || _orig.__weekCollapsePatch) return;
    window[fnName] = function(){
      _orig.apply(this, arguments);
      var grid = document.getElementById('cycle-grid');
      if(grid) _applyCollapse(grid, prefix);
    };
    window[fnName].__weekCollapsePatch = true;
  }

  function _tryPatch(){
    if(typeof renderCycleGridNew==='function') _patchFn('renderCycleGridNew','cycle');
    if(typeof renderSessionGrid==='function')  _patchFn('renderSessionGrid','session');
  }

  _tryPatch();
  document.addEventListener('DOMContentLoaded', _tryPatch);
  setTimeout(_tryPatch, 800);
})();


// ===================================================
// COLLAPSE config panels: Categories (Vue Session)
// et Themes (Vue Cycle)
// Toggle sur le header "CATEGORIES (LIGNES)" /
// "THEMES (LIGNES)"
// ===================================================
(function(){
  if(window.__configCollapsePatchBound) return;
  window.__configCollapsePatchBound = true;

  function _loadCC(){ try{ return JSON.parse(localStorage.getItem('__ccc')||'{}'); }catch(e){ return {}; } }
  function _saveCC(o){ try{ localStorage.setItem('__ccc', JSON.stringify(o)); }catch(e){} }
  window.__configCollapsed = _loadCC();

  function _injectConfigToggle(headerEl, contentEl, key){
    if(!headerEl || !contentEl) return;
    if(headerEl.getAttribute('data-cctoggle')) return; // already patched
    headerEl.setAttribute('data-cctoggle', key);
    headerEl.style.cursor = 'pointer';
    headerEl.style.userSelect = 'none';

    var btn = document.createElement('button');
    btn.className = 'config-collapse-btn';
    btn.style.cssText = 'background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;padding:0 4px 0 0;line-height:1;flex-shrink:0;opacity:.8;vertical-align:middle';

    // Insert before span text
    var spanEl = headerEl.querySelector('span') || headerEl.firstChild;
    if(spanEl && spanEl.parentNode === headerEl){
      headerEl.insertBefore(btn, spanEl);
    } else {
      headerEl.insertBefore(btn, headerEl.firstChild);
    }

    function _update(){
      var collapsed = !!window.__configCollapsed[key];
      btn.innerHTML = collapsed ? '&#9654;' : '&#9660;';
      btn.title = collapsed ? 'Developper' : 'Reduire';
      contentEl.style.display = collapsed ? 'none' : '';
    }

    _update();

    function _toggle(e){
      e.stopPropagation();
      var o = window.__configCollapsed;
      o[key] = !o[key];
      _saveCC(o);
      _update();
    }

    btn.onclick = _toggle;
    headerEl.addEventListener('click', function(e){
      if(e.target === btn) return;
      _toggle(e);
    });
  }

  function _patchConfigPanels(){
    // --- Vue Session: #cycle-config-session ---
    var sessionPanel = document.getElementById('cycle-config-session');
    if(sessionPanel){
      var hdrRow = sessionPanel.querySelector('div[style*="justify-content:space-between"]');
      var content = document.getElementById('session-rows-config');
      if(hdrRow && content){
        _injectConfigToggle(hdrRow, content, 'session-config');
      }
    }

    // --- Vue Cycle: #cycle-themes-config-wrap ---
    var cycleWrap = document.getElementById('cycle-themes-config-wrap');
    if(cycleWrap){
      var hdrRow2 = cycleWrap.querySelector('div[style*="justify-content:space-between"]');
      var content2 = document.getElementById('cycle-themes-config');
      if(hdrRow2 && content2){
        _injectConfigToggle(hdrRow2, content2, 'cycle-config');
      }
    }
  }

  // Re-patch apres renderCycleThemesConfig car il recreee le wrap
  function _patchRenderThemes(){
    var _orig = window.renderCycleThemesConfig;
    if(!_orig || _orig.__configCollapsePatch) return;
    window.renderCycleThemesConfig = function(){
      _orig.apply(this, arguments);
      _patchConfigPanels();
    };
    window.renderCycleThemesConfig.__configCollapsePatch = true;
  }

  function _patchRenderSession(){
    var _orig = window.renderSessionRowsConfig;
    if(!_orig || _orig.__configCollapsePatch) return;
    window.renderSessionRowsConfig = function(){
      _orig.apply(this, arguments);
      _patchConfigPanels();
    };
    window.renderSessionRowsConfig.__configCollapsePatch = true;
  }

  function _tryAll(){
    _patchConfigPanels();
    _patchRenderThemes();
    _patchRenderSession();
  }

  _tryAll();
  document.addEventListener('DOMContentLoaded', _tryAll);
  setTimeout(_tryAll, 1000);
  setTimeout(_tryAll, 2000);
})();

// ===== DUP WEEK PLANNING V2 (remplace openDupWeekModal d'admin.js) =====
function openDupWeekModalV2(){
  const progId=document.getElementById('admin-filter-prog')?.value;
  if(!progId){showToast('⚠️ Aucun programme sélectionné');return;}
  const prog=getProgById(progId);
  const oneshot=isOneshotProg(prog);
  const modal=document.getElementById('dup-week-modal');
  if(!modal){showToast('⚠️ Modal introuvable');return;}

  // Reset destination
  const destSel=document.getElementById('dup-week-dest-type');
  if(destSel) destSel.value='same_prog';

  // Remplir source + groupes par défaut (même prog)
  if(oneshot){
    const weekNum=adminWeekOffset+1;
    const total=prog.total_weeks||8;
    document.getElementById('dup-week-source-label').textContent=`Semaine ${weekNum} / ${total}`;
    document.getElementById('dup-week-oneshot-group').style.display='';
    document.getElementById('dup-week-date-group').style.display='none';
    const sel=document.getElementById('dup-week-target-week');
    sel.innerHTML=Array.from({length:total},(_,i)=>{
      const w=i+1;
      return`<option value="${w}" ${w===weekNum?'disabled':''}>Semaine ${w}${w===weekNum?' (actuelle)':''}</option>`;
    }).join('');
    sel.value=String(Math.min(weekNum+1,total));
  } else {
    const dates=getWeekDates(adminWeekOffset);
    const wk=getWeekNum(dates[0]);
    document.getElementById('dup-week-source-label').textContent=`Sem. ${wk} — ${MONTHS[dates[0].getMonth()]} ${dates[0].getFullYear()}`;
    document.getElementById('dup-week-oneshot-group').style.display='none';
    document.getElementById('dup-week-date-group').style.display='';
    const nextMon=new Date(dates[0]);nextMon.setDate(dates[0].getDate()+7);
    document.getElementById('dup-week-target-date').value=nextMon.toISOString().split('T')[0];
  }
  const dl=document.getElementById('dup-week-date-label');
  if(dl) dl.textContent='Lundi de la semaine cible';

  // Masquer groupes spéciaux
  document.getElementById('dup-week-other-prog-group').style.display='none';
  document.getElementById('dup-week-perso-group').style.display='none';

  // Remplir autres programmes
  const otherProgs=(window.programmes||[]).filter(p=>p.id!==progId);
  document.getElementById('dup-week-target-prog').innerHTML=otherProgs.length
    ? otherProgs.map(p=>`<option value="${p.id}" data-type="${p.type||''}" data-weeks="${p.total_weeks||0}">${p.icon||'💪'} ${p.name}</option>`).join('')
    : '<option value="">— Aucun autre programme —</option>';
  if(otherProgs.length) onDupWeekTargetProgChange();

  // Remplir athlètes perso
  const athletes=persoAthletesCache.filter(a=>a.role!=='admin');
  document.getElementById('dup-week-target-athlete').innerHTML=athletes.length
    ? athletes.map(a=>`<option value="${a.id}">${a.full_name||a.email||a.id}</option>`).join('')
    : '<option value="">— Aucun athlète —</option>';

  modal.classList.add('open');
}

function onDupWeekDestChange(){
  const dest=document.getElementById('dup-week-dest-type').value;
  const progId=document.getElementById('admin-filter-prog')?.value;
  const prog=getProgById(progId);
  const oneshot=isOneshotProg(prog);

  document.getElementById('dup-week-oneshot-group').style.display=(dest==='same_prog'&&oneshot)?'':'none';
  document.getElementById('dup-week-date-group').style.display=
    (dest==='same_prog'&&!oneshot)||(dest==='perso')||(dest==='perso'&&oneshot)?'':'none';
  document.getElementById('dup-week-other-prog-group').style.display=dest==='other_prog'?'':'none';
  document.getElementById('dup-week-perso-group').style.display=dest==='perso'?'':'none';

  const dl=document.getElementById('dup-week-date-label');
  if(dest==='perso'&&oneshot){
    // one-shot→perso : on a besoin d'un lundi de référence
    document.getElementById('dup-week-date-group').style.display='';
    if(dl) dl.textContent='Lundi de référence (semaine cible)';
    const now=new Date();const dd=now.getDay();
    const mon=new Date(now);mon.setDate(now.getDate()-(dd===0?6:dd-1)+7);
    document.getElementById('dup-week-target-date').value=mon.toISOString().split('T')[0];
  } else if(dl){
    dl.textContent='Lundi de la semaine cible';
  }

  if(dest==='other_prog') onDupWeekTargetProgChange();
}

function onDupWeekTargetProgChange(){
  const sel=document.getElementById('dup-week-target-prog');
  const opt=sel.selectedOptions[0];
  if(!opt)return;
  const type=opt.getAttribute('data-type');
  const weeks=parseInt(opt.getAttribute('data-weeks')||'0');
  const oDiv=document.getElementById('dup-week-other-prog-oneshot');
  const dDiv=document.getElementById('dup-week-other-prog-date');
  if(type==='oneshot'&&weeks>0){
    oDiv.style.display='';
    dDiv.style.display='none';
    document.getElementById('dup-week-other-prog-week').innerHTML=
      Array.from({length:weeks},(_,i)=>`<option value="${i+1}">Semaine ${i+1}</option>`).join('');
  } else {
    oDiv.style.display='none';
    dDiv.style.display='';
    const dates=getWeekDates(adminWeekOffset);
    const nextMon=new Date(dates[0]);nextMon.setDate(dates[0].getDate()+7);
    document.getElementById('dup-week-other-prog-target-date').value=nextMon.toISOString().split('T')[0];
  }
}

async function confirmDupWeekV2(){
  const dest=document.getElementById('dup-week-dest-type').value;
  const progId=document.getElementById('admin-filter-prog')?.value;
  if(!progId){showToast('⚠️ Aucun programme sélectionné');return;}
  const prog=getProgById(progId);
  const oneshot=isOneshotProg(prog);
  const btn=document.getElementById('dup-week-confirm-btn');
  if(btn){btn.disabled=true;btn.textContent='Copie...';}
  try{
    if(dest==='same_prog'){
      // Délègue à la fonction existante d'admin.js (elle gère le close+reload)
      await confirmDupWeek();
      return;
    }
    if(dest==='other_prog') await _dupWeekToOtherProg(progId,prog,oneshot);
    if(dest==='perso')      await _dupWeekToPerso(progId,prog,oneshot);
  } finally {
    if(btn){btn.disabled=false;btn.textContent='📋 Dupliquer la semaine';}
  }
}

async function _dupWeekToOtherProg(srcProgId,srcProg,srcOneshot){
  const tgtProgId=document.getElementById('dup-week-target-prog').value;
  if(!tgtProgId){showToast('⚠️ Aucun programme cible');return;}
  const tgtProg=getProgById(tgtProgId);
  const tgtOneshot=isOneshotProg(tgtProg);

  // Charger sessions source
  let data,error;
  if(srcOneshot){
    const srcWeek=adminWeekOffset+1;
    ({data,error}=await sb.from('sessions').select('*').eq('programme_id',srcProgId).eq('week_number',srcWeek));
  } else {
    const srcDates=getWeekDates(adminWeekOffset).map(d=>d.toISOString().split('T')[0]);
    ({data,error}=await sb.from('sessions').select('*').in('date',srcDates).eq('programme_id',srcProgId));
  }
  if(error){showToast('❌ '+error.message);return;}
  if(!data||!data.length){showToast('⚠️ Aucune séance à copier');return;}

  let rows;
  if(tgtOneshot){
    const tgtWeek=parseInt(document.getElementById('dup-week-other-prog-week').value);
    if(!tgtWeek){showToast('⚠️ Choisis une semaine cible');return;}
    if(srcOneshot){
      // one-shot → one-shot
      rows=data.map(({id,created_at,...rest})=>({...rest,programme_id:tgtProgId,week_number:tgtWeek,created_by:currentUser.id}));
    } else {
      // abo → one-shot : date → day_of_week
      rows=data.map(({id,created_at,...rest})=>{
        const d=new Date(rest.date+'T12:00:00');
        const dow=d.getDay()===0?7:d.getDay();
        return{...rest,programme_id:tgtProgId,week_number:tgtWeek,day_of_week:dow,date:null,created_by:currentUser.id};
      });
    }
  } else {
    const tgtDateStr=document.getElementById('dup-week-other-prog-target-date').value;
    if(!tgtDateStr){showToast('⚠️ Choisis une date cible');return;}
    const tgtPicked=new Date(tgtDateStr+'T12:00:00');
    const tgtDay=tgtPicked.getDay();
    const tgtMon=new Date(tgtPicked);tgtMon.setDate(tgtPicked.getDate()-(tgtDay===0?6:tgtDay-1));
    if(srcOneshot){
      // one-shot → abo : week_number+day_of_week → date
      rows=data.map(({id,created_at,...rest})=>{
        const dow=(rest.day_of_week||1)-1;
        const d=new Date(tgtMon);d.setDate(tgtMon.getDate()+dow);
        return{...rest,programme_id:tgtProgId,date:d.toISOString().split('T')[0],week_number:null,day_of_week:null,created_by:currentUser.id};
      });
    } else {
      // abo → abo
      const srcMon=getWeekDates(adminWeekOffset)[0];
      const diffDays=Math.round((tgtMon-srcMon)/(24*60*60*1000));
      if(diffDays===0){showToast('⚠️ Choisis une semaine différente');return;}
      rows=data.map(({id,created_at,...rest})=>{
        const d=new Date(rest.date+'T12:00:00');d.setDate(d.getDate()+diffDays);
        return{...rest,programme_id:tgtProgId,date:d.toISOString().split('T')[0],created_by:currentUser.id};
      });
    }
  }
  const {error:e2}=await sb.from('sessions').insert(rows);
  if(e2){showToast('❌ '+e2.message);return;}
  showToast(`✅ ${rows.length} séance${rows.length>1?'s':''} → ${tgtProg.name}`);
  closeDupWeekModal();
  loadAdminCalendar();
}

async function _dupWeekToPerso(srcProgId,srcProg,srcOneshot){
  const athleteId=document.getElementById('dup-week-target-athlete').value;
  if(!athleteId){showToast('⚠️ Aucun athlète sélectionné');return;}
  const tgtDateStr=document.getElementById('dup-week-target-date').value;
  if(!tgtDateStr){showToast('⚠️ Choisis un lundi cible');return;}
  const tgtPicked=new Date(tgtDateStr+'T12:00:00');
  const tgtDay=tgtPicked.getDay();
  const tgtMon=new Date(tgtPicked);tgtMon.setDate(tgtPicked.getDate()-(tgtDay===0?6:tgtDay-1));

  let data,error;
  if(srcOneshot){
    const srcWeek=adminWeekOffset+1;
    ({data,error}=await sb.from('sessions').select('*').eq('programme_id',srcProgId).eq('week_number',srcWeek));
  } else {
    const srcDates=getWeekDates(adminWeekOffset).map(d=>d.toISOString().split('T')[0]);
    ({data,error}=await sb.from('sessions').select('*').in('date',srcDates).eq('programme_id',srcProgId));
  }
  if(error){showToast('❌ '+error.message);return;}
  if(!data||!data.length){showToast('⚠️ Aucune séance à copier');return;}

  let rows;
  if(srcOneshot){
    // week_number+day_of_week → date calculée depuis tgtMon
    rows=data.map(({id,created_at,programme_id,week_number,day_of_week,...rest})=>{
      const dow=(day_of_week||1)-1;
      const d=new Date(tgtMon);d.setDate(tgtMon.getDate()+dow);
      return{...rest,athlete_id:athleteId,date:d.toISOString().split('T')[0],created_by:currentUser.id};
    });
  } else {
    const srcMon=getWeekDates(adminWeekOffset)[0];
    const diffDays=Math.round((tgtMon-srcMon)/(24*60*60*1000));
    rows=data.map(({id,created_at,programme_id,week_number,day_of_week,...rest})=>{
      const d=new Date(rest.date+'T12:00:00');d.setDate(d.getDate()+diffDays);
      return{...rest,athlete_id:athleteId,date:d.toISOString().split('T')[0],created_by:currentUser.id};
    });
  }
  const {error:e2}=await sb.from('personal_sessions').insert(rows);
  if(e2){showToast('❌ '+e2.message);return;}
  const ath=persoAthletesCache.find(a=>a.id===athleteId);
  showToast(`✅ ${rows.length} séance${rows.length>1?'s':''} → ${ath?.full_name||'athlète'}`);
  closeDupWeekModal();
}
