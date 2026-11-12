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
    ['CAP','Course à pied'],['ERG','Ergo'],['BIKE','Vélo'],['SWI','Natation'],['COMP','Compétition']
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
  // une couleur distincte par modalité (graphiques empilés lisibles)
  const MODC={STR:'var(--red)',CF:'var(--accent)',WL:'var(--purple)',GYM:'#8C7CFF',
    BODY:'var(--orange)',CAP:'#F2C94C',ERG:'var(--blue)',BIKE:'var(--green)',
    SWI:'#FF7EB6',COMP:'#B8B8B8'};
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
  const isCoachUser=()=>(typeof currentProfile!=='undefined'&&currentProfile&&currentProfile.role==='admin');
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
  @media (min-width:900px){
    .chg-card{max-width:1180px;margin:0 auto}
    .chg-kpis{grid-template-columns:repeat(4,1fr)}
    div.chg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px;align-items:start}
    div.chg-col{display:flex;flex-direction:column;gap:14px;min-width:0}
    .chg-full.chg-full.chg-full{margin-top:14px}
    div.chg-wcards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
    div.chg-wprev{display:block}
    div.chg-wcol+div.chg-wcol{border-left:1px solid var(--border);padding-left:14px}
    div.chg-coach{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px;align-items:start}
    .chg-panel.chg-panel.chg-panel{padding:12px 14px 14px;border:1px solid var(--border);border-radius:14px;background:var(--card2,transparent);margin-top:0}
    .chg-panel.chg-panel.chg-panel.chg-pcoach{border-left:4px solid var(--accent)}
    .chg-panel.chg-panel.chg-panel .chg-sec{margin-top:0}
    .chg-panel-tbl .chg-tbl{margin-top:0}
  }
  .chg-rest{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
  .chg-rest div{padding:8px;border:1px solid var(--border);border-radius:10px;text-align:center}
  .chg-rest b{display:block;font-size:17px;color:var(--text)}
  .chg-rest span{font-size:10px;color:var(--muted)}
  .chg-fiche-card{margin-top:10px}
  .chg-wnav{margin-left:auto;display:flex;align-items:center;gap:8px}
  .chg-wnav b{font-size:12px;color:var(--text);min-width:52px;text-align:center}
  .chg-wnav button{width:28px;height:28px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text);font-size:16px;cursor:pointer;line-height:1}
  .chg-wnav button:disabled{opacity:.3;cursor:default}
  .chg-wcards{display:block}
  .chg-wprev{display:none}
  .chg-wch{display:flex;align-items:baseline;gap:8px;margin-bottom:8px}
  .chg-wch b{font-size:13px;color:var(--text)}
  .chg-wch span{font-size:10px;color:var(--muted)}
  .chg-wch em{margin-left:auto;font-style:normal;font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--accent);border:1px solid var(--accent);border-radius:20px;padding:2px 7px}
  .chg-wk6{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
  .chg-wk6 div{padding:7px 4px;border:1px solid var(--border);border-radius:8px;text-align:center}
  .chg-wk6 b{display:block;font-size:15px;color:var(--text)}
  .chg-wk6 span{font-size:9px;color:var(--muted)}
  .chg-wz{height:12px;margin-top:2px}
  .chg-year{margin-top:4px}
  .chg-ychart{overflow-x:auto}
  .chg-ychart .chg-year{min-width:700px}
  .chg-ychart .chg-leg{position:sticky;left:0}
  .chg-yscroll{overflow-x:auto;margin-top:12px;border:1px solid var(--border);border-radius:8px}
  .chg-ytbl{border-collapse:collapse;font-size:10px;white-space:nowrap}
  .chg-ytbl th,.chg-ytbl td{padding:5px 7px;border-bottom:1px solid var(--border);text-align:right;color:var(--text)}
  .chg-ytbl th{position:sticky;left:0;z-index:1;background:var(--card);text-align:left;font-weight:600;color:var(--muted)}
  .chg-ytbl th i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;vertical-align:0}
  .chg-ytbl thead td{color:var(--text);text-align:center}
  .chg-ytbl thead td small{display:block;font-size:8px;color:var(--muted);font-weight:400}
  .chg-ytbl td.cur{background:var(--card2);box-shadow:inset 0 0 0 1px var(--accent)}
  .chg-ytbl td.fut{opacity:.35}
  .chg-ytbl tr.sep th,.chg-ytbl tr.sep td{border-top:2px solid var(--border2,var(--border))}
  .chg-grid{display:flex;flex-direction:column}
  /* chaque partie dans sa carte (même logique que le classement) */
  .chg-panel.chg-panel{background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:12px 12px 14px;margin-top:12px}
  .chg-panel.chg-panel .chg-sec{margin-top:0;padding-bottom:8px;margin-bottom:10px;border-bottom:1px dashed var(--border2)}
  .chg-panel.chg-pcoach{border-left:4px solid var(--accent)}
  .chg-col{display:contents}
  .chg-sec .chg-strong{font-size:11px;font-weight:800;color:var(--text)}
  .chg-sec .chg-paren{font-size:11px;color:var(--text)}
  .chg-thin{font-weight:300}
  .chg-sec .chg-paren .chg-thin{color:var(--muted);font-size:11px}
  .chg-mhead .chg-mp.chg-hc{font-weight:800;color:var(--text)}
  .chg-mhead .chg-mp.chg-ht{font-weight:300}
  .chg-lc{font-weight:800;color:var(--text)}
  .chg-mbars{flex:1;display:flex;flex-direction:column;gap:3px}
  .chg-mbars .chg-mtr{flex:none}
  .chg-mtr-t{height:5px!important;opacity:.5}
  .chg-mhead{margin-bottom:4px}
  .chg-mhead .chg-mtr0{flex:1}
  .chg-mhead .chg-mp{font-size:9px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
  .chg-mt{color:var(--muted)!important}
  .chg-mleg{display:flex;gap:14px;font-size:10px;color:var(--muted);margin-top:2px}
  .chg-mleg i{display:inline-block;width:12px;height:6px;border-radius:3px;background:var(--text2,var(--text));margin-right:5px;vertical-align:1px}
  .chg-mleg i.t{height:4px;opacity:.5}
  .chg-coach{display:flex;flex-direction:column}
  .chg-verdict{display:flex;gap:8px;align-items:flex-start;padding:9px 10px;border:1px solid;border-radius:8px;font-size:12px;font-weight:600;color:var(--text);line-height:1.4}
  .chg-verdict i{flex:none;width:8px;height:8px;border-radius:50%;margin-top:4px}
  .chg-res3{grid-template-columns:repeat(3,1fr)}
  .chg-res3 small{font-size:11px;color:var(--muted);font-weight:500}
  .chg-owk{padding:10px 0 4px;border-top:1px dashed var(--border)}
  .chg-sec+.chg-owk{border-top:0;padding-top:2px}
  .chg-owh{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
  .chg-owh b{font-size:12px;color:var(--text)}
  .chg-owh span{font-size:10px;color:var(--muted)}
  .chg-owh em{margin-left:auto;font-style:normal;font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border:1px solid var(--border);border-radius:20px;padding:2px 7px}
  .chg-onext .chg-owh em{color:var(--accent);border-color:var(--accent)}
  .chg-onow{display:flex;justify-content:space-between;margin-top:8px}
  .chg-onow span{display:block;font-size:10px;color:var(--muted)}
  .chg-onow b{font-size:16px;color:var(--text)}
  .chg-onow .r{text-align:right}.chg-onow .r b{font-size:13px;color:var(--muted)}
  .chg-oprog{height:6px;border-radius:3px;background:var(--card2);margin-top:6px;overflow:hidden}
  .chg-oprog i{display:block;height:100%;background:var(--accent);opacity:.7;border-radius:3px}
  .chg-onote{font-size:11px;color:var(--muted);line-height:1.45;margin:4px 0 6px}
  .chg-orow{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}
  .chg-orow .k{flex:0 0 62px;font-size:11px;font-weight:700;color:var(--text)}
  .chg-orow .v{margin-left:auto;font-size:16px;color:var(--accent)}
  .chg-orow .t{flex:1;font-size:11px;color:var(--text2,var(--muted));line-height:1.45}
  .chg-otop{align-items:flex-start}
  .chg-obadge{font-size:11px;font-weight:700;padding:3px 9px;border:1px solid;border-radius:20px;white-space:nowrap}
  .chg-otgt{display:flex;justify-content:space-between;gap:10px;padding:10px;border:1px solid var(--border);border-radius:10px}
  .chg-otgt span{display:block;font-size:10px;color:var(--muted)}
  .chg-otgt b{font-size:17px;color:var(--accent)}
  .chg-otgt .r{text-align:right}
  .chg-otgt .r b{font-size:14px;color:var(--text)}
  .chg-otxt{font-size:12px;font-weight:600;color:var(--text);margin:10px 0 6px;line-height:1.4}
  .chg-otip{display:flex;gap:8px;font-size:11px;line-height:1.45;padding:6px 0;border-top:1px solid var(--border)}
  .chg-otip b{flex:0 0 62px;color:var(--text);font-weight:700}
  .chg-otip span{color:var(--text2,var(--muted))}
  .chg-rrow{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .chg-rtrack{flex:1;height:12px;border-radius:4px;background:var(--card2);overflow:hidden}
  .chg-rbar{display:flex;height:100%;border-radius:4px;overflow:hidden}
  .chg-rbar i{display:block;height:100%}
  .chg-rtot .chg-rtrack{height:16px}
  .chg-rtot{margin-bottom:14px}
  .chg-sub{font-size:11px;font-weight:700;color:var(--text);margin:12px 0 6px}
  .chg-sub span{font-size:10px;font-weight:400;color:var(--muted);margin-left:6px}
  .chg-dist{margin-bottom:4px}
  .chg-rleg b{color:var(--text);font-weight:700}
  .chg-rleg small{color:var(--muted);opacity:.8}
  .chg-rpet th small{display:block;font-size:8px;font-weight:400;text-transform:none}
  .chg-rpet td small{display:block;font-size:9px;color:var(--muted)}
  .chg-rpet .z{color:var(--muted)}
  .chg-rpet tr.tot td{border-top:1px solid var(--border2,var(--border))}
  .chg-rpet tr.pct td{color:var(--muted);font-size:10px}
  .chg-rpeseg button[aria-pressed="true"]{border-color:var(--accent);color:var(--accent)}
  .chg-seg{display:flex;gap:6px;margin-bottom:10px}
  .chg-seg button{flex:1;padding:8px;border-radius:8px;border:1px solid var(--border);background:transparent;
    color:var(--muted);font-size:12px;cursor:pointer}
  .chg-seg button[aria-pressed="true"]{border-color:${TEAL};color:${TEAL};font-weight:700}
  .chg-wrap.chg-free{margin:0 0 8px;padding:12px 14px;background:var(--card);
    border:1px solid var(--border);border-radius:12px}
  .chg-addfree{width:100%;margin-bottom:16px;padding:11px;border-radius:10px;border:1px dashed var(--border);
    background:transparent;color:var(--muted);font-size:13px;cursor:pointer}
  .chg-inline{margin-top:10px;border:1px solid var(--border2);border-radius:10px;overflow:hidden}
  .chg-inline .chg-lbl:first-child{margin-top:0}
  .chg-isec{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0 0 8px;font-weight:700}
  .chg-time{display:flex;gap:10px;align-items:flex-start;margin-top:10px}
  .chg-time .f{flex:1}
  .chg-time input{width:100%;background:var(--card2,transparent);border:1px solid ${TEAL};color:var(--text);
    padding:10px;border-radius:8px;font-size:15px}
  .chg-thint{font-size:10px;color:var(--muted);margin-top:4px;line-height:1.4}
  .chg-itog{width:100%;display:flex;align-items:center;gap:8px;background:var(--card2);border:0;padding:11px 12px;cursor:pointer;
    color:var(--text);font-family:inherit;font-size:13px;font-weight:700}
  .chg-ival{margin-left:auto;font-size:11px;font-weight:600;color:${TEAL}}
  .chg-ival.off{color:var(--muted)}
  .vbx-toggle,.efx-toggle{gap:8px}
  .vbx-toggle::after,.efx-toggle::after{content:"▾";color:var(--muted);font-size:14px;margin-left:6px;display:inline-block;transition:transform .2s}
  .vbx-toggle.chg-closed::after,.efx-toggle.chg-closed::after{transform:rotate(-90deg)}
  .chg-arw{color:var(--muted);font-size:14px;transition:transform .2s;display:inline-block}
  .chg-itog[aria-expanded="false"] .chg-arw{transform:rotate(-90deg)}
  .chg-ibody{padding:10px 12px 12px}
  .chg-pill{font-size:10px;font-weight:700;padding:3px 8px;border-radius:999px;white-space:nowrap;margin-left:auto;margin-right:8px}
  .chg-pill.ok{background:color-mix(in srgb,var(--green) 14%,transparent);color:var(--green)}
  .chg-pill.todo{background:color-mix(in srgb,var(--orange) 14%,transparent);color:var(--orange)}
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

  /* ---------- Score + charge dans un seul geste (« Valider le bloc ») ----------
     Sur les séances programmées de l'espace perso, la charge n'est plus un volet
     séparé : modalité, temps de séance et RPE se saisissent dans « Mon score »,
     et un seul bouton enregistre le score ET la charge. Le RPE n'est demandé
     qu'une fois. Les séances libres gardent l'ancien volet. */
  const TIME_HINT={
    strength:'1re série → dernière rep, repos compris',weightlifting:'1re série → dernière rep, repos compris',
    gymnastics:'1re série → dernière rep, repos compris',skill:'1re série → dernière rep, repos compris',
    wod:'temps du WOD + récup entre les blocs',engine:'temps total : warm-up + séance + récup',
    run:'temps total : warm-up + séance + récup',bodybuilding:'temps total du bloc',renforcement:'temps total du bloc',
    warmup:'temps total du bloc',mobility:'temps total du bloc'
  };
  const mmss=(m,s)=>(+m||0)+(+s||0)/60;
  /* Repère « prévu par le format », à titre indicatif seulement */
  function estimateMinutes(txt){
    const t=String(txt||'').toUpperCase().replace(/ /g,' ');
    let tot=0,m;
    const used=[];
    const take=(re,fn)=>{re.lastIndex=0;while((m=re.exec(t))){if(used.some(([a,b])=>m.index<b&&m.index+m[0].length>a))continue;used.push([m.index,m.index+m[0].length]);tot+=fn(m);}};
    take(/(\d+)\s*SETS?\s+EVERY\s+(\d+):(\d{2})/g,m=>m[1]*mmss(m[2],m[3]));
    take(/(\d+)\s*SETS?\s+REST\s+(\d+):(\d{2})/g,m=>m[1]*(mmss(m[2],m[3])+1)-mmss(m[2],m[3]));
    take(/(\d+)\s*(?:X|SETS?)\s*(\d+):(\d{2})[^\n]*?REST\s+(\d+):(\d{2})/g,m=>m[1]*(mmss(m[2],m[3])+mmss(m[4],m[5]))-mmss(m[4],m[5]));
    const onDur=new Set();
    take(/(\d+)\s*SETS?\s+(\d+):(\d{2})\s*ON\s*\/?\s*(?:REST\s*)?(\d+):(\d{2})/g,m=>{onDur.add(m[2]+':'+m[3]);return m[1]*(mmss(m[2],m[3])+mmss(m[4],m[5]))-mmss(m[4],m[5]);});
    take(/\b(?:EMOM|AMRAP|CAP|E\dMOM)\s*(\d+):(\d{2})/g,m=>onDur.has(m[1]+':'+m[2])?0:mmss(m[1],m[2]));
    take(/(?:^|\n)\s*(\d+):(\d{2})\s*(?:\n|$)/g,m=>mmss(m[1],m[2]));
    take(/(?:^|\n)\s*~?\s*(\d+):(\d{2})\s+(?:BIKE|ROW|SKI|RUN|EASY|FACILE|PROGRESSIF)/g,m=>mmss(m[1],m[2]));
    return tot>0?Math.round(tot):0;
  }
  /* Modalité par défaut : type de bloc, avec le vélo séparé de l'ergo sur l'engine */
  function defaultMod(s,txt){
    const[def]=TYPEMAP[s.type]||['CF',true];
    if(s.type==='engine'){
      const t=String(txt||'').toUpperCase();
      if(/\bBIKE/.test(t)&&!/\b(ROW|SKI|RUN|RAMEUR)\b/.test(t))return'BIKE';
    }
    return def;
  }
  function inlineHTML(s,saved,est,mod){
    const counts=saved?saved.counts:(TYPEMAP[s.type]||['CF',true])[1];
    const rpe=saved?saved.rpe:0;
    const min=saved?saved.minutes:'';
    const ua=counts&&rpe&&min?rpe*min:0;
    const head=saved?(counts?`${fmt(ua)} UA`:'hors charge'):'à renseigner';
    return`<div class="chg-inline" data-chg="${s.id}">
      <button type="button" class="chg-itog" data-itog aria-expanded="false">
        <span>⚡ Ma charge</span>
        <span class="chg-ival${saved?'':' off'}" data-ival>${saved?head+' ✓':'Ajouter'}</span><span class="chg-arw">▾</span></button>
      <div class="chg-ibody" hidden>
      <div class="chg-lbl">Modalité · pré-réglée, modifiable</div>
      <div class="chg-mods">${MODS.map(([k,l])=>`<button type="button" class="chg-mod" data-mod="${k}" aria-pressed="${mod===k}">${l}</button>`).join('')}</div>
      <div class="chg-time">
        <div class="f"><div class="chg-lbl" style="margin-top:0">Mon temps de séance (min)</div>
          <input type="number" inputmode="numeric" min="1" max="600" data-min value="${min}" placeholder="${est||''}">
          <div class="chg-thint">${TIME_HINT[s.type]||'temps total du bloc'}${est?` · prévu par le format : ~${est} min`:''}</div></div>
        <div class="chg-ua"><b data-ua>${fmt(ua)}</b><span>RPE × min = UA</span></div>
      </div>
      <div class="chg-lbl">RPE du bloc</div>
      <div class="chg-rpe">${[1,2,3,4,5,6,7,8,9,10].map(n=>
        `<button type="button" data-rpe="${n}" ${n===rpe?`style="background:${RPEC[n-1]};border-color:${RPEC[n-1]};color:#fff"`:''}>${n}</button>`).join('')}</div>
      <div class="chg-rpeh"><span>Très facile</span><span>Modéré</span><span>Maximal</span></div>
      <label class="chg-count"><input type="checkbox" data-counts ${counts?'checked':''}>
        <span>Compte dans la charge${(TYPEMAP[s.type]||['CF',true])[1]?'':' (échauffement / mobilité : décoché par défaut)'}</span></label>
      </div>
    </div>`;
  }
  const SCORE_OPTIONAL=new Set(['warmup','mobility']);
  function pillState(s,hasScore,hasCharge){
    if(hasScore&&hasCharge)return['ok','Validé'];
    if(SCORE_OPTIONAL.has(s.type)&&(hasScore||hasCharge))return['ok','Validé'];
    if(hasScore)return['todo','Charge manquante'];
    if(hasCharge)return['todo','Score manquant'];
    return['todo','À valider'];
  }
  /* Charge affichée sur le bandeau « ✓ Score rentré » replié */
  const bandUA={};
  function paintBand(sid){
    const sum=document.querySelector('#ms-'+CSS.escape(sid)+'.ms-done .ms-sum');
    if(!sum)return;
    let el=sum.querySelector('.ms-ua');
    const t=bandUA[sid];
    if(!t){if(el)el.remove();return;}
    if(!el){el=document.createElement('span');el.className='ms-ua';
      el.style.cssText='flex:none;font-size:12px;font-weight:700;color:var(--accent);white-space:nowrap';
      const chev=sum.querySelector('.ms-chev');sum.insertBefore(el,chev);}
    el.textContent=t;
  }
  window.chgPaintBand=paintBand;
  function setPill(card,s,hasScore,hasCharge){
    const head=card.querySelector('.session-header');if(!head)return;
    let p=head.querySelector('.chg-pill');
    if(!p){p=document.createElement('span');p.className='chg-pill';
      const date=head.lastElementChild;head.insertBefore(p,date);}
    const[c,l]=pillState(s,hasScore,hasCharge);
    p.className='chg-pill '+c;p.textContent=l;
  }
  /* Le score a-t-il été rempli dans le formulaire ? */
  function scoreFilled(zone,sid){
    const els=[...zone.querySelectorAll('input,textarea')].filter(el=>
      el.id&&el.id.includes(sid)&&!/^done-at-/.test(el.id)&&!el.closest('.chg-inline')&&!el.closest('.vbx')&&el.type!=='hidden');
    return els.some(el=>el.type==='checkbox'?el.checked:String(el.value||el.innerText||'').trim()!=='');
  }
  async function scoreExists(sid){
    const ids=typeof _lbSessionIds==='function'?await _lbSessionIds(sid):[sid];
    const{data}=await sb.from('wod_scores').select('id').in('session_id',ids).eq('athlete_id',uid()).limit(1);
    return!!(data&&data.length);
  }
  function wireInline(card,s,saved,hasScore){
    const wrap=card.querySelector(`.chg-inline[data-chg="${s.id}"]`);
    const btn=card.querySelector('.btn-score');
    if(!wrap||!btn)return;
    const zone=btn.parentElement;
    const st={id:saved?saved.id:null,
      mod:wrap.querySelector('[data-mod][aria-pressed="true"]')?.dataset.mod||'CF',
      rpe:saved?saved.rpe:0,min:saved?saved.minutes:0,
      counts:saved?saved.counts:(TYPEMAP[s.type]||['CF',true])[1]};
    const state={score:hasScore,charge:!!saved};
    if(saved)bandUA[s.id]=saved.counts?`· ${fmt((saved.rpe||0)*(saved.minutes||0))} UA`:'· hors charge';
    paintBand(s.id);
    const uaEl=wrap.querySelector('[data-ua]');
    const recalc=()=>{uaEl.textContent=fmt(st.counts&&st.rpe&&st.min?st.rpe*st.min:0);};
    const tog=wrap.querySelector('[data-itog]'),ib=wrap.querySelector('.chg-ibody'),iv=wrap.querySelector('[data-ival]');
    const setOpen=o=>{tog.setAttribute('aria-expanded',String(o));ib.hidden=!o;};
    tog.addEventListener('click',()=>setOpen(ib.hidden));
    // Séance VBT : les vitesses font le score, pas besoin de remplir « Mon score » à côté
    const isVbt=()=>!!zone.querySelector('.vbx');
    const isEf=()=>!!zone.querySelector('.efx');
    const hideClassic=()=>{
      if(!isVbt()&&!isEf())return;
      [...zone.children].forEach(el=>{
        if(el===btn||el===wrap||el.classList.contains('vbx')||el.classList.contains('efx')||el.classList.contains('score-title')||el.classList.contains('score-done-at-row'))return;
        el.style.display='none';
      });
      zone.querySelectorAll('[data-vbx-save],[data-efx-save]').forEach(b=>b.style.display='none');
    };
    // flèche d'état sur les onglets Vitesses / FC (fermés par défaut)
    const syncArrows=()=>zone.querySelectorAll('.vbx-toggle,.efx-toggle').forEach(t=>{
      const b=t.nextElementSibling;t.classList.toggle('chg-closed',!b||b.style.display==='none');});
    zone.addEventListener('click',e=>{if(e.target.closest('.vbx-toggle,.efx-toggle'))setTimeout(syncArrows,0);});
    wrap.querySelectorAll('[data-mod]').forEach(b=>b.addEventListener('click',()=>{
      st.mod=b.dataset.mod;
      wrap.querySelectorAll('[data-mod]').forEach(x=>x.setAttribute('aria-pressed',x===b));
    }));
    wrap.querySelectorAll('[data-rpe]').forEach(b=>b.addEventListener('click',()=>{
      st.rpe=+b.dataset.rpe;
      wrap.querySelectorAll('[data-rpe]').forEach(x=>x.removeAttribute('style'));
      b.style.background=RPEC[st.rpe-1];b.style.borderColor=RPEC[st.rpe-1];b.style.color='#fff';
      recalc();
    }));
    wrap.querySelector('[data-min]').addEventListener('input',e=>{st.min=parseInt(e.target.value,10)||0;recalc();});
    wrap.querySelector('[data-counts]').addEventListener('change',e=>{st.counts=e.target.checked;recalc();});

    // Un seul bouton : score + charge
    const submitCall=btn.getAttribute('onclick')||'';
    btn.removeAttribute('onclick');
    btn.textContent='✓ Valider le bloc';
    setPill(card,s,state.score,state.charge);
    btn.addEventListener('click',async()=>{
      const toast=m=>{if(typeof showToast==='function')showToast(m);};
      const vbt=isVbt()&&typeof window.vbxSave==='function';
      const ef=!vbt&&isEf()&&typeof window.efxSave==='function';
      const wantScore=vbt?(typeof window.vbxHasData==='function'&&window.vbxHasData(s.id))
        :ef?(typeof window.efxHasData==='function'&&window.efxHasData(s.id))
        :scoreFilled(zone,s.id);
      const wantCharge=!!(st.rpe&&st.min);
      if(st.min&&!st.rpe){toast('⚠️ Choisis ton RPE');return;}
      if(st.rpe&&!st.min){toast('⚠️ Entre ton temps de séance');return;}
      if(!wantScore&&!wantCharge){toast('⚠️ Entre ton score, ou ton temps de séance + RPE');return;}
      btn.disabled=true;const lbl=btn.textContent;btn.textContent='Enregistrement…';
      let scoreOk=false,chargeOk=false;
      try{
        if(wantScore&&(vbt||ef)){
          await (vbt?window.vbxSave(s.id):window.efxSave(s.id));
          scoreOk=await scoreExists(s.id);
          if(scoreOk)state.score=true;
        }else if(wantScore&&submitCall){
          await new Function('return '+submitCall)();
          scoreOk=await scoreExists(s.id);
          if(scoreOk)state.score=true;
        }
        if(wantCharge){
          const row={athlete_id:uid(),date:dayKey(),modality:st.mod,rpe:st.rpe,minutes:st.min,
            counts:st.counts,label:s.title||null,personal_session_id:s.id};
          st.id=await saveBlock(row,st.id);chargeOk=true;state.charge=true;
          iv.className='chg-ival'+(st.counts?'':' off');
          iv.textContent=(st.counts?`${fmt(st.rpe*st.min)} UA`:'hors charge')+' ✓';
          bandUA[s.id]=st.counts?`· ${fmt(st.rpe*st.min)} UA`:'· hors charge';
          setOpen(false);
          refreshDayTotal();
        }
      }catch(err){console.error('[charge] valider bloc',err);toast('❌ Erreur à l\'enregistrement, réessaie');}
      btn.disabled=false;btn.textContent=lbl;
      setPill(card,s,state.score,state.charge);
      paintBand(s.id);
      if(wantScore&&!scoreOk)return; // submitScore a déjà affiché son message
      const opt=SCORE_OPTIONAL.has(s.type);
      if(state.score&&state.charge)toast('✅ Bloc validé : score + charge');
      else if(state.score)toast('✅ Score enregistré · ajoute ton temps de séance + RPE');
      else if(state.charge)toast(opt?'✅ Bloc validé':'✅ Charge enregistrée · il manque ton score');
    });
    // le bouton reste en bas du formulaire, même si un module (VBT, EF) s'ajoute après
    // Zone de validation (charge + date + bouton) toujours SOUS les scores,
    // y compris quand Vitesses / FC s'ajoutent après coup.
    const doneRow=zone.querySelector('.score-done-at-row');
    const order=()=>[...zone.querySelectorAll(':scope > .vbx, :scope > .efx'),wrap,doneRow,btn].filter(Boolean);
    let arranging=false;
    const arrange=()=>{
      if(arranging||btn.parentElement!==zone)return;
      const want=order(),kids=[...zone.children],tail=kids.slice(kids.length-want.length);
      if(want.every((el,i)=>tail[i]===el))return;
      arranging=true;want.forEach(el=>zone.appendChild(el));arranging=false;
    };
    const fix=()=>{arrange();hideClassic();syncArrows();};
    fix();
    new MutationObserver(()=>{if(!arranging)fix();}).observe(zone,{childList:true});
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

    const todo=cards.filter(c=>!c.dataset.chgBound&&/^sc-/.test(c.id||''));
    const ids=todo.map(c=>c.id.replace(/^sc-/,''));
    let scored=new Set();
    if(ids.length){
      const{data:sc}=await sb.from('wod_scores').select('session_id').eq('athlete_id',uid()).in('session_id',ids);
      scored=new Set((sc||[]).map(r=>r.session_id));
    }
    for(const card of todo){
      const sid=card.id.replace(/^sc-/,'');
      card.dataset.chgBound='1';
      const type=(card.querySelector('.badge')?.className||'').match(/badge-([a-z]+)/)?.[1]||'wod';
      const s={id:sid,type,title:card.querySelector('.session-title')?.textContent||null};
      const saved=byId[sid]||null;
      const body=card.querySelector('.session-body');if(!body)continue;
      const btn=body.querySelector('.btn-score');
      if(btn){
        const txt=card.querySelector('.session-content')?.innerText||'';
        const mod=saved?saved.modality:defaultMod(s,txt);
        btn.insertAdjacentHTML('beforebegin',inlineHTML(s,saved,estimateMinutes(txt),mod));
        wireInline(card,s,saved,scored.has(sid)||!!card.querySelector('.ms-fold.ms-done'));
        continue;
      }
      // pas de formulaire de score : on garde le volet charge seul
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
        <span><i style="background:${TEAL}"></i>Chronique 28 j</span></div>
      ${restHTML(s)}`;
  }
  /* Jours de repos sur la période du graphique : uniquement les jours marqués OFF par l'athlète,
     rapportés aux jours suivis (charge saisie ou OFF). */
  function restHTML(s){
    // Seuls les jours renseignés comptent (charge saisie ou OFF) : un début de suivi ou des trous
    // de saisie ne faussent pas le ratio.
    const days=s.filter(p=>p.load>0||p.off);
    if(!days.length)return'';
    const rest=days.filter(p=>p.off).length;
    const perWk=rest/days.length*7;
    return`<div class="chg-rest">
        <div><b>${rest}</b><span>jour${rest>1?'s':''} de repos sur ${days.length} j suivis</span></div>
        <div><b>${fmt(perWk,1)}</b><span>jour${perWk>=2?'s':''} de repos / semaine</span></div></div>`;
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
    const hasT=rows.some(r=>r.pct_time!=null);
    return`<div class="chg-mrow chg-mhead"><span class="chg-mk"></span><span class="chg-mtr0"></span>
        <span class="chg-mp chg-hc">Charge</span>${hasT?'<span class="chg-mp chg-mt chg-ht">Temps</span>':''}</div>`
      +rows.map(r=>{
      const c=MODC[r.modality]||'var(--muted)';
      return`<div class="chg-mrow">
        <span class="chg-mk"><b>${r.modality}</b> ${MODMAP[r.modality]||''}</span>
        <span class="chg-mbars"><span class="chg-mtr"><i style="width:${Math.max(2,Number(r.pct))}%;background:${c}"></i></span>${
          hasT?`<span class="chg-mtr chg-mtr-t"><i style="width:${Math.max(2,Number(r.pct_time||0))}%;background:${c}"></i></span>`:''}</span>
        <span class="chg-mp">${fmt(r.pct)} %</span>${hasT?`<span class="chg-mp chg-mt">${fmt(r.pct_time)} %</span>`:''}</div>`;
    }).join('')
      +(hasT?'<div class="chg-mleg"><span><i></i><b class="chg-lc">Charge</b></span><span><i class="t"></i><span class="chg-thin">Temps</span></span></div>':'');
  }


  async function renderSuivi(){
    const host=document.getElementById('charge-section');
    if(!host||!uid())return;
    host.innerHTML=`<div class="chg-card"><div style="font-size:13px;font-weight:700">📉 Ma charge d'entraînement</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">Chargement…</div></div>`;
    let series=[],weeks=[],mods=[],rpe=[],br=[];
    try{
      const[a,b,m]=await Promise.all([
        sb.rpc('training_load_series',{p_athlete:uid(),p_days:800}),
        sb.rpc('training_load_weeks',{p_athlete:uid(),p_weeks:8}),
        sb.rpc('training_load_modalities',{p_athlete:uid(),p_days:42})
      ]);
      series=a.data||[];weeks=b.data||[];mods=m.data||[];
      await addPeriods(uid(),series);
      br=await fetchBreakdown(uid());
      if(isCoachUser())rpe=await fetchRpe(uid());
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
      <div class="chg-body open" id="chg-suivi-body">${suiviHTML(series,weeks,mods,{coach:isCoachUser(),history:true,rpe})}</div>
    </div>`;
    wireRpe(host,rpe);wireWeeks(host,series,br);wireYear(host,series,br);
    document.getElementById('chg-suivi-head')
      .addEventListener('click',()=>document.getElementById('chg-suivi-body').classList.toggle('open'));
  }

  /* Corps commun athlète / coach */
  /* ---------- Ressenti, orientation S+1, RPE par modalité ---------- */
  const WSCORE={Forme:4,RAS:3,Fatigue:2,PLS:1};
  const avgOf=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  const sumLoad=a=>a.reduce((x,p)=>x+(+p.load||0),0);
  const RPEB=[['1–4','Facile',1,4],['5–6','Modéré',5,6],['7–8','Dur',7,8],['9–10','Max',9,10]];
  const mondayOf=iso=>{const d=new Date(iso+'T12:00:00');const k=(d.getDay()+6)%7;d.setDate(d.getDate()-k);return d.toISOString().slice(0,10);};

  /* Comment l'athlète encaisse : 7 derniers jours vs les 21 précédents, charge et état au réveil. */
  function ressenti(series){
    const s=series.slice(-28);
    if(s.length<14)return null;
    const last=s.slice(-7),prev=s.slice(0,-7);
    const l7=sumLoad(last),lp=sumLoad(prev)/(prev.length/7);
    const dl=lp>0?(l7-lp)/lp:null;
    const w7=last.map(p=>WSCORE[p.wake]).filter(v=>v!=null),wp=prev.map(p=>WSCORE[p.wake]).filter(v=>v!=null);
    const a7=avgOf(w7),ap=avgOf(wp);
    const bad=last.filter(p=>p.wake==='Fatigue'||p.wake==='PLS').length;
    if(dl==null)return null;
    const ld=dl>0.10?'up':dl<-0.10?'down':'flat';
    let wd=null;
    if(a7!=null&&ap!=null&&w7.length>=3&&wp.length>=5)wd=a7-ap>0.25?'up':a7-ap<-0.25?'down':'flat';
    let v,c;
    if(wd==null){v="Pas assez d'états au réveil renseignés pour évaluer le ressenti.";c='var(--muted)';}
    else if(ld==='up'&&wd!=='down'){v='Absorbe bien la hausse de charge.';c=OK;}
    else if(ld==='up'&&wd==='down'){v='Encaisse mal la hausse : l\'état de fatigue au réveil augmente avec la charge.';c=BAD;}
    else if(ld==='flat'&&wd==='down'){v='Charge stable mais état de fatigue au réveil en hausse : fatigue qui s\'accumule ou facteur hors entraînement.';c=WARN;}
    else if(ld==='down'&&wd==='down'){v='État de fatigue au réveil en hausse malgré moins de charge : regarder sommeil, stress, vie perso.';c=WARN;}
    else if(wd==='up'){v=ld==='down'?'Récupère bien de la baisse de charge : moins de fatigue au réveil.':'Moins de fatigue au réveil à charge égale.';c=OK;}
    else{v='État de fatigue au réveil stable, en phase avec la charge.';c=AC;}
    return{dl,ld,wd,a7,ap,bad,v,c,l7};
  }

  function orientation(series,weeks,rpeRows,res){
    const last=series[series.length-1];
    const r=last.ratio==null?null:Number(last.ratio);
    const l7=sumLoad(series.slice(-7));
    const neg=res&&(res.wd==='down'||res.bad>=3);
    let f,txt;
    if(r==null){f=[1.0,1.1];txt='Amorçage : construire la base sans à-coup, charge proche de l\'actuelle.';}
    else if(r<0.8){f=[1.1,1.2];txt='Sous-charge : remonter progressivement, sans viser plus de +20 % sur la semaine.';}
    else if(r<=1.3&&!neg){f=[1.05,1.1];txt='Zone optimale et bon ressenti : progression possible.';}
    else if(r<=1.3){f=[0.9,1.0];txt='Zone optimale mais ressenti en baisse : maintenir ou alléger légèrement.';}
    else if(r<=1.5){f=[0.85,0.95];txt='Vigilance : stabiliser, ne pas ajouter de charge cette semaine.';}
    else{f=[0.7,0.8];txt='Risque élevé : semaine de décharge.';}
    const tgt=l7>0?[Math.round(l7*f[0]/10)*10,Math.round(l7*f[1]/10)*10]:null;
    const tips=[];
    // intensité : part du temps à RPE >= 8 sur 14 j
    const tot=rpeRows.reduce((a,b)=>a+(+b.minutes||0),0);
    const hard=rpeRows.filter(b=>b.rpe>=8).reduce((a,b)=>a+(+b.minutes||0),0);
    const hp=tot>0?hard/tot*100:null;
    if(r!=null&&r>1.3)tips.push(['Intensité','Garder une seule séance à RPE ≥ 8, le reste entre 5 et 7.']);
    else if(neg)tips.push(['Intensité','Baisser l\'intensité avant le volume : RPE ≤ 7 tant que l\'état de fatigue au réveil ne s\'améliore pas.']);
    else if(hp!=null&&hp>30)tips.push(['Intensité',`${fmt(hp)} % du temps à RPE ≥ 8 sur 14 j : c'est beaucoup, réduire les séances dures.`]);
    else if(hp!=null&&hp<10&&r!=null&&r>=0.8)tips.push(['Intensité',`Seulement ${fmt(hp)} % du temps à RPE ≥ 8 sur 14 j : place pour 1 séance intense de plus.`]);
    else if(hp!=null)tips.push(['Intensité',`${fmt(hp)} % du temps à RPE ≥ 8 sur 14 j : répartition correcte, la garder.`]);
    const wk=weeks[0];
    if(wk&&wk.monotony!=null&&wk.monotony>2)tips.push(['Variation','Monotonie > 2 : alterner jours difficiles, jours modérés et jours faciles.']);
    const off14=series.slice(-14).filter(p=>p.is_off).length;
    if(off14<2)tips.push(['Repos',`${off14} jour${off14>1?'s':''} OFF sur 14 j : prévoir au moins 1 jour OFF dans la semaine.`]);
    // S+2 : 3 semaines terminées en hausse -> semaine allégée
    const done=weeks.filter(w=>addDays(w.week_start,7)<=today()).slice(0,3);
    let s2=null;
    if(done.length===3&&done[0].total>done[1].total&&done[1].total>done[2].total)
      s2='3 semaines de hausse d\'affilée : prévoir une semaine allégée (−20 à −30 %) en S+2.';
    else if(f[0]>=1.05)s2='Si S+1 passe bien (état de fatigue au réveil stable), poursuivre la progression sur le même rythme.';
    else if(f[1]<=0.95)s2='Reprendre la progression quand le ratio revient sous 1,3 et que l\'état de fatigue au réveil s\'améliore.';
    let ca;
    if(f[1]<=0.8)ca=['↓↓ Décharger',BAD];
    else if(f[1]<=0.95)ca=['↓ Alléger',WARN];
    else if(f[0]>=1.05)ca=['↑ Augmenter',OK];
    else if(f[1]>1.0)ca=['↗ Stable à légère hausse',AC];
    else ca=['= Maintenir ou alléger',WARN];
    let ia;
    if(r!=null&&r>1.3)ia=['↓ Limiter',WARN];
    else if(neg||(hp!=null&&hp>30))ia=['↓ Baisser',WARN];
    else if(hp!=null&&hp<10&&r!=null&&r>=0.8)ia=['↑ Augmenter possible',OK];
    else ia=['= Maintenir','var(--muted)'];
    return{txt,f,tgt,l7,tips,s2,ca,ia};
  }

  function coachHTML(series,weeks,rpeRows){
    const res=ressenti(series);
    const o=orientation(series,weeks,rpeRows,res);
    const pct=x=>{const v=Math.round((x-1)*100);return v===0?'0 %':(v>0?'+':'−')+fmt(Math.abs(v))+' %';};
    const fr=o.f[0]===o.f[1]?pct(o.f[0]):`${pct(o.f[0])} à ${pct(o.f[1])}`;
    const dm=d=>d.slice(8)+'/'+d.slice(5,7);
    const mon=mondayOf(today()),nx=addDays(mon,7);
    const pw=weeks.find(w=>w.week_start===addDays(mon,-7));
    const cw={mon,day:Math.round((new Date(today()+'T12:00:00')-new Date(mon+'T12:00:00'))/864e5)+1,
      done:sumLoad(series.filter(p=>p.d>=mon)),prev:pw?+pw.total:null};
    return`<div class="chg-coach">
      <div class="chg-panel chg-pcoach"><div class="chg-sec"><h4>Ressenti de la charge</h4><span>7 j vs 21 j précédents</span></div>
        ${res?`<div class="chg-verdict" style="border-color:${tint(res.c,45)};background:${tint(res.c,12)}"><i style="background:${res.c}"></i>${res.v}</div>
        <div class="chg-rest chg-res3">
          <div><b>${res.dl>=0?'+':'−'}${fmt(Math.abs(res.dl*100))} %</b><span>charge 7 j vs moy.</span></div>
          <div><b>${res.a7==null?'–':fmt(res.a7,1)}${res.ap!=null?` <small>/ ${fmt(res.ap,1)}</small>`:''}</b><span>état au réveil 7 j / avant (sur 4)</span></div>
          <div><b>${res.bad}</b><span>réveil${res.bad>1?'s':''} Fatigué / PLS · 7 j</span></div></div>`
        :'<p class="chg-hint">Il faut au moins 14 jours de données pour évaluer le ressenti, et 1 à 2 cycles d\'entraînement pour qu\'il soit fiable.</p>'}
      </div>
      <div class="chg-panel chg-pcoach"><div class="chg-sec"><h4>Orientation de la programmation</h4><span>repères coach</span></div>
        <div class="chg-owk">
          <div class="chg-owh"><b>Cette semaine · S${isoWeek(cw.mon)}</b><span>${dm(cw.mon)} → ${dm(addDays(cw.mon,6))}</span><em>en cours · jour ${cw.day}/7</em></div>
          <div class="chg-onow"><div><span>Charge réalisée</span><b>${fmt(cw.done)} UA</b></div>
            <div class="r"><span>Semaine dernière S${isoWeek(addDays(cw.mon,-7))}</span><b>${cw.prev==null?'–':fmt(cw.prev)+' UA'}</b></div></div>
          ${cw.prev?`<div class="chg-oprog"><i style="width:${Math.min(100,cw.done/cw.prev*100)}%"></i></div>
          <div class="chg-onote">${fmt(cw.done/cw.prev*100)} % de la charge de la semaine dernière, à ${cw.day} jour${cw.day>1?'s':''} sur 7. Semaine non terminée : simple point d'étape.</div>`:''}
        </div>
        <div class="chg-owk chg-onext">
          <div class="chg-owh"><b>Semaine prochaine · S${isoWeek(nx)}</b><span>${dm(nx)} → ${dm(addDays(nx,6))}</span><em>à programmer</em></div>
          <div class="chg-orow"><span class="k">Charge</span><span class="chg-obadge" style="color:${o.ca[1]};border-color:${tint(o.ca[1],45)};background:${tint(o.ca[1],12)}">${o.ca[0]}</span>
            <b class="v">${o.tgt?`${fmt(o.tgt[0])} – ${fmt(o.tgt[1])} UA`:'–'}</b></div>
          <div class="chg-onote">Cible = charge des 7 derniers jours glissants (${dm(addDays(today(),-6))} → ${dm(today())} : ${fmt(o.l7)} UA) ajustée de ${fr}. ${o.txt}</div>
          <div class="chg-orow"><span class="k">Intensité</span><span class="chg-obadge" style="color:${o.ia[1]};border-color:${tint(o.ia[1],45)};background:${tint(o.ia[1],12)}">${o.ia[0]}</span></div>
          ${o.tips.map(([k,t])=>k==='Intensité'?`<div class="chg-onote">${t}</div>`:'').join('')}
          ${o.tips.filter(([k])=>k!=='Intensité').map(([k,t])=>`<div class="chg-orow chg-otop"><span class="k">${k}</span><span class="t">${t}</span></div>`).join('')}
        </div>
        ${o.s2?`<div class="chg-owk"><div class="chg-owh"><b>Dans 2 semaines · S${isoWeek(addDays(nx,7))}</b><span>${dm(addDays(nx,7))} → ${dm(addDays(nx,13))}</span></div>
          <div class="chg-onote" style="margin-top:4px">${o.s2.replace(' en S+2','')}</div></div>`:''}
        <div class="chg-hint">Repères indicatifs calculés sur le ratio A/C, l'état de fatigue au réveil et l'intensité récente. Il faut 1 à 2 cycles d'entraînement de données pour que ces variables soient justes, et elles sont propres à chaque athlète : à ajuster selon le calendrier et l'objectif.</div>
      </div></div>`;
  }

  const RPEBC=[RPEC[1],RPEC[4],RPEC[6],RPEC[9]];
  /* Distribution d'intensité : nombre de blocs par RPE (1 à 10) sur la semaine, couleurs par zone. */
  function distHTML(wkRows){
    const n=Array(10).fill(0);wkRows.forEach(b=>{if(b.rpe>=1&&b.rpe<=10)n[b.rpe-1]++;});
    const W=340,H=130,L=22,R=6,T=10,B=20,mx=Math.max(2,...n);
    const st=(W-L-R)/10,Y=v=>T+(1-v/mx)*(H-T-B);
    let g='';
    for(let k=0;k<=mx;k+=mx>6?2:1)g+=`<line x1="${L}" x2="${W-R}" y1="${Y(k)}" y2="${Y(k)}" stroke="${C_GRID}"/>`
      +`<text x="${L-5}" y="${Y(k)+3.5}" text-anchor="end" font-size="9" fill="var(--muted)">${k}</text>`;
    n.forEach((v,i)=>{const x=L+st*i,c=RPEBC[RPEB.findIndex(([, ,lo,hi])=>i+1>=lo&&i+1<=hi)];
      if(v)g+=`<rect x="${x+st*.2}" y="${Y(v)}" width="${st*.6}" height="${Y(0)-Y(v)}" rx="2" fill="${c}"><title>RPE ${i+1} · ${v} bloc${v>1?'s':''}</title></rect>`
        +`<text x="${x+st/2}" y="${Y(v)-3}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--text)">${v}</text>`;
      g+=`<text x="${x+st/2}" y="${H-6}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${i+1}</text>`;});
    return`<div class="chg-sub">Distribution d'intensité <span>nombre de blocs par RPE</span></div>
      <svg class="chg-chart chg-dist" viewBox="0 0 ${W} ${H}" role="img" aria-label="Distribution d'intensité de la semaine">${g}</svg>`;
  }
  function rpeTableHTML(rows,wk){
    const wkRows=rows.filter(b=>mondayOf(b.date)===wk);
    if(!wkRows.length)return'<p class="chg-hint">Aucun bloc renseigné sur cette semaine.</p>';
    const by={};
    wkRows.forEach(b=>{const m=b.modality||'?';by[m]=by[m]||[0,0,0,0];
      const i=RPEB.findIndex(([, ,lo,hi])=>b.rpe>=lo&&b.rpe<=hi);if(i>=0)by[m][i]+=(+b.minutes||0);});
    const sum=a=>a.reduce((x,y)=>x+y,0);
    const mods=Object.keys(by).sort((a,b)=>sum(by[b])-sum(by[a]));
    const col=[0,1,2,3].map(i=>mods.reduce((a,m)=>a+by[m][i],0));
    const tot=sum(col),mx=Math.max(...mods.map(m=>sum(by[m])));
    const bar=(v,w)=>`<span class="chg-rbar" style="width:${w}%">${v.map((x,i)=>x?
      `<i style="flex:${x};background:${RPEBC[i]}" title="RPE ${RPEB[i][0]} · ${fmt(x)} min"></i>`:'').join('')}</span>`;
    return`${distHTML(wkRows)}
      <div class="chg-sub">Temps par zone et par modalité <span>minutes</span></div>
      <div class="chg-rrow chg-rtot"><span class="chg-mk"><b>Semaine</b></span>
        <span class="chg-rtrack">${bar(col,100)}</span><span class="chg-mp">${fmt(tot)}′</span></div>
      ${mods.map(m=>`<div class="chg-rrow"><span class="chg-mk"><b>${m}</b> ${MODMAP[m]||''}</span>
        <span class="chg-rtrack">${bar(by[m],sum(by[m])/mx*100)}</span><span class="chg-mp">${fmt(sum(by[m]))}′</span></div>`).join('')}
      <div class="chg-leg chg-rleg">${RPEB.map(([r,l],i)=>`<span><i style="background:${RPEBC[i]};height:8px;width:8px;border-radius:2px"></i>${l} <small>${r}</small> <b>${tot?fmt(col[i]/tot*100):0} %</b></span>`).join('')}</div>`;
  }
  function rpePanelHTML(rows){
    const cur=mondayOf(today()),prev=addDays(cur,-7);
    return`<div class="chg-panel" style="order:7" data-rpe-panel><div class="chg-sec"><h4>Intensité de la semaine</h4><span>RPE par bloc</span></div>
      <div class="chg-seg chg-rpeseg"><button data-wk="${cur}" aria-pressed="true">Semaine en cours</button><button data-wk="${prev}" aria-pressed="false">Semaine précédente</button></div>
      <div data-rpe-body>${rpeTableHTML(rows,cur)}</div></div>`;
  }
  function wireRpe(root,rows){
    const pnl=root&&root.querySelector('[data-rpe-panel]');if(!pnl)return;
    pnl.querySelectorAll('[data-wk]').forEach(b=>b.addEventListener('click',()=>{
      pnl.querySelectorAll('[data-wk]').forEach(x=>x.setAttribute('aria-pressed',x===b));
      pnl.querySelector('[data-rpe-body]').innerHTML=rpeTableHTML(rows,b.dataset.wk);}));
  }
  async function fetchRpe(athleteId){
    try{
      const from=addDays(mondayOf(today()),-14);
      const{data}=await sb.from('training_load_blocks').select('date,modality,rpe,minutes,load')
        .eq('athlete_id',athleteId).gte('date',from).gt('load',0);
      return data||[];
    }catch(e){console.error('[charge] rpe',e);return[];}
  }

  /* ---------- Bilan par semaine (3 semaines côte à côte) & périodisation annuelle ---------- */
  const ddmm=d=>d.slice(8)+'/'+d.slice(5,7);
  const MOIS=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  async function fetchBreakdown(athleteId){
    try{
      const y=+today().slice(0,4);
      const{data}=await sb.rpc('training_load_week_breakdown',{p_athlete:athleteId,p_from:`${y-1}-01-01`});
      return(data||[]).map(r=>({...r,week_start:String(r.week_start).slice(0,10),n:+r.n,load:+r.load,minutes:+r.minutes}));
    }catch(e){console.error('[charge] breakdown',e);return[];}
  }
  // stats hebdo calculées comme training_load_weeks (jours présents dans la série), OFF = marqués OFF
  function wkStatsFrom(series){
    const by={},out={};
    series.forEach(p=>{const m=mondayOf(p.d);(by[m]=by[m]||[]).push(p);});
    for(const m in by){
      const a=by[m],L=a.map(p=>+p.load||0),tot=L.reduce((x,y)=>x+y,0),avg=tot/a.length;
      const sd=a.length>1?Math.sqrt(L.reduce((x,y)=>x+(y-avg)**2,0)/(a.length-1)):0;
      const mono=sd>0?avg/sd:null;
      out[m]={total:tot,avg,off:a.filter(p=>p.is_off).length,hours:a.reduce((x,p)=>x+(+p.minutes||0),0)/60,
        mono,strain:mono!=null?tot*mono:null};
    }
    return out;
  }
  function weekCardHTML(mon,st,br){
    const rows=br.filter(r=>r.week_start===mon);
    const cur=mon===mondayOf(today());
    const head=`<div class="chg-wch"><b>S${isoWeek(mon)}</b><span>${ddmm(mon)} → ${ddmm(addDays(mon,6))}</span>${cur?'<em>en cours</em>':''}</div>`;
    if((!st||!st.total)&&!rows.length)return`<div class="chg-wcard">${head}<p class="chg-hint">Aucune donnée sur cette semaine.</p></div>`;
    const k=(v,l)=>`<div><b>${v}</b><span>${l}</span></div>`;
    const mm={};rows.forEach(r=>{mm[r.modality]=(mm[r.modality]||0)+r.load;});
    const tl=Object.values(mm).reduce((a,b)=>a+b,0);
    const mods=Object.keys(mm).sort((a,b)=>mm[b]-mm[a]);
    const mx=Math.max(1,...Object.values(mm));
    const dist=[];rows.forEach(r=>{for(let i=0;i<r.n;i++)dist.push({rpe:r.rpe});});
    const zone=[0,0,0,0];rows.forEach(r=>{const i=RPEB.findIndex(([, ,lo,hi])=>r.rpe>=lo&&r.rpe<=hi);if(i>=0)zone[i]+=r.minutes;});
    const zt=zone.reduce((a,b)=>a+b,0);
    return`<div class="chg-wcard">${head}
      <div class="chg-wk6">${k(fmt(st?st.total:tl),'Charge totale (UA)')}${k(st?fmt(st.avg):'–','Charge moyenne / j')}
        ${k(st?st.off:'–','Jours OFF')}${k(st?fmt(st.hours,1):'–','Heures')}
        ${k(st&&st.mono!=null?fmt(st.mono,1):'–','Monotonie')}${k(st&&st.strain!=null?fmt(st.strain):'–','Contrainte')}</div>
      <div class="chg-sub">Répartition de la charge <span>par modalité</span></div>
      ${mods.length?mods.map(m=>`<div class="chg-mrow"><span class="chg-mk"><b>${m}</b> ${MODMAP[m]||''}</span>
        <span class="chg-mtr"><i style="width:${Math.max(2,mm[m]/mx*100)}%;background:${MODC[m]||'var(--muted)'}"></i></span>
        <span class="chg-mp">${fmt(mm[m]/tl*100)} %</span></div>`).join(''):'<p class="chg-hint">Aucun bloc renseigné.</p>'}
      ${dist.length?distHTML(dist):''}
      ${zt?`<div class="chg-sub">Temps par zone <span>${fmt(zt)} min</span></div>
        <div class="chg-rtrack chg-wz"><span class="chg-rbar" style="width:100%">${zone.map((x,i)=>x?`<i style="flex:${x};background:${RPEBC[i]}" title="RPE ${RPEB[i][0]} · ${fmt(x)} min"></i>`:'').join('')}</span></div>
        <div class="chg-leg chg-rleg">${RPEB.map(([r,l],i)=>zone[i]?`<span><i style="background:${RPEBC[i]};height:8px;width:8px;border-radius:2px"></i>${l} <b>${fmt(zone[i]/zt*100)} %</b></span>`:'').join('')}</div>`:''}
    </div>`;
  }
  function weeksSectionHTML(){
    return`<div class="chg-panel chg-full" data-wk-section>
      <div class="chg-sec"><h4>Bilan par semaine</h4><span>comparer les semaines</span>
        <div class="chg-wnav"><button data-wnav="-1" aria-label="Semaine précédente">‹</button><b data-wlabel></b><button data-wnav="1" aria-label="Semaine suivante">›</button></div></div>
      <div class="chg-wcards" data-wcards></div></div>`;
  }
  function wireWeeks(root,series,br){
    const pnl=root&&root.querySelector('[data-wk-section]');if(!pnl)return;
    const st=wkStatsFrom(series);const now=mondayOf(today());let sel=now;
    const draw=()=>{
      const ws=[addDays(sel,-14),addDays(sel,-7),sel];
      pnl.querySelector('[data-wcards]').innerHTML=ws.map((m,i)=>`<div class="chg-wcol${i<2?' chg-wprev':''}">${weekCardHTML(m,st[m],br)}</div>`).join('');
      pnl.querySelector('[data-wlabel]').textContent=`S${isoWeek(sel)}`;
      pnl.querySelector('[data-wnav="1"]').disabled=sel>=now;
    };
    pnl.querySelectorAll('[data-wnav]').forEach(b=>b.addEventListener('click',()=>{sel=addDays(sel,7*(+b.dataset.wnav));draw();}));
    draw();
  }

  function yearSectionHTML(){
    return`<div class="chg-panel chg-full" data-year-section>
      <div class="chg-sec"><h4>Périodisation annuelle</h4><span>charge par semaine et par modalité</span>
        <div class="chg-wnav"><button data-ynav="-1" aria-label="Année précédente">‹</button><b data-ylabel></b><button data-ynav="1" aria-label="Année suivante">›</button></div></div>
      <div data-ybody></div></div>`;
  }
  function isoWeeksOf(year){
    const ws=[];let m=mondayOf(`${year}-01-04`);
    while(addDays(m,3).slice(0,4)===String(year)){ws.push(m);m=addDays(m,7);}
    return ws;
  }
  function yearChartHTML(ws,wm,mods){
    const W=720,H=190,L=38,R=8,T=12,B=30;
    const tot=ws.map(m=>mods.reduce((a,k)=>a+((wm[m]||{})[k]||0),0));
    const max=niceMax(Math.max(1,...tot)*1.05);
    const st=(W-L-R)/ws.length,X=i=>L+st*i,Y=v=>T+(1-v/max)*(H-T-B);
    let g='';
    for(let k=0;k<=4;k++){const v=max*k/4;g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C_GRID}"/>`
      +`<text x="${L-5}" y="${Y(v)+3.5}" text-anchor="end" font-size="9" fill="var(--muted)">${Math.round(v)}</text>`;}
    const now=mondayOf(today());
    ws.forEach((m,i)=>{
      let y0=0;
      mods.forEach(k=>{const v=(wm[m]||{})[k]||0;if(!v)return;
        g+=`<rect x="${X(i)+st*.15}" y="${Y(y0+v)}" width="${st*.7}" height="${Y(y0)-Y(y0+v)}" fill="${MODC[k]||'var(--muted)'}"><title>S${isoWeek(m)} · ${k} ${fmt(v)} UA</title></rect>`;y0+=v;});
      if(m===now)g+=`<line x1="${X(i)+st/2}" x2="${X(i)+st/2}" y1="${T}" y2="${H-B}" stroke="var(--accent)" stroke-dasharray="3 3"/>`;
      const th=addDays(m,3);
      if(i===0||th.slice(5,7)!==addDays(ws[i-1],3).slice(5,7))
        g+=`<text x="${X(i)+2}" y="${H-B+13}" font-size="9" fill="var(--muted)">${MOIS[+th.slice(5,7)-1]}</text>`;
      if((i+1)%4===1)g+=`<text x="${X(i)+st/2}" y="${H-B+25}" text-anchor="middle" font-size="8" fill="var(--muted)">S${i+1}</text>`;
    });
    return`<svg class="chg-chart chg-year" viewBox="0 0 ${W} ${H}" role="img" aria-label="Charge par semaine sur l'année">${g}</svg>
      <div class="chg-leg">${mods.map(k=>`<span><i style="background:${MODC[k]||'var(--muted)'};height:8px;width:8px;border-radius:2px"></i>${k} <small>${MODMAP[k]||''}</small></span>`).join('')}</div>`;
  }
  function yearTableHTML(ws,st,wm,mods){
    const now=mondayOf(today());
    const cell=(m,v)=>`<td class="${m===now?'cur':''}${m>now?' fut':''}">${v}</td>`;
    const row=(lbl,f,cls)=>`<tr${cls?` class="${cls}"`:''}><th>${lbl}</th>${ws.map(m=>cell(m,m>now?'':f(m))).join('')}</tr>`;
    const s=m=>st[m];
    return`<div class="chg-yscroll"><table class="chg-ytbl"><thead><tr><th>Semaine</th>${ws.map((m,i)=>`<td class="${m===now?'cur':''}${m>now?' fut':''}"><b>S${i+1}</b><small>${ddmm(m)}</small></td>`).join('')}</tr></thead><tbody>
      ${row('Charge (UA)',m=>s(m)&&s(m).total?`<b>${fmt(s(m).total)}</b>`:'·')}
      ${row('Moyenne / j',m=>s(m)&&s(m).total?fmt(s(m).avg):'·')}
      ${row('Jours OFF',m=>s(m)?s(m).off:'·')}
      ${row('Heures',m=>s(m)&&s(m).hours?fmt(s(m).hours,1):'·')}
      ${row('Monotonie',m=>s(m)&&s(m).mono!=null?fmt(s(m).mono,1):'·')}
      ${row('Contrainte',m=>s(m)&&s(m).strain!=null?fmt(s(m).strain):'·')}
      ${mods.map((k,j)=>row(`<i style="background:${MODC[k]||'var(--muted)'}"></i>${k}`,m=>(wm[m]||{})[k]?fmt(wm[m][k]):'·',j===0?'sep':'')).join('')}
      </tbody></table></div>`;
  }
  function wireYear(root,series,br){
    const pnl=root&&root.querySelector('[data-year-section]');if(!pnl)return;
    const st=wkStatsFrom(series);
    const wm={};br.forEach(r=>{(wm[r.week_start]=wm[r.week_start]||{})[r.modality]=((wm[r.week_start]||{})[r.modality]||0)+r.load;});
    const cy=+isoWeek(today()).split('/')[1]+2000||+today().slice(0,4);
    const years=[...new Set([...Object.keys(st),...Object.keys(wm)].map(m=>+addDays(m,3).slice(0,4)))];
    const minY=Math.min(cy,...years);let year=cy;
    const draw=()=>{
      const ws=isoWeeksOf(year);
      const mods=MODS.map(([k])=>k).filter(k=>ws.some(m=>(wm[m]||{})[k]));
      Object.keys(wm).forEach(m=>Object.keys(wm[m]).forEach(k=>{if(!mods.includes(k)&&ws.includes(m))mods.push(k);}));
      pnl.querySelector('[data-ylabel]').textContent=year;
      pnl.querySelector('[data-ynav="1"]').disabled=year>=cy;
      pnl.querySelector('[data-ynav="-1"]').disabled=year<=minY;
      pnl.querySelector('[data-ybody]').innerHTML=`<div class="chg-ychart">${yearChartHTML(ws,wm,mods)}</div>`+yearTableHTML(ws,st,wm,mods);
      const cur=pnl.querySelector('.chg-ytbl td.cur');const sc=pnl.querySelector('.chg-yscroll');
      if(cur&&sc)sc.scrollLeft=Math.max(0,cur.offsetLeft-sc.clientWidth+cur.clientWidth*3);
      const yc=pnl.querySelector('.chg-ychart');if(yc&&yc.scrollWidth>yc.clientWidth){const i=ws.indexOf(mondayOf(today()));yc.scrollLeft=i<0?0:Math.max(0,yc.scrollWidth*(i+3)/ws.length-yc.clientWidth);}
    };
    pnl.querySelectorAll('[data-ynav]').forEach(b=>b.addEventListener('click',()=>{year+=+b.dataset.ynav;draw();}));
    draw();
  }

  function suiviHTML(series,weeks,mods,opts){
    opts=opts||{};
    const rpeRows=opts.rpe||[];
    const last=series[series.length-1];
    const z=zone(last.ratio==null?null:Number(last.ratio));
    const h7=series.slice(-7).reduce((a,p)=>a+p.minutes,0)/60;
    const wk=weeks[0];
    const s42=series.slice(-42).map(p=>({
      date:p.d,load:+p.load,minutes:+p.minutes,wake:p.wake,period:!!p.period,off:!!p.is_off,
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
      ${opts.coach?coachHTML(series,weeks,rpeRows):''}
      <div class="chg-grid">
      <div class="chg-col">
      <div style="order:1" class="chg-panel"><div class="chg-sec"><h4>Charge quotidienne</h4><span>42 jours</span></div>
      ${chartLoad(s42)}</div>
      <div style="order:3" class="chg-panel"><div class="chg-sec"><h4>État au réveil</h4><span>28 jours</span></div>
      ${wakeStrip(s42)}</div>
      <div style="order:5" class="chg-panel chg-panel-tbl"><table class="chg-tbl"><thead><tr><th>Sem.</th><th>Charge</th><th>Moy.</th><th>Mono.</th><th>Contr.</th><th>OFF</th><th>Heures</th></tr></thead><tbody>
        ${weeks.map(w=>{
          const cur=w.week_start<=today()&&addDays(w.week_start,7)>today();
          return`<tr${cur?' class="cur"':''}><td><b>S${isoWeek(w.week_start)}</b>${
            cur?'<small>en cours</small>':`<small>${w.week_start.slice(8)}/${w.week_start.slice(5,7)}</small>`}</td>
          <td>${fmt(w.total)}</td><td>${fmt(w.avg_day)}</td>
          <td>${w.monotony==null?'–':fmt(w.monotony,2)}</td><td>${w.strain==null?'–':fmt(w.strain)}</td>
          <td>${w.off_days}</td><td>${fmt(w.hours,1)}</td></tr>`;}).join('')}
      </tbody></table></div>
      </div><div class="chg-col">
      <div style="order:2" class="chg-panel"><div class="chg-sec"><h4>Ratio aiguë / chronique</h4><span>42 jours</span></div>
      ${chartRatio(s42)}</div>
      <div style="order:4" class="chg-panel"><div class="chg-sec"><h4>Semaines</h4><span>8 dernières</span></div>
      ${chartWeeks(weeks)}</div>
      <div style="order:6" class="chg-panel"><div class="chg-sec"><h4>Modalités</h4><span>42 jours · <span class="chg-paren">(<b class="chg-strong">% de la charge</b> / <span class="chg-thin">% du temps</span>)</span></span></div>
      <div id="chg-mods">${modsHTML(mods)}</div></div>
      </div>
      </div>
      ${opts.coach||opts.history?weeksSectionHTML():''}
      <div class="chg-hint">Ratio aigu / chronique : &lt; 0,8 sous-charge · 0,8–1,3 optimal · 1,3–1,5 vigilance · &gt; 1,5 risque élevé.
      Monotonie = charge moyenne ÷ écart-type de la semaine ; au-dessus de 2, la semaine manque de variation.
      Contrainte = charge × monotonie. Échauffement et mobilité sont exclus de la charge.</div>
      ${opts.coach||opts.history?yearSectionHTML():''}`;
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
    let series=[],weeks=[],mods=[],rpe=[],br=[];
    try{
      const[s,w,m]=await Promise.all([
        sb.rpc('training_load_series',{p_athlete:athleteId,p_days:800}),
        sb.rpc('training_load_weeks',{p_athlete:athleteId,p_weeks:8}),
        sb.rpc('training_load_modalities',{p_athlete:athleteId,p_days:42})
      ]);
      series=s.data||[];weeks=w.data||[];mods=m.data||[];
      await addPeriods(athleteId,series);
      rpe=await fetchRpe(athleteId);br=await fetchBreakdown(athleteId);
    }catch(e){console.error('[charge] fiche',e);}
    fiche.innerHTML=`<button class="chg-back" id="chg-back">${opts.fromPerso?'‹ Retour à l\'espace perso':'‹ Retour'}</button>
      <div style="font-size:15px;font-weight:700;margin:10px 0 2px">${a.full_name||a.email||'Athlète'}</div>
      <div class="chg-card chg-fiche-card" id="chg-fiche-wod" style="padding-top:2px"></div>
      ${series.length?`<div class="chg-card chg-fiche-card">${suiviHTML(series,weeks,mods,{coach:true,rpe})}</div>`
        :'<div style="color:var(--muted);font-size:13px;margin-top:8px">Aucune saisie de charge pour cet athlète.</div>'}`;
    wireRpe(fiche,rpe);wireWeeks(fiche,series,br);wireYear(fiche,series,br);
    if(window.loadWodStatsInto)window.loadWodStatsInto(document.getElementById('chg-fiche-wod'),athleteId);
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
