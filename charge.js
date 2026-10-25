/* =========================================================================
   CHARGE D'ENTRAÎNEMENT — modèle sRPE (Foster)
   Saisie par bloc (RPE × minutes), agrégation par jour.
   Échauffement + Mobilité exclus par défaut, l'athlète peut basculer.
   Tables : training_load_days / training_load_blocks
   Fonctions : training_load_series() / training_load_weeks()
   Chargé APRÈS wellness.js (on surcharge renderSessions une dernière fois).
   ========================================================================= */
(function(){
  if(window.__patchBound_charge)return;
  window.__patchBound_charge=true;

  /* ---------- Référentiel (aligné sur la feuille UDT d'Alexis) ---------- */
  const MODS=[
    ['STR','Force'],['CF','CrossFit'],['WL','Haltéro'],['GYM','Gymnastique'],['BODY','Body / Renfo'],
    ['CAP','Course à pied'],['ERG','Ergomètres'],['BIKE','Vélo'],['SWI','Natation'],['COMP','Compétition']
  ];
  const MODMAP=Object.fromEntries(MODS);
  // type de bloc -> [modalité par défaut, compte dans la charge]
  const TYPEMAP={
    wod:['CF',true], strength:['STR',true], weightlifting:['WL',true], gymnastics:['GYM',true],
    skill:['GYM',true], renforcement:['BODY',true], bodybuilding:['BODY',true], engine:['ERG',true],
    run:['CAP',true], warmup:['BODY',false], mobility:['BODY',false]
  };
  const RPEC=['#2E8B57','#3F9A55','#6AA84F','#9DB443','#C9A93A','#D98A2B','#D7712C','#CF5A30','#C24A3D','#A8322B'];

  /* Charte graphique de l'appli (styles.css) : fond noir, cartes sombres et les
     couleurs nommées. On passe par les variables CSS, donc l'accent suit celui du
     studio et tout reste juste en thème clair. */
  const AC='var(--accent)', GRID='var(--border)', BAR='var(--border2)',
        OK='var(--green)', WARN='var(--orange)', BAD='var(--red)', LOW='var(--blue)';
  const TEAL=AC;  // l'ancien teal codé en dur suit maintenant l'accent du studio
  const tint=(c,p)=>`color-mix(in srgb, ${c} ${p}%, transparent)`;
  // couleur par modalité, prise dans la palette de l'appli
  const MODC={STR:'var(--red)',CF:'var(--accent)',WL:'var(--purple)',GYM:'var(--blue)',
    BODY:'var(--green)',CAP:'var(--orange)',ERG:'var(--blue)',BIKE:'var(--green)',
    SWI:'var(--purple)',COMP:'var(--red)'};
  const WAKE=[['Forme','💪','En forme',OK],['RAS','😊','RAS',AC],
              ['Fatigue','😮‍💨','Fatigué',WARN],['PLS','🥵','PLS',BAD]];
  const WAKEC=Object.fromEntries(WAKE.map(([k,,,c])=>[k,c]));

  function zone(r){
    if(r==null)return{l:'Amorçage',c:'var(--muted)'};
    if(r<0.8)return{l:'Sous-charge',c:LOW};
    if(r<=1.3)return{l:'Zone optimale',c:OK};
    if(r<=1.5)return{l:'Vigilance',c:WARN};
    return{l:'Risque élevé',c:BAD};
  }
  const fmt=(n,d=0)=>n==null?'–':Number(n).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d});
  /* ATTENTION : currentUser / currentProg / selectedDate sont déclarés avec `let`
     dans core.js → ce sont des bindings lexicaux globaux, PAS des propriétés de window.
     On les lit donc en identifiants nus (accessibles entre scripts classiques),
     jamais via window.X qui renverrait undefined. */
  const uid=()=>(typeof currentUser!=='undefined'&&currentUser)?currentUser.id:null;
  const today=()=>new Date().toISOString().slice(0,10);
  function dayKey(){
    // selectedDate peut valoir "__wNdM" sur les programmes one-shot : on retombe sur aujourd'hui
    const d=(typeof selectedDate!=='undefined')?selectedDate:null;
    return(typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d))?d:today();
  }
  const isPerso=()=>(typeof currentProg!=='undefined'&&currentProg&&currentProg.id==='__perso__');

  /* ---------- Styles ---------- */
  const CSS=`
  .chg-wrap{margin-top:14px;padding-top:14px;border-top:1px dashed var(--border)}
  .chg-head{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none}
  .chg-head .t{font-size:13px;font-weight:700;color:var(--text);flex:1}
  .chg-val{font-size:12px;font-weight:700;color:${TEAL}}
  .chg-val.off{color:var(--muted);font-weight:500}
  .chg-body{margin-top:12px;display:none}
  .chg-body.open{display:block}
  .chg-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:10px 0 6px}
  .chg-mods{display:flex;flex-wrap:wrap;gap:6px}
  .chg-mod{padding:6px 10px;border-radius:999px;border:1px solid var(--border);background:var(--card2,transparent);
    color:var(--muted);font-size:12px;cursor:pointer}
  .chg-mod[aria-pressed="true"]{border-color:${TEAL};color:${TEAL};font-weight:700}
  .chg-rpe{display:grid;grid-template-columns:repeat(10,1fr);gap:4px}
  .chg-rpe button{padding:9px 0;border-radius:8px;border:1px solid var(--border);background:transparent;
    color:var(--text);font-size:13px;font-weight:700;cursor:pointer}
  .chg-rpeh{display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:4px}
  .chg-row{display:flex;gap:10px;align-items:flex-end;margin-top:12px}
  .chg-row .f{flex:1}
  .chg-row input{width:100%;background:var(--card2,transparent);border:1px solid var(--border);color:var(--text);
    padding:10px;border-radius:8px;font-size:14px}
  .chg-ua{min-width:96px;text-align:right}
  .chg-ua b{display:block;font-size:20px;color:${TEAL};line-height:1.1}
  .chg-ua span{font-size:10px;color:var(--muted)}
  .chg-count{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12px;color:var(--muted)}
  .chg-save{width:100%;margin-top:12px;padding:11px;border:none;border-radius:8px;background:${TEAL};color:#04201c;
    font-size:14px;font-weight:700;cursor:pointer}
  .chg-save:disabled{opacity:.5}
  .chg-daybar{margin:0 0 16px;padding:14px;background:var(--card);border:1px solid var(--border);border-radius:12px}
  .chg-off{width:100%;margin-top:8px;padding:9px;border-radius:8px;border:1px dashed var(--border);
    background:transparent;color:var(--muted);font-size:12px;cursor:pointer}
  .chg-off[aria-pressed="true"]{border-style:solid;border-color:${TEAL};color:${TEAL}}
  .chg-tot{display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;
    padding-top:10px;border-top:1px solid var(--border)}
  .chg-tot b{font-size:22px;color:${TEAL}}
  #charge-section{margin:0 20px 16px}
  .chg-card{padding:14px;background:var(--card);border:1px solid var(--border);border-radius:12px}
  .chg-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:12px}
  .chg-kpi{padding:10px;border:1px solid var(--border);border-radius:10px;text-align:center}
  .chg-kpi b{display:block;font-size:19px;color:var(--text)}
  .chg-kpi span{font-size:10px;color:var(--muted)}
  .chg-zone{margin-top:10px;padding:9px;border-radius:8px;text-align:center;font-size:12px;font-weight:700}
  .chg-tbl{width:100%;border-collapse:collapse;margin-top:12px;font-size:11px}
  .chg-tbl th{text-align:right;color:var(--muted);font-weight:500;padding:5px 3px;border-bottom:1px solid var(--border)}
  .chg-tbl th:first-child,.chg-tbl td:first-child{text-align:left}
  .chg-tbl td{text-align:right;padding:6px 3px;border-bottom:1px solid var(--border);color:var(--text)}
  .chg-hint{font-size:10px;color:var(--muted);margin-top:8px;line-height:1.5}
  .chg-chart{width:100%;height:auto;display:block;font-family:inherit}
  .chg-leg{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--muted);margin-top:6px}
  .chg-leg i{display:inline-block;width:10px;height:3px;border-radius:2px;margin-right:5px;vertical-align:3px}
  .chg-sec{display:flex;align-items:baseline;gap:8px;margin:16px 0 6px}
  .chg-sec h4{margin:0;font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.06em}
  .chg-sec span{font-size:10px;color:var(--muted)}
  .chg-axis{display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:2px}
  .chg-wk4 .chg-kpi{padding:8px 2px}
  .chg-wk4 .chg-kpi span{font-size:9px;white-space:nowrap}
  .chg-tbl tr.cur{background:var(--card2)}
  .chg-tbl td small{display:block;font-size:9px;color:var(--muted);font-weight:400}
  .chg-mrow{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .chg-mk{flex:0 0 38%;font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .chg-mk b{color:var(--text);font-weight:700;margin-right:4px}
  .chg-mtr{flex:1;height:8px;border-radius:4px;background:var(--card2);overflow:hidden}
  .chg-mtr i{display:block;height:100%;border-radius:4px}
  .chg-mp{flex:0 0 42px;text-align:right;font-size:11px;font-weight:700;color:var(--text)}
  .chg-rost{display:flex;align-items:center;gap:10px;padding:11px 12px;margin-bottom:7px;
    background:var(--card);border:1px solid var(--border);border-radius:10px;cursor:pointer}
  .chg-rost .n{font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .chg-rost .s{font-size:11px;color:var(--muted);margin-top:2px}
  .chg-csv,.chg-back{padding:7px 12px;border-radius:8px;border:1px solid var(--border);background:transparent;
    color:var(--muted);font-size:12px;cursor:pointer}
  .chg-csv:disabled{opacity:.5}
  .chg-seg{display:flex;gap:6px;margin-bottom:10px}
  .chg-seg button{flex:1;padding:8px;border-radius:8px;border:1px solid var(--border);background:transparent;
    color:var(--muted);font-size:12px;cursor:pointer}
  .chg-seg button[aria-pressed="true"]{border-color:${TEAL};color:${TEAL};font-weight:700}
  .chg-wrap.chg-free{margin:0 0 8px;padding:12px 14px;background:var(--card);
    border:1px solid var(--border);border-radius:12px}
  .chg-addfree{width:100%;margin-bottom:16px;padding:11px;border-radius:10px;border:1px dashed var(--border);
    background:transparent;color:var(--muted);font-size:13px;cursor:pointer}
  `;
  function injectCSS(){
    if(document.getElementById('chg-css'))return;
    const s=document.createElement('style');s.id='chg-css';s.textContent=CSS;document.head.appendChild(s);
  }

  /* ---------- Accès données ---------- */
  async function loadDay(date){
    const id=uid();if(!id)return{blocks:[],day:null};
    const[{data:blocks},{data:day}]=await Promise.all([
      sb.from('training_load_blocks').select('*').eq('athlete_id',id).eq('date',date),
      sb.from('training_load_days').select('*').eq('athlete_id',id).eq('date',date).maybeSingle()
    ]);
    return{blocks:blocks||[],day:day||null};
  }

  /* La carte wellness (#wd-card) est produite par le patch existant de wellness.js :
     champs pilotés par studios.wellness_config, enregistrement au tap, envoi WhatsApp
     au coach. On ne la recrée surtout pas — on déplace simplement son nœud DANS le
     bloc charge pour n'avoir qu'un seul bloc à remplir. */
  async function mountWellnessCard(){
    const slot=document.getElementById('chg-wd-slot');
    if(!slot)return;
    for(let i=0;i<12;i++){
      const wd=document.getElementById('wd-card');
      if(wd){if(wd.parentElement!==slot)slot.appendChild(wd);return;}
      await new Promise(r=>setTimeout(r,120));
    }
  }
  async function saveBlock(row,existingId){
    if(existingId){
      const{error}=await sb.from('training_load_blocks').update(row).eq('id',existingId);
      if(error)throw error;return existingId;
    }
    const{data,error}=await sb.from('training_load_blocks').insert(row).select('id').single();
    if(error)throw error;return data.id;
  }
  async function saveDay(date,patch){
    const id=uid();if(!id)return;
    const{data:ex}=await sb.from('training_load_days').select('athlete_id').eq('athlete_id',id).eq('date',date).maybeSingle();
    if(ex){await sb.from('training_load_days').update(patch).eq('athlete_id',id).eq('date',date);}
    else{await sb.from('training_load_days').insert({athlete_id:id,date,...patch});}
  }

  /* ---------- Saisie : barre du jour ---------- */
  function dayBarHTML(date,day,blocks){
    const tot=blocks.reduce((a,b)=>a+(b.counts?b.rpe*b.minutes:0),0);
    const min=blocks.reduce((a,b)=>a+(b.counts?b.minutes:0),0);
    return`<div class="chg-daybar" id="chg-daybar">
      <div id="chg-wd-slot"></div>
      <button class="chg-off" data-off aria-pressed="${!!(day&&day.is_off)}">Jour de repos (OFF)</button>
      <div class="chg-tot"><span style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Charge du jour</span>
        <div style="text-align:right"><b id="chg-day-tot">${fmt(tot)}</b>
        <span style="font-size:10px;color:var(--muted)"> UA · ${fmt(min)} min</span></div></div>
    </div>`;
  }

  /* ---------- Saisie : bloc ---------- */
  function blockHTML(s,saved,free){
    const[defMod,defCounts]=TYPEMAP[s.type]||['CF',true];
    const mod=saved?saved.modality:defMod;
    const counts=saved?saved.counts:defCounts;
    const rpe=saved?saved.rpe:0;
    const min=saved?saved.minutes:'';
    const ua=counts&&rpe&&min?rpe*min:0;
    const head=saved
      ?(counts?`<span class="chg-val">${fmt(ua)} UA</span>`:`<span class="chg-val off">hors charge</span>`)
      :`<span class="chg-val off">à renseigner</span>`;
    return`<div class="chg-wrap${free?' chg-free':''}" data-chg="${s.id}" data-type="${s.type||''}">
      <div class="chg-head"><span style="font-size:15px">⚡</span>
        <span class="t">${free?(saved&&saved.label?saved.label:'Séance libre'):'Charge de ce bloc'}</span>
        ${head}<span style="color:var(--muted);font-size:14px">›</span></div>
      <div class="chg-body${free&&!saved?' open':''}">
        ${free?`<div class="chg-lbl" style="margin-top:0">Nom de la séance</div>
          <input type="text" data-label value="${saved&&saved.label?String(saved.label).replace(/"/g,'&quot;'):''}"
            placeholder="Footing, muscu à la maison, compét…"
            style="width:100%;background:var(--card2,transparent);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:8px;font-size:14px">`:''}
        <div class="chg-lbl">Modalité</div>
        <div class="chg-mods">${MODS.map(([k,l])=>`<button class="chg-mod" data-mod="${k}" aria-pressed="${mod===k}">${l}</button>`).join('')}</div>
        <div class="chg-lbl">RPE de séance</div>
        <div class="chg-rpe">${[1,2,3,4,5,6,7,8,9,10].map(n=>
          `<button data-rpe="${n}" ${n===rpe?`style="background:${RPEC[n-1]};border-color:${RPEC[n-1]};color:#fff"`:''}>${n}</button>`).join('')}</div>
        <div class="chg-rpeh"><span>Très facile</span><span>Modéré</span><span>Maximal</span></div>
        <div class="chg-row">
          <div class="f"><div class="chg-lbl" style="margin-top:0">Durée (min)</div>
            <input type="number" inputmode="numeric" min="1" max="600" data-min value="${min}" placeholder="60"></div>
          <div class="chg-ua"><b data-ua>${fmt(ua)}</b><span>RPE × min = UA</span></div>
        </div>
        <label class="chg-count"><input type="checkbox" data-counts ${counts?'checked':''}>
          <span>Compte dans la charge${defCounts?'':' (échauffement / mobilité : décoché par défaut)'}</span></label>
        <button class="chg-save" data-save>${saved?'Mettre à jour':'Enregistrer'}</button>
      </div>
    </div>`;
  }

  function wire(wrap,s,saved,free){
    const st={id:saved?saved.id:null,
      mod:saved?saved.modality:(TYPEMAP[s.type]||['CF',true])[0],
      rpe:saved?saved.rpe:0,
      min:saved?saved.minutes:0,
      counts:saved?saved.counts:(TYPEMAP[s.type]||['CF',true])[1]};
    const body=wrap.querySelector('.chg-body');
    const uaEl=wrap.querySelector('[data-ua]');
    const headVal=wrap.querySelector('.chg-val');
    const recalc=()=>{uaEl.textContent=fmt(st.counts&&st.rpe&&st.min?st.rpe*st.min:0);};

    wrap.querySelector('.chg-head').addEventListener('click',()=>body.classList.toggle('open'));

    wrap.querySelectorAll('[data-mod]').forEach(b=>b.addEventListener('click',()=>{
      st.mod=b.dataset.mod;
      wrap.querySelectorAll('[data-mod]').forEach(x=>x.setAttribute('aria-pressed',x===b));
    }));
    wrap.querySelectorAll('[data-rpe]').forEach(b=>b.addEventListener('click',()=>{
      st.rpe=+b.dataset.rpe;
      wrap.querySelectorAll('[data-rpe]').forEach(x=>{x.removeAttribute('style');});
      b.style.background=RPEC[st.rpe-1];b.style.borderColor=RPEC[st.rpe-1];b.style.color='#fff';
      recalc();
    }));
    wrap.querySelector('[data-min]').addEventListener('input',e=>{st.min=parseInt(e.target.value,10)||0;recalc();});
    wrap.querySelector('[data-counts]').addEventListener('change',e=>{st.counts=e.target.checked;recalc();});

    wrap.querySelector('[data-save]').addEventListener('click',async e=>{
      const btn=e.currentTarget;
      if(!st.rpe||!st.min){btn.textContent='RPE et durée obligatoires';setTimeout(()=>btn.textContent='Enregistrer',1800);return;}
      btn.disabled=true;btn.textContent='Enregistrement…';
      try{
        const date=dayKey();
        const lblEl=wrap.querySelector('[data-label]');
        const label=free?((lblEl&&lblEl.value.trim())||'Séance libre'):(s.title||null);
        const row={athlete_id:uid(),date,modality:st.mod,rpe:st.rpe,minutes:st.min,counts:st.counts,label};
        if(!free){if(isPerso())row.personal_session_id=s.id;else row.session_id=s.id;}
        st.id=await saveBlock(row,st.id);
        const ua=st.counts?st.rpe*st.min:0;
        headVal.className='chg-val'+(st.counts?'':' off');
        headVal.textContent=st.counts?`${fmt(ua)} UA`:'hors charge';
        if(free){const t=wrap.querySelector('.chg-head .t');if(t)t.textContent=label;}
        btn.textContent='✓ Enregistré';btn.disabled=false;
        setTimeout(()=>btn.textContent='Mettre à jour',1600);
        body.classList.remove('open');
        refreshDayTotal();
      }catch(err){
        btn.disabled=false;btn.textContent='Erreur — réessayer';
        console.error('[charge] save block',err);
      }
    });
  }

  async function refreshDayTotal(){
    const el=document.getElementById('chg-day-tot');if(!el)return;
    const{blocks}=await loadDay(dayKey());
    const tot=blocks.reduce((a,b)=>a+(b.counts?b.rpe*b.minutes:0),0);
    const min=blocks.reduce((a,b)=>a+(b.counts?b.minutes:0),0);
    el.textContent=fmt(tot);
    const sib=el.nextElementSibling;if(sib)sib.textContent=` UA · ${fmt(min)} min`;
  }

  /* ---------- Injection dans les cartes de séance ---------- */
  async function decorateSessions(){
    // La saisie de charge n'existe QUE dans l'espace perso de l'athlète.
    // Sur les programmes, on ne touche à rien.
    if(!isPerso())return;
    const area=document.getElementById('sessions-area');
    if(!area||!uid())return;
    const cards=[...area.querySelectorAll('.session-card')];
    const date=dayKey();
    const{blocks,day}=await loadDay(date);
    const key=isPerso()?'personal_session_id':'session_id';
    const byId={};blocks.forEach(b=>{if(b[key])byId[b[key]]=b;});

    // barre du jour en tête
    if(!document.getElementById('chg-daybar')){
      area.insertAdjacentHTML('afterbegin',dayBarHTML(date,day,blocks));
      const bar=document.getElementById('chg-daybar');
      const offBtn=bar.querySelector('[data-off]');
      offBtn.addEventListener('click',async()=>{
        const on=offBtn.getAttribute('aria-pressed')==='true';
        offBtn.setAttribute('aria-pressed',String(!on));
        try{await saveDay(date,{is_off:!on});}catch(e){console.error('[charge] off',e);}
      });
    }
    // la carte wellness existante remonte dans le bloc charge
    mountWellnessCard();

    // séances libres (hors blocs programmés) + bouton d'ajout
    if(!document.getElementById('chg-free')){
      const bar=document.getElementById('chg-daybar');
      bar.insertAdjacentHTML('afterend',`<div id="chg-free"></div>
        <button class="chg-addfree" id="chg-addfree">+ Ajouter une séance libre</button>`);
      const host=document.getElementById('chg-free');
      const frees=blocks.filter(b=>!b.session_id&&!b.personal_session_id);
      frees.forEach(b=>{
        const s={id:'free-'+b.id,type:'wod',title:b.label};
        host.insertAdjacentHTML('beforeend',blockHTML(s,b,true));
        wire(host.querySelector(`[data-chg="free-${b.id}"]`),s,b,true);
      });
      document.getElementById('chg-addfree').addEventListener('click',()=>{
        const tmp='new-'+Date.now();
        const s={id:tmp,type:'wod',title:null};
        host.insertAdjacentHTML('beforeend',blockHTML(s,null,true));
        wire(host.querySelector(`[data-chg="${tmp}"]`),s,null,true);
        host.lastElementChild.scrollIntoView({behavior:'smooth',block:'center'});
      });
    }

    for(const card of cards){
      if(card.dataset.chgBound)continue;
      const sid=(card.id||'').replace(/^sc-/,'');
      if(!sid)continue;
      card.dataset.chgBound='1';
      const type=(card.querySelector('.badge')?.className||'').match(/badge-([a-z]+)/)?.[1]||'wod';
      const s={id:sid,type,title:card.querySelector('.session-title')?.textContent||null};
      const saved=byId[sid]||null;
      const body=card.querySelector('.session-body');if(!body)continue;
      const anchor=body.querySelector('.btn-open-scores');
      const html=blockHTML(s,saved);
      if(anchor)anchor.insertAdjacentHTML('beforebegin',html);
      else body.insertAdjacentHTML('beforeend',html);
      wire(body.querySelector(`[data-chg="${sid}"]`),s,saved);
    }
  }

  /* ---------- Vue « Mon suivi » (page Profil) ---------- */
  /* Graphiques repris de la feuille « Charge UDT » d'Alexis : axes gradués,
     barres de charge quotidienne, courbes aiguë / chronique, et graphe de
     ratio avec bandes de zones. Couleurs adaptées au thème de l'appli. */
  const C_GRID=GRID,C_BAR=BAR,C_ACUTE=WARN,C_OK=OK,C_WARN=WARN,C_BAD=BAD;
  const sdate=iso=>{
    try{return new Date(iso+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'numeric'});}
    catch(e){return iso;}
  };
  function niceMax(v){
    if(v<=0)return 100;
    const p=10**Math.floor(Math.log10(v)),n=v/p;
    return(n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p;
  }
  function xLabels(s,X,H,W,R){
    let g='';
    s.forEach((p,i)=>{
      if((s.length-1-i)%7)return;
      // la dernière étiquette tombe au bord : on l'aligne à droite pour ne pas la rogner
      const near=X(i)>W-R-18;
      g+=`<text x="${near?W-R:X(i)}" y="${H-7}" text-anchor="${near?'end':'middle'}"
        font-size="9.5" fill="var(--muted)">${sdate(p.date)}</text>`;
    });
    return g;
  }
  function chartLoad(s){
    if(!s.length)return'';
    const W=340,H=200,L=36,R=8,T=12,B=24;
    const max=niceMax(Math.max(1,...s.map(p=>Math.max(p.load,p.acute,p.chronic)))*1.05);
    const st=(W-L-R)/s.length,X=i=>L+st*(i+.5),Y=v=>T+(1-v/max)*(H-T-B);
    let g='';
    for(let k=0;k<=4;k++){
      const v=max*k/4;
      g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C_GRID}"/>`
        +`<text x="${L-5}" y="${Y(v)+3.5}" text-anchor="end" font-size="9.5" fill="var(--muted)">${Math.round(v)}</text>`;
    }
    s.forEach((p,i)=>{if(p.load>0)
      g+=`<rect x="${X(i)-st*.32}" y="${Y(p.load)}" width="${st*.64}" height="${Y(0)-Y(p.load)}" rx="1.5" fill="${C_BAR}"/>`;});
    g+=xLabels(s,X,H,W,R);
    const line=(k,c)=>`<path d="${s.map((p,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(p[k]).toFixed(1)).join('')}"`
      +` fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`
      +`<circle cx="${X(s.length-1)}" cy="${Y(s[s.length-1][k])}" r="3.5" fill="${c}"/>`;
    return`<svg class="chg-chart" viewBox="0 0 ${W} ${H}" role="img"
      aria-label="Charge quotidienne, aiguë et chronique">${g}${line('chronic',TEAL)}${line('acute',C_ACUTE)}</svg>
      <div class="chg-leg"><span><i style="background:${C_BAR};height:9px;width:7px"></i>Charge du jour</span>
        <span><i style="background:${C_ACUTE}"></i>Aiguë 7 j</span>
        <span><i style="background:${TEAL}"></i>Chronique 28 j</span></div>`;
  }
  function chartRatio(s){
    const v=s.map(p=>p.ratio).filter(x=>x!=null);
    if(!v.length)return`<p class="chg-hint" style="padding:18px 4px;text-align:center;margin:0">
      Le ratio apparaît après 28 jours d'historique : la charge chronique part de zéro,
      les premières valeurs seraient faussées.</p>`;
    const W=340,H=180,L=30,R=8,T=10,B=24;
    const max=Math.max(2,Math.ceil(Math.max(...v)*5)/5);
    const st=(W-L-R)/s.length,X=i=>L+st*(i+.5),Y=x=>T+(1-x/max)*(H-T-B);
    const band=(a,b,c,o)=>`<rect x="${L}" y="${Y(b)}" width="${W-L-R}" height="${Y(a)-Y(b)}" fill="${c}" opacity="${o}"/>`;
    let g=band(.8,1.3,C_OK,.16)+band(1.3,1.5,C_WARN,.18)+band(1.5,max,C_BAD,.12);
    [0,.8,1.3,1.5,2].filter(x=>x<=max).forEach(x=>{
      g+=`<line x1="${L}" x2="${W-R}" y1="${Y(x)}" y2="${Y(x)}" stroke="${C_GRID}" ${x&&x!==2?'stroke-dasharray="3 4"':''}/>`
        +`<text x="${L-5}" y="${Y(x)+3.5}" text-anchor="end" font-size="9.5" fill="var(--muted)">${String(x).replace('.',',')}</text>`;
    });
    g+=xLabels(s,X,H,W,R);
    let d='',pen=false;
    s.forEach((p,i)=>{
      if(p.ratio!=null){d+=(pen?'L':'M')+X(i).toFixed(1)+' '+Y(Math.min(p.ratio,max)).toFixed(1);pen=true;}
      else pen=false;
    });
    g+=`<path d="${d}" fill="none" stroke="var(--text)" stroke-width="2" stroke-linejoin="round"/>`;
    const lp=s[s.length-1];
    if(lp.ratio!=null)g+=`<circle cx="${X(s.length-1)}" cy="${Y(Math.min(lp.ratio,max))}" r="4.5"
      fill="${zone(Number(lp.ratio)).c}" stroke="var(--card)" stroke-width="2"/>`;
    return`<svg class="chg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ratio aiguë sur chronique">${g}</svg>
      <div class="chg-leg"><span><i style="background:${C_OK}"></i>0,8–1,3</span>
        <span><i style="background:${C_WARN}"></i>1,3–1,5</span>
        <span><i style="background:${C_BAD}"></i>&gt; 1,5</span></div>`;
  }

  /* État au réveil : 28 cases, une par jour. L'état vient du wellness (dérivé
     côté SQL depuis sommeil / énergie / fatigue / courbatures…). */
  /* Jours de règles (case cochée au réveil) : lus directement dans training_load_days */
  async function addPeriods(athleteId,series){
    if(!series||!series.length)return series;
    try{
      const{data}=await sb.from('training_load_days').select('date').eq('athlete_id',athleteId)
        .eq('period',true).gte('date',series[0].d);
      const set=new Set((data||[]).map(r=>r.date));
      series.forEach(p=>{p.period=set.has(p.d);});
    }catch(e){console.warn('[charge] règles',e);}
    return series;
  }

  function wakeStrip(series){
    const s28=series.slice(-28),cnt={};let n=0;
    s28.forEach(p=>{if(p.wake){cnt[p.wake]=(cnt[p.wake]||0)+1;n++;}});
    const W=340,H=40,st=W/28,off=28-s28.length;
    const hasP=s28.some(p=>p.period);
    const cells=s28.map((p,i)=>
      `<rect x="${(off+i)*st+1.5}" y="4" width="${st-3}" height="${H-14}" rx="3"
        fill="${p.wake?WAKEC[p.wake]:GRID}" opacity="${p.wake?1:.5}"
        ><title>${sdate(p.date)} : ${p.wake?(WAKE.find(w=>w[0]===p.wake)||[])[2]||p.wake:'non renseigné'}${p.period?' · règles':''}</title></rect>`+
      (p.period?`<rect x="${(off+i)*st+1.5}" y="${H-7}" width="${st-3}" height="4" rx="2" fill="#f472b6"/>`:'')
    ).join('');
    return`<svg class="chg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="État au réveil sur 28 jours">${cells}</svg>
      <div class="chg-axis"><span>${s28.length?sdate(s28[0].date):''}</span>${hasP?'<span style="color:#f472b6">▬ règles</span>':''}<span>aujourd'hui</span></div>
      <div class="chg-kpis chg-wk4" style="grid-template-columns:repeat(4,1fr);margin-top:12px">
        ${WAKE.map(([k,em,l,c])=>`<div class="chg-kpi"><b style="color:${c}">${cnt[k]||0}</b><span>${em} ${l==='En forme'?'Forme':l}</span></div>`).join('')}
      </div>
      ${n?'':'<p class="chg-hint">Aucun état renseigné sur la période : remplis le bloc wellness du jour.</p>'}`;
  }

  /* Charge par semaine : barres de charge + courbe de monotonie sur un 2e axe */
  function chartWeeks(weeks){
    const w=weeks.slice().reverse();           // du plus ancien au plus récent
    if(!w.length)return'';
    const W=340,H=190,L=38,R=26,T=16,B=36;
    const maxL=niceMax(Math.max(1,...w.map(x=>x.total))*1.1);
    const maxM=3;
    const st=(W-L-R)/w.length,X=i=>L+st*(i+.5);
    const Y=v=>T+(1-v/maxL)*(H-T-B), YM=v=>T+(1-v/maxM)*(H-T-B);
    let g='';
    for(let k=0;k<=4;k++){
      const v=maxL*k/4;
      g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${GRID}"/>`
        +`<text x="${L-5}" y="${Y(v)+3.5}" text-anchor="end" font-size="9.5" fill="var(--muted)">${Math.round(v)}</text>`;
    }
    [0,1,2,3].forEach(v=>{
      g+=`<text x="${W-R+5}" y="${YM(v)+3.5}" font-size="9.5" fill="${C_WARN}">${v}</text>`;
    });
    // seuil de monotonie à 2
    g+=`<line x1="${L}" x2="${W-R}" y1="${YM(2)}" y2="${YM(2)}" stroke="${C_WARN}" stroke-dasharray="4 4" opacity=".7"/>`;
    const cur=today();
    w.forEach((x,i)=>{
      const enCours=x.week_start<=cur&&addDays(x.week_start,7)>cur;
      g+=`<rect x="${X(i)-st*.26}" y="${Y(x.total)}" width="${st*.52}" height="${Y(0)-Y(x.total)}" rx="2"
        fill="${AC}" opacity="${enCours?.45:1}"/>`
        +`<text x="${X(i)}" y="${Y(x.total)-5}" text-anchor="middle" font-size="9.5" fill="var(--text)">${fmt(x.total)}</text>`
        +`<text x="${X(i)}" y="${H-20}" text-anchor="middle" font-size="9.5" fill="var(--muted)">S${isoWeek(x.week_start)}</text>`;
    });
    const mo=w.map((x,i)=>({i,v:x.monotony==null?null:Math.min(Number(x.monotony),maxM)})).filter(p=>p.v!=null);
    if(mo.length){
      g+=`<path d="${mo.map((p,k)=>(k?'L':'M')+X(p.i).toFixed(1)+' '+YM(p.v).toFixed(1)).join('')}"
        fill="none" stroke="${C_WARN}" stroke-width="2" stroke-linejoin="round"/>`
        +mo.map(p=>`<circle cx="${X(p.i)}" cy="${YM(p.v)}" r="3.5" fill="${C_WARN}"/>`).join('');
    }
    return`<svg class="chg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Charge par semaine et monotonie">${g}</svg>
      <div class="chg-leg"><span><i style="background:${AC}"></i>Semaine terminée</span>
        <span><i style="background:${AC};opacity:.45"></i>En cours</span>
        <span><i style="background:${C_WARN}"></i>Monotonie</span></div>`;
  }
  const addDays=(iso,n)=>{const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
  const isoWeek=iso=>{
    const d=new Date(iso+'T12:00:00');
    d.setDate(d.getDate()+3-((d.getDay()+6)%7));
    const y=d.getFullYear(),j=new Date(y,0,4,12);
    return (1+Math.round(((d-j)/864e5-3+((j.getDay()+6)%7))/7))+'/'+String(y).slice(2);
  };

  /* Modalités : part de la charge par discipline sur 28 jours */
  function modsHTML(rows){
    if(!rows||!rows.length)return'<p class="chg-hint">Aucune séance sur cette période.</p>';
    return rows.map(r=>{
      const c=MODC[r.modality]||'var(--muted)';
      return`<div class="chg-mrow">
        <span class="chg-mk"><b>${r.modality}</b> ${MODMAP[r.modality]||''}</span>
        <span class="chg-mtr"><i style="width:${Math.max(2,Number(r.pct))}%;background:${c}"></i></span>
        <span class="chg-mp">${fmt(r.pct)} %</span></div>`;
    }).join('');
  }

  async function renderSuivi(){
    const host=document.getElementById('charge-section');
    if(!host||!uid())return;
    host.innerHTML=`<div class="chg-card"><div style="font-size:13px;font-weight:700">📉 Ma charge d'entraînement</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">Chargement…</div></div>`;
    let series=[],weeks=[],mods=[];
    try{
      const[a,b,m]=await Promise.all([
        sb.rpc('training_load_series',{p_athlete:uid(),p_days:120}),
        sb.rpc('training_load_weeks',{p_athlete:uid(),p_weeks:8}),
        sb.rpc('training_load_modalities',{p_athlete:uid(),p_days:28})
      ]);
      series=a.data||[];weeks=b.data||[];mods=m.data||[];
      await addPeriods(uid(),series);
    }catch(e){console.error('[charge] suivi',e);}

    if(!series.length){
      host.innerHTML=`<div class="chg-card">
        <div style="font-size:13px;font-weight:700">📉 Ma charge d'entraînement</div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.5">
          Renseigne le RPE et la durée de tes blocs dans la page Prog : ta charge, ton ratio aigu / chronique
          et ta monotonie apparaîtront ici.</div></div>`;
      return;
    }
    host.innerHTML=`<div class="chg-card">
      <div class="chg-head" id="chg-suivi-head"><span style="font-size:15px">📉</span>
        <span class="t">Ma charge d'entraînement</span>
        <span class="chg-val">${fmt(series.slice(-7).reduce((a,p)=>a+p.load,0))} UA · 7 j</span>
        <span style="color:var(--muted);font-size:14px">›</span></div>
      <div class="chg-body open" id="chg-suivi-body">${suiviHTML(series,weeks,mods)}</div>
    </div>`;
    document.getElementById('chg-suivi-head')
      .addEventListener('click',()=>document.getElementById('chg-suivi-body').classList.toggle('open'));
  }

  /* Corps commun athlète / coach */
  function suiviHTML(series,weeks,mods){
    const last=series[series.length-1];
    const z=zone(last.ratio==null?null:Number(last.ratio));
    const h7=series.slice(-7).reduce((a,p)=>a+p.minutes,0)/60;
    const wk=weeks[0];
    const s42=series.slice(-42).map(p=>({
      date:p.d,load:+p.load,minutes:+p.minutes,wake:p.wake,period:!!p.period,
      acute:+p.acute,chronic:+p.chronic,ratio:p.ratio==null?null:Number(p.ratio)
    }));
    return`<div class="chg-zone" style="background:${tint(z.c,14)};border:1px solid ${tint(z.c,45)};color:${z.c}">
        ${last.ratio==null?"Amorçage — le ratio s'affiche après 28 jours de données":`Ratio A/C ${fmt(last.ratio,2)} · ${z.l}`}</div>
      <div class="chg-kpis">
        <div class="chg-kpi"><b>${fmt(last.acute)}</b><span>Aiguë · 7 j</span></div>
        <div class="chg-kpi"><b>${fmt(last.chronic)}</b><span>Chronique · 28 j</span></div>
        <div class="chg-kpi"><b>${fmt(h7,1)} h</b><span>Volume · 7 j</span></div>
        <div class="chg-kpi"><b>${wk&&wk.monotony!=null?fmt(wk.monotony,2):'–'}</b><span>Monotonie semaine</span></div>
      </div>
      <div class="chg-sec"><h4>Charge quotidienne</h4><span>42 jours</span></div>
      ${chartLoad(s42)}
      <div class="chg-sec"><h4>Ratio aiguë / chronique</h4><span>42 jours</span></div>
      ${chartRatio(s42)}
      <div class="chg-sec"><h4>État au réveil</h4><span>28 jours</span></div>
      ${wakeStrip(s42)}
      <div class="chg-sec"><h4>Semaines</h4><span>8 dernières</span></div>
      ${chartWeeks(weeks)}
      <table class="chg-tbl"><thead><tr><th>Sem.</th><th>Charge</th><th>Moy.</th><th>Mono.</th><th>Contr.</th><th>OFF</th><th>Heures</th></tr></thead><tbody>
        ${weeks.map(w=>{
          const cur=w.week_start<=today()&&addDays(w.week_start,7)>today();
          return`<tr${cur?' class="cur"':''}><td><b>S${isoWeek(w.week_start)}</b>${
            cur?'<small>en cours</small>':`<small>${w.week_start.slice(8)}/${w.week_start.slice(5,7)}</small>`}</td>
          <td>${fmt(w.total)}</td><td>${fmt(w.avg_day)}</td>
          <td>${w.monotony==null?'–':fmt(w.monotony,2)}</td><td>${w.strain==null?'–':fmt(w.strain)}</td>
          <td>${w.off_days}</td><td>${fmt(w.hours,1)}</td></tr>`;}).join('')}
      </tbody></table>
      <div class="chg-sec"><h4>Modalités</h4><span>28 jours · % de la charge</span></div>
      <div id="chg-mods">${modsHTML(mods)}</div>
      <div class="chg-hint">Ratio aigu / chronique : &lt; 0,8 sous-charge · 0,8–1,3 optimal · 1,3–1,5 vigilance · &gt; 1,5 risque élevé.
      Monotonie = charge moyenne ÷ écart-type de la semaine ; au-dessus de 2, la semaine manque de variation.
      Contrainte = charge × monotonie. Échauffement et mobilité sont exclus de la charge.</div>`;
  }

  /* ---------- Vue coach : onglet admin ⚡ Charge ---------- */
  let _roster=[];
  function riskRank(a){
    const r=a.ratio==null?null:Number(a.ratio);
    let s=0;
    if(r!=null){if(r>1.5)s+=100;else if(r>1.3)s+=60;else if(r<0.8)s+=20;}
    if(a.hard_days>=3)s+=40;else if(a.hard_days>=2)s+=20;
    if(a.monotony!=null&&Number(a.monotony)>2)s+=25;
    if(!a.last_entry)s-=10;
    if(a.is_me)s+=5; // sa propre ligne remonte à profil de risque égal
    return s;
  }
  function rosterHTML(){
    if(!_roster.length)return`<div style="color:var(--muted);font-size:13px;padding:10px 0">
      Aucun athlète n'a encore renseigné sa charge.</div>`;
    return _roster.map(a=>{
      const r=a.ratio==null?null:Number(a.ratio);
      const z=zone(r);
      const stale=a.last_entry?Math.round((Date.now()-new Date(a.last_entry))/86400000):null;
      return`<div class="chg-rost" data-ath="${a.athlete_id}" style="border-left:3px solid ${z.c}">
        <div style="flex:1;min-width:0">
          <div class="n">${a.is_favorite?'⭐ ':''}${a.full_name||a.email||'—'}${
            a.is_me?' <span style="font-size:10px;color:var(--muted);font-weight:500">· moi</span>':''}</div>
          <div class="s">${fmt(a.load7)} UA · 7 j · ${fmt(a.hours7,1)} h${
            a.monotony!=null?` · mono. ${fmt(a.monotony,2)}`:''}${
            a.hard_days>0?` · ${a.hard_days} journée${a.hard_days>1?'s':''} difficile${a.hard_days>1?'s':''}`:''}</div>
          ${stale===null?'<div class="s" style="color:var(--muted)">aucune saisie</div>'
            :stale>7?`<div class="s" style="color:var(--orange)">dernière saisie il y a ${stale} j</div>`:''}
        </div>
        <div style="text-align:right">
          <div style="font-size:17px;font-weight:700;color:${z.c}">${r==null?'–':fmt(r,2)}</div>
          <div style="font-size:9px;color:var(--muted)">${z.l}</div>
        </div></div>`;
    }).join('');
  }
  let _favOnly=true;
  async function loadRoster(){
    const panel=document.getElementById('admin-charge');if(!panel)return;
    panel.innerHTML='<div class="spinner"></div>';
    try{
      const{data,error}=await sb.rpc('training_load_roster',{p_favorites:_favOnly});
      if(error)throw error;
      _roster=(data||[]).sort((a,b)=>riskRank(b)-riskRank(a)||(b.load7-a.load7));
    }catch(e){
      console.error('[charge] roster',e);
      panel.innerHTML='<div style="color:var(--muted);font-size:13px">Impossible de charger le roster.</div>';return;
    }
    panel.innerHTML=`<div id="chg-rost-view">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="flex:1"><div style="font-size:14px;font-weight:700">Charge de mes athlètes</div>
          <div style="font-size:11px;color:var(--muted)">Les athlètes en zone de risque remontent en premier</div></div>
          <button class="chg-csv" id="chg-csv">⬇ CSV</button>
        </div>
        <div class="chg-seg">
          <button data-fav="1" aria-pressed="${_favOnly}">⭐ Favoris</button>
          <button data-fav="0" aria-pressed="${!_favOnly}">Tous</button>
        </div>
        ${_favOnly&&!_roster.length
          ?`<div style="color:var(--muted);font-size:12px;padding:10px 0;line-height:1.5">
             Aucun athlète en favori. Ajoute-les en favori depuis la fiche athlète, ou bascule sur « Tous ».</div>`
          :rosterHTML()}
      </div>
      <div id="chg-fiche-view" style="display:none"></div>`;
    panel.querySelectorAll('[data-ath]').forEach(el=>
      el.addEventListener('click',()=>openFiche(el.dataset.ath)));
    panel.querySelectorAll('[data-fav]').forEach(b=>b.addEventListener('click',()=>{
      const v=b.dataset.fav==='1';
      if(v===_favOnly)return;
      _favOnly=v;loadRoster();
    }));
    const csv=document.getElementById('chg-csv');
    if(csv)csv.addEventListener('click',exportCSV);
  }
  /* Raccourci depuis l'espace perso : ouvre l'onglet ⚡ Charge directement
     sur le suivi individuel de l'athlète affiché ; « Retour » ramène à son espace perso. */
  async function openSuiviAthlete(){
    const ath=window.currentPersoAthlete||(typeof currentPersoAthlete!=='undefined'?currentPersoAthlete:null);
    if(!ath||!ath.id)return;
    injectCoachTab();
    const btn=document.getElementById('chg-admin-tab-btn');
    const panel=document.getElementById('admin-charge');
    if(!btn||!panel)return;
    document.querySelectorAll('.admin-tab-btn').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
    panel.classList.add('active');
    try{btn.scrollIntoView({block:'nearest',inline:'center'});}catch(e){}
    await loadRoster();
    await openFiche(ath.id,{name:ath.full_name||ath.email,fromPerso:true});
    const page=document.getElementById('page-admin');if(page)page.scrollTop=0;
    window.scrollTo(0,0);
  }
  window.openSuiviAthlete=openSuiviAthlete;

  function backToPerso(){
    const pBtn=Array.from(document.querySelectorAll('.admin-tab-btn'))
      .find(b=>(b.getAttribute('onclick')||'').indexOf("'perso'")>-1);
    const pPanel=document.getElementById('admin-perso');
    if(!pBtn||!pPanel)return;
    // on réaffiche le panneau tel quel (fiche + semaine en cours), sans recharger la liste
    document.querySelectorAll('.admin-tab-btn').forEach(x=>x.classList.remove('active'));
    pBtn.classList.add('active');
    document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
    pPanel.classList.add('active');
    try{pBtn.scrollIntoView({block:'nearest',inline:'center'});}catch(e){}
  }

  async function openFiche(athleteId,opts){
    opts=opts||{};
    const a=_roster.find(x=>x.athlete_id===athleteId)||{full_name:opts.name};
    const list=document.getElementById('chg-rost-view'),fiche=document.getElementById('chg-fiche-view');
    if(!fiche)return;
    list.style.display='none';fiche.style.display='';
    fiche.innerHTML='<div class="spinner"></div>';
    let series=[],weeks=[],mods=[];
    try{
      const[s,w,m]=await Promise.all([
        sb.rpc('training_load_series',{p_athlete:athleteId,p_days:120}),
        sb.rpc('training_load_weeks',{p_athlete:athleteId,p_weeks:8}),
        sb.rpc('training_load_modalities',{p_athlete:athleteId,p_days:28})
      ]);
      series=s.data||[];weeks=w.data||[];mods=m.data||[];
      await addPeriods(athleteId,series);
    }catch(e){console.error('[charge] fiche',e);}
    fiche.innerHTML=`<button class="chg-back" id="chg-back">${opts.fromPerso?'‹ Retour à l\'espace perso':'‹ Retour'}</button>
      <div style="font-size:15px;font-weight:700;margin:10px 0 2px">${a.full_name||a.email||'Athlète'}</div>
      ${series.length?suiviHTML(series,weeks,mods)
        :'<div style="color:var(--muted);font-size:13px;margin-top:8px">Aucune saisie de charge pour cet athlète.</div>'}`;
    document.getElementById('chg-back').addEventListener('click',()=>{
      fiche.style.display='none';list.style.display='';
      if(opts.fromPerso)backToPerso();
    });
  }
  async function exportCSV(){
    const btn=document.getElementById('chg-csv');
    if(btn){btn.disabled=true;btn.textContent='…';}
    const q=v=>{v=String(v==null?'':v);return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
    const rows=[['Athlète','Date','Charge jour (UA)','Minutes','Aiguë 7 j','Chronique 28 j','Ratio A/C','Réveil','OFF']];
    for(const a of _roster){
      if(!a.last_entry)continue; // on n'exporte que les athlètes qui ont saisi
      try{
        const{data}=await sb.rpc('training_load_series',{p_athlete:a.athlete_id,p_days:120});
        (data||[]).forEach(p=>rows.push([a.full_name||a.email,p.d,p.load,p.minutes,p.acute,p.chronic,p.ratio,p.wake,p.is_off?'oui':'']));
      }catch(e){console.error('[charge] csv',a.athlete_id,e);}
    }
    const blob=new Blob(['﻿'+rows.map(r=>r.map(q).join(';')).join('\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`charge-${today()}.csv`;document.body.appendChild(link);link.click();
    link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
    if(btn){btn.disabled=false;btn.textContent='⬇ CSV';}
  }
  function injectCoachTab(){
    if(document.getElementById('chg-admin-tab-btn'))return;
    const bar=document.querySelector('.admin-tabs');const page=document.getElementById('page-admin');
    if(!bar||!page)return;
    const btn=document.createElement('button');
    btn.className='admin-tab-btn';btn.id='chg-admin-tab-btn';btn.textContent='⚡ Charge';
    btn.onclick=function(){adminTab('tlcharge',this);};
    bar.appendChild(btn);
    const panel=document.createElement('div');
    panel.className='admin-panel';panel.id='admin-charge';
    const panels=page.querySelectorAll('.admin-panel');
    const lastPanel=panels[panels.length-1];
    if(lastPanel)lastPanel.insertAdjacentElement('afterend',panel);else page.appendChild(panel);
    const prev=window.adminTab;
    window.adminTab=function(tab,b){
      if(tab==='tlcharge'){
        document.querySelectorAll('.admin-tab-btn').forEach(x=>x.classList.remove('active'));
        if(b)b.classList.add('active');
        document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
        panel.classList.add('active');
        loadRoster();
        return;
      }
      if(prev)prev(tab,b);
    };
  }

  /* ---------- Branchements ---------- */
  function bind(){
    injectCSS();
    if(typeof window.renderSessions==='function'){
      const prev=window.renderSessions;
      window.renderSessions=async function(){
        const r=await prev.apply(this,arguments);
        try{await decorateSessions();}catch(e){console.error('[charge] decorate',e);}
        return r;
      };
    }
    // selectProg('__perso__') appelle renderPersoSessions() EN DIRECT, sans passer
    // par renderSessions : c'est ce chemin-là qu'il faut aussi intercepter.
    if(typeof window.renderPersoSessions==='function'){
      const prevPerso=window.renderPersoSessions;
      window.renderPersoSessions=async function(){
        const r=await prevPerso.apply(this,arguments);
        try{await decorateSessions();}catch(e){console.error('[charge] decorate perso',e);}
        return r;
      };
    }
    if(typeof window.goPage==='function'){
      const prevGo=window.goPage;
      window.goPage=function(p){
        const r=prevGo.apply(this,arguments);
        if(p==='profil')setTimeout(()=>{renderSuivi().catch(e=>console.error('[charge] suivi',e));},0);
        if(p==='admin')setTimeout(injectCoachTab,0);
        return r;
      };
    }
    // si les séances du jour sont déjà rendues au moment du branchement
    setTimeout(()=>{decorateSessions().catch(e=>console.error('[charge] decorate',e));},300);
  }

  if(window.__STUDIO__)bind();
  else if(typeof window.waitForStudioReady==='function')waitForStudioReady(8000).then(bind);
  else window.addEventListener('studio:ready',bind,{once:true});
  // filet de sécurité : si rien n'a branché au bout de 10 s, on branche quand même
  setTimeout(()=>{if(!document.getElementById('chg-css'))bind();},10000);
})();
