// SESSIONS
function hasAccess(prog){
  if(!prog)return false;
  if(currentProfile?.role==='admin')return true;
  return myAccessIds.has(prog.id)||myAccess.has(prog.slug);
}

async function renderSessions(){
  if(!currentProg)return;
  const area=document.getElementById('sessions-area');
  if(!hasAccess(currentProg)){
    area.innerHTML=`<div class="locked-screen">
      <div class="locked-icon">🔒</div>
      <div class="locked-title">${currentProg.name}</div>
      <div class="locked-desc">Abonne-toi pour accéder à ce programme et voir la programmation complète.</div>
      <button class="btn-unlock" onclick="goPage('abos')">Voir les abonnements</button>
    </div>`;
    return;
  }

  area.innerHTML='<div class="spinner"></div>';
  // ONE-SHOT : selectedDate format "__wNdM" -> requête par week_number + day_of_week
  let sessionsQuery;
  if(isOneshotProg(currentProg)&&typeof selectedDate==='string'&&selectedDate.startsWith('__w')){
    const m=selectedDate.match(/^__w(\d+)d(\d+)$/);
    if(m){
      sessionsQuery=sb.from('sessions').select('*').eq('programme_id',currentProg.id)
        .eq('week_number',parseInt(m[1])).eq('day_of_week',parseInt(m[2]))
        .order('sort_order',{ascending:true,nullsFirst:false}).order('created_at');
    }
  }
  if(!sessionsQuery){
    sessionsQuery=sb.from('sessions').select('*').eq('programme_id',currentProg.id).eq('date',selectedDate).order('sort_order',{ascending:true,nullsFirst:false}).order('created_at');
  }
  const {data:sessions}=await sessionsQuery;
  if(!sessions||sessions.length===0){area.innerHTML='<div class="empty fade-up"><div class="empty-icon">🗓</div><p>Pas de séance<br>programmée ce jour.</p></div>';return;}
  area.innerHTML='';
  for(const s of sessions){
    if(s.type==='separator'){
      area.insertAdjacentHTML('beforeend',buildSeparatorCard(s));
    } else {
      area.insertAdjacentHTML('beforeend',await buildSessionCard(s));
    }
  }
}

async function buildSessionCard(s){
  // Multi-vidéos (avec fallback legacy)
  let _vids=[];
  try{_vids=Array.isArray(s.videos)?s.videos:(typeof s.videos==='string'?JSON.parse(s.videos):[]);}catch(e){_vids=[];}
  if((!_vids||!_vids.length)&&s.youtube_url){_vids=[{url:s.youtube_url,label:s.youtube_label||''}];}
  const videoHtml=_vids.length?`<div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">${_vids.map((v,i)=>`<a href="${v.url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(255,0,0,.1);border:1px solid rgba(255,0,0,.25);border-radius:10px;text-decoration:none;color:var(--text)">
    <span style="font-size:22px">▶️</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.label||'Voir la vidéo démo'}${_vids.length>1?` <span style="color:var(--muted);font-weight:400">· ${i+1}/${_vids.length}</span>`:''}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">Ouvrir sur YouTube</div>
    </div>
    <span style="margin-left:auto;color:var(--muted);font-size:16px">↗</span>
  </a>`).join('')}</div>`:'';
  const intensity=s.intensity;
  let intHtml='';
  if(intensity){const pct=intensity*10;const col=intensity<=4?'var(--blue)':intensity<=7?'var(--accent)':'var(--red)';intHtml=`<div class="intensity-bar"><div class="int-row"><span class="int-label">Intensité</span><span class="int-val" style="color:${col}">${intensity}/10</span></div><div class="int-track"><div class="int-fill" style="width:${pct}%;background:${col}"></div></div></div>`;}
  const targetHtml=s.target?`<div class="info-block"><div class="info-block-title"><span>🎯</span> Target</div><div class="info-block-text">${s.target}</div></div>`:'';
  const tipsHtml=s.tips?`<div class="info-block"><div class="info-block-title"><span>💡</span> Coaching Tips</div><div class="info-block-text">${s.tips}</div></div>`:'';

  // Scaling par niveau
  const scalingHtml=[
    s.scaling_inter?`<div class="scaling-block scaling-block-inter"><div class="scaling-label" style="color:var(--red)">Intermédiaire</div><div class="scaling-text">${s.scaling_inter}</div></div>`:'',
    s.scaling_scaled?`<div class="scaling-block scaling-block-scaled"><div class="scaling-label" style="color:var(--blue)">Scaled</div><div class="scaling-text">${s.scaling_scaled}</div></div>`:'',
    s.scaling_foundation?`<div class="scaling-block scaling-block-found"><div class="scaling-label" style="color:var(--purple)">Fondation</div><div class="scaling-text">${s.scaling_foundation}</div></div>`:''
  ].join('');

  const contentWithCharges=renderContentWithCharges(s.content||'');
  // Si contient du HTML (éditeur riche) afficher tel quel, sinon convertir les \n en <br>
  const isHtml=/<[a-z][\s\S]*>/i.test(contentWithCharges);
  const contentHtml=isHtml?contentWithCharges:contentWithCharges.replace(/\n/g,'<br>');
  const isStrength=s.type==='strength'&&s.sets>0;
  const isMulti=s.multi_score&&s.score_count>0;
  const isText=s.score_type==='text';
  const scoreLabels=s.score_labels?JSON.parse(s.score_labels):(s.score_label1?[s.score_label1,s.score_label2].filter(Boolean):[]);

  // Score input
  let scoreInputHtml='';
  if(isText){
    scoreInputHtml=`<div class="score-input-row"><textarea class="score-input" id="score-input-${s.id}" style="height:60px;resize:none;line-height:1.5;font-size:13px" placeholder="Décris ta séance, tes sensations..."></textarea></div>`;
  } else if(isStrength){
    const setsArr=Array.from({length:s.sets},(_,i)=>`<div class="set-row"><div class="set-label">Série ${i+1}</div><input class="set-input" id="set-${s.id}-${i}" type="number" step="0.5" min="0" placeholder="kg"></div>`).join('');
    scoreInputHtml=`<div class="sets-inputs">${setsArr}</div>`;
  } else if(isMulti){
    const count=s.score_count||scoreLabels.length||2;
    scoreInputHtml=`<div class="multi-score-inputs">
      ${Array.from({length:count},(_,i)=>`
        <div class="multi-score-row">
          <div class="multi-score-lbl">${scoreLabels[i]||`Score ${i+1}`}</div>
          <input class="multi-score-input" id="score-${i}-${s.id}" type="text" placeholder="${getScorePlaceholder(s.score_type)}">
        </div>`).join('')}
    </div>`;
  } else if(s.score_type==='time'){
    // Temps : champs minutes + secondes séparés + option WOD non terminé → reps réalisées
    scoreInputHtml=`<div class="rounds-inputs">
        <div class="rounds-field"><div class="rounds-lbl">Minutes</div><input class="score-input" id="time-min-${s.id}" type="number" inputmode="numeric" min="0" placeholder="14"></div>
        <div class="rounds-plus">:</div>
        <div class="rounds-field"><div class="rounds-lbl">Secondes</div><input class="score-input" id="time-sec-${s.id}" type="number" inputmode="numeric" min="0" max="59" placeholder="32"></div>
      </div>
      <input type="hidden" id="score-input-${s.id}">
      <label class="dnf-toggle"><input type="checkbox" id="dnf-${s.id}" onchange="onDnfToggle('${s.id}')"> <span>WOD non terminé</span></label>
      <div class="score-input-row dnf-reps-row" id="dnf-reps-row-${s.id}" style="display:none"><input class="score-input" id="dnf-reps-${s.id}" type="number" inputmode="numeric" placeholder="Reps réalisées"></div>`;
  } else if(s.score_type==='rounds'){
    // Rounds + Reps : 2 champs séparés
    scoreInputHtml=`<div class="rounds-inputs">
        <div class="rounds-field"><div class="rounds-lbl">Rounds</div><input class="score-input" id="rounds-${s.id}" type="number" inputmode="numeric" placeholder="12"></div>
        <div class="rounds-plus">+</div>
        <div class="rounds-field"><div class="rounds-lbl">Reps</div><input class="score-input" id="reps-${s.id}" type="number" inputmode="numeric" placeholder="5"></div>
      </div>`;
  } else {
    scoreInputHtml=`<div class="score-input-row"><input class="score-input" id="score-input-${s.id}" type="text" placeholder="${getScorePlaceholder(s.score_type)}"></div>`;
  }

  // Couleur de la séance
  const cardColor=s.color||'#e8ff47';

  // Nb de scores déjà enregistrés pour cette séance (head:true → on récupère juste le count)
  let scoreCount=0;
  try{
    const {count}=await sb.from('wod_scores').select('id',{count:'exact',head:true}).eq('session_id',s.id);
    scoreCount=count||0;
  }catch(e){}
  const scoreCountBadge=scoreCount>0
    ? `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 7px;margin-left:8px;border-radius:11px;background:${cardColor};color:${isLightColor(cardColor)?'#000':'#fff'};font-size:12px;font-weight:700;line-height:1">${scoreCount}</span>`
    : `<span style="margin-left:8px;font-size:12px;color:var(--muted);font-weight:500">· 0 score</span>`;

  return `<div class="session-card fade-up" id="sc-${s.id}" style="border-color:${cardColor}33">
    <div class="session-header" style="border-bottom-color:${cardColor}22">
      <span class="badge badge-${s.type}" style="background:${cardColor}18;color:${cardColor}">${TYPE_LABELS[s.type]||s.type}</span>
      <span style="font-size:12px;color:var(--muted)">${formatDate(s.date)}</span>
    </div>
    <div class="session-body">
      <div class="session-title">${s.title}</div>
      <div class="session-content">${contentHtml}</div>
      ${scalingHtml}
      ${intHtml}${targetHtml}${tipsHtml}${videoHtml}
      <div style="margin-top:16px">
        <div class="score-title" style="margin-bottom:8px">📊 Mon score</div>
        <div class="level-selector">
          <button class="level-btn rx active" onclick="selectLevel('${s.id}','rx',this)">RX</button>
          <button class="level-btn inter" onclick="selectLevel('${s.id}','intermediate',this)">INTER</button>
          <button class="level-btn scaled" onclick="selectLevel('${s.id}','scaled',this)">SCALED</button>
          <button class="level-btn found" onclick="selectLevel('${s.id}','foundation',this)">FOND.</button>
        </div>
        ${scoreInputHtml}
        <div class="score-done-at-row" style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;color:var(--muted)">
          <label for="done-at-${s.id}" style="white-space:nowrap">Fait le</label>
          <input type="date" id="done-at-${s.id}" value="${s.date||''}" max="${new Date().toISOString().slice(0,10)}" style="flex:1;background:var(--card2);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:12px">
        </div>
        <button class="btn-score" style="width:100%;margin-top:6px;background:${cardColor};color:${isLightColor(cardColor)?'#000':'#fff'}" onclick="submitScore('${s.id}','${s.score_type||'reps'}',${!!isStrength},${s.sets||0},${!!isMulti},${isText?'true':'false'},${s.score_count||0})">✓ Valider</button>
      </div>
      <button class="btn-open-scores" onclick="openScoresModal('${s.id}','${s.score_type||'reps'}',${s.sets||0})">
        🏆 Voir le classement${scoreCountBadge}
      </button>
    </div>
  </div>`;
}

function buildSeparatorCard(s){
  return`<div class="separator-block">
    <div class="separator-line"></div>
    <div class="separator-title">${s.title||'—'}</div>
    <div class="separator-line"></div>
  </div>`;
}

// CALCUL AUTOMATIQUE DES CHARGES & ALLURES
function _kmhToPaceStr(kmh){
  if(!kmh||kmh<=0)return '';
  const secPerKm=3600/kmh;
  const m=Math.floor(secPerKm/60);
  const s=Math.round(secPerKm%60);
  return `${m}:${String(s).padStart(2,'0')}/km`;
}
function _formatChargeForMovement(mvt,bestPR,pct){
  // Détermine le mode (number/time/rounds/run) et calcule la valeur cible à pct%
  const fmt=bestPR?.format||null;
  const mode=getPRModeFor(mvt,fmt);
  if(mode==='run'){
    // bestPR.value stocké en km/h
    const targetKmh=Math.round((parseFloat(pct)/100)*bestPR.value*10)/10;
    const pace=_kmhToPaceStr(targetKmh);
    return `${targetKmh} km/h <span style="opacity:.7">(${pace})</span>`;
  }
  if(mode==='watt'){
    const target=Math.round((parseFloat(pct)/100)*bestPR.value);
    return `${target} W`;
  }
  if(mode==='time'){
    // bestPR.value en secondes — % du temps n'a pas de sens classique → on l'applique quand même
    const target=Math.round((parseFloat(pct)/100)*bestPR.value);
    return formatPRValue(target,'time');
  }
  if(mode==='rounds'){
    const r=Math.floor(bestPR.value/1000);
    const reps=bestPR.value%1000;
    const total=r*1000+reps;
    const targetTotal=Math.round((parseFloat(pct)/100)*total);
    return formatPRValue(targetTotal,'rounds');
  }
  // mode number — utilise l'unité du mouvement
  const unit=mvt.unit||'kg';
  const charge=Math.round((parseFloat(pct)/100)*bestPR.value*2)/2;
  return `${charge}${unit}`;
}
function renderContentWithCharges(content){
  // 2 syntaxes acceptées :
  //   80%|BACKSQUAT|     ← nouvelle (préférée)
  //   @80%[BackSquat]    ← ancienne (rétro-compat)
  let out=content||'';
  // Syntaxe 1 : NN%|NOM|  ou  NN.5%|NOM|
  out=out.replace(/(\d+(?:\.\d+)?)%\|([^|]+)\|/g,(match,pct,mvtName)=>{
    const pr=findPRByName(mvtName.trim());
    const mvt=findMovementByName(mvtName.trim());
    if(pr&&mvt){
      const charge=_formatChargeForMovement(mvt,pr,pct);
      return `<span style="color:var(--muted)">${pct}%</span> <span style="background:rgba(232,255,71,.15);color:var(--accent);padding:1px 7px;border-radius:5px;font-weight:700;font-size:13px">${charge}</span>`;
    }
    return `${pct}%|${mvtName}|`;
  });
  // Syntaxe 2 (rétro-compat)
  out=out.replace(/(@\s*(\d+(?:\.\d+)?)%\s*\[([^\]]+)\])/gi,(match,full,pct,mvtName)=>{
    const pr=findPRByName(mvtName.trim());
    const mvt=findMovementByName(mvtName.trim());
    if(pr&&mvt){
      const charge=_formatChargeForMovement(mvt,pr,pct);
      return `<span style="color:var(--muted)">@ ${pct}%</span> <span style="background:rgba(232,255,71,.15);color:var(--accent);padding:1px 7px;border-radius:5px;font-weight:700;font-size:13px">${charge}</span>`;
    }
    return `@ ${pct}%`;
  });
  return out;
}

function findMovementByName(name){
  if(!movements||movements.length===0)return null;
  const norm=name.toLowerCase().replace(/\s+/g,'');
  // 1) Match exact normalisé (Squat Clean === SQUAT CLEAN === squatclean)
  const exact=movements.find(m=>m.name.toLowerCase().replace(/\s+/g,'')===norm);
  if(exact)return exact;
  // 2) Match par "mots" : tous les mots de la recherche doivent apparaître
  //    comme mots dans le mouvement (évite que "Squat Clean" tombe sur "Clean").
  const queryWords=name.toLowerCase().trim().split(/\s+/).filter(Boolean);
  let best=null,bestScore=-1;
  for(const m of movements){
    const mn=m.name.toLowerCase().replace(/\s+/g,'');
    const mWords=m.name.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let score=-1;
    // a) Tous les mots de la query sont dans le mouvement
    if(queryWords.every(w=>mWords.includes(w))){
      // Bonus pour les noms les plus spécifiques (le plus de mots match)
      // et pénalité légère pour les mots en trop côté mouvement
      score=1000+queryWords.length*10-(mWords.length-queryWords.length);
    } else if(mn===norm){
      score=900;
    } else if(mn.includes(norm)||norm.includes(mn)){
      // Fallback flou : on garde le candidat dont le nom est le plus long
      // (= le plus spécifique). "Squat Clean" (11) gagne sur "Clean" (5).
      score=mn.length;
    }
    if(score>bestScore){bestScore=score;best=m;}
  }
  return best;
}

function findPRByName(name){
  const mv=findMovementByName(name);
  if(!mv)return null;
  const prs=myPRs[mv.id]||[];
  return prs[0]||null;
}

function selectLevel(sessionId,level,btn){
  const card=document.getElementById(`sc-${sessionId}`);
  card.querySelectorAll('.level-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  btn.dataset.level=level;
}
function getSelectedLevel(sessionId){
  const card=document.getElementById(`sc-${sessionId}`);
  const active=card?.querySelector('.level-btn.active');
  if(!active)return'rx';
  if(active.classList.contains('rx'))return'rx';
  if(active.classList.contains('inter'))return'intermediate';
  if(active.classList.contains('scaled'))return'scaled';
  return'foundation';
}

async function loadScores(sessionId,scoreType,sets){
  const {data}=await sb.from('wod_scores').select('*,profiles(full_name)').eq('session_id',sessionId);
  const el=document.getElementById(`scores-${sessionId}`);
  if(!el)return;
  if(!data||data.length===0){el.innerHTML='<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px">Sois le premier à scorer !</div>';return;}

  // Sort: RX first, then intermediate, scaled, foundation, then by score
  const levelOrder={rx:0,intermediate:1,scaled:2,foundation:3};
  const sorted=[...data].sort((a,b)=>{
    if(levelOrder[a.level]!==levelOrder[b.level])return levelOrder[a.level]-levelOrder[b.level];
    return(b.score_value||0)-(a.score_value||0);
  });

  const rankIcons=['gold','silver','bronze'];
  el.innerHTML=sorted.map((sc,i)=>{
    const isMe=sc.athlete_id===currentUser?.id;
    const setsDetail=sc.sets_data?JSON.parse(typeof sc.sets_data==='string'?sc.sets_data:JSON.stringify(sc.sets_data)):null;
    const setsHtml=setsDetail?`<div class="score-sets-detail">${setsDetail.map(s=>`S${s.set}: ${s.value}kg`).join(' · ')}</div>`:'';
    return `<div class="score-row" style="${isMe?'border:1px solid rgba(232,255,71,.2)':''}" id="sr-${sc.id}">
      <div class="score-rank ${rankIcons[i]||''}">${i+1}</div>
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="score-name">${sc.profiles?.full_name||'Athlète'}${isMe?' 👈':''}</span>
          <span class="level-badge lbadge-${sc.level}">${LEVEL_LABELS[sc.level]||sc.level}</span>
        </div>
        ${setsHtml}
      </div>
      <div style="text-align:right">
        <div class="score-val">${sc.score_text||sc.score_value||'—'}</div>
      </div>
    </div>
    <div class="score-actions">
      <button class="react-btn" id="react-${sc.id}" onclick="toggleReaction('${sc.id}')" oncontextmenu="showLikers('${sc.id}',event);return false"><span class="heart">🤍</span> <span id="react-count-${sc.id}">0</span></button>
      <button class="react-btn comment-btn" onclick="toggleComments('${sc.id}')">💬 Commenter</button>
    </div>
    <div class="comments-area" id="comments-${sc.id}">
      <div id="comments-list-${sc.id}"></div>
      <div class="comment-input-row">
        <input class="comment-input" id="comment-input-${sc.id}" placeholder="Écris un commentaire...">
        <button class="btn-comment-send" onclick="sendComment('${sc.id}')">↑</button>
      </div>
    </div>`;
  }).join('');

  // Load reactions & comments
  for(const sc of sorted){
    loadReactions(sc.id);
    loadComments(sc.id);
  }
}

async function submitScore(sessionId,scoreType,isStrength,sets,isMulti,isText,scoreCount){
  let scoreText='',scoreValue=0,setsData=null;
  const level=getSelectedLevel(sessionId);

  if(isText){
    const input=document.getElementById(`score-input-${sessionId}`);
    scoreText=input?.value?.trim()||input?.innerText?.trim()||'';
    if(!scoreText){showToast('⚠️ Entre ton retour');return;}
    scoreValue=0;
  } else if(isStrength&&sets>0){
    const setValues=[];
    for(let i=0;i<sets;i++){
      const v=parseFloat(document.getElementById(`set-${sessionId}-${i}`)?.value||0);
      setValues.push({set:i+1,value:v});
    }
    const maxVal=Math.max(...setValues.map(s=>s.value));
    scoreValue=maxVal;
    scoreText=setValues.map(s=>`S${s.set}:${s.value}kg`).join(' / ');
    setsData=setValues;
  } else if(isMulti&&scoreCount>0){
    const values=[];
    for(let i=0;i<scoreCount;i++){
      const v=document.getElementById(`score-${i}-${sessionId}`)?.value.trim();
      if(v)values.push(v);
    }
    if(!values.length){showToast('⚠️ Entre au moins un score');return;}
    scoreText=values.join(' | ');
    scoreValue=parseFloat(values[0])||0;
  } else if(scoreType==='time'){
    const dnf=document.getElementById(`dnf-${sessionId}`)?.checked;
    const mins=parseInt(document.getElementById(`time-min-${sessionId}`)?.value)||0;
    const secs=parseInt(document.getElementById(`time-sec-${sessionId}`)?.value)||0;
    if(dnf){
      const reps=parseInt(document.getElementById(`dnf-reps-${sessionId}`)?.value)||0;
      if(!reps){showToast('⚠️ Entre le nombre de reps réalisées');return;}
      scoreText=`DNF · ${reps} reps`;
      scoreValue=-1000+reps;
    } else {
      if(!mins&&!secs){showToast('⚠️ Entre ton temps (min/sec)');return;}
      const ss=String(secs).padStart(2,'0');
      scoreText=`${mins}:${ss}`;
      scoreValue=mins*60+secs;
    }
  } else if(scoreType==='rounds'){
    const rounds=parseInt(document.getElementById(`rounds-${sessionId}`)?.value)||0;
    const reps=parseInt(document.getElementById(`reps-${sessionId}`)?.value)||0;
    if(!rounds&&!reps){showToast('⚠️ Entre rounds + reps');return;}
    scoreText=`${rounds} + ${reps}`;
    // pour le tri : rounds*1000 + reps (assume max 999 reps/round)
    scoreValue=rounds*1000+reps;
  } else {
    const input=document.getElementById(`score-input-${sessionId}`);
    scoreText=input?.value.trim();
    if(!scoreText){showToast('⚠️ Entre ton score');return;}
    scoreValue=parseFloat(scoreText.replace(':','').replace('+',''))||0;
  }

  // Date "fait le" choisie par l'athlète (défaut = date programmée de la séance)
  const doneAtEl=document.getElementById(`done-at-${sessionId}`);
  let doneAt=doneAtEl?.value||null;
  // Sécurité : pas de date future
  if(doneAt){
    const todayIso=new Date().toISOString().slice(0,10);
    if(doneAt>todayIso)doneAt=todayIso;
  }

  const payload={
    session_id:sessionId,athlete_id:currentUser.id,
    score_type:scoreType,score_value:scoreValue,score_text:scoreText,
    level,sets_data:setsData?JSON.stringify(setsData):null
  };
  if(doneAt)payload.done_at=doneAt;

  const {error}=await sb.from('wod_scores').upsert(payload,{onConflict:'session_id,athlete_id'});

  if(error){
    // Si la colonne done_at n'existe pas encore, on retry sans
    if(/done_at/.test(error.message||'')){
      delete payload.done_at;
      const r=await sb.from('wod_scores').upsert(payload,{onConflict:'session_id,athlete_id'});
      if(r.error){showToast('❌ '+r.error.message);return;}
    } else {
      showToast('❌ '+error.message);return;
    }
  }
  showToast('✅ Score enregistré !');
  if(currentScoresSession?.sessionId===sessionId){
    await renderScoresModal(sessionId,scoreType,sets);
  }
}

// SCORES MODAL
let currentScoresSession=null;

window._leaderboardGender='all';
function setLeaderboardGender(g){
  window._leaderboardGender=g;
  document.querySelectorAll('.cls-gtab').forEach(b=>b.classList.toggle('active',b.dataset.g===g));
  if(currentScoresSession){
    renderScoresModal(currentScoresSession.sessionId,currentScoresSession.scoreType,currentScoresSession.sets);
  }
}

async function openScoresModal(sessionId, scoreType, sets){
  currentScoresSession={sessionId, scoreType, sets};
  document.getElementById('smodal-title').textContent='🏆 Classement';
  document.getElementById('smodal-sub').textContent='Résultats de la séance';
  document.getElementById('session-note-input').value='';
  document.getElementById('scores-modal').classList.add('open');
  await renderScoresModal(sessionId, scoreType, sets);
  loadSessionNotes(sessionId);
}

function closeScoresModal(){
  document.getElementById('scores-modal').classList.remove('open');
  currentScoresSession=null;
}

async function renderScoresModal(sessionId, scoreType, sets){
  const el=document.getElementById('smodal-leaderboard');
  el.innerHTML='<div class="spinner"></div>';
  const [scoresRes, notesRes] = await Promise.all([
    sb.from('wod_scores').select('*,profiles(full_name,gender,avatar_url)').eq('session_id',sessionId),
    sb.from('session_notes').select('*,profiles(full_name)').eq('session_id',sessionId).order('created_at',{ascending:false})
  ]);
  const data=scoresRes.data;
  const allNotes=notesRes.data||[];

  if(!data||data.length===0){
    el.innerHTML='<div class="empty"><div class="empty-icon">📋</div><p>Pas encore de scores.</p></div>';
    return;
  }

  // Filtre genre (Homme / Femme / Tous)
  const g=window._leaderboardGender||'all';
  let filtered=data;
  if(g!=='all'){
    filtered=data.filter(d=>{
      const gv=(d.profiles?.gender||'').toLowerCase();
      if(g==='male')return gv==='male'||gv==='m'||gv==='homme';
      if(g==='female')return gv==='female'||gv==='f'||gv==='femme';
      return true;
    });
  }

  if(filtered.length===0){
    el.innerHTML='<div class="empty"><div class="empty-icon">👥</div><p>Aucun score pour ce genre.</p><p style="font-size:11px;color:var(--muted);margin-top:4px">Définis le genre dans le profil athlète pour activer le filtre.</p></div>';
    return;
  }

  // notes par athlète : on garde la plus récente
  const noteByAth={};
  allNotes.forEach(n=>{if(!noteByAth[n.athlete_id])noteByAth[n.athlete_id]=n;});

  const levelOrder={rx:0,intermediate:1,scaled:2,foundation:3};
  // Tri intelligent par type de score
  // - time : ASC (lowest = best), DNF (score_value < 0) toujours en bas, triés par reps DESC
  // - tous les autres : DESC
  const isTime = scoreType==='time';
  const sorted=[...filtered].sort((a,b)=>{
    if(levelOrder[a.level]!==levelOrder[b.level])return levelOrder[a.level]-levelOrder[b.level];
    if(isTime){
      const aDnf=(a.score_value||0)<0, bDnf=(b.score_value||0)<0;
      if(aDnf!==bDnf)return aDnf?1:-1; // DNF en bas
      if(aDnf&&bDnf)return (b.score_value||0)-(a.score_value||0); // plus de reps = mieux
      return (a.score_value||Infinity)-(b.score_value||Infinity); // moins de temps = mieux
    }
    return(b.score_value||0)-(a.score_value||0);
  });

  const rankIcons=['gold','silver','bronze'];
  el.innerHTML=`<div class="scores-list">
    ${sorted.map((sc,i)=>{
      const isMe=sc.athlete_id===currentUser?.id;
      const setsDetail=sc.sets_data?JSON.parse(typeof sc.sets_data==='string'?sc.sets_data:JSON.stringify(sc.sets_data)):null;
      const setsHtml=setsDetail?`<div class="score-sets-detail">${setsDetail.map(s=>`S${s.set}: ${s.value}kg`).join(' · ')}</div>`:'';
      const isDnf=isTime&&(sc.score_value||0)<0;
      const note=noteByAth[sc.athlete_id];
      const noteHtml=note?`<div class="score-note-attached"><div class="nlbl">📝 Note de séance</div><div class="nctt">${escapeHtml(note.content)}</div></div>`:'';
      // affichage score : si DNF → "DNF" en grand + reps en dessous ; sinon score_text classique
      let scoreDisplay;
      if(isDnf){
        const reps=(sc.score_value||0)+1000;
        scoreDisplay=`<div class="score-val">DNF</div><div class="score-val-sub">${reps} reps</div>`;
      } else {
        scoreDisplay=`<div class="score-val">${sc.score_text||sc.score_value||'—'}</div>`;
      }
      return `<div>
        <div class="score-row ${isDnf?'score-row-dnf':''}" style="${isMe?'border:1px solid rgba(232,255,71,.2)':''}" id="sr-${sc.id}">
          <div class="score-rank ${!isDnf?(rankIcons[i]||''):''}">${i+1}</div>
          ${avatarHtml(sc.profiles)}
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span class="score-name">${sc.profiles?.full_name||'Athlète'}${isMe?' 👈':''}</span>
              <span class="level-badge lbadge-${sc.level}">${LEVEL_LABELS[sc.level]||sc.level}</span>
            </div>
            ${setsHtml}
          </div>
          <div style="text-align:right">${scoreDisplay}</div>
        </div>
        ${noteHtml}
        <div class="score-actions">
          <button class="react-btn" id="react-${sc.id}" onclick="toggleReactionModal('${sc.id}')" oncontextmenu="showLikers('${sc.id}',event);return false"><span class="heart">🤍</span> <span id="react-count-${sc.id}" onclick="showLikers('${sc.id}',event)" style="cursor:pointer">0</span></button>
          <button class="react-btn comment-btn" onclick="toggleComments('${sc.id}')">💬 Commenter</button>
          ${isMe?`<button class="react-btn" onclick="deleteOwnScore('${sc.id}')" title="Supprimer" style="margin-left:auto;color:var(--red)">🗑️</button>`:''}
        </div>
        <div class="comments-area" id="comments-${sc.id}">
          <div id="comments-list-${sc.id}"></div>
          <div class="comment-input-row">
            <input class="comment-input" id="comment-input-${sc.id}" placeholder="Écris un commentaire...">
            <button class="btn-comment-send" onclick="sendComment('${sc.id}')">↑</button>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  for(const sc of sorted){loadReactions(sc.id);loadComments(sc.id);}
}

async function toggleReactionModal(scoreId){
  await toggleReaction(scoreId);
  if(currentScoresSession)loadReactions(scoreId);
}

// REACTIONS
async function loadReactions(scoreId){
  const {data,count}=await sb.from('score_reactions').select('athlete_id,profiles(full_name)',{count:'exact'}).eq('score_id',scoreId);
  const countEl=document.getElementById(`react-count-${scoreId}`);
  const btn=document.getElementById(`react-${scoreId}`);
  if(countEl)countEl.textContent=count||0;
  if(btn){
    const names=(data||[]).map(r=>r.profiles?.full_name||'Athlète');
    btn.dataset.likers=JSON.stringify(names);
    btn.title=names.length?'❤️ '+names.join(', '):'';
    if(currentUser){
      const liked=(data||[]).some(r=>r.athlete_id===currentUser.id);
      btn.classList.toggle('liked',liked);
      const heart=btn.querySelector('.heart');
      if(heart)heart.textContent=liked?'❤️':'🤍';
    }
  }
}
function showLikers(scoreId,ev){
  if(ev){ev.stopPropagation();ev.preventDefault();}
  const btn=document.getElementById(`react-${scoreId}`);
  if(!btn)return;
  let names=[];
  try{names=JSON.parse(btn.dataset.likers||'[]');}catch(e){}
  if(!names.length){showToast('Personne n\'a encore liké');return;}
  showToast('❤️ '+names.join(', '));
}
async function toggleReaction(scoreId){
  const btn=document.getElementById(`react-${scoreId}`);
  if(!btn||!currentUser)return;
  // Lock anti-double-clic (l'aller-retour DB peut prendre 200-500ms en 4G)
  if(btn.dataset.pending==='1')return;
  btn.dataset.pending='1';
  btn.disabled=true;
  const wasLiked=btn.classList.contains('liked');
  const countEl=document.getElementById(`react-count-${scoreId}`);
  const heart=btn.querySelector('.heart');
  const prevCount=parseInt(countEl?.textContent||'0',10)||0;
  // === UI OPTIMISTE : on bascule l'état immédiatement ===
  const nextLiked=!wasLiked;
  btn.classList.toggle('liked',nextLiked);
  if(heart)heart.textContent=nextLiked?'❤️':'🤍';
  if(countEl)countEl.textContent=Math.max(0,prevCount+(nextLiked?1:-1));
  // Animation cœur uniquement quand on ajoute un like
  if(nextLiked){
    btn.classList.remove('pop');
    void btn.offsetWidth; // reflow pour rejouer l'animation
    btn.classList.add('pop');
    setTimeout(()=>btn.classList.remove('pop'),450);
  }
  // === Sync DB en arrière-plan ===
  let dbErr=null;
  if(wasLiked){
    const {error}=await sb.from('score_reactions').delete().eq('score_id',scoreId).eq('athlete_id',currentUser.id);
    dbErr=error;
  } else {
    const {error}=await sb.from('score_reactions').insert({score_id:scoreId,athlete_id:currentUser.id});
    // L'erreur 23505 (doublon) = like déjà présent côté serveur, on l'ignore : l'état optimiste est correct
    if(error&&error.code!=='23505')dbErr=error;
  }
  btn.dataset.pending='';
  btn.disabled=false;
  if(dbErr){
    // Revert UI
    btn.classList.toggle('liked',wasLiked);
    if(heart)heart.textContent=wasLiked?'❤️':'🤍';
    if(countEl)countEl.textContent=prevCount;
    showToast('❌ '+dbErr.message);
    return;
  }
  // Resync silencieuse pour récupérer la liste à jour des likers (tooltip / showLikers)
  loadReactions(scoreId);
}

async function deleteOwnScore(scoreId){
  if(!confirm('Supprimer définitivement ce score ?'))return;
  const {error}=await sb.from('wod_scores').delete().eq('id',scoreId).eq('athlete_id',currentUser.id);
  if(error){showToast('❌ '+error.message);return;}
  showToast('🗑️ Score supprimé');
  if(currentScoresSession)await renderScoresModal(currentScoresSession.sessionId,currentScoresSession.scoreType,currentScoresSession.sets);
}

async function deleteOwnSessionNote(){
  if(!currentScoresSession||!currentUser)return;
  if(!confirm('Supprimer ta note de séance ?'))return;
  const {error}=await sb.from('session_notes').delete().eq('session_id',currentScoresSession.sessionId).eq('athlete_id',currentUser.id);
  if(error){showToast('❌ '+error.message);return;}
  const ta=document.getElementById('session-note-input');if(ta)ta.value='';
  showToast('🗑️ Note supprimée');
  await renderScoresModal(currentScoresSession.sessionId,currentScoresSession.scoreType,currentScoresSession.sets);
}

// COMMENTS
function toggleComments(scoreId){
  const area=document.getElementById(`comments-${scoreId}`);
  area?.classList.toggle('open');
  if(area?.classList.contains('open'))loadComments(scoreId);
}
async function loadComments(scoreId){
  const {data}=await sb.from('score_comments').select('*,profiles(full_name)').eq('score_id',scoreId).order('created_at');
  const listEl=document.getElementById(`comments-list-${scoreId}`);
  if(!listEl)return;
  if(!data||data.length===0){listEl.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px 0">Pas encore de commentaire.</div>';return;}
  listEl.innerHTML=data.map(c=>{
    const isMine=c.athlete_id===currentUser?.id;
    const delBtn=isMine?`<button onclick="deleteComment('${c.id}','${scoreId}')" title="Supprimer" style="background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:12px;margin-left:6px;opacity:.6">🗑️</button>`:'';
    return `<div class="comment-item" style="display:flex;align-items:flex-start;gap:6px">
      <div style="flex:1;min-width:0">
        <div class="comment-author">${c.profiles?.full_name||'Athlète'}</div>
        <div class="comment-text">${escapeHtml(c.content||'')}</div>
      </div>
      ${delBtn}
    </div>`;
  }).join('');
}
async function deleteComment(commentId,scoreId){
  if(!confirm('Supprimer ce commentaire ?'))return;
  const {error}=await sb.from('score_comments').delete().eq('id',commentId).eq('athlete_id',currentUser.id);
  if(error){showToast('❌ '+error.message);return;}
  loadComments(scoreId);
}
async function sendComment(scoreId){
  const input=document.getElementById(`comment-input-${scoreId}`);
  const content=input?.value.trim();
  if(!content)return;
  await sb.from('score_comments').insert({score_id:scoreId,athlete_id:currentUser.id,content});
  input.value='';
  loadComments(scoreId);
  const area=document.getElementById(`comments-${scoreId}`);
  if(!area?.classList.contains('open'))area?.classList.add('open');
}

// PR
async function loadMovements(){const {data}=await sb.from('movements').select('*').eq('is_active',true).order('name');movements=data||[];}
async function loadMyPRs(){
  if(!currentUser)return;
  const {data}=await sb.from('athlete_prs').select('*').eq('athlete_id',currentUser.id).order('recorded_at',{ascending:false});
  myPRs={};
  (data||[]).forEach(pr=>{if(!myPRs[pr.movement_id])myPRs[pr.movement_id]=[];myPRs[pr.movement_id].push(pr);});
  if(document.getElementById('page-pr')?.classList.contains('active'))renderAll();
}
function filterCat(cat,btn){currentCat=cat;document.querySelectorAll('.cat-btn[data-cat]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderAll();}
function filterAll(){searchQuery=document.getElementById('pr-search-input').value.toLowerCase();renderAll();}
function filterMovements(){renderAll();}

const BENCH_CATS=['girl','test','hero','custom'];

function renderAll(){
  const list=document.getElementById('movements-list');
  const isBenchCat=BENCH_CATS.includes(currentCat);
  const isAll=currentCat==='all';

  let html='';

  // --- MOUVEMENTS ---
  // Helper: render a single movement (returns HTML string)
  const renderMovementCard=(m)=>{
    const prs=myPRs[m.id]||[];
    const formats=[...new Set((m.available_formats||'').split(',').map(f=>f.trim()).filter(Boolean))];
    if(formats.length>0){
      // Une seule carte par mouvement : on affiche le PR du format primaire (1RM si présent, sinon le 1er format)
      // FALLBACK : si le format primaire n'a pas de PR mais qu'un autre format en a, on affiche celui-là.
      const primary=formats.find(f=>/^1\s*RM$/i.test(f))||formats[0];
      // Normalise la comparaison (casse + espaces) + traite les PR sans format comme appartenant au primaire
      const _norm=s=>(s||'').toString().trim().toLowerCase().replace(/\s+/g,'');
      const matchFmt=(prFmt,targetFmt)=>{
        const pn=_norm(prFmt);
        const tn=_norm(targetFmt);
        // PR sans format → on l'attribue au format primaire (legacy)
        if(!pn)return _norm(targetFmt)===_norm(primary);
        return pn===tn;
      };
      let displayFmt=primary;
      let primaryPRs=prs.filter(p=>matchFmt(p.format,primary));
      if(primaryPRs.length===0){
        // Cherche le format renseigné le plus récent
        const filledFmt=formats
          .map(f=>{const fp=prs.filter(p=>matchFmt(p.format,f));return fp.length?{f,last:fp.reduce((a,b)=>((a.recorded_at||'')>(b.recorded_at||'')?a:b)).recorded_at||''}:null;})
          .filter(Boolean)
          .sort((a,b)=>(b.last||'').localeCompare(a.last||''))[0];
        if(filledFmt){displayFmt=filledFmt.f;primaryPRs=prs.filter(p=>matchFmt(p.format,displayFmt));}
      }
      const mode=getPRModeFor(m,displayFmt);
      // Compteur : nombre de formats avec au moins 1 PR
      const filledFmts=formats.filter(f=>prs.some(p=>matchFmt(p.format,f))).length;
      const fmtBadge=`<span style="color:var(--muted);font-size:10px;font-weight:600;letter-spacing:.5px">· ${filledFmts}/${formats.length} formats</span>`;
      let prHtml;
      if(primaryPRs.length>0){
        const best=mode==='time'?primaryPRs.reduce((a,b)=>b.value<a.value?b:a):primaryPRs.reduce((a,b)=>b.value>a.value?b:a);
        const display=mode==='number'?best.value:formatPRValue(best.value,mode);
        const unitDisplay=mode==='time'?'temps':(mode==='rounds'?'rounds + reps':(mode==='run'?'km/h':(mode==='watt'?'W':m.unit)));
        prHtml=`<div style="text-align:right"><div class="mv-pr-val">${display}</div><div class="mv-pr-unit">${displayFmt} · ${unitDisplay}</div><div class="mv-pr-date">${formatDate(best.recorded_at)}</div></div>`;
      } else {
        prHtml=`<div class="mv-no-pr">+ Ajouter</div>`;
      }
      return`<div class="movement-item" onclick="openPRModal('${m.id}')">
        <div><div class="mv-name">${m.name}</div><div class="mv-cat">${CAT_LABELS[m.category]||m.category} ${fmtBadge}</div></div>${prHtml}
      </div>`;
    }
    if(prs.length===0){
      return`<div class="movement-item" onclick="openPRModal('${m.id}')">
        <div><div class="mv-name">${m.name}</div><div class="mv-cat">${CAT_LABELS[m.category]||m.category}</div></div>
        <div class="mv-no-pr">+ Ajouter</div>
      </div>`;
    }
    const sample=prs[0];
    const mode=getPRModeFor(m,sample.format);
    const best=mode==='time'?prs.reduce((a,b)=>b.value<a.value?b:a):prs.reduce((a,b)=>b.value>a.value?b:a);
    const display=mode==='number'?best.value:formatPRValue(best.value,mode);
    const unitDisplay=mode==='time'?'temps':(mode==='rounds'?'rounds + reps':m.unit);
    const prHtml=`<div><div class="mv-pr-val">${display}</div><div class="mv-pr-unit">${unitDisplay}</div><div class="mv-pr-date">${formatDate(best.recorded_at)}</div></div>`;
    return`<div class="movement-item" onclick="openPRModal('${m.id}')">
      <div><div class="mv-name">${m.name}</div><div class="mv-cat">${CAT_LABELS[m.category]||m.category}</div></div>${prHtml}
    </div>`;
  };

  const subHeader=(label)=>`<div style="padding:10px 20px 4px;font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:2px;color:var(--accent);opacity:.85;border-top:1px dashed var(--border);margin-top:6px">${label}</div>`;

  if(isAll||!isBenchCat){
    let filtered=movements;
    if(!isAll)filtered=filtered.filter(m=>m.category===currentCat);
    if(searchQuery)filtered=filtered.filter(m=>m.name.toLowerCase().includes(searchQuery));
    if(filtered.length>0){
      if(isAll)html+=`<div style="padding:12px 20px 4px;font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:2px;color:var(--muted)">RECORDS PERSONNELS</div>`;

      // Group haltero & force by sub-category
      const halteroMovs=filtered.filter(m=>m.category==='haltero');
      const forceMovs=filtered.filter(m=>m.category==='force');
      const otherMovs=filtered.filter(m=>m.category!=='haltero'&&m.category!=='force');

      const renderGrouped=(movs,subcats,getSub,catLabel)=>{
        if(!movs.length)return;
        if(isAll)html+=`<div style="padding:8px 20px 2px;font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:1.5px;color:var(--muted)">${catLabel.toUpperCase()}</div>`;
        const grouped={};
        movs.forEach(m=>{const k=getSub(m.name);(grouped[k]=grouped[k]||[]).push(m);});
        subcats.forEach(sc=>{
          const list=grouped[sc.key];
          if(!list||!list.length)return;
          html+=subHeader(sc.label);
          html+=list.map(renderMovementCard).join('');
        });
      };

      renderGrouped(halteroMovs,HALTERO_SUBCATS,getHalteroSubCat,CAT_LABELS.haltero);
      renderGrouped(forceMovs,FORCE_SUBCATS,getForceSubCat,CAT_LABELS.force);

      if(otherMovs.length>0){
        html+=otherMovs.map(renderMovementCard).join('');
      }
    }
  }

  // --- BENCHMARKS ---
  if(isAll||isBenchCat){
    let filteredB=benchmarks;
    if(isBenchCat)filteredB=filteredB.filter(b=>b.category===currentCat);
    if(searchQuery)filteredB=filteredB.filter(b=>b.name.toLowerCase().includes(searchQuery));
    if(filteredB.length>0){
      if(isAll)html+=`<div style="padding:16px 20px 4px;font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:2px;color:var(--muted);border-top:1px solid var(--border);margin-top:8px">BENCHMARKS</div>`;
      html+=filteredB.map(b=>{
        const scores=myBenchScores[b.id]||[];const best=scores[0];
        const scoreHtml=best?`<div><div class="mv-pr-val">${best.score_text||best.score_value}</div><div class="mv-pr-unit">${LEVEL_LABELS[best.level]||best.level}</div><div class="mv-pr-date">${formatDate(best.recorded_at)}</div></div>`:`<div class="mv-no-pr">+ Score</div>`;
        return`<div class="movement-item" onclick="openBenchModal('${b.id}')">
          <div><div class="mv-name">${b.name}</div><div class="mv-cat">${b.category==='girl'?'Girl WOD':b.category==='test'?'Test force':b.category==='hero'?'Hero WOD':'Custom'}</div></div>${scoreHtml}
        </div>`;
      }).join('');
    }
  }

  if(!html)html='<div class="empty"><div class="empty-icon">🔍</div><p>Aucun résultat</p></div>';
  list.innerHTML=html;
}
function openPRModal(movementId,preselectFormat){
  currentModalMovement=movements.find(m=>m.id===movementId);if(!currentModalMovement)return;
  document.getElementById('modal-mv-name').textContent=currentModalMovement.name;

  // Sélecteur de format
  const formats=(currentModalMovement.available_formats||'').split(',').map(f=>f.trim()).filter(Boolean);
  const formatEl=document.getElementById('modal-pr-format');
  if(formats.length>1){
    formatEl.style.display='block';
    formatEl.innerHTML=`<div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">Format</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">${formats.map((f,i)=>{
        const sel=preselectFormat?(f===preselectFormat):(i===0);
        return `<button class="format-btn ${sel?'active':''}" data-format="${f}" onclick="selectFormat(this)">${f}</button>`;
      }).join('')}</div>`;
  } else {
    formatEl.style.display='none';
  }

  renderPRInputArea();
  document.getElementById('modal-pr-date').value=new Date().toISOString().split('T')[0];
  const noteEl=document.getElementById('modal-pr-note');if(noteEl)noteEl.value='';
  document.querySelector('.btn-modal-save').textContent='Enregistrer';
  editingPRId=null;
  renderPRHistory(movementId);
  document.getElementById('pr-modal').classList.add('open');
}

function selectFormat(btn){
  document.querySelectorAll('#modal-pr-format .format-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderPRInputArea();
}

function getPRModeFor(movement,format){
  const fmt=(format||'').toLowerCase().trim();
  const unit=(movement?.unit||'').toLowerCase();
  const name=(movement?.name||'').toLowerCase();
  const cat=(movement?.category||'').toLowerCase();
  // ERG (Row, Ski, Bike, Assault Bike) — mode watt si format Test xmin / FTP / Puissance Critique
  const isErg=name.includes('row')||name.includes('ski')||name.includes('bike')||name.includes('abike')||name.includes('assault');
  if(isErg){
    if(fmt.includes('ftp')||fmt.includes('puissance critique')||fmt.includes('puissance')||!!fmt.match(/test\s*\d+\s*'?\s*min?/)||!!fmt.match(/test\s*\d+\s*'/)){
      return 'watt';
    }
    // Distances/cal sur erg → temps
    if(fmt.match(/\d+\s*k\b/)||fmt.match(/\d+\s*km/)||fmt.match(/\d+\s*m\b/)||fmt.includes('cal')||fmt.includes('acid'))return 'time';
  }
  // RUN — détection large : unité, format, nom du mouvement
  const runUnit=unit.includes('km/h')||unit.includes('min/km')||unit.includes('pace')||unit.includes('allure')||unit.includes('vitesse');
  const runFmt=(fmt.includes('run')||fmt.includes('pace')||fmt.includes('marathon')||fmt.includes('semi')||fmt.includes('vma')||fmt.includes('vitesse critique')||fmt.includes('allure')||fmt.includes('cooper')||!!fmt.match(/test\s*\d+\s*'?\s*min?/)||!!fmt.match(/^\d+\s*min$/));
  const runName=(name==='run'||name.includes('course')||name.includes('cours')||name.includes('jog')||name.includes('vma')||name.includes('marathon')||name.includes('cooper')||name.includes('fartlek')||name.includes('sprint'))&&!isErg;
  const isRunCtx=(runUnit||runName||(runFmt&&!isErg))&&!isErg;
  if(isRunCtx){
    if(fmt.match(/\d+\s*k\b/)||fmt.match(/\d+\s*km/)||fmt.includes('marathon')||fmt.includes('semi'))return 'time';
    return 'run';
  }
  if(fmt.includes('time')||fmt==='for time'||unit==='sec'||unit==='temps'||unit.includes('min:sec')||unit.includes('time')){return 'time';}
  if(fmt.includes('amrap')||fmt.includes('round')||unit.includes('round')||unit.includes('amrap')){return 'rounds';}
  return 'number';
}
function getPRMode(){
  return getPRModeFor(currentModalMovement,getSelectedFormat());
}
function renderPRInputArea(){
  const mode=getPRMode();
  const wrap=document.getElementById('pr-input-wrap');
  if(!wrap)return;
  if(mode==='time'){
    wrap.innerHTML=`<div class="modal-sub">Temps (h / min / s)</div>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <input class="modal-input" id="pr-h" type="number" min="0" placeholder="h" style="margin:0;text-align:center">
        <input class="modal-input" id="pr-m" type="number" min="0" max="59" placeholder="min" style="margin:0;text-align:center">
        <input class="modal-input" id="pr-s" type="number" min="0" max="59" placeholder="sec" style="margin:0;text-align:center">
      </div>`;
  } else if(mode==='rounds'){
    wrap.innerHTML=`<div class="modal-sub">Rounds + Reps</div>
      <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center">
        <input class="modal-input" id="pr-rounds" type="number" min="0" placeholder="rounds" style="margin:0;text-align:center">
        <span style="font-size:18px;font-weight:700;color:var(--muted)">+</span>
        <input class="modal-input" id="pr-reps" type="number" min="0" placeholder="reps" style="margin:0;text-align:center">
      </div>`;
  } else if(mode==='run'){
    wrap.innerHTML=`<div class="modal-sub">Vitesse / Allure (au choix)</div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button type="button" class="run-tab active" data-runtab="kmh" onclick="switchRunTab('kmh')" style="flex:1;background:rgba(232,255,71,.15);border:1px solid rgba(232,255,71,.4);color:var(--accent);padding:6px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer">KM/H</button>
        <button type="button" class="run-tab" data-runtab="pace" onclick="switchRunTab('pace')" style="flex:1;background:transparent;border:1px solid var(--border2);color:var(--muted);padding:6px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer">MIN/KM</button>
      </div>
      <div id="run-input-kmh">
        <input class="modal-input" id="pr-kmh" type="number" step="0.1" min="0" placeholder="ex: 13.3" oninput="onRunInputChange()">
      </div>
      <div id="run-input-pace" style="display:none">
        <div style="display:flex;gap:8px;align-items:center">
          <input class="modal-input" id="pr-pace-m" type="number" min="0" placeholder="min" style="margin:0;text-align:center" oninput="onRunInputChange()">
          <span style="font-size:18px;font-weight:700;color:var(--muted)">:</span>
          <input class="modal-input" id="pr-pace-s" type="number" min="0" max="59" placeholder="sec" style="margin:0;text-align:center" oninput="onRunInputChange()">
          <span style="font-size:11px;color:var(--muted);font-weight:700">/km</span>
        </div>
      </div>
      <div id="run-preview" style="font-size:12px;color:var(--muted);margin-bottom:12px;min-height:18px"></div>`;
  } else if(mode==='watt'){
    wrap.innerHTML=`<div class="modal-sub">Puissance moyenne (watts)</div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px">
        <input class="modal-input" id="pr-watt" type="number" min="0" step="1" placeholder="ex: 285" style="margin:0">
        <span style="font-size:11px;color:var(--muted);font-weight:700">W</span>
      </div>`;
  } else {
    wrap.innerHTML=`<div class="modal-sub" id="modal-mv-unit">Valeur en ${currentModalMovement?.unit||''}</div>
      <input class="modal-input" id="modal-pr-val" type="number" step="0.5" min="0" placeholder="0">`;
  }
}
function readPRValue(){
  // Retourne {value:number, displayText:string} ou null si invalide
  const mode=getPRMode();
  if(mode==='time'){
    const h=parseInt(document.getElementById('pr-h')?.value)||0;
    const m=parseInt(document.getElementById('pr-m')?.value)||0;
    const s=parseInt(document.getElementById('pr-s')?.value)||0;
    const total=h*3600+m*60+s;
    if(total<=0)return null;
    return {value:total};
  }
  if(mode==='rounds'){
    const r=parseInt(document.getElementById('pr-rounds')?.value)||0;
    const reps=parseInt(document.getElementById('pr-reps')?.value)||0;
    if(r<=0&&reps<=0)return null;
    return {value:r*1000+reps};
  }
  if(mode==='run'){
    const kmh=_readRunAsKmh();
    if(!kmh||kmh<=0)return null;
    return {value:kmh};
  }
  if(mode==='watt'){
    const w=parseFloat(document.getElementById('pr-watt')?.value)||0;
    if(w<=0)return null;
    return {value:w};
  }
  const v=parseFloat(document.getElementById('modal-pr-val')?.value);
  if(!v||v<=0)return null;
  return {value:v};
}
function setPRValue(value){
  const mode=getPRMode();
  if(mode==='time'){
    const v=parseFloat(value)||0;
    const h=Math.floor(v/3600);
    const m=Math.floor((v%3600)/60);
    const s=Math.floor(v%60);
    const hEl=document.getElementById('pr-h');if(hEl)hEl.value=h||'';
    const mEl=document.getElementById('pr-m');if(mEl)mEl.value=m||'';
    const sEl=document.getElementById('pr-s');if(sEl)sEl.value=s||'';
  } else if(mode==='rounds'){
    const v=parseInt(value)||0;
    const r=Math.floor(v/1000);
    const reps=v%1000;
    const rEl=document.getElementById('pr-rounds');if(rEl)rEl.value=r||'';
    const repsEl=document.getElementById('pr-reps');if(repsEl)repsEl.value=reps||'';
  } else if(mode==='run'){
    // value stocké en km/h
    const kmh=parseFloat(value)||0;
    const kmhEl=document.getElementById('pr-kmh');if(kmhEl)kmhEl.value=kmh||'';
    if(kmh>0){
      const secPerKm=3600/kmh;
      const m=Math.floor(secPerKm/60);
      const s=Math.round(secPerKm%60);
      const pmEl=document.getElementById('pr-pace-m');if(pmEl)pmEl.value=m||'';
      const psEl=document.getElementById('pr-pace-s');if(psEl)psEl.value=s||'';
    }
    onRunInputChange();
  } else if(mode==='watt'){
    const el=document.getElementById('pr-watt');if(el)el.value=value||'';
  } else {
    const el=document.getElementById('modal-pr-val');if(el)el.value=value||'';
  }
}
function formatPRValue(value,mode){
  const v=parseFloat(value)||0;
  if(mode==='time'){
    const h=Math.floor(v/3600);
    const m=Math.floor((v%3600)/60);
    const s=Math.floor(v%60);
    if(h>0)return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
  }
  if(mode==='rounds'){
    const r=Math.floor(v/1000);
    const reps=v%1000;
    return `${r} + ${reps}`;
  }
  if(mode==='run'){
    // v en km/h
    const secPerKm=v>0?3600/v:0;
    const m=Math.floor(secPerKm/60);
    const s=Math.round(secPerKm%60);
    return `${v.toFixed(1)} km/h · ${m}:${String(s).padStart(2,'0')}/km`;
  }
  if(mode==='watt'){
    return `${Math.round(v)} W`;
  }
  return String(value);
}

function _readRunAsKmh(){
  // Lit l'onglet actif et retourne la vitesse en km/h
  const tab=document.querySelector('.run-tab.active')?.dataset.runtab||'kmh';
  if(tab==='kmh'){
    return parseFloat(document.getElementById('pr-kmh')?.value)||0;
  }
  if(tab==='pace'){
    const m=parseInt(document.getElementById('pr-pace-m')?.value)||0;
    const s=parseInt(document.getElementById('pr-pace-s')?.value)||0;
    const totalSec=m*60+s;
    if(totalSec<=0)return 0;
    return 3600/totalSec;
  }
  if(tab==='dt'){
    const km=parseFloat(document.getElementById('pr-dt-km')?.value)||0;
    const m=parseInt(document.getElementById('pr-dt-m')?.value)||0;
    const s=parseInt(document.getElementById('pr-dt-s')?.value)||0;
    const totalSec=m*60+s;
    if(km<=0||totalSec<=0)return 0;
    return km/(totalSec/3600);
  }
  return 0;
}
function switchRunTab(tab){
  document.querySelectorAll('.run-tab').forEach(b=>{
    const active=b.dataset.runtab===tab;
    b.classList.toggle('active',active);
    if(active){
      b.style.background='rgba(232,255,71,.15)';
      b.style.borderColor='rgba(232,255,71,.4)';
      b.style.color='var(--accent)';
    } else {
      b.style.background='transparent';
      b.style.borderColor='var(--border2)';
      b.style.color='var(--muted)';
    }
  });
  ['kmh','pace','dt'].forEach(k=>{
    const el=document.getElementById('run-input-'+k);
    if(el)el.style.display=(k===tab?'':'none');
  });
  onRunInputChange();
}
function onRunInputChange(){
  const kmh=_readRunAsKmh();
  const prev=document.getElementById('run-preview');
  if(!prev)return;
  if(kmh<=0){prev.textContent='';return;}
  const secPerKm=3600/kmh;
  const m=Math.floor(secPerKm/60);
  const s=Math.round(secPerKm%60);
  prev.innerHTML=`<span style="color:var(--accent);font-weight:700">${kmh.toFixed(1)} km/h</span> · ${m}:${String(s).padStart(2,'0')}/km`;
}
function onRunDistChange(){
  const m=parseFloat(document.getElementById('pr-rd-m')?.value)||0;
  const prev=document.getElementById('run-dist-preview');
  if(!prev)return;
  if(m<=0){prev.textContent='';return;}
  // Calcul vitesse moyenne d'après format
  const fmt=getSelectedFormat()||'';
  const minMatch=fmt.match(/(\d+)\s*min/i);
  const dur=minMatch?parseInt(minMatch[1]):(fmt.toLowerCase().includes('cooper')?12:0);
  if(dur<=0){prev.innerHTML=`<span style="color:var(--accent);font-weight:700">${m>=1000?(m/1000).toFixed(2)+' km':m+' m'}</span>`;return;}
  const kmh=(m/1000)/(dur/60);
  const secPerKm=kmh>0?3600/kmh:0;
  const pm=Math.floor(secPerKm/60);
  const ps=Math.round(secPerKm%60);
  prev.innerHTML=`<span style="color:var(--accent);font-weight:700">${m>=1000?(m/1000).toFixed(2)+' km':m+' m'}</span> · ${kmh.toFixed(1)} km/h · ${pm}:${String(ps).padStart(2,'0')}/km`;
}

function getSelectedFormat(){
  const active=document.querySelector('#modal-pr-format .format-btn.active');
  return active?active.dataset.format:null;
}

function renderPRHistory(movementId){
  const prs=myPRs[movementId]||[];
  const histEl=document.getElementById('modal-history');
  if(prs.length===0){histEl.innerHTML='';return;}

  // Grouper par format
  const byFormat={};
  prs.forEach(p=>{
    const key=p.format||'—';
    if(!byFormat[key])byFormat[key]=[];
    byFormat[key].push(p);
  });

  let html='<div class="pr-hist-title">Historique</div>';
  Object.entries(byFormat).forEach(([fmt,entries])=>{
    const mode=getPRModeFor(currentModalMovement,fmt==='—'?null:fmt);
    // Pour time, le PR est le MIN; sinon le MAX
    const best=mode==='time'?Math.min(...entries.map(p=>p.value)):Math.max(...entries.map(p=>p.value));
    const unitLabel=mode==='time'?'':(mode==='rounds'?'':' '+(currentModalMovement.unit||''));
    if(Object.keys(byFormat).length>1)html+=`<div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1px;margin:8px 0 4px;text-transform:uppercase">${fmt}</div>`;
    html+=entries.slice(0,5).map(p=>{
      const noteEsc=p.note?String(p.note).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n'):'';
      const noteHtml=p.note?String(p.note).replace(/</g,'&lt;').replace(/>/g,'&gt;'):'';
      return `
      <div class="pr-hist-item" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="pr-hist-val">${mode==='number'?p.value:formatPRValue(p.value,mode)}${unitLabel}</span>
            ${p.value===best?'<span class="pr-hist-new">PR</span>':''}
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span class="pr-hist-date">${formatDate(p.recorded_at)}</span>
            <button onclick="editPR('${p.id}','${p.value}','${p.recorded_at}','${p.format||''}','${noteEsc}')" style="background:rgba(71,200,255,.1);border:1px solid rgba(71,200,255,.3);color:var(--blue);border-radius:5px;padding:2px 7px;font-size:11px;cursor:pointer">✏️</button>
            <button onclick="deletePR('${p.id}')" style="background:rgba(255,68,68,.1);border:1px solid rgba(255,68,68,.3);color:var(--red);border-radius:5px;padding:2px 7px;font-size:11px;cursor:pointer">✕</button>
          </div>
        </div>
        ${p.note?`<div style="font-size:12px;line-height:1.5;color:#bbb;background:rgba(255,255,255,.03);border-left:2px solid var(--accent);padding:6px 10px;border-radius:4px;white-space:pre-wrap">${noteHtml}</div>`:''}
      </div>`;}).join('');
  });

  // Chart sur les entrées du même format (prendre le plus représenté)
  const mainFormat=Object.entries(byFormat).sort((a,b)=>b[1].length-a[1].length)[0];
  if(mainFormat&&mainFormat[1].length>=2){
    html+=buildMiniChart(mainFormat[1].slice(0,8).reverse());
  }
  histEl.innerHTML=html;
}

function closePRModal(){document.getElementById('pr-modal').classList.remove('open');currentModalMovement=null;editingPRId=null;}

let editingPRId=null;
function editPR(id,value,date,format,note){
  editingPRId=id;
  // Sélectionner le bon format AVANT de re-render l'input area
  if(format){
    document.querySelectorAll('#modal-pr-format .format-btn').forEach(b=>{
      b.classList.toggle('active',b.dataset.format===format);
    });
  }
  renderPRInputArea();
  setPRValue(value);
  document.getElementById('modal-pr-date').value=date;
  const noteEl=document.getElementById('modal-pr-note');if(noteEl)noteEl.value=note||'';
  document.querySelector('.btn-modal-save').textContent='💾 Modifier';
}
async function deletePR(id){
  const {error}=await sb.from('athlete_prs').delete().eq('id',id);
  if(error){showToast('❌ '+error.message);return;}
  showToast('🗑 PR supprimé');
  await loadMyPRs();
  if(currentModalMovement)renderPRHistory(currentModalMovement.id);
}
async function savePR(){
  if(!currentModalMovement)return;
  const date=document.getElementById('modal-pr-date').value;
  const format=getSelectedFormat();
  const r=readPRValue();
  if(!r){showToast('⚠️ Entre une valeur valide');return;}
  const val=r.value;

  const noteEl=document.getElementById('modal-pr-note');
  const note=noteEl?(noteEl.value.trim()||null):null;
  if(editingPRId){
    const {error}=await sb.from('athlete_prs').update({value:val,recorded_at:date,format:format||null,note}).eq('id',editingPRId);
    if(error){showToast('❌ '+error.message);return;}
    showToast('✅ PR modifié !');
    editingPRId=null;
    document.querySelector('.btn-modal-save').textContent='Enregistrer';
  } else {
    const {error}=await sb.from('athlete_prs').insert({athlete_id:currentUser.id,movement_id:currentModalMovement.id,value:val,recorded_at:date,format:format||null,note});
    if(error){showToast('❌ '+error.message);return;}
    showToast('🏆 PR enregistré !');
  }
  if(noteEl)noteEl.value='';
  renderPRInputArea();
  await loadMyPRs();
  renderPRHistory(currentModalMovement.id);
}
function buildMiniChart(prs){
  if(prs.length<2)return'';
  const vals=prs.map(p=>p.value);const min=Math.min(...vals);const max=Math.max(...vals);const range=max-min||1;
  const w=280,h=60,pad=8;
  const pts=vals.map((v,i)=>`${pad+(i/(vals.length-1))*(w-pad*2)},${h-pad-((v-min)/range)*(h-pad*2)}`).join(' ');
  return`<div class="mini-chart"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${vals.map((v,i)=>{const x=pad+(i/(vals.length-1))*(w-pad*2);const y=h-pad-((v-min)/range)*(h-pad*2);return`<circle cx="${x}" cy="${y}" r="3" fill="var(--accent)"/>`;}).join('')}</svg></div>`;
}

// BENCHMARKS
async function loadBenchmarks(){const {data}=await sb.from('benchmarks').select('*').order('category,name');benchmarks=data||[];}
let myBenchScores={};
async function loadMyBenchScores(){
  if(!currentUser)return;
  const {data}=await sb.from('benchmark_scores').select('*').eq('athlete_id',currentUser.id).order('recorded_at',{ascending:false});
  myBenchScores={};
  (data||[]).forEach(s=>{if(!myBenchScores[s.benchmark_id])myBenchScores[s.benchmark_id]=[];myBenchScores[s.benchmark_id].push(s);});
  renderAll();
}
function openBenchModal(benchmarkId){
  currentBenchmark=benchmarks.find(b=>b.id===benchmarkId);if(!currentBenchmark)return;
  document.getElementById('bmodal-name').textContent=currentBenchmark.name;
  document.getElementById('bmodal-desc').textContent=currentBenchmark.description||'';
  document.getElementById('bmodal-content').textContent=currentBenchmark.content||'';
  document.getElementById('bmodal-score-val').value='';
  document.getElementById('bmodal-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('bmodal-score-hint').textContent=SCORE_HINTS[currentBenchmark.score_type]||'';
  document.querySelector('#bench-modal .level-btn.active')?.classList.remove('active');
  document.querySelector('#bench-modal .level-btn.rx')?.classList.add('active');
  currentBLevel='rx';
  const scores=myBenchScores[benchmarkId]||[];
  const histEl=document.getElementById('bmodal-history');
  if(scores.length>0){histEl.innerHTML=`<div class="pr-hist-title">Mon historique</div>`+scores.slice(0,3).map(s=>`<div class="pr-hist-item"><span class="pr-hist-val">${s.score_text||s.score_value}</span> <span class="level-badge lbadge-${s.level}">${LEVEL_LABELS[s.level]}</span><span class="pr-hist-date">${formatDate(s.recorded_at)}</span></div>`).join('');}
  else{histEl.innerHTML='';}
  loadBenchLeaderboard(benchmarkId);
  document.getElementById('bench-modal').classList.add('open');
}
function closeBenchModal(){document.getElementById('bench-modal').classList.remove('open');currentBenchmark=null;}
function selectBLevel(level,btn){
  currentBLevel=level;
  document.querySelectorAll('#bench-modal .level-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}
async function saveBenchScore(){
  if(!currentBenchmark)return;
  const val=document.getElementById('bmodal-score-val').value.trim();
  const date=document.getElementById('bmodal-date').value;
  if(!val){showToast('⚠️ Entre ton score');return;}
  const numVal=parseFloat(val.replace(':',''))||0;
  const {error}=await sb.from('benchmark_scores').insert({benchmark_id:currentBenchmark.id,athlete_id:currentUser.id,level:currentBLevel,score_value:numVal,score_text:val,recorded_at:date});
  if(error){showToast('❌ '+error.message);return;}
  showToast('🏆 Score enregistré !');closeBenchModal();await loadMyBenchScores();
}
async function loadBenchLeaderboard(benchmarkId){
  const {data}=await sb.from('benchmark_scores').select('*,profiles(full_name,avatar_url)').eq('benchmark_id',benchmarkId).order('level').order('score_value',{ascending:false});
  const el=document.getElementById('bmodal-leaderboard');
  if(!data||data.length===0){el.innerHTML='';return;}
  const levelOrder={rx:0,intermediate:1,scaled:2,foundation:3};
  const sorted=[...data].sort((a,b)=>levelOrder[a.level]-levelOrder[b.level]||(b.score_value-a.score_value));
  el.innerHTML=`<div class="pr-hist-title">Leaderboard</div>`+sorted.slice(0,10).map((s,i)=>`<div class="pr-hist-item">
    <div style="display:flex;align-items:center;gap:8px"><span style="font-family:'Bebas Neue';font-size:16px;color:var(--muted)">${i+1}</span>${avatarHtml(s.profiles)}<span style="font-size:13px;font-weight:600">${s.profiles?.full_name||'Athlète'}</span><span class="level-badge lbadge-${s.level}">${LEVEL_LABELS[s.level]}</span></div>
    <span class="pr-hist-val" style="font-size:16px">${s.score_text||s.score_value}</span>
  </div>`).join('');
}

// PROFIL STATS
async function loadProfilStats(){
  if(!currentUser)return;
  const [prs,scores,bench]=await Promise.all([
    sb.from('athlete_prs').select('id',{count:'exact'}).eq('athlete_id',currentUser.id),
    sb.from('wod_scores').select('id',{count:'exact'}).eq('athlete_id',currentUser.id),
    sb.from('benchmark_scores').select('id',{count:'exact'}).eq('athlete_id',currentUser.id)
  ]);
  document.getElementById('stat-pr').textContent=prs.count||0;
  document.getElementById('stat-wod').textContent=scores.count||0;
  document.getElementById('stat-bench').textContent=bench.count||0;
}

