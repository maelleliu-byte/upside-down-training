// ADMIN
async function loadAdminProgs(){
  const grid=document.getElementById('admin-prog-grid');
  // Toujours s'assurer que le bouton "+ Nouveau programme" est visible si le form est caché
  const _form=document.getElementById('new-prog-form');
  const _btn=document.getElementById('btn-show-new-prog');
  if(_btn&&(!_form||_form.style.display==='none'))_btn.style.display='block';
  const counts={};
  for(const p of programmes){const {count}=await sb.from('sessions').select('id',{count:'exact'}).eq('programme_id',p.id);counts[p.id]=count||0;}
  grid.innerHTML=programmes.map(p=>`<div class="prog-card-admin" style="border-color:${p.color}33;position:relative">
    <button class="btn-delete" onclick="event.stopPropagation();deleteProgramme('${p.id}','${(p.name||'').replace(/'/g,"\\'")}',${counts[p.id]||0})" style="position:absolute;top:8px;right:8px;width:26px;height:26px;font-size:12px">✕</button>
    <button class="btn-secondary" onclick="event.stopPropagation();editProgramme('${p.id}')" style="position:absolute;top:8px;right:40px;width:26px;height:26px;font-size:12px;padding:0;border-radius:50%;display:flex;align-items:center;justify-content:center">✏</button>
    <div class="prog-card-name" style="color:${p.color}">${p.name}</div>
    <div class="prog-card-desc">${p.description||''}</div>
    <div class="prog-card-count" style="color:${p.color}">${counts[p.id]} séances</div>
  </div>`).join('');
}

async function editProgramme(id){
  const p=programmes.find(x=>x.id===id);if(!p){showToast('❌ Programme introuvable');return;}
  const newName=prompt('Nom du programme :',p.name);if(newName===null)return;
  const newDesc=prompt('Description :',p.description||'');if(newDesc===null)return;
  const newPriceStr=prompt('Prix mensuel (€) — vide si pas abonnement :',p.price_monthly||'');
  if(newPriceStr===null)return;
  const newPrice=newPriceStr.trim()===''?null:parseFloat(newPriceStr);
  const updates={name:newName.trim()||p.name,description:newDesc.trim()};
  if(p.type==='subscription')updates.price_monthly=newPrice;
  const {error}=await sb.from('programmes').update(updates).eq('id',id);
  if(error){showToast('❌ '+error.message);return;}
  showToast('✅ Programme mis à jour');
  // Sync Stripe si abonnement avec prix
  if(p.type==='subscription'&&newPrice){
    showToast('⏳ Sync Stripe...');
    try{
      const fnUrl=(window.SUPABASE_URL||sb.supabaseUrl||'').replace(/\/$/,'')+'/functions/v1/create-stripe-product';
      const res=await fetch(fnUrl,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({programme_id:id,name:updates.name,description:updates.description,price_monthly:newPrice,currency:'eur'})});
      const data=await res.json();
      if(data.error){showToast('⚠️ Stripe : '+data.error);}else{showToast('✅ Stripe synchronisé');}
    }catch(e){console.warn(e);}
  }
  await loadProgrammes();await loadAdminProgs();
}
async function deleteProgramme(id,name,sessionCount){
  if(sessionCount>0){
    if(!confirm(`⚠️ Le programme "${name}" contient ${sessionCount} séance(s).\n\nSupprimer le programme ET toutes ses séances ?\n\nCette action est irréversible.`))return;
    const {error:eS}=await sb.from('sessions').delete().eq('programme_id',id);
    if(eS){showToast('❌ Séances : '+eS.message);console.error('delete sessions',eS);return;}
  }else{
    if(!confirm(`Supprimer le programme "${name}" ?`))return;
  }
  // Récupérer les IDs Stripe AVANT suppression DB
  const {data:progBeforeDelete}=await sb.from('programmes').select('stripe_product_id,stripe_price_id').eq('id',id).maybeSingle();
  // Cascade manuelle scores + notes pour toutes les séances (prog + perso) liées à ce programme
  const sessIds=[];
  const r1=await sb.from('sessions').select('id').eq('programme_id',id);
  if(r1.data)sessIds.push(...r1.data.map(s=>s.id));
  const r2=await sb.from('personal_sessions').select('id').eq('programme_id',id);
  if(r2.data)sessIds.push(...r2.data.map(s=>s.id));
  if(sessIds.length){
    await sb.from('wod_scores').delete().in('session_id',sessIds).then(r=>r.error&&console.warn('cascade wod_scores',r.error.message));
    await sb.from('session_notes').delete().in('session_id',sessIds).then(r=>r.error&&console.warn('cascade session_notes',r.error.message));
  }
  // Nettoyer toutes les FK possibles (silencieux si table absente)
  await sb.from('athlete_programmes').delete().eq('programme_id',id).then(r=>r.error&&console.warn('athlete_programmes',r.error.message));
  await sb.from('programme_access').delete().eq('programme_id',id).then(r=>r.error&&console.warn('programme_access',r.error.message));
  await sb.from('cycle_plans').delete().eq('programme_id',id).then(r=>r.error&&console.warn('cycle_plans',r.error.message));
  await sb.from('personal_sessions').delete().eq('programme_id',id).then(r=>r.error&&console.warn('personal_sessions',r.error.message));
  const {error,data}=await sb.from('programmes').delete().eq('id',id).select();
  if(error){showToast('❌ '+error.message);console.error('delete programme',error);return;}
  if(!data||data.length===0){
    showToast('⚠️ Programme non supprimé (RLS ?). Vérifie la console.');
    console.warn('Programme delete returned no rows. Probable RLS policy missing for DELETE on programmes.');
    return;
  }
  showToast('🗑 Programme supprimé');
  // Archiver le produit Stripe en arrière-plan (silencieux)
  if(progBeforeDelete?.stripe_product_id||progBeforeDelete?.stripe_price_id){
    try{
      const fnUrl=(window.SUPABASE_URL||sb.supabaseUrl||'').replace(/\/$/,'')+'/functions/v1/delete-stripe-product';
      fetch(fnUrl,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({stripe_product_id:progBeforeDelete.stripe_product_id,stripe_price_id:progBeforeDelete.stripe_price_id})
      }).catch(e=>console.warn('stripe archive',e));
    }catch(e){console.warn(e);}
  }
  // Forcer reset du state local + reload complet
  programmes=programmes.filter(p=>p.id!==id);
  await loadProgrammes();
  await loadAdminProgs();
  if(typeof loadAdminSessions==='function')loadAdminSessions();
  if(typeof renderProgTabs==='function')renderProgTabs();
}
function selectColor(color,el){
  selectedColor=color;
  document.querySelectorAll('#np-colors .color-swatch').forEach(s=>s.classList.remove('selected'));
  el.classList.add('selected');
  const dot=document.getElementById('np-prev-dot');if(dot)dot.style.background=color;
}
function onNpTypeChange(){
  const type=document.getElementById('np-type').value;
  const grp=document.getElementById('np-weeks-group');
  if(grp)grp.style.display=type==='oneshot'?'block':'none';
}
// Helpers one-shot
function getProgById(id){return programmes.find(p=>p.id===id);}
function isOneshotProg(p){return p&&p.type==='oneshot';}
function onFProgChange(){
  const progId=document.getElementById('f-prog').value;
  const prog=getProgById(progId);
  const oneshot=isOneshotProg(prog);
  document.getElementById('f-date-group').style.display=oneshot?'none':'';
  document.getElementById('f-week-group').style.display=oneshot?'':'none';
  if(oneshot){
    const sel=document.getElementById('f-week');
    const total=prog.total_weeks||8;
    const cur=sel.value;
    sel.innerHTML=Array.from({length:total},(_,i)=>`<option value="${i+1}">Semaine ${i+1}</option>`).join('');
    if(cur&&cur<=total)sel.value=cur;
  }
}
function selectIcon(icon,el){selectedIcon=icon;document.querySelectorAll('.icon-btn').forEach(b=>b.classList.remove('selected'));el.classList.add('selected');}
function _wireNpPreview(){
  const n=document.getElementById('np-name'),d=document.getElementById('np-desc');
  if(n&&!n._wired){n._wired=1;n.addEventListener('input',()=>{const t=document.getElementById('np-prev-name');if(t)t.textContent=(n.value||'NOUVEAU PROGRAMME').toUpperCase();});}
  if(d&&!d._wired){d._wired=1;d.addEventListener('input',()=>{const t=document.getElementById('np-prev-sub');if(t)t.textContent=d.value||'Description courte';});}
}
document.addEventListener('DOMContentLoaded',_wireNpPreview);
async function saveNewProg(){
  const name=document.getElementById('np-name').value.trim();
  const desc=document.getElementById('np-desc').value.trim();
  const price=parseFloat(document.getElementById('np-price').value)||null;
  const type=document.getElementById('np-type').value;
  const totalWeeks=type==='oneshot'?(parseInt(document.getElementById('np-weeks').value)||8):null;
  if(!name){showToast('Nom requis');return;}
  if(type==='oneshot'&&(!totalWeeks||totalWeeks<1||totalWeeks>52)){showToast('Nombre de semaines invalide (1-52)');return;}
  let slug=name.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  // Vérifier si le slug existe déjà — si oui, ajouter un suffixe numérique
  const {data:existing}=await sb.from('programmes').select('slug').like('slug',slug+'%');
  if(existing&&existing.length>0){
    const taken=new Set(existing.map(r=>r.slug));
    if(taken.has(slug)){
      let i=2;while(taken.has(slug+'-'+i))i++;
      slug=slug+'-'+i;
    }
  }
  const {data:inserted,error}=await sb.from('programmes').insert({name,slug,description:desc,icon:selectedIcon,color:selectedColor,type,price_monthly:type==='subscription'?price:null,price_oneshot:type==='oneshot'?price:null,total_weeks:totalWeeks,created_by:currentUser.id}).select().single();
  if(error){
    showToast('❌ '+error.message);
    // Restaurer le bouton "+ Nouveau programme" même en cas d'erreur
    const btn=document.getElementById('btn-show-new-prog');if(btn)btn.style.display='block';
    return;
  }
  showToast('Programme créé');

  // Si on a un prix, créer auto le produit Stripe (subscription OU oneshot)
  if(price&&inserted?.id){
    showToast('Création du produit Stripe...');
    try{
      const {data:{session}}=await sb.auth.getSession();
      const token=session?.access_token;
      const fnUrl=(window.SUPABASE_URL||sb.supabaseUrl||'').replace(/\/$/,'')+'/functions/v1/create-stripe-product';
      const payload={programme_id:inserted.id,name,description:desc,currency:'eur',type};
      if(type==='subscription')payload.price_monthly=price;
      else payload.price_oneshot=price;
      const res=await fetch(fnUrl,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        body:JSON.stringify(payload)
      });
      const data=await res.json();
      if(data.error){showToast('Stripe : '+data.error);console.warn(data);}
      else{showToast('Produit Stripe créé');}
    }catch(e){
      console.error('stripe sync error',e);
      showToast('Stripe non synchronisé : '+e.message);
    }
  }

  document.getElementById('new-prog-form').style.display='none';
  document.getElementById('btn-show-new-prog').style.display='block';
  document.getElementById('np-name').value='';document.getElementById('np-desc').value='';
  await loadProgrammes();loadAdminProgs();
}
function toggleSetsField(){
  const type=document.getElementById('f-type').value;
  document.getElementById('sets-field').style.display=type==='strength'?'block':'none';
}
async function loadAdminSessions(){
  const progId=document.getElementById('admin-filter-prog').value;
  let q=sb.from('sessions').select('*,programmes(name,icon)').order('date',{ascending:false}).limit(50);
  if(progId)q=q.eq('programme_id',progId);
  const {data}=await q;
  const list=document.getElementById('admin-sessions-list');
  if(!data||data.length===0){list.innerHTML='<div class="empty"><p>Aucune séance.</p></div>';return;}
  list.innerHTML=data.map(s=>`<div class="sessions-list-item">
    <div style="flex:1">
      <div class="sli-title">${s.title}</div>
      <div class="sli-meta">${formatDate(s.date)} · ${s.programmes?.icon||''} ${s.programmes?.name||''} · ${TYPE_LABELS[s.type]||s.type}</div>
    </div>
    <div style="display:flex;gap:6px">
      <button class="btn-delete" style="background:rgba(71,200,255,.1);border-color:rgba(71,200,255,.3);color:var(--blue)" onclick="editSession('${s.id}')">✏️</button>
      <button class="btn-delete" style="background:rgba(232,255,71,.1);border-color:rgba(232,255,71,.3);color:var(--accent)" onclick="duplicateSession('${s.id}')">📋</button>
      <button class="btn-delete" onclick="deleteSession('${s.id}')">✕</button>
    </div>
  </div>`).join('');
}
async function deleteSession(id){
  // Cascade manuelle (la FK wod_scores.session_id / session_notes.session_id a été retirée
  // pour autoriser les séances perso, donc on nettoie nous-mêmes)
  await sb.from('wod_scores').delete().eq('session_id',id).then(r=>r.error&&console.warn('cascade wod_scores',r.error.message));
  await sb.from('session_notes').delete().eq('session_id',id).then(r=>r.error&&console.warn('cascade session_notes',r.error.message));
  const {error}=await sb.from('sessions').delete().eq('id',id);
  if(error){showToast('❌ '+error.message);return;}
  showToast('🗑 Supprimée');
  loadAdminSessions();
}

let multiScoreEnabled=false;
function onScoreTypeChange(){
  const type=document.getElementById('f-score-type').value;
  if(type==='text'&&multiScoreEnabled){
    multiScoreEnabled=false;
    document.getElementById('multi-score-toggle').classList.remove('on');
    document.getElementById('multi-score-fields').style.display='none';
  }
}
function toggleMultiScore(){
  const type=document.getElementById('f-score-type')?.value;
  if(type==='text'){showToast('⚠️ Pas de multi-score en mode textuel');return;}
  multiScoreEnabled=!multiScoreEnabled;
  const btn=document.getElementById('multi-score-toggle');
  btn.classList.toggle('on',multiScoreEnabled);
  document.getElementById('multi-score-fields').style.display=multiScoreEnabled?'block':'none';
  if(multiScoreEnabled)renderScoreLabels();
}
function renderScoreLabels(){
  const count=parseInt(document.getElementById('f-score-count')?.value)||2;
  const container=document.getElementById('score-labels-container');
  if(!container)return;
  container.innerHTML=Array.from({length:count},(_,i)=>`
    <div class="form-group" style="margin-bottom:8px">
      <label class="form-label">Label score ${i+1}</label>
      <input type="text" class="form-input score-label-input" data-idx="${i}" id="f-score-label-${i}" placeholder="Ex: Score ${i+1}">
    </div>`).join('');
}

let selectedSessionColor='#e8ff47';
function selectSessionColor(color,el){
  selectedSessionColor=color;
  document.querySelectorAll('#f-colors .color-swatch').forEach(s=>s.classList.remove('selected'));
  el.classList.add('selected');
}

// ===== TEMPLATES DE SÉANCE (localStorage par coach) =====
function _tplKey(){
  try{return 'upside:session_templates:'+(currentUser&&currentUser.id?currentUser.id:'anon');}catch(e){return 'upside:session_templates:anon';}
}
function getSessionTemplates(){
  try{return JSON.parse(localStorage.getItem(_tplKey())||'[]');}catch(e){return [];}
}
function setSessionTemplates(arr){
  try{localStorage.setItem(_tplKey(),JSON.stringify(arr||[]));}catch(e){}
}
function toggleSessionTemplates(){
  const body=document.getElementById('session-templates-body');
  const btn=document.getElementById('tpl-toggle-btn');
  if(!body)return;
  const show=body.style.display==='none';
  body.style.display=show?'block':'none';
  if(btn)btn.textContent=show?'Masquer':'Afficher';
  if(show)renderSessionTemplates();
}
function renderSessionTemplates(){
  const list=document.getElementById('session-templates-list');
  if(!list)return;
  const tpls=getSessionTemplates();
  if(!tpls.length){
    list.innerHTML='<div style="font-size:11px;color:var(--muted);padding:6px 2px;font-style:italic">Aucun template — sauvegarde ta première séance type ci-dessous</div>';
    return;
  }
  list.innerHTML=tpls.map((t,i)=>`
    <div class="tpl-chip" data-i="${i}" style="display:inline-flex;align-items:center;gap:6px;background:var(--card2);border:1px solid var(--border2);border-left:3px solid ${t.color||'#e8ff47'};border-radius:8px;padding:6px 4px 6px 10px;max-width:100%">
      <button type="button" onclick="applySessionTemplate(${i})" style="background:none;border:none;color:var(--text);font-size:12px;font-weight:600;cursor:pointer;padding:0;text-align:left;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="Charger ce template">${(t.name||t.title||'Sans titre').replace(/</g,'&lt;')}</button>
      <span style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">${(t.type||'').slice(0,6)}</span>
      <button type="button" onclick="renameSessionTemplate(${i})" title="Renommer" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px;padding:2px 4px">✎</button>
      <button type="button" onclick="deleteSessionTemplate(${i})" title="Supprimer" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:13px;padding:2px 6px;opacity:.7">✕</button>
    </div>
  `).join('');
}
function _collectSessionFormSnapshot(){
  syncLegacyVideoFields&&syncLegacyVideoFields();
  let videos=[];
  try{videos=getFormVideos?getFormVideos():[];}catch(e){videos=[];}
  return {
    type:document.getElementById('f-type').value,
    title:document.getElementById('f-title').value.trim(),
    content:getEditorContent(),
    intensity:parseInt(document.getElementById('f-intensity').value)||7,
    target:document.getElementById('f-target').value,
    tips:document.getElementById('f-tips').value,
    score_type:document.getElementById('f-score-type').value,
    sets:document.getElementById('f-sets')?document.getElementById('f-sets').value:'',
    color:selectedSessionColor||'#e8ff47',
    scaling_inter:document.getElementById('f-scaling-inter').value,
    scaling_scaled:document.getElementById('f-scaling-scaled').value,
    scaling_foundation:document.getElementById('f-scaling-foundation').value,
    multi_score:!!(typeof multiScoreEnabled!=='undefined'&&multiScoreEnabled),
    score_count:(typeof multiScoreEnabled!=='undefined'&&multiScoreEnabled)?parseInt(document.getElementById('f-score-count')?.value)||2:0,
    score_labels:(()=>{
      if(typeof multiScoreEnabled==='undefined'||!multiScoreEnabled)return [];
      const c=parseInt(document.getElementById('f-score-count')?.value)||2;
      return Array.from({length:c},(_,i)=>document.getElementById(`f-score-label-${i}`)?.value||`Score ${i+1}`);
    })(),
    videos
  };
}
async function saveAsSessionTemplate(){
  const snap=_collectSessionFormSnapshot();
  if(!snap.title&&!snap.content){showToast('⚠️ Remplis au moins un titre');return;}
  const defaultName=snap.title||(snap.type+' — '+new Date().toLocaleDateString('fr-FR'));
  const name=prompt('Nom du template ?',defaultName);
  if(!name)return;
  const tpls=getSessionTemplates();
  tpls.unshift({...snap,name:name.trim(),savedAt:Date.now()});
  // limit 50 templates
  if(tpls.length>50)tpls.length=50;
  setSessionTemplates(tpls);
  renderSessionTemplates();
  // ouvrir si replié
  const body=document.getElementById('session-templates-body');
  if(body&&body.style.display==='none'){toggleSessionTemplates();}
  showToast('✅ Template sauvegardé');
}
function applySessionTemplate(i){
  const tpls=getSessionTemplates();
  const t=tpls[i];if(!t)return;
  // Type d'abord (déclenche affichage sets)
  document.getElementById('f-type').value=t.type||'wod';
  if(typeof toggleSetsField==='function')toggleSetsField();
  if(t.type==='strength'&&document.getElementById('f-sets'))document.getElementById('f-sets').value=t.sets||'';
  document.getElementById('f-title').value=t.title||'';
  setEditorContent(t.content||'');
  document.getElementById('f-intensity').value=t.intensity||7;
  document.getElementById('f-int-val').textContent=t.intensity||7;
  document.getElementById('f-target').value=t.target||'';
  document.getElementById('f-tips').value=t.tips||'';
  document.getElementById('f-score-type').value=t.score_type||'reps';
  document.getElementById('f-scaling-inter').value=t.scaling_inter||'';
  document.getElementById('f-scaling-scaled').value=t.scaling_scaled||'';
  document.getElementById('f-scaling-foundation').value=t.scaling_foundation||'';
  // Vidéos
  try{if(typeof setFormVideos==='function')setFormVideos(t.videos||[]);}catch(e){}
  // Couleur
  if(t.color){
    selectedSessionColor=t.color;
    document.querySelectorAll('#f-colors .color-swatch').forEach(s=>s.classList.toggle('selected',s.dataset.color===t.color));
  }
  // Multi-score
  if(t.multi_score){
    multiScoreEnabled=true;
    document.getElementById('multi-score-toggle')?.classList.add('on');
    document.getElementById('multi-score-fields').style.display='block';
    const sel=document.getElementById('f-score-count');
    if(sel)sel.value=t.score_count||2;
    if(typeof renderScoreLabels==='function')renderScoreLabels();
    (t.score_labels||[]).forEach((lbl,idx)=>{const el=document.getElementById(`f-score-label-${idx}`);if(el)el.value=lbl;});
  } else {
    multiScoreEnabled=false;
    document.getElementById('multi-score-toggle')?.classList.remove('on');
    document.getElementById('multi-score-fields').style.display='none';
  }
  showToast('📋 Template "'+(t.name||'').slice(0,30)+'" chargé — choisis la date');
  document.getElementById('f-title')?.scrollIntoView({block:'center',behavior:'smooth'});
}
function renameSessionTemplate(i){
  const tpls=getSessionTemplates();const t=tpls[i];if(!t)return;
  const n=prompt('Nouveau nom :',t.name||t.title||'');
  if(!n)return;
  t.name=n.trim();setSessionTemplates(tpls);renderSessionTemplates();
}
function deleteSessionTemplate(i){
  const tpls=getSessionTemplates();const t=tpls[i];if(!t)return;
  if(!confirm('Supprimer le template "'+(t.name||t.title||'')+'" ?'))return;
  tpls.splice(i,1);setSessionTemplates(tpls);renderSessionTemplates();
}
function exportSessionTemplates(){
  const tpls=getSessionTemplates();
  if(!tpls.length){showToast('⚠️ Aucun template');return;}
  const blob=new Blob([JSON.stringify(tpls,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='upside-templates-seances.json';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function importSessionTemplates(){
  const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';
  inp.onchange=()=>{
    const f=inp.files&&inp.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const arr=JSON.parse(r.result);
        if(!Array.isArray(arr))throw new Error('Format invalide');
        const cur=getSessionTemplates();
        setSessionTemplates([...arr,...cur].slice(0,50));
        renderSessionTemplates();
        showToast('✅ '+arr.length+' template(s) importé(s)');
      }catch(e){showToast('❌ Fichier invalide');}
    };
    r.readAsText(f);
  };
  inp.click();
}

let adminWeekOffset=0;
async function loadAdminCalendar(){
  let progId=document.getElementById('admin-filter-prog').value;
  // Forcer un programme si "Tous" sélectionné
  if(!progId&&programmes.length>0){
    progId=programmes[0].id;
    document.getElementById('admin-filter-prog').value=progId;
  }
  if(!progId)return;
  const prog=getProgById(progId);
  const oneshot=isOneshotProg(prog);

  // === MODE ONE-SHOT : navigation par semaine relative (S1..SN) ===
  if(oneshot){
    const total=prog.total_weeks||8;
    // adminWeekOffset = index 0..total-1
    if(adminWeekOffset<0)adminWeekOffset=0;
    if(adminWeekOffset>total-1)adminWeekOffset=total-1;
    const weekNum=adminWeekOffset+1;
    document.getElementById('admin-cal-week-label').textContent=`SEMAINE ${weekNum} / ${total}`;
    const {data}=await sb.from('sessions').select('*,programmes(name,color,icon)')
      .eq('programme_id',progId).eq('week_number',weekNum)
      .order('day_of_week',{ascending:true})
      .order('sort_order',{ascending:true,nullsFirst:false})
      .order('created_at');
    const byDow={};for(let i=0;i<7;i++)byDow[i]=[];
    (data||[]).forEach(s=>{if(s.day_of_week!=null&&byDow[s.day_of_week])byDow[s.day_of_week].push(s);});
    const cal=document.getElementById('admin-calendar');
    const dayLabels=['LUN','MAR','MER','JEU','VEN','SAM','DIM'];
    const headers=dayLabels.map(d=>`<div class="cal-day-header">${d}</div>`).join('');
    const dateRow=dayLabels.map((_,i)=>`<div class="cal-day-date">J${i+1}</div>`).join('');
    const sessionCols=Array.from({length:7},(_,dow)=>{
      const sessions=byDow[dow]||[];
      const blocks=sessions.length>0
        ? sessions.map(s=>{
          if(s.type==='separator'){
            return`<div class="cal-rich separator" data-session-id="${s.id}" onclick="openReadSession('${s.id}','session')">
              <div class="cal-rich-actions" style="display:flex;position:absolute;top:2px;right:2px">
                <button class="cal-action-btn" onclick="event.stopPropagation();editSession('${s.id}')">✏</button>
                <button class="cal-action-btn" onclick="event.stopPropagation();deleteSession('${s.id}')">✕</button>
              </div>
              <div class="cal-rich-title">— ${escapeHtml(s.title||'Séparateur')} —</div>
            </div>`;
          }
          const color=s.color||'#e8ff47';
          const typeLabel=TYPE_LABELS[s.type]||s.type;
          const rawContent=s.content||'';
          const withCharges=renderContentWithCharges(rawContent);
          const preview=stripHtml(withCharges).slice(0,160);
          const intensity=s.intensity?`<span>I${s.intensity}/10</span><span class="dot"></span>`:'';
          const sets=s.sets?`<span>${s.sets} séries</span><span class="dot"></span>`:'';
          const yt=s.youtube_url?`<span>▶ vidéo</span>`:'';
          return`<div class="cal-rich" data-session-id="${s.id}" onclick="openReadSession('${s.id}','session')">
            <div class="cal-accent" style="background:${color}"></div>
            <div class="cal-rich-head">
              <span class="cal-rich-type" style="background:${color}22;color:${color}">${typeLabel}</span>
              <div class="cal-rich-actions">
                <button class="cal-action-btn" onclick="event.stopPropagation();editSession('${s.id}')">✏</button>
                <button class="cal-action-btn" onclick="event.stopPropagation();duplicateSession('${s.id}')">📋</button>
                <button class="cal-action-btn" onclick="event.stopPropagation();deleteSession('${s.id}')">✕</button>
              </div>
            </div>
            <div class="cal-rich-title">${escapeHtml(s.title||'')}</div>
            ${preview?`<div class="cal-rich-content">${escapeHtml(preview)}</div>`:''}
            <div class="cal-rich-meta">${intensity}${sets}${yt}</div>
          </div>`;
        }).join('')
        : `<div class="cal-empty-day" onclick="quickAddSession(null,${weekNum},${dow})">+</div>`;
      const addMore=sessions.length>0
        ? `<button class="cal-add-more" onclick="quickAddSession(null,${weekNum},${dow})" title="Ajouter une séance"><span class="plus">+</span>Séance</button>`
        : '';
      return`<div class="cal-day-col rich">${blocks}${addMore}</div>`;
    }).join('');
    cal.innerHTML=`<div class="cal-grid">${headers}</div><div class="cal-grid">${dateRow}</div><div class="cal-grid" style="align-items:start">${sessionCols}</div>`;
    return;
  }

  // === MODE ABONNEMENT (classique) ===
  const dates=getWeekDates(adminWeekOffset);
  const wk=getWeekNum(dates[0]);
  document.getElementById('admin-cal-week-label').textContent=`Semaine ${wk} — ${MONTHS[dates[0].getMonth()]} ${dates[0].getFullYear()}`;
  const isos=dates.map(d=>d.toISOString().split('T')[0]);
  let q=sb.from('sessions').select('*,programmes(name,color,icon)').in('date',isos).order('sort_order',{ascending:true,nullsFirst:false}).order('created_at');
  if(progId)q=q.eq('programme_id',progId);
  const {data}=await q;
  const byDate={};
  isos.forEach(iso=>byDate[iso]=[]);
  (data||[]).forEach(s=>{if(byDate[s.date])byDate[s.date].push(s);});
  const cal=document.getElementById('admin-calendar');
  // Headers
  const headers=dates.map(d=>`<div class="cal-day-header">${DAYS[d.getDay()]}</div>`).join('');
  // Dates row
  const today=new Date().toISOString().split('T')[0];
  const dateRow=dates.map(d=>{
    const iso=d.toISOString().split('T')[0];
    return`<div class="cal-day-date ${iso===today?'today':''}">${d.getDate()}</div>`;
  }).join('');
  // Sessions per day — rendu RICHE (mini-fiche avant/après)
  const sessionCols=dates.map(d=>{
    const iso=d.toISOString().split('T')[0];
    const sessions=byDate[iso]||[];
    const blocks=sessions.length>0
      ?sessions.map(s=>{
        if(s.type==='separator'){
          return`<div class="cal-rich separator" data-session-id="${s.id}"
            draggable="true"
            ondragstart="onSessionDragStart(event,'${s.id}')"
            ondragend="onSessionDragEnd(event)"
            onclick="openReadSession('${s.id}','session')">
            <div class="cal-rich-actions" style="display:flex;position:absolute;top:2px;right:2px">
              <button class="cal-action-btn" onclick="event.stopPropagation();editSession('${s.id}')">✏</button>
              <button class="cal-action-btn" onclick="event.stopPropagation();deleteSession('${s.id}')">✕</button>
            </div>
            <div class="cal-rich-title">— ${escapeHtml(s.title||'Séparateur')} —</div>
          </div>`;
        }
        const color=s.color||'#e8ff47';
        const typeLabel=TYPE_LABELS[s.type]||s.type;
        // Aperçu contenu (strip HTML, charges remplacées)
        const rawContent=s.content||'';
        const withCharges=renderContentWithCharges(rawContent);
        const preview=stripHtml(withCharges).slice(0,160);
        const intensity=s.intensity?`<span>I${s.intensity}/10</span><span class="dot"></span>`:'';
        const sets=s.sets?`<span>${s.sets} séries</span><span class="dot"></span>`:'';
        const yt=s.youtube_url?`<span>▶ vidéo</span>`:'';
        return`<div class="cal-rich"
          draggable="true"
          data-session-id="${s.id}"
          data-date="${s.date}"
          ondragstart="onSessionDragStart(event,'${s.id}')"
          ondragend="onSessionDragEnd(event)"
          onclick="openReadSession('${s.id}','session')">
          <div class="cal-accent" style="background:${color}"></div>
          <div class="cal-rich-head">
            <span class="cal-rich-type" style="background:${color}22;color:${color}">${typeLabel}</span>
            <div class="cal-rich-actions">
              <button class="cal-action-btn" onclick="event.stopPropagation();moveSession('${s.id}','up','${iso}')">↑</button>
              <button class="cal-action-btn" onclick="event.stopPropagation();moveSession('${s.id}','down','${iso}')">↓</button>
              <button class="cal-action-btn" onclick="event.stopPropagation();editSession('${s.id}')">✏</button>
              <button class="cal-action-btn" onclick="event.stopPropagation();duplicateSession('${s.id}')">📋</button>
              <button class="cal-action-btn" onclick="event.stopPropagation();deleteSession('${s.id}')">✕</button>
            </div>
          </div>
          <div class="cal-rich-title">${escapeHtml(s.title||'')}</div>
          ${preview?`<div class="cal-rich-content">${escapeHtml(preview)}</div>`:''}
          <div class="cal-rich-meta">${intensity}${sets}${yt}</div>
        </div>`;
      }).join('')
      :`<div class="cal-empty-day" onclick="quickAddSession('${iso}')">+</div>`;
    const addMore=sessions.length>0
      ? `<button class="cal-add-more" onclick="quickAddSession('${iso}')" title="Ajouter une séance"><span class="plus">+</span>Séance</button>`
      : '';
    return`<div class="cal-day-col rich"
      data-date="${iso}"
      ondragover="onCalDragOver(event)"
      ondragleave="onCalDragLeave(event)"
      ondrop="onCalDrop(event,'${iso}')">${blocks}${addMore}</div>`;
  }).join('');

  cal.innerHTML=`<div class="cal-grid">${headers}</div><div class="cal-grid">${dateRow}</div><div class="cal-grid" style="align-items:start">${sessionCols}</div>`;
}

async function moveSession(sessionId, direction, date){
  // Charger toutes les sessions de ce jour dans l'ordre actuel
  const progId=document.getElementById('admin-filter-prog').value;
  let q=sb.from('sessions').select('id,sort_order').eq('date',date).order('sort_order',{ascending:true,nullsFirst:false}).order('created_at');
  if(progId)q=q.eq('programme_id',progId);
  const {data:sessions}=await q;
  if(!sessions||sessions.length<2)return;

  const idx=sessions.findIndex(s=>s.id===sessionId);
  if(idx===-1)return;
  const targetIdx=direction==='up'?idx-1:idx+1;
  if(targetIdx<0||targetIdx>=sessions.length)return;

  // Échanger les sort_order
  const aId=sessions[idx].id;
  const bId=sessions[targetIdx].id;
  const aOrder=idx*10;
  const bOrder=targetIdx*10;

  await Promise.all([
    sb.from('sessions').update({sort_order:bOrder}).eq('id',aId),
    sb.from('sessions').update({sort_order:aOrder}).eq('id',bId)
  ]);
  loadAdminCalendar();
}

// DRAG & DROP CALENDRIER
let draggingSessionId=null;
function onSessionDragStart(event,sessionId){
  draggingSessionId=sessionId;
  event.target.classList.add('dragging');
  event.dataTransfer.effectAllowed='move';
}
function onSessionDragEnd(event){
  event.target.classList.remove('dragging');
  document.querySelectorAll('.cal-day-col').forEach(c=>c.classList.remove('drag-over'));
}
function onCalDragOver(event){
  event.preventDefault();
  event.dataTransfer.dropEffect='move';
  event.currentTarget.classList.add('drag-over');
}
function onCalDragLeave(event){
  event.currentTarget.classList.remove('drag-over');
}
async function onCalDrop(event,targetDate){
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  if(!draggingSessionId)return;
  const {error}=await sb.from('sessions').update({date:targetDate}).eq('id',draggingSessionId);
  draggingSessionId=null;
  if(error){showToast('❌ '+error.message);return;}
  showToast('✅ Séance déplacée !');
  loadAdminCalendar();
}

function changeAdminWeek(dir){
  const progId=document.getElementById('admin-filter-prog')?.value;
  const prog=getProgById(progId);
  if(isOneshotProg(prog)){
    const total=prog.total_weeks||8;
    adminWeekOffset=Math.max(0,Math.min(total-1,adminWeekOffset+dir));
  } else {
    adminWeekOffset+=dir;
  }
  loadAdminCalendar();
}

function isLightColor(hex){
  const r=parseInt(hex.slice(1,3),16);const g=parseInt(hex.slice(3,5),16);const b=parseInt(hex.slice(5,7),16);
  return(r*299+g*587+b*114)/1000>128;
}

async function loadAdminSessions(){loadAdminCalendar();}

let editingSessionId=null;

async function editSession(id){
  // S'assurer qu'on n'est pas en mode perso et que le form est dans son emplacement original
  if(personalAthleteId){exitPersoForm();}
  const {data}=await sb.from('sessions').select('*').eq('id',id).single();
  if(!data)return;
  editingSessionId=id;
  document.getElementById('f-prog').value=data.programme_id;
  document.getElementById('f-date').value=data.date;
  // One-shot : pré-remplir semaine + jour
  onFProgChange();
  if(data.week_number){
    const wsel=document.getElementById('f-week');
    if(wsel)wsel.value=data.week_number;
  }
  if(data.day_of_week!=null){
    const dsel=document.getElementById('f-dow');
    if(dsel)dsel.value=data.day_of_week;
  }
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
  // Scaling
  document.getElementById('f-scaling-inter').value=data.scaling_inter||'';
  document.getElementById('f-scaling-scaled').value=data.scaling_scaled||'';
  document.getElementById('f-scaling-foundation').value=data.scaling_foundation||'';
  // Multi score
  if(data.multi_score){
    multiScoreEnabled=true;
    document.getElementById('multi-score-toggle').classList.add('on');
    document.getElementById('multi-score-fields').style.display='block';
    document.getElementById('f-score-label1').value=data.score_label1||'';
    document.getElementById('f-score-label2').value=data.score_label2||'';
    document.getElementById('f-score-note').value=data.score_note_label||'';
  }
  // Couleur
  if(data.color){
    selectedSessionColor=data.color;
    document.querySelectorAll('#f-colors .color-swatch').forEach(s=>s.classList.toggle('selected',s.dataset.color===data.color));
  }
  if(data.type==='strength'){
    document.getElementById('sets-field').style.display='block';
    document.getElementById('f-sets').value=data.sets||'';
  }
  const btn=document.querySelector('#admin-new-session .btn-primary');
  btn.textContent='💾 Sauvegarder les modifications';
  btn.style.background='var(--blue)';
  // Ajouter bouton retour si pas déjà là
  let cancelBtn=document.getElementById('edit-cancel-btn');
  if(!cancelBtn){
    cancelBtn=document.createElement('button');
    cancelBtn.id='edit-cancel-btn';
    cancelBtn.className='btn-secondary';
    cancelBtn.textContent='← Retour au calendrier';
    cancelBtn.onclick=()=>{
      editingSessionId=null;
      btn.textContent='Publier la séance';
      btn.style.background='';
      cancelBtn.remove();
      adminTab('sessions',document.querySelector('.admin-tab-btn:nth-child(3)'));
    };
    btn.insertAdjacentElement('afterend',cancelBtn);
  }
  // Bascule fiable vers l'onglet « + Séance » (Séance+) via la fonction
  // officielle adminTab() — assure que tous les effets de bord se déclenchent
  // (panels wellness, etc.) et pas seulement les classes CSS.
  const newSessionTabBtn=document.querySelector('.admin-tab-btn[onclick*="new-session"]')
    ||document.querySelector('.admin-tab-btn:nth-child(2)');
  if(newSessionTabBtn&&typeof adminTab==='function'){
    adminTab('new-session',newSessionTabBtn);
  } else {
    document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('admin-new-session').classList.add('active');
    if(newSessionTabBtn)newSessionTabBtn.classList.add('active');
  }
  // Scroll en haut du formulaire
  const pageAdmin=document.getElementById('page-admin');
  if(pageAdmin)pageAdmin.scrollTop=0;
  showToast('✏️ Mode édition — modifie et sauvegarde');
}

async function saveSession(){
  const progId=document.getElementById('f-prog').value;
  const date=document.getElementById('f-date').value;
  const type=document.getElementById('f-type').value;
  const title=document.getElementById('f-title').value.trim();
  const content=getEditorContent();
  const intensity=parseInt(document.getElementById('f-intensity').value);
  const target=document.getElementById('f-target').value.trim();
  const tips=document.getElementById('f-tips').value.trim();
  const scoreType=document.getElementById('f-score-type').value;
  syncLegacyVideoFields();
  const videos=getFormVideos();
  const youtube=videos[0]?.url||'';
  const ytlabel=videos[0]?.label||'';
  const sets=type==='strength'?parseInt(document.getElementById('f-sets').value)||null:null;
  const color=selectedSessionColor||'#e8ff47';
  const scalingInter=document.getElementById('f-scaling-inter').value.trim();
  const scalingScaled=document.getElementById('f-scaling-scaled').value.trim();
  const scalingFoundation=document.getElementById('f-scaling-foundation').value.trim();
  const multiScore=multiScoreEnabled;
  const scoreCount=multiScore?parseInt(document.getElementById('f-score-count')?.value)||2:0;
  const scoreLabels=multiScore?Array.from({length:scoreCount},(_,i)=>document.getElementById(`f-score-label-${i}`)?.value.trim()||`Score ${i+1}`):[];
  // Mode one-shot : on lit semaine/jour au lieu de date
  const prog=getProgById(progId);
  const oneshot=!personalAthleteId&&isOneshotProg(prog);
  const weekNumber=oneshot?(parseInt(document.getElementById('f-week').value)||1):null;
  const dayOfWeek=oneshot?(parseInt(document.getElementById('f-dow').value)||0):null;
  if(!progId&&!personalAthleteId){showToast('⚠️ Programme requis');return;}
  if(!oneshot&&!date){showToast('⚠️ Date requise');return;}

  // Pour one-shot: on stocke une date synthétique (1970+N) pour rester compatible NOT NULL,
  // mais week_number/day_of_week sont la source de vérité.
  const storedDate=oneshot?`2000-01-${String(((weekNumber-1)*7+dayOfWeek+1)%28+1).padStart(2,'0')}`:date;
  const payload={
    date:storedDate,
    week_number:oneshot?weekNumber:null,
    day_of_week:oneshot?dayOfWeek:null,
    type,title,content,intensity,
    target:target||null,tips:tips||null,score_type:scoreType,
    youtube_url:youtube||null,youtube_label:ytlabel||null,videos:videos.length?videos:null,sets,color,
    scaling_inter:scalingInter||null,scaling_scaled:scalingScaled||null,scaling_foundation:scalingFoundation||null,
    multi_score:multiScore,score_count:scoreCount||null,
    score_labels:scoreLabels.length?JSON.stringify(scoreLabels):null,
    score_label1:scoreLabels[0]||null,score_label2:scoreLabels[1]||null,score_note_label:scoreLabels[scoreLabels.length-1]||null
  };

  let error;
  if(personalAthleteId){
    payload.athlete_id=personalAthleteId;
    if(personalEditingId){
      ({error}=await sb.from('personal_sessions').update(payload).eq('id',personalEditingId));
    } else {
      ({error}=await sb.from('personal_sessions').insert({...payload,created_by:currentUser.id}));
    }
  } else {
    payload.programme_id=progId;
    if(editingSessionId){
      ({error}=await sb.from('sessions').update(payload).eq('id',editingSessionId));
    } else {
      ({error}=await sb.from('sessions').insert({...payload,created_by:currentUser.id}));
    }
  }

  if(error){showToast('❌ '+error.message);return;}

  // Reset
  const wasEditing=!!(editingSessionId||personalEditingId);
  const wasPerso=!!personalAthleteId;
  const persoAthlete=personalAthleteId;
  editingSessionId=null;
  personalEditingId=null;
  const cancelBtn=document.getElementById('edit-cancel-btn');
  if(cancelBtn)cancelBtn.remove();
  ['f-title','f-target','f-tips','f-scaling-inter','f-scaling-scaled','f-scaling-foundation'].forEach(id=>document.getElementById(id).value='');
  setFormVideos([]);
  clearEditor();
  document.getElementById('score-labels-container').innerHTML='';
  document.getElementById('f-intensity').value=7;document.getElementById('f-int-val').textContent='7';
  document.getElementById('f-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('f-score-type').value='time';
  multiScoreEnabled=false;
  document.getElementById('multi-score-toggle').classList.remove('on');
  document.getElementById('multi-score-fields').style.display='none';
  const btn=document.querySelector('#admin-new-session .btn-primary');
  btn.textContent='Publier la séance';btn.style.background='';
  showToast(wasEditing?'✅ Séance modifiée !':'✅ Séance publiée !');
  if(wasPerso){
    // Retour à la fiche perso
    personalAthleteId=null;
    document.getElementById('form-perso-banner').style.display='none';
    document.getElementById('form-prog-group').style.display='';
    if(persoAthlete){
      currentPersoAthlete=persoAthletesCache.find(a=>a.id===persoAthlete)||currentPersoAthlete;
      adminTab('perso',document.querySelector('.admin-tab-btn:last-child'));
      openPersoFiche(persoAthlete, date||null);
    }
  } else {
    // Si on est arrivé depuis l'onglet "Séances" via le bouton +, on y retourne
    if(window._returnToSessionsAfterSave){
      window._returnToSessionsAfterSave=false;
      const sessionsTabBtn=document.querySelector('.admin-tab-btn:nth-child(3)');
      adminTab('sessions',sessionsTabBtn);
      loadAdminCalendar();
    } else {
      loadAdminSessions();
    }
  }
}

async function duplicateSession(id){
  const {data}=await sb.from('sessions').select('*').eq('id',id).single();
  if(!data)return;
  openDuplicateModal(data);
}

let sessionToDuplicate=null;
let dupDest='prog'; // 'prog' | 'perso'
let dupMixedAthletesCache=null;

function setDupDest(dest){
  dupDest=dest;
  document.querySelectorAll('.dup-dest-btn').forEach(b=>{
    const on=b.dataset.dest===dest;
    b.classList.toggle('active',on);
    b.style.background=on?'var(--card2)':'var(--card)';
    b.style.borderColor=on?'var(--accent)':'var(--border2)';
    b.style.color=on?'var(--text)':'var(--muted)';
  });
  document.getElementById('dup-prog-group').style.display=dest==='prog'?'':'none';
  document.getElementById('dup-athlete-group').style.display=dest==='perso'?'':'none';
}

async function loadMixedAthletes(){
  // On charge TOUS les athlètes (le coach décide qui est en prog mixte).
  // On compte les programmes assignés pour afficher un indicateur, mais on ne filtre pas.
  let rows=[];
  const r1=await sb.from('athlete_programmes').select('athlete_id');
  if(!r1.error&&r1.data)rows=r1.data;
  const r2=await sb.from('programme_access').select('athlete_id');
  if(!r2.error&&r2.data)rows=rows.concat(r2.data);
  const counts={};
  rows.forEach(r=>{if(r.athlete_id)counts[r.athlete_id]=(counts[r.athlete_id]||0)+1;});
  if(!persoAthletesCache.length){
    const {data}=await sb.from('profiles').select('*').order('full_name');
    persoAthletesCache=data||[];
  }
  // Tous les profils, athlètes mixtes (≥2 progs) en tête.
  const list=persoAthletesCache
    .filter(a=>a.role!=='admin')
    .map(a=>({...a,_progCount:counts[a.id]||0}));
  list.sort((a,b)=>{
    const am=a._progCount>=2?0:1, bm=b._progCount>=2?0:1;
    if(am!==bm)return am-bm;
    return (a.full_name||'').localeCompare(b.full_name||'');
  });
  return list;
}

async function openDuplicateModal(session){
  sessionToDuplicate=session;
  document.getElementById('dup-session-name').textContent=session.title;
  document.getElementById('dup-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('dup-prog').innerHTML=programmes.map(p=>`<option value="${p.id}" ${p.id===session.programme_id?'selected':''}>${p.icon||'💪'} ${p.name}</option>`).join('');
  // Athlètes prog mixte
  const athSel=document.getElementById('dup-athlete');
  athSel.innerHTML='<option value="">Chargement…</option>';
  setDupDest('prog');
  document.getElementById('dup-modal').classList.add('open');
  const mixed=await loadMixedAthletes();
  dupMixedAthletesCache=mixed;
  if(!mixed.length){
    athSel.innerHTML='<option value="">— Aucun athlète —</option>';
  } else {
    athSel.innerHTML=mixed.map(a=>{
      const tag=a._progCount>=2?` · ${a._progCount} progs 🔀`:(a._progCount===1?` · 1 prog`:'');
      return `<option value="${a.id}">${escapeHtml(a.full_name||a.email||'Athlète')}${tag}</option>`;
    }).join('');
  }
}
function closeDupModal(){document.getElementById('dup-modal').classList.remove('open');sessionToDuplicate=null;}
async function confirmDuplicate(){
  if(!sessionToDuplicate)return;
  const date=document.getElementById('dup-date').value;
  if(!date){showToast('⚠️ Choisis une date');return;}
  const {id,created_at,programme_id,athlete_id,is_benchmark,benchmark_id,week_number,day_of_week,...baseRest}=sessionToDuplicate;
  // Pour la cible perso, on neutralise les champs one-shot (semaine/jour) car les séances perso sont datées.
  if(dupDest==='perso'){
    const athId=document.getElementById('dup-athlete').value;
    if(!athId){showToast('⚠️ Choisis un athlète en prog mixte');return;}
    const payload={...baseRest,date,athlete_id:athId,created_by:currentUser.id};
    const {error}=await sb.from('personal_sessions').insert(payload);
    if(error){showToast('❌ '+error.message);return;}
    const ath=(dupMixedAthletesCache||[]).find(a=>a.id===athId);
    showToast('✅ Copiée dans l\'espace perso de '+(ath?.full_name||'l\'athlète'));
  } else {
    const progId=document.getElementById('dup-prog').value;
    if(!progId){showToast('⚠️ Choisis un programme');return;}
    const restWithFlags={...baseRest};
    if(typeof is_benchmark!=='undefined')restWithFlags.is_benchmark=is_benchmark;
    if(typeof benchmark_id!=='undefined')restWithFlags.benchmark_id=benchmark_id;
    if(typeof week_number!=='undefined')restWithFlags.week_number=week_number;
    if(typeof day_of_week!=='undefined')restWithFlags.day_of_week=day_of_week;
    const {error}=await sb.from('sessions').insert({...restWithFlags,programme_id:progId,date,created_by:currentUser.id});
    if(error){showToast('❌ '+error.message);return;}
    showToast('✅ Séance dupliquée !');
  }
  closeDupModal();
  loadAdminSessions();
}
async function loadAdminBenchmarks(){
  loadAdminMovements();
  const {data}=await sb.from('benchmarks').select('*').order('category,name');
  const el=document.getElementById('admin-bench-list');
  if(!data||data.length===0){el.innerHTML='';return;}
  el.innerHTML=`<div class="pr-hist-title">${data.length} benchmarks actifs</div>`+data.map(b=>`<div class="sessions-list-item"><div><div class="sli-title">${b.name}</div><div class="sli-meta">${b.category} · ${b.score_type}</div></div></div>`).join('');
}
async function loadAdminMovements(){
  const el=document.getElementById('admin-mv-list');
  if(!el)return;
  const q=(document.getElementById('admin-mv-search')?.value||'').toLowerCase().trim();
  const {data}=await sb.from('movements').select('*').order('category,name');
  let list=data||[];
  // Détection des doublons (même nom normalisé)
  const norm=s=>s.toLowerCase().replace(/\s+/g,' ').trim();
  const counts={};list.forEach(m=>{const k=norm(m.name);counts[k]=(counts[k]||0)+1;});
  if(q)list=list.filter(m=>m.name.toLowerCase().includes(q)||(m.category||'').toLowerCase().includes(q));
  if(!list.length){el.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px 0">Aucun mouvement.</div>';return;}
  el.innerHTML=`<div style="font-size:11px;color:var(--muted);margin-bottom:6px">${list.length} mouvement${list.length>1?'s':''}</div>`+list.map(m=>{
    const dup=counts[norm(m.name)]>1;
    const inactive=m.is_active===false;
    return `<div class="sessions-list-item" style="${dup?'border-left:3px solid var(--orange);padding-left:8px':''}">
      <div style="flex:1;min-width:0">
        <div class="sli-title" style="${inactive?'opacity:.5;text-decoration:line-through':''}">${m.name}${dup?' <span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(255,140,71,.2);color:var(--orange);margin-left:6px;letter-spacing:.5px">DOUBLON</span>':''}${inactive?' <span style="font-size:9px;color:var(--muted)">(masqué)</span>':''}</div>
        <div class="sli-meta">${m.category||'—'}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn-delete" onclick="openEditMovement('${m.id}')" title="Modifier" style="background:transparent;border:1px solid var(--border2);color:var(--accent);padding:6px 10px;border-radius:6px;font-size:11px;cursor:pointer">✎</button>
        <button class="btn-delete" onclick="toggleMovementActive('${m.id}',${!inactive})" title="${inactive?'Réactiver':'Masquer'}" style="background:transparent;border:1px solid var(--border2);color:var(--muted);padding:6px 10px;border-radius:6px;font-size:11px;cursor:pointer">${inactive?'Réact.':'Masquer'}</button>
        <button class="btn-delete" onclick="deleteMovement('${m.id}','${m.name.replace(/'/g,"\\'")}')">✕</button>
      </div>
    </div>`;
  }).join('');
}
async function addNewMovement(){
  const name=document.getElementById('new-mv-name')?.value.trim();
  const category=document.getElementById('new-mv-cat')?.value||'autre';
  const unit=document.getElementById('new-mv-unit')?.value.trim()||'kg';
  let formats=document.getElementById('new-mv-formats')?.value.trim()||'';
  // Auto-fill formats par défaut selon catégorie si vide
  if(!formats){
    if(category==='haltero'||category==='force')formats='1RM,3RM,5RM,10RM';
    else if(category==='gymnastic')formats='Max Reps,Max Hold';
  }
  if(!name){showToast('⚠️ Nom requis');return;}
  const {error}=await sb.from('movements').insert({name,category,unit,available_formats:formats||null,is_active:true});
  if(error){showToast('❌ '+error.message);return;}
  showToast('✅ Mouvement ajouté !');
  document.getElementById('new-mv-name').value='';
  document.getElementById('new-mv-formats').value='';
  await loadMovements();
  loadAdminMovements();
}
async function toggleMovementActive(id,deactivate){
  const {error}=await sb.from('movements').update({is_active:!deactivate}).eq('id',id);
  if(error){showToast('❌ '+error.message);return;}
  showToast(deactivate?'🙈 Mouvement masqué':'✅ Mouvement réactivé');
  await loadMovements();loadAdminMovements();
}

let _editingMovementId=null;
async function openEditMovement(id){
  const m=movements.find(x=>x.id===id);
  if(!m){showToast('⚠️ Mouvement introuvable');return;}
  _editingMovementId=id;
  const name=prompt('Nom du mouvement :',m.name||'');
  if(name===null)return;
  const category=prompt('Catégorie (haltero / force / gymnastic / cardio / autre) :',m.category||'autre');
  if(category===null)return;
  const unit=prompt('Unité (kg, reps, m, s…) :',m.unit||'kg');
  if(unit===null)return;
  const formats=prompt('Formats (séparés par virgules, ex: 1RM,3RM,5RM,10RM) :',m.available_formats||'');
  if(formats===null)return;
  const {error}=await sb.from('movements').update({name:name.trim(),category:category.trim()||'autre',unit:unit.trim()||'kg',available_formats:formats.trim()||null}).eq('id',id);
  if(error){showToast('❌ '+error.message);return;}
  showToast('✅ Mouvement modifié');
  await loadMovements();
  loadAdminMovements();
  if(document.getElementById('page-pr')?.classList.contains('active'))renderAll();
}
async function deleteMovement(id,name){
  if(!confirm(`Supprimer définitivement « ${name} » ?\n\nLes PR liés seront aussi supprimés.`))return;
  const {error}=await sb.from('movements').delete().eq('id',id);
  if(error){showToast('❌ '+error.message+' — essaie « Masquer » à la place');return;}
  showToast('🗑️ Mouvement supprimé');
  await loadMovements();loadAdminMovements();
}
async function saveBenchmark(){
  const name=document.getElementById('b-name').value.trim();
  const desc=document.getElementById('b-desc').value.trim();
  const content=document.getElementById('b-content').value.trim();
  const scoreType=document.getElementById('b-score-type').value;
  const category=document.getElementById('b-category').value;
  if(!name){showToast('⚠️ Nom requis');return;}
  const {error}=await sb.from('benchmarks').insert({name,description:desc,content,score_type:scoreType,category,created_by:currentUser.id});
  if(error){showToast('❌ '+error.message);return;}
  showToast('✅ Benchmark créé !');
  ['b-name','b-desc','b-content'].forEach(id=>document.getElementById(id).value='');
  await loadBenchmarks();loadAdminBenchmarks();
}
async function loadAdminAthletes(){
  const {data}=await sb.from('profiles').select('*').order('full_name');
  const list=document.getElementById('admin-athletes-list');
  if(!data||data.length===0){list.innerHTML='<div class="empty"><p>Aucun athlète.</p></div>';return;}
  list.innerHTML=data.map(p=>{
    const init=(p.full_name||p.email||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const isMe=p.id===currentUser.id;
    return`<div class="athlete-row">
      <div class="athlete-avatar">${init}</div>
      <div style="flex:1;min-width:0">
        <div class="athlete-name">${p.full_name||'—'}</div>
        <div class="athlete-email">${p.email||''}</div>
      </div>
      <span class="athlete-role ${p.role==='admin'?'role-admin':'role-athlete'}">${p.role==='admin'?'Admin':'Athlète'}</span>
      ${isMe?'':`<button class="btn-delete" onclick="deleteAthlete('${p.id}','${(p.full_name||p.email||'?').replace(/'/g,"\\'")}')">✕</button>`}
    </div>`;
  }).join('');
}
async function deleteAthlete(id,name){
  if(!confirm(`⚠️ Supprimer définitivement "${name}" ?\n\nToutes ses données (scores, PR, séances perso) seront effacées.\n\nCette action est irréversible.`))return;
  // Cascade silencieuse (warn si table absente)
  const tables=['wod_scores','athlete_prs','athlete_scores','athlete_programmes','programme_access','personal_sessions','bench_scores','benchmark_scores','session_notes'];
  for(const t of tables){
    const r=await sb.from(t).delete().eq('athlete_id',id);
    if(r.error)console.warn(t,r.error.message);
  }
  const {error,data}=await sb.from('profiles').delete().eq('id',id).select();
  if(error){showToast('❌ '+error.message);console.error('delete profile',error);return;}
  if(!data||data.length===0){
    showToast('⚠️ Athlète non supprimé (RLS ?). Vérifie la console.');
    console.warn('Profile delete returned no rows. Probable RLS policy missing for DELETE on profiles. Tu dois ajouter une policy admin DELETE ou utiliser un appel admin via service_role.');
    return;
  }
  showToast('🗑 Athlète supprimé');
  loadAdminAthletes();
}
function adminTab(tab,btn){
  // Si l'utilisateur quitte le formulaire "+ Séance" sans valider, on annule le retour auto
  if(tab!=='new-session')window._returnToSessionsAfterSave=false;
  document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
  document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById(`admin-${tab}`).classList.add('active');
  if(tab==='sessions')loadAdminSessions();
  if(tab==='athletes')loadAdminAthletes();
  if(tab==='progs')loadAdminProgs();
  if(tab==='benchmarks')loadAdminBenchmarks();
  if(tab==='dashboard')loadDashboard();
  if(tab==='videos'){loadAdminVideos();populateVideoMovementSelect();}
  if(tab==='perso')loadPersoAthletes();
  if(tab==='cycle')initCyclePlanner();
}

// ===== DASHBOARD COACH =====
async function _dashEmbedExtras(){
  const dash=document.getElementById('admin-dashboard');if(!dash)return;
  const wMount=document.getElementById('dash-wellness-section');
  const aMount=document.getElementById('dash-athletes-section');
  if(!wMount||!aMount)return;
  // Wellness — recharge puis clone
  if(typeof loadWellnessAdmin==='function')try{await loadWellnessAdmin();}catch(e){}
  const wSrc=document.getElementById('admin-wellness');
  if(wSrc){
    const wClone=wSrc.cloneNode(true);
    wClone.id='admin-wellness-dash';
    wClone.className='';wClone.style.cssText='padding:0';
    // décale les ids dupliqués pour éviter conflits
    wClone.querySelectorAll('[id]').forEach(el=>{el.id='dash-'+el.id;});
    wMount.innerHTML='<div style="font-family:Bebas Neue,sans-serif;font-size:18px;letter-spacing:2px;margin:0 0 12px;border-top:1px solid var(--border);padding-top:20px">💚 WELLNESS</div>';
    wMount.appendChild(wClone);
  }
  // Athlètes — recharge puis clone
  if(typeof loadAdminAthletes==='function')try{await loadAdminAthletes();}catch(e){}
  const aSrc=document.getElementById('admin-athletes');
  if(aSrc){
    const aClone=aSrc.cloneNode(true);
    aClone.id='admin-athletes-dash';
    aClone.className='';aClone.style.cssText='padding:0';
    aClone.querySelectorAll('[id]').forEach(el=>{el.id='dash-'+el.id;});
    // cache la fiche athlète clonée
    const card=aClone.querySelector('#dash-admin-athlete-card');if(card)card.style.display='none';
    aMount.innerHTML='<div style="font-family:Bebas Neue,sans-serif;font-size:18px;letter-spacing:2px;margin:0 0 12px;border-top:1px solid var(--border);padding-top:20px">👥 ATHLÈTES</div>';
    aMount.appendChild(aClone);
    // Rendre les rows clonés cliquables : bascule sur l'onglet Athlètes + ouvre la fiche
    aClone.querySelectorAll('.athlete-row').forEach(row=>{
      row.style.cursor='pointer';
      row.addEventListener('click',(e)=>{
        if(e.target.closest('.btn-delete'))return;
        const btn=row.querySelector('.btn-delete');
        const m=btn&&btn.getAttribute('onclick')&&btn.getAttribute('onclick').match(/deleteAthlete\('([^']+)'/);
        if(!m)return;
        openAthleteFicheFromDash(m[1]);
      });
    });
  }
}
async function loadDashboard(){
  const thirtyDaysAgo=new Date(Date.now()-30*24*60*60*1000).toISOString();
  const sevenDaysAgo=new Date(Date.now()-7*24*60*60*1000).toISOString();

  const [athletesRes,scoresRes,prsRes,activeRes]=await Promise.all([
    sb.from('profiles').select('id',{count:'exact'}).eq('role','athlete'),
    sb.from('wod_scores').select('id',{count:'exact'}).gte('created_at',thirtyDaysAgo),
    sb.from('athlete_prs').select('id',{count:'exact'}).gte('created_at',thirtyDaysAgo),
    sb.from('wod_scores').select('athlete_id').gte('created_at',sevenDaysAgo)
  ]);

  const activeIds=new Set((activeRes.data||[]).map(s=>s.athlete_id));
  document.getElementById('dash-stats').innerHTML=`
    <div class="dash-stat-box"><div class="dash-stat-val">${athletesRes.count||0}</div><div class="dash-stat-lbl">Athlètes</div></div>
    <div class="dash-stat-box"><div class="dash-stat-val">${activeIds.size}</div><div class="dash-stat-lbl">Actifs 7j</div></div>
    <div class="dash-stat-box"><div class="dash-stat-val">${scoresRes.count||0}</div><div class="dash-stat-lbl">Scores 30j</div></div>
    <div class="dash-stat-box"><div class="dash-stat-val">${prsRes.count||0}</div><div class="dash-stat-lbl">PR 30j</div></div>`;

  // Athlètes inactifs
  const {data:allAthletes}=await sb.from('profiles').select('id,full_name,email').eq('role','athlete');
  const inactiveAthletes=(allAthletes||[]).filter(a=>!activeIds.has(a.id));
  const inactiveEl=document.getElementById('dash-inactive');
  if(inactiveAthletes.length===0){inactiveEl.innerHTML='<div style="font-size:13px;color:var(--muted);padding:8px 0">Tous les athlètes sont actifs 💪</div>';}
  else{
    // Chercher la dernière activité de chaque athlète inactif
    const inactiveWithDays=await Promise.all(inactiveAthletes.slice(0,5).map(async a=>{
      const {data}=await sb.from('wod_scores').select('created_at').eq('athlete_id',a.id).order('created_at',{ascending:false}).limit(1);
      const lastDate=data?.[0]?.created_at;
      const days=lastDate?Math.floor((Date.now()-new Date(lastDate))/(24*60*60*1000)):999;
      return{...a,days};
    }));
    inactiveEl.innerHTML=inactiveWithDays.map(a=>`<div class="inactive-row">
      <div><div class="inactive-name">${a.full_name||a.email||'—'}</div></div>
      <div class="inactive-days">${a.days===999?'Jamais scoré':`${a.days}j sans score`}</div>
    </div>`).join('');
  }

  // Top performers (plus de PR ce mois)
  const {data:topPRs}=await sb.from('athlete_prs').select('athlete_id,profiles(full_name)').gte('created_at',thirtyDaysAgo);
  const prCount={};
  (topPRs||[]).forEach(p=>{prCount[p.athlete_id]=(prCount[p.athlete_id]||{count:0,name:p.profiles?.full_name||'—'});prCount[p.athlete_id].count++;});
  const topList=Object.values(prCount).sort((a,b)=>b.count-a.count).slice(0,5);
  document.getElementById('dash-top').innerHTML=topList.length===0
    ?'<div style="font-size:13px;color:var(--muted);padding:8px 0">Pas encore de PR ce mois</div>'
    :topList.map((t,i)=>`<div class="inactive-row"><div class="inactive-name">${i===0?'🥇':i===1?'🥈':'🥉'} ${t.name}</div><div style="font-size:12px;color:var(--accent);font-weight:700">${t.count} PR</div></div>`).join('');

  // Derniers scores
  const {data:recentScores}=await sb.from('wod_scores').select('*,profiles(full_name,avatar_url),sessions(title)').order('created_at',{ascending:false}).limit(8);
  document.getElementById('dash-recent').innerHTML=(recentScores||[]).map(s=>`<div class="recent-score-row">
    ${avatarHtml(s.profiles)}
    <div class="recent-score-info">
      <div class="recent-score-name">${s.profiles?.full_name||'—'}</div>
      <div class="recent-score-meta">${s.sessions?.title||'—'} · <span class="level-badge lbadge-${s.level}">${LEVEL_LABELS[s.level]||s.level}</span></div>
    </div>
    <div class="recent-score-val">${s.score_text||s.score_value||'—'}</div>
  </div>`).join('');
  await _dashEmbedExtras();
}

// ===== ÉDITEUR RICHE =====
function richColor(color){
  document.getElementById('f-content-editor').focus();
  document.execCommand('foreColor',false,color);
}
function richCmd(cmd){
  document.getElementById('f-content-editor').focus();
  document.execCommand(cmd,false,null);
}
function richFont(type){
  document.getElementById('f-content-editor').focus();
  const sel=window.getSelection();
  if(!sel||sel.rangeCount===0)return;
  const range=sel.getRangeAt(0);
  if(range.collapsed)return;
  const span=document.createElement('span');
  span.className=`font-${type}-applied`;
  try{range.surroundContents(span);}catch(e){
    const frag=range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
  }
  sel.removeAllRanges();
}
function getEditorContent(){
  const editor=document.getElementById('f-content-editor');
  return editor?editor.innerHTML:'';
}
function setEditorContent(html){
  const editor=document.getElementById('f-content-editor');
  if(editor)editor.innerHTML=html||'';
}
function clearEditor(){
  const editor=document.getElementById('f-content-editor');
  if(editor)editor.innerHTML='';
}

// ===== CYCLE PLANNER =====
let cycleData = {
  id: null,
  name: '',
  weeks: 8,
  mode: 'cycle', // 'cycle' ou 'session'
  columns: ['WOD', 'Force', 'Skill', 'Hyrox', 'Team WOD'],
  rows: ['Priorité', 'Modalités', 'Schéma', 'Durée', 'Charge', 'Répétitions', 'Mouvement'],
  cells: {},        // Vue cycle: "week-col"
  sessionCells: {}  // Vue session: "row-day" (day: 0=Lun..5=Sam)
};
const DAYS_SESSION=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
let cycleCellTarget = null;
let selectedChipColor = '#e8ff47';
let allCycles = [];
let cycleMode = 'cycle';

function setCycleMode(mode){
  cycleMode=mode;
  cycleData.mode=mode;
  document.getElementById('mode-btn-cycle').classList.toggle('active',mode==='cycle');
  document.getElementById('mode-btn-session').classList.toggle('active',mode==='session');
  document.getElementById('cycle-config-cycle').style.display=mode==='cycle'?'flex':'none';
  document.getElementById('cycle-config-session').style.display=mode==='session'?'block':'none';
  if(mode==='session')renderSessionRowsConfig();
  renderCycleGrid();
}

function renderSessionRowsConfig(){
  const el=document.getElementById('session-rows-config');
  el.innerHTML=cycleData.rows.map((r,i)=>`
    <div style="display:flex;align-items:center;gap:8px">
      <input type="text" class="form-input" value="${r}" oninput="cycleData.rows[${i}]=this.value;renderCycleGrid();scheduleAutoSaveCycle()" style="flex:1;padding:8px 12px;font-size:13px">
      <button onclick="removeSessionRow(${i})" style="padding:8px 10px;background:rgba(255,68,68,.1);border:1px solid rgba(255,68,68,.3);color:var(--red);border-radius:8px;font-size:12px;cursor:pointer">✕</button>
    </div>`).join('');
}

function addSessionRow(){
  cycleData.rows.push('Nouvelle ligne');
  renderSessionRowsConfig();
  renderCycleGrid();
  scheduleAutoSaveCycle();
}
function removeSessionRow(i){
  cycleData.rows.splice(i,1);
  renderSessionRowsConfig();
  renderCycleGrid();
}


async function initCyclePlanner(){
  await loadAllCycles();
  renderCycleGrid();
}

let cycleYearFilter='all'; // 'all' or 4-digit year as string
async function loadAllCycles(){
  const {data}=await sb.from('cycle_plans').select('id,name,start_date,created_at,weeks,cells,columns').order('start_date',{ascending:false,nullsFirst:false});
  allCycles=data||[];
  renderCycleYearTabs();
  renderCycleSelector();
  renderSeasonOverview();
}
function _cycleYear(c){
  if(c.start_date)return new Date(c.start_date+'T12:00:00').getFullYear();
  if(c.created_at)return new Date(c.created_at).getFullYear();
  return null;
}
function _cycleStartDate(c){
  if(c.start_date)return new Date(c.start_date+'T12:00:00');
  if(c.created_at)return new Date(c.created_at);
  return null;
}
function _cycleEndDate(c){
  const s=_cycleStartDate(c);if(!s)return null;
  const wk=parseInt(c.weeks)||8;
  const e=new Date(s);e.setDate(s.getDate()+wk*7-1);
  return e;
}
function _cycleMonthsInYear(c,year){
  // Retourne les indices de mois (0..11) que le cycle couvre dans `year`
  const s=_cycleStartDate(c),e=_cycleEndDate(c);
  if(!s||!e)return [];
  const months=new Set();
  const cur=new Date(s.getFullYear(),s.getMonth(),1);
  const end=new Date(e.getFullYear(),e.getMonth(),1);
  while(cur<=end){
    if(cur.getFullYear()===year)months.add(cur.getMonth());
    cur.setMonth(cur.getMonth()+1);
  }
  return [...months];
}
// Thèmes : extraits de la colonne "Thème" du cycle
function _themeColumnIndex(c){
  const cols=c.columns||[];
  return cols.findIndex(n=>{
    const s=(n||'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return s.startsWith('them'); // matche theme, thème, themes, thèmes, thématique...
  });
}
function _cycleThemes(c){
  // Récupère les chips de la colonne "Thème", semaine par semaine
  const ci=_themeColumnIndex(c);
  if(ci<0)return [];
  const cells=c.cells||{};
  const out=[];const seen=new Set();
  const weeks=parseInt(c.weeks)||0;
  for(let w=0;w<weeks;w++){
    const arr=cells[`${w}-${ci}`];
    if(!Array.isArray(arr))continue;
    arr.forEach(chip=>{
      const t=(chip&&chip.text||'').trim();
      if(!t)return;
      const key=t.toUpperCase();
      if(seen.has(key))return;
      seen.add(key);
      out.push({text:t,color:chip.color||'#ff8c47'});
    });
  }
  return out;
}

function _cycleTopTags(c,max=4){
  // 1) Priorité aux chips de la colonne "Thème"
  const themes=_cycleThemes(c);
  if(themes.length)return themes.slice(0,max).map(t=>({text:t.text,color:t.color||'#ff8c47',n:1}));
  // 2) Sinon, fallback sur les chips les plus fréquents
  const cells=c.cells||{};
  const counts={};
  Object.entries(cells).forEach(([k,arr])=>{
    if(k==='__themes__'||!Array.isArray(arr))return;
    arr.forEach(chip=>{
      const t=(chip&&chip.text||'').trim();
      if(!t)return;
      const key=t.toUpperCase();
      if(!counts[key])counts[key]={text:t,n:0,color:chip.color||'#ff8c47'};
      counts[key].n++;
    });
  });
  return Object.values(counts).sort((a,b)=>b.n-a.n).slice(0,max);
}
function _fmtDay(d){return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`}
function renderCycleYearTabs(){
  const wrap=document.getElementById('cycle-year-tabs');
  if(!wrap)return;
  const years=[...new Set(allCycles.map(_cycleYear).filter(Boolean))].sort((a,b)=>b-a);
  let html=`<button class="year-tab ${cycleYearFilter==='all'?'active':''}" onclick="setCycleYear('all')">Tous</button>`;
  html+=years.map(y=>`<button class="year-tab ${cycleYearFilter===String(y)?'active':''}" onclick="setCycleYear('${y}')">${y}</button>`).join('');
  wrap.innerHTML=html;
}
function setCycleYear(y){
  cycleYearFilter=String(y);
  renderCycleYearTabs();
  renderCycleSelector();
  renderSeasonOverview();
}

const MONTHS_FR=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
function renderSeasonOverview(){
  const wrap=document.getElementById('cycle-season-overview');
  if(!wrap)return;
  if(cycleYearFilter==='all'){wrap.style.display='none';wrap.innerHTML='';return;}
  const year=parseInt(cycleYearFilter);
  if(!year){wrap.style.display='none';return;}
  const yearCycles=allCycles.filter(c=>_cycleYear(c)===year ||
    (_cycleStartDate(c)&&_cycleEndDate(c)&&_cycleStartDate(c).getFullYear()<=year&&_cycleEndDate(c).getFullYear()>=year));
  const now=new Date();
  const isCurrentYear=now.getFullYear()===year;
  const totalWeeks=yearCycles.reduce((s,c)=>s+(parseInt(c.weeks)||0),0);

  let html=`<div class="season-head">
    <div>
      <div class="season-title">Saison ${year}</div>
      <div class="season-sub">Vue d'ensemble — mois par mois</div>
    </div>
    <div class="season-stats">
      <div class="season-stat"><div class="season-stat-n">${yearCycles.length}</div><div class="season-stat-l">Cycles</div></div>
      <div class="season-stat"><div class="season-stat-n">${totalWeeks}</div><div class="season-stat-l">Semaines</div></div>
    </div>
  </div>
  <div class="season-months">`;

  for(let m=0;m<12;m++){
    const inMonth=yearCycles.filter(c=>_cycleMonthsInYear(c,year).includes(m));
    const isCurrent=isCurrentYear&&now.getMonth()===m;
    const cls=['season-month'];
    if(isCurrent)cls.push('is-current');
    if(!inMonth.length)cls.push('is-empty');
    html+=`<div class="${cls.join(' ')}">
      <div class="season-month-head">
        <div class="season-month-name">${MONTHS_FR[m]}${isCurrent?' <span class="season-month-now">· en cours</span>':''}</div>
        <div class="season-month-count">${inMonth.length||'—'}</div>
      </div>`;
    if(!inMonth.length){
      html+=`<div class="season-month-empty">Aucun cycle programmé</div>`;
    } else {
      inMonth.forEach(c=>{
        const s=_cycleStartDate(c),e=_cycleEndDate(c);
        const tags=_cycleTopTags(c,4);
        const cellEntries=Object.entries(c.cells||{}).filter(([k])=>k!=='__themes__');
        const totalChips=cellEntries.reduce((n,[,a])=>n+(Array.isArray(a)?a.length:0),0);
        const allTags=_cycleTopTags(c,99);
        const moreTags=Math.max(0,allTags.length-tags.length);
        html+=`<div class="season-cycle" onclick="openCycleFromOverview('${c.id}')" title="Ouvrir ${escapeAttr(c.name||'')}">
          <div class="season-cycle-name">${escapeHtml(c.name||'Cycle sans nom')}</div>
          <div class="season-cycle-meta">
            ${s?`<span><b>${_fmtDay(s)}</b> → <b>${e?_fmtDay(e):'?'}</b></span>`:''}
            <span>${c.weeks||'?'} sem.</span>
            ${totalChips?`<span>${totalChips} séances</span>`:''}
          </div>
          ${tags.length?`<div class="season-cycle-tags">
            ${tags.map(t=>`<span class="season-cycle-tag" style="border-color:${t.color}55;color:${t.color}">${escapeHtml(t.text)}</span>`).join('')}
            ${moreTags>0?`<span class="season-cycle-tag more">+${moreTags}</span>`:''}
          </div>`:''}
        </div>`;
      });
    }
    html+=`</div>`;
  }
  html+=`</div>`;
  wrap.innerHTML=html;
  wrap.style.display='block';
}

function escapeAttr(s){return escapeHtml(s)}

async function openCycleFromOverview(id){
  const sel=document.getElementById('cycle-selector');
  if(sel){sel.value=id;}
  await loadCycle(id);
  // Scroll vers l'éditeur pour voir le cycle chargé
  const target=document.getElementById('cycle-selector');
  if(target&&target.scrollIntoView){target.scrollIntoView({behavior:'smooth',block:'center'});}
}
function renderCycleSelector(){
  const sel=document.getElementById('cycle-selector');
  if(!sel)return;
  const filtered=cycleYearFilter==='all'?allCycles:allCycles.filter(c=>String(_cycleYear(c))===cycleYearFilter);
  const cur=sel.value;
  sel.innerHTML='<option value="">— Sélectionner un cycle —</option>'+filtered.map(c=>{
    const y=_cycleYear(c);return `<option value="${c.id}">${c.name}${y?` · ${y}`:''}</option>`;
  }).join('');
  if(cur&&filtered.find(c=>c.id===cur))sel.value=cur;
}

async function loadCycle(id){
  if(!id){newCycle();return;}
  const {data}=await sb.from('cycle_plans').select('*').eq('id',id).single();
  if(!data)return;
  cycleData={
    id:data.id,name:data.name,
    weeks:data.weeks||8,
    mode:data.mode||'cycle',
    columns:data.columns||['Thème','WOD','Force','Skill'],
    rows:data.rows||['Priorité','Modalités','Schéma','Durée','Charge','Répétitions','Mouvement'],
    cells:data.cells||{},
    sessionCells:data.session_cells||{}
  };
  cycleMode=cycleData.mode;
  document.getElementById('cycle-name').value=cycleData.name;
  document.getElementById('cycle-weeks').value=cycleData.weeks;
  if(data.start_date)document.getElementById('cycle-start-date').value=data.start_date;
  setCycleMode(cycleMode);
}

function newCycle(){
  cycleData={id:null,name:'',weeks:8,mode:'cycle',columns:['Thème','WOD','Force','Skill','Hyrox','Team WOD'],rows:['Priorité','Modalités','Schéma','Durée','Charge','Répétitions','Mouvement'],cells:{},sessionCells:{}};
  cycleMode='cycle';
  document.getElementById('cycle-name').value='';
  document.getElementById('cycle-weeks').value='8';
  document.getElementById('cycle-selector').value='';
  setCycleMode('cycle');
}

async function saveCycle(){
  const name=document.getElementById('cycle-name').value.trim()||'Cycle sans nom';
  const weeks=parseInt(document.getElementById('cycle-weeks').value)||8;
  cycleData.name=name;cycleData.weeks=weeks;

  const startDate=document.getElementById('cycle-start-date')?.value||null;
  const payload={name,weeks,mode:cycleMode,start_date:startDate,columns:cycleData.columns,rows:cycleData.rows,cells:cycleData.cells,session_cells:cycleData.sessionCells,created_by:currentUser.id};

  let error;
  if(cycleData.id){
    ({error}=await sb.from('cycle_plans').update(payload).eq('id',cycleData.id));
  } else {
    const {data,error:e}=await sb.from('cycle_plans').insert(payload).select('id').single();
    error=e;
    if(data)cycleData.id=data.id;
  }
  if(error){showToast('❌ '+error.message);return;}
  showToast('✅ Cycle sauvegardé !');
  await loadAllCycles();
  if(cycleData.id)document.getElementById('cycle-selector').value=cycleData.id;
}

async function deleteCycle(){
  const id=document.getElementById('cycle-selector').value;
  if(!id){showToast('⚠️ Sélectionne un cycle');return;}
  await sb.from('cycle_plans').delete().eq('id',id);
  showToast('🗑 Cycle supprimé');
  newCycle();
  await loadAllCycles();
}

function addCycleColumn(){
  const name=prompt('Nom de la colonne ?')||'Nouveau';
  cycleData.columns.push(name);
  renderCycleGrid();
  scheduleAutoSaveCycle();
}

function renderCycleGrid(){
  if(cycleMode==='session'){renderSessionGrid();return;}
  const weeks=parseInt(document.getElementById('cycle-weeks')?.value)||cycleData.weeks||8;
  const cols=cycleData.columns;
  const grid=document.getElementById('cycle-grid');

  // Date de début — choisie ou lundi actuel
  const startInput=document.getElementById('cycle-start-date')?.value;
  const startDate=startInput?new Date(startInput+'T12:00:00'):new Date();
  if(!startInput){
    const day=startDate.getDay();
    startDate.setDate(startDate.getDate()-(day===0?6:day-1));
  }

  let html=`<table class="cycle-grid-table"><thead><tr>
    <th class="week-header">Semaine</th>
    ${cols.map((c,ci)=>`<th>
      <div class="cycle-col-header">
        <button class="cycle-col-move" onclick="moveColumn(${ci},-1)" ${ci===0?'disabled':''} title="Décaler à gauche">‹</button>
        <input type="text" value="${c}" onchange="renameColumn(${ci},this.value)" onclick="event.stopPropagation()">
        <button class="cycle-col-move" onclick="moveColumn(${ci},1)" ${ci===cols.length-1?'disabled':''} title="Décaler à droite">›</button>
        ${cols.length>1?`<button class="cycle-col-del" onclick="removeColumn(${ci})">✕</button>`:''}
      </div>
    </th>`).join('')}
  </tr></thead><tbody>`;

  for(let w=0;w<weeks;w++){
    const wStart=new Date(startDate);wStart.setDate(startDate.getDate()+w*7);
    const wEnd=new Date(wStart);wEnd.setDate(wStart.getDate()+6);
    const wLabel=`${wStart.getDate()}/${wStart.getMonth()+1}`;
    const wEndLabel=`${wEnd.getDate()}/${wEnd.getMonth()+1}`;

    html+=`<tr>
      <td class="cycle-week-cell">
        <div class="cycle-week-label">Sem. ${w+1}</div>
        <div class="cycle-week-dates">${wLabel} → ${wEndLabel}</div>
      </td>
      ${cols.map((c,ci)=>{
        const key=`${w}-${ci}`;
        const chips=(cycleData.cells[key]||[]);
        const chipsHtml=chips.map((chip,chi)=>`
          <div class="cycle-chip" style="background:${chip.color}22;border:1px solid ${chip.color}55;color:${isLightColor(chip.color)?'#000':chip.color};${chip.done?'opacity:.55;text-decoration:line-through':''};display:flex;align-items:center;gap:5px">
            <span class="chip-toggle" data-toggle-key="${key}" data-toggle-idx="${chi}" role="checkbox" aria-checked="${!!chip.done}" title="Traité" style="flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border:1.5px solid ${chip.color};border-radius:3px;background:${chip.done?chip.color:'transparent'};color:${isLightColor(chip.color)?'#000':'#fff'};font-size:12px;line-height:1;cursor:pointer;user-select:none">${chip.done?'✓':''}</span>
            <span class="cycle-chip-text" style="flex:1;min-width:0" onclick="event.stopPropagation();editCycleChip(${w},${ci},${chi})">${chip.text}</span>
            <button class="cycle-chip-del" onclick="event.stopPropagation();removeChip('${key}',${chi})" style="position:static;opacity:.6">✕</button>
          </div>`).join('');
        return`<td class="cycle-cell" onclick="openCycleCellModal(${w},${ci})">
          <div class="cycle-cell-content">
            ${chipsHtml}
            <button class="cycle-add-btn">+</button>
          </div>
        </td>`;
      }).join('')}
    </tr>`;
  }
  html+='</tbody></table>';
  grid.innerHTML=html;
  // Bind direct listeners aux toggles (fiabilité max, bypass onclick parents)
  grid.querySelectorAll('.chip-toggle').forEach(t=>{
    t.addEventListener('click',function(ev){ev.stopPropagation();ev.preventDefault();const k=this.getAttribute('data-toggle-key');const i=parseInt(this.getAttribute('data-toggle-idx'));toggleChipDone(k,i);});
  });
}

function renameColumn(ci,name){cycleData.columns[ci]=name;scheduleAutoSaveCycle();}
function moveColumn(ci,dir){
  const cols=cycleData.columns;
  const newCi=ci+dir;
  if(newCi<0||newCi>=cols.length)return;
  // Swap colonnes
  [cols[ci],cols[newCi]]=[cols[newCi],cols[ci]];
  // Remap les cellules (clé `${w}-${ci}`)
  const newCells={};
  Object.entries(cycleData.cells||{}).forEach(([k,v])=>{
    if(k==='__themes__'){newCells[k]=v;return;}
    const m=k.match(/^(\d+)-(\d+)$/);
    if(!m){newCells[k]=v;return;}
    const w=m[1];let c=parseInt(m[2]);
    if(c===ci)c=newCi;
    else if(c===newCi)c=ci;
    newCells[`${w}-${c}`]=v;
  });
  cycleData.cells=newCells;
  renderCycleGrid();
  scheduleAutoSaveCycle();
}
function removeColumn(ci){
  cycleData.columns.splice(ci,1);
  // Nettoyer les cellules de cette colonne
  Object.keys(cycleData.cells).forEach(k=>{
    const [w,c]=k.split('-').map(Number);
    if(c===ci)delete cycleData.cells[k];
  });
  renderCycleGrid();
  scheduleAutoSaveCycle();
}
function removeChip(key,chi){
  if(cycleData.cells[key])cycleData.cells[key].splice(chi,1);
  renderCycleGrid();
  scheduleAutoSaveCycle();
}

function renderSessionGrid(){
  const rows=cycleData.rows;
  const grid=document.getElementById('cycle-grid');
  const weeks=parseInt(document.getElementById('cycle-weeks')?.value)||cycleData.weeks||8;
  cycleData.weeks=weeks;

  // ===== COMPTEUR GLOBAL : nb d'items par valeur, par catégorie =====
  // Pour chaque row, on agrège toutes les chips (toutes semaines + tous jours) par texte.
  // On ne compte que les rows prédéfinies (Priorité, Modalités, Schéma, Durée, Charge, Répétitions, Mouvement)
  const counts = rows.map(()=>({}));            // counts[ri] = { TIME: 4, TASK: 2, ... }
  const colorOf = rows.map(()=>({}));           // colorOf[ri][text] = color
  let totalItems=0;
  for(let wk=0; wk<weeks; wk++){
    rows.forEach((rName,ri)=>{
      if(!getRowOptions(rName))return; // ignorer WOD et autres catégories libres
      DAYS_SESSION.forEach((__,di)=>{
        const arr=cycleData.sessionCells[`w${wk}-${ri}-${di}`]||[];
        arr.forEach(c=>{
          const k=(c.text||'').trim();
          if(!k)return;
          counts[ri][k]=(counts[ri][k]||0)+1;
          if(!colorOf[ri][k])colorOf[ri][k]=c.color||'#e8ff47';
          totalItems++;
        });
      });
    });
  }

  // Render du bandeau récap — uniquement les catégories prédéfinies (on ignore WOD/custom)
  let summaryHtml='';
  const nonEmptyRows=rows
    .map((r,ri)=>({r,ri,entries:Object.entries(counts[ri])}))
    .filter(x=>x.entries.length && getRowOptions(x.r));
  if(nonEmptyRows.length){
    summaryHtml=`
    <div style="margin-bottom:16px;padding:12px 14px;background:var(--card2);border:1px solid var(--border2);border-radius:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:var(--muted)">📊 Récap du cycle</div>
        <div style="font-size:11px;color:var(--text2)"><b style="color:var(--accent)">${totalItems}</b> item${totalItems>1?'s':''} au total</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${nonEmptyRows.map(({r,ri,entries})=>{
          // Tri décroissant par count
          entries.sort((a,b)=>b[1]-a[1]);
          const rowTotal=entries.reduce((s,[,n])=>s+n,0);
          const chipsHtml=entries.map(([text,n])=>{
            const color=colorOf[ri][text]||'#e8ff47';
            const fg=isLightColor(color)?'#111':'#fff';
            return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;background:${color}22;border:1px solid ${color}55;border-radius:6px;font-size:11px;font-weight:600;color:${isLightColor(color)?color:color}">
              <span style="color:${color}">${text}</span>
              <span style="display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:16px;padding:0 4px;background:${color};color:${fg};border-radius:8px;font-size:10px;font-weight:800;letter-spacing:.3px">${n}</span>
            </span>`;
          }).join('');
          return `<div style="display:flex;align-items:flex-start;gap:10px">
            <div style="min-width:110px;font-size:11px;font-weight:700;color:var(--text2);padding-top:4px;text-transform:uppercase;letter-spacing:.8px">${r} <span style="color:var(--muted);font-weight:500">· ${rowTotal}</span></div>
            <div style="flex:1;display:flex;flex-wrap:wrap;gap:5px">${chipsHtml}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  let html=summaryHtml;
  for(let wk=0; wk<weeks; wk++){
    html+=`<div style="margin-bottom:18px">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:2px;color:var(--orange);margin:6px 2px 6px;padding:4px 0;border-bottom:1px solid var(--border2)">SEMAINE ${wk+1}</div>
      <table class="session-grid-table"><thead><tr>
        <th class="row-header">Catégorie</th>
        ${DAYS_SESSION.map(d=>`<th>${d}</th>`).join('')}
      </tr></thead><tbody>`;
    rows.forEach((row,ri)=>{
      html+=`<tr>
        <td class="session-row-label">
          <div class="session-row-label-inner">
            <input type="text" value="${row}" oninput="cycleData.rows[${ri}]=this.value;scheduleAutoSaveCycle()">
            ${rows.length>1?`<button class="session-row-del" onclick="removeSessionRow(${ri})">✕</button>`:''}
          </div>
        </td>
        ${DAYS_SESSION.map((_,di)=>{
          const key=`w${wk}-${ri}-${di}`;
          const chips=(cycleData.sessionCells[key]||[]);
          const chipsHtml=chips.map((chip,chi)=>{
            const fg=isLightColor(chip.color)?'#111':'#fff';
            return`
            <div class="session-chip" style="background:${chip.color};color:${fg};${chip.done?'opacity:.55;text-decoration:line-through':''};display:flex;align-items:center;gap:5px">
              <span class="chip-toggle" data-toggle-key="${key}" data-toggle-idx="${chi}" role="checkbox" aria-checked="${!!chip.done}" title="Traité" style="flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border:1.5px solid ${fg};border-radius:3px;background:${chip.done?fg:'transparent'};color:${chip.done?(isLightColor(fg)?'#111':chip.color):fg};font-size:12px;line-height:1;cursor:pointer;user-select:none">${chip.done?'✓':''}</span>
              <span class="session-chip-text" style="flex:1;min-width:0" onclick="event.stopPropagation();editSessionChip(${wk},${ri},${di},${chi})">${chip.text}</span>
              <button class="session-chip-del" onclick="event.stopPropagation();removeSessionChip('${key}',${chi})" style="position:static;opacity:.7">✕</button>
            </div>`;
          }).join('');
          return`<td class="session-cell" onclick="openCycleCellModal(${wk},${ri},${di},'session')">
            <div class="session-cell-inner">${chipsHtml}<button class="cycle-add-btn">+</button></div>
          </td>`;
        }).join('')}
      </tr>`;
    });
    html+='</tbody></table></div>';
  }
  grid.innerHTML=html;
  grid.querySelectorAll('.chip-toggle').forEach(t=>{
    t.addEventListener('click',function(ev){ev.stopPropagation();ev.preventDefault();const k=this.getAttribute('data-toggle-key');const i=parseInt(this.getAttribute('data-toggle-idx'));toggleChipDone(k,i);});
  });
}

// Délégation capture-phase pour les toggles de chips (bypass tous les onclick parents)
if(!window.__chipToggleBound){
  window.__chipToggleBound=true;
  document.addEventListener('click',function(e){
    const t=e.target.closest&&e.target.closest('.chip-toggle');
    if(!t)return;
    e.stopPropagation();e.preventDefault();
    const k=t.getAttribute('data-toggle-key');
    const i=parseInt(t.getAttribute('data-toggle-idx'));
    if(k!=null&&!isNaN(i))toggleChipDone(k,i);
  },true);
}

async function toggleChipDone(key,chi){
  const arr=cycleData.sessionCells[key]||cycleData.cells[key];
  if(!arr||!arr[chi])return;
  arr[chi].done=!arr[chi].done;
  renderCycleGrid();
  // Persistance silencieuse si cycle déjà sauvegardé
  if(cycleData.id){
    try{
      await sb.from('cycle_plans').update({cells:cycleData.cells,session_cells:cycleData.sessionCells}).eq('id',cycleData.id);
    }catch(e){console.warn('toggleChipDone persist',e);}
  }
}

function removeSessionChip(key,chi){
  if(cycleData.sessionCells[key])cycleData.sessionCells[key].splice(chi,1);
  renderSessionGrid();
  scheduleAutoSaveCycle();
}

// Options prédéfinies par catégorie de ligne
const SESSION_ROW_OPTIONS = {
  'Priorité': [
    {text:'TIME',color:'#47c8ff'},{text:'TASK',color:'#e8ff47'},{text:'INTERVALLES',color:'#ff8c47'}
  ],
  'Modalités': [
    {text:'H',color:'#ff4747'},{text:'G',color:'#47c8ff'},{text:'M',color:'#47ff8c'},
    {text:'GH',color:'#c847ff'},{text:'HM',color:'#ff8c47'},{text:'GM',color:'#e8ff47'},{text:'GHM',color:'#ffffff'}
  ],
  'Schéma': [
    {text:'SINGLE',color:'#e8ff47'},{text:'COUPLET',color:'#47c8ff'},{text:'TRIPLET',color:'#ff8c47'},
    {text:'CHIPPER',color:'#c847ff'},{text:'AMRAP',color:'#ff4747'},{text:'FOR TIME',color:'#47ff8c'}
  ],
  'Durée': [
    {text:'SPRINT',color:'#ff4747'},{text:'SHORT',color:'#ff8c47'},{text:'MEDIUM',color:'#e8ff47'},{text:'LONG',color:'#47ff8c'}
  ],
  'Charge': [
    {text:'BODYWEIGHT',color:'#47c8ff'},{text:'LIGHT',color:'#47ff8c'},{text:'MODERATE',color:'#e8ff47'},{text:'HEAVY',color:'#ff4747'}
  ],
  'Répétitions': [
    {text:'LOW REP',color:'#47c8ff'},{text:'MODERATE REP',color:'#e8ff47'},{text:'HIGH REP',color:'#ff4747'}
  ],
  'Mouvement': [
    {text:'SQUAT',color:'#e8ff47'},{text:'HINGE',color:'#ff8c47'},{text:'PRESS',color:'#47c8ff'},
    {text:'PULL',color:'#c847ff'},{text:'JUMP',color:'#ff4747'},{text:'TRUNK FLEXION',color:'#47ff8c'},
    {text:'ERGO',color:'#ffffff'},{text:'RUN',color:'#ff69b4'},{text:'CARRY',color:'#ffd700'}
  ]
};

function getRowOptions(rowName){
  // Cherche une correspondance exacte ou partielle
  const key=Object.keys(SESSION_ROW_OPTIONS).find(k=>rowName.toLowerCase().includes(k.toLowerCase())||k.toLowerCase().includes(rowName.toLowerCase()));
  return key?SESSION_ROW_OPTIONS[key]:null;
}

function openCycleCellModal(a,b,c,mode){
  // session mode: a=wk, b=ri, c=di | cycle mode: a=wk, b=ci (c omitted)
  const isSession=(mode==='session'||c!=null&&typeof c==='number');
  const realMode=isSession?'session':(mode||'cycle');
  cycleCellTarget=isSession?{wk:a,ri:b,di:c,mode:'session'}:{a,b,mode:realMode};
  const label=isSession?`Sem. ${a+1} — ${cycleData.rows[b]||'—'} — ${DAYS_SESSION[c]}`:`Sem. ${a+1} — ${cycleData.columns[b]||'—'}`;
  document.getElementById('cycle-cell-title').textContent=label;
  document.getElementById('cycle-cell-modal').classList.add('open');
  _setChipAutoSaveStatus('idle');

  // En mode session, chercher des options prédéfinies
  const rowName=isSession?cycleData.rows[b]:'';
  const options=isSession?getRowOptions(rowName):null;

  const subtitleEl=document.getElementById('cycle-cell-subtitle');
  const inputArea=document.getElementById('cycle-cell-input-area');
  const presetsArea=document.getElementById('cycle-cell-presets');

  if(options&&options.length){
    const isMulti=isSession&&rowName.toLowerCase().includes('mouvement');
    const key=isSession?`w${a}-${b}-${c}`:`${a}-${b}`;
    const existing=new Set(((cycleData.sessionCells||{})[key]||[]).map(c=>c.text));
    subtitleEl.textContent=isMulti?'Sélection multiple — clique pour ajouter/retirer':'Sélectionne ou tape librement';
    presetsArea.style.display='block';
    presetsArea.innerHTML=`<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">Prédéfini${isMulti?' (multi)':''}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
        ${options.map(o=>{const sel=existing.has(o.text);return`<button class="preset-option-btn" onclick='selectPreset(${JSON.stringify(o.text)},${JSON.stringify(o.color)})' style="background:${o.color};color:${isLightColor(o.color)?'#111':'#fff'};padding:6px 12px;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:.5px;outline:${sel?'2px solid #fff':'none'};outline-offset:${sel?'2px':'0'}">${o.text}</button>`}).join('')}
      </div>${isMulti?'<button class="btn-secondary" onclick="closeCycleCellModal()" style="width:100%;margin-bottom:14px">Terminé</button>':''}`;
  } else {
    subtitleEl.textContent='Ajoute une idée';
    presetsArea.style.display='none';
  }

  document.getElementById('cycle-cell-input').value='';
  selectedChipColor='#e8ff47';
  document.querySelectorAll('.chip-color-btn').forEach(b=>b.classList.toggle('selected',b.dataset.color==='#e8ff47'));
  if(!options)setTimeout(()=>document.getElementById('cycle-cell-input').focus(),300);
}

function selectPreset(text,color){
  if(!cycleCellTarget)return;
  const t=cycleCellTarget;
  const key=t.mode==='session'?`w${t.wk}-${t.ri}-${t.di}`:`${t.a}-${t.b}`;
  if(cycleCellTarget.mode==='session'){
    if(!cycleData.sessionCells[key])cycleData.sessionCells[key]=[];
    const rowName=cycleData.rows[t.ri]||'';
    const isMulti=rowName.toLowerCase().includes('mouvement');
    if(isMulti){
      // Toggle: ajouter si absent, retirer si déjà présent
      const idx=cycleData.sessionCells[key].findIndex(c=>c.text===text);
      if(idx>=0){
        cycleData.sessionCells[key].splice(idx,1);
      } else {
        cycleData.sessionCells[key].push({text,color});
      }
      renderSessionGrid();
      // Mettre à jour visuellement les boutons sans fermer la modal
      const presetsArea=document.getElementById('cycle-cell-presets');
      if(presetsArea){
        const selectedTexts=new Set(cycleData.sessionCells[key].map(c=>c.text));
        presetsArea.querySelectorAll('.preset-option-btn').forEach(btn=>{
          const txt=btn.textContent.trim();
          btn.style.outline=selectedTexts.has(txt)?'2px solid #fff':'none';
          btn.style.outlineOffset=selectedTexts.has(txt)?'2px':'0';
        });
      }
    } else {
      // Une seule chip par cellule
      cycleData.sessionCells[key]=[{text,color}];
      closeCycleCellModal();
      renderSessionGrid();
    }
  }
  scheduleAutoSaveCycle();
}

function closeCycleCellModal(){
  flushAutoSaveCycleChip();
  document.getElementById('cycle-cell-modal').classList.remove('open');
  cycleCellTarget=null;
}

// ===== DUPLIQUER UNE CASE VERS UN AUTRE CYCLE =====
let _dupCellSource=null;

// ===== DUPLIQUER UNE CASE DANS LE MÊME CYCLE (autre semaine) =====
function openDuplicateCellSameCycle(){
  if(!cycleCellTarget){showToast('⚠️ Aucune case sélectionnée');return;}
  const t=cycleCellTarget;
  const key=t.mode==='session'?`w${t.wk}-${t.ri}-${t.di}`:`${t.a}-${t.b}`;
  const chips=(t.mode==='session'?cycleData.sessionCells[key]:cycleData.cells[key])||[];
  if(!chips.length){showToast('⚠️ Cette case est vide');return;}
  const totalWeeks=parseInt(document.getElementById('cycle-weeks')?.value)||cycleData.weeks||8;
  const currentWeek=(t.mode==='session'?t.wk:t.a)+1;
  const input=prompt(`Dupliquer ce bloc vers quelle(s) semaine(s) ? (1-${totalWeeks})\nEx: 2  ou  2,3,5  ou  2-4`,String(Math.min(currentWeek+1,totalWeeks)));
  if(!input)return;
  const targets=new Set();
  input.split(',').forEach(part=>{
    const p=part.trim();if(!p)return;
    const range=p.match(/^(\d+)\s*-\s*(\d+)$/);
    if(range){const a=parseInt(range[1]),b=parseInt(range[2]);for(let i=Math.min(a,b);i<=Math.max(a,b);i++)targets.add(i);}
    else {const n=parseInt(p);if(!isNaN(n))targets.add(n);}
  });
  let added=0;
  targets.forEach(wkOneBased=>{
    if(wkOneBased<1||wkOneBased>totalWeeks)return;
    if(wkOneBased===currentWeek)return;
    const targetW=wkOneBased-1;
    const cloned=JSON.parse(JSON.stringify(chips)).map(c=>({...c,done:false}));
    if(t.mode==='session'){const newKey=`w${targetW}-${t.ri}-${t.di}`;cycleData.sessionCells[newKey]=(cycleData.sessionCells[newKey]||[]).concat(cloned);}
    else {const newKey=`${targetW}-${t.b}`;cycleData.cells[newKey]=(cycleData.cells[newKey]||[]).concat(cloned);}
    added++;
  });
  if(!added){showToast('⚠️ Aucune semaine valide');return;}
  closeCycleCellModal();
  renderCycleGrid();
  scheduleAutoSaveCycle();
  showToast(`✅ Bloc dupliqué sur ${added} semaine${added>1?'s':''}`);
}

// ===== AUTO-SAVE CYCLE (silencieux, débouncé) =====
let _autoSaveCycleTimer=null;
function scheduleAutoSaveCycle(){
  if(!cycleData)return;
  if(_autoSaveCycleTimer)clearTimeout(_autoSaveCycleTimer);
  _autoSaveCycleTimer=setTimeout(autoSaveCycleNow,700);
}
async function autoSaveCycleNow(){
  if(!currentUser)return;
  const name=(document.getElementById('cycle-name')?.value||'').trim()||cycleData.name||'Cycle sans nom';
  const weeks=parseInt(document.getElementById('cycle-weeks')?.value)||cycleData.weeks||8;
  cycleData.name=name;cycleData.weeks=weeks;
  const startDate=document.getElementById('cycle-start-date')?.value||null;
  const payload={name,weeks,mode:cycleMode,start_date:startDate,columns:cycleData.columns,rows:cycleData.rows,cells:cycleData.cells,session_cells:cycleData.sessionCells,created_by:currentUser.id};
  try {
    if(cycleData.id){await sb.from('cycle_plans').update(payload).eq('id',cycleData.id);}
    else {const {data,error}=await sb.from('cycle_plans').insert(payload).select('id').single();if(!error&&data){cycleData.id=data.id;await loadAllCycles();const sel=document.getElementById('cycle-selector');if(sel)sel.value=cycleData.id;}}
    const ind=document.getElementById('cycle-autosave-indicator');
    if(ind){ind.textContent='✓ Enregistré';ind.style.opacity='1';setTimeout(()=>{if(ind)ind.style.opacity='0';},1400);}
  } catch(e){console.warn('autoSaveCycle',e);}
}
function openDuplicateCellToCycle(){
  if(!cycleCellTarget){showToast('⚠️ Aucune case sélectionnée');return;}
  const t=cycleCellTarget;
  const key=t.mode==='session'?`w${t.wk}-${t.ri}-${t.di}`:`${t.a}-${t.b}`;
  const chips=(t.mode==='session'?cycleData.sessionCells[key]:cycleData.cells[key])||[];
  if(!chips.length){showToast('⚠️ Cette case est vide');return;}
  _dupCellSource={mode:t.mode,key,chips:JSON.parse(JSON.stringify(chips)),srcCycleId:cycleData.id||null};
  // Construit la liste des cycles cibles (exclut le cycle courant)
  const others=(allCycles||[]).filter(c=>c.id!==cycleData.id);
  if(!others.length){showToast('⚠️ Aucun autre cycle disponible');return;}
  const sel=document.getElementById('dup-cycle-select');
  sel.innerHTML=others.map(c=>`<option value="${c.id}">${(c.name||'Sans nom').replace(/</g,'&lt;')}</option>`).join('');
  document.getElementById('dup-cycle-week').value=(t.mode==='session'?t.wk:t.a)+1;
  document.getElementById('dup-cycle-modal').classList.add('open');
}
function closeDupCycleModal(){
  document.getElementById('dup-cycle-modal').classList.remove('open');
  _dupCellSource=null;
}
async function confirmDuplicateCellToCycle(){
  if(!_dupCellSource){closeDupCycleModal();return;}
  const targetId=document.getElementById('dup-cycle-select').value;
  const targetWeek=Math.max(1,parseInt(document.getElementById('dup-cycle-week').value)||1)-1;
  if(!targetId){showToast('⚠️ Choisis un cycle');return;}
  // Charge le cycle cible
  const {data:tc,error}=await sb.from('cycle_plans').select('*').eq('id',targetId).single();
  if(error||!tc){showToast('⚠️ Cycle introuvable');return;}
  const cells=tc.cells||{};
  const sessionCells=tc.session_cells||{};
  const src=_dupCellSource;
  if(src.mode==='session'){
    // key src: w{wk}-{ri}-{di} → garde ri & di, change wk
    const m=src.key.match(/^w(\d+)-(\d+)-(\d+)$/);
    if(!m){showToast('⚠️ Clé invalide');return;}
    const newKey=`w${targetWeek}-${m[2]}-${m[3]}`;
    sessionCells[newKey]=(sessionCells[newKey]||[]).concat(src.chips.map(c=>({...c,done:false})));
  } else {
    // key src: {w}-{c} → garde c, change w
    const m=src.key.match(/^(\d+)-(\d+)$/);
    if(!m){showToast('⚠️ Clé invalide');return;}
    const newKey=`${targetWeek}-${m[2]}`;
    cells[newKey]=(cells[newKey]||[]).concat(src.chips.map(c=>({...c,done:false})));
  }
  const {error:upErr}=await sb.from('cycle_plans').update({cells,session_cells:sessionCells}).eq('id',targetId);
  if(upErr){showToast('❌ Erreur: '+upErr.message);return;}
  showToast('✅ Bloc dupliqué vers '+(tc.name||'cycle'));
  closeDupCycleModal();
  closeCycleCellModal();
}

function selectChipColor(color,el){
  selectedChipColor=color;
  document.querySelectorAll('.chip-color-btn').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
  // Auto-save : si une chip existe déjà (édition), update couleur immédiatement
  flushAutoSaveCycleChip();
}

// ===== AUTO-SAVE CHIP DANS MODAL CYCLE/SESSION =====
let _autoSaveChipTimer=null;
function _setChipAutoSaveStatus(state){
  // state: 'typing' | 'saving' | 'saved' | 'idle'
  const dot=document.getElementById('cycle-chip-autosave-dot');
  const txt=document.getElementById('cycle-chip-autosave-text');
  if(!dot||!txt)return;
  const map={
    idle:   {bg:'transparent',          label:'Enregistrement automatique',   color:'var(--muted)'},
    typing: {bg:'var(--muted)',         label:'Modification…',                color:'var(--muted)'},
    saving: {bg:'var(--accent,#e8ff47)',label:'Enregistrement…',              color:'var(--text2)'},
    saved:  {bg:'var(--green,#47ff8c)', label:'✓ Enregistré',                 color:'var(--green,#47ff8c)'},
  };
  const s=map[state]||map.idle;
  dot.style.background=s.bg;
  txt.textContent=s.label;
  txt.style.color=s.color;
}
function scheduleAutoSaveCycleChip(){
  _setChipAutoSaveStatus('typing');
  if(_autoSaveChipTimer)clearTimeout(_autoSaveChipTimer);
  _autoSaveChipTimer=setTimeout(()=>{ _autoSaveChipTimer=null; _doAutoSaveCycleChip(); },500);
}
function flushAutoSaveCycleChip(){
  if(_autoSaveChipTimer){clearTimeout(_autoSaveChipTimer);_autoSaveChipTimer=null;}
  _doAutoSaveCycleChip();
}
function _doAutoSaveCycleChip(){
  if(!cycleCellTarget)return;
  const inputEl=document.getElementById('cycle-cell-input');
  if(!inputEl)return;
  const text=inputEl.value.trim();
  const t=cycleCellTarget;
  const key=t.mode==='session'?`w${t.wk}-${t.ri}-${t.di}`:`${t.a}-${t.b}`;
  const isSession=t.mode==='session';
  const bucket=isSession?cycleData.sessionCells:cycleData.cells;

  // Pas de texte ET pas de chip existante → ne rien faire
  if(!text && t.editIdx==null)return;

  _setChipAutoSaveStatus('saving');

  if(!bucket[key])bucket[key]=[];

  if(t.editIdx!=null){
    // Édition d'une chip existante
    if(!text){
      // Texte vidé → on supprime la chip
      bucket[key].splice(t.editIdx,1);
      cycleCellTarget.editIdx=null;
    } else {
      const prev=bucket[key][t.editIdx]||{};
      bucket[key][t.editIdx]=isSession
        ? {text,color:selectedChipColor}
        : {text,color:selectedChipColor,done:!!prev.done};
    }
  } else {
    // Nouvelle chip → on crée + on mémorise l'index pour les frappes suivantes
    const chip=isSession?{text,color:selectedChipColor}:{text,color:selectedChipColor,done:false};
    bucket[key].push(chip);
    cycleCellTarget.editIdx=bucket[key].length-1;
  }

  if(isSession)renderSessionGrid(); else renderCycleGrid();
  scheduleAutoSaveCycle();
  setTimeout(()=>_setChipAutoSaveStatus('saved'),200);
}

function editCycleChip(w,ci,chi){
  const key=`${w}-${ci}`;
  const chip=(cycleData.cells[key]||[])[chi];
  if(!chip)return;
  cycleCellTarget={a:w,b:ci,mode:'cycle',editIdx:chi};
  document.getElementById('cycle-cell-title').textContent=`Sem. ${w+1} — ${cycleData.columns[ci]||'—'}`;
  document.getElementById('cycle-cell-subtitle').textContent='Modifier le bloc';
  document.getElementById('cycle-cell-presets').style.display='none';
  document.getElementById('cycle-cell-input').value=chip.text;
  selectedChipColor=chip.color;
  document.querySelectorAll('.chip-color-btn').forEach(b=>b.classList.toggle('selected',b.dataset.color===chip.color));
  document.getElementById('cycle-cell-modal').classList.add('open');
  _setChipAutoSaveStatus('idle');
}

function editSessionChip(wk,ri,di,chi){
  const key=`w${wk}-${ri}-${di}`;
  const chip=(cycleData.sessionCells[key]||[])[chi];
  if(!chip)return;
  cycleCellTarget={wk,ri,di,mode:'session',editIdx:chi};
  document.getElementById('cycle-cell-title').textContent=`Sem. ${wk+1} — ${cycleData.rows[ri]||'—'} — ${DAYS_SESSION[di]}`;
  document.getElementById('cycle-cell-subtitle').textContent='Modifier le bloc';
  document.getElementById('cycle-cell-presets').style.display='none';
  document.getElementById('cycle-cell-input').value=chip.text;
  selectedChipColor=chip.color;
  document.querySelectorAll('.chip-color-btn').forEach(b=>b.classList.toggle('selected',b.dataset.color===chip.color));
  document.getElementById('cycle-cell-modal').classList.add('open');
  _setChipAutoSaveStatus('idle');
}

function saveCycleChip(){
  if(!cycleCellTarget)return;
  const text=document.getElementById('cycle-cell-input').value.trim();
  if(!text){showToast('⚠️ Entre du contenu');return;}
  const t=cycleCellTarget;
  const key=t.mode==='session'?`w${t.wk}-${t.ri}-${t.di}`:`${t.a}-${t.b}`;
  const editIdx=cycleCellTarget.editIdx;

  if(cycleCellTarget.mode==='session'){
    if(!cycleData.sessionCells[key])cycleData.sessionCells[key]=[];
    if(editIdx!=null){
      cycleData.sessionCells[key][editIdx]={text,color:selectedChipColor};
    } else {
      cycleData.sessionCells[key].push({text,color:selectedChipColor});
    }
    closeCycleCellModal();
    renderSessionGrid();
  } else {
    if(!cycleData.cells[key])cycleData.cells[key]=[];
    if(editIdx!=null){
      const prev=cycleData.cells[key][editIdx]||{};
      cycleData.cells[key][editIdx]={text,color:selectedChipColor,done:!!prev.done};
    } else {
      cycleData.cells[key].push({text,color:selectedChipColor,done:false});
    }
    closeCycleCellModal();
    renderCycleGrid();
  }
  scheduleAutoSaveCycle();
}

// ===== VIDEO PICKER =====
async function openVideoPicker(){
  document.getElementById('videopicker-modal').classList.add('open');
  document.getElementById('videopicker-search').value='';
  const el=document.getElementById('videopicker-list');
  // refresh à chaque ouverture pour récupérer les vidéos ajoutées récemment
  if(!allVideos.length){
    el.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px"><div class="spinner" style="margin:0 auto 10px"></div>Chargement…</div>';
    try{await loadVideos();}catch(e){}
  }
  renderVideoPicker();
}
function closeVideoPicker(){document.getElementById('videopicker-modal').classList.remove('open');}
function filterVideoPicker(){renderVideoPicker();}
function renderVideoPicker(){
  const q=document.getElementById('videopicker-search').value.toLowerCase();
  const filtered=allVideos.filter(v=>!q||v.title.toLowerCase().includes(q)||(v.movements?.name||'').toLowerCase().includes(q));
  const el=document.getElementById('videopicker-list');
  if(!allVideos.length){
    el.innerHTML='<div style="text-align:center;color:var(--muted);padding:24px 12px;font-size:13px;line-height:1.6"><div style="font-size:32px;margin-bottom:8px">🎬</div>Aucune vidéo dans la bibliothèque.<br><span style="font-size:11px">Ajoute-en via l\'onglet <b style="color:var(--accent)">Vidéos</b> de l\'admin.</span></div>';
    return;
  }
  if(!filtered.length){el.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px">Aucune vidéo trouvée</div>';return;}
  el.innerHTML=filtered.map(v=>{
    const url=(v.youtube_url||'').replace(/"/g,'&quot;');
    const title=(v.title||'').replace(/"/g,'&quot;');
    const mv=(v.movements?.name||'—').replace(/</g,'&lt;');
    return `<div class="videopicker-item" data-vp-url="${url}" data-vp-label="${title}" style="display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid var(--border);cursor:pointer">
      <span style="font-size:22px">▶️</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600">${title}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${mv}</div>
      </div>
      <span style="color:var(--accent);font-size:20px;font-weight:300">+</span>
    </div>`;
  }).join('');
  // event delegation : robuste face aux URL avec guillemets
  el.querySelectorAll('.videopicker-item').forEach(item=>{
    item.addEventListener('click',()=>selectVideoFromPicker(item.dataset.vpUrl,item.dataset.vpLabel));
  });
}
function selectVideoFromPicker(url,label){
  addVideoToForm(url,label);
  closeVideoPicker();
  showToast('✅ Vidéo ajoutée !');
}

// ===== MULTI-VIDÉOS (formulaire séance) =====
function getFormVideos(){
  const list=document.getElementById('f-videos-list');
  if(!list)return[];
  return [...list.querySelectorAll('.f-video-row')].map(row=>({
    url:(row.querySelector('.f-video-url')?.value||'').trim(),
    label:(row.querySelector('.f-video-label')?.value||'').trim()
  })).filter(v=>v.url);
}
function setFormVideos(videos){
  const list=document.getElementById('f-videos-list');
  if(!list)return;
  list.innerHTML='';
  (videos||[]).forEach(v=>addVideoToForm(v.url||'', v.label||'', {silent:true}));
  syncLegacyVideoFields();
}
function addVideoToForm(url,label,opts){
  const list=document.getElementById('f-videos-list');
  if(!list)return;
  // Si un nouvel ajout vient d'une URL déjà présente => focus existant
  if(url){
    const dup=[...list.querySelectorAll('.f-video-url')].find(i=>i.value===url);
    if(dup){dup.closest('.f-video-row').querySelector('.f-video-label')?.focus();syncLegacyVideoFields();return;}
  }
  const row=document.createElement('div');
  row.className='f-video-row';
  const idx=list.children.length;
  row.innerHTML=`
    <div class="f-video-badge">#${idx+1}</div>
    <div class="f-video-fields">
      <input type="text" class="f-video-label" placeholder="Libellé (ex: Démo technique)" value="${(label||'').replace(/"/g,'&quot;')}">
      <input type="text" class="f-video-url" placeholder="https://youtube.com/..." value="${(url||'').replace(/"/g,'&quot;')}">
    </div>
    <button type="button" class="f-video-del" title="Retirer" onclick="removeFormVideo(this)">✕</button>`;
  list.appendChild(row);
  row.querySelectorAll('input').forEach(i=>i.addEventListener('input',syncLegacyVideoFields));
  syncLegacyVideoFields();
  if(!opts||!opts.silent){
    if(!url){row.querySelector('.f-video-url').focus();}
  }
}
function removeFormVideo(btn){
  const row=btn.closest('.f-video-row');
  if(!row)return;
  row.remove();
  // re-numéroter les badges
  const list=document.getElementById('f-videos-list');
  [...list.querySelectorAll('.f-video-row')].forEach((r,i)=>{const b=r.querySelector('.f-video-badge');if(b)b.textContent='#'+(i+1);});
  syncLegacyVideoFields();
}
function syncLegacyVideoFields(){
  const vids=getFormVideos();
  const yt=document.getElementById('f-youtube');
  const lb=document.getElementById('f-ytlabel');
  if(yt)yt.value=vids[0]?.url||'';
  if(lb)lb.value=vids[0]?.label||'';
}

// ===== VIDÉOS =====
let allVideos=[];let currentVCat='all';let videoSearch='';

async function loadVideos(){
  const {data}=await sb.from('movement_videos').select('*,movements(name,category)').order('created_at',{ascending:false});
  allVideos=data||[];
}

function filterVideoCat(cat,btn){
  currentVCat=cat;
  document.querySelectorAll('.cat-btn[data-vcat]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderVideosAthlete();
}
function filterVideos(){videoSearch=document.getElementById('video-search-input').value.toLowerCase();renderVideosAthlete();}

function renderVideosAthlete(){
  let filtered=allVideos;
  if(currentVCat!=='all')filtered=filtered.filter(v=>v.movements?.category===currentVCat);
  if(videoSearch)filtered=filtered.filter(v=>v.title.toLowerCase().includes(videoSearch)||v.movements?.name.toLowerCase().includes(videoSearch));
  const el=document.getElementById('videos-athlete-list');
  if(!filtered.length){el.innerHTML='<div class="empty"><div class="empty-icon">🎬</div><p>Aucune vidéo disponible.</p></div>';return;}
  el.innerHTML=filtered.map(v=>{
    const ytId=extractYTId(v.youtube_url||'');
    const thumbHtml=ytId?`<div class="video-card-thumb"><iframe src="https://www.youtube.com/embed/${ytId}" allowfullscreen loading="lazy"></iframe></div>`:'';
    return`<div class="video-card">${thumbHtml}<div class="video-card-body">
      <div class="video-card-title">${v.title}</div>
      <div class="video-card-meta"><span>${v.movements?.name||'—'}</span>${v.level&&v.level!=='all'?`<span class="video-level-badge">${v.level}</span>`:''}</div>
      ${v.description?`<div class="video-card-desc">${v.description}</div>`:''}
    </div></div>`;
  }).join('');
}

async function loadAdminVideos(){
  await loadVideos();
  const el=document.getElementById('videos-list');
  if(!allVideos.length){el.innerHTML='<div style="font-size:13px;color:var(--muted)">Aucune vidéo ajoutée.</div>';return;}
  el.innerHTML=`<div class="pr-hist-title">${allVideos.length} vidéos</div>`+allVideos.slice(0,10).map(v=>`<div class="sessions-list-item">
    <div><div class="sli-title">${v.title}</div><div class="sli-meta">${v.movements?.name||'—'} · ${v.level||'Tous niveaux'}</div></div>
    <button class="btn-delete" onclick="deleteVideo('${v.id}')">✕</button>
  </div>`).join('');
}

function populateVideoMovementSelect(){
  const sel=document.getElementById('v-movement');
  if(!sel||movements.length===0)return;
  sel.innerHTML=movements.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
}

async function saveVideo(){
  const movementId=document.getElementById('v-movement').value;
  const title=document.getElementById('v-title').value.trim();
  const youtube=document.getElementById('v-youtube').value.trim();
  const desc=document.getElementById('v-desc').value.trim();
  const level=document.getElementById('v-level').value;
  if(!title||!youtube){showToast('⚠️ Titre et lien YouTube requis');return;}
  const {error}=await sb.from('movement_videos').insert({movement_id:movementId,title,youtube_url:youtube,description:desc||null,level,created_by:currentUser.id});
  if(error){showToast('❌ '+error.message);return;}
  showToast('✅ Vidéo ajoutée !');
  ['v-title','v-youtube','v-desc'].forEach(id=>document.getElementById(id).value='');
  await loadAdminVideos();
}

async function deleteVideo(id){
  await sb.from('movement_videos').delete().eq('id',id);
  showToast('🗑 Vidéo supprimée');
  loadAdminVideos();
}

// ===== NOTES DE SÉANCE =====
let currentNoteSession=null;

async function saveSessionNote(){
  const content=document.getElementById('session-note-input')?.value.trim();
  if(!content||!currentScoresSession){showToast('⚠️ Écris une note');return;}
  // upsert : une seule note par (session,athlète) — on remplace l'ancienne
  const sid=currentScoresSession.sessionId;
  await sb.from('session_notes').delete().eq('session_id',sid).eq('athlete_id',currentUser.id);
  const {error}=await sb.from('session_notes').insert({session_id:sid,athlete_id:currentUser.id,content});
  if(error){showToast('❌ '+error.message);return;}
  document.getElementById('session-note-input').value=document.getElementById('session-note-input').value; // garde le contenu pour réédition
  showToast('📝 Note sauvegardée !');
  // rafraîchit le leaderboard pour afficher la note attachée au score
  if(currentScoresSession){
    await renderScoresModal(currentScoresSession.sessionId,currentScoresSession.scoreType,currentScoresSession.sets);
  }
}

async function loadSessionNotes(sessionId){
  // Note : depuis V2, les notes des AUTRES athlètes sont affichées sous chaque score
  // dans le leaderboard. Ici on charge uniquement la note de l'athlète courant pour préremplir le textarea.
  const el=document.getElementById('session-notes-list');
  if(el)el.innerHTML='';
  if(!currentUser)return;
  const {data}=await sb.from('session_notes').select('content').eq('session_id',sessionId).eq('athlete_id',currentUser.id).order('created_at',{ascending:false}).limit(1);
  const ta=document.getElementById('session-note-input');
  if(ta&&data&&data[0])ta.value=data[0].content;
}

