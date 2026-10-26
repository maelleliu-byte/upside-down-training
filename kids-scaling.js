/* ============================================================================
 * kids-scaling.js — Scaling Kids & Teens pour Upside Down Training
 * ----------------------------------------------------------------------------
 * Convertit un WOD adulte en versions Kids/Teens, par tranche d'âge et par
 * niveau (RX / Inter / Scaled), et les affiche sous le bloc WOD existant.
 *
 * POSE : une ligne dans index.html, APRÈS wellness.js
 *     <script src="kids-scaling.js?v=20261026a"></script>
 *
 * Script classique (pas un module), aucune dépendance, aucun appel réseau.
 * Ne modifie ni admin.js ni planning.js : enveloppe buildSessionCard()
 * selon la convention habituelle (IIFE + garde window.__patchBound_*).
 *
 * RÉGLAGES : tout ce qui se règle est dans le bloc CONFIG ci-dessous.
 * ========================================================================== */
(function(){
'use strict';

/* ========================= CONFIG ========================= */

/* Slugs de programmes où le bloc Kids s'affiche. 'training' = la prog adulte,
   depuis laquelle on veut générer la version enfants. */
var PROGS = ['training','kids'];

/* Ratios ♂/♀ : −30 % sur les charges, −20 % sur les calories. */
var RATIO_CHARGE = 0.70, RATIO_CAL = 0.80;

/* Tranches d'âge.
   k     coefficient de charge appliqué à la prescription adulte
   kvol  coefficient de volume (distances, calories, time caps)
   box   hauteur de box ♂/♀ en cm      cible  hauteur de cible wall ball en m
   14-15 et 16-17 = coefficients officiels CrossFit Games.
   6-13 = extrapolation UDT, à recaler sur les groupes réels. */
var CATS = [
  {id:'6-7',nom:'6-7 ans',fede:'Poussins',k:0.21,kvol:0.50,box:[20,20],cible:1.8,
   alerte:"Pas de barre chargée ni de travail maximal. PVC ou bâton, séries courtes.",
   note:"Charge indicative : l'objectif est le schéma moteur, pas le kilo."},
  {id:'8-9',nom:'8-9 ans',fede:'Pupilles',k:0.26,kvol:0.60,box:[25,25],cible:2.0,
   alerte:"Pas de travail maximal. Barre technique 5 kg maximum, pas de kipping.",
   note:"Privilégier haltères, médecine-ball et sacs lestés à la barre."},
  {id:'10-11',nom:'10-11 ans',fede:'Benjamins',k:0.34,kvol:0.75,box:[30,30],cible:2.2,
   alerte:"Pas de 1RM. Kipping uniquement si 3 tractions strictes sont acquises.",
   note:"Barre 10 kg. La barre de 15 kg arrive en fin de catégorie."},
  {id:'12-13',nom:'12-13 ans',fede:'Minimes',k:0.47,kvol:0.90,box:[40,35],cible:2.5,
   alerte:"Pas de 1RM avant maturité osseuse : plancher à 3 répétitions.",
   note:"Barre 15 kg (F) et 20 kg (M) utilisables à partir de 13 ans."},
  {id:'14-15',nom:'14-15 ans',fede:'Cadets',k:0.67,kvol:1,box:[50,45],cible:2.7,officiel:true,
   note:"Volume, time caps et standards techniques adultes conservés."},
  {id:'16-17',nom:'16-17 ans',fede:'Juniors',k:1,kvol:1,box:[60,50],cible:3.0,officiel:true,
   note:"Charges Rx adultes en metcon ; −15 % seulement sur les barres lourdes."}
];
var JEUNES = ['6-7','8-9','10-11','12-13'];

/* Niveaux. shift = crans descendus sur la gymnastique, la box et la cible.
   source = colonne de `sessions` utilisée comme texte de départ. */
var NIVEAUX = [
  {id:'rx',nom:'RX',k:1,shift:0,source:'content',
   legende:"Coefficient plein de la catégorie, gymnastique de la catégorie."},
  {id:'inter',nom:'Inter',k:0.85,shift:0,source:'scaling_inter',
   legende:"Charges allégées de 15 %, mouvements inchangés."},
  {id:'scaled',nom:'Scaled',k:0.65,shift:1,source:'scaling_scaled',
   legende:"Charges allégées de 35 %, gymnastique, box et cible descendues d'un cran."}
];

/* Matériel disponible. À remplacer par l'inventaire réel du club :
   les charges sont arrondies à ces valeurs, jamais au-dessus. */
var RACKS = {
  barre:[1,5,7.5,10,12.5,15,17.5,20,22.5,25,27.5,30,32.5,35,37.5,40,42.5,45,47.5,50,52.5,55,57.5,60,65,70,75,80,85,90,95,100,105,110,120,130,140,150],
  db:[2,3,4,5,6,7.5,8,10,12,14,16,18,20,22.5,25,30],
  kb:[4,6,8,10,12,16,20,24,28,32],
  wb:[2,3,4,5,6,7,9,10,12],
  sac:[5,10,15,20,25,30,35,40,50,60,70]
};

/* Substitutions gymniques. Catégorie absente = mouvement inchangé. */
var GYM = [
  {re:/\b(ring muscle[- ]ups?|muscle[- ]ups? anneaux)\b/gi,s:{'6-7':'ring rows inclinées + push-ups genoux','8-9':'ring rows + push-ups sur box','10-11':'pull-ups sautées + dips sur box','12-13':'chest-to-bar + dips anneaux','14-15':'bar muscle-ups'}},
  {re:/\b(bar muscle[- ]ups?|muscle[- ]ups?)\b/gi,s:{'6-7':'ring rows inclinées','8-9':'ring rows','10-11':'pull-ups sautées','12-13':'chest-to-bar','14-15':'chest-to-bar'}},
  {re:/\b(chest[- ]to[- ]bar(?: pull[- ]ups?)?|c2b)\b/gi,s:{'6-7':'ring rows inclinées','8-9':'ring rows','10-11':'pull-ups sautées','12-13':'pull-ups'}},
  {re:/\b(strict pull[- ]ups?|pull[- ]ups?|tractions?)\b/gi,s:{'6-7':'ring rows inclinées','8-9':'ring rows','10-11':'pull-ups sautées'}},
  {re:/\b(toes[- ]to[- ]bar|ttb)\b/gi,s:{'6-7':'hollow hold 10 s','8-9':'knee raises suspendues','10-11':'knee raises suspendues','12-13':'knees-to-elbow'}},
  {re:/\b(strict handstand push[- ]ups?|handstand push[- ]ups?|hspu)\b/gi,s:{'6-7':'push-ups au mur','8-9':'push-ups inclinés','10-11':'pike push-ups au sol','12-13':'pike push-ups sur box'}},
  {re:/\b(handstand walks?|marche en ATR)\b/gi,s:{'6-7':'brouette 10 m','8-9':'bear crawl 10 m','10-11':'wall walks','12-13':'ATR au mur 20 s'}},
  {re:/\b(wall walks?)\b/gi,s:{'6-7':'bear crawl 10 m','8-9':'bear crawl 10 m','10-11':'wall walks 3/4'}},
  {re:/\b(legless rope climbs?)\b/gi,s:{'6-7':'suspension corde 10 s','8-9':'rope pulls assis','10-11':'rope pulls assis vers debout','12-13':'rope climbs avec jambes','14-15':'rope climbs avec jambes'}},
  {re:/\b(rope climbs?|montées? de corde)\b/gi,s:{'6-7':'suspension corde 10 s','8-9':'rope pulls assis','10-11':'rope pulls assis vers debout'}},
  {re:/\b(double[- ]unders?|du)\b/gi,s:{'6-7':'single unders ×2','8-9':'single unders ×2','10-11':'single unders ×2'}},
  {re:/\b(ghd sit[- ]ups?)\b/gi,s:{'6-7':'hollow holds','8-9':'hollow rocks','10-11':'sit-ups','12-13':'sit-ups','14-15':'sit-ups ancrés'}},
  {re:/\b(pistols?|squats? sur une jambe)\b/gi,s:{'6-7':'squats au poids de corps','8-9':'squats sur box','10-11':'split squats','12-13':'pistols sur box'}},
  {re:/\b(ring dips?|dips anneaux|dips?)\b/gi,s:{'6-7':'push-ups genoux','8-9':'push-ups','10-11':'dips sur box','12-13':'dips sur box'}},
  {re:/\b(box jumps?(?: overs?)?)\b/gi,s:{'6-7':'step-ups sur box','8-9':'step-ups sur box'}},
  {re:/\b(kettlebell swings?|kb swings?)\b/gi,s:{'6-7':'KB swings russes','8-9':'KB swings russes'}}
];

/* Une paire "40/30" sans unité n'est lue comme une charge que sur une ligne
   de mouvement chargé — sinon "21-15-9" deviendrait des kilos. */
var CHARGE_LEX = /snatch|clean|jerk|thrust|deadlift|soulev|squat|press|swing|lunge|fente|carry|port[ée]|wall ?ball|dumbbell|\bdb\b|haltère|kettlebell|\bkb\b|sandbag|\bsac\b|d-?ball|worm|barre|\bbar\b|overhead|\bohs\b|sdhp|farmer|devil|hang|complex/i;

/* ======================= MOTEUR ======================= */

var M1='\u0001',M2='\u0002',L1='\u0003',L2='\u0004';
function num(s){return parseFloat(String(s).replace(',','.'));}
function nb(v){return (Math.round(v*10)/10).toString().replace('.',',');}
var SEP='\\s*[\\/\\-]\\s*';

function snap(cible,rack){
  if(cible<=rack[0])return rack[0];
  var best=rack[0];
  for(var i=0;i<rack.length;i++){if(rack[i]<=cible*1.02)best=rack[i];}
  return best;
}
function fmtLoad(v,type){return (type==='barre'&&v<=1)?'PVC':nb(v)+' kg';}
function equipOf(ligne){
  var l=ligne.toLowerCase();
  if(/wall ?ball|\bwb\b|médecine|medecine|med ?ball/.test(l))return 'wb';
  if(/dumbbell|\bdb\b|haltères?\b/.test(l))return 'db';
  if(/kettlebell|\bkb\b/.test(l))return 'kb';
  if(/sandbag|sac lesté|sac\b|\bd-?ball|worm/.test(l))return 'sac';
  return 'barre';
}
function repsOf(ligne){
  var mx=ligne.match(/(\d+)\s*[x×]\s*(\d+)/);
  if(mx)return parseInt(mx[2],10);
  if(/\b(1\s*rm|max|pr|amrap 1)\b/i.test(ligne))return 1;
  var m=ligne.match(/(?:^|\s)(\d{1,3})(?:\s*-\s*\d{1,3})*\s/);
  return m?parseInt(m[1],10):12;
}
function intensiteDe(reps,mode){
  if(mode==='metcon')return {k:1,lbl:'metcon'};
  if(mode==='lourd')return {k:0.85,lbl:'lourd'};
  if(mode==='max')return {k:0.80,lbl:'max'};
  if(reps<=2)return {k:0.80,lbl:'max'};
  if(reps<=5)return {k:0.85,lbl:'lourd'};
  return {k:1,lbl:'metcon'};
}
/* N'applique le remplacement qu'en dehors des valeurs déjà converties. */
function safe(str,re,fn){
  return str.split(/(\u0003[^\u0004]*\u0004)/).map(function(seg){
    return seg.charAt(0)===L1?seg:seg.replace(re,fn);
  }).join('');
}
/* Idem pour les mouvements déjà substitués : évite "pull-ups sautées sautées". */
function safeSub(str,re,fn){
  return str.split(/(\u0001[^\u0002]*\u0002)/).map(function(seg){
    return seg.charAt(0)===M1?seg:seg.replace(re,fn);
  }).join('');
}
function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function brut(t){return t.split(M1).join('').split(M2).join('').split(L1).join('').split(L2).join('');}

/* Nettoie le HTML éventuel du champ content (l'éditeur accepte du <br>). */
function enTexte(html){
  if(!/<[a-z][\s\S]*>/i.test(html))return String(html||'');
  var d=document.createElement('div');
  d.innerHTML=String(html).replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li)>/gi,'\n');
  return (d.textContent||'').replace(/\n{3,}/g,'\n\n').trim();
}

function profil(categorieId,niveauId){
  var i=-1;
  for(var j=0;j<CATS.length;j++){if(CATS[j].id===categorieId){i=j;break;}}
  if(i<0)return null;
  var v=null;
  for(var n=0;n<NIVEAUX.length;n++){if(NIVEAUX[n].id===niveauId)v=NIVEAUX[n];}
  if(!v)return null;
  var cat=CATS[i], ref=CATS[Math.max(0,i-v.shift)];
  /* 14-15 et 16-17 en RX/Inter gardent la gymnastique adulte : c'est la règle
     des divisions officielles, où seule la charge baisse. */
  var gymId=(cat.officiel&&v.shift===0)?CATS[CATS.length-1].id:ref.id;
  return {categorie:cat,niveau:v,k:cat.k*v.k,kvol:cat.kvol,gymId:gymId,
          box:ref.box,cible:ref.cible,jeune:JEUNES.indexOf(cat.id)>=0};
}

/**
 * Convertit un WOD adulte pour une catégorie et un niveau.
 * @returns {{texte,html,flags,k,box,cible,categorie,niveau}}
 */
function scaleWod(texte,o){
  var p=profil(o.categorie,o.niveau);
  if(!p)return null;
  var opts={
    intensite:o.intensite||'auto',
    volume:o.volume!==false,
    gym:o.gym!==false,
    reps:!!o.reps
  };
  var flags={};

  var lignes=String(texte||'').split('\n').map(function(ligne){
    if(!ligne.trim())return ligne;
    var l=ligne;

    l=l.replace(/♀\s*(\d+(?:[.,]\d+)?)\s*(?:kg|lb)?\s*[\/|,•·–—-]?\s*♂\s*(\d+(?:[.,]\d+)?)\s*(kg|lb)/gi,function(m,f,h,u){return h+'/'+f+' '+u;});
    l=l.replace(/♂\s*(\d+(?:[.,]\d+)?)\s*(?:kg|lb)?\s*[\/|,•·–—-]?\s*♀\s*(\d+(?:[.,]\d+)?)\s*(kg|lb)/gi,function(m,h,f,u){return h+'/'+f+' '+u;});

    var equip=equipOf(l), rack=RACKS[equip]||RACKS.barre;
    var inten=intensiteDe(repsOf(l),opts.intensite);
    if(inten.lbl==='max'&&p.jeune)flags.max=true;
    var kInt=inten.lbl==='metcon'?1:(p.jeune?0.85:inten.k);
    var k=p.k*kInt;

    /* Cible wall ball — avant les distances, sinon "cible 3 m" est lue comme une distance */
    if(equip==='wb'){
      if(/cible/i.test(l))l=safe(l,/cible\s*\d+(?:[.,]\d+)?\s*m/gi,L1+'cible '+nb(p.cible)+' m'+L2);
      else l=l.replace(/\s*$/,' '+L1+'(cible '+nb(p.cible)+' m)'+L2);
    }

    /* Calories — premier nombre ♂, second ♀ ; valeur unique : ♀ = ♂ −20 % */
    var kv=opts.volume?p.kvol:1;
    var cal=function(v){return Math.max(3,Math.round(num(v)*kv));};
    l=safe(l,new RegExp('(\\d+)'+SEP+'(\\d+)\\s*(?:cal|calories?)\\b','gi'),function(m,a,b){return L1+cal(a)+'/'+cal(b)+' cal'+L2;});
    l=safe(l,/(\d+)\s*(?:cal|calories?)\b/gi,function(m,a){return L1+cal(a)+'/'+cal(num(a)*RATIO_CAL)+' cal'+L2;});

    /* Distances */
    if(opts.volume&&p.kvol<1){
      var dist=function(v){return Math.max(10,Math.round((num(v)*p.kvol)/10)*10);};
      l=safe(l,new RegExp('(\\d+)'+SEP+'(\\d+)\\s*m(?![a-zà-ÿ])','gi'),function(m,a,b){return L1+dist(a)+'/'+dist(b)+' m'+L2;});
      l=safe(l,/(\d+)\s*m(?![a-zà-ÿ])/gi,function(m,a){return L1+dist(a)+' m'+L2;});
    }

    /* Hauteur de box */
    if(/box|step[- ]?up/i.test(l)){
      l=safe(l,new RegExp('(\\d+(?:[.,]\\d+)?)'+SEP+'(\\d+(?:[.,]\\d+)?)\\s*(cm|")','gi'),function(m,a,b,u){
        var c=/"/.test(u)?2.54:1;
        return L1+Math.max(15,Math.round((p.box[0]*num(a)*c/60)/5)*5)+'/'+Math.max(15,Math.round((p.box[1]*num(b)*c/50)/5)*5)+' cm'+L2;
      });
      l=safe(l,/(\d+(?:[.,]\d+)?)\s*(cm|")/gi,function(m,a,u){
        var r=num(a)*(/"/.test(u)?2.54:1)/60;
        var h=Math.max(15,Math.round((p.box[0]*r)/5)*5), f=Math.max(15,Math.round((p.box[1]*r)/5)*5);
        return L1+(h===f?h+' cm':h+'/'+f+' cm')+L2;
      });
    }

    /* Charges — premier nombre ♂, second ♀, même coefficient pour les deux */
    var conv=function(v,u){return snap(num(v)*(/lb/i.test(u)?0.4536:1)*k,rack);};
    var paire=function(nh,nf){return L1+'♂/♀ '+(nh===nf?fmtLoad(nh,equip):fmtLoad(nh,equip)+' / '+fmtLoad(nf,equip))+L2;};

    l=safe(l,new RegExp('(?:[♀♂]\\s*)?(\\d+(?:[.,]\\d+)?)'+SEP+'(\\d+(?:[.,]\\d+)?)\\s*(kgs?|lbs?)\\b','gi'),
      function(m,a,b,u){return paire(conv(a,u),conv(b,u));});

    l=safe(l,/([♀♂]\s*)?(\d+(?:[.,]\d+)?)\s*(kgs?|lbs?)\b/gi,function(m,g,a,u){
      var base=num(a)*(/lb/i.test(u)?0.4536:1);
      var refH=(g&&g.indexOf('♀')>=0)?base/RATIO_CHARGE:base;
      return paire(snap(refH*k,rack),snap(refH*RATIO_CHARGE*k,rack));
    });

    if(CHARGE_LEX.test(l)){
      l=safe(l,/(^|[^\d.,\/])(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)(?![\d.,\/])/g,function(m,pre,a,b){
        return pre+paire(snap(num(a)*k,rack),snap(num(b)*k,rack));
      });
    }

    /* Time cap */
    if(opts.volume&&p.kvol<1){
      l=safe(l,/((?:TC|time ?cap|cap)\s*:?\s*)(\d+)(\s*(?:min|'))/gi,function(m,pre,v,suf){
        return pre+L1+Math.max(4,Math.round(num(v)*p.kvol))+L2+suf;
      });
    }

    /* Répétitions — approximatif, désactivé par défaut */
    if(opts.reps&&p.kvol<1){
      if(/^\s*\d{1,3}(\s*-\s*\d{1,3})+\s*$/.test(l)){
        l=safe(l,/\d{1,3}/g,function(v){return L1+Math.max(3,Math.round(num(v)*p.kvol))+L2;});
      }else{
        l=safe(l,/^(\s*)(\d{1,3})(\s+)(?=[A-Za-zÀ-ÿ])/,function(m,sp,v,sp2){
          return sp+L1+Math.max(3,Math.round(num(v)*p.kvol))+L2+sp2;
        });
      }
    }

    /* Substitutions gymniques */
    if(opts.gym){
      for(var i=0;i<GYM.length;i++){
        var sub=GYM[i].s[p.gymId];
        if(!sub)continue;
        GYM[i].re.lastIndex=0;
        l=safeSub(l,GYM[i].re,(function(x){return function(){return M1+x+M2;};})(sub));
      }
    }
    return l;
  });

  var marque=lignes.join('\n');
  return {
    texte:brut(marque),
    html:escapeHtml(marque)
      .split(M1).join('<mark class="udtk-sub">').split(M2).join('</mark>')
      .split(L1).join('<b class="udtk-load">').split(L2).join('</b>')
      .replace(/\n/g,'<br>'),
    flags:flags, k:p.k, box:p.box, cible:p.cible,
    categorie:p.categorie, niveau:p.niveau
  };
}

/* ======================= AFFICHAGE ======================= */

var STYLE_ID='udtk-style';
var CSS=
'.udtk{margin-top:14px;border-top:1px solid var(--border,rgba(255,255,255,.1));padding-top:12px}'+
'.udtk-head{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}'+
'.udtk-titre{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--accent,#2dd4bf)}'+
'.udtk-tabs{display:flex;margin-left:auto;border:1px solid var(--border,rgba(255,255,255,.18));border-radius:8px;overflow:hidden}'+
'.udtk-tabs button{font:inherit;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:6px 12px;background:transparent;color:var(--muted,#8b949e);border:0;border-right:1px solid var(--border,rgba(255,255,255,.18));cursor:pointer}'+
'.udtk-tabs button:last-child{border-right:0}'+
'.udtk-tabs button.on{background:var(--accent,#2dd4bf);color:#0b1512}'+
'.udtk-legende{font-size:11px;color:var(--muted,#8b949e);margin:0 0 10px}'+
'.udtk-grid{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}'+
'.udtk-bloc{background:var(--card2,rgba(255,255,255,.03));border:1px solid var(--border,rgba(255,255,255,.1));border-left:3px solid var(--accent,#2dd4bf);border-radius:8px;padding:10px 12px;min-width:0}'+
'.udtk-bloc.officiel{border-left-color:var(--blue,#58a6ff)}'+
'.udtk-bloc-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px;flex-wrap:wrap}'+
'.udtk-age{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.02em}'+
'.udtk-meta{font-size:10px;color:var(--muted,#8b949e);font-variant-numeric:tabular-nums}'+
'.udtk-wod{font-size:12px;line-height:1.65;word-break:break-word}'+
'.udtk-load{font-weight:800}'+
'.udtk-sub{background:rgba(45,212,191,.15);color:var(--accent,#2dd4bf);padding:0 3px;border-radius:3px;font-weight:700}'+
'.udtk-note{font-size:10.5px;color:var(--muted,#8b949e);margin-top:7px;line-height:1.5}'+
'.udtk-alerte{display:block;color:var(--red,#f85149);margin-bottom:4px}';

function injecterStyle(){
  if(document.getElementById(STYLE_ID))return;
  var st=document.createElement('style');
  st.id=STYLE_ID; st.textContent=CSS;
  document.head.appendChild(st);
}

/* Construit le bloc Kids pour une séance. Rend '' si rien à convertir. */
function blocKids(s,niveauId){
  var niveau=null;
  for(var i=0;i<NIVEAUX.length;i++){if(NIVEAUX[i].id===niveauId)niveau=NIVEAUX[i];}
  if(!niveau)niveau=NIVEAUX[0];

  /* Le texte de départ est la colonne du niveau si elle est remplie,
     sinon on retombe sur le content RX adulte. */
  var brutTexte=enTexte(s[niveau.source]||s.content||'');
  if(!brutTexte.trim())return '';

  var tabs='', g='';
  for(var t=0;t<NIVEAUX.length;t++){
    var n=NIVEAUX[t];
    tabs+='<button type="button" class="'+(n.id===niveau.id?'on':'')+
          '" data-udtk-niveau="'+n.id+'" data-udtk-sid="'+s.id+'">'+n.nom+'</button>';
  }
  for(var c=0;c<CATS.length;c++){
    var r=scaleWod(brutTexte,{categorie:CATS[c].id,niveau:niveau.id});
    if(!r)continue;
    var cat=r.categorie;
    g+='<div class="udtk-bloc'+(cat.officiel?' officiel':'')+'">'+
         '<div class="udtk-bloc-head"><span class="udtk-age">'+cat.nom+'</span>'+
         '<span class="udtk-meta">coef '+r.k.toFixed(2)+' · box '+r.box[0]+'/'+r.box[1]+' cm</span></div>'+
         '<div class="udtk-wod">'+r.html+'</div>'+
         '<div class="udtk-note">'+
           (r.flags.max?'<span class="udtk-alerte">Charge proche du max : plancher ramené à 3 répétitions.</span>':'')+
           (cat.alerte?'<span class="udtk-alerte">'+cat.alerte+'</span>':'')+
           cat.note+
         '</div>'+
       '</div>';
  }
  return '<div class="udtk" data-udtk-card="'+s.id+'">'+
    '<div class="udtk-head"><span class="udtk-titre">Kids &amp; Teens</span>'+
      '<div class="udtk-tabs">'+tabs+'</div></div>'+
    '<p class="udtk-legende">'+niveau.legende+'</p>'+
    '<div class="udtk-grid">'+g+'</div></div>';
}

/* Cache des séances rendues, pour re-rendre au changement d'onglet. */
var CACHE={};

function concerne(s){
  if(!s||!s.id)return false;
  if(!s.programme_id)return false;
  var prog=null;
  try{if(typeof getProgById==='function')prog=getProgById(s.programme_id);}catch(e){}
  if(!prog)return false;
  var slug=(prog.slug||'').toLowerCase(), nom=(prog.name||'').toLowerCase();
  for(var i=0;i<PROGS.length;i++){
    if(slug.indexOf(PROGS[i])>=0||nom.indexOf(PROGS[i])>=0)return true;
  }
  return false;
}

/* Changement d'onglet : délégation globale, pose une seule fois. */
document.addEventListener('click',function(e){
  var b=e.target.closest?e.target.closest('[data-udtk-niveau]'):null;
  if(!b)return;
  e.preventDefault(); e.stopPropagation();
  var sid=b.getAttribute('data-udtk-sid'), niv=b.getAttribute('data-udtk-niveau');
  var s=CACHE[sid]; if(!s)return;
  var hote=document.querySelector('[data-udtk-card="'+sid+'"]');
  if(!hote)return;
  var neuf=document.createElement('div');
  neuf.innerHTML=blocKids(s,niv);
  if(neuf.firstElementChild)hote.replaceWith(neuf.firstElementChild);
},true);

/* ======================= PATCH ======================= */

if(!window.__patchBound_kidsScaling){
  window.__patchBound_kidsScaling=true;

  function brancher(){
    if(typeof window.buildSessionCard!=='function')return false;
    var orig=window.buildSessionCard;
    window.buildSessionCard=async function(s){
      var html=await orig.apply(this,arguments);
      try{
        if(concerne(s)){
          CACHE[s.id]=s;
          injecterStyle();
          var bloc=blocKids(s,'rx');
          if(bloc)html=html+bloc;
        }
      }catch(err){
        if(window.console)console.warn('[kids-scaling]',err);
      }
      return html;
    };
    return true;
  }

  if(!brancher()){
    /* planning.js pas encore chargé : on réessaie au prochain tick, puis au ready. */
    var essais=0;
    var t=setInterval(function(){
      if(brancher()||++essais>40)clearInterval(t);
    },100);
    document.addEventListener('studio:ready',brancher);
  }
}

/* Exposé pour réglage à chaud depuis la console ou un autre script. */
window.UDTKids={scaleWod:scaleWod,profil:profil,blocKids:blocKids,
  CATS:CATS,NIVEAUX:NIVEAUX,RACKS:RACKS,GYM:GYM,PROGS:PROGS};

})();
