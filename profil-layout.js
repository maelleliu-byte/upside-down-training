/* =========================================================================
   PROFIL — sections pliables (Performances, Badges) + mise en page ordi
   - « Performances » (PR / WODs / Benchmarks) et « Badges » sont repliés par
     défaut ; l'état ouvert / fermé est mémorisé par appareil.
   - En-tête de Performances : chiffres cliquables (PR → page PR, WODs →
     calendrier, Benchmarks → page PR), même section fermée.
   - Ordi / tablette (>= 900 px) : colonne gauche (profil, sections, menu) et
     suivi de charge à droite. Téléphone : ordre inchangé.
   ========================================================================= */
(function(){
  if(window.__profilLayoutBound)return;
  window.__profilLayoutBound=true;

  const CSS=`
  .pf-fold{margin:0 20px 16px;background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden}
  .pf-fold-head{width:100%;display:flex;align-items:center;gap:10px;padding:12px 14px;background:transparent;border:0;
    color:var(--text);font:inherit;cursor:pointer;text-align:left}
  .pf-fold-head .pf-ic{font-size:15px}
  .pf-fold-head .pf-t{font-size:13px;font-weight:700;flex:1}
  .pf-fold-head .pf-sum{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
  .pf-chip{font-size:11px;color:var(--muted);padding:3px 8px;border:1px solid var(--border);border-radius:20px;white-space:nowrap}
  .pf-chip b{color:var(--text);font-weight:700}
  .pf-chip[data-go]{cursor:pointer}
  .pf-chip[data-go]:hover{border-color:var(--accent);color:var(--accent)}
  .pf-chip[data-go]:hover b{color:var(--accent)}
  .pf-fold-head .pf-chev{color:var(--muted);font-size:16px;transition:transform .2s;display:inline-block}
  .pf-fold.open .pf-chev{transform:rotate(90deg)}
  .pf-fold-body{display:none;padding:0 14px 14px}
  .pf-fold.open .pf-fold-body{display:block}
  .pf-fold .profil-stats{margin:0}
  #pf-fold-badges #profil-badges-section{margin:0!important;padding:0!important;border:0!important;background:transparent!important}
  #pf-fold-perf .stat-box[data-go]{cursor:pointer;position:relative}
  #pf-fold-perf .stat-box[data-go]:hover{background:var(--card2)}
  #pf-fold-perf .stat-box[data-go]::after{content:'›';position:absolute;top:6px;right:8px;font-size:12px;color:var(--muted)}
  @media (max-width:420px){.pf-fold-head .pf-sum{flex-wrap:nowrap;gap:4px}.pf-chip{font-size:10px;padding:2px 6px}.pf-fold-head{gap:8px}}
  @media (min-width:900px){
    #page-profil.active{display:grid!important;grid-template-columns:minmax(320px,380px) minmax(0,1fr);
      grid-template-rows:auto auto auto 1fr;column-gap:24px;align-content:start;
      padding-left:max(20px,calc((100vw - 1320px)/2));padding-right:max(20px,calc((100vw - 1320px)/2))}
    #page-profil.active>.topbar{grid-column:1/-1;grid-row:1;margin-left:0;margin-right:0;padding-left:0;padding-right:0}
    #page-profil.active>#pf-top{grid-column:1;grid-row:2;min-width:0}
    #page-profil.active>#pf-bottom{grid-column:1;grid-row:3;min-width:0}
    #page-profil.active>#charge-section{grid-column:2;grid-row:2/5;margin:0 0 16px;min-width:0}
    #page-profil.active>#charge-section .chg-card{max-width:none}
    #pf-top>*{margin-left:0!important;margin-right:0!important}
    #pf-top>.profil-header{padding-left:0;padding-right:0}
    #pf-bottom{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;padding-bottom:12px}
    #pf-bottom>.btn-logout{margin-left:14px;margin-right:14px;width:calc(100% - 28px)}
  }`;

  const store={
    get(k){try{return localStorage.getItem('pf-fold-'+k)==='1';}catch(e){return false;}},
    set(k,v){try{localStorage.setItem('pf-fold-'+k,v?'1':'0');}catch(e){}}
  };

  function makeFold(id,icon,title){
    const f=document.createElement('div');
    f.className='pf-fold'+(store.get(id)?' open':'');
    f.id='pf-fold-'+id;
    f.innerHTML=`<button type="button" class="pf-fold-head" aria-expanded="${store.get(id)}">
        <span class="pf-ic">${icon}</span><span class="pf-t">${title}</span><span class="pf-sum"></span><span class="pf-chev">›</span></button>
      <div class="pf-fold-body"></div>`;
    f.querySelector('.pf-fold-head').addEventListener('click',e=>{
      const go=e.target.closest('[data-go]');
      if(go){e.stopPropagation();goTo(go.dataset.go);return;}
      const open=!f.classList.contains('open');
      f.classList.toggle('open',open);
      f.querySelector('.pf-fold-head').setAttribute('aria-expanded',open);
      store.set(id,open);
    });
    return f;
  }

  function goTo(where){
    if(where==='wod'&&typeof openWodCalendar==='function'){openWodCalendar();return;}
    if(typeof goPage==='function')goPage('pr');
  }

  const txt=id=>{const e=document.getElementById(id);const t=e?e.textContent.trim():'';return t&&t!=='—'?t:'–';};
  function updatePerfSummary(){
    const sum=document.querySelector('#pf-fold-perf .pf-sum');if(!sum)return;
    const h=`<span class="pf-chip" data-go="pr"><b>${txt('stat-pr')}</b> PR</span>`
      +`<span class="pf-chip" data-go="wod"><b>${txt('stat-wod')}</b> WODs</span>`
      +`<span class="pf-chip" data-go="bench"><b>${txt('stat-bench')}</b> Bench.</span>`;
    if(sum.innerHTML!==h)sum.innerHTML=h;
  }
  function updateBadgeSummary(){
    const sum=document.querySelector('#pf-fold-badges .pf-sum');
    const sec=document.getElementById('profil-badges-section');
    if(!sum||!sec)return;
    const m=(sec.textContent||'').match(/(\d+)\s*\/\s*(\d+)/);
    const h=m?`<span class="pf-chip"><b>${m[1]}</b> / ${m[2]}</span>`:'';
    if(sum.innerHTML!==h)sum.innerHTML=h;
  }

  function ensure(){
    const page=document.getElementById('page-profil');if(!page)return;
    // 1) colonnes : haut (profil + sections) / bas (menu)
    let top=document.getElementById('pf-top'),bottom=document.getElementById('pf-bottom');
    const charge=document.getElementById('charge-section');
    if(!top&&charge){
      top=document.createElement('div');top.id='pf-top';
      bottom=document.createElement('div');bottom.id='pf-bottom';
      const kids=[...page.children];
      const ci=kids.indexOf(charge);
      kids.forEach((k,i)=>{
        if(k.classList.contains('topbar')||k===charge)return;
        (i<ci?top:bottom).appendChild(k);
      });
      const tb=page.querySelector(':scope>.topbar');
      if(tb)tb.insertAdjacentElement('afterend',top);else page.prepend(top);
      charge.insertAdjacentElement('afterend',bottom);
    }
    // éléments ajoutés plus tard directement dans la page → dans le bon bloc
    if(top&&bottom&&charge){
      [...page.children].forEach(k=>{
        if(k===top||k===bottom||k===charge||k.classList.contains('topbar'))return;
        const pos=k.compareDocumentPosition(charge);
        (pos&Node.DOCUMENT_POSITION_FOLLOWING?top:bottom).appendChild(k);
      });
    }
    // 2) Performances
    const stats=page.querySelector('.profil-stats');
    if(stats&&!stats.closest('#pf-fold-perf')){
      const f=document.getElementById('pf-fold-perf')||makeFold('perf','🏆','Performances');
      if(!f.parentNode)stats.insertAdjacentElement('beforebegin',f);
      f.querySelector('.pf-fold-body').appendChild(stats);
      const pr=document.getElementById('stat-pr'),bench=document.getElementById('stat-bench');
      [[pr,'pr'],[bench,'bench']].forEach(([el,go])=>{
        const box=el&&el.closest('.stat-box');
        if(box&&!box.dataset.go){box.dataset.go=go;box.addEventListener('click',()=>goTo(go));}
      });
    }
    // 3) Badges
    const badges=document.getElementById('profil-badges-section');
    if(badges&&!badges.closest('#pf-fold-badges')){
      const f=document.getElementById('pf-fold-badges')||makeFold('badges','🏅','Badges');
      const perf=document.getElementById('pf-fold-perf');
      if(!f.parentNode){if(perf)perf.insertAdjacentElement('afterend',f);else badges.insertAdjacentElement('beforebegin',f);}
      f.querySelector('.pf-fold-body').appendChild(badges);
    }
    updatePerfSummary();updateBadgeSummary();
  }

  let pending=false;
  function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;ensure();});}

  function init(){
    if(!document.getElementById('pf-layout-css')){
      const st=document.createElement('style');st.id='pf-layout-css';st.textContent=CSS;document.head.appendChild(st);
    }
    ensure();
    const page=document.getElementById('page-profil');
    if(page)new MutationObserver(schedule).observe(page,{childList:true,subtree:true,characterData:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
