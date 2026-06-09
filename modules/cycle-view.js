// ===================================================
// VUE CYCLE — grille thématique + transfert vers Séance+
// Dépend de : core.js (cycleData, allCycles, scheduleAutoSaveCycle,
//   closeCycleCellModal, isLightColor, selectedChipColor,
//   _setChipAutoSaveStatus, autoResizeCycleInput, adminTab,
//   resetSessionForm, setEditorContent, renderSessionGrid,
//   renderSessionRowsConfig, cycleCellTarget)
// ===================================================

const CYCLE_THEMES_DEFAULT=['Weightlifting','Gymnastics','Strongman','Renforcement','Skill','Bodybuilding'];
const DAYS_CYCLE=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

function _ensureCycleThemes(){if(!cycleData.themes)cycleData.themes=[...CYCLE_THEMES_DEFAULT];if(!cycleData.themeCells)cycleData.themeCells={};}

// ── Rendu principal ──────────────────────────────────
function renderCycleGridNew(){
  _ensureCycleThemes();
  const themes=cycleData.themes;
  const weeks=parseInt(document.getElementById('cycle-weeks')?.value)||cycleData.weeks||8;
  cycleData.weeks=weeks;
  const startInput=document.getElementById('cycle-start-date')?.value;
  const startDate=startInput?new Date(startInput+'T12:00:00'):(()=>{const d=new Date();const day=d.getDay();d.setDate(d.getDate()-(day===0?6:day-1));return d;})();
  if(!cycleData.summaryRow)cycleData.summaryRow={};
  let html=`<div style="margin-bottom:18px"><table class="session-grid-table"><thead><tr><th class="row-header" style="color:var(--accent)">Résumé</th>${DAYS_CYCLE.map(d=>`<th>${d}</th>`).join('')}</tr></thead><tbody><tr><td class="session-row-label"><div class="session-row-label-inner"><span style="font-size:11px;font-weight:700;color:var(--muted)">Cycle</span></div></td>${DAYS_CYCLE.map((_,di)=>{const key=`sum-${di}`;const chips=cycleData.summaryRow[key]||[];const chipsHtml=chips.map((chip,chi)=>{const fg=isLightColor(chip.color)?'#111':'#fff';return `<div class="session-chip" style="background:${chip.color};color:${fg};display:flex;align-items:center;gap:5px"><span class="session-chip-text" style="flex:1;min-width:0" onclick="event.stopPropagation();editSummaryChip(${di},${chi})">${chip.text}</span><button class="session-chip-del" onclick="event.stopPropagation();removeSummaryChip(${di},${chi})" style="position:static;opacity:.7">✕</button></div>`;}).join('');return `<td class="session-cell" data-sum="1" data-di="${di}"><div class="session-cell-inner">${chipsHtml}<button class="cycle-add-btn">+</button></div></td>`;}).join('')}</tr></tbody></table></div>`;
  for(let wk=0;wk<weeks;wk++){
    const wStart=new Date(startDate);wStart.setDate(startDate.getDate()+wk*7);const wEnd=new Date(wStart);wEnd.setDate(wStart.getDate()+6);
    const wLabel=`${wStart.getDate()}/${wStart.getMonth()+1} → ${wEnd.getDate()}/${wEnd.getMonth()+1}`;
    html+=`<div style="margin-bottom:18px"><div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:2px;color:var(--orange);margin:6px 2px 6px;padding:4px 0;border-bottom:1px solid var(--border2)">SEMAINE ${wk+1} <span style="font-size:11px;color:var(--muted);font-weight:400;letter-spacing:0;font-family:inherit">${wLabel}</span></div><table class="session-grid-table"><thead><tr><th class="row-header">Thème</th>${DAYS_CYCLE.map(d=>`<th>${d}</th>`).join('')}</tr></thead><tbody>`;
    themes.forEach((theme,ti)=>{
      html+=`<tr><td class="session-row-label"><div class="session-row-label-inner"><span style="font-size:12px;font-weight:700;color:var(--text2)">${theme}</span></div></td>`;
      html+=DAYS_CYCLE.map((_,di)=>{
        const key=`t${wk}-${ti}-${di}`;const chips=(cycleData.themeCells[key]||[]);
        const chipsHtml=chips.map((chip,chi)=>{
          const fg=isLightColor(chip.color)?'#111':'#fff';
          const DAYS_N=7;
          const mvBtn=(label,disabled,onclick)=>`<button style="padding:1px 5px;font-size:9px;background:rgba(0,0,0,.25);border:none;color:${fg};border-radius:3px;cursor:${disabled?'default':'pointer'};opacity:${disabled?'.2':'.8'};line-height:1.3" ${disabled?'disabled':''} onclick="${disabled?'event.stopPropagation()':'event.stopPropagation();'+onclick}">${label}</button>`;
          return `<div class="session-chip" style="background:${chip.color};color:${fg};${chip.done?'opacity:.55;text-decoration:line-through':''};display:flex;flex-direction:column;gap:4px;padding:6px 6px 5px"><div style="display:flex;align-items:center;justify-content:space-between;gap:4px"><span class="chip-toggle" data-toggle-key="${key}" data-toggle-idx="${chi}" data-bucket="theme" role="checkbox" aria-checked="${!!chip.done}" title="Traité" style="flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1.5px solid ${fg};border-radius:3px;background:${chip.done?fg:'transparent'};color:${chip.done?(isLightColor(fg)?'#111':chip.color):fg};font-size:11px;line-height:1;cursor:pointer;user-select:none">${chip.done?'✓':''}</span><div style="display:flex;gap:2px;align-items:center">${mvBtn('↑',ti===0,`moveThemeChip(${wk},${ti},${di},${chi},-1,0)`)}${mvBtn('↓',ti===themes.length-1,`moveThemeChip(${wk},${ti},${di},${chi},1,0)`)}${mvBtn('←',di===0,`moveThemeChip(${wk},${ti},${di},${chi},0,-1)`)}${mvBtn('→',di===DAYS_N-1,`moveThemeChip(${wk},${ti},${di},${chi},0,1)`)}<button class="session-chip-del" onclick="event.stopPropagation();removeThemeChip('${key}',${chi})" style="padding:1px 5px;font-size:9px;background:rgba(0,0,0,.25);border:none;color:${fg};border-radius:3px;cursor:pointer;opacity:.8">✕</button></div></div><span class="session-chip-text" style="white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.5" onclick="event.stopPropagation();editThemeChip(${wk},${ti},${di},${chi})">${chip.text}</span><div style="display:flex;justify-content:flex-end"><button class="theme-chip-send" data-text=${JSON.stringify(chip.text)} title="Envoyer vers Séance+" style="padding:2px 8px;font-size:9px;font-weight:700;background:rgba(0,0,0,.25);border:1px solid ${fg}55;color:${fg};border-radius:4px;cursor:pointer;opacity:.8">→ Séance+</button></div></div>`;
        }).join('');
        return `<td class="session-cell" data-wk="${wk}" data-ti="${ti}" data-di="${di}"><div class="session-cell-inner">${chipsHtml}<button class="cycle-add-btn">+</button></div></td>`;
      }).join('');
      html+=`</tr>`;
    });
    html+='</tbody></table></div>';
  }
  const grid=document.getElementById('cycle-grid');if(grid)grid.innerHTML=html;
  if(grid)grid.querySelectorAll('[data-bucket="theme"]').forEach(t=>{t.addEventListener('click',function(ev){ev.stopPropagation();ev.preventDefault();const k=this.getAttribute('data-toggle-key');const i=parseInt(this.getAttribute('data-toggle-idx'));toggleThemeChipDone(k,i);});});
  if(grid)grid.querySelectorAll('.theme-chip-send').forEach(btn=>{btn.addEventListener('click',function(ev){ev.stopPropagation();ev.preventDefault();sendThemeChipToSession(this.dataset.text);});});
  if(grid)grid.querySelectorAll('td.session-cell[data-sum]').forEach(td=>{td.addEventListener('click',function(ev){if(ev.target.closest('.session-chip-del,.session-chip-text'))return;openSummaryChipModal(parseInt(this.dataset.di));});});
  if(grid)grid.querySelectorAll('td.session-cell[data-wk]').forEach(td=>{td.addEventListener('click',function(ev){if(ev.target.closest('.theme-chip-send,.session-chip-del,.chip-toggle,.session-chip-text'))return;const wk=parseInt(this.dataset.wk),ti=parseInt(this.dataset.ti),di=parseInt(this.dataset.di);openThemeCellModal(wk,ti,di);});});
}

// ── Résumé ────────────────────────────────────────────
let _themeCellTarget=null;
function openSummaryChipModal(di,editIdx=null){if(!cycleData.summaryRow)cycleData.summaryRow={};_themeCellTarget={summary:true,di,editIdx};document.getElementById('cycle-cell-title').textContent=`Résumé — ${DAYS_CYCLE[di]}`;document.getElementById('cycle-cell-subtitle').textContent='Résumé du cycle pour ce jour';document.getElementById('cycle-cell-presets').style.display='none';const key=`sum-${di}`;const chip=editIdx!=null?(cycleData.summaryRow[key]||[])[editIdx]:null;document.getElementById('cycle-cell-input').value=chip?chip.text:'';selectedChipColor=chip?chip.color:'#e8ff47';document.querySelectorAll('.chip-color-btn').forEach(b=>b.classList.toggle('selected',b.dataset.color===selectedChipColor));document.getElementById('cycle-cell-modal').classList.add('open');_setChipAutoSaveStatus('idle');setTimeout(()=>{autoResizeCycleInput(document.getElementById('cycle-cell-input'));document.getElementById('cycle-cell-input').focus();},300);}
function editSummaryChip(di,chi){openSummaryChipModal(di,chi);}
function removeSummaryChip(di,chi){if(!cycleData.summaryRow)return;const key=`sum-${di}`;if(cycleData.summaryRow[key])cycleData.summaryRow[key].splice(chi,1);renderCycleGridNew();scheduleAutoSaveCycle();}

// ── Chips thème ────────────────────────────────────────
function openThemeCellModal(wk,ti,di){_ensureCycleThemes();_themeCellTarget={wk,ti,di,editIdx:null};const theme=cycleData.themes[ti]||'—';document.getElementById('cycle-cell-title').textContent=`Sem. ${wk+1} — ${theme} — ${DAYS_CYCLE[di]}`;document.getElementById('cycle-cell-subtitle').textContent='Ajoute une séance';document.getElementById('cycle-cell-presets').style.display='none';document.getElementById('cycle-cell-input').value='';selectedChipColor='#e8ff47';document.querySelectorAll('.chip-color-btn').forEach(b=>b.classList.toggle('selected',b.dataset.color==='#e8ff47'));document.getElementById('cycle-cell-modal').classList.add('open');_setChipAutoSaveStatus('idle');setTimeout(()=>{autoResizeCycleInput(document.getElementById('cycle-cell-input'));document.getElementById('cycle-cell-input').focus();},300);}
function editThemeChip(wk,ti,di,chi){_ensureCycleThemes();const key=`t${wk}-${ti}-${di}`;const chip=(cycleData.themeCells[key]||[])[chi];if(!chip)return;_themeCellTarget={wk,ti,di,editIdx:chi};document.getElementById('cycle-cell-title').textContent=`Sem. ${wk+1} — ${cycleData.themes[ti]||'—'} — ${DAYS_CYCLE[di]}`;document.getElementById('cycle-cell-subtitle').textContent='Modifier';document.getElementById('cycle-cell-presets').style.display='none';document.getElementById('cycle-cell-input').value=chip.text;selectedChipColor=chip.color||'#e8ff47';document.querySelectorAll('.chip-color-btn').forEach(b=>b.classList.toggle('selected',b.dataset.color===chip.color));document.getElementById('cycle-cell-modal').classList.add('open');_setChipAutoSaveStatus('idle');setTimeout(()=>autoResizeCycleInput(document.getElementById('cycle-cell-input')),0);}
function removeThemeChip(key,chi){if(cycleData.themeCells[key])cycleData.themeCells[key].splice(chi,1);renderCycleGridNew();scheduleAutoSaveCycle();}
function toggleThemeChipDone(key,chi){const arr=cycleData.themeCells[key];if(!arr||!arr[chi])return;arr[chi].done=!arr[chi].done;renderCycleGridNew();scheduleAutoSaveCycle();}

function sendThemeChipToSession(text){
  if(!text)return;
  const newSessionBtn=Array.from(document.querySelectorAll('.admin-tab-btn')).find(b=>(b.getAttribute('onclick')||'').includes("'new-session'"));
  if(typeof resetSessionForm==='function')resetSessionForm();
  if(typeof adminTab==='function'&&newSessionBtn)adminTab('new-session',newSessionBtn);
  if(typeof setEditorContent==='function')setEditorContent(text.replace(/\\n/g,'\n'));
  showToast('✅ Séance pré-remplie');
  const pageAdmin=document.getElementById('page-admin');if(pageAdmin)pageAdmin.scrollTop=0;
}

function _moveChip(cells,keyFrom,chi,keyTo){const arr=cells[keyFrom];if(!arr||!arr[chi])return false;const chip=arr.splice(chi,1)[0];if(!cells[keyTo])cells[keyTo]=[];cells[keyTo].push(chip);return true;}
function moveThemeChip(wk,ti,di,chi,dTi,dDi){_ensureCycleThemes();const themes=cycleData.themes;const DAYS_N=7;const newTi=ti+dTi,newDi=di+dDi;if(newTi<0||newTi>=themes.length||newDi<0||newDi>=DAYS_N)return;const keyFrom=`t${wk}-${ti}-${di}`,keyTo=`t${wk}-${newTi}-${newDi}`;if(_moveChip(cycleData.themeCells,keyFrom,chi,keyTo)){renderCycleGridNew();scheduleAutoSaveCycle();}}

// ── Auto-save chip thème ───────────────────────────────
(function(){
  if(window.__themeChipSaveBound)return;window.__themeChipSaveBound=true;
  const _origSave=window._doAutoSaveCycleChip;
  window._doAutoSaveCycleChip=function(){
    if(_themeCellTarget&&document.getElementById('cycle-cell-modal')?.classList.contains('open')){
      _ensureCycleThemes();if(!cycleData.summaryRow)cycleData.summaryRow={};
      const inputEl=document.getElementById('cycle-cell-input');if(!inputEl)return;
      const text=inputEl.value.trim();const t=_themeCellTarget;
      if(t.summary){
        const key=`sum-${t.di}`;if(!text&&t.editIdx==null)return;_setChipAutoSaveStatus('saving');if(!cycleData.summaryRow[key])cycleData.summaryRow[key]=[];
        if(t.editIdx!=null){if(!text){cycleData.summaryRow[key].splice(t.editIdx,1);_themeCellTarget.editIdx=null;}else{cycleData.summaryRow[key][t.editIdx]={text,color:selectedChipColor};}}
        else{cycleData.summaryRow[key].push({text,color:selectedChipColor});_themeCellTarget.editIdx=cycleData.summaryRow[key].length-1;}
        renderCycleGridNew();scheduleAutoSaveCycle();setTimeout(()=>_setChipAutoSaveStatus('saved'),200);return;
      }
      const key=`t${t.wk}-${t.ti}-${t.di}`;if(!text&&t.editIdx==null)return;_setChipAutoSaveStatus('saving');
      if(!cycleData.themeCells[key])cycleData.themeCells[key]=[];
      if(t.editIdx!=null){if(!text){cycleData.themeCells[key].splice(t.editIdx,1);_themeCellTarget.editIdx=null;}else{cycleData.themeCells[key][t.editIdx]={text,color:selectedChipColor,done:!!(cycleData.themeCells[key][t.editIdx]||{}).done};}}
      else{cycleData.themeCells[key].push({text,color:selectedChipColor,done:false});_themeCellTarget.editIdx=cycleData.themeCells[key].length-1;}
      renderCycleGridNew();scheduleAutoSaveCycle();setTimeout(()=>_setChipAutoSaveStatus('saved'),200);return;
    }
    if(typeof _origSave==='function')_origSave.apply(this,arguments);
  };
})();

// ── Patch renderSessionGrid : bouton → Séance+ dans les <th> ──
(function(){
  if(window.__cycleTransferBound)return;window.__cycleTransferBound=true;
  function _patchRenderSessionGrid(){const orig=window.renderSessionGrid;if(orig&&orig.__transferPatched)return;window.renderSessionGrid=function(){orig.apply(this,arguments);const grid=document.getElementById('cycle-grid');if(!grid)return;grid.querySelectorAll('.session-grid-table').forEach((table,wk)=>{const ths=table.querySelectorAll('thead tr th');ths.forEach((th,idx)=>{if(idx===0)return;const di=idx-1;if(th.querySelector('.cycle-to-session-btn'))return;const btn=document.createElement('button');btn.className='cycle-to-session-btn';btn.title='Transférer vers Séance+';btn.innerHTML='→ Séance+';btn.style.cssText='display:block;margin:4px auto 0;padding:2px 7px;font-size:10px;font-weight:700;background:var(--card2);border:1px solid var(--accent);color:var(--accent);border-radius:5px;cursor:pointer;white-space:nowrap;letter-spacing:.5px';btn.addEventListener('click',(e)=>{e.stopPropagation();transferCycleToSession(wk,di);});th.appendChild(btn);});});};window.renderSessionGrid.__transferPatched=true;}
  if(typeof renderSessionGrid==='function')_patchRenderSessionGrid();else document.addEventListener('DOMContentLoaded',()=>{if(typeof renderSessionGrid==='function'&&!renderSessionGrid.__transferPatched)_patchRenderSessionGrid();});
})();

// Transfert colonne-jour → formulaire Séance+
const CYCLE_ROW_FIELD_MAP=[{keys:['wod'],field:'wod'},{keys:['athlete','target','objectif'],field:'target'},{keys:['coach','tips','conseil'],field:'tips'},{keys:['rpe','intensity','intensité'],field:'intensity'},{keys:['inter','intermédiaire','intermediaire'],field:'inter'},{keys:['scaled'],field:'scaled'},{keys:['foundation','fond','fondation'],field:'foundation'}];
function _matchCycleRowField(rowName){const n=(rowName||'').toLowerCase().trim();for(const entry of CYCLE_ROW_FIELD_MAP){if(entry.keys.some(k=>n.includes(k)))return entry.field;}return null;}

function transferCycleToSession(wk,di){
  if(!cycleData||!cycleData.rows){showToast('⚠️ Aucun cycle chargé');return;}
  const rows=cycleData.rows;const fields={wod:null,target:null,tips:null,intensity:null,inter:null,scaled:null,foundation:null};let hasContent=false;
  rows.forEach((rowName,ri)=>{const field=_matchCycleRowField(rowName);if(!field)return;const key=`w${wk}-${ri}-${di}`;const chips=cycleData.sessionCells[key]||[];if(!chips.length)return;fields[field]=chips[0].text;hasContent=true;});
  if(!hasContent){showToast('⚠️ Aucun contenu dans cette colonne');return;}
  window._returnToSessionsAfterSave=false;
  const newSessionBtn=Array.from(document.querySelectorAll('.admin-tab-btn')).find(b=>(b.getAttribute('onclick')||'').includes("'new-session'"));
  if(typeof resetSessionForm==='function')resetSessionForm();if(typeof adminTab==='function'&&newSessionBtn)adminTab('new-session',newSessionBtn);
  const startDateEl=document.getElementById('cycle-start-date');const startDate=startDateEl?startDateEl.value:null;
  if(startDate){try{const base=new Date(startDate+'T12:00:00');base.setDate(base.getDate()+wk*7+di);document.getElementById('f-date').value=base.toISOString().split('T')[0];}catch(e){}}
  if(fields.wod!==null&&typeof setEditorContent==='function')setEditorContent(fields.wod);
  if(fields.target!==null){const el=document.getElementById('f-target');if(el)el.value=fields.target;}
  if(fields.tips!==null){const el=document.getElementById('f-tips');if(el)el.value=fields.tips;}
  if(fields.inter!==null){const el=document.getElementById('f-scaling-inter');if(el)el.value=fields.inter;}
  if(fields.scaled!==null){const el=document.getElementById('f-scaling-scaled');if(el)el.value=fields.scaled;}
  if(fields.foundation!==null){const el=document.getElementById('f-scaling-foundation');if(el)el.value=fields.foundation;}
  if(fields.intensity!==null){const v=parseInt(fields.intensity);if(!isNaN(v)){const el=document.getElementById('f-intensity');const lbl=document.getElementById('f-int-val');if(el)el.value=v;if(lbl)lbl.textContent=v;}}
  showToast('✅ Champs pré-remplis depuis le cycle');
  const pageAdmin=document.getElementById('page-admin');if(pageAdmin)pageAdmin.scrollTop=0;
}

// ── Réordonnement lignes session (↑↓) ─────────────────
function moveSessionRow(ri,dir){
  const rows=cycleData.rows;const newRi=ri+dir;if(newRi<0||newRi>=rows.length)return;
  [rows[ri],rows[newRi]]=[rows[newRi],rows[ri]];
  const cells=cycleData.sessionCells;const weeks=cycleData.weeks||8;const DAYS_N=7;
  for(let wk=0;wk<weeks;wk++){for(let di=0;di<DAYS_N;di++){const keyA=`w${wk}-${ri}-${di}`,keyB=`w${wk}-${newRi}-${di}`;const tmp=cells[keyA];if(cells[keyB]!==undefined)cells[keyA]=cells[keyB];else delete cells[keyA];if(tmp!==undefined)cells[keyB]=tmp;else delete cells[keyB];}}
  if(typeof renderSessionRowsConfig==='function')renderSessionRowsConfig();if(typeof renderCycleGrid==='function')renderCycleGrid();scheduleAutoSaveCycle();
}

(function(){
  if(window.__sessionRowMoveBound)return;window.__sessionRowMoveBound=true;
  function _patch(){const orig=window.renderSessionRowsConfig;if(!orig||orig.__movePatched)return;window.renderSessionRowsConfig=function(){const el=document.getElementById('session-rows-config');if(!el||!cycleData||!cycleData.rows){orig.apply(this,arguments);return;}const rows=cycleData.rows;el.innerHTML=rows.map((r,i)=>`<div style="display:flex;align-items:center;gap:6px"><div style="display:flex;flex-direction:column;gap:2px"><button onclick="moveSessionRow(${i},-1)" ${i===0?'disabled':''} style="padding:2px 7px;font-size:11px;line-height:1.4;background:var(--card2);border:1px solid var(--border2);color:var(--text2);border-radius:4px;cursor:pointer;${i===0?'opacity:.3':''}">↑</button><button onclick="moveSessionRow(${i},1)" ${i===rows.length-1?'disabled':''} style="padding:2px 7px;font-size:11px;line-height:1.4;background:var(--card2);border:1px solid var(--border2);color:var(--text2);border-radius:4px;cursor:pointer;${i===rows.length-1?'opacity:.3':''}">↓</button></div><input type="text" class="form-input" value="${r}" oninput="cycleData.rows[${i}]=this.value;renderCycleGrid();scheduleAutoSaveCycle()" style="flex:1;padding:8px 12px;font-size:13px"><button onclick="removeSessionRow(${i})" style="padding:8px 10px;background:rgba(255,68,68,.1);border:1px solid rgba(255,68,68,.3);color:var(--red);border-radius:8px;font-size:12px;cursor:pointer">✕</button></div>`).join('');};window.renderSessionRowsConfig.__movePatched=true;}
  if(typeof renderSessionRowsConfig==='function')_patch();else document.addEventListener('DOMContentLoaded',_patch);
})();

// ── Patches duplication cellule ───────────────────────
(function(){
  if(window.__dupCyclePatchBound)return;window.__dupCyclePatchBound=true;
  const _origSame=window.openDuplicateCellSameCycle;
  window.openDuplicateCellSameCycle=function(){
    if(_themeCellTarget&&!cycleCellTarget){const t=_themeCellTarget;if(t.summary){showToast('⚠️ Duplication non disponible sur la ligne Résumé');return;}const key=`t${t.wk}-${t.ti}-${t.di}`;const chips=(cycleData.themeCells[key]||[]);if(!chips.length){showToast('⚠️ Cette case est vide');return;}const totalWeeks=parseInt(document.getElementById('cycle-weeks')?.value)||cycleData.weeks||8;const currentWeek=t.wk+1;const input=prompt(`Dupliquer ce bloc vers quelle(s) semaine(s) ? (1-${totalWeeks})\nEx: 2  ou  2,3,5  ou  2-4`,String(Math.min(currentWeek+1,totalWeeks)));if(!input)return;const targets=new Set();input.split(',').forEach(part=>{const p=part.trim();if(!p)return;const range=p.match(/^(\d+)\s*-\s*(\d+)$/);if(range){const a=parseInt(range[1]),b=parseInt(range[2]);for(let i=Math.min(a,b);i<=Math.max(a,b);i++)targets.add(i);}else{const n=parseInt(p);if(!isNaN(n))targets.add(n);}});let added=0;targets.forEach(wkOneBased=>{if(wkOneBased<1||wkOneBased>totalWeeks)return;if(wkOneBased===currentWeek)return;const targetW=wkOneBased-1;const newKey=`t${targetW}-${t.ti}-${t.di}`;const cloned=JSON.parse(JSON.stringify(chips)).map(c=>({...c,done:false}));cycleData.themeCells[newKey]=(cycleData.themeCells[newKey]||[]).concat(cloned);added++;});if(!added){showToast('⚠️ Aucune semaine valide');return;}closeCycleCellModal();renderCycleGridNew();scheduleAutoSaveCycle();showToast(`✅ Bloc dupliqué sur ${added} semaine${added>1?'s':''}`);return;}if(typeof _origSame==='function')_origSame.apply(this,arguments);};
  const _origToCycle=window.openDuplicateCellToCycle;
  window.openDuplicateCellToCycle=function(){if(_themeCellTarget&&!cycleCellTarget){const t=_themeCellTarget;if(t.summary){showToast('⚠️ Duplication non disponible sur la ligne Résumé');return;}const key=`t${t.wk}-${t.ti}-${t.di}`;const chips=(cycleData.themeCells[key]||[]);if(!chips.length){showToast('⚠️ Cette case est vide');return;}const others=(allCycles||[]).filter(c=>c.id!==cycleData.id);if(!others.length){showToast('⚠️ Aucun autre cycle disponible');return;}const sel=document.getElementById('dup-cycle-select');sel.innerHTML=others.map(c=>`<option value="${c.id}">${(c.name||'Sans nom').replace(/</g,'&lt;')}</option>`).join('');document.getElementById('dup-cycle-week').value=t.wk+1;window._dupThemeCellSource={key,chips:JSON.parse(JSON.stringify(chips)),ti:t.ti,di:t.di};document.getElementById('dup-cycle-modal').classList.add('open');return;}if(typeof _origToCycle==='function')_origToCycle.apply(this,arguments);};
  const _origConfirm=window.confirmDuplicateCellToCycle;
  window.confirmDuplicateCellToCycle=async function(){if(window._dupThemeCellSource){const src=window._dupThemeCellSource;const targetId=document.getElementById('dup-cycle-select').value;const targetWeek=Math.max(1,parseInt(document.getElementById('dup-cycle-week').value)||1)-1;if(!targetId){showToast('⚠️ Choisis un cycle');return;}const {data:tc,error}=await sb.from('cycle_plans').select('*').eq('id',targetId).single();if(error||!tc){showToast('⚠️ Cycle introuvable');return;}const themeCells=tc.theme_cells||{};const newKey=`t${targetWeek}-${src.ti}-${src.di}`;themeCells[newKey]=(themeCells[newKey]||[]).concat(src.chips.map(c=>({...c,done:false})));const {error:upErr}=await sb.from('cycle_plans').update({theme_cells:themeCells}).eq('id',targetId);if(upErr){showToast('❌ Erreur: '+upErr.message);return;}showToast('✅ Bloc dupliqué vers '+(tc.name||'cycle'));window._dupThemeCellSource=null;document.getElementById('dup-cycle-modal').classList.remove('open');closeCycleCellModal();return;}if(typeof _origConfirm==='function')_origConfirm.apply(this,arguments);};
})();

// ── Auto-save vidéos séance → bibliothèque ─────────────
async function autoSaveSessionVideos(videos){
  if(!videos||!videos.length)return;if(!currentUser)return;
  const studioId=getStudioId();
  let q=sb.from('movement_videos').select('youtube_url');
  if(studioId){q=q.eq('studio_id',studioId);}else{q=q.is('studio_id',null);}
  const {data:existing}=await q;const knownUrls=new Set((existing||[]).map(v=>(v.youtube_url||'').trim()));
  const toInsert=videos.filter(v=>{const url=(v.url||'').trim();return url&&!knownUrls.has(url);});if(!toInsert.length)return;
  const rows=toInsert.map(v=>({youtube_url:(v.url||'').trim(),title:(v.label||'').trim()||'Vidéo séance',movement_id:null,level:'all',created_by:currentUser.id,studio_id:studioId||null}));
  const {error}=await sb.from('movement_videos').insert(rows);
  if(error){console.warn('autoSaveSessionVideos',error.message);return;}
  if(typeof loadVideos==='function'){try{await loadVideos();}catch(e){}}
  const n=rows.length;showToast(`📚 ${n} vidéo${n>1?'s':''} ajoutée${n>1?'s':''} à la bibliothèque`);
}

(function(){
  const _orig=window.saveSession;if(typeof _orig!=='function')return;
  window.saveSession=async function(){const videos=(typeof getFormVideos==='function')?getFormVideos():[];await _orig.apply(this,arguments);if(videos.length)autoSaveSessionVideos(videos).catch(e=>console.warn('autoSave videos',e));};
})();
