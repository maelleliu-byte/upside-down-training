// UTILS
function getScorePlaceholder(type){return{time:'14:32',reps:'87',rounds:'12 + 5',weight:'85',calories:'42',watt:'250',distance:'2.45'}[type]||'—';}
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
    if(readModalIsPerso&&data.athlete_id){
      try{await _readModalAppendRetour(body,data);}catch(e){console.warn('retour modale',e);}
    }
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
// Espace perso : score + détail (séries, VBT, FC, note, wellness) affichés
// directement sous « Voir le classement » dans la fiche séance.
async function _readModalAppendRetour(body,data){
  const [scR,ntR,wR]=await Promise.all([
    sb.from('wod_scores').select('id,session_id,score_value,score_text,score_type,level,sets_data,created_at,ef,vbt')
      .eq('athlete_id',data.athlete_id).eq('session_id',data.id).order('created_at',{ascending:false}).limit(1),
    sb.from('session_notes').select('id,session_id,content,created_at')
      .eq('athlete_id',data.athlete_id).eq('session_id',data.id).order('created_at',{ascending:false}).limit(1),
    sb.from('wellness_entries').select('date,sleep_quality,energy,fatigue,soreness,motivation,stress,notes')
      .eq('athlete_id',data.athlete_id).eq('date',data.date).limit(1)
  ]);
  const sc=(scR.data||[])[0]||null, nt=(ntR.data||[])[0]||null, w=(wR.data||[])[0]||null;
  if(readModalSession!==data)return; // modale fermée ou autre séance ouverte entre-temps
  const inner=(sc||nt||w)?_persoDrawerInner(sc,nt,w):'<div class="perso-r-row"><div class="val" style="color:var(--muted);font-style:italic">Pas encore de retour</div></div>';
  const html=`<div class="read-retour"><div class="read-retour-t">📊 Score &amp; retour</div><div class="perso-r-drawer open" style="margin-top:6px">${inner}</div></div>`;
  const btn=body.querySelector('.btn-open-scores');
  if(btn)btn.insertAdjacentHTML('afterend',html);
  else body.insertAdjacentHTML('beforeend',html);
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

  const all=persoAthletesCache;

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
  document.getElementById('perso-view-day').classList.remove('active');
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
  document.getElementById('perso-view-day').classList.toggle('active',v==='day');
  document.getElementById('perso-view-week').classList.toggle('active',v==='week');
  document.getElementById('perso-view-month').classList.toggle('active',v==='month');
  renderPersoCalendar();
}
function persoNav(dir){persoOffset+=dir;renderPersoCalendar();}

async function renderPersoCalendar(){
  if(!currentPersoAthlete)return;
  const area=document.getElementById('perso-calendar-area');
  area.innerHTML='<div class="spinner"></div>';
  if(persoView==='day'){
    const d=new Date();d.setDate(d.getDate()+persoOffset);
    const iso=d.toISOString().split('T')[0];
    const today=new Date().toISOString().split('T')[0];
    const persoLblElDay=document.getElementById('perso-period-label');
    persoLblElDay.textContent=`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${iso===today?' · aujourd\'hui':''}`;
    persoLblElDay.title='';persoLblElDay.style.cursor='';persoLblElDay.style.textDecoration='';persoLblElDay.onclick=null;
    const {data}=await sb.from('personal_sessions').select('*').eq('athlete_id',currentPersoAthlete.id).eq('date',iso).order('sort_order',{ascending:true,nullsFirst:false}).order('created_at');
    persoSessionsCache=data||[];
    const sessions=persoSessionsCache;
    const _sidsD=sessions.filter(s=>s.type!=='separator').map(s=>s.id);
    await loadPersoRetours(_sidsD,currentPersoAthlete.id,[iso]);
    const w=_persoRetoursCache.wellnessByDate[iso];
    const wellnessBanner=(()=>{
      if(!w)return '';
      const mean=_persoWellMean(w);
      const tone=_persoWellTone(w);
      const meta=[['sleep_quality','😴','Sommeil'],['energy','🔥','Énergie'],['fatigue','💤','Fatigue'],['soreness','🤕','Courbatures'],['motivation','🎯','Motiv.'],['stress','😰','Stress']];
      const chips=meta.filter(m=>typeof w[m[0]]==='number').map(([k,ic,lbl])=>`<span class="c">${ic} ${lbl} ${w[k]}</span>`).join('');
      const wnotes=w.notes?`<div class="wnotes">« ${escapeHtml(w.notes)} »</div>`:'';
      return `<div class="perso-day-wellness ${tone||''}">
        <div class="perso-day-wellness-head">💪 Wellness du jour${mean!=null?` — <b>${mean.toFixed(1)}</b>/10`:''}</div>
        <div class="perso-well-chips">${chips}</div>
        ${wnotes}
      </div>`;
    })();
    const blocks=sessions.length>0?sessions.map(s=>{
      if(s.type==='separator'){
        return`<div class="cal-rich separator" data-sid="${s.id}" onclick="openReadSession('${s.id}','personal')" style="position:relative">
          <div class="cal-rich-actions" style="display:flex;position:absolute;top:2px;right:2px">
            <button class="cal-action-btn" onclick="event.stopPropagation();persoEditSession('${s.id}','${currentPersoAthlete.id}')">✏</button>
            <button class="cal-action-btn" onclick="event.stopPropagation();persoDeleteSession('${s.id}')">✕</button>
          </div>
          <div class="cal-rich-title">— ${escapeHtml(s.title||'Séparateur')} —</div>
        </div>`;
      }
      const color=s.color||'#e8ff47';
      const typeLabel=TYPE_LABELS[s.type]||s.type;
      const fullHtml=(typeof formatPlanningContent==='function')?formatPlanningContent(s.content||''):escapeHtml(stripHtml(renderContentWithCharges(s.content||'')));
      const intensity=s.intensity?`<span>I${s.intensity}/10</span><span class="dot"></span>`:'';
      const sets=s.sets?`<span>${s.sets} séries</span><span class="dot"></span>`:'';
      const yt=s.youtube_url?`<span>▶ vidéo</span>`:'';
      return`<div class="cal-rich perso-day-card" data-sid="${s.id}" onclick="openReadSession('${s.id}','personal')" style="cursor:pointer">
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
        ${fullHtml?`<div class="cal-rich-full">${fullHtml}</div>`:''}
        <div class="cal-rich-meta">${intensity}${sets}${yt}</div>
        ${persoRetourBlock(s.id, iso, true)}
      </div>`;
    }).join(''):`<div class="cal-empty-day" onclick="persoNewSessionOn('${iso}')">+ Ajouter une séance</div>`;
    area.innerHTML=`<div class="perso-day-view">${wellnessBanner}<div class="perso-day-list">${blocks}</div>
      <button class="cal-add-more" onclick="persoNewSessionOn('${iso}')" title="Ajouter une séance perso"><span class="plus">+</span>Séance</button>
    </div>`;
  } else if(persoView==='week'){
    const dates=getWeekDates(persoOffset);
    const wk=getWeekNum(dates[0]);
    const weekStartIso=dates[0].toISOString().split('T')[0];
    const baseWeekLabel=`Sem. ${wk} — ${MONTHS[dates[0].getMonth()]}`;
    // noms de semaine personnalisés retirés : les cycles donnent la phase
    const persoLblEl=document.getElementById('perso-period-label');
    persoLblEl.textContent=baseWeekLabel;
    persoLblEl.title='';
    persoLblEl.style.cursor='';
    persoLblEl.style.textDecoration='';
    persoLblEl.onclick=null;
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
        const fullHtml=(typeof formatPlanningContent==='function')?formatPlanningContent(s.content||''):escapeHtml(stripHtml(renderContentWithCharges(s.content||'')));
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
          ${fullHtml?`<div class="cal-rich-full">${fullHtml}</div>`:''}
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
    const persoLblElMonth=document.getElementById('perso-period-label');
    persoLblElMonth.textContent=`${['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][month]} ${year}`;
    persoLblElMonth.title='';persoLblElMonth.style.cursor='';persoLblElMonth.style.textDecoration='';persoLblElMonth.onclick=null;
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
        .select('id,session_id,score_value,score_text,score_type,level,sets_data,created_at,ef,vbt')
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

function persoRetourBlock(sid,iso,autoOpen){
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
  // Dérive FC (suivi endurance fondamentale, ef-saisie.js)
  if(sc&&sc.ef&&typeof window.efCalc==='function'){
    const k=window.efCalc(sc.ef);
    if(k)pills.push(`<span class="perso-r-pill ef ${window.efTone(k.drift)}" title="Dérive FC — endurance fondamentale">🫀 <span class="v">${window.efFmt(k.drift)}</span></span>`);
  }
  if(nt)pills.push(`<span class="perso-r-pill note" title="Note de séance">📝 note</span>`);
  if(w){
    const mean=_persoWellMean(w);
    const tone=_persoWellTone(w);
    if(mean!=null)pills.push(`<span class="perso-r-pill well ${tone}" title="Wellness du jour">💪 <span class="v">${mean.toFixed(1)}</span></span>`);
  }
  return `
    <div class="perso-retour-strip ${autoOpen?'open':''}" onclick="event.stopPropagation();togglePersoRetour('${sid}')">
      ${pills.join('')}
      <span class="perso-r-tog">›</span>
    </div>
    <div class="perso-r-drawer ${autoOpen?'open':''}" id="perso-r-d-${sid}" onclick="event.stopPropagation()">
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
    if(sc.vbt&&typeof window.vbtRecapHTML==='function'){
      const vbtHtml=window.vbtRecapHTML(sc.vbt);
      if(vbtHtml)rows.push(`<div class="perso-r-row perso-r-vbt"><div class="lbl">VBT</div><div class="val">${vbtHtml}</div></div>`);
    }
    if(sc.ef&&typeof window.efDetailHTML==='function'){
      const efHtml=window.efDetailHTML(sc.ef);
      if(efHtml)rows.push(`<div class="perso-r-row"><div class="lbl">FC</div><div class="val">${efHtml}</div></div>`);
    }
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
  // Vérifie s'il existe un retour (score et/ou commentaire) de l'athlète source sur cette séance
  const retourGroup=document.getElementById('dup-perso-retour-group');
  const retourChk=document.getElementById('dup-perso-retour');
  if(retourGroup&&retourChk){
    retourChk.checked=false;
    retourGroup.style.display='none';
    try{
      const [{data:sc},{data:ntArr}]=await Promise.all([
        sb.from('wod_scores').select('id').eq('session_id',id).eq('athlete_id',data.athlete_id).maybeSingle(),
        sb.from('session_notes').select('id').eq('session_id',id).eq('athlete_id',data.athlete_id).order('created_at',{ascending:false}).limit(1)
      ]);
      if(sc||(ntArr&&ntArr.length))retourGroup.style.display='';
    }catch(e){console.warn('check retour perso dup',e);}
  }
  document.getElementById('dup-perso-modal').classList.add('open');
}

// Remplit le sélecteur d'athlète de destination (défaut = athlète source)
async function populatePersoDupAthletes(selectedId){
  const sel=document.getElementById('dup-perso-athlete');
  if(!sel)return;
  let list=persoAthletesCache;
  if(!list.length){
    // Fallback : charger les profils du studio si le cache est vide
    const _sid=currentProfile?.studio_id??null;
    let q=sb.from('profiles').select('id,full_name,role');
    q=_sid?q.eq('studio_id',_sid):q.is('studio_id',null);
    const {data}=await q.order('full_name');
    list=(data||[]);
  }
  // Garantir la présence de l'athlète source
  if(selectedId&&!list.find(a=>a.id===selectedId)){
    const src=persoAthletesCache.find(a=>a.id===selectedId);
    if(src)list=[src,...list];
  }
  list=[...list].sort((a,b)=>{
    if(!!b.coach_favorite - !!a.coach_favorite) return !!b.coach_favorite - !!a.coach_favorite;
    return (a.full_name||'').localeCompare(b.full_name||'');
  });
  sel.innerHTML=list.map(a=>`<option value="${a.id}"${a.id===selectedId?' selected':''}>${a.coach_favorite?'★ ':''}${escapeHtml(a.full_name||'Athlète')}</option>`).join('');
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
  const {data:inserted,error}=await sb.from('personal_sessions').insert(payload).select('id').single();
  if(error){showToast('❌ '+error.message);return;}
  // Duplication du retour athlète (score + commentaire), si demandé
  const dupRetourChk=document.getElementById('dup-perso-retour');
  let retourCopied=false;
  if(dupRetourChk&&dupRetourChk.checked&&inserted?.id){
    try{
      const [{data:srcScore},{data:srcNoteArr}]=await Promise.all([
        sb.from('wod_scores').select('*').eq('session_id',data.id).eq('athlete_id',data.athlete_id).maybeSingle(),
        sb.from('session_notes').select('*').eq('session_id',data.id).eq('athlete_id',data.athlete_id).order('created_at',{ascending:false}).limit(1)
      ]);
      const srcNote=(srcNoteArr&&srcNoteArr[0])||null;
      if(srcScore){
        const {id:_sid,created_at:_sca,session_id:_ssid,athlete_id:_said,...scoreRest}=srcScore;
        const {error:scErr}=await sb.from('wod_scores').insert({...scoreRest,session_id:inserted.id,athlete_id:targetAthleteId});
        if(!scErr)retourCopied=true;else console.warn('dup wod_scores',scErr.message);
      }
      if(srcNote){
        const {id:_nid,created_at:_nca,session_id:_nsid,athlete_id:_naid,...noteRest}=srcNote;
        const {error:ntErr}=await sb.from('session_notes').insert({...noteRest,session_id:inserted.id,athlete_id:targetAthleteId});
        if(!ntErr)retourCopied=true;else console.warn('dup session_notes',ntErr.message);
      }
    }catch(e){console.warn('dup retour perso',e);}
  }
  let who='';
  if(!sameAthlete){
    const ath=persoAthletesCache.find(a=>a.id===targetAthleteId);
    who=' → '+((ath&&ath.full_name)||'athlète');
  }
  showToast((newDate===data.date?'📋 Séance dupliquée':'📋 Séance dupliquée au '+formatDateShort(newDate))+who+(retourCopied?' (+ retour)':''));
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
  // Remplir athlètes (tous sauf l'athlète courant), favoris en tête
  const athletes=persoAthletesCache.filter(a=>a.id!==currentPersoAthlete?.id).sort((a,b)=>{
    if(!!b.coach_favorite - !!a.coach_favorite) return !!b.coach_favorite - !!a.coach_favorite;
    return (a.full_name||'').localeCompare(b.full_name||'');
  });
  document.getElementById('dup-perso-target-athlete').innerHTML=athletes.length
    ? athletes.map(a=>`<option value="${a.id}">${a.coach_favorite?'★ ':''}${a.full_name||a.email||a.id}</option>`).join('')
    : '<option value="">— Aucun autre athlète —</option>';
  // Remplir programmes
  const progs=programmes||[];
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
// ===== HELPER COMMUN DUPLICATION : champs pédagogiques =====
// Colonnes présentes À LA FOIS dans `sessions` et `personal_sessions`.
// Sans ça, scaling + coaching tips + intensité + cible + réglages de score
// étaient perdus à chaque duplication inter-programme / inter-espace.
function _dupCommonFields(s){
  return {
    intensity:(s.intensity??null),
    target:s.target||null,
    tips:s.tips||null,
    score_type:s.score_type||null,
    sets:(s.sets??null),
    scaling_inter:s.scaling_inter||null,
    scaling_scaled:s.scaling_scaled||null,
    scaling_foundation:s.scaling_foundation||null,
    multi_score:(s.multi_score??null),
    score_count:(s.score_count??null),
    score_labels:s.score_labels||null,
    score_label1:s.score_label1||null,
    score_label2:s.score_label2||null,
    score_note_label:s.score_note_label||null
  };
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
      const rows=data.map(s=>{
        const d=new Date(s.date+'T12:00:00');d.setDate(d.getDate()+diffDays);
        return{title:s.title||null,content:s.content||null,type:s.type||null,
               color:s.color||null,sort_order:(s.sort_order??null),studio_id:s.studio_id||null,
               youtube_url:s.youtube_url||null,youtube_label:s.youtube_label||null,videos:s.videos||null,
               source_block_id:s.source_block_id||s.id||null,
               ..._dupCommonFields(s),
               athlete_id:tgtAthId,date:d.toISOString().split('T')[0],created_by:currentUser.id};
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
      // Whitelist : uniquement les colonnes existantes dans sessions
      const _toProg=(s,extra)=>({
        title:s.title||null,content:s.content||null,type:s.type||null,
        color:s.color||null,sort_order:(s.sort_order??null),studio_id:s.studio_id||null,
        youtube_url:s.youtube_url||null,youtube_label:s.youtube_label||null,videos:s.videos||null,
        source_block_id:s.source_block_id||s.id||null,
        ..._dupCommonFields(s),
        created_by:currentUser.id,...extra
      });
      if(tgtOneshot){
        const tgtWeek=parseInt(document.getElementById('dup-perso-prog-target-week').value);
        if(!tgtWeek){showToast('⚠️ Choisis une semaine');return;}
        rows=data.map(s=>{
          const d=new Date(s.date+'T12:00:00');
          const dow=d.getDay()===0?7:d.getDay();
          return _toProg(s,{programme_id:tgtProgId,week_number:tgtWeek,day_of_week:dow});
        });
      } else {
        const tgtDateStr=document.getElementById('dup-perso-prog-target-date').value;
        if(!tgtDateStr){showToast('⚠️ Choisis une date cible');return;}
        const tgtPicked=new Date(tgtDateStr+'T12:00:00');
        const tgtDay=tgtPicked.getDay();
        const tgtMon=new Date(tgtPicked);tgtMon.setDate(tgtPicked.getDate()-(tgtDay===0?6:tgtDay-1));
        const diffDays=Math.round((tgtMon-srcMon)/(24*60*60*1000));
        rows=data.map(s=>{
          const d=new Date(s.date+'T12:00:00');d.setDate(d.getDate()+diffDays);
          return _toProg(s,{programme_id:tgtProgId,date:d.toISOString().split('T')[0]});
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
  const weekStartIso=dates[0].toISOString().split('T')[0];
  const baseWeekLabel=`Sem. ${wk} — ${MONTHS[dates[0].getMonth()]}`;
  // noms de semaine personnalisés retirés : les cycles donnent la phase
  const weekLblEl=document.getElementById('week-label');
  weekLblEl.textContent=baseWeekLabel;
  weekLblEl.title='';
  weekLblEl.style.cursor='';
  weekLblEl.style.textDecoration='';
  weekLblEl.onclick=null;
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
  const __wkLblEl=document.getElementById('week-label');
  if(__wkLblEl){__wkLblEl.onclick=null;__wkLblEl.style.cursor='';__wkLblEl.style.textDecoration='';__wkLblEl.title='';}
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
    const isMe=currentUser&&p.id===currentUser.id;
    const nameEsc=(p.full_name||p.email||'?').replace(/'/g,"\\'");
    return`<div class="athlete-row" style="cursor:pointer" onclick="dashOpenFiche('${p.id}')">
      <div class="athlete-avatar">${init}</div>
      <div style="flex:1;min-width:0">
        <div class="athlete-name">${escapeHtml(p.full_name||'—')}</div>
        <div class="athlete-email">${escapeHtml(p.email||'')}${since?' · depuis '+since:''}</div>
      </div>
      ${isMe?'':`<button class="btn-delete" onclick="event.stopPropagation();_dashDeleteAthlete('${p.id}','${nameEsc}')">✕</button>`}
      <span style="color:var(--muted);font-size:18px">›</span>
    </div>`;
  }).join('');
}
async function _dashDeleteAthlete(id,name){
  if(typeof deleteAthlete!=='function')return;
  await deleteAthlete(id,name);
  // deleteAthlete() rafraîchit la liste admin classique ; on resynchronise la vue dashboard
  await loadDashboard();
}

// ============================================
// PATCH — deleteAthlete() annule aussi l'abonnement Stripe
// (override complet plutôt que wrapper : la fonction d'origine dans
// admin.js fait déjà son propre confirm(), on ne veut pas de double popup)
// ============================================
(function(){
  if(window.__patchDeleteAthleteBound)return;
  window.__patchDeleteAthleteBound=true;

  window.deleteAthlete=async function(id,name){
    if(!confirm(`⚠️ Supprimer définitivement "${name}" ?\n\nSon abonnement Stripe sera annulé et toutes ses données (scores, PR, séances perso) seront effacées.\n\nCette action est irréversible.`))return;

    // 1) Annulation Stripe côté serveur (avant toute suppression en base)
    try{
      const {data:{session}}=await sb.auth.getSession();
      if(session?.access_token){
        const resp=await fetch('/.netlify/functions/cancel-athlete-subscriptions',{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
          body:JSON.stringify({athlete_id:id})
        });
        const data=await resp.json().catch(()=>({}));
        if(!resp.ok||data.errors?.length){
          console.warn('cancel-athlete-subscriptions',data);
          if(!confirm(`⚠️ L'annulation Stripe a rencontré un problème (${data.error||data.errors?.[0]?.error||'erreur inconnue'}).\n\nContinuer quand même la suppression de l'athlète ?`))return;
        }
      }else{
        console.warn('Pas de session — annulation Stripe ignorée');
      }
    }catch(e){
      console.error('cancel-athlete-subscriptions failed',e);
      if(!confirm(`⚠️ Impossible de contacter Stripe (${e.message}).\n\nContinuer quand même la suppression de l'athlète ?`))return;
    }

    // 2) Cascade de suppression des données (identique à l'ancienne logique)
    const tables=['wod_scores','athlete_prs','athlete_scores','athlete_programmes','programme_access','personal_sessions','bench_scores','benchmark_scores','session_notes'];
    for(const t of tables){
      const r=await sb.from(t).delete().eq('athlete_id',id);
      if(r.error)console.warn(t,r.error.message);
    }
    const {error,data}=await sb.from('profiles').delete().eq('id',id).select();
    if(error){showToast('❌ '+error.message);console.error('delete profile',error);return;}
    if(!data||data.length===0){
      showToast('⚠️ Athlète non supprimé (RLS ?). Vérifie la console.');
      console.warn('Profile delete returned no rows. Probable RLS policy manquante pour DELETE sur profiles.');
      return;
    }
    showToast('🗑 Athlète supprimé (abonnement Stripe annulé)');
    if(typeof loadAdminAthletes==='function')loadAdminAthletes();
  };
})();

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
    .select('id,movement_id,value,recorded_at,format,note,created_at,is_coach_estimate')
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

// ===== DUP WEEK / DUP JOURS — PLANNING V2 (remplace openDupWeekModal d'admin.js) =====
// Convention : day_of_week en base = 0-indexé (0 = Lundi … 6 = Dimanche), comme le select #f-dow
// et comme le rendu du calendrier one-shot dans admin.js.

const DUP_DAY_LABELS=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const DUP_DAY_FULL=['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
let _dupWeekDays=new Set([0,1,2,3,4,5,6]);
let _dupWeekCounts=null;

function _dupSelDays(){return [..._dupWeekDays].sort((a,b)=>a-b);}
function _dupDaysBetween(isoFrom,isoTo){
  const a=new Date(isoFrom+'T12:00:00Z'),b=new Date(isoTo+'T12:00:00Z');
  return Math.round((b-a)/86400000);
}
function _dupAddDaysIso(iso,n){
  const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);
  return d.toISOString().split('T')[0];
}
function _dupMondayIso(dateStr){
  const d=new Date(dateStr+'T12:00:00');
  const dow=d.getDay();
  d.setDate(d.getDate()-(dow===0?6:dow-1));
  return d.toISOString().split('T')[0];
}
function _dupSrcWeekIsos(){return getWeekDates(adminWeekOffset).map(d=>d.toISOString().split('T')[0]);}
function _dupDowOf(s){return (s.day_of_week==null?0:s.day_of_week);}
// Date synthétique des programmes one-shot (même formule que saveSession d'admin.js)
function _dupOneshotStoredDate(weekNumber,dayOfWeek){
  return `2000-01-${String(((weekNumber-1)*7+dayOfWeek+1)%28+1).padStart(2,'0')}`;
}

// ---- Sélecteur de jours ----
function renderDupWeekDays(){
  const wrap=document.getElementById('dup-week-days');
  if(!wrap)return;
  wrap.innerHTML=DUP_DAY_LABELS.map((lbl,i)=>{
    const on=_dupWeekDays.has(i);
    const n=_dupWeekCounts?_dupWeekCounts[i]:null;
    const empty=(n===0);
    return `<button type="button" onclick="toggleDupWeekDay(${i})" style="flex:1;min-width:40px;padding:7px 4px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:700;letter-spacing:.5px;background:${on?'var(--accent)':'var(--card2)'};color:${on?'#000':(empty?'var(--muted)':'var(--text2)')};border:1.5px solid ${on?'var(--accent)':'var(--border2)'};opacity:${(!on&&empty)?'.45':'1'}">${lbl}${n!=null?`<div style="font-size:9px;font-weight:600;opacity:.75;margin-top:2px">${n}</div>`:''}</button>`;
  }).join('');
  _dupWeekSyncLabels();
}
function toggleDupWeekDay(i){
  if(_dupWeekDays.has(i))_dupWeekDays.delete(i);else _dupWeekDays.add(i);
  renderDupWeekDays();
}
function dupWeekSelectAllDays(on){
  _dupWeekDays=on?new Set([0,1,2,3,4,5,6]):new Set();
  renderDupWeekDays();
}
function _dupWeekSyncLabels(){
  const days=_dupSelDays();
  const n=days.length;
  const single=(n===1);
  const what=n===0?'…':(n===7?'la semaine':(single?`le ${DUP_DAY_FULL[days[0]]}`:`${n} jours`));
  const title=document.getElementById('dup-week-modal-title');
  const btn=document.getElementById('dup-week-confirm-btn');
  const hint=document.getElementById('dup-week-days-hint');
  if(title)title.textContent=`📋 Dupliquer ${what}`;
  if(btn)btn.textContent=`📋 Dupliquer ${what}`;
  if(hint){
    const total=_dupWeekCounts?days.reduce((s,i)=>s+(_dupWeekCounts[i]||0),0):null;
    hint.textContent=n===0?'Sélectionne au moins un jour'
      :(total!=null?`${total} séance${total>1?'s':''} à copier`:`${n} jour${n>1?'s':''} sélectionné${n>1?'s':''}`);
  }
  const dest=document.getElementById('dup-week-dest-type')?.value||'same_prog';
  const prog=getProgById(document.getElementById('admin-filter-prog')?.value);
  const oneshot=isOneshotProg(prog);
  // Libellé de la date cible : date exacte si 1 seul jour, sinon lundi de la semaine cible
  const dl=document.getElementById('dup-week-date-label');
  if(dl){
    if(dest==='perso'&&oneshot&&!single)dl.textContent='Lundi de référence (semaine cible)';
    else dl.textContent=single?'Date de destination':'Lundi de la semaine cible';
  }
  const odl=document.querySelector('#dup-week-other-prog-date .form-label');
  if(odl)odl.textContent=single?'Date de destination':'Lundi de la semaine cible';
  // Jour de destination (cibles one-shot) : uniquement quand 1 seul jour source
  const g1=document.getElementById('dup-week-target-dow-group');
  if(g1){
    g1.style.display=single?'':'none';
    const s=document.getElementById('dup-week-target-dow');
    if(single&&s)s.value=String(days[0]);
  }
  const g2=document.getElementById('dup-week-other-prog-dow-group');
  if(g2){
    g2.style.display=single?'':'none';
    const s=document.getElementById('dup-week-other-prog-dow');
    if(single&&s)s.value=String(days[0]);
  }
}
async function _dupWeekLoadCounts(progId,oneshot){
  try{
    const counts=[0,0,0,0,0,0,0];
    if(oneshot){
      const {data}=await sb.from('sessions').select('day_of_week').eq('programme_id',progId).eq('week_number',adminWeekOffset+1);
      (data||[]).forEach(s=>{const i=_dupDowOf(s);if(i>=0&&i<7)counts[i]++;});
    } else {
      const isos=_dupSrcWeekIsos();
      const {data}=await sb.from('sessions').select('date').eq('programme_id',progId).in('date',isos);
      (data||[]).forEach(s=>{const i=isos.indexOf(s.date);if(i>=0)counts[i]++;});
    }
    return counts;
  }catch(e){console.warn('dup week counts',e);return null;}
}

// ---- Ouverture de la modale ----
// preselectDay (0..6) : ouvre directement en mode « 1 seule journée »
async function openDupWeekModalV2(preselectDay){
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
      return`<option value="${w}">Semaine ${w}${w===weekNum?' (actuelle)':''}</option>`;
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

  // Masquer groupes spéciaux
  document.getElementById('dup-week-other-prog-group').style.display='none';
  document.getElementById('dup-week-perso-group').style.display='none';

  // Remplir autres programmes
  const otherProgs=(programmes||[]).filter(p=>p.id!==progId);
  document.getElementById('dup-week-target-prog').innerHTML=otherProgs.length
    ? otherProgs.map(p=>`<option value="${p.id}" data-type="${p.type||''}" data-weeks="${p.total_weeks||0}">${p.icon||'💪'} ${p.name}</option>`).join('')
    : '<option value="">— Aucun autre programme —</option>';
  if(otherProgs.length) onDupWeekTargetProgChange();

  // Jours : sélection par défaut = tous les jours qui contiennent au moins une séance
  _dupWeekCounts=null;
  if(preselectDay!=null&&preselectDay>=0&&preselectDay<=6){
    _dupWeekDays=new Set([preselectDay]);
  } else {
    _dupWeekDays=new Set([0,1,2,3,4,5,6]);
  }
  renderDupWeekDays();
  modal.classList.add('open');

  _dupWeekLoadCounts(progId,oneshot).then(counts=>{
    _dupWeekCounts=counts;
    if(counts&&(preselectDay==null||preselectDay<0||preselectDay>6)){
      const nonEmpty=counts.map((n,i)=>n>0?i:-1).filter(i=>i>=0);
      if(nonEmpty.length)_dupWeekDays=new Set(nonEmpty);
    }
    renderDupWeekDays();
  });

  // Remplir athlètes perso (fetch si cache vide car espace perso pas encore visité)
  if(!persoAthletesCache.length){
    try{ await loadPersoAthletes(); } catch(e){ console.warn('perso athletes load',e); }
  }
  const athletes=[...persoAthletesCache].sort((a,b)=>{
    if(!!b.coach_favorite - !!a.coach_favorite) return !!b.coach_favorite - !!a.coach_favorite;
    return (a.full_name||'').localeCompare(b.full_name||'');
  });
  document.getElementById('dup-week-target-athlete').innerHTML=athletes.length
    ? athletes.map(a=>`<option value="${a.id}">${a.coach_favorite?'★ ':''}${a.full_name||a.email||a.id}</option>`).join('')
    : '<option value="">— Aucun athlète —</option>';
}

function onDupWeekDestChange(){
  const dest=document.getElementById('dup-week-dest-type').value;
  const progId=document.getElementById('admin-filter-prog')?.value;
  const prog=getProgById(progId);
  const oneshot=isOneshotProg(prog);
  const single=_dupSelDays().length===1;

  document.getElementById('dup-week-oneshot-group').style.display=(dest==='same_prog'&&oneshot)?'':'none';
  document.getElementById('dup-week-date-group').style.display=
    (dest==='same_prog'&&!oneshot)||(dest==='perso')?'':'none';
  document.getElementById('dup-week-other-prog-group').style.display=dest==='other_prog'?'':'none';
  document.getElementById('dup-week-perso-group').style.display=dest==='perso'?'':'none';

  if(dest==='perso'&&oneshot){
    // one-shot → perso : il faut une date de référence (lundi) ou la date exacte si 1 seul jour
    document.getElementById('dup-week-date-group').style.display='';
    const now=new Date();const dd=now.getDay();
    const mon=new Date(now);mon.setDate(now.getDate()-(dd===0?6:dd-1)+7);
    const el=document.getElementById('dup-week-target-date');
    if(el&&!el.value)el.value=mon.toISOString().split('T')[0];
  }

  if(dest==='other_prog') onDupWeekTargetProgChange();
  _dupWeekSyncLabels();
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
  _dupWeekSyncLabels();
}

// ---- Chargement des séances source (filtrées sur les jours cochés) ----
async function _dupWeekFetchSource(progId,oneshot){
  const days=_dupSelDays();
  if(!days.length){showToast('⚠️ Sélectionne au moins un jour');return null;}
  let data,error;
  if(oneshot){
    ({data,error}=await sb.from('sessions').select('*').eq('programme_id',progId).eq('week_number',adminWeekOffset+1));
    if(!error)data=(data||[]).filter(s=>days.includes(_dupDowOf(s)));
  } else {
    const isos=_dupSrcWeekIsos();
    ({data,error}=await sb.from('sessions').select('*').in('date',days.map(i=>isos[i])).eq('programme_id',progId));
  }
  if(error){showToast('❌ '+error.message);return null;}
  if(!data||!data.length){showToast('⚠️ Aucune séance à copier sur ces jours');return null;}
  return data;
}

async function confirmDupWeekV2(){
  const dest=document.getElementById('dup-week-dest-type').value;
  const progId=document.getElementById('admin-filter-prog')?.value;
  if(!progId){showToast('⚠️ Aucun programme sélectionné');return;}
  if(!_dupSelDays().length){showToast('⚠️ Sélectionne au moins un jour');return;}
  const prog=getProgById(progId);
  const oneshot=isOneshotProg(prog);
  const btn=document.getElementById('dup-week-confirm-btn');
  if(btn){btn.disabled=true;btn.textContent='Copie...';}
  try{
    if(dest==='same_prog')  await _dupWeekSameProg(progId,prog,oneshot);
    if(dest==='other_prog') await _dupWeekToOtherProg(progId,prog,oneshot);
    if(dest==='perso')      await _dupWeekToPerso(progId,prog,oneshot);
  } finally {
    if(btn){btn.disabled=false;}
    _dupWeekSyncLabels();
  }
}

// ---- Destination : même programme ----
async function _dupWeekSameProg(progId,prog,oneshot){
  const days=_dupSelDays();
  const single=days.length===1;
  const data=await _dupWeekFetchSource(progId,oneshot);
  if(!data)return;
  let rows;
  if(oneshot){
    const srcWeek=adminWeekOffset+1;
    const tgtWeek=parseInt(document.getElementById('dup-week-target-week').value);
    if(!tgtWeek){showToast('⚠️ Choisis une semaine de destination');return;}
    const tgtDow=single?(parseInt(document.getElementById('dup-week-target-dow').value)||0):null;
    if(tgtWeek===srcWeek&&(!single||tgtDow===days[0])){
      showToast(single?'⚠️ Choisis une semaine ou un jour différent':'⚠️ Choisis une semaine différente');return;
    }
    rows=data.map(({id,created_at,...rest})=>{
      const dow=single?tgtDow:_dupDowOf(rest);
      return{...rest,week_number:tgtWeek,day_of_week:dow,date:_dupOneshotStoredDate(tgtWeek,dow),created_by:currentUser.id};
    });
  } else {
    const tgtDateStr=document.getElementById('dup-week-target-date').value;
    if(!tgtDateStr){showToast('⚠️ Choisis une date');return;}
    const isos=_dupSrcWeekIsos();
    const diffDays=single
      ? _dupDaysBetween(isos[days[0]],tgtDateStr)
      : _dupDaysBetween(isos[0],_dupMondayIso(tgtDateStr));
    if(diffDays===0){showToast(single?'⚠️ Choisis une autre date':'⚠️ Choisis une semaine différente');return;}
    rows=data.map(({id,created_at,...rest})=>({
      ...rest,date:_dupAddDaysIso(rest.date,diffDays),created_by:currentUser.id
    }));
  }
  const {error}=await sb.from('sessions').insert(rows);
  if(error){showToast('❌ '+error.message);return;}
  showToast(`✅ ${rows.length} séance${rows.length>1?'s':''} copiée${rows.length>1?'s':''}`);
  closeDupWeekModal();
  loadAdminCalendar();
}

// ---- Destination : autre programme ----
async function _dupWeekToOtherProg(srcProgId,srcProg,srcOneshot){
  const tgtProgId=document.getElementById('dup-week-target-prog').value;
  if(!tgtProgId){showToast('⚠️ Aucun programme cible');return;}
  const tgtProg=getProgById(tgtProgId);
  const tgtOneshot=isOneshotProg(tgtProg);
  const days=_dupSelDays();
  const single=days.length===1;

  const data=await _dupWeekFetchSource(srcProgId,srcOneshot);
  if(!data)return;

  // Helper whitelist sessions (colonnes communes + champs cibles)
  const _toSess=(s,extra)=>({
    title:s.title||null,content:s.content||null,type:s.type||null,
    color:s.color||null,sort_order:(s.sort_order??null),studio_id:s.studio_id||null,
    youtube_url:s.youtube_url||null,youtube_label:s.youtube_label||null,videos:s.videos||null,
    source_block_id:s.source_block_id||s.id||null,
    ..._dupCommonFields(s),
    is_benchmark:(s.is_benchmark??null),
    created_by:currentUser.id,...extra
  });
  let rows;
  if(tgtOneshot){
    const tgtWeek=parseInt(document.getElementById('dup-week-other-prog-week').value);
    if(!tgtWeek){showToast('⚠️ Choisis une semaine cible');return;}
    const tgtDow=single?(parseInt(document.getElementById('dup-week-other-prog-dow').value)||0):null;
    rows=data.map(s=>{
      let dow;
      if(single)dow=tgtDow;
      else if(srcOneshot)dow=_dupDowOf(s);
      else {const d=new Date(s.date+'T12:00:00');dow=(d.getDay()===0?6:d.getDay()-1);}
      return _toSess(s,{programme_id:tgtProgId,week_number:tgtWeek,day_of_week:dow,date:_dupOneshotStoredDate(tgtWeek,dow)});
    });
  } else {
    const tgtDateStr=document.getElementById('dup-week-other-prog-target-date').value;
    if(!tgtDateStr){showToast('⚠️ Choisis une date cible');return;}
    if(srcOneshot){
      // one-shot → abo : week_number + day_of_week → date
      const tgtMonIso=_dupMondayIso(tgtDateStr);
      rows=data.map(s=>_toSess(s,{
        programme_id:tgtProgId,
        date:single?tgtDateStr:_dupAddDaysIso(tgtMonIso,_dupDowOf(s))
      }));
    } else {
      const isos=_dupSrcWeekIsos();
      const diffDays=single
        ? _dupDaysBetween(isos[days[0]],tgtDateStr)
        : _dupDaysBetween(isos[0],_dupMondayIso(tgtDateStr));
      // Le blocage "même semaine" n'a de sens que dans le même programme.
      if(diffDays===0&&tgtProgId===srcProgId){showToast('⚠️ Choisis une semaine différente');return;}
      rows=data.map(s=>_toSess(s,{programme_id:tgtProgId,date:_dupAddDaysIso(s.date,diffDays)}));
    }
  }
  const {error:e2}=await sb.from('sessions').insert(rows);
  if(e2){showToast('❌ '+e2.message);return;}
  showToast(`✅ ${rows.length} séance${rows.length>1?'s':''} → ${tgtProg.name}`);
  closeDupWeekModal();
  loadAdminCalendar();
}

// ---- Destination : espace perso d'un athlète ----
async function _dupWeekToPerso(srcProgId,srcProg,srcOneshot){
  const athleteId=document.getElementById('dup-week-target-athlete').value;
  if(!athleteId){showToast('⚠️ Aucun athlète sélectionné');return;}
  const tgtDateStr=document.getElementById('dup-week-target-date').value;
  if(!tgtDateStr){showToast('⚠️ Choisis une date cible');return;}
  const days=_dupSelDays();
  const single=days.length===1;

  const data=await _dupWeekFetchSource(srcProgId,srcOneshot);
  if(!data)return;

  // Whitelist : uniquement les colonnes existantes dans personal_sessions
  const _toPerso=(s,date)=>({
    title:s.title||null,content:s.content||null,type:s.type||null,
    color:s.color||null,sort_order:(s.sort_order??null),studio_id:s.studio_id||null,
    youtube_url:s.youtube_url||null,youtube_label:s.youtube_label||null,videos:s.videos||null,
    source_block_id:s.source_block_id||s.id||null,
    ..._dupCommonFields(s),
    athlete_id:athleteId,date,created_by:currentUser.id
  });
  let rows;
  if(srcOneshot){
    const tgtMonIso=_dupMondayIso(tgtDateStr);
    rows=data.map(s=>_toPerso(s,single?tgtDateStr:_dupAddDaysIso(tgtMonIso,_dupDowOf(s))));
  } else {
    const isos=_dupSrcWeekIsos();
    const diffDays=single
      ? _dupDaysBetween(isos[days[0]],tgtDateStr)
      : _dupDaysBetween(isos[0],_dupMondayIso(tgtDateStr));
    rows=data.map(s=>_toPerso(s,_dupAddDaysIso(s.date,diffDays)));
  }
  const {error:e2}=await sb.from('personal_sessions').insert(rows);
  if(e2){showToast('❌ '+e2.message);return;}
  const ath=persoAthletesCache.find(a=>a.id===athleteId);
  showToast(`✅ ${rows.length} séance${rows.length>1?'s':''} → ${ath?.full_name||'athlète'}`);
  closeDupWeekModal();
}

// ---- Bouton 📋 sur chaque jour du calendrier admin (duplication d'une seule journée) ----
(function(){
  if(window.__dupDayBtnPatchBound)return;
  window.__dupDayBtnPatchBound=true;
  function inject(){
    const cal=document.getElementById('admin-calendar');
    if(!cal)return;
    const grids=cal.querySelectorAll('.cal-grid');
    if(grids.length<2)return;
    const row=grids[1]; // ligne des dates / J1..J7
    Array.from(row.children).forEach((cell,i)=>{
      if(i>6||cell.querySelector('.dup-day-btn'))return;
      const b=document.createElement('button');
      b.type='button';
      b.className='dup-day-btn';
      b.textContent='📋';
      b.title='Dupliquer cette journée';
      b.style.cssText='margin-left:5px;background:none;border:none;padding:0 2px;font-size:10px;line-height:1;cursor:pointer;opacity:.5';
      b.addEventListener('click',function(ev){ev.stopPropagation();openDupWeekModalV2(i);});
      cell.appendChild(b);
    });
  }
  function start(){
    const cal=document.getElementById('admin-calendar');
    if(!cal)return false;
    try{new MutationObserver(()=>inject()).observe(cal,{childList:true});}catch(e){console.warn('dup day observer',e);}
    inject();
    return true;
  }
  if(!start()){
    document.addEventListener('DOMContentLoaded',start);
    setTimeout(start,1500);
    setTimeout(start,3000);
  }
})();

// ===================================================
// PROGRAMMES GRATUITS — is_free support
// ===================================================

// Toggle visibilité du champ prix quand "gratuit" est coché
function onNpFreeChange(){
  const isFree=document.getElementById('np-is-free')?.checked;
  const row=document.getElementById('np-price-row');
  if(row)row.style.display=isFree?'none':'';
}

// Patch saveNewProg pour transmettre is_free et réinitialiser la checkbox
(function(){
  if(typeof saveNewProg!=='function')return;
  const _orig=saveNewProg;
  window.saveNewProg=async function(){
    const isFreeEl=document.getElementById('np-is-free');
    const isFree=isFreeEl?.checked||false;
    // Si gratuit, forcer prix à null avant appel original
    if(isFree){
      const priceEl=document.getElementById('np-price');
      if(priceEl)priceEl.value='';
    }
    // Appel original (crée le programme)
    // On intercepte l'insert en patchant temporairement sb.from
    const _origFrom=sb.from.bind(sb);
    let patched=false;
    sb.from=function(table){
      const builder=_origFrom(table);
      if(table==='programmes'&&!patched){
        patched=true;
        const _origInsert=builder.insert.bind(builder);
        builder.insert=function(payload,...args){
          if(Array.isArray(payload))payload=payload.map(r=>({...r,is_free:isFree}));
          else payload={...payload,is_free:isFree};
          return _origInsert(payload,...args);
        };
      }
      return builder;
    };
    await _orig();
    sb.from=_origFrom;
    // Réinitialiser la checkbox et réafficher le champ prix
    if(isFreeEl)isFreeEl.checked=false;
    const row=document.getElementById('np-price-row');
    if(row)row.style.display='';
  };
})();

// Patch renderPlans pour gérer les programmes gratuits
(function(){
  if(typeof renderPlans!=='function')return;
  const _orig=renderPlans;
  window.renderPlans=async function(){
    await loadMyAccess();
    const list=document.getElementById('plans-list');
    const cards=programmes.map(p=>{
      const slug=p.slug;
      const stripeCfg=(typeof STRIPE_PLANS!=='undefined')?STRIPE_PLANS[slug]:null;
      const access=myAccess.has(slug)||myAccessIds.has(p.id)||currentProfile?.role==='admin';
      const icon=stripeCfg?.icon||p.icon||'💪';
      const name=stripeCfg?.name||p.name;
      const color=stripeCfg?.color||p.color||'#999';
      const isOneshot=p.type==='oneshot';
      const priceVal=(isOneshot?p.price_oneshot:p.price_monthly)||(stripeCfg?.price?parseFloat(stripeCfg.price):null);
      const price=p.is_free?'Gratuit':(priceVal?priceVal+'€':'—');
      const period=p.is_free?'':(priceVal?(isOneshot?'':'/mois'):'');
      const desc=stripeCfg?.desc||p.description||'';
      const features=stripeCfg?.features||[];
      const stripePriceId=p.stripe_price_id||stripeCfg?.priceId;
      let actionHtml;
      if(access){
        actionHtml=`<div class="access-badge">✓ Accès actif</div>`;
      } else if(p.is_free){
        actionHtml=`<button class="btn-subscribe locked" onclick="claimFreeAccess('${p.id}')" style="background:var(--yellow);color:#000">🎁 Accéder gratuitement</button>`;
      } else if(stripePriceId){
        actionHtml=`<button class="btn-subscribe locked" onclick="subscribeToProg('${p.id}')">💳 ${isOneshot?'Acheter':"S'abonner"} — ${price}${period}${isOneshot?'':`<div style="font-size:11px;font-weight:600;opacity:.85;margin-top:2px">14 jours d'essai gratuits</div>`}</button>`;
      } else {
        actionHtml=`<div style="text-align:center;padding:14px;background:rgba(255,140,71,.1);border:1px dashed rgba(255,140,71,.4);border-radius:10px;color:var(--orange);font-size:12px;font-weight:700">⚠️ Paiement non configuré</div>`;
      }
      return`<div class="plan-card ${slug==='affiliate'?'featured':''}">
        <div class="plan-header"><div><div class="plan-name" style="color:${color}">${name}</div></div><div><div class="plan-price-val">${price}</div><div class="plan-price-period">${period}</div></div></div>
        ${desc?`<div class="plan-desc">${desc}</div>`:''}
        ${features.length?`<div class="plan-features">${features.map(f=>`<div class="plan-feature">${f}</div>`).join('')}</div>`:''}
        ${actionHtml}
      </div>`;
    }).join('');
    list.innerHTML=cards||'<div style="padding:40px;text-align:center;color:var(--muted);font-size:13px">Aucun programme disponible</div>';
  };
})();

// Accès gratuit sans Stripe
async function claimFreeAccess(programmeId){
  if(!currentUser){showToast('⚠️ Connecte-toi d\'abord');return;}
  const prog=programmes.find(p=>p.id===programmeId);
  if(!prog||!prog.is_free){showToast('❌ Programme non gratuit');return;}
  showToast('⏳ Activation en cours...');
  const {error}=await sb.from('programme_access').upsert({
    athlete_id:currentUser.id,
    programme_id:programmeId
  },{onConflict:'athlete_id,programme_id'});
  if(error){showToast('❌ '+error.message);return;}
  showToast('🎁 Accès activé !');
  await renderPlans();
}

// ===================================================
// TRANSFERT CYCLE → ESPACE PERSO (un seul athlète)
// PATCH loadMixedAthletes : inclure les admins (Maelle/Alexis)
// dans la liste des destinataires "espace perso", car ils ont
// eux aussi un espace perso mais étaient exclus par le filtre
// role!=='admin' pensé pour l'assignation de programmes.
// ===================================================
(function(){
  if(window.__loadMixedAthletesWithAdminsBound) return;
  window.__loadMixedAthletesWithAdminsBound = true;

  window.loadMixedAthletesWithAdmins = async function(){
    const studioId = (typeof getStudioId === 'function') ? getStudioId() : null;
    let q = sb.from('profiles').select('*');
    if(studioId){ q = q.eq('studio_id', studioId); } else { q = q.is('studio_id', null); }
    const { data } = await q.order('full_name');
    const all = data || [];

    // Recharger les favoris (coach_favorites) — sinon ce cache écrase
    // persoAthletesCache sans le flag coach_favorite et on perd le tri favori.
    const { data: favRows } = await sb.from('coach_favorites')
      .select('athlete_id')
      .eq('coach_id', currentUser.id);
    const favSet = new Set((favRows||[]).map(r=>r.athlete_id));
    all.forEach(a => { a.coach_favorite = favSet.has(a.id); });

    persoAthletesCache = all;
    let rows = [];
    const r1 = await sb.from('athlete_programmes').select('athlete_id');
    if(!r1.error && r1.data) rows = r1.data;
    const r2 = await sb.from('programme_access').select('athlete_id');
    if(!r2.error && r2.data) rows = rows.concat(r2.data);
    const counts = {};
    rows.forEach(r => { if(r.athlete_id) counts[r.athlete_id] = (counts[r.athlete_id]||0) + 1; });
    const list = all.map(a => ({ ...a, _progCount: counts[a.id] || 0 }));
    list.sort((a,b) => {
      // Favoris toujours en premier, puis le tri activité/alpha habituel
      if(!!b.coach_favorite - !!a.coach_favorite) return !!b.coach_favorite - !!a.coach_favorite;
      const am = a._progCount>=2 ? 0 : 1, bm = b._progCount>=2 ? 0 : 1;
      if(am !== bm) return am - bm;
      return (a.full_name||'').localeCompare(b.full_name||'');
    });
    return list;
  };
})();

// PATCH openDuplicateModal (modal "Dupliquer" depuis planning/admin) :
// utiliser loadMixedAthletesWithAdmins pour que Maelle/Alexis (admins)
// apparaissent dans la liste des athlètes quand on duplique vers l'espace perso.
// ===================================================
(function(){
  if(window.__openDuplicateModalWithAdminsBound) return;
  window.__openDuplicateModalWithAdminsBound = true;

  window.openDuplicateModal = async function(session){
    sessionToDuplicate = session;
    document.getElementById('dup-session-name').textContent = session.title;
    document.getElementById('dup-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('dup-prog').innerHTML = programmes.map(p=>`<option value="${p.id}" ${p.id===session.programme_id?'selected':''}>${p.icon||'💪'} ${p.name}</option>`).join('');
    const athSel = document.getElementById('dup-athlete');
    athSel.innerHTML = '<option value="">Chargement…</option>';
    setDupDest('prog');
    document.getElementById('dup-modal').classList.add('open');
    const mixed = await loadMixedAthletesWithAdmins();
    dupMixedAthletesCache = mixed;
    if(!mixed.length){
      athSel.innerHTML = '<option value="">— Aucun athlète —</option>';
    } else {
      athSel.innerHTML = mixed.map(a=>{
        const tag = a._progCount>=2 ? ` · ${a._progCount} progs 🔀` : (a._progCount===1 ? ` · 1 prog` : '');
        const star = a.coach_favorite ? '★ ' : '';
        return `<option value="${a.id}">${star}${escapeHtml(a.full_name||a.email||'Athlète')}${tag}</option>`;
      }).join('');
    }
  };
})();

// Ajoute un bouton "→ Perso" à côté de "→ Séance+"
// dans la Vue Session du cycle. Permet de créer un
// cycle et d'envoyer directement une case vers
// l'espace perso d'un athlète (pas besoin d'un
// programme dédié pour un seul athlète).
// ===================================================
(function(){
  if(window.__cycleToPersoBound) return;
  window.__cycleToPersoBound = true;

  // ---- Extraction des champs d'une case (réutilise le même mapping que transferCycleToSession) ----
  function _extractCycleSessionFields(wk, di){
    const fields = { wod:null, target:null, tips:null, intensity:null, inter:null, scaled:null, foundation:null };
    let hasContent = false;
    if(!cycleData || !cycleData.rows) return { fields, hasContent };
    cycleData.rows.forEach((rowName, ri) => {
      const field = _matchCycleRowField(rowName);
      if(!field) return;
      const key = `w${wk}-${ri}-${di}`;
      const chips = cycleData.sessionCells[key] || [];
      if(!chips.length) return;
      fields[field] = chips.map(c => (c && c.text != null ? c.text : '')).filter(t => t !== '').join('\n');
      hasContent = true;
    });
    return { fields, hasContent };
  }

  function _fillFormFromCycleFields(fields, wk, di){
    const startDateEl = document.getElementById('cycle-start-date');
    const startDate = startDateEl ? startDateEl.value : null;
    if(startDate){
      try{
        const base = new Date(startDate + 'T12:00:00');
        base.setDate(base.getDate() + wk * 7 + di);
        document.getElementById('f-date').value = base.toISOString().split('T')[0];
      }catch(e){}
    }
    if(fields.wod !== null && typeof setEditorContent === 'function') setEditorContent(_plainToEditorHtml(fields.wod));
    if(fields.target !== null){ const el=document.getElementById('f-target'); if(el) el.value=fields.target; }
    if(fields.tips !== null){ const el=document.getElementById('f-tips'); if(el) el.value=fields.tips; }
    if(fields.inter !== null){ const el=document.getElementById('f-scaling-inter'); if(el) el.value=fields.inter; }
    if(fields.scaled !== null){ const el=document.getElementById('f-scaling-scaled'); if(el) el.value=fields.scaled; }
    if(fields.foundation !== null){ const el=document.getElementById('f-scaling-foundation'); if(el) el.value=fields.foundation; }
    if(fields.intensity !== null){
      const v=parseInt(fields.intensity);
      if(!isNaN(v)){
        const el=document.getElementById('f-intensity'); const lbl=document.getElementById('f-int-val');
        if(el) el.value=v; if(lbl) lbl.textContent=v;
      }
    }
  }

  // ---- Modal athlète (créée dynamiquement, une seule fois) ----
  let _pendingCyclePerso = null; // {wk, di}

  function _ensureModal(){
    if(document.getElementById('cycle-to-perso-modal')) return;
    const div = document.createElement('div');
    div.className = 'modal-overlay';
    div.id = 'cycle-to-perso-modal';
    div.innerHTML = `
      <div class="modal-box" style="position:relative">
        <button onclick="closeCycleToPersoModal()" style="position:absolute;top:10px;right:14px;background:none;border:none;color:var(--muted);font-size:24px;line-height:1;cursor:pointer;padding:4px 6px">×</button>
        <div class="modal-title">👤 Envoyer vers l'espace perso</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:14px">Choisis l'athlète qui recevra cette séance.</div>
        <div class="form-group">
          <label class="form-label">Athlète</label>
          <select class="form-select" id="cycle-to-perso-athlete"><option value="">Chargement…</option></select>
        </div>
        <button class="btn-modal-save" onclick="confirmCycleToPerso()">👤 Envoyer vers l'espace perso</button>
        <button class="btn-secondary" onclick="closeCycleToPersoModal()" style="margin-top:8px;width:100%">Annuler</button>
      </div>`;
    document.body.appendChild(div);
  }

  window.closeCycleToPersoModal = function(){
    const m = document.getElementById('cycle-to-perso-modal');
    if(m) m.classList.remove('open');
    _pendingCyclePerso = null;
  };

  window.transferCycleToPerso = async function(wk, di){
    if(!cycleData || !cycleData.rows){ showToast('⚠️ Aucun cycle chargé'); return; }
    const { hasContent } = _extractCycleSessionFields(wk, di);
    if(!hasContent){ showToast('⚠️ Aucun contenu dans cette colonne'); return; }
    _pendingCyclePerso = { wk, di };
    _ensureModal();
    const sel = document.getElementById('cycle-to-perso-athlete');
    sel.innerHTML = '<option value="">Chargement…</option>';
    document.getElementById('cycle-to-perso-modal').classList.add('open');
    const mixed = (typeof loadMixedAthletesWithAdmins === 'function') ? await loadMixedAthletesWithAdmins() : [];
    if(!mixed.length){
      sel.innerHTML = '<option value="">— Aucun athlète —</option>';
    } else {
      sel.innerHTML = mixed.map(a => `<option value="${a.id}">${escapeHtml(a.full_name||a.email||'Athlète')}</option>`).join('');
    }
  };

  window.confirmCycleToPerso = async function(){
    if(!_pendingCyclePerso) { closeCycleToPersoModal(); return; }
    const athleteId = document.getElementById('cycle-to-perso-athlete').value;
    if(!athleteId){ showToast('⚠️ Choisis un athlète'); return; }
    const { wk, di } = _pendingCyclePerso;
    const { fields, hasContent } = _extractCycleSessionFields(wk, di);
    if(!hasContent){ showToast('⚠️ Aucun contenu dans cette colonne'); closeCycleToPersoModal(); return; }

    // S'assurer que l'athlète est en cache pour l'affichage du bandeau perso
    if(!persoAthletesCache.find(a => a.id === athleteId)){
      const { data: ath } = await sb.from('profiles').select('*').eq('id', athleteId).single();
      if(ath) persoAthletesCache.push(ath);
    }

    closeCycleToPersoModal();

    window._returnToSessionsAfterSave = false;
    window._returnToPlanningAfterSave = false;
    const newSessionBtn = Array.from(document.querySelectorAll('.admin-tab-btn'))
      .find(b => (b.getAttribute('onclick') || '').includes("'new-session'"));
    if(typeof resetSessionForm === 'function') resetSessionForm();
    if(typeof adminTab === 'function' && newSessionBtn) adminTab('new-session', newSessionBtn);

    enterPersoFormMode(athleteId);
    _fillFormFromCycleFields(fields, wk, di);
    window._returnToCycleAfterSave = cycleMode || 'session';

    showToast('✅ Champs pré-remplis (espace perso)');
    const pageAdmin = document.getElementById('page-admin');
    if(pageAdmin) pageAdmin.scrollTop = 0;
  };

  // ---- Injection du bouton "→ Perso" à côté de "→ Séance+" ----
  function _patchRenderSessionGridForPerso(){
    const orig = window.renderSessionGrid;
    if(!orig || orig.__transferPersoPatched) return;
    window.renderSessionGrid = function(){
      orig.apply(this, arguments);
      const grid = document.getElementById('cycle-grid');
      if(!grid) return;
      grid.querySelectorAll('.session-grid-table').forEach((table, wk) => {
        const ths = table.querySelectorAll('thead tr th');
        ths.forEach((th, idx) => {
          if(idx === 0) return;
          const di = idx - 1;
          if(th.querySelector('.cycle-to-perso-btn')) return; // idempotent
          const btn = document.createElement('button');
          btn.className = 'cycle-to-perso-btn';
          btn.title = "Envoyer vers l'espace perso d'un athlète";
          btn.innerHTML = '→ Perso';
          btn.style.cssText = 'display:block;margin:3px auto 0;padding:2px 7px;font-size:10px;font-weight:700;background:var(--card2);border:1px solid #e8ff47;color:#e8ff47;border-radius:5px;cursor:pointer;white-space:nowrap;letter-spacing:.5px';
          btn.addEventListener('click', (e) => { e.stopPropagation(); transferCycleToPerso(wk, di); });
          th.appendChild(btn);
        });
      });
    };
    window.renderSessionGrid.__transferPersoPatched = true;
  }

  if(typeof window.renderSessionGrid === 'function'){
    _patchRenderSessionGridForPerso();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if(typeof renderSessionGrid === 'function') _patchRenderSessionGridForPerso();
    });
  }
  // Sécurité si le patch "→ Séance+" (chargé avant) redéfinit renderSessionGrid après nous
  setTimeout(_patchRenderSessionGridForPerso, 900);
})();

/* ============================================================
   PATCH 2 — Visibilité manuelle pour TOUTE la semaine affichée
   Ajoute un bouton 📅 à côté de ‹ › dans l'onglet Planning (admin)
   ============================================================ */
(function(){
  if(window.__patchWeekVisibleFrom)return;
  window.__patchWeekVisibleFrom=true;

  function injectWeekVisibilityButton(){
    if(document.getElementById('week-visibility-btn'))return;
    const dupBtn=document.querySelector('[onclick="openDupWeekModalV2()"]')||document.querySelector('[onclick^="openDupWeekModal"]');
    if(!dupBtn)return;
    const btn=document.createElement('button');
    btn.className='arrow-btn';
    btn.id='week-visibility-btn';
    btn.title="Programmer l'apparition de toute la semaine";
    btn.style.fontSize='14px';
    btn.textContent='📅';
    btn.onclick=openWeekVisibilityModal;
    dupBtn.insertAdjacentElement('afterend',btn);
  }

  function buildModal(){
    if(document.getElementById('week-vis-modal'))return;
    const modal=document.createElement('div');
    modal.id='week-vis-modal';
    modal.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;align-items:center;justify-content:center';
    modal.innerHTML=`
      <div style="background:var(--card,#1a1a1a);border:1px solid var(--border2,#333);border-radius:14px;padding:20px;width:min(320px,90vw)">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px;margin-bottom:12px" id="week-vis-title">Programmer la semaine</div>
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <input type="date" id="week-vis-date" style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--border2,#333);background:var(--card2,#111);color:var(--text,#fff)">
          <input type="time" id="week-vis-time" value="09:00" style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--border2,#333);background:var(--card2,#111);color:var(--text,#fff)">
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button id="week-vis-apply" style="padding:10px;border-radius:10px;border:none;background:var(--accent,#e8ff47);color:#000;font-weight:700;cursor:pointer">Programmer cette date</button>
          <button id="week-vis-now" style="padding:10px;border-radius:10px;border:1px solid var(--border2,#333);background:transparent;color:var(--text,#fff);cursor:pointer">👁 Rendre visible maintenant</button>
          <button id="week-vis-reset" style="padding:10px;border-radius:10px;border:1px solid var(--border2,#333);background:transparent;color:var(--muted,#999);cursor:pointer">↩ Repasser en mode auto (semaine en cours)</button>
          <button id="week-vis-cancel" style="padding:8px;border-radius:10px;border:none;background:transparent;color:var(--muted,#999);cursor:pointer">Annuler</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('week-vis-cancel').onclick=()=>{modal.style.display='none';};
    document.getElementById('week-vis-apply').onclick=()=>applyWeekVisibility('scheduled');
    document.getElementById('week-vis-now').onclick=()=>applyWeekVisibility('now');
    document.getElementById('week-vis-reset').onclick=()=>applyWeekVisibility('reset');
  }

  function openWeekVisibilityModal(){
    buildModal();
    const progId=document.getElementById('admin-filter-prog')?.value;
    const prog=typeof getProgById==='function'?getProgById(progId):null;
    const oneshot=typeof isOneshotProg==='function'&&isOneshotProg(prog);
    const label=oneshot
      ?`Semaine ${adminWeekOffset+1} / ${prog?.total_weeks||8}`
      :(typeof getWeekDates==='function'?(()=>{const d=getWeekDates(adminWeekOffset);return `Semaine du ${d[0].getDate()}/${d[0].getMonth()+1} au ${d[6].getDate()}/${d[6].getMonth()+1}`;})():'la semaine affichée');
    document.getElementById('week-vis-title').textContent=`Programmer : ${label}`;
    document.getElementById('week-vis-date').value='';
    document.getElementById('week-vis-time').value='09:00';
    document.getElementById('week-vis-modal').style.display='flex';
  }

  async function applyWeekVisibility(mode){
    const progId=document.getElementById('admin-filter-prog')?.value;
    if(!progId){showToast('⚠️ Choisis un programme');return;}
    const prog=typeof getProgById==='function'?getProgById(progId):null;
    const oneshot=typeof isOneshotProg==='function'&&isOneshotProg(prog);

    let visibleFrom;
    if(mode==='now')visibleFrom=new Date().toISOString();
    else if(mode==='reset')visibleFrom=null;
    else{
      const d=document.getElementById('week-vis-date').value;
      const t=document.getElementById('week-vis-time').value||'00:00';
      if(!d){showToast('⚠️ Choisis une date');return;}
      visibleFrom=new Date(`${d}T${t}:00`).toISOString();
    }

    let q=sb.from('sessions').update({visible_from:visibleFrom});
    if(oneshot){
      q=q.eq('programme_id',progId).eq('week_number',adminWeekOffset+1);
    } else {
      const isos=getWeekDates(adminWeekOffset).map(d=>d.toISOString().split('T')[0]);
      q=q.eq('programme_id',progId).in('date',isos);
    }
    const {error,data}=await q.select('id');
    if(error){showToast('❌ '+error.message);return;}
    document.getElementById('week-vis-modal').style.display='none';
    const n=data?.length||0;
    if(mode==='reset')showToast(`↩ ${n} séance${n>1?'s':''} repassée${n>1?'s':''} en mode auto`);
    else if(mode==='now')showToast(`👁 ${n} séance${n>1?'s':''} rendue${n>1?'s':''} visible${n>1?'s':''}`);
    else showToast(`📅 ${n} séance${n>1?'s':''} programmée${n>1?'s':''}`);
    if(typeof loadAdminCalendar==='function')loadAdminCalendar();
  }

  // Injecte le bouton à chaque affichage du calendrier admin
  const __origLoadAdminCalendarWV=window.loadAdminCalendar;
  if(typeof __origLoadAdminCalendarWV==='function'){
    window.loadAdminCalendar=async function(...args){
      const r=await __origLoadAdminCalendarWV.apply(this,args);
      injectWeekVisibilityButton();
      return r;
    };
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(injectWeekVisibilityButton,800));
})();

/* ============================================================
   PATCH 2bis — Nom de semaine personnalisé (Espace perso)
   Permet de donner un nom à la semaine affichée en plus de son
   numéro (ex: "Prépa comp 1/5"), visible admin + athlète,
   éditable par clic sur le label (admin uniquement).
   ============================================================ */
(function(){
  if(window.__patchPersoWeekLabel)return;
  window.__patchPersoWeekLabel=true;

  function buildLabelModal(){
    if(document.getElementById('perso-week-label-modal'))return;
    const modal=document.createElement('div');
    modal.id='perso-week-label-modal';
    modal.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;align-items:center;justify-content:center';
    modal.innerHTML=`
      <div style="background:var(--card,#1a1a1a);border:1px solid var(--border2,#333);border-radius:14px;padding:20px;width:min(320px,90vw)">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px;margin-bottom:4px">Nommer la semaine</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:14px" id="perso-week-label-sub">—</div>
        <input type="text" id="perso-week-label-input" placeholder="Ex: Prépa comp 1/5" maxlength="60" style="width:100%;padding:9px 10px;border-radius:8px;border:1px solid var(--border2,#333);background:var(--card2,#111);color:var(--text,#fff);font-size:14px;box-sizing:border-box;margin-bottom:14px">
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
          <button id="perso-week-label-clear" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border2,#333);background:transparent;color:var(--muted);cursor:pointer;font-size:13px">Effacer</button>
          <button id="perso-week-label-cancel" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border2,#333);background:transparent;color:var(--text,#fff);cursor:pointer;font-size:13px">Annuler</button>
          <button id="perso-week-label-save" style="padding:8px 14px;border-radius:8px;border:none;background:var(--accent,#e8ff47);color:#111;cursor:pointer;font-weight:600;font-size:13px">OK</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)closeLabelModal();});
    document.getElementById('perso-week-label-cancel').onclick=closeLabelModal;
  }

  function closeLabelModal(){
    const m=document.getElementById('perso-week-label-modal');
    if(m)m.style.display='none';
  }
  window.closePersoWeekLabelModal=closeLabelModal;

  let _pwlCtx=null; // {athleteId, weekStart, onSaved}

  async function savePersoWeekLabel(value){
    if(!_pwlCtx)return;
    const {athleteId,weekStart,onSaved}=_pwlCtx;
    if(!value){
      const {error}=await sb.from('personal_week_labels').delete().eq('athlete_id',athleteId).eq('week_start',weekStart);
      if(error){showToast('❌ '+error.message);return;}
    } else {
      const {error}=await sb.from('personal_week_labels').upsert({athlete_id:athleteId,week_start:weekStart,label:value,created_by:currentUser?.id,updated_at:new Date().toISOString()},{onConflict:'athlete_id,week_start'});
      if(error){showToast('❌ '+error.message);return;}
    }
    closeLabelModal();
    showToast(value?'✅ Semaine nommée':'🗑️ Nom supprimé');
    if(typeof onSaved==='function')onSaved(value);
  }

  // athleteId, weekStart (YYYY-MM-DD du lundi), currentLabel, subText (ex: "Sem. 34 — Août"), onSaved(newValue)
  window.openPersoWeekLabelEditor=function(athleteId,weekStart,currentLabel,subText,onSaved){
    buildLabelModal();
    _pwlCtx={athleteId,weekStart,onSaved};
    document.getElementById('perso-week-label-sub').textContent=subText||'';
    const input=document.getElementById('perso-week-label-input');
    input.value=currentLabel||'';
    const modal=document.getElementById('perso-week-label-modal');
    modal.style.display='flex';
    setTimeout(()=>{input.focus();input.select();},30);
    const clearBtn=document.getElementById('perso-week-label-clear');
    clearBtn.style.display=currentLabel?'':'none';
    clearBtn.onclick=()=>savePersoWeekLabel('');
    const saveBtn=document.getElementById('perso-week-label-save');
    saveBtn.onclick=()=>savePersoWeekLabel(input.value.trim());
    input.onkeydown=(e)=>{
      if(e.key==='Enter'){e.preventDefault();saveBtn.click();}
      else if(e.key==='Escape'){closeLabelModal();}
    };
  };
})();

/* ============================================================
   PATCH 3 — Visibilité manuelle pour TOUTE la semaine (Espace perso)
   Ajoute un bouton 📅 à côté de ‹ › dans l'espace perso (fiche athlète)
   ============================================================ */
(function(){
  if(window.__patchPersoWeekVisibleFrom)return;
  window.__patchPersoWeekVisibleFrom=true;

  function injectPersoWeekVisibilityButton(){
    if(document.getElementById('perso-week-visibility-btn'))return;
    const dupBtn=document.querySelector('[onclick="openDupPersoWeekModal()"]');
    if(!dupBtn)return;
    const btn=document.createElement('button');
    btn.className='arrow-btn';
    btn.id='perso-week-visibility-btn';
    btn.title="Programmer l'apparition de toute la semaine";
    btn.style.fontSize='14px';
    btn.textContent='📅';
    btn.onclick=openPersoWeekVisibilityModal;
    dupBtn.insertAdjacentElement('afterend',btn);
  }

  function buildModal(){
    if(document.getElementById('perso-week-vis-modal'))return;
    const modal=document.createElement('div');
    modal.id='perso-week-vis-modal';
    modal.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;align-items:center;justify-content:center';
    modal.innerHTML=`
      <div style="background:var(--card,#1a1a1a);border:1px solid var(--border2,#333);border-radius:14px;padding:20px;width:min(320px,90vw)">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px;margin-bottom:12px" id="perso-week-vis-title">Programmer la semaine</div>
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <input type="date" id="perso-week-vis-date" style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--border2,#333);background:var(--card2,#111);color:var(--text,#fff)">
          <input type="time" id="perso-week-vis-time" value="09:00" style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--border2,#333);background:var(--card2,#111);color:var(--text,#fff)">
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button id="perso-week-vis-apply" style="padding:10px;border-radius:10px;border:none;background:var(--accent,#e8ff47);color:#000;font-weight:700;cursor:pointer">Programmer cette date</button>
          <button id="perso-week-vis-now" style="padding:10px;border-radius:10px;border:1px solid var(--border2,#333);background:transparent;color:var(--text,#fff);cursor:pointer">👁 Rendre visible maintenant</button>
          <button id="perso-week-vis-reset" style="padding:10px;border-radius:10px;border:1px solid var(--border2,#333);background:transparent;color:var(--muted,#999);cursor:pointer">↩ Repasser en mode auto (semaine en cours)</button>
          <button id="perso-week-vis-cancel" style="padding:8px;border-radius:10px;border:none;background:transparent;color:var(--muted,#999);cursor:pointer">Annuler</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('perso-week-vis-cancel').onclick=()=>{modal.style.display='none';};
    document.getElementById('perso-week-vis-apply').onclick=()=>applyPersoWeekVisibility('scheduled');
    document.getElementById('perso-week-vis-now').onclick=()=>applyPersoWeekVisibility('now');
    document.getElementById('perso-week-vis-reset').onclick=()=>applyPersoWeekVisibility('reset');
  }

  function openPersoWeekVisibilityModal(){
    if(!currentPersoAthlete){showToast('⚠️ Aucun athlète sélectionné');return;}
    if(persoView!=='week'){showToast("⚠️ Passe en vue semaine d'abord");return;}
    buildModal();
    const dates=getWeekDates(persoOffset);
    const label=`Sem. du ${dates[0].getDate()}/${dates[0].getMonth()+1} au ${dates[6].getDate()}/${dates[6].getMonth()+1} — ${currentPersoAthlete.full_name||currentPersoAthlete.email||''}`;
    document.getElementById('perso-week-vis-title').textContent=`Programmer : ${label}`;
    document.getElementById('perso-week-vis-date').value='';
    document.getElementById('perso-week-vis-time').value='09:00';
    document.getElementById('perso-week-vis-modal').style.display='flex';
  }

  async function applyPersoWeekVisibility(mode){
    if(!currentPersoAthlete)return;
    let visibleFrom;
    if(mode==='now')visibleFrom=new Date().toISOString();
    else if(mode==='reset')visibleFrom=null;
    else{
      const d=document.getElementById('perso-week-vis-date').value;
      const t=document.getElementById('perso-week-vis-time').value||'00:00';
      if(!d){showToast('⚠️ Choisis une date');return;}
      visibleFrom=new Date(`${d}T${t}:00`).toISOString();
    }
    const isos=getWeekDates(persoOffset).map(d=>d.toISOString().split('T')[0]);
    const {error,data}=await sb.from('personal_sessions')
      .update({visible_from:visibleFrom})
      .eq('athlete_id',currentPersoAthlete.id)
      .in('date',isos)
      .select('id');
    if(error){showToast('❌ '+error.message);return;}
    document.getElementById('perso-week-vis-modal').style.display='none';
    const n=data?.length||0;
    if(mode==='reset')showToast(`↩ ${n} séance${n>1?'s':''} repassée${n>1?'s':''} en mode auto`);
    else if(mode==='now')showToast(`👁 ${n} séance${n>1?'s':''} rendue${n>1?'s':''} visible${n>1?'s':''}`);
    else showToast(`📅 ${n} séance${n>1?'s':''} programmée${n>1?'s':''}`);
    if(typeof renderPersoCalendar==='function')renderPersoCalendar();
  }

  // Injecte le bouton à chaque affichage du calendrier perso
  const __origRenderPersoCalendarWV=window.renderPersoCalendar;
  if(typeof __origRenderPersoCalendarWV==='function'){
    window.renderPersoCalendar=async function(...args){
      const r=await __origRenderPersoCalendarWV.apply(this,args);
      injectPersoWeekVisibilityButton();
      return r;
    };
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(injectPersoWeekVisibilityButton,800));
})();

// ============================================================
// RÉSILIATION ABONNEMENT — bouton dans la page Profil
// ============================================================
(function () {
  if (window.__cancelSubPatchBound) return;
  window.__cancelSubPatchBound = true;

  // ── Injection du bouton dans le menu Profil ──
  function _injectCancelSubButton() {
    if (document.getElementById('cancel-sub-btn')) return;
    const profilPage = document.getElementById('page-profil');
    if (!profilPage) return;
    const logoutBtn = profilPage.querySelector('.btn-logout');
    if (!logoutBtn) return;

    const btn = document.createElement('div');
    btn.className = 'menu-item';
    btn.id = 'cancel-sub-btn';
    btn.style.cursor = 'pointer';
    btn.onclick = () => openManageSubscription();
    btn.innerHTML = '<span class="menu-item-label">💳 Gérer / résilier mon abonnement</span><span>›</span>';
    logoutBtn.insertAdjacentElement('beforebegin', btn);
  }

  // Hook goPage pour injecter le bouton à chaque arrivée sur Profil
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      if (typeof goPage === 'function') {
        const _existingGoPage = goPage;
        window.goPage = async function (page) {
          await _existingGoPage.apply(this, arguments);
          if (page === 'profil') _injectCancelSubButton();
        };
      }
    }, 1200);
  });

  // ── Logique principale ──
  window.openManageSubscription = async function (programmeId) {
    if (!currentUser) { showToast('⚠️ Connecte-toi d\'abord'); return; }
    showToast('⏳ Chargement...');
    try {
      const { data: { session } } = await sb.auth.getSession();
      const token = session?.access_token;
      if (!token) { showToast('⚠️ Session expirée — reconnecte-toi'); return; }

      const fnUrl = (window.SUPABASE_URL || sb.supabaseUrl || '').replace(/\/$/, '') + '/functions/v1/create-billing-portal-session';
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(programmeId ? { programme_id: programmeId } : {})
      });
      const data = await res.json();

      if (data.error) { showToast('❌ ' + data.error); return; }

      if (data.choices && data.choices.length) {
        _showSubscriptionChoiceModal(data.choices);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        showToast('❌ Impossible d\'ouvrir la gestion d\'abonnement');
      }
    } catch (e) {
      console.error('openManageSubscription error', e);
      showToast('❌ Erreur : ' + e.message);
    }
  };

  // ── Petit modal si plusieurs abonnements actifs ──
  function _showSubscriptionChoiceModal(choices) {
    document.getElementById('cancel-sub-choice-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'cancel-sub-choice-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:var(--card,#161616);border:1px solid var(--border2,#2a2a2a);border-radius:16px;padding:20px;width:100%;max-width:340px">
        <div style="font-weight:700;font-size:15px;margin-bottom:14px;color:var(--text,#f0f0f0)">Quel abonnement gérer ?</div>
        <div style="display:flex;flex-direction:column;gap:8px" id="cancel-sub-choice-list"></div>
        <button id="cancel-sub-choice-close" style="margin-top:14px;width:100%;padding:10px;border-radius:10px;background:var(--card2,#222);border:1px solid var(--border2,#2a2a2a);color:var(--muted,#999);font-weight:600;cursor:pointer">Annuler</button>
      </div>`;
    const list = modal.querySelector('#cancel-sub-choice-list');
    choices.forEach(c => {
      const item = document.createElement('button');
      item.textContent = c.name;
      item.style.cssText = 'padding:12px;border-radius:10px;background:var(--card2,#222);border:1px solid var(--border2,#2a2a2a);color:var(--text,#f0f0f0);font-weight:600;text-align:left;cursor:pointer';
      item.onclick = () => { modal.remove(); openManageSubscription(c.programme_id); };
      list.appendChild(item);
    });
    modal.querySelector('#cancel-sub-choice-close').onclick = () => modal.remove();
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }
})();
/* ============================================================
   PATCH — à coller à la FIN de wellness.js
   1) Coach : ajouter / modifier un PR d'un athlète (fiche athlète admin)
   2) Couleur du bloc séance auto-liée au TYPE, configurable par studio
      (page Admin → nouvel onglet "🎨 Couleurs")
   ============================================================ */
(function(){
  if(window.__patchBound_coachPrColor) return;
  window.__patchBound_coachPrColor = true;

  /* ---------------------------------------------------------
     1) COACH → AJOUTER / MODIFIER LES PR D'UN ATHLÈTE
     --------------------------------------------------------- */

  let _coachPrAthleteId = null;
  let _coachPrEditingId = null;

  function ensureCoachPrModal(){
    if(document.getElementById('coach-pr-modal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'coach-pr-modal';
    overlay.className = 'modal-overlay';
    overlay.onclick = (e) => { if(e.target === overlay) closeCoachPrModal(); };
    overlay.innerHTML = `
      <div class="modal">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div class="modal-title" style="margin-bottom:0">🏆 PR de l'athlète</div>
          <button onclick="closeCoachPrModal()" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;padding:4px">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">Mouvement</label>
          <input type="text" class="form-input" id="coach-pr-movement-search" placeholder="Rechercher un mouvement…" autocomplete="off">
          <div id="coach-pr-movement-list" style="max-height:180px;overflow-y:auto;margin-top:8px;border:1.5px solid var(--border2);border-radius:10px;background:var(--dark)"></div>
          <div id="coach-pr-movement-selected" style="margin-top:8px;font-size:12px;color:var(--accent);font-weight:700"></div>
          <input type="hidden" id="coach-pr-movement">
        </div>
        <div class="form-group">
          <label class="form-label">Format</label>
          <div id="coach-pr-format-chips" style="display:flex;flex-wrap:wrap;gap:6px"></div>
          <input type="hidden" id="coach-pr-format">
          <div id="coach-pr-existing" style="margin-top:10px"></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Valeur</label>
            <input type="number" step="0.5" class="form-input" id="coach-pr-value" placeholder="Ex: 100">
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" class="form-input" id="coach-pr-date">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Note (optionnel)</label>
          <input type="text" class="form-input" id="coach-pr-note" placeholder="Contexte, ressenti...">
        </div>
        <label for="coach-pr-estimate" style="display:flex;align-items:flex-start;gap:10px;background:var(--card);border:1.5px solid var(--border2);border-radius:10px;padding:11px 13px;margin-bottom:14px;cursor:pointer">
          <input type="checkbox" id="coach-pr-estimate" style="margin-top:2px;width:17px;height:17px;accent-color:var(--accent);flex-shrink:0">
          <span style="font-size:12px;line-height:1.5;color:var(--text)">
            <b>Charge de travail</b> — valeur posée par le coach, pas un record réalisé.
            <span style="color:var(--muted)">Les % des séances se calculent dessus, et l'athlète la voit badgée dans son historique.</span>
          </span>
        </label>
        <button class="btn-modal-save" onclick="saveCoachPR()">Enregistrer le PR</button>
        <button class="btn-modal-cancel" onclick="closeCoachPrModal()">Annuler</button>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('coach-pr-movement-search').addEventListener('input', (e)=>{
      _renderCoachPrMovementList(e.target.value.trim().toLowerCase());
    });
  }

  let _coachPrAllMovements = [];

  function _renderCoachPrMovementList(filter){
    const list = document.getElementById('coach-pr-movement-list');
    if(!list) return;
    const q = (filter||'').toLowerCase();
    const filtered = q
      ? _coachPrAllMovements.filter(m => m.name.toLowerCase().includes(q))
      : _coachPrAllMovements;
    if(!filtered.length){
      list.innerHTML = '<div style="padding:10px;color:var(--muted);font-size:12px">Aucun mouvement trouvé.</div>';
      return;
    }
    const currentId = document.getElementById('coach-pr-movement').value;
    list.innerHTML = filtered.slice(0, 100).map(m => `
      <div class="coach-pr-mv-item" data-id="${m.id}" style="padding:9px 12px;cursor:pointer;font-size:13px;
        background:${m.id===currentId?'var(--card2)':'transparent'};
        color:${m.id===currentId?'var(--accent)':'var(--text)'};
        border-bottom:1px solid var(--border)">${escapeHtml(m.name)}</div>
    `).join('');
    list.querySelectorAll('.coach-pr-mv-item').forEach(el=>{
      el.onclick = () => _selectCoachPrMovement(el.dataset.id);
    });
  }

  function _selectCoachPrMovement(id, keepFormat){
    const mv = _coachPrAllMovements.find(m=>m.id===id);
    if(!mv) return;
    document.getElementById('coach-pr-movement').value = id;
    document.getElementById('coach-pr-movement-selected').textContent = '✓ ' + mv.name;
    document.getElementById('coach-pr-movement-search').value = '';
    _renderCoachPrMovementList('');
    _renderCoachPrFormats(mv, keepFormat);
    _loadCoachPrExisting(id);
  }

  // Formats = ceux du mouvement, en chips. Le texte libre faisait échouer en silence
  // la résolution des formules de % dans les séances (match strict sur le libellé).
  function _coachPrFormatsOf(mv){
    return String((mv&&mv.available_formats)||'').split(',')
      .map(f=>f.trim()).filter(Boolean);
  }
  function _renderCoachPrFormats(mv, keepFormat){
    const box = document.getElementById('coach-pr-format-chips');
    const hidden = document.getElementById('coach-pr-format');
    if(!box||!hidden) return;
    const formats = _coachPrFormatsOf(mv);
    if(!formats.length){
      hidden.value = '';
      box.innerHTML = '<div style="font-size:12px;color:var(--muted)">Ce mouvement n\'a pas de format défini — le PR sera enregistré sans format.</div>';
      return;
    }
    const norm = s => String(s||'').trim().toLowerCase().replace(/\s+/g,'');
    let sel = formats.find(f => norm(f)===norm(keepFormat));
    if(!sel) sel = formats.find(f => /^1\s*RM$/i.test(f)) || formats[0];
    hidden.value = sel;
    box.innerHTML = formats.map(f =>
      `<button type="button" class="coach-pr-fmt" data-fmt="${escapeHtml(f)}" style="padding:6px 13px;border-radius:20px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;
        border:1.5px solid ${f===sel?'var(--accent)':'var(--border2)'};
        background:${f===sel?'rgba(232,255,71,.10)':'transparent'};
        color:${f===sel?'var(--accent)':'var(--muted)'}">${escapeHtml(f)}</button>`
    ).join('');
    box.querySelectorAll('.coach-pr-fmt').forEach(b=>{
      b.onclick = () => {
        hidden.value = b.dataset.fmt;
        _renderCoachPrFormats(mv, b.dataset.fmt);
        _loadCoachPrExisting(document.getElementById('coach-pr-movement').value);
      };
    });
  }

  // Rappel des PR déjà enregistrés par l'athlète sur ce mouvement + ce format
  async function _loadCoachPrExisting(movementId){
    const box = document.getElementById('coach-pr-existing');
    if(!box) return;
    if(!movementId || !_coachPrAthleteId){ box.innerHTML=''; return; }
    const fmt = document.getElementById('coach-pr-format')?.value || '';
    const {data, error} = await sb.from('athlete_prs')
      .select('value,recorded_at,format,is_coach_estimate')
      .eq('athlete_id', _coachPrAthleteId)
      .eq('movement_id', movementId)
      .order('recorded_at', {ascending:false})
      .limit(30);
    if(error){ box.innerHTML=''; return; }
    const norm = s => String(s||'').trim().toLowerCase().replace(/\s+/g,'');
    const rows = (data||[]).filter(p => !fmt || norm(p.format)===norm(fmt) || !norm(p.format)).slice(0,3);
    if(!rows.length){
      box.innerHTML = `<div style="font-size:12px;color:var(--muted)">Aucun PR${fmt?' en '+escapeHtml(fmt):''} pour cet athlète.</div>`;
      return;
    }
    box.innerHTML = `<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:5px">Déjà enregistré</div>`
      + rows.map(p=>`<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:3px 0;color:var(--text)">
          <span><b>${p.value}</b>${p.format?' <span style="color:var(--muted)">'+escapeHtml(p.format)+'</span>':''}${p.is_coach_estimate?' <span style="color:var(--muted);font-size:10px">· charge de travail</span>':''}</span>
          <span style="color:var(--muted)">${formatDate(p.recorded_at)}</span>
        </div>`).join('');
  }

  window.openCoachPrModal = async function(athleteId, prToEdit){
    ensureCoachPrModal();
    _coachPrAthleteId = athleteId;
    _coachPrEditingId = prToEdit ? prToEdit.id : null;

    // Recharge toujours une liste fraîche (évite les cas où `movements` n'est
    // pas encore prêt côté core.js selon le moment où le coach ouvre le modal)
    const {data: movs, error: movsErr} = await sb.from('movements')
      .select('id,name,unit,category,subcategory,available_formats')
      .eq('is_active', true).order('name');
    if(movsErr) console.warn('openCoachPrModal movements', movsErr);
    _coachPrAllMovements = movs || [];

    document.getElementById('coach-pr-movement').value = '';
    document.getElementById('coach-pr-movement-search').value = '';
    document.getElementById('coach-pr-movement-selected').textContent = '';
    document.getElementById('coach-pr-format').value = '';
    document.getElementById('coach-pr-format-chips').innerHTML = '';
    document.getElementById('coach-pr-existing').innerHTML = '';
    _renderCoachPrMovementList('');
    if(prToEdit?.movement_id) _selectCoachPrMovement(prToEdit.movement_id, prToEdit.format);

    document.getElementById('coach-pr-value').value = prToEdit?.value ?? '';
    document.getElementById('coach-pr-date').value = prToEdit?.recorded_at || new Date().toISOString().split('T')[0];
    document.getElementById('coach-pr-note').value = prToEdit?.note || '';
    document.getElementById('coach-pr-estimate').checked = !!prToEdit?.is_coach_estimate;

    document.getElementById('coach-pr-modal').classList.add('open');
  };

  window.closeCoachPrModal = function(){
    const m = document.getElementById('coach-pr-modal');
    if(m) m.classList.remove('open');
    _coachPrAthleteId = null;
    _coachPrEditingId = null;
  };

  window.saveCoachPR = async function(){
    if(!_coachPrAthleteId){showToast('❌ Athlète introuvable');return;}
    const movementId = document.getElementById('coach-pr-movement').value;
    const format = document.getElementById('coach-pr-format').value.trim() || null;
    const value = parseFloat(document.getElementById('coach-pr-value').value);
    const date = document.getElementById('coach-pr-date').value || new Date().toISOString().split('T')[0];
    const note = document.getElementById('coach-pr-note').value.trim() || null;
    const isEstimate = !!document.getElementById('coach-pr-estimate')?.checked;
    if(!movementId){showToast('⚠️ Choisis un mouvement dans la liste');return;}
    if(isNaN(value)){showToast('⚠️ Valeur requise');return;}

    const payload = {movement_id:movementId, value, recorded_at:date, format, note, is_coach_estimate:isEstimate};
    let error;
    if(_coachPrEditingId){
      ({error} = await sb.from('athlete_prs')
        .update(payload)
        .eq('id', _coachPrEditingId));
    } else {
      ({error} = await sb.from('athlete_prs')
        .insert({athlete_id:_coachPrAthleteId, ...payload}));
    }
    if(error){showToast('❌ '+error.message);console.error('saveCoachPR', error);return;}
    showToast(_coachPrEditingId ? '✅ PR modifié' : '🏆 PR ajouté');
    closeCoachPrModal();
    _refreshPRView(_coachPrAthleteId);
  };

  window.deleteCoachPR = async function(prId, athleteId){
    if(!confirm('Supprimer ce PR ?')) return;
    const {error} = await sb.from('athlete_prs').delete().eq('id', prId);
    if(error){showToast('❌ '+error.message);return;}
    showToast('🗑 PR supprimé');
    _refreshPRView(athleteId);
  };

  // Rendu de la fiche athlète DANS L'ONGLET DASHBOARD (dashOpenFiche → _dashRenderPRs)
  // C'est ici que le coach clique un athlète depuis le Dashboard.
  const _origDashRenderPRs = window._dashRenderPRs;
  window._dashRenderPRs = function(){
    _origDashRenderPRs();
    const wrap = document.getElementById('df-prs-list');
    if(!wrap) return;
    const athleteId = _dashCurrentAthleteId;
    if(!athleteId) return;

    // Bouton "+ Ajouter / modifier un PR" au-dessus de la liste
    let btn = document.getElementById('coach-pr-add-btn');
    if(!btn){
      btn = document.createElement('button');
      btn.id = 'coach-pr-add-btn';
      btn.className = 'btn-secondary';
      btn.style.cssText = 'margin-bottom:10px;padding:8px 12px;font-size:12px';
      wrap.parentNode.insertBefore(btn, wrap);
    }
    btn.textContent = '＋ Ajouter / modifier un PR';
    btn.onclick = () => openCoachPrModal(athleteId);

    // Cartes PR mouvements cliquables → édition rapide.
    // _dashPRsData contient déjà mid (movement_id) + le dernier PR (last) : matching fiable,
    // pas besoin de re-fetch ni de deviner via le nom affiché.
    const prCards = wrap.querySelectorAll('.afiche-pr');
    const prData = (_dashPRsData||[]).filter(it=>it.type!=='bench'); // dans l'ordre de rendu (prs avant bench)
    prCards.forEach((el, idx) => {
      const item = prData[idx];
      if(!item || !item.last) return; // au-delà : ce sont des cartes benchmark, pas de PR éditable ici
      el.style.cursor = 'pointer';
      el.onclick = (ev) => {
        ev.stopPropagation();
        openCoachPrModal(athleteId, {
          id: item.last.id,
          movement_id: item.mid,
          value: item.last.value,
          recorded_at: item.last.recorded_at,
          format: item.last.format,
          note: item.last.note,
          is_coach_estimate: item.last.is_coach_estimate
        });
      };
    });
  };

  // saveCoachPR/deleteCoachPR doivent rafraîchir la bonne vue selon le contexte
  // (fiche Dashboard prioritaire, fallback fiche Athlètes si jamais utilisée)
  function _refreshPRView(athleteId){
    if(typeof _dashLoadPRsAndBench === 'function' && _dashCurrentAthleteId === athleteId){
      _dashLoadPRsAndBench(athleteId);
    } else if(typeof _loadAthleteCardPRs === 'function'){
      _loadAthleteCardPRs(athleteId);
    }
  }


  /* ---------------------------------------------------------
     2) COULEUR DU BLOC SÉANCE ↔ TYPE, PARAMÉTRABLE PAR STUDIO
     --------------------------------------------------------- */

  const DEFAULT_TYPE_COLORS = {
    wod:            '#e8ff47',
    strength:       '#ff4747',
    weightlifting:  '#c847ff',
    gymnastics:     '#47c8ff',
    renforcement:   '#ff8c47',
    bodybuilding:   '#ffd147',
    skill:          '#47ff8c',
    warmup:         '#ffffff',
    mobility:       '#47ffd1',
    engine:         '#7c47ff',
    run:            '#ff47c8',
  };
  const TYPE_LABELS = {
    wod:'WOD', strength:'Force', weightlifting:'Weightlifting', gymnastics:'Gymnastics',
    renforcement:'Renforcement', bodybuilding:'Bodybuilding', skill:'Skill',
    warmup:'Échauffement', mobility:'Mobilité', engine:'Engine', run:'Run'
  };
  const COLOR_PALETTE = ['#e8ff47','#ff4747','#47c8ff','#ff8c47','#c847ff','#47ff8c','#ffd147','#ff47c8','#47ffd1','#7c47ff','#ff6b47','#ffffff'];

  function _safeCopy(o){return JSON.parse(JSON.stringify(o));}
  let _typeColors = _safeCopy(DEFAULT_TYPE_COLORS);
  let _typeColorsLoaded = false;

  async function loadTypeColors(){
    const studioId = (typeof getStudioId === 'function') ? getStudioId() : null;
    try{
      let q = sb.from('session_type_colors').select('type,color');
      q = studioId ? q.eq('studio_id', studioId) : q.is('studio_id', null);
      const {data, error} = await q;
      if(error) console.warn('loadTypeColors', error);
      _typeColors = _safeCopy(DEFAULT_TYPE_COLORS);
      (data||[]).forEach(row=>{ _typeColors[row.type] = row.color; });
    }catch(e){
      console.warn('loadTypeColors failed', e);
      _typeColors = _safeCopy(DEFAULT_TYPE_COLORS);
    }
    _typeColorsLoaded = true;
  }

  async function saveTypeColor(type, color){
    const studioId = (typeof getStudioId === 'function') ? getStudioId() : null;
    // update d'abord (gère le cas studio_id NULL proprement), insert si rien mis à jour
    let upd;
    if(studioId){
      upd = await sb.from('session_type_colors').update({color}).eq('studio_id', studioId).eq('type', type).select();
    } else {
      upd = await sb.from('session_type_colors').update({color}).is('studio_id', null).eq('type', type).select();
    }
    if(upd.error){ showToast('❌ '+upd.error.message); console.error('saveTypeColor update', upd.error); return false; }
    if(!upd.data || !upd.data.length){
      const ins = await sb.from('session_type_colors').insert({ studio_id: studioId, type, color });
      if(ins.error){ showToast('❌ '+ins.error.message); console.error('saveTypeColor insert', ins.error); return false; }
    }
    _typeColors[type] = color;
    return true;
  }

  let _colorManuallySet = false;

  const _origSelectSessionColor = window.selectSessionColor;
  window.selectSessionColor = function(color, el){
    _colorManuallySet = true;
    return _origSelectSessionColor(color, el);
  };

  window.onFTypeChange = async function(){
    if(typeof toggleSetsField === 'function') toggleSetsField();
    if(_colorManuallySet) return;
    if(!_typeColorsLoaded) await loadTypeColors();

    const type = document.getElementById('f-type')?.value;
    const color = _typeColors[type];
    if(!color) return;

    selectedSessionColor = color;
    document.querySelectorAll('#f-colors .color-swatch').forEach(s=>s.classList.remove('selected'));
    const swatch = document.querySelector(`#f-colors .color-swatch[data-color="${color}"]`);
    if(swatch) swatch.classList.add('selected');
  };

  const _origResetSessionForm = window.resetSessionForm;
  window.resetSessionForm = function(){
    _colorManuallySet = false;
    _origResetSessionForm();
    if(typeof onFTypeChange === 'function') onFTypeChange();
  };

  const _origEditSession = window.editSession;
  if(typeof _origEditSession === 'function'){
    window.editSession = async function(...args){
      const r = await _origEditSession(...args);
      _colorManuallySet = true;
      return r;
    };
  }

  window.addEventListener('load', ()=>{ setTimeout(()=>{ loadTypeColors(); }, 1500); });

  /* ---------------------------------------------------------
     PANNEAU DE PARAMÉTRAGE — Admin → onglet "🎨 Couleurs"
     --------------------------------------------------------- */

  function ensureColorsTabButton(){
    const anyTabBtn = document.querySelector('.admin-tab-btn');
    if(!anyTabBtn) return;
    const bar = anyTabBtn.parentElement;
    if(!bar || document.getElementById('admin-colors-tab-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'admin-colors-tab-btn';
    btn.className = 'admin-tab-btn';
    btn.textContent = '🎨 Couleurs';
    btn.onclick = () => adminTabColors(btn);
    bar.appendChild(btn);
  }

  function ensureColorsPanel(){
    if(document.getElementById('admin-colors')) return;
    const adminPage = document.getElementById('page-admin');
    if(!adminPage) return;
    const panel = document.createElement('div');
    panel.className = 'admin-panel';
    panel.id = 'admin-colors';
    panel.innerHTML = `
      <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;margin-bottom:6px">🎨 COULEURS DES SÉANCES</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px">
        Personnalise la couleur automatiquement appliquée à chaque type de séance.
        Ce réglage est propre à ton studio.
      </div>
      <div id="admin-colors-list"></div>
    `;
    const panels = adminPage.querySelectorAll('.admin-panel');
    const lastPanel = panels[panels.length - 1];
    if(lastPanel) lastPanel.insertAdjacentElement('afterend', panel);
    else adminPage.appendChild(panel);
  }

  window.adminTabColors = async function(btn){
    document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
    ensureColorsPanel();
    document.getElementById('admin-colors').classList.add('active');
    if(!_typeColorsLoaded) await loadTypeColors();
    renderColorsPanel();
  };

  function renderColorsPanel(){
    const list = document.getElementById('admin-colors-list');
    if(!list) return;
    list.innerHTML = Object.keys(TYPE_LABELS).map(type=>{
      const color = _typeColors[type] || DEFAULT_TYPE_COLORS[type];
      const swatches = COLOR_PALETTE.map(c=>{
        const sel = c.toLowerCase()===color.toLowerCase();
        return `<button type="button" onclick="setTypeColor('${type}','${c}')" title="${c}"
          style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;
          border:${sel?'3px solid var(--text)':'2px solid var(--border2)'};padding:0;flex-shrink:0"></button>`;
      }).join('');
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="width:90px;font-size:13px;font-weight:600;flex-shrink:0">${TYPE_LABELS[type]}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;flex:1">${swatches}</div>
        <input type="color" value="${color}" onchange="setTypeColor('${type}',this.value)"
          style="width:32px;height:28px;border:none;border-radius:6px;cursor:pointer;background:none;padding:0;flex-shrink:0">
      </div>`;
    }).join('');
  }

  window.setTypeColor = async function(type, color){
    const ok = await saveTypeColor(type, color);
    if(ok){
      showToast('✅ Couleur mise à jour');
      renderColorsPanel();
    }
  };

  const _origGoPage2 = window.goPage;
  if(typeof _origGoPage2 === 'function'){
    window.goPage = async function(p){
      await _origGoPage2(p);
      if(p==='admin') setTimeout(ensureColorsTabButton, 200);
    };
  }

  /* ---------------------------------------------------------
     3) CRÉER UN ATHLÈTE DIRECTEMENT DEPUIS L'ADMIN
        (en plus du lien /register) — même onglet "🎨 Couleurs"
        renommé en "⚙️ Paramètres" pour héberger les deux blocs.
     --------------------------------------------------------- */

  // Renomme le bouton d'onglet une fois créé, et ajoute le bloc de création
  const _origEnsureColorsTabButton = ensureColorsTabButton;
  function ensureSettingsTabButton(){
    const anyTabBtn = document.querySelector('.admin-tab-btn');
    if(!anyTabBtn) return;
    const bar = anyTabBtn.parentElement;
    if(!bar) return;
    let btn = document.getElementById('admin-colors-tab-btn');
    if(!btn){
      btn = document.createElement('button');
      btn.id = 'admin-colors-tab-btn';
      btn.className = 'admin-tab-btn';
      btn.onclick = () => adminTabColors(btn);
      bar.appendChild(btn);
    }
    btn.textContent = '⚙️ Paramètres';
  }

  function ensureCreateAthleteBlock(){
    const panel = document.getElementById('admin-colors');
    if(!panel || document.getElementById('admin-create-athlete-block')) return;
    const block = document.createElement('div');
    block.id = 'admin-create-athlete-block';
    block.style.cssText = 'margin-top:28px;padding-top:20px;border-top:1px solid var(--border)';
    block.innerHTML = `
      <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;margin-bottom:6px">👤 CRÉER UN ATHLÈTE</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px">
        Crée directement un compte athlète dans ton studio, sans passer par le lien d'inscription.
      </div>
      <div class="form-group"><label class="form-label">Nom complet</label>
        <input type="text" class="form-input" id="ca-name" placeholder="Ex: Julie Martin"></div>
      <div class="form-group"><label class="form-label">Email</label>
        <input type="email" class="form-input" id="ca-email" placeholder="julie@exemple.fr"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Genre (optionnel)</label>
          <select class="form-select" id="ca-gender">
            <option value="">—</option>
            <option value="female">Femme</option>
            <option value="male">Homme</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Mot de passe (optionnel)</label>
          <input type="text" class="form-input" id="ca-password" placeholder="Auto-généré si vide"></div>
      </div>
      <button class="btn-primary" id="ca-submit-btn" onclick="createAthleteFromAdmin()">Créer l'athlète</button>
      <div id="ca-result" style="margin-top:12px;font-size:13px"></div>
    `;
    panel.appendChild(block);
  }

  window.createAthleteFromAdmin = async function(){
    const btn = document.getElementById('ca-submit-btn');
    const resultEl = document.getElementById('ca-result');
    const full_name = document.getElementById('ca-name').value.trim();
    const email = document.getElementById('ca-email').value.trim();
    const gender = document.getElementById('ca-gender').value || null;
    const password = document.getElementById('ca-password').value.trim() || null;

    if(!full_name || !email){ showToast('⚠️ Nom et email requis'); return; }

    btn.disabled = true;
    btn.textContent = 'Création…';
    resultEl.innerHTML = '';

    try{
      const { data: { session } } = await sb.auth.getSession();
      if(!session?.access_token) throw new Error('Session expirée — recharge la page');

      const resp = await fetch('/.netlify/functions/create-athlete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ full_name, email, gender, password })
      });
      const data = await resp.json();
      if(!resp.ok) throw new Error(data.error || 'Erreur inconnue');

      showToast('✅ Athlète créé');
      let html = `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px">
        <b>${data.athlete.full_name}</b> (${data.athlete.email}) a été créé(e).`;
      if(data.temp_password){
        html += `<br>Mot de passe temporaire : <code style="background:var(--card2);padding:2px 6px;border-radius:4px">${data.temp_password}</code>
          <div style="color:var(--muted);font-size:11px;margin-top:4px">Transmets-le à l'athlète — il pourra le changer depuis son profil.</div>`;
      }
      html += `</div>`;
      resultEl.innerHTML = html;

      document.getElementById('ca-name').value = '';
      document.getElementById('ca-email').value = '';
      document.getElementById('ca-gender').value = '';
      document.getElementById('ca-password').value = '';

      if(typeof loadAdminAthletes === 'function') loadAdminAthletes();
    }catch(e){
      showToast('❌ '+e.message);
      resultEl.innerHTML = `<div style="color:var(--red)">${e.message}</div>`;
    }finally{
      btn.disabled = false;
      btn.textContent = "Créer l'athlète";
    }
  };

  // Surcharge adminTabColors pour aussi injecter le bloc création + renommer l'onglet
  const _origAdminTabColors = window.adminTabColors;
  window.adminTabColors = async function(btn){
    await _origAdminTabColors(btn);
    ensureCreateAthleteBlock();
  };

  // Remplace l'appel d'origine par la version qui renomme le bouton
  ensureColorsTabButton = ensureSettingsTabButton;

})();

// ===== PATCH: Vidéothèque admin — voir toutes les vidéos + modifier + mouvement optionnel =====
(function(){
  if(window.__videoAdminPatched) return;
  window.__videoAdminPatched = true;

  let editingVideoId = null;

  function getSubmitBtn(){
    return document.querySelector('#admin-videos button[onclick="saveVideo()"]');
  }

  function ensureCancelEditBtn(){
    let btn = document.getElementById('v-edit-cancel');
    if(!btn){
      const submitBtn = getSubmitBtn();
      if(!submitBtn) return null;
      btn = document.createElement('button');
      btn.id = 'v-edit-cancel';
      btn.type = 'button';
      btn.className = 'btn-secondary';
      btn.style.cssText = 'margin-left:8px;display:none';
      btn.textContent = 'Annuler la modification';
      btn.onclick = cancelEditVideo;
      submitBtn.insertAdjacentElement('afterend', btn);
    }
    return btn;
  }

  window.editVideo = async function(id){
    const v = (allVideos||[]).find(x=>x.id===id);
    if(!v) return;
    editingVideoId = id;
    await ensureVideoMovementCache().then(renderVideoMovementSelect);
    const movSel=document.getElementById('v-movement');
    if(movSel) movSel.value = v.video_movement_id || '';
    const titleEl=document.getElementById('v-title'); if(titleEl) titleEl.value=v.title||'';
    const ytEl=document.getElementById('v-youtube'); if(ytEl) ytEl.value=v.youtube_url||'';
    const descEl=document.getElementById('v-desc'); if(descEl) descEl.value=v.description||'';
    const lvlEl=document.getElementById('v-level'); if(lvlEl) lvlEl.value=v.level||'all';
    const submitBtn=getSubmitBtn();
    if(submitBtn) submitBtn.textContent='Enregistrer les modifications';
    const cancelBtn=ensureCancelEditBtn();
    if(cancelBtn) cancelBtn.style.display='inline-block';
    submitBtn?.scrollIntoView({behavior:'smooth',block:'center'});
  };

  window.cancelEditVideo = function(){
    editingVideoId = null;
    ['v-title','v-youtube','v-desc'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
    const movSel=document.getElementById('v-movement'); if(movSel) movSel.value='';
    const lvlEl=document.getElementById('v-level'); if(lvlEl) lvlEl.value='all';
    const submitBtn=getSubmitBtn();
    if(submitBtn) submitBtn.textContent='Ajouter la vidéo';
    const cancelBtn=document.getElementById('v-edit-cancel');
    if(cancelBtn) cancelBtn.style.display='none';
  };

  // ===== Liste de mouvements dédiée aux vidéos =====
  // Table video_movements, TOTALEMENT SÉPARÉE de la table movements (PR).
  // Groupée par catégorie via <optgroup>, ordre défini par sort_order en base.
  let _videoMovementCache = null; // [{id,name,group_label}]

  async function ensureVideoMovementCache(){
    if(_videoMovementCache) return _videoMovementCache;
    const {data,error}=await sb.from('video_movements').select('id,name,group_label').order('group_label').order('sort_order');
    if(error){console.warn('ensureVideoMovementCache',error.message);return[];}
    _videoMovementCache=data||[];
    return _videoMovementCache;
  }

  function renderVideoMovementSelect(list){
    const sel=document.getElementById('v-movement');
    if(!sel)return;
    const groups={};
    const order=[];
    (list||[]).forEach(m=>{
      if(!groups[m.group_label]){groups[m.group_label]=[];order.push(m.group_label);}
      groups[m.group_label].push(m);
    });
    let html='<option value="">— Aucun mouvement associé —</option>';
    order.forEach(function(label){
      const opts=groups[label].map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
      html += `<optgroup label="${label}">${opts}</optgroup>`;
    });
    sel.innerHTML = html;
  }

  window.populateVideoMovementSelect = function(){
    ensureVideoMovementCache().then(renderVideoMovementSelect);
  };

  window.saveVideo = async function(){
    const movSel=document.getElementById('v-movement');
    const videoMovementId = movSel && movSel.value ? movSel.value : null;
    const title=document.getElementById('v-title').value.trim();
    const youtube=document.getElementById('v-youtube').value.trim();
    const desc=document.getElementById('v-desc').value.trim();
    const level=document.getElementById('v-level').value;
    if(!title||!youtube){showToast('⚠️ Titre et lien YouTube requis');return;}

    if(editingVideoId){
      const {error}=await sb.from('movement_videos').update({
        video_movement_id:videoMovementId, title, youtube_url:youtube, description:desc||null, level
      }).eq('id', editingVideoId);
      if(error){showToast('❌ '+error.message);return;}
      showToast('✅ Vidéo modifiée !');
      cancelEditVideo();
    } else {
      const {error}=await sb.from('movement_videos').insert({video_movement_id:videoMovementId,title,youtube_url:youtube,description:desc||null,level,created_by:currentUser.id,studio_id:getStudioId()});
      if(error){showToast('❌ '+error.message);return;}
      showToast('✅ Vidéo ajoutée !');
      ['v-title','v-youtube','v-desc'].forEach(id=>document.getElementById(id).value='');
    }
    await loadAdminVideos();
  };

  // Affiche TOUTES les vidéos (plus de limite à 10) + bouton modifier
  window.loadVideos = async function(){
    const _vidStudioId=getStudioId();
    let q=sb.from('movement_videos').select('*,video_movements(name,group_label)').order('created_at',{ascending:false});
    if(_vidStudioId){q=q.eq('studio_id',_vidStudioId);}
    else{q=q.is('studio_id',null);}
    const {data}=await q;
    allVideos=data||[];
  };

  window.loadAdminVideos = async function(){
    await loadVideos();
    const el=document.getElementById('videos-list');
    if(!el) return;
    if(!allVideos.length){el.innerHTML='<div style="font-size:13px;color:var(--muted)">Aucune vidéo ajoutée.</div>';return;}
    el.innerHTML=`<div class="pr-hist-title">${allVideos.length} vidéos</div>`+allVideos.map(v=>`<div class="sessions-list-item">
      <div><div class="sli-title">${v.title}</div><div class="sli-meta">${v.video_movements?.name||'—'} · ${v.level||'Tous niveaux'}</div></div>
      <div style="display:flex;gap:6px">
        <button class="btn-delete" title="Modifier" onclick="editVideo('${v.id}')" style="color:var(--accent)">✏️</button>
        <button class="btn-delete" title="Supprimer" onclick="deleteVideo('${v.id}')">✕</button>
      </div>
    </div>`).join('');
  };

  window.deleteVideo = async function(id){
    await sb.from('movement_videos').delete().eq('id',id);
    showToast('🗑 Vidéo supprimée');
    if(editingVideoId===id) cancelEditVideo();
    loadAdminVideos();
  };

})();

// ===== Anti-doublon URL vidéo dans le formulaire Séance + =====
// addVideoToForm() (admin.js) gère déjà le doublon quand une URL est passée
// directement (ex: sélection depuis la bibliothèque vidéo). Ce patch couvre
// le cas où l'utilisateur tape/colle une URL à la main dans le champ #f-video-url
// d'une ligne vide ajoutée via "+ URL vidéo".
(function(){
  if(window.__videoDupePatched) return;
  window.__videoDupePatched = true;

  function normalizeUrl(u){ return (u||'').trim(); }

  document.addEventListener('change', function(e){
    const input = e.target;
    if(!input || !input.classList || !input.classList.contains('f-video-url')) return;
    const list = document.getElementById('f-videos-list');
    if(!list || !list.contains(input)) return;

    const val = normalizeUrl(input.value);
    if(!val) return;

    const rows = [...list.querySelectorAll('.f-video-row')];
    const currentRow = input.closest('.f-video-row');
    const dupRow = rows.find(function(r){
      return r!==currentRow && normalizeUrl(r.querySelector('.f-video-url')?.value)===val;
    });

    if(dupRow){
      if(typeof showToast==='function') showToast('⚠️ Cette vidéo est déjà ajoutée');
      else alert('Cette vidéo est déjà ajoutée');
      input.value='';
      if(typeof syncLegacyVideoFields==='function') syncLegacyVideoFields();
      dupRow.querySelector('.f-video-label')?.focus();
    }
  }, true);
})();

// ===== PATCH: écran Vidéos (athlète) + picker — bascule sur video_movements =====
// admin.js filtrait/affichait via v.movements (catégories haltero/force/gymnastic/
// cardio). Depuis que loadVideos() joint video_movements, on adapte les onglets,
// le filtrage et l'affichage pour utiliser v.video_movements (name/group_label).
(function(){
  if(window.__videoAthleteUIPatched) return;
  window.__videoAthleteUIPatched = true;

  let _groupsCache = null; // liste ordonnée de group_label distincts

  async function ensureGroupsCache(){
    if(_groupsCache) return _groupsCache;
    const {data,error}=await sb.from('video_movements').select('group_label').order('group_label');
    if(error){console.warn('ensureGroupsCache',error.message);return[];}
    const seen=new Set(); const list=[];
    (data||[]).forEach(r=>{ if(!seen.has(r.group_label)){seen.add(r.group_label);list.push(r.group_label);} });
    _groupsCache=list;
    return list;
  }

  async function ensureVideoCatTabs(){
    const wrap=document.getElementById('video-cats');
    if(!wrap || wrap.dataset.built==='1') return;
    const groups=await ensureGroupsCache();
    wrap.innerHTML='<button class="cat-btn active" data-vcat="all" onclick="filterVideoCat(\'all\',this)">Toutes</button>'
      + groups.map(g=>`<button class="cat-btn" data-vcat="${g.replace(/"/g,'&quot;')}" onclick="filterVideoCat('${g.replace(/'/g,"\\'")}',this)">${g}</button>`).join('');
    wrap.dataset.built='1';
  }

  window.filterVideoCat = function(cat,btn){
    currentVCat=cat;
    document.querySelectorAll('.cat-btn[data-vcat]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    renderVideosAthlete();
  };

  window.renderVideosAthlete = function(){
    ensureVideoCatTabs();
    let filtered=allVideos;
    if(currentVCat!=='all')filtered=filtered.filter(v=>v.video_movements?.group_label===currentVCat);
    if(videoSearch)filtered=filtered.filter(v=>v.title.toLowerCase().includes(videoSearch)||(v.video_movements?.name||'').toLowerCase().includes(videoSearch));
    const el=document.getElementById('videos-athlete-list');
    if(!el) return;
    if(!filtered.length){el.innerHTML='<div class="empty"><div class="empty-icon">🎬</div><p>Aucune vidéo disponible.</p></div>';return;}
    el.innerHTML=filtered.map(v=>{
      const ytId=extractYTId(v.youtube_url||'');
      const thumbHtml=ytId?`<div class="video-card-thumb"><iframe src="https://www.youtube.com/embed/${ytId}" allowfullscreen loading="lazy"></iframe></div>`:'';
      return`<div class="video-card">${thumbHtml}<div class="video-card-body">
        <div class="video-card-title">${v.title}</div>
        <div class="video-card-meta"><span>${v.video_movements?.name||'—'}</span>${v.level&&v.level!=='all'?`<span class="video-level-badge">${v.level}</span>`:''}</div>
        ${v.description?`<div class="video-card-desc">${v.description}</div>`:''}
      </div></div>`;
    }).join('');
  };

  window.renderVideoPicker = function(){
    const q=document.getElementById('videopicker-search').value.toLowerCase();
    const filtered=allVideos.filter(v=>!q||v.title.toLowerCase().includes(q)||(v.video_movements?.name||'').toLowerCase().includes(q));
    const el=document.getElementById('videopicker-list');
    if(!allVideos.length){
      el.innerHTML='<div style="text-align:center;color:var(--muted);padding:24px 12px;font-size:13px;line-height:1.6"><div style="font-size:32px;margin-bottom:8px">🎬</div>Aucune vidéo dans la bibliothèque.<br><span style="font-size:11px">Ajoute-en via l\'onglet <b style="color:var(--accent)">Vidéos</b> de l\'admin.</span></div>';
      return;
    }
    if(!filtered.length){el.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px">Aucune vidéo trouvée</div>';return;}
    el.innerHTML=filtered.map(v=>{
      const url=(v.youtube_url||'').replace(/"/g,'&quot;');
      const title=(v.title||'').replace(/"/g,'&quot;');
      const mv=(v.video_movements?.name||'—').replace(/</g,'&lt;');
      return `<div class="videopicker-item" data-vp-url="${url}" data-vp-label="${title}" style="display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid var(--border);cursor:pointer">
        <span style="font-size:22px">▶️</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600">${title}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${mv}</div>
        </div>
        <span style="color:var(--accent);font-size:20px;font-weight:300">+</span>
      </div>`;
    }).join('');
    el.querySelectorAll('.videopicker-item').forEach(item=>{
      item.addEventListener('click',()=>selectVideoFromPicker(item.dataset.vpUrl,item.dataset.vpLabel));
    });
  };
})();

/* ============================================================
   PATCH — Sélecteur de date (calendrier) dans l'espace perso
   Remplace/complète la navigation par flèches ‹ › par un
   input type=date natif, calé sur la vue en cours (jour/semaine/mois)
   ============================================================ */
(function(){
  if(window.__patchPersoDatePicker)return;
  window.__patchPersoDatePicker=true;

  function refDateForCurrentPeriod(){
    // Renvoie la date (iso) actuellement affichée, servant à pré-remplir l'input
    const now=new Date();
    if(persoView==='day'){
      const d=new Date();d.setDate(d.getDate()+persoOffset);
      return d.toISOString().split('T')[0];
    }
    if(persoView==='week'){
      const dates=getWeekDates(persoOffset);
      return dates[0].toISOString().split('T')[0];
    }
    // month
    const ref=new Date(now.getFullYear(),now.getMonth()+persoOffset,1);
    return ref.toISOString().split('T')[0];
  }

  function computeOffsetForDate(iso){
    const tgt=new Date(iso+'T12:00:00');
    if(persoView==='day'){
      const now=new Date();now.setHours(0,0,0,0);
      const t=new Date(tgt);t.setHours(0,0,0,0);
      return Math.round((t-now)/(24*60*60*1000));
    }
    if(persoView==='week'){
      const now=new Date(),day=now.getDay();
      const monNow=new Date(now);monNow.setDate(now.getDate()-(day===0?6:day-1));monNow.setHours(0,0,0,0);
      const tgtDay=tgt.getDay();
      const monTgt=new Date(tgt);monTgt.setDate(tgt.getDate()-(tgtDay===0?6:tgtDay-1));monTgt.setHours(0,0,0,0);
      return Math.round((monTgt-monNow)/(7*24*60*60*1000));
    }
    // month
    const now=new Date();
    return (tgt.getFullYear()-now.getFullYear())*12+(tgt.getMonth()-now.getMonth());
  }

  function buildModal(){
    if(document.getElementById('perso-date-picker-modal'))return;
    const modal=document.createElement('div');
    modal.id='perso-date-picker-modal';
    modal.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;align-items:center;justify-content:center';
    modal.innerHTML=`
      <div style="background:var(--card,#1a1a1a);border:1px solid var(--border2,#333);border-radius:14px;padding:20px;width:min(320px,90vw)">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px;margin-bottom:12px">Aller à une date</div>
        <input type="date" id="perso-date-picker-input" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border2,#333);background:var(--card2,#111);color:var(--text,#fff);margin-bottom:14px">
        <div style="display:flex;flex-direction:column;gap:8px">
          <button id="perso-date-picker-go" style="padding:10px;border-radius:10px;border:none;background:var(--accent,#e8ff47);color:#000;font-weight:700;cursor:pointer">Aller à cette date</button>
          <button id="perso-date-picker-cancel" style="padding:8px;border-radius:10px;border:none;background:transparent;color:var(--muted,#999);cursor:pointer">Annuler</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('perso-date-picker-cancel').onclick=()=>{modal.style.display='none';};
    document.getElementById('perso-date-picker-go').onclick=()=>{
      const iso=document.getElementById('perso-date-picker-input').value;
      if(!iso){showToast('⚠️ Choisis une date');return;}
      persoOffset=computeOffsetForDate(iso);
      modal.style.display='none';
      renderPersoCalendar();
    };
  }

  window.openPersoDatePicker=function(){
    if(!currentPersoAthlete){showToast('⚠️ Aucun athlète sélectionné');return;}
    buildModal();
    document.getElementById('perso-date-picker-input').value=refDateForCurrentPeriod();
    document.getElementById('perso-date-picker-modal').style.display='flex';
  };
})();

/* ===========================================================
   LEADERBOARD CROSS-BLOCK — RETIRÉ (08/09/2026)
   Ce patch faisait doublon avec la logique cross-block désormais
   intégrée nativement dans renderScoresModal (planning.js), et
   plantait systématiquement : sb.from('wod_scores') renvoie un
   PostgrestQueryBuilder sans .eq tant que .select() n'a pas été
   chaîné, donc "q.eq.bind(q)" levait une TypeError synchrone dès
   qu'un bloc avait ≥2 copies (source_block_id partagé). Résultat :
   la requête wod_scores ne partait jamais → "Erreur de chargement,
   réessaie." dans le modal Classement, pour tout le monde.
   =========================================================== */

// ===== FIX ÉDITEUR RICHE (blocs perso) — sélection perdue au clic toolbar =====
// Bug: dans admin.js, _refocusActive() teste `window._richActiveTarget` mais
// cette variable n'est jamais assignée nulle part -> _refocusActive() ne fait
// rien -> richCmd('bold'/'italic'), richColor() et richFont() s'exécutent sur
// la sélection courante du navigateur au moment du clic, qui a pu être perdue
// ou déplacée en cliquant sur un bouton hors du contenteditable. D'où le
// comportement aléatoire (rien, tout le bloc, ou correct selon le navigateur).
// Fix: on trace en continu la sélection tant qu'elle est dans #f-content-editor,
// et on restaure cette sélection sauvegardée avant que la commande s'exécute.
(function(){
  if(window.__patchBound_richEditorSelection) return;
  window.__patchBound_richEditorSelection = true;

  const EDITOR_ID='f-content-editor';

  function trackSelection(){
    const editor=document.getElementById(EDITOR_ID);
    if(!editor) return;
    const sel=window.getSelection();
    if(!sel || sel.rangeCount===0) return;
    const range=sel.getRangeAt(0);
    if(editor.contains(range.commonAncestorContainer)){
      window._richActiveTarget=editor;
      window._richSavedRange=range.cloneRange();
    }
  }
  document.addEventListener('selectionchange', trackSelection);

  // Remplace _refocusActive: admin.js déclare cette fonction en top-level,
  // donc window._refocusActive = ... écrase la même liaison globale que
  // richCmd/richColor/richFont utilisent en interne (lookup dynamique à
  // l'appel, pas de closure figée).
  window._refocusActive=function(){
    const editor=window._richActiveTarget;
    if(!editor) return;
    editor.focus();
    const range=window._richSavedRange;
    if(range && document.contains(range.startContainer) && editor.contains(range.commonAncestorContainer)){
      try{
        const sel=window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }catch(e){/* range obsolète -> on garde juste le focus */}
    }
  };

  // Une sélection sauvegardée d'un ancien bloc n'a plus de sens une fois
  // l'éditeur rechargé/vidé pour un nouveau bloc.
  const _origSetEditorContent=window.setEditorContent;
  if(typeof _origSetEditorContent==='function'){
    window.setEditorContent=function(html){
      window._richSavedRange=null;
      return _origSetEditorContent(html);
    };
  }
  const _origClearEditor=window.clearEditor;
  if(typeof _origClearEditor==='function'){
    window.clearEditor=function(){
      window._richSavedRange=null;
      return _origClearEditor();
    };
  }
})();

// ============================================================
// EXPORT CYCLE PDF — Récap + Vue Cycle + Vue Session
// (patch wellness.js — admin.js non modifié)
// ============================================================
(function(){
  if(window.__patchBound_exportCyclePDF) return;
  window.__patchBound_exportCyclePDF = true;

  const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

  function esc(s){
    return String(s==null?'':s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }
  function rgb(hex){
    let h=String(hex||'#e8ff47').trim().replace('#','');
    if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if(h.length!==6||/[^0-9a-f]/i.test(h)) h='e8ff47';
    return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)];
  }
  function hx(a){
    return '#'+a.map(function(v){
      v=Math.max(0,Math.min(255,Math.round(v)));
      return (v<16?'0':'')+v.toString(16);
    }).join('');
  }
  // Fond = couleur éclaircie -> reste clair, texte foncé lisible même si le
  // navigateur supprime les fonds à l'impression.
  function tint(c){ const x=rgb(c);
    return hx([x[0]+(255-x[0])*0.78, x[1]+(255-x[1])*0.78, x[2]+(255-x[2])*0.78]); }
  function ink(c){ const x=rgb(c);
    const lum=0.299*x[0]+0.587*x[1]+0.114*x[2];
    const f=lum>200?0.34:(lum>150?0.42:(lum>90?0.60:0.78));
    return hx([x[0]*f,x[1]*f,x[2]*f]); }
  // Bordure : le blanc pur est invisible sur papier -> on le grise.
  function edge(c){ const x=rgb(c);
    return (x[0]>235&&x[1]>235&&x[2]>235)?'#9aa0a6':c; }

  function toast(m){ try{ if(typeof showToast==='function'){showToast(m);return;} }catch(e){} alert(m); }
  function getCycle(){ try{ if(typeof cycleData!=='undefined'&&cycleData) return cycleData; }catch(e){} return window.cycleData||null; }
  function getMode(){ try{ if(typeof cycleMode!=='undefined'&&cycleMode) return cycleMode; }catch(e){} return window.cycleMode||'cycle'; }
  function rowOpts(n){ try{ if(typeof getRowOptions==='function') return getRowOptions(n); }catch(e){} return null; }

  function arrAt(sc,wk,ri,di){ return sc['w'+wk+'-'+ri+'-'+di]||[]; }

  // Un chip = pastille colorée. white-space:pre-wrap => les sauts de ligne
  // des WOD sont conservés tels quels.
  function chipHtml(chip){
    const c=chip.color||'#e8ff47';
    const txt=String(chip.text==null?'':chip.text);
    // Un bloc long (WOD complet) barré est illisible à l'impression :
    // on garde juste la coche. Le barré reste sur les étiquettes courtes.
    const long=txt.length>60||txt.indexOf('\n')>=0;
    const done=chip.done?(long?'':'opacity:.6;text-decoration:line-through;'):'';
    return '<span class="chip" style="background:'+tint(c)+';border:1px solid '+edge(c)
      +';border-left:4px solid '+edge(c)+';color:'+ink(c)+';'+done+'">'
      +(chip.done?'✓ ':'')+esc(txt)+'</span>';
  }
  function cellHtml(arr){
    return arr.length ? arr.map(chipHtml).join('') : '<span class="empty">&mdash;</span>';
  }

  // ---------- RÉCAP (dérivé de la vue session, comme dans l'app) ----------
  function buildRecap(cd,weeks){
    const rows=cd.rows||[], sc=cd.sessionCells||{};
    const counts=rows.map(()=>({})), colorOf=rows.map(()=>({}));
    let total=0;
    for(let wk=0;wk<weeks;wk++) rows.forEach((rn,ri)=>{
      if(!rowOpts(rn)) return;
      for(let di=0;di<DAYS.length;di++) arrAt(sc,wk,ri,di).forEach(c=>{
        const k=(c.text||'').trim(); if(!k) return;
        counts[ri][k]=(counts[ri][k]||0)+1;
        if(!colorOf[ri][k]) colorOf[ri][k]=c.color||'#e8ff47';
        total++;
      });
    });
    const ne=rows.map((r,ri)=>({r,ri,e:Object.entries(counts[ri])})).filter(x=>x.e.length);
    if(!ne.length) return '';
    let h='<div class="sec"><div class="sec-t">R&Eacute;CAP DU CYCLE <span class="tot">'
      +total+' item'+(total>1?'s':'')+'</span></div><table class="recap"><tbody>';
    ne.forEach(({r,ri,e})=>{
      e.sort((a,b)=>b[1]-a[1]);
      const sub=e.reduce((s,[,n])=>s+n,0);
      h+='<tr><td class="cat">'+esc(r)+' <span class="dt">&middot; '+sub+'</span></td><td>'
        +e.map(([t,n])=>{
          const c=colorOf[ri][t]||'#e8ff47';
          return '<span class="chip" style="background:'+tint(c)+';border:1px solid '+edge(c)
            +';border-left:4px solid '+edge(c)+';color:'+ink(c)+'">'+esc(t)
            +' <b>&times;'+n+'</b></span>';
        }).join('')+'</td></tr>';
    });
    return h+'</tbody></table></div>';
  }

  // ---------- VUE CYCLE (thèmes en lignes, jours en colonnes) ----------
  // Structure réelle : cycleData.themes + cycleData.themeCells["t{wk}-{ti}-{di}"]
  // + cycleData.summaryRow["sum-{di}"]  (cf. renderCycleGridNew)
  function buildCycleSection(cd,weeks,start){
    const themes=cd.themes||[], tc=cd.themeCells||{}, sum=cd.summaryRow||{};
    const at=(wk,ti,di)=>tc['t'+wk+'-'+ti+'-'+di]||[];
    const atSum=di=>sum['sum-'+di]||[];

    // Jours réellement utilisés (résumé compris) -> on élague les colonnes vides
    const useDay=DAYS.map((_,di)=>{
      if(atSum(di).length) return true;
      for(let wk=0;wk<weeks;wk++) for(let ti=0;ti<themes.length;ti++)
        if(at(wk,ti,di).length) return true;
      return false;
    });
    const useTheme=themes.map((_,ti)=>{
      for(let wk=0;wk<weeks;wk++) for(let di=0;di<DAYS.length;di++)
        if(at(wk,ti,di).length) return true;
      return false;
    });
    const dIdx=DAYS.map((_,i)=>i).filter(i=>useDay[i]);
    const tIdx=themes.map((_,i)=>i).filter(i=>useTheme[i]);
    const hasSum=dIdx.some(di=>atSum(di).length);

    let h='<div class="sec pb"><div class="sec-t">VUE CYCLE</div>';
    if(!dIdx.length||(!tIdx.length&&!hasSum)){
      return h+'<div class="none">Aucun contenu saisi en Vue Cycle pour ce cycle.</div></div>';
    }
    const wDay=Math.floor((100-14)/dIdx.length);
    const head='<thead><tr><th class="cat" style="width:14%">Th&egrave;me</th>'
      +dIdx.map(i=>'<th style="width:'+wDay+'%">'+DAYS[i]+'</th>').join('')+'</tr></thead>';

    if(hasSum){
      h+='<table class="sess"><thead><tr><th class="cat" style="width:14%">R&eacute;sum&eacute;</th>'
        +dIdx.map(i=>'<th style="width:'+wDay+'%">'+DAYS[i]+'</th>').join('')+'</tr></thead><tbody>'
        +'<tr><td class="cat">Cycle</td>'
        +dIdx.map(di=>'<td>'+cellHtml(atSum(di))+'</td>').join('')
        +'</tr></tbody></table>';
    }

    let first=true;
    for(let wk=0;wk<weeks;wk++){
      let any=false;
      for(let a=0;a<tIdx.length&&!any;a++) for(let b=0;b<dIdx.length&&!any;b++)
        if(at(wk,tIdx[a],dIdx[b]).length) any=true;
      if(!any) continue;
      const s=new Date(start); s.setDate(start.getDate()+wk*7);
      const e=new Date(s); e.setDate(s.getDate()+6);
      h+='<div class="wkblock'+(first?'':' pb')+'"><div class="wk-t">SEMAINE '+(wk+1)
        +' <span class="dt">'+s.getDate()+'/'+(s.getMonth()+1)+' &rarr; '
        +e.getDate()+'/'+(e.getMonth()+1)+'</span></div>';
      first=false;
      h+='<table class="sess">'+head+'<tbody>';
      tIdx.forEach(ti=>{
        h+='<tr><td class="cat">'+esc(themes[ti])+'</td>'
          +dIdx.map(di=>'<td>'+cellHtml(at(wk,ti,di))+'</td>').join('')+'</tr>';
      });
      h+='</tbody></table></div>';
    }
    return h+'</div>';
  }

  // ---------- ANCIENNE VUE CYCLE (colonnes) — seulement si des données y restent ----------
  function buildLegacySection(cd,weeks,start){
    const cols=cd.columns||[], cells=cd.cells||{};
    let nb=0;
    for(let w=0;w<weeks;w++) for(let ci=0;ci<cols.length;ci++) nb+=(cells[w+'-'+ci]||[]).length;
    if(!nb) return '';
    let h='<div class="sec pb"><div class="sec-t">VUE CYCLE &mdash; ANCIEN FORMAT</div>'
      +'<table><thead><tr><th class="wk">Semaine</th>'
      +cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>';
    for(let w=0;w<weeks;w++){
      const s=new Date(start); s.setDate(start.getDate()+w*7);
      const e=new Date(s); e.setDate(s.getDate()+6);
      h+='<tr><td class="wk"><b>Sem. '+(w+1)+'</b><br><span class="dt">'
        +s.getDate()+'/'+(s.getMonth()+1)+' &rarr; '+e.getDate()+'/'+(e.getMonth()+1)+'</span></td>'
        +cols.map((c,ci)=>'<td>'+cellHtml(cells[w+'-'+ci]||[])+'</td>').join('')+'</tr>';
    }
    return h+'</tbody></table></div>';
  }

  // ---------- VUE SESSION ----------
  function buildSessionSection(cd,weeks,start){
    const rows=cd.rows||[], sc=cd.sessionCells||{};
    // On ne garde que les jours et les lignes réellement utilisés :
    // ça libère une largeur énorme pour le texte des WOD.
    const useDay=DAYS.map((_,di)=>{
      for(let wk=0;wk<weeks;wk++) for(let ri=0;ri<rows.length;ri++)
        if(arrAt(sc,wk,ri,di).length) return true;
      return false;
    });
    const useRow=rows.map((_,ri)=>{
      for(let wk=0;wk<weeks;wk++) for(let di=0;di<DAYS.length;di++)
        if(arrAt(sc,wk,ri,di).length) return true;
      return false;
    });
    const dIdx=DAYS.map((_,i)=>i).filter(i=>useDay[i]);
    const rIdx=rows.map((_,i)=>i).filter(i=>useRow[i]);

    let h='<div class="sec pb"><div class="sec-t">VUE SESSION</div>';
    if(!dIdx.length||!rIdx.length){
      return h+'<div class="none">Aucun contenu saisi en Vue Session pour ce cycle.</div></div>';
    }
    const wDay=Math.floor((100-14)/dIdx.length);
    let first=true;
    for(let wk=0;wk<weeks;wk++){
      let any=false;
      for(let a=0;a<rIdx.length&&!any;a++) for(let b=0;b<dIdx.length&&!any;b++)
        if(arrAt(sc,wk,rIdx[a],dIdx[b]).length) any=true;
      if(!any) continue;
      const s=new Date(start); s.setDate(start.getDate()+wk*7);
      const e=new Date(s); e.setDate(s.getDate()+6);
      h+='<div class="wkblock'+(first?'':' pb')+'"><div class="wk-t">SEMAINE '+(wk+1)
        +' <span class="dt">'+s.getDate()+'/'+(s.getMonth()+1)+' &rarr; '
        +e.getDate()+'/'+(e.getMonth()+1)+'</span></div>';
      first=false;
      h+='<table class="sess"><thead><tr><th class="cat" style="width:14%">Cat&eacute;gorie</th>'
        +dIdx.map(i=>'<th style="width:'+wDay+'%">'+DAYS[i]+'</th>').join('')
        +'</tr></thead><tbody>';
      rIdx.forEach(ri=>{
        h+='<tr><td class="cat">'+esc(rows[ri])+'</td>'
          +dIdx.map(di=>'<td>'+cellHtml(arrAt(sc,wk,ri,di))+'</td>').join('')+'</tr>';
      });
      h+='</tbody></table></div>';
    }
    return h+'</div>';
  }

  window.exportCyclePDF=function(){
    const cd=getCycle();
    if(!cd){ toast('⚠️ Aucun cycle chargé'); return; }
    try{ if(typeof _ensureCycleThemes==='function') _ensureCycleThemes(); }catch(e){}
    const name=(document.getElementById('cycle-name')?.value||cd.name||'Cycle').trim()||'Cycle';
    const weeks=parseInt(document.getElementById('cycle-weeks')?.value)||cd.weeks||8;

    const si=document.getElementById('cycle-start-date')?.value;
    const start=si?new Date(si+'T12:00:00'):new Date();
    if(!si){ const d=start.getDay(); start.setDate(start.getDate()-(d===0?6:d-1)); }

    const mode=getMode();
    const doc='<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
      +'<meta name="viewport" content="width=device-width,initial-scale=1">'
      +'<title>'+esc(name)+'</title><style>'
      +'html,body,*{-webkit-print-color-adjust:exact !important;'
      +'print-color-adjust:exact !important;color-adjust:exact !important}'
      +'@page{size:A4 landscape;margin:7mm}'
      +'*{box-sizing:border-box}'
      +'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;'
      +'margin:0;padding:10px;background:#fff;color:#111;font-size:9px}'
      +'.hd{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;'
      +'border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:8px}'
      +'.hd h1{margin:0;font-size:17px;letter-spacing:1px;text-transform:uppercase}'
      +'.hd .meta{font-size:10px;color:#555}'
      +'.badge{margin-left:auto;font-size:9px;font-weight:700;letter-spacing:1px;'
      +'border:1px solid #111;border-radius:4px;padding:2px 7px;text-transform:uppercase}'
      +'.sec-t{font-size:12px;font-weight:800;letter-spacing:2px;margin:10px 0 6px;'
      +'padding:3px 0;border-bottom:1px solid #999}'
      +'.sec-t .tot{float:right;font-size:9px;letter-spacing:0;color:#666;font-weight:600}'
      +'.pb{page-break-before:always}'
      +'.none{padding:10px 12px;background:#f4f4f4;border:1px dashed #bbb;'
      +'border-radius:6px;color:#666;font-size:10px}'
      +'table{width:100%;border-collapse:collapse;margin-bottom:8px;table-layout:fixed}'
      +'th,td{border:1px solid #bbb;padding:3px;vertical-align:top;text-align:left;'
      +'word-wrap:break-word;overflow-wrap:break-word}'
      +'th{background:#e9e9e9;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}'
      +'td.wk,th.wk{width:62px;background:#f4f4f4;font-size:8px}'
      +'td.cat,th.cat{background:#f4f4f4;font-size:8px;font-weight:700}'
      +'table.recap td.cat{width:130px;text-transform:uppercase;letter-spacing:.5px}'
      +'.dt{font-weight:400;color:#666;font-size:7.5px}'
      // pre-wrap : conserve les retours à la ligne des WOD
      +'.chip{display:block;white-space:pre-wrap;padding:2px 4px;margin:2px 0;'
      +'border-radius:4px;font-size:7.5px;font-weight:600;line-height:1.35}'
      +'table.recap .chip{display:inline-block;margin:1px 2px 1px 0;font-size:8px;'
      +'white-space:nowrap}'
      +'.empty{color:#ccc}'
      +'.wkblock{margin-bottom:10px}'
      +'.wk-t{font-size:11px;font-weight:800;letter-spacing:1.5px;margin:6px 0 4px;'
      +'padding-bottom:2px;border-bottom:1px solid #ccc}'
      +'table.sess tr{page-break-inside:avoid}'
      +'thead{display:table-header-group}'
      +'.tip{font-size:10px;background:#fff8d6;border:1px solid #e3d27a;border-radius:6px;'
      +'padding:8px 10px;margin-bottom:10px;line-height:1.45}'
      +'.noprint{position:sticky;top:0;display:flex;gap:8px;align-items:center;'
      +'padding:8px 0;background:#fff;z-index:99}'
      +'.noprint button{padding:9px 18px;background:#111;color:#fff;border:0;'
      +'border-radius:6px;font-size:12px;font-weight:700;cursor:pointer}'
      +'@media print{.noprint,.tip{display:none !important}}'
      +'</style></head><body>'
      +'<div class="noprint"><button onclick="window.print()">Enregistrer en PDF</button></div>'
      +'<div class="tip"><b>Si le PDF sort en noir et blanc :</b> dans la fen&ecirc;tre '
      +'d\'impression, ouvre <b>Plus de param&egrave;tres</b> et coche '
      +'<b>Graphismes d\'arri&egrave;re-plan</b>.</div>'
      +'<div class="hd"><h1>'+esc(name)+'</h1>'
      +'<span class="meta">'+weeks+' semaine'+(weeks>1?'s':'')+' &middot; d&eacute;but '
      +start.toLocaleDateString('fr-FR')+'</span>'
      +'<span class="badge">Vue active : '+(mode==='session'?'Session':'Cycle')+'</span></div>'
      +buildRecap(cd,weeks)
      +buildCycleSection(cd,weeks,start)
      +buildSessionSection(cd,weeks,start)
      +buildLegacySection(cd,weeks,start)
      +'</body></html>';

    const w=window.open('','_blank');
    if(!w){ toast('⚠️ Autorise les pop-ups pour exporter'); return; }
    w.document.open(); w.document.write(doc); w.document.close();
    setTimeout(function(){ try{ w.focus(); w.print(); }catch(e){} }, 900);
  };
})();

/* ===========================================================
   SCALING RICHE — Intermédiaire / Scaled / Fondation
   -----------------------------------------------------------
   Avant : 3 <textarea> plates (min-height 70px), texte blanc
   uniquement, aucune mise en forme possible.
   Après : chaque champ devient un éditeur riche identique à
   « Contenu RX » (gras, italique, polices, 7 couleurs + pipette,
   effacer formatage), plus haut et redimensionnable.

   Compat : admin.js (read-only par convention) lit et écrit ces
   champs uniquement via `document.getElementById('f-scaling-*').value`.
   On garde donc le <textarea> en place (masqué) et on redéfinit sa
   propriété `value` pour qu'elle pointe vers l'éditeur :
     - get  -> editor.innerHTML (ou '' si visuellement vide)
     - set  -> editor.innerHTML = html(valeur)
   Résultat : saveSession, editSession, les templates de séance,
   persoEditSession et les resets de formulaire fonctionnent sans
   AUCUNE modification de admin.js.

   Rendu côté athlète : planning.js / wellness.js injectent déjà
   s.scaling_* en innerHTML dans .scaling-text -> le HTML s'affiche.
   =========================================================== */
(function(){
  if(window.__patchBound_scalingRichEditors) return;
  window.__patchBound_scalingRichEditors = true;

  var FIELDS=[
    {id:'f-scaling-inter',      ph:'Modifications pour le niveau intermédiaire...'},
    {id:'f-scaling-scaled',     ph:'Modifications pour le niveau scaled...'},
    {id:'f-scaling-foundation', ph:'Modifications pour le niveau fondation...'}
  ];

  var COLORS=[
    {c:'#f0f0f0', t:'Blanc',     extra:';border-color:#555'},
    {c:'#ff4444', t:'Rouge',     extra:''},
    {c:'#47ff8c', t:'Vert',      extra:''},
    {c:'#47c8ff', t:'Bleu',      extra:''},
    {c:'#111111', t:'Noir',      extra:';background:#f0f0f0'},
    {c:'#e8ff47', t:'Jaune',     extra:''},
    {c:'#2dd4bf', t:'Turquoise', extra:''}
  ];

  /* ---------- 1. CSS ---------- */
  function injectStyle(){
    if(document.getElementById('scaling-rich-style')) return;
    var s=document.createElement('style');
    s.id='scaling-rich-style';
    s.textContent=[
      /* toolbar compacte : une seule ligne scrollable (tablette / mobile) */
      '.scaling-rich .rich-toolbar{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;',
      '-webkit-overflow-scrolling:touch;padding:6px 8px;gap:3px}',
      '.scaling-rich .rich-toolbar::-webkit-scrollbar{display:none}',
      '.scaling-rich .rich-toolbar>*{flex:0 0 auto}',
      /* zone de saisie plus grande + redimensionnable */
      '.scaling-rich .rich-content{min-height:120px;resize:vertical;overflow:auto;font-size:14px}',
      '.scaling-rich{margin-top:2px}',
      /* les polices appliquees n etaient visibles que dans l editeur :
         on les rend visibles partout (vue athlete, modal lecture, calendrier) */
      '.font-serif-applied{font-family:Georgia,serif;font-weight:700}',
      '.font-sans-bold-applied{font-family:\'DM Sans\',sans-serif;font-weight:700}',
      '.font-sans-italic-applied{font-family:\'DM Sans\',sans-serif;font-style:italic}',
      /* le HTML des scalings peut contenir des <div>/<br> : pas de double saut */
      '.scaling-text div{min-height:1px}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ---------- 2. helpers texte <-> html ---------- */
  function esc(v){
    return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  // Valeur stockée -> HTML éditeur. Les anciennes séances contiennent du
  // texte brut avec des \n : on les convertit en <br> sans rien casser.
  function toHtml(v){
    if(v==null) return '';
    v=String(v);
    if(!v) return '';
    if(/<[a-z!\/][^>]*>/i.test(v)) return v;          // déjà du HTML
    return esc(v).replace(/\r?\n/g,'<br>');
  }
  // Éditeur visuellement vide -> '' (pour que .trim() côté admin.js donne null)
  function isBlank(ed){
    if(ed.querySelector('img')) return false;
    return !(ed.textContent||'').replace(/[​ ]/g,' ').trim();
  }

  /* ---------- 3. toolbar (identique à Contenu RX) ---------- */
  function toolbarHtml(uid){
    var h='<div class="rich-toolbar">'
      +'<button type="button" class="rich-btn" onclick="richCmd(\'bold\')" title="Gras"><b>G</b></button>'
      +'<button type="button" class="rich-btn" onclick="richCmd(\'italic\')" title="Italique"><i>I</i></button>'
      +'<div class="rich-sep"></div>'
      +'<button type="button" class="rich-btn font-serif" onclick="richFont(\'serif\')" title="Serif Bold">Aa</button>'
      +'<button type="button" class="rich-btn font-sans-bold" onclick="richFont(\'sans-bold\')" title="Sans-serif Bold"><b>Aa</b></button>'
      +'<button type="button" class="rich-btn font-sans-italic" onclick="richFont(\'sans-italic\')" title="Sans-serif Italique"><i>Aa</i></button>'
      +'<div class="rich-sep"></div>';
    COLORS.forEach(function(c){
      h+='<button type="button" class="rich-color-btn" style="color:'+c.c+c.extra+'" '
        +'onclick="richColor(\''+c.c+'\')" title="'+c.t+'">A</button>';
    });
    h+='<input type="color" id="rich-color-picker-'+uid+'" class="rich-color-picker" value="#e8ff47" '
      +'oninput="richColor(this.value)" title="Couleur personnalisée">'
      +'<div class="rich-sep"></div>'
      +'<button type="button" class="rich-btn" onclick="richCmd(\'removeFormat\')" '
      +'title="Effacer formatage" style="font-size:11px;color:var(--muted)">✕ fmt</button>'
      +'</div>';
    return h;
  }

  /* ---------- 4. transformation d'un champ ---------- */
  var protoValue=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');

  function upgrade(f){
    var ta=document.getElementById(f.id);
    if(!ta || ta.dataset.richUpgraded==='1') return false;

    var initial=protoValue.get.call(ta);   // lecture AVANT redéfinition
    ta.dataset.richUpgraded='1';

    var uid=f.id.replace(/^f-scaling-/,'');
    var wrap=document.createElement('div');
    wrap.className='rich-editor-wrap scaling-rich';
    wrap.innerHTML=toolbarHtml(uid);

    var ed=document.createElement('div');
    ed.className='rich-content';
    ed.id=f.id+'-editor';
    ed.setAttribute('contenteditable','true');
    ed.setAttribute('data-placeholder',f.ph);
    ed.innerHTML=toHtml(initial);
    wrap.appendChild(ed);

    ta.parentNode.insertBefore(wrap,ta);
    ta.style.display='none';

    // Les clics de la toolbar ne doivent pas voler le focus à l'éditeur
    // (sinon la sélection est perdue avant l'exécution de la commande).
    wrap.querySelector('.rich-toolbar').addEventListener('mousedown',function(e){
      if(e.target.closest('button')) e.preventDefault();
    });

    // Miroir .value <-> éditeur : admin.js continue de fonctionner tel quel
    Object.defineProperty(ta,'value',{
      configurable:true,
      enumerable:true,
      get:function(){ return isBlank(ed) ? '' : ed.innerHTML; },
      set:function(v){
        ed.innerHTML=toHtml(v);
        try{ protoValue.set.call(ta, v==null?'':String(v)); }catch(e){}
      }
    });

    return true;
  }

  /* ---------- 5. sélection : généralisée à tous les .rich-content ---------- */
  // Le patch richEditorSelection plus haut ne suit que #f-content-editor.
  // On étend le suivi à n'importe quel éditeur riche (scaling inclus) ;
  // window._refocusActive (déjà remplacé plus haut) restaure la sélection.
  document.addEventListener('selectionchange',function(){
    var sel=window.getSelection();
    if(!sel || sel.rangeCount===0) return;
    var range=sel.getRangeAt(0);
    var node=range.commonAncestorContainer;
    if(node && node.nodeType===3) node=node.parentNode;
    if(!node || !node.closest) return;
    var ed=node.closest('.rich-content');
    if(ed){
      window._richActiveTarget=ed;
      window._richSavedRange=range.cloneRange();
    }
  });

  /* ---------- 6. init ---------- */
  function init(){
    injectStyle();
    var done=0;
    FIELDS.forEach(function(f){ if(upgrade(f)) done++; });
    return done;
  }

  function boot(){
    init();
    // Filets de sécurité : le panneau admin peut être rendu plus tard
    var tries=0;
    var iv=setInterval(function(){
      tries++;
      var missing=FIELDS.some(function(f){
        var el=document.getElementById(f.id);
        return el && el.dataset.richUpgraded!=='1';
      });
      if(missing) init();
      if(tries>20) clearInterval(iv);
    },500);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();

// ===================================================
// VUE SESSION — SEMAINE PRECEDENTE EN TRANSPARENCE
// Dans chaque cellule de la semaine N, affiche en
// fantome les chips de la meme case en semaine N-1,
// avec un bouton "+" pour recopier. Evite de remonter
// la semaine d'avant pour comparer.
// Toggle persistant : localStorage __ghostS1 (ON par defaut)
// ===================================================
(function(){
  if(window.__ghostPrevWeekBound) return;
  window.__ghostPrevWeekBound = true;

  var LS_KEY = '__ghostS1';
  function isOn(){ try{ return localStorage.getItem(LS_KEY) !== '0'; }catch(e){ return true; } }
  function setOn(v){ try{ localStorage.setItem(LS_KEY, v ? '1' : '0'); }catch(e){} }

  function _cd(){ try{ if(typeof cycleData !== 'undefined' && cycleData) return cycleData; }catch(e){} return window.cycleData || null; }
  function _mode(){ try{ if(typeof cycleMode !== 'undefined' && cycleMode) return cycleMode; }catch(e){} return window.cycleMode || 'cycle'; }

  function _injectStyle(){
    if(document.getElementById('ghost-s1-style')) return;
    var st = document.createElement('style');
    st.id = 'ghost-s1-style';
    st.textContent =
      '.ghost-wrap{display:flex;flex-direction:column;gap:4px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px dashed var(--border2)}'
    + '.ghost-lab{font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);opacity:.75}'
    + '.ghost-chip{display:flex;align-items:flex-start;gap:5px;padding:4px 5px;border-radius:6px;border:1px dashed currentColor;opacity:.45;font-size:11px;line-height:1.45}'
    + '.ghost-chip .ghost-txt{flex:1;min-width:0;white-space:pre-wrap;word-break:break-word}'
    + '.ghost-chip .ghost-copy{flex-shrink:0;padding:0 6px;background:rgba(0,0,0,.25);border:none;color:inherit;border-radius:4px;font-size:12px;line-height:1.6;cursor:pointer}';
    (document.head || document.documentElement).appendChild(st);
  }

  // Recopie une chip de la semaine N-1 dans la semaine N
  window.ghostCopyChip = function(wk, ri, di, chi){
    var cd = _cd(); if(!cd || !cd.sessionCells) return;
    var src = (cd.sessionCells['w'+(wk-1)+'-'+ri+'-'+di] || [])[chi];
    if(!src) return;
    var key = 'w'+wk+'-'+ri+'-'+di;
    if(!cd.sessionCells[key]) cd.sessionCells[key] = [];
    cd.sessionCells[key].push({ text: src.text, color: src.color });
    if(typeof scheduleAutoSaveCycle === 'function') scheduleAutoSaveCycle();
    if(typeof renderSessionGrid === 'function') renderSessionGrid();
  };

  function _inject(){
    var grid = document.getElementById('cycle-grid');
    if(!grid) return;
    // purge des fantomes existants (re-render ou toggle)
    Array.prototype.forEach.call(grid.querySelectorAll('.ghost-wrap'), function(el){ el.parentNode && el.parentNode.removeChild(el); });
    if(!isOn()) return;
    if(_mode() !== 'session') return;
    var cd = _cd(); if(!cd || !cd.sessionCells) return;
    var sc = cd.sessionCells;

    Array.prototype.forEach.call(grid.querySelectorAll('td.session-cell'), function(td){
      var m = (td.getAttribute('onclick') || '').match(/openCycleCellModal\((\d+),(\d+),(\d+)/);
      if(!m) return;
      var wk = parseInt(m[1],10), ri = parseInt(m[2],10), di = parseInt(m[3],10);
      if(wk < 1) return;

      var prev = sc['w'+(wk-1)+'-'+ri+'-'+di] || [];
      if(!prev.length) return;

      // Des qu'on a rempli la case cette semaine, le fantome disparait entierement
      var cur = (sc['w'+wk+'-'+ri+'-'+di] || []).filter(function(c){ return (c.text||'').trim(); });
      if(cur.length) return;

      var html = '<div class="ghost-lab">S-1</div>', n = 0;

      prev.forEach(function(c, chi){
        var txt = (c.text || '').trim();
        if(!txt) return;
        n++;
        var col = c.color || '';
        html += '<div class="ghost-chip" style="' + (col ? 'color:'+col+';background:'+col+'14' : 'color:var(--text2)') + '">'
             +    '<span class="ghost-txt">' + txt + '</span>'
             +    '<button class="ghost-copy" title="Recopier en S' + (wk+1) + '" onclick="event.stopPropagation();ghostCopyChip(' + wk + ',' + ri + ',' + di + ',' + chi + ')">+</button>'
             +  '</div>';
      });
      if(!n) return;

      var inner = td.querySelector('.session-cell-inner') || td;
      var wrap = document.createElement('div');
      wrap.className = 'ghost-wrap';
      wrap.innerHTML = html;
      wrap.addEventListener('click', function(e){ e.stopPropagation(); }); // pas d'ouverture de modal par erreur
      inner.insertBefore(wrap, inner.firstChild);
    });
  }

  function _styleToggle(b){
    var on = isOn();
    b.textContent = on ? '👻 S-1 ON' : '👻 S-1 OFF';
    b.style.cssText = 'margin-left:auto;margin-right:6px;padding:5px 10px;border-radius:7px;font-size:11px;cursor:pointer;'
      + (on
        ? 'background:rgba(45,212,191,.12);border:1px solid rgba(45,212,191,.45);color:var(--teal,#2dd4bf)'
        : 'background:var(--card2);border:1px solid var(--border2);color:var(--muted)');
  }

  function _injectToggle(){
    if(document.getElementById('ghost-s1-btn')) return;
    var panel = document.getElementById('cycle-config-session');
    if(!panel) return;
    var hdr = panel.querySelector('div[style*="justify-content:space-between"]');
    if(!hdr) return;
    var b = document.createElement('button');
    b.id = 'ghost-s1-btn';
    b.type = 'button';
    b.title = "Afficher la semaine precedente en transparence";
    _styleToggle(b);
    b.addEventListener('click', function(e){
      e.stopPropagation();
      setOn(!isOn());
      _styleToggle(b);
      _inject();
    });
    var last = hdr.lastElementChild;
    if(last) hdr.insertBefore(b, last); else hdr.appendChild(b);
  }

  function _patch(){
    var orig = window.renderSessionGrid;
    if(!orig || orig.__ghostPrevPatched) return;
    window.renderSessionGrid = function(){
      var r = orig.apply(this, arguments);
      // setTimeout 0 : on passe APRES tous les autres patches post-render
      setTimeout(function(){ _injectStyle(); _inject(); _injectToggle(); }, 0);
      return r;
    };
    window.renderSessionGrid.__ghostPrevPatched = true;
  }

  function _tryAll(){ _injectStyle(); _patch(); _injectToggle(); }

  _tryAll();
  document.addEventListener('DOMContentLoaded', _tryAll);
  setTimeout(_tryAll, 800);
  setTimeout(_tryAll, 2000);
  setTimeout(_tryAll, 4000);
})();

/* ===========================================================
   BOUTON « % » — ASSISTANT DE FORMULE DE POURCENTAGE
   -----------------------------------------------------------
   Ajoute un bouton % dans la barre d'outils de « Contenu RX »
   et des 3 champs de scaling (Inter / Scaled / Fondation).
   Au clic : panneau de choix (mouvement + format + %) qui
   insere la formule a l'endroit du curseur :
       70%|1RM|BACK SQUAT|
   On peut toujours ecrire la formule a la main : rien ne change
   pour les coachs qui la connaissent deja.

   Aucune modification de admin.js / index.html.
   =========================================================== */
(function(){
  if(window.__patchBound_pctFormulaHelper) return;
  window.__patchBound_pctFormulaHelper = true;

  var CATS=[
    {key:'all',     label:'Tous'},
    {key:'force',   label:'Force'},
    {key:'haltero', label:'Haltéro'},
    {key:'gymnastic',label:'Gym'},
    {key:'cardio',  label:'Cardio'}
  ];
  var QUICK=[50,60,65,70,75,80,85,90,95];

  var _movs=null;        // cache liste mouvements
  var _loading=false;
  var _sel=null;         // mouvement selectionne
  var _fmt=null;         // format selectionne ('' = sans format)
  var _pct=70;
  var _cat='all';
  var _q='';
  var _targetEd=null;    // editeur riche cible

  function toast(m){ try{ if(typeof showToast==='function'){ showToast(m); return; } }catch(e){} }
  function esc(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* ---------- 1. CSS ---------- */
  function injectStyle(){
    if(document.getElementById('pctf-style')) return;
    var s=document.createElement('style');
    s.id='pctf-style';
    s.textContent=[
      '.pctf-btn{background:rgba(45,212,191,.14);border:1px solid rgba(45,212,191,.45);color:#2dd4bf;',
      'border-radius:7px;padding:4px 9px;font-size:13px;font-weight:800;cursor:pointer;line-height:1.1}',
      '.pctf-btn:active{opacity:.6}',
      '#pctf-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:12000;display:none;',
      'align-items:flex-end;justify-content:center}',
      '#pctf-overlay.open{display:flex}',
      '.pctf-panel{background:var(--card);width:100%;max-width:430px;max-height:88vh;overflow-y:auto;',
      'border-radius:20px 20px 0 0;border-top:1px solid var(--border2);padding:16px 16px 22px;',
      'padding-bottom:calc(22px + var(--safe-bottom))}',
      '.pctf-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}',
      '.pctf-title{font-size:15px;font-weight:800;color:var(--text);letter-spacing:.5px}',
      '.pctf-close{background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;padding:2px 6px}',
      '.pctf-lbl{font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;',
      'color:var(--muted);margin:12px 0 6px}',
      '.pctf-row{display:flex;flex-wrap:wrap;gap:6px}',
      '.pctf-chip{background:var(--card2);border:1px solid var(--border2);color:var(--text2);border-radius:20px;',
      'padding:5px 11px;font-size:12px;font-weight:600;cursor:pointer}',
      '.pctf-chip.on{background:rgba(45,212,191,.16);border-color:#2dd4bf;color:#2dd4bf}',
      '.pctf-input{width:100%;background:var(--card2);border:1px solid var(--border2);color:var(--text);',
      'border-radius:10px;padding:9px 11px;font-size:14px;font-family:inherit}',
      '.pctf-pct{width:82px;text-align:center;font-weight:800}',
      '.pctf-list{max-height:34vh;overflow-y:auto;border:1px solid var(--border2);border-radius:12px;margin-top:6px}',
      '.pctf-item{padding:9px 12px;font-size:13px;color:var(--text);border-bottom:1px solid var(--border);cursor:pointer;',
      'display:flex;justify-content:space-between;align-items:center;gap:8px}',
      '.pctf-item:last-child{border-bottom:none}',
      '.pctf-item.on{background:rgba(45,212,191,.12);color:#2dd4bf;font-weight:700}',
      '.pctf-item small{color:var(--muted);font-size:10px;font-weight:600;white-space:nowrap}',
      '.pctf-empty{padding:14px;text-align:center;color:var(--muted);font-size:12px}',
      '.pctf-prev{margin-top:14px;background:var(--dark);border:1px dashed var(--border2);border-radius:12px;',
      'padding:11px;text-align:center;font-size:15px;font-weight:800;color:#2dd4bf;word-break:break-all}',
      '.pctf-hint{font-size:11px;color:var(--muted);margin-top:8px;line-height:1.5;text-align:center}',
      '.pctf-actions{display:flex;gap:8px;margin-top:12px}',
      '.pctf-go{flex:1;background:#2dd4bf;border:none;color:#06201c;border-radius:12px;padding:12px;',
      'font-size:14px;font-weight:800;cursor:pointer;font-family:inherit}',
      '.pctf-go[disabled]{opacity:.4;cursor:default}',
      '.pctf-ghost{background:var(--card2);border:1px solid var(--border2);color:var(--text2);border-radius:12px;',
      'padding:12px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ---------- 2. chargement des mouvements ---------- */
  function fromGlobal(){
    try{ if(typeof movements!=='undefined' && movements && movements.length) return movements; }catch(e){}
    return null;
  }
  function loadMovs(cb){
    var g=fromGlobal();
    if(g){ _movs=g.slice(); cb(); return; }
    if(_movs){ cb(); return; }
    if(_loading) return;
    _loading=true;
    try{
      sb.from('movements').select('name,category,unit,available_formats')
        .eq('is_active',true).order('name')
        .then(function(r){
          _loading=false;
          _movs=(r&&r.data)||[];
          cb();
        },function(){ _loading=false; _movs=[]; cb(); });
    }catch(e){ _loading=false; _movs=[]; cb(); }
  }

  function formatsOf(m){
    return String((m&&m.available_formats)||'').split(',')
      .map(function(f){ return f.trim(); })
      .filter(function(f){ return !!f; });
  }

  function formula(){
    if(!_sel) return '';
    var name=String(_sel.name||'').toUpperCase();
    var p=String(_pct);
    return _fmt ? (p+'%|'+_fmt+'|'+name+'|') : (p+'%|'+name+'|');
  }

  /* ---------- 3. panneau ---------- */
  function buildOverlay(){
    var ov=document.getElementById('pctf-overlay');
    if(ov) return ov;
    ov=document.createElement('div');
    ov.id='pctf-overlay';
    ov.innerHTML=''
      +'<div class="pctf-panel">'
      +  '<div class="pctf-head">'
      +    '<div class="pctf-title">FORMULE DE %</div>'
      +    '<button type="button" class="pctf-close" id="pctf-x">✕</button>'
      +  '</div>'
      +  '<div class="pctf-lbl">Pourcentage</div>'
      +  '<div class="pctf-row" style="align-items:center">'
      +    '<input type="number" inputmode="decimal" class="pctf-input pctf-pct" id="pctf-pct" min="1" max="200" step="2.5">'
      +    '<div class="pctf-row" id="pctf-quick" style="flex:1"></div>'
      +  '</div>'
      +  '<div class="pctf-lbl">Mouvement</div>'
      +  '<div class="pctf-row" id="pctf-cats"></div>'
      +  '<input type="text" class="pctf-input" id="pctf-q" placeholder="Chercher un mouvement…" style="margin-top:8px">'
      +  '<div class="pctf-list" id="pctf-list"></div>'
      +  '<div id="pctf-fmt-wrap" style="display:none">'
      +    '<div class="pctf-lbl">Format du PR</div>'
      +    '<div class="pctf-row" id="pctf-fmts"></div>'
      +  '</div>'
      +  '<div class="pctf-prev" id="pctf-prev">—</div>'
      +  '<div class="pctf-hint">Tu peux aussi l\'écrire à la main dans la séance :<br><b>70%|1RM|BACK SQUAT|</b></div>'
      +  '<div class="pctf-actions">'
      +    '<button type="button" class="pctf-go" id="pctf-go" disabled>Insérer</button>'
      +    '<button type="button" class="pctf-ghost" id="pctf-copy">Copier</button>'
      +  '</div>'
      +'</div>';
    document.body.appendChild(ov);

    ov.addEventListener('click',function(e){ if(e.target===ov) close(); });
    ov.querySelector('#pctf-x').addEventListener('click',close);
    ov.querySelector('#pctf-pct').addEventListener('input',function(){
      var v=parseFloat(this.value);
      if(!isNaN(v)) _pct=v;
      renderQuick(); renderPreview();
    });
    ov.querySelector('#pctf-q').addEventListener('input',function(){
      _q=this.value.trim().toLowerCase();
      renderList();
    });
    ov.querySelector('#pctf-go').addEventListener('click',function(){
      var f=formula();
      if(!f) return;
      insertFormula(f);
      close();
    });
    ov.querySelector('#pctf-copy').addEventListener('click',function(){
      var f=formula();
      if(!f){ toast('Choisis un mouvement'); return; }
      try{
        if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(f);
        else {
          var ta=document.createElement('textarea');
          ta.value=f; document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); document.body.removeChild(ta);
        }
        toast('Formule copiée');
      }catch(e){ toast('Copie impossible'); }
    });
    return ov;
  }

  function renderQuick(){
    var box=document.getElementById('pctf-quick');
    if(!box) return;
    box.innerHTML=QUICK.map(function(p){
      return '<button type="button" class="pctf-chip'+(p===_pct?' on':'')+'" data-p="'+p+'">'+p+'%</button>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('.pctf-chip'),function(b){
      b.addEventListener('click',function(){
        _pct=parseFloat(b.dataset.p);
        var i=document.getElementById('pctf-pct');
        if(i) i.value=_pct;
        renderQuick(); renderPreview();
      });
    });
  }

  function renderCats(){
    var box=document.getElementById('pctf-cats');
    if(!box) return;
    box.innerHTML=CATS.map(function(c){
      return '<button type="button" class="pctf-chip'+(c.key===_cat?' on':'')+'" data-c="'+c.key+'">'+c.label+'</button>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('.pctf-chip'),function(b){
      b.addEventListener('click',function(){ _cat=b.dataset.c; renderCats(); renderList(); });
    });
  }

  function filtered(){
    var list=(_movs||[]).filter(function(m){
      if(!m||!m.name) return false;
      if(_cat!=='all' && String(m.category||'')!==_cat) return false;
      if(_q && String(m.name).toLowerCase().indexOf(_q)===-1) return false;
      return true;
    });
    list.sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
    return list;
  }

  function renderList(){
    var box=document.getElementById('pctf-list');
    if(!box) return;
    var list=filtered();
    if(!list.length){
      box.innerHTML='<div class="pctf-empty">Aucun mouvement trouvé</div>';
      return;
    }
    box.innerHTML=list.map(function(m,i){
      var f=formatsOf(m);
      var on=_sel && _sel.name===m.name;
      return '<div class="pctf-item'+(on?' on':'')+'" data-i="'+i+'">'
        +'<span>'+esc(m.name)+'</span>'
        +'<small>'+esc(f.length?f.join(' · '):'sans format')+'</small></div>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('.pctf-item'),function(el){
      el.addEventListener('click',function(){
        _sel=list[parseInt(el.dataset.i,10)];
        var f=formatsOf(_sel);
        _fmt=f.length?f[0]:'';
        renderList(); renderFmts(); renderPreview();
      });
    });
  }

  function renderFmts(){
    var wrap=document.getElementById('pctf-fmt-wrap');
    var box=document.getElementById('pctf-fmts');
    if(!wrap||!box) return;
    var f=_sel?formatsOf(_sel):[];
    if(!_sel){ wrap.style.display='none'; return; }
    wrap.style.display='block';
    var opts=f.slice();
    opts.push('');  // sans format
    box.innerHTML=opts.map(function(x,i){
      var lbl=x?esc(x):'sans format';
      return '<button type="button" class="pctf-chip'+(x===_fmt?' on':'')+'" data-i="'+i+'">'+lbl+'</button>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('.pctf-chip'),function(b){
      b.addEventListener('click',function(){
        _fmt=opts[parseInt(b.dataset.i,10)];
        renderFmts(); renderPreview();
      });
    });
  }

  function renderPreview(){
    var p=document.getElementById('pctf-prev');
    var go=document.getElementById('pctf-go');
    var f=formula();
    if(p) p.textContent=f||'—';
    if(go) go.disabled=!f;
  }

  function open(ed){
    injectStyle();
    _targetEd=ed||null;
    var ov=buildOverlay();
    var i=document.getElementById('pctf-pct');
    if(i) i.value=_pct;
    ov.classList.add('open');
    renderQuick(); renderCats(); renderPreview(); renderFmts();
    var box=document.getElementById('pctf-list');
    if(box) box.innerHTML='<div class="pctf-empty">Chargement…</div>';
    loadMovs(function(){ renderList(); });
  }

  function close(){
    var ov=document.getElementById('pctf-overlay');
    if(ov) ov.classList.remove('open');
  }

  /* ---------- 4. insertion au curseur ---------- */
  function insertFormula(text){
    var ed=window._richActiveTarget || _targetEd;
    if(!ed || !ed.isContentEditable){
      ed=_targetEd;
    }
    if(!ed){ toast('Clique d\'abord dans le champ'); return; }
    var payload=text+' ';
    try{ ed.focus(); }catch(e){}
    var sel=window.getSelection();
    var range=window._richSavedRange;
    var placed=false;
    if(range && document.contains(range.startContainer) && ed.contains(range.commonAncestorContainer)){
      try{ sel.removeAllRanges(); sel.addRange(range); placed=true; }catch(e){}
    }
    if(!placed){
      try{
        var r=document.createRange();
        r.selectNodeContents(ed);
        r.collapse(false);
        sel.removeAllRanges(); sel.addRange(r);
      }catch(e){}
    }
    var ok=false;
    try{ ok=document.execCommand('insertText',false,payload); }catch(e){ ok=false; }
    if(!ok){
      try{
        var r2=sel.getRangeAt(0);
        r2.deleteContents();
        var node=document.createTextNode(payload);
        r2.insertNode(node);
        r2.setStartAfter(node); r2.collapse(true);
        sel.removeAllRanges(); sel.addRange(r2);
        ok=true;
      }catch(e){}
    }
    if(!ok){ ed.innerHTML=(ed.innerHTML||'')+payload; }
    try{
      window._richActiveTarget=ed;
      if(sel.rangeCount) window._richSavedRange=sel.getRangeAt(0).cloneRange();
    }catch(e){}
    try{ ed.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){}
  }

  /* ---------- 5. ajout du bouton dans les toolbars ---------- */
  function decorate(){
    injectStyle();
    var bars=document.querySelectorAll('.rich-editor-wrap .rich-toolbar');
    Array.prototype.forEach.call(bars,function(tb){
      if(tb.dataset.pctfDone==='1') return;
      tb.dataset.pctfDone='1';
      var b=document.createElement('button');
      b.type='button';
      b.className='pctf-btn';
      b.title='Insérer une formule de % (PR athlète)';
      b.textContent='%';
      b.addEventListener('mousedown',function(e){ e.preventDefault(); });
      b.addEventListener('click',function(e){
        e.preventDefault();
        var wrap=tb.closest('.rich-editor-wrap');
        var ed=wrap?wrap.querySelector('.rich-content'):null;
        open(ed);
      });
      var sep=document.createElement('div');
      sep.className='rich-sep';
      if(tb.firstChild){
        tb.insertBefore(sep,tb.firstChild);
        tb.insertBefore(b,sep);
      }else{
        tb.appendChild(b); tb.appendChild(sep);
      }
    });
  }

  function boot(){
    decorate();
    try{
      var mo=new MutationObserver(function(){
        clearTimeout(window.__pctfT);
        window.__pctfT=setTimeout(decorate,120);
      });
      mo.observe(document.body,{childList:true,subtree:true});
    }catch(e){
      setInterval(decorate,1000);
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();


/* ===========================================================
   CHARGEMENT DE BARRE — VISUEL DISQUES OLYMPIQUES
   -----------------------------------------------------------
   Cote athlete : dans les seances (contenu RX, scaling, target,
   tips), chaque charge calculee affichee en kg (ex : « 67kg »)
   devient cliquable. Au clic : un panneau montre la barre avec
   les disques a mettre DE CHAQUE COTE, aux couleurs officielles.

   - Barre par defaut selon le profil : femme = 15 kg, homme = 20 kg
     (currentProfile.gender : male/female/m/f/homme/femme)
   - L'athlete peut changer la barre (20 / 15 / 10 / 5) : son choix
     est memorise (localStorage) et prioritaire sur le profil.
   - Jeu de disques par defaut : 25/20/15/10/5/2.5/2/1.5/1/0.5
     Surchargeable : window.UDT_PLATES = [25,20,15,10,5,2.5,1.25];
     Stock limite (paires dispo par cote) :
       window.UDT_PLATE_STOCK = {25:4,20:4,15:2,10:2,5:2,2.5:2};

   Aucune modification de admin.js / planning.js / index.html.
   =========================================================== */
(function(){
  if(window.__patchBound_barLoad) return;
  window.__patchBound_barLoad = true;

  var LS_BAR = 'udt_bar_kg';

  /* ---------- 1. Referentiel disques (couleurs IWF) ---------- */
  var PLATE_DEF = {
    25  : {color:'#d62828', label:'rouge', h:1.00, w:20},
    20  : {color:'#1565c0', label:'bleu',  h:1.00, w:18},
    15  : {color:'#f5c518', label:'jaune', h:1.00, w:15},
    10  : {color:'#2e9e4f', label:'vert',  h:1.00, w:12},
    5   : {color:'#f1f1f1', label:'blanc', h:0.82, w:10},
    2.5 : {color:'#d62828', label:'rouge', h:0.62, w:8},
    2   : {color:'#1565c0', label:'bleu',  h:0.56, w:7},
    1.5 : {color:'#f5c518', label:'jaune', h:0.50, w:6},
    1.25: {color:'#f1f1f1', label:'blanc', h:0.46, w:6},
    1   : {color:'#2e9e4f', label:'vert',  h:0.44, w:5},
    0.5 : {color:'#f1f1f1', label:'blanc', h:0.38, w:4}
  };
  var DEFAULT_PLATES = [25,20,15,10,5,2.5,2,1.5,1,0.5];
  var BAR_CHOICES = [
    {kg:20, lbl:'20 kg', sub:'Homme'},
    {kg:15, lbl:'15 kg', sub:'Femme'},
    {kg:10, lbl:'10 kg', sub:'Technique'},
    {kg:5,  lbl:'5 kg',  sub:'Barre kids'}
  ];

  function plates(){
    var list = Array.isArray(window.UDT_PLATES) && window.UDT_PLATES.length
      ? window.UDT_PLATES.slice() : DEFAULT_PLATES.slice();
    return list.filter(function(p){ return !!PLATE_DEF[p]; })
               .sort(function(a,b){ return b-a; });
  }
  function stockFor(p){
    var s = window.UDT_PLATE_STOCK;
    if(!s || typeof s !== 'object') return Infinity;
    var v = s[p];
    return (typeof v === 'number' && v >= 0) ? v : Infinity;
  }
  function nf(n){
    // 1.5 -> "1,5"  /  20 -> "20"
    return (Math.round(n*100)/100).toString().replace('.',',');
  }

  /* ---------- 2. Barre par defaut ---------- */
  function genderBar(){
    var g = '';
    try{ g = String((window.currentProfile && window.currentProfile.gender) || '').toLowerCase(); }catch(e){}
    if(g==='female' || g==='f' || g==='femme') return 15;
    if(g==='male'   || g==='m' || g==='homme') return 20;
    return null;
  }
  function currentBar(){
    var saved = null;
    try{ saved = parseFloat(localStorage.getItem(LS_BAR)); }catch(e){}
    if(saved && saved > 0) return saved;
    return genderBar() || 20;
  }
  function setBar(kg){
    try{ localStorage.setItem(LS_BAR, String(kg)); }catch(e){}
  }

  /* ---------- 3. Calcul du chargement ---------- */
  function computeLoad(target, bar){
    var res = {target:target, bar:bar, perSide:0, items:[], rest:0, total:bar, empty:false, under:false};
    if(target <= bar + 0.001){
      res.empty = true;
      res.under = target < bar - 0.001;
      return res;
    }
    var perSide = Math.round(((target - bar) / 2) * 100) / 100;
    res.perSide = perSide;
    var left = perSide;
    var list = plates();
    for(var i=0;i<list.length;i++){
      var p = list[i];
      var max = stockFor(p);
      var n = Math.floor((left + 0.001) / p);
      if(n > max) n = max;
      if(n > 0){
        res.items.push({kg:p, n:n});
        left = Math.round((left - n*p) * 100) / 100;
      }
      if(left <= 0.001) break;
    }
    res.rest = Math.max(0, Math.round(left*100)/100);
    var loaded = res.items.reduce(function(s,it){ return s + it.kg*it.n; }, 0);
    res.total = Math.round((bar + loaded*2) * 100) / 100;
    return res;
  }

  /* ---------- 4. Dessin SVG de la barre ---------- */
  function buildSvg(res){
    var seq = [];
    res.items.forEach(function(it){
      for(var i=0;i<it.n;i++) seq.push(it.kg);
    });

    var H = 140, CY = H/2;
    var BIG = 54;                 // demi-hauteur d'un disque pleine taille
    var SLEEVE = 0;
    seq.forEach(function(p){ SLEEVE += PLATE_DEF[p].w + 3; });
    var COLLAR = 10, GRIP = 70, PAD = 14;
    var half = GRIP/2 + COLLAR + SLEEVE + 22;
    var W = Math.max(300, half*2 + PAD*2);
    var CX = W/2;

    var parts = [];
    // manchons + barre
    parts.push('<rect x="'+(CX-half)+'" y="'+(CY-5)+'" width="'+(half*2)+'" height="10" rx="5" fill="#9aa3ab"/>');
    parts.push('<rect x="'+(CX-GRIP/2)+'" y="'+(CY-6)+'" width="'+GRIP+'" height="12" rx="6" fill="#6f777e"/>');

    function drawSide(dir){ // dir = 1 (droite) ou -1 (gauche)
      var x = CX + dir*(GRIP/2 + COLLAR);
      // bague de serrage
      parts.push('<rect x="'+(dir>0 ? x-6 : x-2)+'" y="'+(CY-11)+'" width="8" height="22" rx="3" fill="#b9c0c6"/>');
      seq.forEach(function(p){
        var d = PLATE_DEF[p];
        var w = d.w, h = BIG * d.h;
        var px = dir>0 ? x : x - w;
        parts.push('<rect x="'+px+'" y="'+(CY-h)+'" width="'+w+'" height="'+(h*2)+'" rx="'+Math.min(5,w/2)+'" '
          + 'fill="'+d.color+'" stroke="rgba(0,0,0,.45)" stroke-width="1"/>');
        // trou central (effet disque)
        parts.push('<rect x="'+px+'" y="'+(CY-5)+'" width="'+w+'" height="10" fill="rgba(255,255,255,.22)"/>');
        x += dir*(w+3);
      });
    }
    drawSide(1); drawSide(-1);

    return '<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="128" preserveAspectRatio="xMidYMid meet" '
      + 'style="display:block">'+parts.join('')+'</svg>';
  }

  /* ---------- 5. Panneau ---------- */
  function ensureStyle(){
    if(document.getElementById('udt-barload-style')) return;
    var st = document.createElement('style');
    st.id = 'udt-barload-style';
    st.textContent = ''
      + '.udt-barload{cursor:pointer}'
      + '.udt-barload::after{content:"\\1F3CB";font-size:9px;margin-left:3px;opacity:.7;vertical-align:middle}'
      + '#udt-bl-ov{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;'
      +   'align-items:flex-end;justify-content:center;padding:0;backdrop-filter:blur(2px)}'
      + '#udt-bl-ov .bl-panel{width:100%;max-width:520px;background:var(--card,#141414);'
      +   'border:1px solid var(--border2,#2a2a2a);border-bottom:none;border-radius:18px 18px 0 0;'
      +   'padding:16px 16px 22px;max-height:92vh;overflow-y:auto;animation:blup .18s ease-out}'
      + '@keyframes blup{from{transform:translateY(26px);opacity:.4}to{transform:none;opacity:1}}'
      + '#udt-bl-ov .bl-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}'
      + '#udt-bl-ov .bl-title{font-family:"Bebas Neue",sans-serif;font-size:20px;letter-spacing:2px;'
      +   'color:var(--text,#fff);flex:1;line-height:1}'
      + '#udt-bl-ov .bl-x{background:var(--card2,#1d1d1d);border:1px solid var(--border2,#2a2a2a);'
      +   'color:var(--muted,#888);border-radius:9px;width:32px;height:32px;font-size:15px;cursor:pointer}'
      + '#udt-bl-ov .bl-target{display:flex;align-items:baseline;gap:8px;margin-bottom:2px}'
      + '#udt-bl-ov .bl-kg{font-family:"Bebas Neue",sans-serif;font-size:40px;line-height:1;color:#2dd4bf}'
      + '#udt-bl-ov .bl-sub{font-size:12px;color:var(--muted,#888)}'
      + '#udt-bl-ov .bl-stage{background:var(--card2,#1d1d1d);border:1px solid var(--border,#232323);'
      +   'border-radius:12px;padding:10px 6px;margin:12px 0}'
      + '#udt-bl-ov .bl-side{text-align:center;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;'
      +   'color:var(--muted,#888);margin-bottom:8px}'
      + '#udt-bl-ov .bl-side b{color:#2dd4bf;font-size:14px;letter-spacing:0}'
      + '#udt-bl-ov .bl-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;'
      +   'background:var(--card2,#1d1d1d);border:1px solid var(--border,#232323);margin-bottom:6px}'
      + '#udt-bl-ov .bl-chip{width:16px;height:30px;border-radius:4px;border:1px solid rgba(0,0,0,.45);flex:0 0 auto}'
      + '#udt-bl-ov .bl-rtxt{flex:1;font-size:14px;font-weight:700;color:var(--text,#fff)}'
      + '#udt-bl-ov .bl-rsub{font-size:11px;color:var(--muted,#888);font-weight:400}'
      + '#udt-bl-ov .bl-note{font-size:12px;color:var(--muted,#888);line-height:1.5;margin-top:8px}'
      + '#udt-bl-ov .bl-warn{color:#ffb020}'
      + '#udt-bl-ov .bl-lbl{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;'
      +   'color:var(--muted,#888);margin:14px 0 8px}'
      + '#udt-bl-ov .bl-bars{display:flex;gap:6px}'
      + '#udt-bl-ov .bl-bar{flex:1;padding:8px 4px;border-radius:9px;background:var(--card2,#1d1d1d);'
      +   'border:1px solid var(--border2,#2a2a2a);color:var(--muted,#888);cursor:pointer;text-align:center}'
      + '#udt-bl-ov .bl-bar.on{background:rgba(45,212,191,.12);border-color:rgba(45,212,191,.55);color:#2dd4bf}'
      + '#udt-bl-ov .bl-bar b{display:block;font-size:14px}'
      + '#udt-bl-ov .bl-bar span{font-size:10px;opacity:.8}';
    document.head.appendChild(st);
  }

  function renderPanel(target){
    var bar = currentBar();
    var res = computeLoad(target, bar);
    var body = '';

    body += '<div class="bl-target"><div class="bl-kg">'+nf(target)+' kg</div>'
         +  '<div class="bl-sub">barre '+nf(bar)+' kg</div></div>';

    if(res.empty){
      body += '<div class="bl-stage">'+buildSvg(res)+'<div class="bl-side">Barre a vide</div></div>';
      body += '<div class="bl-note'+(res.under?' bl-warn':'')+'">'
           +  (res.under
              ? 'La charge demandee ('+nf(target)+' kg) est inferieure au poids de la barre. Prends une barre plus legere.'
              : 'Rien a charger : la barre seule fait deja '+nf(bar)+' kg.')
           +  '</div>';
    } else {
      body += '<div class="bl-stage">'+buildSvg(res)
           +  '<div class="bl-side">De chaque cote : <b>'+nf(res.perSide)+' kg</b></div></div>';

      body += res.items.map(function(it){
        var d = PLATE_DEF[it.kg];
        return '<div class="bl-row">'
             +   '<div class="bl-chip" style="background:'+d.color+'"></div>'
             +   '<div class="bl-rtxt">'+it.n+' × '+nf(it.kg)+' kg'
             +     '<div class="bl-rsub">'+d.label+' · de chaque cote</div></div>'
             + '</div>';
      }).join('');

      body += '<div class="bl-note">Total sur la barre : <b style="color:#2dd4bf">'+nf(res.total)+' kg</b>'
           +  ' ('+nf(bar)+' + 2 × '+nf(res.perSide - res.rest)+')</div>';
      if(res.rest > 0.001){
        body += '<div class="bl-note bl-warn">Il reste '+nf(res.rest)+' kg par cote non chargeables '
             +  'avec les disques disponibles — arrondis a '+nf(res.total)+' kg.</div>';
      }
    }

    body += '<div class="bl-lbl">Barre utilisee</div><div class="bl-bars">'
         +  BAR_CHOICES.map(function(b){
              return '<button type="button" class="bl-bar'+(b.kg===bar?' on':'')+'" data-bar="'+b.kg+'">'
                   +   '<b>'+b.lbl+'</b><span>'+b.sub+'</span></button>';
            }).join('')
         +  '</div>';

    return body;
  }

  function open(target){
    ensureStyle();
    close();
    var ov = document.createElement('div');
    ov.id = 'udt-bl-ov';
    ov.innerHTML = '<div class="bl-panel">'
      + '<div class="bl-head"><div class="bl-title">CHARGEMENT DE BARRE</div>'
      +   '<button type="button" class="bl-x" id="udt-bl-x">✕</button></div>'
      + '<div id="udt-bl-body">'+renderPanel(target)+'</div>'
      + '</div>';
    document.body.appendChild(ov);

    ov.addEventListener('click', function(e){
      if(e.target === ov){ close(); return; }
      if(e.target.closest && e.target.closest('#udt-bl-x')){ close(); return; }
      var b = e.target.closest && e.target.closest('.bl-bar');
      if(b){
        setBar(parseFloat(b.dataset.bar));
        var host = document.getElementById('udt-bl-body');
        if(host) host.innerHTML = renderPanel(target);
      }
    });
  }
  function close(){
    var ov = document.getElementById('udt-bl-ov');
    if(ov) ov.remove();
  }
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') close(); });

  /* ---------- 6. Reperage des charges calculees ---------- */
  var SEL = '.session-content, .scaling-text, .info-block-text, .session-card';
  var RX_KG = /^\s*(\d+(?:[.,]\d+)?)\s*kg\s*$/i;

  function decorate(root){
    var scope = root && root.querySelectorAll ? root : document;
    var hosts = scope.querySelectorAll(SEL);
    for(var i=0;i<hosts.length;i++){
      var spans = hosts[i].querySelectorAll('span');
      for(var j=0;j<spans.length;j++){
        var sp = spans[j];
        if(sp.dataset.barload) continue;
        if(sp.children.length) continue;                 // badge = texte simple
        var m = RX_KG.exec(sp.textContent || '');
        if(!m) continue;
        var val = parseFloat(m[1].replace(',','.'));
        if(!val || val <= 0 || val > 500) continue;
        var st = (sp.getAttribute('style') || '');
        if(st.indexOf('border-radius') === -1) continue;  // uniquement les badges de charge
        sp.dataset.barload = String(val);
        sp.classList.add('udt-barload');
        sp.title = 'Voir le chargement de la barre';
      }
    }
  }

  document.addEventListener('click', function(e){
    var el = e.target && e.target.closest ? e.target.closest('[data-barload]') : null;
    if(!el) return;
    e.preventDefault();
    e.stopPropagation();
    open(parseFloat(el.dataset.barload));
  }, true);

  function boot(){
    ensureStyle();
    decorate();
    try{
      var mo = new MutationObserver(function(){
        clearTimeout(window.__udtBlT);
        window.__udtBlT = setTimeout(function(){ decorate(); }, 150);
      });
      mo.observe(document.body, {childList:true, subtree:true});
    }catch(e){
      setInterval(function(){ decorate(); }, 1200);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

// ===== PATCH: Onglet ⚙️ Paramètres — bloc « Suivi athlète » =====
// Champs de suivi configurables par studio (échelle 1 à 5) + numéro
// WhatsApp du coach. S'ajoute sous « Créer un athlète », dans le même
// panneau admin-colors.
(function(){
  if(window.__patchBound_wellnessSettings) return;
  window.__patchBound_wellnessSettings = true;

  const WS_MAX = 5;      // champs actifs maximum
  const WS_WARN = 3;     // au-delà, on prévient
  const UPSIDE_SLUG = 'upside';

  let _wsStudios = [];   // studios éditables
  let _wsStudioId = null;
  let _wsCfg = null;
  let _wsLoaded = false;

  function _wsEsc(s){
    return (s==null?'':String(s))
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function _wsSlugify(label){
    return (label||'').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g,'')
      .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,32)
      || ('champ_'+Date.now().toString(36).slice(-4));
  }

  function _wsDefaultCfg(){
    return {scale_max:5,fields:[
      {key:'sommeil',    label:'Sommeil',    icon:'😴', inverted:false, active:true},
      {key:'energie',    label:'Énergie',    icon:'🔥', inverted:false, active:true},
      {key:'courbatures',label:'Courbatures',icon:'🦵', inverted:true,  active:true}
    ]};
  }

  function _wsIsUpsideAdmin(){
    try{ return currentProfile && currentProfile.role==='admin' && !currentProfile.studio_id; }
    catch(e){ return false; }
  }

  // Les données d'Upside ont studio_id = NULL, mais la ligne 'upside'
  // existe bien dans studios : c'est elle qui porte la config.
  async function _wsOwnStudioId(){
    let sid = null;
    try{ sid = (typeof getStudioId==='function') ? getStudioId() : null; }catch(e){}
    if(!sid && currentProfile && currentProfile.studio_id) sid = currentProfile.studio_id;
    if(sid) return sid;
    if(currentProfile && currentProfile.own_studio_id) return currentProfile.own_studio_id;
    const r = await sb.from('studios').select('id').eq('slug',UPSIDE_SLUG).maybeSingle();
    return r.data ? r.data.id : null;
  }

  function _wsInjectStyles(){
    if(document.getElementById('ws-styles')) return;
    const st = document.createElement('style');
    st.id = 'ws-styles';
    st.textContent =
      '.ws-row{border:1px solid var(--border);border-radius:12px;padding:10px;margin-bottom:8px;background:var(--dark)}'+
      '.ws-row.off{opacity:.45}'+
      '.ws-top{display:flex;gap:6px;align-items:center}'+
      '.ws-icon{width:46px;text-align:center;background:var(--card);border:1.5px solid var(--border2);border-radius:8px;color:var(--text);font-size:16px;padding:8px 4px;flex:0 0 auto;font-family:inherit}'+
      '.ws-label{flex:1;min-width:0;background:var(--card);border:1.5px solid var(--border2);border-radius:8px;color:var(--text);font-family:inherit;font-size:14px;padding:8px 10px}'+
      '.ws-mini{flex:0 0 auto;width:30px;height:34px;background:transparent;border:1px solid var(--border2);border-radius:8px;color:var(--muted);font-size:13px;cursor:pointer}'+
      '.ws-mini:disabled{opacity:.3;cursor:default}'+
      '.ws-mini.danger{color:var(--red)}'+
      '.ws-opts{display:flex;flex-wrap:wrap;gap:14px;margin-top:9px}'+
      '.ws-chk{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer}'+
      '.ws-chk b{color:var(--text);font-weight:700}'+
      '.ws-add{width:100%;margin-top:6px;background:transparent;border:1px dashed var(--border2);color:var(--muted);border-radius:10px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}'+
      '.ws-add:disabled{opacity:.4;cursor:default}'+
      '.ws-warn{background:rgba(255,140,71,.08);border:1px solid rgba(255,140,71,.3);color:#ff8c47;border-radius:10px;padding:9px 11px;font-size:12px;line-height:1.5;margin-bottom:12px}'+
      '.ws-prev{background:var(--dark);border:1px solid var(--border);border-radius:12px;padding:12px;margin:14px 0}'+
      '.ws-prev-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)}'+
      '.ws-prev-row:last-child{border-bottom:0}'+
      '.ws-prev-lab{font-size:13px;font-weight:600}'+
      '.ws-dots{display:flex;gap:6px}'+
      '.ws-dot{width:30px;height:30px;border-radius:50%;border:1.5px solid var(--border2);color:var(--muted);font-size:12px;display:flex;align-items:center;justify-content:center}';
    document.head.appendChild(st);
  }

  function ensureWellnessBlock(){
    const panel = document.getElementById('admin-colors');
    if(!panel || document.getElementById('admin-wellness-settings-block')) return;
    _wsInjectStyles();
    const block = document.createElement('div');
    block.id = 'admin-wellness-settings-block';
    block.style.cssText = 'margin-top:28px;padding-top:20px;border-top:1px solid var(--border)';
    block.innerHTML =
      '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:18px;letter-spacing:2px;margin-bottom:6px">🩺 SUIVI ATHLÈTE</div>'+
      '<div style="font-size:12px;color:var(--muted);margin-bottom:16px">'+
        'Les champs que tes athlètes notent de 1 à 5 dans leur espace perso. '+
        'Moins il y en a, plus ils remplissent.</div>'+
      '<div id="ws-studio-slot"></div>'+
      '<div id="ws-warn-slot"></div>'+
      '<div id="ws-rows"><div class="spinner"></div></div>'+
      '<button type="button" class="ws-add" id="ws-add-btn">+ Ajouter un champ</button>'+
      '<div class="ws-prev" id="ws-preview"></div>'+
      '<button type="button" class="btn-primary" id="ws-save-btn">Enregistrer les champs</button>'+
      '<div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--border)">'+
        '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:18px;letter-spacing:2px;margin-bottom:6px">📲 MON NUMÉRO WHATSAPP</div>'+
        '<div style="font-size:12px;color:var(--muted);margin-bottom:16px">'+
          'Utilisé par le bouton « Envoyer à mon coach ». Visible uniquement par '+
          'les membres de ton studio. Laisse vide pour le retirer.</div>'+
        '<div class="form-group">'+
          '<input type="tel" inputmode="tel" class="form-input" id="ws-phone" placeholder="06 12 34 56 78">'+
        '</div>'+
        '<button type="button" class="btn-secondary" id="ws-phone-save">Enregistrer mon numéro</button>'+
        '<div id="ws-status" style="font-size:11px;color:var(--muted);margin-top:10px;line-height:1.5;word-break:break-word"></div>'+
      '</div>';
    panel.appendChild(block);
    _wsLoad();
  }

  // Message d'état visible à l'écran : pas de console sur tablette.
  function _wsStatus(msg, bad){
    const el = document.getElementById('ws-status');
    if(el){
      el.style.color = bad ? 'var(--red)' : 'var(--muted)';
      el.textContent = msg;
    }
    if(typeof showToast === 'function') showToast(msg);
  }

  // Délégation : insensible au moment où le bloc est (re)construit.
  document.addEventListener('click', function(ev){
    const t = ev.target && ev.target.closest ? ev.target.closest('button') : null;
    if(!t || !t.id) return;

    if(t.id === 'ws-add-btn'){
      ev.preventDefault();
      if(!_wsCfg){ _wsStatus('Configuration pas encore chargée, patiente une seconde.', true); return; }
      if(_wsCfg.fields.length >= WS_MAX) return;
      _wsCfg.fields.push({key:'',label:'',icon:'📋',inverted:false,active:true});
      _wsRender();
    }
    else if(t.id === 'ws-save-btn'){
      ev.preventDefault();
      _wsSave().catch(e=>_wsStatus('Erreur champs : '+(e.message||e), true));
    }
    else if(t.id === 'ws-phone-save'){
      ev.preventDefault();
      _wsSavePhone().catch(e=>_wsStatus('Erreur numéro : '+(e.message||e), true));
    }
  }, true);

  async function _wsLoad(){
    try{
      const own = await _wsOwnStudioId();
      if(_wsIsUpsideAdmin()){
        const r = await sb.from('studios').select('id,name,slug,wellness_config').order('name');
        _wsStudios = r.data || [];
      }else{
        const r = await sb.from('studios').select('id,name,slug,wellness_config').eq('id',own).maybeSingle();
        _wsStudios = r.data ? [r.data] : [];
      }
      if(!_wsStudios.length){
        document.getElementById('ws-rows').innerHTML =
          '<div style="color:var(--muted);font-size:12px">Aucun studio accessible.</div>';
        return;
      }
      if(!_wsStudioId || !_wsStudios.some(s=>s.id===_wsStudioId)){
        _wsStudioId = (own && _wsStudios.some(s=>s.id===own)) ? own : _wsStudios[0].id;
      }
      _wsLoadDraft();
      _wsLoaded = true;
      _wsRender();
      _wsLoadPhone();
    }catch(e){
      console.warn('wellness settings load',e);
      const el = document.getElementById('ws-rows');
      if(el) el.innerHTML = '<div style="color:var(--red);font-size:12px">Erreur : '+_wsEsc(e.message||e)+'</div>';
    }
  }

  function _wsLoadDraft(){
    const st = _wsStudios.find(s=>s.id===_wsStudioId);
    let cfg = st && st.wellness_config;
    if(!cfg || !Array.isArray(cfg.fields) || !cfg.fields.length) cfg = _wsDefaultCfg();
    _wsCfg = JSON.parse(JSON.stringify(cfg));
    if(!_wsCfg.scale_max) _wsCfg.scale_max = 5;
  }

  function _wsRender(){
    if(!_wsCfg) return;
    const rowsEl = document.getElementById('ws-rows');
    const warnEl = document.getElementById('ws-warn-slot');
    const stSlot = document.getElementById('ws-studio-slot');
    if(!rowsEl) return;

    // sélecteur de studio (admins Upside seulement)
    if(stSlot){
      if(_wsIsUpsideAdmin() && _wsStudios.length>1){
        stSlot.innerHTML =
          '<div class="form-group"><label class="form-label">Studio à configurer</label>'+
          '<select class="form-select" id="ws-studio-select">'+
          _wsStudios.map(s=>'<option value="'+_wsEsc(s.id)+'"'+(s.id===_wsStudioId?' selected':'')+'>'+
            _wsEsc(s.name||s.slug)+'</option>').join('')+
          '</select></div>';
        const sel = document.getElementById('ws-studio-select');
        if(sel) sel.onchange = function(){
          _wsStudioId = sel.value;
          _wsLoadDraft();
          _wsRender();
        };
      }else{
        stSlot.innerHTML = '';
      }
    }

    const active = _wsCfg.fields.filter(f=>f.active).length;
    warnEl.innerHTML = active > WS_WARN
      ? '<div class="ws-warn">⚠️ '+active+' champs actifs. Au-delà de '+WS_WARN+
        ', les athlètes remplissent nettement moins. '+WS_MAX+' maximum.</div>'
      : '';

    rowsEl.innerHTML = _wsCfg.fields.map((f,i)=>
      '<div class="ws-row'+(f.active?'':' off')+'">'+
        '<div class="ws-top">'+
          '<input class="ws-icon" type="text" maxlength="2" value="'+_wsEsc(f.icon||'')+'" data-i="'+i+'" data-k="icon">'+
          '<input class="ws-label" type="text" value="'+_wsEsc(f.label||'')+'" data-i="'+i+'" data-k="label" placeholder="Nom du champ">'+
          '<button type="button" class="ws-mini" data-act="up" data-i="'+i+'"'+(i===0?' disabled':'')+'>↑</button>'+
          '<button type="button" class="ws-mini" data-act="down" data-i="'+i+'"'+(i===_wsCfg.fields.length-1?' disabled':'')+'>↓</button>'+
          '<button type="button" class="ws-mini danger" data-act="del" data-i="'+i+'">✕</button>'+
        '</div>'+
        '<div class="ws-opts">'+
          '<label class="ws-chk"><input type="checkbox" data-i="'+i+'" data-k="active"'+(f.active?' checked':'')+'> Actif</label>'+
          '<label class="ws-chk"><input type="checkbox" data-i="'+i+'" data-k="inverted"'+(f.inverted?' checked':'')+'> Une note haute est <b>mauvaise</b></label>'+
        '</div>'+
      '</div>'
    ).join('');

    const add = document.getElementById('ws-add-btn');
    if(add) add.disabled = _wsCfg.fields.length >= WS_MAX;

    _wsPreview();
    _wsWireRows();
  }

  function _wsPreview(){
    const box = document.getElementById('ws-preview');
    if(!box) return;
    const fields = _wsCfg.fields.filter(f=>f.active);
    if(!fields.length){
      box.innerHTML = '<div style="color:var(--muted);font-size:12px">Aucun champ actif — rien ne s\'affichera chez l\'athlète.</div>';
      return;
    }
    const max = _wsCfg.scale_max || 5;
    box.innerHTML =
      '<div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">Aperçu côté athlète</div>'+
      fields.map(f=>{
        let dots='';
        for(let v=1; v<=max; v++) dots += '<span class="ws-dot">'+v+'</span>';
        return '<div class="ws-prev-row">'+
                 '<div class="ws-prev-lab">'+_wsEsc(f.icon||'')+' '+_wsEsc(f.label||'—')+'</div>'+
                 '<div class="ws-dots">'+dots+'</div>'+
               '</div>';
      }).join('');
  }

  function _wsWireRows(){
    document.querySelectorAll('#ws-rows .ws-icon, #ws-rows .ws-label').forEach(inp=>{
      inp.oninput = function(){
        const i = parseInt(inp.dataset.i,10);
        if(isNaN(i) || !_wsCfg.fields[i]) return;
        _wsCfg.fields[i][inp.dataset.k] = inp.value;
        _wsPreview();
      };
    });
    document.querySelectorAll('#ws-rows .ws-chk input').forEach(chk=>{
      chk.onchange = function(){
        const i = parseInt(chk.dataset.i,10), k = chk.dataset.k;
        if(isNaN(i) || !_wsCfg.fields[i]) return;
        if(k==='active' && chk.checked){
          if(_wsCfg.fields.filter(f=>f.active).length >= WS_MAX){
            chk.checked = false;
            showToast('⚠️ '+WS_MAX+' champs actifs maximum');
            return;
          }
        }
        _wsCfg.fields[i][k] = chk.checked;
        _wsRender();
      };
    });
    document.querySelectorAll('#ws-rows .ws-mini').forEach(btn=>{
      btn.onclick = function(){
        const i = parseInt(btn.dataset.i,10), act = btn.dataset.act;
        if(isNaN(i) || !_wsCfg.fields[i]) return;
        if(act==='up' && i>0){
          const t=_wsCfg.fields[i-1]; _wsCfg.fields[i-1]=_wsCfg.fields[i]; _wsCfg.fields[i]=t;
        }else if(act==='down' && i<_wsCfg.fields.length-1){
          const t=_wsCfg.fields[i+1]; _wsCfg.fields[i+1]=_wsCfg.fields[i]; _wsCfg.fields[i]=t;
        }else if(act==='del'){
          if(!confirm('Supprimer « '+(_wsCfg.fields[i].label||'ce champ')+' » ?\nLes saisies déjà enregistrées sont conservées.')) return;
          _wsCfg.fields.splice(i,1);
        }
        _wsRender();
      };
    });
  }

  async function _wsSave(){
    if(!_wsCfg || !_wsStudioId) return;
    const seen = {};
    for(const f of _wsCfg.fields){
      const label = (f.label||'').trim();
      if(!label){ showToast('⚠️ Un champ est sans nom'); return; }
      if(!f.key) f.key = _wsSlugify(label);   // clé figée à la création
      if(seen[f.key]){ showToast('⚠️ Deux champs portent le même nom : '+label); return; }
      seen[f.key] = 1;
      f.label = label;
      f.icon = (f.icon||'').trim();
      f.inverted = !!f.inverted;
      f.active = !!f.active;
    }
    const active = _wsCfg.fields.filter(f=>f.active).length;
    if(!active){ showToast('⚠️ Au moins un champ actif est nécessaire'); return; }
    if(active > WS_MAX){ showToast('⚠️ '+WS_MAX+' champs actifs maximum'); return; }
    _wsCfg.scale_max = 5;

    const btn = document.getElementById('ws-save-btn');
    if(btn){ btn.disabled = true; btn.textContent = 'Enregistrement…'; }

    const {data,error} = await sb.from('studios')
      .update({wellness_config:_wsCfg})
      .eq('id',_wsStudioId)
      .select('id,wellness_config');

    if(btn){ btn.disabled = false; btn.textContent = 'Enregistrer les champs'; }

    if(error){ showToast('❌ '+error.message); return; }
    if(!data || !data.length){ showToast('❌ Rien enregistré — droits insuffisants sur ce studio'); return; }

    const st = _wsStudios.find(s=>s.id===_wsStudioId);
    if(st) st.wellness_config = data[0].wellness_config;
    showToast('✅ Suivi mis à jour');
    _wsRender();
  }

  function _wsNormalizePhone(raw){
    if(!raw) return '';
    let s = String(raw).replace(/[\s.\-()]/g,'');
    if(/^00/.test(s)) s = '+'+s.slice(2);
    if(/^0\d{9}$/.test(s)) s = '+33'+s.slice(1);
    if(/^\d{9,15}$/.test(s) && s[0]!=='0') s = '+'+s;
    return s;
  }

  async function _wsLoadPhone(){
    const inp = document.getElementById('ws-phone');
    // NB : currentUser est un `let` de core.js — il n'est PAS sur window.
    if(!inp || typeof currentUser === 'undefined' || !currentUser) return;
    try{
      const {data} = await sb.from('coach_contacts')
        .select('whatsapp_phone').eq('user_id',currentUser.id).maybeSingle();
      if(data && data.whatsapp_phone) inp.value = data.whatsapp_phone;
    }catch(e){ console.warn('coach phone load',e); }
  }

  async function _wsSavePhone(){
    const inp = document.getElementById('ws-phone');
    if(!inp){ _wsStatus('Champ numéro introuvable à l\'écran.', true); return; }
    // NB : currentUser est un `let` de core.js — il n'est PAS sur window.
    if(typeof currentUser === 'undefined' || !currentUser || !currentUser.id){
      _wsStatus('Session expirée — recharge la page et reconnecte-toi.', true);
      return;
    }
    const raw = inp.value.trim();

    if(!raw){
      const {error} = await sb.from('coach_contacts').delete().eq('user_id',currentUser.id);
      if(error){ _wsStatus('Suppression refusée : '+error.message+(error.code?' ['+error.code+']':''), true); return; }
      _wsStatus('🗑 Numéro retiré');
      return;
    }
    const phone = _wsNormalizePhone(raw);
    if(!/^\+\d{8,15}$/.test(phone)){
      _wsStatus('Numéro non reconnu : « '+raw+' » devient « '+phone+' ». Attendu 06 12 34 56 78 ou +33612345678.', true);
      return;
    }

    _wsStatus('Enregistrement en cours…');
    const {data,error} = await sb.from('coach_contacts')
      .upsert({user_id:currentUser.id,whatsapp_phone:phone,updated_at:new Date().toISOString()},
              {onConflict:'user_id'})
      .select('user_id,whatsapp_phone');

    if(error){
      _wsStatus('Refus de la base : '+error.message+
        (error.code?' [code '+error.code+']':'')+
        (error.hint?' — '+error.hint:''), true);
      return;
    }
    if(!data || !data.length){
      _wsStatus('Aucune ligne écrite — la règle d\'accès a bloqué l\'enregistrement.', true);
      return;
    }
    inp.value = data[0].whatsapp_phone;
    _wsStatus('✅ Numéro enregistré : '+data[0].whatsapp_phone);
  }

  // Greffe sur l'onglet ⚙️ Paramètres, après le bloc « Créer un athlète »
  const _origAdminTabColorsWs = window.adminTabColors;
  window.adminTabColors = async function(btn){
    await _origAdminTabColorsWs(btn);
    ensureWellnessBlock();
  };

})();

// ===== PATCH: Suivi athlète dans l'Espace perso (échelle 1 à 5) =====
// Remplace l'usage de la page Suivi : carte compacte en haut de l'onglet
// Espace perso, champs pilotés par studios.wellness_config, enregistrement
// au tap, puis envoi facultatif au coach par WhatsApp.
(function(){
  if(window.__patchBound_wellnessDaily) return;
  window.__patchBound_wellnessDaily = true;

  const UPSIDE_SLUG = 'upside';

  // Correspondance avec les anciennes colonnes : on continue de les
  // remplir (valeur ×2, car elles sont sur 1-10) pour que les vues
  // coach et l'historique des 145 saisies restent cohérents.
  const LEGACY = {
    sommeil:'sleep_quality', sleep:'sleep_quality', sleep_quality:'sleep_quality',
    energie:'energy', energy:'energy',
    courbatures:'soreness', soreness:'soreness',
    fatigue:'fatigue',
    stress:'stress',
    motivation:'motivation',
    humeur:'mood', mood:'mood'
  };

  // État au réveil : 4 états fixes, enregistrés dans training_load_days.wake.
  // Les clés doivent rester alignées sur la contrainte SQL de la table.
  const WD_WAKE = [
    ['Forme',   '\ud83d\udcaa', 'En forme'],
    ['RAS',     '\ud83d\ude0a', 'RAS'],
    ['Fatigue', '\ud83d\ude2e\u200d\ud83d\udca8', 'Fatigué'],
    ['PLS',     '\ud83e\udd75', 'PLS']
  ];
  const WD_WAKE_C = {Forme:'#47ff8c', RAS:'var(--accent)', Fatigue:'#ff8c47', PLS:'#ff4747'};

  let _wdCfg = null;         // config du studio (cache)
  let _wdEntry = null;       // saisie du jour affiché
  let _wdDate = null;        // date de la saisie chargée
  let _wdOpen = false;       // carte dépliée ?
  let _wdSaveTimer = null;
  let _wdCoach = null;       // {name, phone} résolu une fois
  let _wdWake = null;        // état au réveil du jour affiché

  function _wdEsc(s){
    return (s==null?'':String(s))
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function _wdToday(){
    const d = new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  function _wdPrettyDate(iso){
    try{
      const d = new Date(iso+'T12:00:00');
      if(iso===_wdToday()) return "aujourd'hui";
      return d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
    }catch(e){ return iso; }
  }

  async function _wdGetConfig(){
    if(_wdCfg) return _wdCfg;
    let sid = null;
    try{ sid = (typeof getStudioId==='function') ? getStudioId() : null; }catch(e){}
    if(!sid && currentProfile && currentProfile.studio_id) sid = currentProfile.studio_id;
    try{
      let q;
      if(sid) q = sb.from('studios').select('wellness_config').eq('id',sid).maybeSingle();
      else    q = sb.from('studios').select('wellness_config').eq('slug',UPSIDE_SLUG).maybeSingle();
      const {data} = await q;
      const cfg = data && data.wellness_config;
      if(cfg && Array.isArray(cfg.fields)){
        _wdCfg = {
          scale_max: cfg.scale_max || 5,
          fields: cfg.fields.filter(f=>f && f.active && f.key)
        };
      }else{
        _wdCfg = {scale_max:5, fields:[]};
      }
    }catch(e){
      console.warn('wellness config',e);
      _wdCfg = {scale_max:5, fields:[]};
    }
    return _wdCfg;
  }

  let _wdPeriod = false;
  // Case « Règles aujourd'hui » : uniquement pour les profils féminins
  function _wdIsFemale(){
    const g = String((typeof currentProfile!=='undefined' && currentProfile && currentProfile.gender) || '').trim().toLowerCase();
    return g === 'female' || g === 'f' || g === 'femme';
  }
  function _wdPeriodHTML(){
    if(!_wdIsFemale()) return '';
    const on = _wdPeriod;
    return '<button type="button" class="wd-period'+(on?' on':'')+'" id="wd-period-btn" aria-pressed="'+on+'">'+
      '<span class="bx">'+(on?'✓':'')+'</span>'+
      '<span><span class="t1">🩸 Règles aujourd\'hui</span>'+
      '<span class="t2">Visible seulement par toi et tes coachs</span></span></button>';
  }
  async function _wdSavePeriod(){
    if(!_wdDate || !currentUser) return;
    const {error} = await sb.from('training_load_days').upsert({
      athlete_id: currentUser.id, date: _wdDate, period: _wdPeriod,
      updated_at: new Date().toISOString()
    }, {onConflict:'athlete_id,date'});
    if(error){ console.warn('period save',error); showToast('❌ '+error.message); }
  }

  async function _wdLoadEntry(iso){
    _wdDate = iso;
    _wdEntry = null;
    _wdWake = null;
    try{
      const [{data:w},{data:d}] = await Promise.all([
        sb.from('wellness_entries')
          .select('*').eq('athlete_id',currentUser.id).eq('date',iso).maybeSingle(),
        sb.from('training_load_days')
          .select('wake,period').eq('athlete_id',currentUser.id).eq('date',iso).maybeSingle()
      ]);
      _wdEntry = w || null;
      _wdWake = (d && d.wake) || null;
      _wdPeriod = !!(d && d.period);
    }catch(e){ console.warn('wellness entry',e); }
  }

  // Valeur courante d'un champ, sur l'échelle 1-5
  function _wdVal(key){
    if(!_wdEntry) return null;
    const m = _wdEntry.metrics || {};
    if(typeof m[key] === 'number') return m[key];
    // repli : ancienne saisie sur 1-10 dans les colonnes historiques
    const col = LEGACY[key];
    if(col && typeof _wdEntry[col] === 'number'){
      return Math.max(1, Math.min(5, Math.round(_wdEntry[col]/2)));
    }
    return null;
  }

  function _wdFilled(){
    if(_wdWake) return true;
    if(!_wdCfg || !_wdCfg.fields.length) return false;
    return _wdCfg.fields.some(f => _wdVal(f.key) != null);
  }

  // Libellé lisible d'un état au réveil
  function _wdWakeLabel(k){
    const w = WD_WAKE.find(x => x[0] === k);
    return w ? (w[1]+' '+w[2]) : '';
  }

  // Les 4 boutons d'état au réveil — toujours présents, quels que soient
  // les champs configurés par le studio.
  function _wdWakeHTML(){
    return '<div class="wd-wake-lab">Au réveil</div>'+
      '<div class="wd-wake">'+
        WD_WAKE.map(function(w){
          const on = (_wdWake === w[0]);
          const c = WD_WAKE_C[w[0]];
          return '<button type="button" class="wd-wk'+(on?' on':'')+'" data-wake="'+w[0]+'"'+
                 (on ? ' style="border-color:'+c+';background:'+c+'22;color:'+c+'"' : '')+'>'+
                   '<span>'+w[1]+'</span>'+w[2]+
                 '</button>';
        }).join('')+
      '</div>';
  }

  function _wdDotColor(v, inverted){
    if(v == null) return null;
    const score = inverted ? (6 - v) : v;   // 1..5, 5 = au mieux
    if(score >= 4) return '#47ff8c';
    if(score === 3) return '#e8ff47';
    if(score === 2) return '#ff8c47';
    return '#ff4747';
  }

  async function _wdRenderCard(){
    const area = document.getElementById('sessions-area');
    if(!area) return;
    if(document.getElementById('wd-card')) return;

    // Plus d'early-return si aucun champ n'est configuré : l'état au réveil
    // suffit à lui seul, les champs 1-5 sont un complément facultatif.
    await _wdGetConfig();

    const iso = (typeof selectedDate !== 'undefined' && selectedDate) ? selectedDate : _wdToday();
    if(iso > _wdToday()) return;                // pas de saisie pour un jour à venir

    if(_wdDate !== iso) await _wdLoadEntry(iso);

    const wrap = document.createElement('div');
    wrap.id = 'wd-card';
    area.insertAdjacentElement('afterbegin', wrap);
    _wdPaint();
  }

  function _wdPaint(){
    const wrap = document.getElementById('wd-card');
    if(!wrap || !_wdCfg) return;

    const filled = _wdFilled();
    const open = _wdOpen || !filled;

    if(!open){
      // Replié : une ligne de résumé
      const parts = _wdCfg.fields.map(f=>{
        const v = _wdVal(f.key);
        if(v==null) return '';
        const c = _wdDotColor(v,f.inverted);
        return '<span style="color:'+c+';font-weight:700">'+_wdEsc(f.icon||'')+' '+v+'</span>';
      }).filter(Boolean);
      if(_wdWake) parts.unshift('<span style="color:'+WD_WAKE_C[_wdWake]+';font-weight:700">'+
        _wdEsc(_wdWakeLabel(_wdWake))+'</span>');
      const chips = parts.join('<span style="opacity:.3"> · </span>');

      wrap.innerHTML =
        '<div class="wd-box wd-done">'+
          '<div class="wd-done-l">'+
            '<div class="wd-done-t">✅ Suivi enregistré</div>'+
            '<div class="wd-done-c">'+chips+'</div>'+
          '</div>'+
          '<button type="button" class="wd-edit" id="wd-edit-btn">Modifier</button>'+
        '</div>';
      const b = document.getElementById('wd-edit-btn');
      if(b) b.onclick = function(){ _wdOpen = true; _wdPaint(); };
      return;
    }

    const max = _wdCfg.scale_max || 5;
    const rows = _wdCfg.fields.map(f=>{
      const cur = _wdVal(f.key);
      let dots = '';
      for(let v=1; v<=max; v++){
        const on = (cur != null && v <= cur);
        const c = on ? _wdDotColor(cur, f.inverted) : null;
        dots += '<button type="button" class="wd-dot'+(on?' on':'')+'" data-key="'+_wdEsc(f.key)+'" data-v="'+v+'"'+
                (c ? ' style="border-color:'+c+';background:'+c+'22;color:'+c+'"' : '')+'>'+v+'</button>';
      }
      return '<div class="wd-row">'+
               '<div class="wd-lab">'+_wdEsc(f.icon||'')+' '+_wdEsc(f.label||f.key)+'</div>'+
               '<div class="wd-dots">'+dots+'</div>'+
             '</div>';
    }).join('');

    const note = (_wdEntry && _wdEntry.notes) ? _wdEntry.notes : '';

    wrap.innerHTML =
      '<div class="wd-box">'+
        '<div class="wd-head">'+
          '<div class="wd-title">Comment tu te sens ?</div>'+
          '<div class="wd-date">'+_wdEsc(_wdPrettyDate(_wdDate))+'</div>'+
        '</div>'+
        _wdWakeHTML()+
        _wdPeriodHTML()+
        rows+
        '<textarea class="wd-note" id="wd-note" rows="2" placeholder="Un mot pour ton coach… (optionnel)">'+_wdEsc(note)+'</textarea>'+
        '<button type="button" class="wd-send" id="wd-send-btn">📲 Envoyer à mon coach</button>'+
      '</div>';

    wrap.querySelectorAll('.wd-wk').forEach(btn=>{
      btn.onclick = function(){
        const k = btn.dataset.wake;
        _wdWake = (_wdWake === k) ? null : k;   // retaper le même état l'efface
        _wdPaint();
        _wdSaveWake();
      };
    });

    const pb = document.getElementById('wd-period-btn');
    if(pb) pb.onclick = function(){
      _wdPeriod = !_wdPeriod;
      _wdPaint();
      _wdSavePeriod();
    };

    wrap.querySelectorAll('.wd-dot').forEach(btn=>{
      btn.onclick = function(){
        const key = btn.dataset.key;
        const v = parseInt(btn.dataset.v,10);
        const cur = _wdVal(key);
        _wdSet(key, cur === v ? null : v);   // retaper la même valeur l'efface
      };
    });

    const ta = document.getElementById('wd-note');
    if(ta){
      ta.onblur = function(){ _wdSet('__notes__', ta.value); };
    }

    const send = document.getElementById('wd-send-btn');
    if(send) send.onclick = _wdSendToCoach;
  }

  function _wdSet(key, value){
    if(!_wdEntry) _wdEntry = {athlete_id:currentUser.id, date:_wdDate, metrics:{}, scale_max:5};
    if(!_wdEntry.metrics) _wdEntry.metrics = {};

    if(key === '__notes__'){
      _wdEntry.notes = value || null;
    }else{
      if(value == null) delete _wdEntry.metrics[key];
      else _wdEntry.metrics[key] = value;
      const col = LEGACY[key];
      if(col) _wdEntry[col] = (value == null) ? null : Math.max(1, Math.min(10, value*2));
      _wdPaint();
    }

    clearTimeout(_wdSaveTimer);
    _wdSaveTimer = setTimeout(_wdSave, 450);
  }

  // L'état au réveil vit dans training_load_days (même table que le jour OFF
  // et la charge) : c'est lui que lit training_load_series pour la frise.
  async function _wdSaveWake(){
    if(!_wdDate || !currentUser) return;
    const {error} = await sb.from('training_load_days').upsert({
      athlete_id: currentUser.id,
      date: _wdDate,
      wake: _wdWake,
      updated_at: new Date().toISOString()
    }, {onConflict:'athlete_id,date'});
    if(error){
      console.warn('wake save',error);
      showToast('❌ '+error.message);
    }
  }

  async function _wdSave(){
    if(!_wdEntry || !_wdDate) return;
    const payload = {
      athlete_id: currentUser.id,
      date: _wdDate,
      metrics: _wdEntry.metrics || {},
      scale_max: 5,
      notes: _wdEntry.notes || null,
      updated_at: new Date().toISOString()
    };
    // colonnes historiques
    Object.keys(LEGACY).forEach(k=>{
      const col = LEGACY[k];
      if(typeof _wdEntry[col] === 'number' || _wdEntry[col] === null) payload[col] = _wdEntry[col];
    });

    const {error} = await sb.from('wellness_entries')
      .upsert(payload, {onConflict:'athlete_id,date'});
    if(error){
      console.warn('wellness save',error);
      showToast('❌ '+error.message);
    }
  }

  async function _wdResolveCoach(){
    if(_wdCoach !== null) return _wdCoach;
    _wdCoach = false;
    try{
      let coachId = currentProfile && currentProfile.coach_id;
      if(!coachId){
        // repli : propriétaire du studio
        let sid = null;
        try{ sid = (typeof getStudioId==='function') ? getStudioId() : null; }catch(e){}
        let q = sid
          ? sb.from('studios').select('owner_id').eq('id',sid).maybeSingle()
          : sb.from('studios').select('owner_id').eq('slug',UPSIDE_SLUG).maybeSingle();
        const {data:st} = await q;
        coachId = st && st.owner_id;
      }
      if(!coachId) return _wdCoach;

      const [{data:cc},{data:prof}] = await Promise.all([
        sb.from('coach_contacts').select('whatsapp_phone').eq('user_id',coachId).maybeSingle(),
        sb.from('profiles').select('full_name').eq('id',coachId).maybeSingle()
      ]);
      if(cc && cc.whatsapp_phone){
        _wdCoach = {phone: cc.whatsapp_phone, name: (prof && prof.full_name) || 'ton coach'};
      }
    }catch(e){ console.warn('resolve coach',e); }
    return _wdCoach;
  }

  async function _wdSendToCoach(){
    clearTimeout(_wdSaveTimer);
    await _wdSave();

    if(!_wdFilled()){
      showToast('⚠️ Remplis au moins un champ avant d\'envoyer');
      return;
    }

    const coach = await _wdResolveCoach();
    if(!coach || !coach.phone){
      showToast('⚠️ Ton coach n\'a pas renseigné son numéro WhatsApp');
      return;
    }

    const who = (currentProfile && currentProfile.full_name) || 'Un athlète';
    const list = _wdCfg.fields.map(f=>{
      const v = _wdVal(f.key);
      return (v==null) ? '' : (f.label||f.key)+' '+v+'/5';
    }).filter(Boolean);
    if(_wdWake) list.unshift('Réveil : '+_wdWakeLabel(_wdWake));
    const parts = list.join(' · ');
    const note = (_wdEntry && _wdEntry.notes) ? '\n« '+_wdEntry.notes+' »' : '';
    const msg = who+' — suivi du '+_wdPrettyDate(_wdDate)+'\n'+parts+note;

    const url = 'https://wa.me/'+coach.phone.replace(/\D/g,'')+'?text='+encodeURIComponent(msg);
    window.open(url,'_blank');

    _wdOpen = false;
    _wdPaint();
  }

  function _wdInjectStyles(){
    if(document.getElementById('wd-styles')) return;
    const st = document.createElement('style');
    st.id = 'wd-styles';
    st.textContent =
      '.wd-box{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px}'+
      '.wd-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:12px}'+
      '.wd-title{font-family:"Bebas Neue",sans-serif;font-size:16px;letter-spacing:1.5px}'+
      '.wd-date{font-size:11px;color:var(--muted)}'+
      '.wd-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0}'+
      '.wd-lab{font-size:13px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
      '.wd-dots{display:flex;gap:5px;flex:0 0 auto}'+
      '.wd-dot{width:32px;height:32px;border-radius:50%;border:1.5px solid var(--border2);background:transparent;'+
        'color:var(--muted);font-size:12px;font-family:inherit;cursor:pointer;padding:0;'+
        'display:flex;align-items:center;justify-content:center;transition:transform .08s}'+
      '.wd-dot:active{transform:scale(.9)}'+
      '.wd-note{width:100%;margin-top:10px;background:var(--dark);border:1.5px solid var(--border2);border-radius:10px;'+
        'color:var(--text);font-family:inherit;font-size:13px;padding:9px;resize:none}'+
      '.wd-send{width:100%;margin-top:10px;background:transparent;border:1px solid var(--border2);'+
        'color:var(--text);border-radius:10px;padding:11px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}'+
      '.wd-done{display:flex;align-items:center;justify-content:space-between;gap:12px}'+
      '.wd-done-t{font-size:12px;font-weight:700;margin-bottom:3px}'+
      '.wd-done-c{font-size:12px}'+
      '.wd-edit{flex:0 0 auto;background:transparent;border:1px solid var(--border2);color:var(--muted);'+
        'border-radius:8px;padding:7px 11px;font-size:11px;cursor:pointer;font-family:inherit}'+
      '.wd-wake-lab{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1.2px;'+
        'font-weight:700;margin-bottom:7px}'+
      '.wd-wake{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:4px}'+
      '.wd-period{display:flex;align-items:center;gap:10px;width:100%;text-align:left;margin:8px 0 6px;padding:9px 10px;border-radius:10px;border:1px solid var(--border2);background:var(--card2);color:var(--text);font-family:inherit;cursor:pointer}'+
      '.wd-period .bx{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--muted);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#000;flex:0 0 auto}'+
      '.wd-period .t1{display:block;font-size:13px}'+
      '.wd-period .t2{display:block;font-size:10.5px;color:var(--muted);margin-top:1px}'+
      '.wd-period.on{border-color:#f472b6;background:rgba(244,114,182,.08)}'+
      '.wd-period.on .bx{background:#f472b6;border-color:#f472b6}'+
      '.wd-wk{display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 2px;'+
        'border-radius:10px;border:1.5px solid var(--border2);background:transparent;color:var(--muted);'+
        'font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;transition:transform .08s}'+
      '.wd-wk span{font-size:17px;line-height:1}'+
      '.wd-wk:active{transform:scale(.95)}';
    document.head.appendChild(st);
  }

  // Greffe : la carte est ajoutée en tête de l'espace perso après chaque rendu
  const _origRenderPersoSessionsWd = renderPersoSessions;
  renderPersoSessions = async function(){
    await _origRenderPersoSessionsWd.apply(this, arguments);
    _wdInjectStyles();
    try{ await _wdRenderCard(); }catch(e){ console.warn('wellness card',e); }
  };

})();

// ===== PATCH: Coach référent dans la fiche athlète (Espace perso admin) =====
// Sélecteur sous l'en-tête de la fiche : définit profiles.coach_id, qui
// détermine vers quel coach part le bouton « Envoyer à mon coach ».
(function(){
  if(window.__patchBound_persoCoach) return;
  window.__patchBound_persoCoach = true;

  let _pcCoaches = null;   // cache de la liste des coachs du studio

  function _pcEsc(s){
    return (s==null?'':String(s))
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function _pcInjectStyles(){
    if(document.getElementById('pc-styles')) return;
    const st = document.createElement('style');
    st.id = 'pc-styles';
    st.textContent =
      '.pc-row{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--border);'+
        'border-radius:12px;padding:10px 12px;margin-bottom:12px}'+
      '.pc-lab{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1.2px;'+
        'font-weight:700;flex:0 0 auto}'+
      '.pc-sel{flex:1;min-width:0;background:var(--dark);border:1.5px solid var(--border2);border-radius:9px;'+
        'color:var(--text);font-family:inherit;font-size:13px;padding:8px 10px}';
    document.head.appendChild(st);
  }

  async function _pcLoadCoaches(){
    if(_pcCoaches) return _pcCoaches;
    // Coachs = admins et profils marqués coach, dans le studio courant.
    // Upside : studio_id IS NULL.
    let sid = null;
    try{ sid = (typeof getStudioId==='function') ? getStudioId() : null; }catch(e){}
    let q = sb.from('profiles').select('id,full_name,email,role,is_coach');
    q = sid ? q.eq('studio_id',sid) : q.is('studio_id',null);
    const {data} = await q.order('full_name');
    _pcCoaches = (data||[]).filter(p => p.role==='admin' || p.is_coach);
    return _pcCoaches;
  }

  async function _pcRender(){
    const head = document.querySelector('#perso-fiche-view .perso-fiche-head');
    if(!head || !currentPersoAthlete) return;
    _pcInjectStyles();

    let row = document.getElementById('pc-row');
    if(!row){
      row = document.createElement('div');
      row.id = 'pc-row';
      row.className = 'pc-row';
      row.innerHTML = '<div class="pc-lab">Coach référent</div>'+
                      '<select class="pc-sel" id="pc-select"><option>…</option></select>';
      head.insertAdjacentElement('afterend', row);
    }

    const coaches = await _pcLoadCoaches();
    const sel = document.getElementById('pc-select');
    if(!sel) return;

    const cur = currentPersoAthlete.coach_id || '';
    sel.innerHTML = '<option value="">— aucun —</option>' +
      coaches.map(c=>'<option value="'+_pcEsc(c.id)+'"'+(c.id===cur?' selected':'')+'>'+
        _pcEsc(c.full_name||c.email||'Coach')+'</option>').join('');

    // si le coach actuel n'est pas dans la liste (autre studio), on l'ajoute
    if(cur && !coaches.some(c=>c.id===cur)){
      const opt = document.createElement('option');
      opt.value = cur;
      opt.textContent = 'Coach hors studio';
      opt.selected = true;
      sel.appendChild(opt);
    }

    sel.onchange = async function(){
      const val = sel.value || null;
      sel.disabled = true;
      const {data,error} = await sb.from('profiles')
        .update({coach_id: val})
        .eq('id', currentPersoAthlete.id)
        .select('id,coach_id');
      sel.disabled = false;

      if(error){ showToast('❌ '+error.message); return; }
      if(!data || !data.length){ showToast('❌ Rien enregistré — droits insuffisants'); return; }

      currentPersoAthlete.coach_id = data[0].coach_id;
      const cached = persoAthletesCache.find(a=>a.id===currentPersoAthlete.id);
      if(cached) cached.coach_id = data[0].coach_id;

      const name = val
        ? (sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : 'ce coach')
        : null;
      showToast(name ? '✅ Coach référent : '+name : '✅ Coach référent retiré');
    };
  }

  const _origOpenPersoFichePc = openPersoFiche;
  openPersoFiche = async function(){
    await _origOpenPersoFichePc.apply(this, arguments);
    try{ await _pcRender(); }catch(e){ console.warn('coach référent',e); }
  };

})();

/* ============================================================
   PATCH — CYCLES PERSO (priorités par jour dans l'espace perso)
   Table : personal_cycles (athlete_id, name, start_date, end_date, color, days)
   days = {"1":"Force bas du corps", ..., "7":"Repos"}  1 = lundi
   ============================================================ */
(function(){
  if(window.__patchBound_persoCycles)return;
  window.__patchBound_persoCycles=true;

  const PC_DAYS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
  const PC_PRESET_COLORS=['#2dd4bf','#e8ff47','#47c8ff','#ff7a45','#c084fc','#f87171','#4ade80'];

  let _pcCache={athleteId:null,rows:null};
  let _pcEditing=null;   // cycle en cours d'édition dans la modale (objet ou null = nouveau)

  // ---------- helpers ----------
  function _pcIso(d){
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function _pcDow(d){ const n=d.getDay(); return n===0?7:n; }   // 1 = lundi … 7 = dimanche
  function _pcFmt(iso){
    if(!iso)return '—';
    const [y,m,dd]=iso.split('-');
    return `${dd}/${m}`;
  }
  function _pcEsc(s){ return (typeof escapeHtml==='function')?escapeHtml(s):String(s==null?'':s); }
  function _pcToast(m){ if(typeof showToast==='function')showToast(m); }

  async function _pcLoad(athleteId,force){
    if(!athleteId)return [];
    if(!force && _pcCache.athleteId===athleteId && _pcCache.rows)return _pcCache.rows;
    const {data,error}=await sb.from('personal_cycles')
      .select('*').eq('athlete_id',athleteId).order('start_date',{ascending:false});
    if(error){ console.warn('personal_cycles',error.message); return []; }
    _pcCache={athleteId,rows:data||[]};
    return _pcCache.rows;
  }

  // Cycle actif pour une date ISO : celui dont la période couvre la date (start_date le plus récent)
  function _pcForDate(rows,iso){
    const hit=(rows||[]).filter(c=>c.start_date<=iso && iso<=c.end_date);
    if(!hit.length)return null;
    return hit.sort((a,b)=>b.start_date.localeCompare(a.start_date))[0];
  }

  function _pcWeekIndex(cycle,iso){
    if(!cycle)return null;
    const s=new Date(cycle.start_date+'T12:00:00');
    const d=new Date(iso+'T12:00:00');
    const sMon=new Date(s); sMon.setDate(s.getDate()-(_pcDow(s)-1));
    const dMon=new Date(d); dMon.setDate(d.getDate()-(_pcDow(d)-1));
    const n=Math.round((dMon-sMon)/604800000)+1;
    const e=new Date(cycle.end_date+'T12:00:00');
    const eMon=new Date(e); eMon.setDate(e.getDate()-(_pcDow(e)-1));
    const total=Math.round((eMon-sMon)/604800000)+1;
    return {n,total};
  }

  // ---------- CSS ----------
  function _pcInjectCss(){
    if(document.getElementById('pc-styles'))return;
    const st=document.createElement('style');
    st.id='pc-styles';
    st.textContent=`
    .pc-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 12px;margin-bottom:8px;border-radius:10px;background:var(--card2,#111);border:1px solid var(--border2,#333);border-left-width:4px}
    .pc-bar-name{font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1.5px;line-height:1}
    .pc-bar-meta{font-size:11px;color:var(--muted,#999)}
    .pc-bar-spacer{flex:1}
    .pc-bar-btn{padding:5px 10px;border-radius:7px;border:1px solid var(--border2,#333);background:transparent;color:var(--muted,#999);font-size:11px;cursor:pointer;letter-spacing:.5px}
    .pc-bar-btn:hover{color:var(--text,#fff)}
    .pc-day{min-height:26px;margin:0 2px 6px;padding:4px 6px;border-radius:7px;font-size:10.5px;font-weight:700;line-height:1.25;text-align:center;cursor:pointer;word-break:break-word;border:1px solid transparent;transition:filter .15s}
    .pc-day:hover{filter:brightness(1.25)}
    .pc-day.empty{background:transparent;border:1px dashed var(--border2,#333);color:var(--muted,#777);font-weight:500;opacity:.5}
    .pc-day-banner{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;margin-bottom:10px;border:1px solid transparent;border-left-width:4px}
    .pc-day-banner .lbl{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;opacity:.75}
    .pc-day-banner .val{font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:1px}
    .pc-modal-box{background:var(--card,#1a1a1a);border:1px solid var(--border2,#333);border-radius:14px;padding:20px;width:min(560px,94vw);max-height:88vh;overflow:auto}
    .pc-in{width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border2,#333);background:var(--card2,#111);color:var(--text,#fff);font-size:13px;box-sizing:border-box;font-family:inherit}
    .pc-lbl{font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--muted,#999);margin-bottom:4px;display:block}
    .pc-row{display:grid;grid-template-columns:86px 1fr;gap:8px;align-items:center;margin-bottom:6px}
    .pc-row .d{font-size:11px;color:var(--muted,#999);letter-spacing:.8px}
    .pc-list-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;border:1px solid var(--border2,#333);border-left-width:4px;margin-bottom:6px;cursor:pointer}
    .pc-list-item:hover{background:var(--card2,#111)}
    .pc-list-item .nm{font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:1px}
    .pc-list-item .dt{font-size:11px;color:var(--muted,#999)}
    .pc-swatch{width:24px;height:24px;border-radius:6px;border:2px solid transparent;cursor:pointer}
    .pc-swatch.on{border-color:var(--text,#fff)}
    .pc-btn{padding:9px 14px;border-radius:9px;border:none;background:var(--accent,#2dd4bf);color:#000;font-weight:700;font-size:13px;cursor:pointer}
    .pc-btn.ghost{background:transparent;border:1px solid var(--border2,#333);color:var(--text,#fff);font-weight:500}
    .pc-btn.danger{background:transparent;border:1px solid #f8717155;color:#f87171;font-weight:500}
    .pc-m-legend{display:flex;flex-wrap:wrap;gap:6px 16px;min-width:0}
    .pc-m-leg{display:flex;align-items:center;gap:8px;cursor:pointer;min-width:0}
    .pc-m-leg .sw{width:10px;height:10px;border-radius:3px;flex:0 0 auto}
    .pc-m-leg .pc-bar-name{display:block;font-size:15px}
    .pc-m-leg .pc-bar-meta{display:block;margin-top:2px}
    .perso-month-cell.pc-m-on{padding-top:8px}
    .pc-m-rib{position:absolute;top:-1px;left:-3px;right:-3px;height:4px;pointer-events:none}
    .pc-m-rib.s{left:-1px;border-top-left-radius:8px;border-bottom-left-radius:2px}
    .pc-m-rib.e{right:-1px;border-top-right-radius:8px;border-bottom-right-radius:2px}
    .pc-m-wk{margin-left:4px;font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.5px;line-height:1}
    .pc-m-prio{font-size:8.5px;font-weight:700;line-height:1.15;text-transform:uppercase;letter-spacing:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word;opacity:.9;margin-bottom:1px}
    @media(max-width:640px){.pc-day{font-size:9.5px;padding:3px 4px}.pc-row{grid-template-columns:70px 1fr}.pc-m-wk{font-size:11px;margin-left:3px}.pc-m-prio{font-size:8px}}

    /* --- côté athlète --- */
    .pc-ath{border-radius:14px;padding:14px;margin-bottom:14px;border:1px solid transparent;border-left-width:4px}
    .pc-ath-head{display:flex;align-items:baseline;gap:10px;margin-bottom:10px}
    .pc-ath-name{font-family:'Bebas Neue',sans-serif;font-size:19px;letter-spacing:1.5px;line-height:1;flex:1;min-width:0}
    .pc-ath-wk{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--muted,#999);white-space:nowrap}
    .pc-ath-wk b{font-size:14px;font-family:'Bebas Neue',sans-serif;letter-spacing:1px}
    .pc-ath-track{height:5px;border-radius:3px;background:var(--border2,#333);overflow:hidden;margin-bottom:4px}
    .pc-ath-fill{height:100%;border-radius:3px;transition:width .4s ease}
    .pc-ath-dates{display:flex;justify-content:space-between;font-size:10px;color:var(--muted,#999);margin-bottom:12px}
    .pc-ath-week{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
    .pc-ath-cell{border-radius:7px;padding:5px 3px;text-align:center;min-height:46px;background:var(--card2,#111);border:1px solid transparent}
    .pc-ath-cell .dd{font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted,#999);margin-bottom:3px}
    .pc-ath-cell .pp{font-size:9.5px;font-weight:700;line-height:1.2;word-break:break-word}
    .pc-ath-cell.on{border-color:currentColor}
    .pc-ath-cell.off .pp{color:var(--muted,#777);font-weight:400;opacity:.5}
    .pc-ath-today{margin-top:12px;padding-top:10px;border-top:1px solid var(--border2,#333)}
    .pc-ath-today .lbl{font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted,#999)}
    .pc-ath-today .val{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px;margin-top:2px}
    `;
    document.head.appendChild(st);
  }

  // ---------- rendu dans le calendrier ----------
  // ---------- frise des cycles de l'athlète (vue coach) ----------
  function _pcRenderFrise(rows){
    const area=document.getElementById('perso-calendar-area');
    if(!area)return;
    let box=document.getElementById('pc-frise');
    if(!box){
      box=document.createElement('div'); box.id='pc-frise';
      box.style.cssText='background:var(--card);border:1px solid var(--border);border-radius:14px;padding:10px 12px 8px;margin-bottom:12px';
    }
    if(box.nextElementSibling!==area)area.parentNode.insertBefore(box,area);

    // période affichée dans le calendrier
    const now=new Date(); let ref, refEnd;
    if(persoView==='month'){ ref=new Date(now.getFullYear(),now.getMonth()+persoOffset,1,12); refEnd=new Date(ref.getFullYear(),ref.getMonth()+1,0,12); }
    else if(persoView==='day'){ ref=new Date(now); ref.setDate(now.getDate()+persoOffset); ref.setHours(12,0,0,0); refEnd=ref; }
    else { const d=getWeekDates(persoOffset); ref=new Date(d[0]); ref.setHours(12,0,0,0); refEnd=new Date(d[6]); refEnd.setHours(12,0,0,0); }
    const Y=ref.getFullYear();
    const mon=d=>{const m=new Date(d);m.setHours(12,0,0,0);m.setDate(m.getDate()-(_pcDow(m)-1));return m;};
    const weeks=[]; let w=mon(new Date(Y,0,1,12));
    while(w.getFullYear()<=Y){ weeks.push(new Date(w)); w.setDate(w.getDate()+7); }
    const W=weeks.length, idxOf=d=>Math.round((mon(d)-weeks[0])/604800000);
    const MO=['JAN','FÉV','MARS','AVR','MAI','JUIN','JUIL','AOÛT','SEPT','OCT','NOV','DÉC'];
    const mOf=weeks.map(x=>{const t=new Date(x);t.setDate(t.getDate()+3);return t.getFullYear()===Y?t.getMonth():(t.getFullYear()<Y?0:11);});
    const nowI=idxOf(now), r0=idxOf(ref), r1=idxOf(refEnd);

    const list=(rows||[]).filter(c=>c.start_date&&c.end_date).slice().sort((a,b)=>a.start_date.localeCompare(b.start_date))
      .filter(c=>new Date(c.start_date+'T12:00:00').getFullYear()<=Y&&new Date(c.end_date+'T12:00:00').getFullYear()>=Y);
    const lanes=[];
    const placed=list.map(c=>{
      const a=Math.max(0,idxOf(new Date(c.start_date+'T12:00:00'))), b=Math.min(W-1,idxOf(new Date(c.end_date+'T12:00:00')));
      let lane=lanes.findIndex(e=>e<a); if(lane<0){lane=lanes.length;lanes.push(b);}else lanes[lane]=b;
      return {c,a,b,lane};
    }).filter(p=>p.b>=p.a);
    const L=Math.max(1,lanes.length);
    // case « + » après le dernier cycle
    const all=(rows||[]).filter(c=>c.end_date).sort((a,b)=>a.end_date.localeCompare(b.end_date));
    const last=all[all.length-1];
    let slot=null;
    { const nx=last?new Date(last.end_date+'T12:00:00'):new Date(now); if(last)nx.setDate(nx.getDate()+1);
      const a=idxOf(nx); if(a>=0&&a<W){ let ln=lanes.findIndex(e=>e<a); if(ln<0)ln=0; slot={a,b:Math.min(W-1,a+3),lane:ln}; } }

    let h=`<div style="display:grid;grid-template-columns:repeat(${W},34px);grid-template-rows:auto repeat(${L},auto);position:relative;min-width:max-content">`;
    for(let i=0;i<W;){ const m=mOf[i]; let j=i; while(j+1<W&&mOf[j+1]===m)j++;
      const cur=now.getFullYear()===Y&&now.getMonth()===m;
      h+=`<div style="grid-column:${i+1}/span ${j-i+1};grid-row:1;font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:1.2px;padding:0 6px 4px;border-left:1px solid var(--border2);color:${cur?'var(--accent)':'var(--muted)'};white-space:nowrap;overflow:hidden">${MO[m]}</div>`;
      i=j+1; }
    weeks.forEach((x,k)=>{
      const m1=k===0||mOf[k]!==mOf[k-1], inView=k>=r0&&k<=r1;
      h+=`<div title="Semaine du ${_pcFmt(_pcIso(x))}" style="grid-column:${k+1};grid-row:2/span ${L};border-left:${k===nowI?'2px solid var(--text)':'1px solid '+(m1?'var(--border2)':'var(--border)')};${inView?'background:rgba(255,255,255,.07);':''}position:relative;z-index:1;pointer-events:none"></div>`;
    });
    placed.forEach(p=>{
      const col=p.c.color||'#2dd4bf';
      h+=`<div data-cy="${p.c.id}" title="${_pcEsc(p.c.name)} · ${_pcFmt(p.c.start_date)} → ${_pcFmt(p.c.end_date)}" style="grid-column:${p.a+1}/span ${p.b-p.a+1};grid-row:${p.lane+2};margin:3px 1px;height:26px;border-radius:7px;background:${col};padding:0 7px;display:flex;align-items:center;cursor:pointer;position:relative;z-index:2;overflow:hidden">
        <span style="font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:1px;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_pcEsc(p.c.name)}</span></div>`;
    });
    if(slot)h+=`<div data-cy="" title="Programmer un cycle" style="grid-column:${slot.a+1}/span ${slot.b-slot.a+1};grid-row:${slot.lane+2};margin:3px 1px;height:26px;border-radius:7px;border:1.5px dashed var(--border2);color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;z-index:2">+</div>`;
    h+='</div>';

    box.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);flex:1">Cycles ${Y}</span></div>
      <div id="pc-frise-sc" style="overflow-x:auto;margin:0 -12px;padding:0 12px 4px">${h}</div>`;
    box.querySelectorAll('[data-cy]').forEach(el=>el.addEventListener('click',()=>openPersoCycles(el.dataset.cy||undefined)));
    const sc=document.getElementById('pc-frise-sc');
    const center=(t)=>{ if(!sc.clientWidth){ if(t<40)setTimeout(()=>center(t+1),250); return; }
      sc.scrollLeft=Math.max(0,(r0+0.5)*34-sc.clientWidth/2+12); };
    center(0);
  }

  async function _pcRenderBand(){
    const area=document.getElementById('perso-calendar-area');
    if(!area||!currentPersoAthlete)return;
    area.querySelectorAll('.pc-bar,.pc-cycle-row,.pc-day-banner').forEach(n=>n.remove());
    _pcInjectCss();

    const rows=await _pcLoad(currentPersoAthlete.id);
    try{ _pcRenderFrise(rows); }catch(e){ console.warn('frise cycles perso',e); }

    if(persoView==='week'){
      const dates=getWeekDates(persoOffset);
      const isos=dates.map(_pcIso);
      const cycles=isos.map(iso=>_pcForDate(rows,iso));
      const main=cycles.find(Boolean)||null;

      // barre d'entête
      const bar=document.createElement('div');
      bar.className='pc-bar';
      if(main){
        const wi=_pcWeekIndex(main,isos[0]);
        bar.style.borderLeftColor=main.color||'#2dd4bf';
        bar.innerHTML=`<div>
            <div class="pc-bar-name" style="color:${main.color||'#2dd4bf'}">${_pcEsc(main.name)}</div>
            <div class="pc-bar-meta">${_pcFmt(main.start_date)} → ${_pcFmt(main.end_date)}${wi?` · semaine ${wi.n}/${wi.total}`:''}</div>
          </div>
          <div class="pc-bar-spacer"></div>
          <button class="pc-bar-btn" onclick="openPersoCycles()">⚙ Gérer les cycles</button>`;
      }else{
        bar.style.borderLeftColor='var(--border2,#333)';
        bar.innerHTML=`<div class="pc-bar-meta">Aucun cycle sur cette semaine</div>
          <div class="pc-bar-spacer"></div>
          <button class="pc-bar-btn" onclick="openPersoCycles()">+ Programmer un cycle</button>`;
      }
      area.insertBefore(bar,area.firstChild);

      // ligne de priorités, alignée sur les colonnes jours
      const grids=area.querySelectorAll('.cal-grid');
      if(grids.length>=3){
        const row=document.createElement('div');
        row.className='cal-grid pc-cycle-row';
        row.innerHTML=dates.map((d,i)=>{
          const c=cycles[i];
          const txt=c?((c.days||{})[String(_pcDow(d))]||''):'';
          const col=c?(c.color||'#2dd4bf'):'#888';
          if(!c)return `<div class="pc-day empty" onclick="openPersoCycles()">—</div>`;
          if(!txt)return `<div class="pc-day empty" onclick="openPersoCycles('${c.id}')">+ priorité</div>`;
          return `<div class="pc-day" style="background:${col}1f;border-color:${col}55;color:${col}" onclick="openPersoCycles('${c.id}')" title="${_pcEsc(c.name)} — cliquer pour modifier">${_pcEsc(txt)}</div>`;
        }).join('');
        grids[1].insertAdjacentElement('afterend',row);
      }
    }

    else if(persoView==='day'){
      const d=new Date(); d.setDate(d.getDate()+persoOffset);
      const iso=_pcIso(d);
      const c=_pcForDate(rows,iso);
      if(!c)return;
      const txt=(c.days||{})[String(_pcDow(d))]||'';
      const col=c.color||'#2dd4bf';
      const wi=_pcWeekIndex(c,iso);
      const el=document.createElement('div');
      el.className='pc-day-banner';
      el.style.cssText=`background:${col}14;border-color:${col}44;border-left-color:${col};cursor:pointer`;
      el.onclick=()=>openPersoCycles(c.id);
      el.innerHTML=`<div style="flex:1;min-width:0">
          <div class="lbl" style="color:${col}">${_pcEsc(c.name)}${wi?` · sem. ${wi.n}/${wi.total}`:''}</div>
          <div class="val">${txt?_pcEsc(txt):'Pas de priorité ce jour'}</div>
        </div>
        <div class="pc-bar-meta">${_pcFmt(c.start_date)} → ${_pcFmt(c.end_date)}</div>`;
      const host=area.querySelector('.perso-day-view')||area;
      host.insertBefore(el,host.firstChild);
    }

    else if(persoView==='month'){
      const items=[...area.querySelectorAll('.perso-month-cell')].map(el=>{
        const m=(el.getAttribute('onclick')||'').match(/'(\d{4}-\d{2}-\d{2})'/);
        return {el,iso:m?m[1]:null};
      }).filter(x=>x.iso);
      if(!items.length)return;
      const inMonth=items.filter(x=>!x.el.classList.contains('other'));
      const first=(inMonth[0]||items[0]).iso, last=(inMonth[inMonth.length-1]||items[items.length-1]).iso;
      const vis=(rows||[]).filter(c=>c.start_date<=last&&c.end_date>=first)
        .sort((a,b)=>a.start_date.localeCompare(b.start_date));

      // légende des cycles du mois
      const bar=document.createElement('div');
      bar.className='pc-bar pc-month-bar';
      if(vis.length){
        bar.style.borderLeftColor=vis[0].color||'#2dd4bf';
        bar.innerHTML=`<div class="pc-m-legend">${vis.map(c=>{
            const col=c.color||'#2dd4bf';
            return `<div class="pc-m-leg" onclick="openPersoCycles('${c.id}')">
              <span class="sw" style="background:${col}"></span>
              <span><span class="pc-bar-name" style="color:${col}">${_pcEsc(c.name)}</span>
              <span class="pc-bar-meta">${_pcFmt(c.start_date)} → ${_pcFmt(c.end_date)}</span></span></div>`;
          }).join('')}</div>
          <div class="pc-bar-spacer"></div>
          <button class="pc-bar-btn" onclick="openPersoCycles()">⚙ Gérer les cycles</button>`;
      }else{
        bar.style.borderLeftColor='var(--border2,#333)';
        bar.innerHTML=`<div class="pc-bar-meta">Aucun cycle ce mois-ci</div>
          <div class="pc-bar-spacer"></div>
          <button class="pc-bar-btn" onclick="openPersoCycles()">+ Programmer un cycle</button>`;
      }
      const monthBox=area.querySelector('.perso-month');
      area.insertBefore(bar,monthBox||area.firstChild);

      // ruban de couleur + semaine du cycle + priorité du jour dans chaque case
      items.forEach(({el,iso})=>{
        el.querySelectorAll('.pc-m').forEach(n=>n.remove());
        const c=_pcForDate(rows,iso);
        if(!c)return;
        const col=c.color||'#2dd4bf';
        const d=new Date(iso+'T12:00:00');
        const dow=_pcDow(d);
        const isStart=iso===c.start_date||dow===1;
        const isEnd=iso===c.end_date||dow===7;
        el.classList.add('pc-m-on');
        el.style.background=`${col}12`;
        el.style.borderColor=`${col}40`;

        const rib=document.createElement('div');
        rib.className='pc-m pc-m-rib'+(isStart?' s':'')+(isEnd?' e':'');
        rib.style.background=col;
        el.insertBefore(rib,el.firstChild);

        if(dow===1||iso===c.start_date){
          const wi=_pcWeekIndex(c,iso);
          const num=el.querySelector('.num');
          if(wi&&num){
            const tag=document.createElement('span');
            tag.className='pc-m pc-m-wk';
            tag.style.color=col;
            tag.textContent=`S${wi.n}`;
            tag.title=`${c.name} — semaine ${wi.n}/${wi.total}`;
            num.appendChild(tag);
          }
        }

        const txt=(c.days||{})[String(dow)]||'';
        if(txt){
          const p=document.createElement('div');
          p.className='pc-m pc-m-prio';
          p.style.color=col;
          p.textContent=txt;
          p.title=`${c.name} — ${txt}`;
          const num=el.querySelector('.num');
          if(num)num.insertAdjacentElement('afterend',p);else el.appendChild(p);
        }
      });
    }
  }

  // ---------- modale de gestion ----------
  function _pcBuildModal(){
    if(document.getElementById('pc-modal'))return;
    _pcInjectCss();
    const m=document.createElement('div');
    m.id='pc-modal';
    m.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;align-items:center;justify-content:center;padding:12px';
    m.innerHTML=`<div class="pc-modal-box" id="pc-modal-inner"></div>`;
    document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target===m)_pcClose();});
  }
  function _pcClose(){ const m=document.getElementById('pc-modal'); if(m)m.style.display='none'; _pcEditing=null; }
  window.closePersoCycles=_pcClose;

  async function _pcRenderModal(focusDow){
    const box=document.getElementById('pc-modal-inner');
    if(!box||!currentPersoAthlete)return;
    const rows=await _pcLoad(currentPersoAthlete.id);

    // --- liste ---
    if(!_pcEditing){
      box.innerHTML=`
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;flex:1">🎯 Cycles — ${_pcEsc(currentPersoAthlete.full_name||currentPersoAthlete.email||'')}</div>
          <button class="pc-btn ghost" onclick="closePersoCycles()" style="padding:5px 10px">✕</button>
        </div>
        ${rows.length?rows.map(c=>{
          const col=c.color||'#2dd4bf';
          const n=Object.values(c.days||{}).filter(Boolean).length;
          return `<div class="pc-list-item" style="border-left-color:${col}" onclick="openPersoCycles('${c.id}')">
            <div style="flex:1;min-width:0">
              <div class="nm" style="color:${col}">${_pcEsc(c.name)}</div>
              <div class="dt">${_pcFmt(c.start_date)} → ${_pcFmt(c.end_date)} · ${n} jour${n>1?'s':''} programmé${n>1?'s':''}</div>
            </div>
            <div style="color:var(--muted,#999)">›</div>
          </div>`;
        }).join(''):`<div style="color:var(--muted,#999);font-size:13px;padding:14px 0;text-align:center">Aucun cycle pour le moment.</div>`}
        <button class="pc-btn" style="width:100%;margin-top:10px" onclick="persoCycleNew()">+ Nouveau cycle</button>`;
      return;
    }

    // --- formulaire ---
    const c=_pcEditing;
    const col=c.color||'#2dd4bf';
    box.innerHTML=`
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <button class="pc-btn ghost" onclick="persoCycleBack()" style="padding:5px 10px">‹</button>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;flex:1">${c.id?'Modifier le cycle':'Nouveau cycle'}</div>
        <button class="pc-btn ghost" onclick="closePersoCycles()" style="padding:5px 10px">✕</button>
      </div>

      <label class="pc-lbl">Nom du cycle</label>
      <input class="pc-in" id="pc-f-name" maxlength="60" placeholder="Ex : Cycle 1 — Force" value="${_pcEsc(c.name||'')}" style="margin-bottom:12px">

      <div style="display:flex;gap:10px;margin-bottom:12px">
        <div style="flex:1"><label class="pc-lbl">Début</label><input type="date" class="pc-in" id="pc-f-start" value="${c.start_date||''}"></div>
        <div style="flex:1"><label class="pc-lbl">Fin</label><input type="date" class="pc-in" id="pc-f-end" value="${c.end_date||''}"></div>
      </div>

      <label class="pc-lbl">Couleur</label>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap" id="pc-f-colors">
        ${PC_PRESET_COLORS.map(p=>`<div class="pc-swatch ${p===col?'on':''}" data-color="${p}" style="background:${p}"></div>`).join('')}
      </div>

      <label class="pc-lbl">Priorité par jour de la semaine</label>
      <div style="margin-bottom:16px">
        ${PC_DAYS.map((lbl,i)=>{
          const k=String(i+1);
          return `<div class="pc-row">
            <div class="d">${lbl}</div>
            <input class="pc-in pc-f-day" data-dow="${k}" maxlength="80" placeholder="—" value="${_pcEsc((c.days||{})[k]||'')}">
          </div>`;
        }).join('')}
      </div>

      <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap">
        ${c.id?`<button class="pc-btn danger" onclick="persoCycleDelete()">🗑 Supprimer</button>`:'<span></span>'}
        <button class="pc-btn" onclick="persoCycleSave()">💾 Enregistrer</button>
      </div>`;

    box.querySelectorAll('#pc-f-colors .pc-swatch').forEach(sw=>{
      sw.onclick=()=>{
        _pcEditing.color=sw.dataset.color;
        box.querySelectorAll('#pc-f-colors .pc-swatch').forEach(s=>s.classList.toggle('on',s===sw));
      };
    });
    if(focusDow){
      const inp=box.querySelector(`.pc-f-day[data-dow="${focusDow}"]`);
      if(inp)setTimeout(()=>{inp.focus();inp.select();},40);
    }
  }

  function _pcCollect(){
    const box=document.getElementById('pc-modal-inner');
    const days={};
    box.querySelectorAll('.pc-f-day').forEach(i=>{
      const v=(i.value||'').trim();
      if(v)days[i.dataset.dow]=v;
    });
    return {
      name:(document.getElementById('pc-f-name').value||'').trim()||'Cycle',
      start_date:document.getElementById('pc-f-start').value||null,
      end_date:document.getElementById('pc-f-end').value||null,
      color:_pcEditing.color||'#2dd4bf',
      days
    };
  }

  // ---------- API publique ----------
  window.openPersoCycles=async function(cycleId,focusDow){
    if(!currentPersoAthlete){_pcToast('⚠️ Aucun athlète sélectionné');return;}
    _pcBuildModal();
    const rows=await _pcLoad(currentPersoAthlete.id);
    _pcEditing=cycleId?JSON.parse(JSON.stringify(rows.find(c=>c.id===cycleId)||null)):null;
    document.getElementById('pc-modal').style.display='flex';
    await _pcRenderModal(focusDow);
  };

  window.persoCycleNew=function(){
    const mon=getWeekDates(persoOffset||0)[0];
    const end=new Date(mon); end.setDate(mon.getDate()+55); // 8 semaines par défaut
    _pcEditing={id:null,name:'',start_date:_pcIso(mon),end_date:_pcIso(end),color:PC_PRESET_COLORS[0],days:{}};
    _pcRenderModal();
  };

  window.persoCycleBack=function(){ _pcEditing=null; _pcRenderModal(); };

  window.persoCycleSave=async function(){
    if(!_pcEditing||!currentPersoAthlete)return;
    const p=_pcCollect();
    if(!p.start_date||!p.end_date){_pcToast('⚠️ Renseigne les dates de début et de fin');return;}
    if(p.end_date<p.start_date){_pcToast('⚠️ La date de fin est avant le début');return;}
    const payload={
      ...p,
      athlete_id:currentPersoAthlete.id,
      created_by:currentUser?.id||null,
      studio_id:(typeof getStudioId==='function'?getStudioId():null)
    };
    let error;
    if(_pcEditing.id){
      delete payload.created_by;
      ({error}=await sb.from('personal_cycles').update(payload).eq('id',_pcEditing.id));
    }else{
      ({error}=await sb.from('personal_cycles').insert(payload));
    }
    if(error){_pcToast('❌ '+error.message);return;}
    await _pcLoad(currentPersoAthlete.id,true);
    _pcAthRows=null;
    _pcEditing=null;
    _pcToast('✅ Cycle enregistré');
    await _pcRenderModal();
    _pcRenderBand();
  };

  window.persoCycleDelete=async function(){
    if(!_pcEditing?.id)return;
    if(!confirm('Supprimer ce cycle ?'))return;
    const {error}=await sb.from('personal_cycles').delete().eq('id',_pcEditing.id);
    if(error){_pcToast('❌ '+error.message);return;}
    await _pcLoad(currentPersoAthlete.id,true);
    _pcAthRows=null;
    _pcEditing=null;
    _pcToast('🗑 Cycle supprimé');
    await _pcRenderModal();
    _pcRenderBand();
  };

  // ---------- CÔTÉ ATHLÈTE : bandeau cycle dans l'onglet Espace perso ----------
  let _pcAthRows=null;

  async function _pcLoadMine(force){
    if(!currentUser)return [];
    if(!force && _pcAthRows)return _pcAthRows;
    const {data,error}=await sb.from('personal_cycles')
      .select('*').eq('athlete_id',currentUser.id).order('start_date',{ascending:false});
    if(error){ console.warn('personal_cycles (athlète)',error.message); return []; }
    _pcAthRows=data||[];
    return _pcAthRows;
  }

  async function _pcRenderAthlete(){
    const area=document.getElementById('sessions-area');
    if(!area||!currentUser)return;
    area.querySelectorAll('.pc-ath').forEach(n=>n.remove());
    _pcInjectCss();

    const _phase=window.__cyclePhase||{set(){},clear(){}};
    const rows=await _pcLoadMine();

    const todayIso=_pcIso(new Date());
    const refIso=(typeof selectedDate!=='undefined'&&selectedDate)?selectedDate:todayIso;
    // Sans cycle en cours, on affiche quand même le récap des blocs du jour
    // (seuls la phase du cycle et la note du jour dépendent d'un cycle).
    const c=rows.length?_pcForDate(rows,refIso):null;

    const col=(c&&c.color)||'#2dd4bf';
    const wi=_pcWeekIndex(c,refIso);
    const pct=wi?Math.max(4,Math.min(100,Math.round(wi.n/wi.total*100))):0;
    const dates=getWeekDates(typeof currentWeekOffset!=='undefined'?currentWeekOffset:0);
    const short=['L','M','M','J','V','S','D'];

    const week=dates.map((d,i)=>{
      const iso=_pcIso(d);
      const cy=_pcForDate(rows,iso);
      const txt=cy?((cy.days||{})[String(_pcDow(d))]||''):'';
      const sel=iso===refIso;
      const cellCol=cy?(cy.color||'#2dd4bf'):col;
      return `<div class="pc-ath-cell ${txt?'':'off'} ${sel?'on':''}" style="${txt?`background:${cellCol}1a;color:${cellCol}`:''}${sel?`;box-shadow:0 0 0 1px ${cellCol}`:''}">
        <div class="dd">${short[i]}${d.getDate()}</div>
        <div class="pp">${txt?_pcEsc(txt):'·'}</div>
      </div>`;
    }).join('');

    const refD=new Date(refIso+'T12:00:00');
    const focus=c?((c.days||{})[String(_pcDow(refD))]||''):'';
    const todayLbl=refIso===todayIso?"Aujourd'hui":`${PC_DAYS[_pcDow(refD)-1]} ${refD.getDate()}`;

    // récap des blocs du jour (séances perso de l'athlète)
    let blocksHtml='';
    try{
      const HIDE={warmup:1,mobility:1};
      const {data:blk}=await sb.from('personal_sessions').select('type,title,color,sort_order,created_at')
        .eq('athlete_id',currentUser.id).eq('date',refIso)
        .order('sort_order',{ascending:true,nullsFirst:false}).order('created_at');
      let list=(blk||[]).filter(b=>!HIDE[b.type]);
      // un séparateur seul (sans bloc après) n'est pas affiché
      list=list.filter((b,i)=>b.type!=='separator'||list.slice(i+1).some(x=>x.type!=='separator'));
      const lab=t=>(typeof TYPE_LABELS!=='undefined'&&TYPE_LABELS[t])||t||'';
      if(list.some(b=>b.type!=='separator')){
        blocksHtml='<div style="margin-top:8px">'+list.map(b=>{
          const bc=/^#[0-9a-f]{6}$/i.test(b.color||'')?b.color:col;
          if(b.type==='separator')return `<div style="display:flex;align-items:center;gap:8px;margin:8px 0 4px;font-size:9.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#2dd4bf">
            <i style="flex:1;height:1px;background:#2dd4bf55"></i><span>${_pcEsc(b.title||'Bloc supplémentaire')}</span><i style="flex:1;height:1px;background:#2dd4bf55"></i></div>`;
          return `<div style="display:flex;align-items:center;gap:10px;padding:4px 0">
            <span style="flex:0 0 auto;min-width:64px;text-align:center;font-size:9.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;padding:3px 8px;border-radius:6px;background:${bc}22;color:${bc}">${_pcEsc(lab(b.type))}</span>
            <span style="font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:1px;line-height:1.1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_pcEsc(b.title||lab(b.type))}</span></div>`;
        }).join('')+'</div>';
      }
    }catch(e){console.warn('blocs du jour',e);}

    area.querySelectorAll('.pc-ath').forEach(n=>n.remove());
    // la phase du cycle (nom, semaine, avancement) passe au-dessus des jours
    if(c){
      _phase.set({name:c.name,color:col,n:wi?wi.n:1,weeks:wi?wi.total:1,
        start:new Date(c.start_date+'T12:00:00'),end:new Date(c.end_date+'T12:00:00')});
    }else{
      _phase.clear();
    }
    if(!focus&&!blocksHtml)return;
    // récap du jour (sans grille des priorités) + « Note du jour » repliée, seulement si le coach a mis une priorité
    const note=focus?`<details style="margin:2px 0 6px;border:1px solid ${col}40;border-radius:9px;background:${col}0d">
        <summary style="list-style:none;cursor:pointer;padding:7px 10px;font-size:11.5px;font-weight:700;color:${col};display:flex;align-items:center;gap:6px">📝 Note du jour<span style="margin-left:auto;color:var(--muted);font-size:14px">›</span></summary>
        <div style="padding:0 10px 9px;font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px;color:${col}">${_pcEsc(focus)}</div>
      </details>`:'';
    const el=document.createElement('div');
    el.className='pc-ath';
    el.style.cssText='background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px 14px;margin-bottom:14px';
    el.innerHTML=`<div style="font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:6px">${todayLbl} · au programme</div>${note}${blocksHtml?blocksHtml.replace('<div style="margin-top:8px">','<div>'):''}`;
    const d=el.querySelector('details');
    if(d)d.addEventListener('toggle',()=>{const a=d.querySelector('summary span');if(a)a.textContent=d.open?'⌄':'›';});
    area.insertBefore(el,area.firstChild);
  }

  const _pcOrigPersoSessions=window.renderPersoSessions;
  if(typeof _pcOrigPersoSessions==='function'){
    window.renderPersoSessions=async function(...args){
      const r=await _pcOrigPersoSessions.apply(this,args);
      try{ await _pcRenderAthlete(); }catch(e){ console.warn('cycle athlète',e); }
      return r;
    };
  }

  // ---------- accroche sur le rendu du calendrier perso ----------
  const _pcOrigRender=window.renderPersoCalendar;
  if(typeof _pcOrigRender==='function'){
    window.renderPersoCalendar=async function(...args){
      const r=await _pcOrigRender.apply(this,args);
      try{ await _pcRenderBand(); }catch(e){ console.warn('cycles perso',e); }
      return r;
    };
  }

  // Vide le cache quand on change d'athlète
  const _pcOrigFiche=window.openPersoFiche;
  if(typeof _pcOrigFiche==='function'){
    window.openPersoFiche=async function(...args){
      _pcCache={athleteId:null,rows:null};
      return await _pcOrigFiche.apply(this,args);
    };
  }
})();
