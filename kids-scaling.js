/* ============================================================================
 * kids-scaling.js — Scaling Kids & Teens pour Upside Down Training
 * ----------------------------------------------------------------------------
 * Convertit un WOD adulte en versions Kids/Teens, par tranche d'âge et par
 * niveau (RX / Inter / Scaled), et les affiche sous le bloc WOD existant.
 *
 * POSE : une ligne dans index.html, APRÈS wellness.js
 *     <script src="kids-scaling.js?v=20261027a"></script>
 *
 * Script classique, aucune dépendance. Ne modifie ni admin.js, ni planning.js,
 * ni outils.js : enveloppe buildSessionCard() et s'injecte dans la grille Outils.
 *
 * DEUX AXES INDÉPENDANTS
 *   · l'ÂGE pilote la CHARGE          (coefficients 0,21 → 1,00)
 *   · le BARREAU pilote le MOUVEMENT  (échelle de difficulté par mouvement)
 *   La grille âge × niveau fait le lien entre les deux.
 *
 * TROIS VOIES par mouvement : technique, volume, force. La voie est déduite du
 * type de séance, et peut être forcée séance par séance.
 *
 * Réglages persistés dans la table `kids_scaling_config` (ligne unique),
 * retouches manuelles dans la colonne `kids` de sessions / personal_sessions.
 * ========================================================================== */
(function(){
'use strict';

/* ========================= CONFIG ========================= */

/* Programmes où le bloc s'affiche. La prog Training reste intacte. */
var PROGS = ['kids'];

/* Ratios ♂/♀ : −30 % sur les charges, −20 % sur les calories. */
var RATIO_CHARGE = 0.70, RATIO_CAL = 0.80;

/* Tranches d'âge — pilotent la CHARGE uniquement.
   14-15 et 16-17 = coefficients officiels CrossFit Games ; 6-13 = extrapolation. */
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

/* Niveaux. Le shift ne touche plus la gymnastique (gérée par la grille),
   seulement la box et la cible wall ball. */
var NIVEAUX = [
  {id:'rx',nom:'RX',k:1,shift:0,source:'content',
   legende:"Coefficient plein de la catégorie."},
  {id:'inter',nom:'Inter',k:0.85,shift:0,source:'scaling_inter',
   legende:"Charges allégées de 15 %, un barreau en dessous sur les mouvements."},
  {id:'scaled',nom:'Scaled',k:0.65,shift:1,source:'scaling_scaled',
   legende:"Charges allégées de 35 %, box et cible descendues d'un cran."}
];

/* GRILLE âge × niveau → barreau de l'échelle (1 = le plus facile, 6 = mouvement adulte).
   C'est ici que l'âge et le niveau se rejoignent pour choisir le mouvement. */
var GRILLE = {
  '6-7':   {rx:2, inter:1, scaled:1},
  '8-9':   {rx:3, inter:2, scaled:1},
  '10-11': {rx:4, inter:3, scaled:2},
  '12-13': {rx:5, inter:4, scaled:3},
  '14-15': {rx:6, inter:5, scaled:4},
  '16-17': {rx:6, inter:5, scaled:4}
};
var NB_BARREAUX = 6;

/* Les trois voies de progression. */
var VOIES = [
  {id:'technique', nom:'Technique', desc:"Vers l'apprentissage du mouvement : amplitude, contrôle, étapes du geste."},
  {id:'volume',    nom:'Volume',    desc:"Vers un mouvement cyclable : on garde le stimulus cardio, on baisse l'exigence technique."},
  {id:'force',     nom:'Force',     desc:"Vers le strict et le lesté : moins de répétitions, plus de tension."}
];

/* Type de séance → voie par défaut. Forçable séance par séance. */
var VOIE_PAR_TYPE = {
  wod:'volume', engine:'volume', run:'volume',
  gymnastics:'technique', skill:'technique', warmup:'technique', mobility:'technique',
  strength:'force', weightlifting:'force', renforcement:'force', bodybuilding:'force'
};

/* Régime de charge selon le type de séance.
   'auto' = déduit des répétitions · metcon = plein · lourd = −15 % · max = −20 %. */
var REGIMES = {
  wod:'metcon', strength:'lourd', weightlifting:'max', gymnastics:'metcon',
  renforcement:'lourd', bodybuilding:'lourd', skill:'metcon', warmup:'metcon',
  mobility:'metcon', engine:'metcon', run:'metcon'
};

/* Matériel disponible — à remplacer par l'inventaire réel du club. */
var RACKS = {
  barre:[1,5,7.5,10,12.5,15,17.5,20,22.5,25,27.5,30,32.5,35,37.5,40,42.5,45,47.5,50,52.5,55,57.5,60,65,70,75,80,85,90,95,100,105,110,120,130,140,150],
  db:[2,3,4,5,6,7.5,8,9,10,12,12.5,14,15,16,17.5,18,20,22.5,25,27.5,30,32.5,35,40],
  kb:[4,6,8,10,12,16,20,24,28,32],
  wb:[2,3,4,5,6,7,9,10,12],
  sac:[5,10,15,20,25,30,35,40,50,60,70]
};

/* ÉCHELLES. Pour chaque mouvement et chaque voie, 6 barreaux du plus facile
   au plus dur. Un barreau vide = mouvement d'origine conservé. */
var ECHELLES = [
{id:'ring-mu',nom:'Ring muscle-up',re:/\b(ring muscle[- ]ups?|muscle[- ]ups? anneaux)\b/gi,v:{
  technique:['ring rows inclinées + push-ups genoux','ring rows + push-ups','transitions assises aux anneaux','ring rows en false grip','low ring muscle-ups',''],
  volume:['ring rows inclinées + push-ups genoux','ring rows + push-ups sur box','pull-ups sautées + dips sur box','pull-ups + dips sur box','chest-to-bar + dips anneaux',''],
  force:['ring rows + push-ups','ring rows lestées + dips sur box','pull-ups strictes + dips strictes','chest-to-bar strictes + dips anneaux','muscle-ups stricts assistés','']}},
{id:'bar-mu',nom:'Bar muscle-up',re:/\b(bar muscle[- ]ups?|muscle[- ]ups?)\b/gi,v:{
  technique:['ring rows inclinées','ring rows','kip swings','pull-ups poitrine haute','transitions sur box',''],
  volume:['ring rows inclinées','ring rows','pull-ups sautées','pull-ups','chest-to-bar',''],
  force:['ring rows','pull-ups strictes','chest-to-bar strictes','pull-ups strictes lestées','bar muscle-ups stricts assistés','']}},
{id:'c2b',nom:'Chest-to-bar',re:/\b(chest[- ]to[- ]bar(?: pull[- ]ups?)?|c2b)\b/gi,v:{
  technique:['ring rows inclinées','ring rows','pull-ups strictes assistées','pull-ups strictes','chest-to-bar assistées',''],
  volume:['ring rows inclinées','ring rows','pull-ups sautées','pull-ups','chest-to-bar assistées',''],
  force:['ring rows','ring rows lestées','pull-ups négatives 5 s','pull-ups strictes','chest-to-bar strictes','']}},
{id:'pull-up',nom:'Pull-up / traction',re:/\b(strict pull[- ]ups?|pull[- ]ups?|tractions?)\b/gi,v:{
  technique:['ring rows inclinées','ring rows','pull-ups négatives 3 s','pull-ups strictes à l\'élastique','pull-ups strictes',''],
  volume:['ring rows inclinées','ring rows','pull-ups sautées','pull-ups à l\'élastique','pull-ups',''],
  force:['ring rows','ring rows lestées','pull-ups négatives 5 s','pull-ups strictes','pull-ups strictes lestées','']}},
{id:'ttb',nom:'Toes-to-bar',re:/\b(toes[- ]to[- ]bar|ttb)\b/gi,v:{
  technique:['hollow holds 10 s','hollow rocks','knee raises contrôlées','kip swings + knee raises','toes-to-bar strictes',''],
  volume:['hollow holds 10 s','knee raises suspendues','knees-to-elbow','toes-to-bar alternées','toes-to-bar',''],
  force:['hollow holds 20 s','knee raises strictes','knees-to-elbow strictes','toes-to-bar strictes','toes-to-bar strictes lestées','']}},
{id:'hspu',nom:'Handstand push-up',re:/\b(strict handstand push[- ]ups?|handstand push[- ]ups?|hspu)\b/gi,v:{
  technique:['push-ups au mur','push-ups inclinés','ATR au mur 20 s','pike push-ups sur box','HSPU négatifs',''],
  volume:['push-ups au mur','push-ups inclinés','push-ups','pike push-ups au sol','pike push-ups sur box',''],
  force:['push-ups inclinés','push-ups','pike push-ups sur box','HSPU négatifs 5 s','HSPU stricts assistés','']}},
{id:'hs-walk',nom:'Handstand walk',re:/\b(handstand walks?|marche en ATR)\b/gi,v:{
  technique:['brouette 10 m','bear crawl 10 m','wall walks','ATR au mur 30 s','shoulder taps en ATR',''],
  volume:['brouette 10 m','bear crawl 10 m','wall walks','ATR au mur 20 s','handstand walk assisté',''],
  force:['bear crawl lesté','wall walks','ATR au mur 30 s','shoulder taps en ATR','handstand walk court','']}},
{id:'wall-walk',nom:'Wall walk',re:/\b(wall walks?)\b/gi,v:{
  technique:['bear crawl 10 m','planche pieds surélevés','wall walks 1/2','wall walks 3/4','wall walks + hold 10 s',''],
  volume:['bear crawl 10 m','bear crawl 15 m','wall walks 1/2','wall walks 3/4','wall walks',''],
  force:['planche lestée','wall walks 1/2','wall walks','wall walks + hold 10 s','wall walks lestés','']}},
{id:'rope-legless',nom:'Corde sans jambes',re:/\b(legless rope climbs?)\b/gi,v:{
  technique:['rope pulls assis','prises de jambes au sol','montées 1/2 corde avec jambes','montées avec jambes','montées sans jambes 1/2',''],
  volume:['rope pulls assis','montées 1/2 corde avec jambes','montées avec jambes','montées sans jambes 1/2','montées sans jambes',''],
  force:['rope pulls assis lestés','montées avec jambes','montées sans jambes 1/2','montées sans jambes','montées sans jambes lestées','']}},
{id:'rope',nom:'Montée de corde',re:/\b(rope climbs?|montées? de corde)\b/gi,v:{
  technique:['suspensions corde 10 s','rope pulls assis','prises de jambes au sol','montées 1/2 corde avec jambes','montées avec jambes',''],
  volume:['suspensions corde 10 s','rope pulls assis','rope pulls assis vers debout','montées 1/2 corde','montées avec jambes',''],
  force:['suspensions corde 20 s','rope pulls assis lestés','montées avec jambes','montées sans jambes 1/2','montées sans jambes','']}},
{id:'du',nom:'Double-unders',re:/\b(double[- ]unders?|du)\b/gi,v:{
  technique:['sauts à la corde réguliers','penguin jumps','single-double alternés','double-unders par 5','double-unders',''],
  volume:['single unders ×2','single unders ×2','single-double alternés','double-unders par 5','double-unders',''],
  force:['sauts à la corde lestés','single unders ×2','single-double alternés','double-unders','double-unders à la corde lourde','']}},
{id:'ghd',nom:'GHD sit-up',re:/\b(ghd sit[- ]ups?)\b/gi,v:{
  technique:['hollow holds','hollow rocks','sit-ups ancrés','GHD amplitude réduite','GHD contrôlés',''],
  volume:['hollow holds','hollow rocks','sit-ups','sit-ups ancrés','GHD amplitude réduite',''],
  force:['hollow holds lestés','sit-ups lestés','GHD amplitude réduite','GHD complets','GHD lestés','']}},
{id:'pistol',nom:'Pistol',re:/\b(pistols?|squats? sur une jambe)\b/gi,v:{
  technique:['squats au poids de corps','squats sur box','split squats','pistols sur box haute','pistols à l\'élastique',''],
  volume:['squats au poids de corps','squats sur box','split squats','pistols sur box','pistols alternés',''],
  force:['split squats','split squats bulgares lestés','pistols sur box','pistols','pistols lestés','']}},
{id:'dips',nom:'Dips',re:/\b(ring dips?|dips anneaux|dips?)\b/gi,v:{
  technique:['push-ups genoux','push-ups','dips sur box','dips négatifs','dips aux anneaux assistés',''],
  volume:['push-ups genoux','push-ups','dips sur box','dips aux barres','dips aux anneaux assistés',''],
  force:['push-ups','dips sur box','dips aux barres','dips aux anneaux','dips lestés','']}},
{id:'box-jump',nom:'Box jump',re:/\b(box jumps?(?: overs?)?)\b/gi,v:{
  technique:['step-ups sur box','sauts pieds joints au sol','box jumps bas réception contrôlée','box jumps','box jump overs',''],
  volume:['step-ups sur box','step-ups rapides','box jumps bas','box jumps','box jump overs',''],
  force:['step-ups lestés','step-ups sautés','box jumps bas','box jumps','box jumps lestés','']}},
{id:'kb-swing',nom:'Kettlebell swing',re:/\b(kettlebell swings?|kb swings?)\b/gi,v:{
  technique:['hip hinge au bâton','deadlifts KB','KB swings russes','KB swings américains 3/4','KB swings américains',''],
  volume:['deadlifts KB','KB swings russes','KB swings russes rapides','KB swings américains 3/4','KB swings américains',''],
  force:['deadlifts KB lourds','KB swings russes lourds','KB swings américains','KB swings lourds','KB swings lourds','']}}
];

/* Une paire "40/30" sans unité n'est lue comme une charge que sur une ligne
   de mouvement chargé — sinon "21-15-9" deviendrait des kilos. */
var CHARGE_LEX = /snatch|clean|jerk|thrust|deadlift|soulev|squat|press|swing|lunge|fente|carry|port[ée]|wall ?ball|dumb+ell|\bdb\b|haltère|kettlebell|\bkb\b|sandbag|\bsac\b|d-?ball|worm|barre|\bbar\b|overhead|\bohs\b|sdhp|farmer|devil|hang|complex|\b\d\s*[x×]\s*\d/i;

/* Valeurs d'usine, pour le bouton « Rétablir » du panneau Outils. */
var USINE = JSON.parse(JSON.stringify({
  cats:(function(){var o={};for(var i=0;i<CATS.length;i++)o[CATS[i].id]=CATS[i].k;return o;})(),
  niveaux:(function(){var o={};for(var i=0;i<NIVEAUX.length;i++)o[NIVEAUX[i].id]=NIVEAUX[i].k;return o;})(),
  regimes:REGIMES, voies:VOIE_PAR_TYPE, grille:GRILLE,
  echelles:(function(){var o={};for(var i=0;i<ECHELLES.length;i++)o[ECHELLES[i].id]=ECHELLES[i].v;return o;})()
}));

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
/* Mots qui désignent franchement un travail à la barre. Sert de garde-fou :
   sans eux, une charge légère ne doit pas devenir « PVC ». */
var BARRE_LEX=/barre|barbell|snatch|clean|jerk|thruster|deadlift|soulev|squat|press|overhead squat|\bohs\b|complex|\bbar\b/i;

function equipOf(ligne){
  var l=ligne.toLowerCase();
  /* Mots explicites d'abord : ils l'emportent toujours. */
  if(/wall ?ball|\bwb\b|médecine|medecine|med ?ball/.test(l))return 'wb';
  if(/kettlebell|\bkb\b/.test(l))return 'kb';
  if(/sandbag|sac lesté|sac\b|\bd-?ball|worm/.test(l))return 'sac';
  if(/dumb+ell|\bdb\b|haltères?\b|devil press/.test(l))return 'db';
  /* « 2x 22.5/15 » sans engin nommé = une paire d'haltères : c'est la
     convention d'écriture de la prog. La ligne peut dire OVERHEAD LUNGE
     ou FARMER LUNGE sans jamais nommer l'haltère. */
  if(/\b\d\s*[x×]\s*\d/.test(l)||/farmer/.test(l))return 'db';
  /* Rien d'explicite et aucun mot de barre : on évite le rack barre, sinon une
     charge d'enfant tombe sur le PVC alors que c'est du travail à l'haltère. */
  if(!BARRE_LEX.test(l))return 'db';
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
function safe(str,re,fn){
  return str.split(/(\u0003[^\u0004]*\u0004)/).map(function(seg){
    return seg.charAt(0)===L1?seg:seg.replace(re,fn);
  }).join('');
}
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

/* Texte de départ d'un niveau.
   Les champs scaling_inter / scaling_scaled sont tantôt une variante complète
   du WOD (« 1 WALLWALK + 1 à 3 PIKE PUSH UP / 12 TOES TO BAR… »), tantôt une
   simple note de charge (« 2x 17.5/12.5 »). On ne s'en sert que dans le premier
   cas : une note seule ne contient pas de WOD à convertir. */
function texteSource(s,niveau){
  var contenu=enTexte(s.content||'');
  if(niveau.source==='content')return contenu;
  var alt=enTexte(s[niveau.source]||'');
  if(!alt.trim())return contenu;
  var lignes=alt.split('\n').filter(function(x){return x.trim();});
  var complet=(lignes.length>=2&&alt.replace(/\s+/g,' ').trim().length>=40);
  return complet?alt:contenu;
}

/* Barreau retenu pour une tranche d'âge et un niveau. */
function barreau(catId,nivId){
  var g=GRILLE[catId];
  var b=g&&g[nivId];
  return (typeof b==='number'&&b>=1)?b:NB_BARREAUX;
}
/* Texte de remplacement d'un mouvement, ou null si on garde l'original. */
function marche(ech,voieId,b){
  var echelle=(ech.v&&ech.v[voieId])||(ech.v&&ech.v.volume)||[];
  if(b>=NB_BARREAUX)return null;
  var t=echelle[b-1];
  return (t&&String(t).trim())?String(t).trim():null;
}

function profil(categorieId,niveauId){
  var i=-1;
  for(var j=0;j<CATS.length;j++){if(CATS[j].id===categorieId){i=j;break;}}
  if(i<0)return null;
  var v=null;
  for(var n=0;n<NIVEAUX.length;n++){if(NIVEAUX[n].id===niveauId)v=NIVEAUX[n];}
  if(!v)return null;
  var cat=CATS[i], ref=CATS[Math.max(0,i-v.shift)];
  return {categorie:cat,niveau:v,k:cat.k*v.k,kvol:cat.kvol,
          barreau:barreau(cat.id,v.id),box:ref.box,cible:ref.cible,
          jeune:JEUNES.indexOf(cat.id)>=0};
}

/**
 * Convertit un WOD adulte pour une catégorie et un niveau.
 * o.voie : 'technique' | 'volume' | 'force'
 */
function scaleWod(texte,o){
  var p=profil(o.categorie,o.niveau);
  if(!p)return null;
  var voie=o.voie||'volume';
  var opts={intensite:o.intensite||'auto',volume:o.volume!==false,
            gym:o.gym!==false,reps:!!o.reps};
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

    /* Cible wall ball — avant les distances */
    if(equip==='wb'){
      if(/cible/i.test(l))l=safe(l,/cible\s*\d+(?:[.,]\d+)?\s*m/gi,L1+'cible '+nb(p.cible)+' m'+L2);
      else if(p.cible<3)l=l.replace(/\s*$/,' '+L1+'(cible '+nb(p.cible)+' m)'+L2);
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

    /* Charges. À coefficient 1,00 la valeur écrite est conservée telle quelle. */
    var exact=(k===1);
    var conv=function(v,u){
      var val=num(v)*(/lb/i.test(u)?0.4536:1)*k;
      return exact?val:snap(val,rack);
    };
    var paire=function(nh,nf){return L1+'♂/♀ '+(nh===nf?fmtLoad(nh,equip):fmtLoad(nh,equip)+' / '+fmtLoad(nf,equip))+L2;};

    l=safe(l,new RegExp('(?:[♀♂]\\s*)?(\\d+(?:[.,]\\d+)?)'+SEP+'(\\d+(?:[.,]\\d+)?)\\s*(kgs?|lbs?)\\b','gi'),
      function(m,a,b,u){return paire(conv(a,u),conv(b,u));});

    l=safe(l,/([♀♂]\s*)?(\d+(?:[.,]\d+)?)\s*(kgs?|lbs?)\b/gi,function(m,g,a,u){
      var base=num(a)*(/lb/i.test(u)?0.4536:1);
      var refH=(g&&g.indexOf('♀')>=0)?base/RATIO_CHARGE:base;
      return paire(exact?refH*k:snap(refH*k,rack),snap(refH*RATIO_CHARGE*k,rack));
    });

    if(CHARGE_LEX.test(l)){
      l=safe(l,/(^|[^\d.,\/])(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)(?![\d.,\/])/g,function(m,pre,a,b){
        return pre+paire(exact?num(a)*k:snap(num(a)*k,rack),exact?num(b)*k:snap(num(b)*k,rack));
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

    /* Mouvements : barreau de l'échelle, dans la voie retenue */
    if(opts.gym){
      for(var i=0;i<ECHELLES.length;i++){
        var sub=marche(ECHELLES[i],voie,p.barreau);
        if(!sub)continue;
        ECHELLES[i].re.lastIndex=0;
        l=safeSub(l,ECHELLES[i].re,(function(x){return function(){return M1+x+M2;};})(sub));
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
    flags:flags, k:p.k, barreau:p.barreau, box:p.box, cible:p.cible,
    categorie:p.categorie, niveau:p.niveau, voie:voie
  };
}

/* ======================= AFFICHAGE ======================= */

var STYLE_ID='udtk-style';
var CSS=
'.udtk{margin-top:14px;border-top:1px solid var(--border,rgba(255,255,255,.1));padding-top:12px}'+
'.udtk-head{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}'+
'.udtk-titre{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--accent,#2dd4bf)}'+
'.udtk-tabs{display:flex;margin-left:auto;border:1px solid var(--border,rgba(255,255,255,.18));border-radius:8px;overflow:hidden}'+
'.udtk-tabs button{font:inherit;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:6px 12px;background:transparent;color:var(--muted,#8b949e);border:0;border-right:1px solid var(--border,rgba(255,255,255,.18));cursor:pointer}'+
'.udtk-tabs button:last-child{border-right:0}'+
'.udtk-tabs button.on{background:var(--accent,#2dd4bf);color:#0b1512}'+
'.udtk-voie{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted,#8b949e);margin-bottom:8px;flex-wrap:wrap}'+
'.udtk-voie select{font:inherit;font-size:11px;padding:4px 7px;background:var(--card2,rgba(255,255,255,.05));color:var(--text,#e6edf3);border:1px solid var(--border,rgba(255,255,255,.18));border-radius:7px}'+
'.udtk-legende{font-size:11px;color:var(--muted,#8b949e);margin:0 0 10px}'+
'.udtk-grid{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}'+
'.udtk-bloc{background:var(--card2,rgba(255,255,255,.03));border:1px solid var(--border,rgba(255,255,255,.1));border-left:3px solid var(--accent,#2dd4bf);border-radius:8px;padding:10px 12px;min-width:0}'+
'.udtk-bloc.officiel{border-left-color:var(--blue,#58a6ff)}'+
'.udtk-bloc.modifie{border-left-color:var(--purple,#bc8cff)}'+
'.udtk-bloc-head{display:flex;align-items:baseline;gap:8px;margin-bottom:2px;flex-wrap:wrap}'+
'.udtk-age{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.02em}'+
'.udtk-tag{font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--purple,#bc8cff);border:1px solid currentColor;border-radius:4px;padding:1px 5px}'+
'.udtk-meta{font-size:10px;color:var(--muted,#8b949e);font-variant-numeric:tabular-nums;margin-bottom:5px}'+
'.udtk-wod{font-size:12px;line-height:1.65;word-break:break-word}'+
'.udtk-load{font-weight:800}'+
'.udtk-sub{background:rgba(45,212,191,.15);color:var(--accent,#2dd4bf);padding:0 3px;border-radius:3px;font-weight:700}'+
'.udtk-note{font-size:10.5px;color:var(--muted,#8b949e);margin-top:7px;line-height:1.5}'+
'.udtk-alerte{display:block;color:var(--red,#f85149);margin-bottom:4px}'+
'.udtk-actions{display:flex;gap:6px;align-items:center;margin-left:auto}'+
'.udtk-ico{font:inherit;font-size:12px;line-height:1;background:transparent;border:0;color:var(--muted,#8b949e);cursor:pointer;padding:2px 4px;border-radius:4px}'+
'.udtk-ico:hover{color:var(--accent,#2dd4bf)}'+
'.udtk-edit{width:100%;min-height:150px;font:inherit;font-size:12px;line-height:1.65;color:var(--text,#e6edf3);background:var(--card,rgba(0,0,0,.25));border:1px solid var(--accent,#2dd4bf);border-radius:6px;padding:8px;resize:vertical}'+
'.udtk-btns{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}'+
'.udtk-btn{font:inherit;font-size:11px;font-weight:700;padding:6px 12px;border-radius:6px;border:1px solid var(--border,rgba(255,255,255,.18));background:transparent;color:var(--muted,#8b949e);cursor:pointer}'+
'.udtk-btn.primaire{background:var(--accent,#2dd4bf);border-color:var(--accent,#2dd4bf);color:#0b1512}'+
'.udtk-btn.danger{color:var(--red,#f85149)}';

function injecterStyle(){
  if(document.getElementById(STYLE_ID))return;
  var st=document.createElement('style');
  st.id=STYLE_ID; st.textContent=CSS;
  document.head.appendChild(st);
}

/* ---- Retouches manuelles (colonne jsonb `kids`) ---- */

function estAdmin(){
  try{
    var p=window.currentProfile||(typeof currentProfile!=='undefined'?currentProfile:null);
    return !!(p&&p.role==='admin');
  }catch(e){return false;}
}
function retouches(s){
  var k=s&&s.kids;
  if(typeof k==='string'){try{k=JSON.parse(k);}catch(e){k=null;}}
  return (k&&typeof k==='object')?k:{};
}
function retouche(s,catId,nivId){
  var r=retouches(s);
  return (r[catId]&&typeof r[catId][nivId]==='string')?r[catId][nivId]:null;
}
function voieDe(s){
  var r=retouches(s);
  if(r._voie&&VOIES.some(function(v){return v.id===r._voie;}))return r._voie;
  return VOIE_PAR_TYPE[s.type]||'volume';
}
async function ecrireKids(s,maj){
  var r=retouches(s);
  maj(r);
  var vide=true;
  for(var kk in r){if(Object.prototype.hasOwnProperty.call(r,kk)){vide=false;break;}}
  var payload=vide?null:r;
  var table=s.athlete_id?'personal_sessions':'sessions';
  var res=await sb.from(table).update({kids:payload}).eq('id',s.id);
  if(res&&res.error)throw res.error;
  s.kids=payload;
}
function enregistrerRetouche(s,catId,nivId,texte){
  return ecrireKids(s,function(r){
    if(texte===null){
      if(r[catId]){delete r[catId][nivId];
        var reste=false;for(var z in r[catId]){if(Object.prototype.hasOwnProperty.call(r[catId],z))reste=true;}
        if(!reste)delete r[catId];}
    }else{
      if(!r[catId])r[catId]={};
      r[catId][nivId]=texte;
    }
  });
}
function enregistrerVoie(s,voieId){
  return ecrireKids(s,function(r){
    if(!voieId)delete r._voie; else r._voie=voieId;
  });
}

/* Construit le bloc Kids pour une séance. */
function blocKids(s,niveauId){
  var niveau=null;
  for(var i=0;i<NIVEAUX.length;i++){if(NIVEAUX[i].id===niveauId)niveau=NIVEAUX[i];}
  if(!niveau)niveau=NIVEAUX[0];

  var brutTexte=texteSource(s,niveau);
  if(!brutTexte.trim())return '';

  var regime=REGIMES[s.type]||'auto';
  var voie=voieDe(s);
  var forcee=!!retouches(s)._voie;
  var admin=estAdmin();

  var tabs='';
  for(var t=0;t<NIVEAUX.length;t++){
    var n=NIVEAUX[t];
    tabs+='<button type="button" class="'+(n.id===niveau.id?'on':'')+
          '" data-udtk-niveau="'+n.id+'" data-udtk-sid="'+s.id+'">'+n.nom+'</button>';
  }

  var voieHtml='';
  var vNom=(VOIES.filter(function(v){return v.id===voie;})[0]||{}).nom||voie;
  if(admin){
    var opts='<option value=""'+(forcee?'':' selected')+'>Auto — '+vNom+'</option>';
    for(var w=0;w<VOIES.length;w++){
      opts+='<option value="'+VOIES[w].id+'"'+(forcee&&VOIES[w].id===voie?' selected':'')+'>'+VOIES[w].nom+'</option>';
    }
    voieHtml='<div class="udtk-voie"><span>Voie de progression</span>'+
      '<select data-udtk-voie="1" data-udtk-sid="'+s.id+'">'+opts+'</select>'+
      '<span>· régime '+regime+'</span></div>';
  }else{
    voieHtml='<div class="udtk-voie"><span>Voie '+vNom.toLowerCase()+'</span></div>';
  }

  var g='';
  for(var c=CATS.length-1;c>=0;c--){
    var r=scaleWod(brutTexte,{categorie:CATS[c].id,niveau:niveau.id,intensite:regime,voie:voie});
    if(!r)continue;
    var cat=r.categorie;
    var perso=retouche(s,cat.id,niveau.id);
    var corps=(perso!==null)?escapeHtml(perso).replace(/\n/g,'<br>'):r.html;
    var outils='';
    if(admin){
      outils='<span class="udtk-actions">'+
        (perso!==null?'<button type="button" class="udtk-ico" title="Revenir au scaling automatique" data-udtk-reset="1" data-udtk-cat="'+cat.id+'" data-udtk-niv="'+niveau.id+'" data-udtk-sid="'+s.id+'">↺</button>':'')+
        '<button type="button" class="udtk-ico" title="Modifier" data-udtk-edit="1" data-udtk-cat="'+cat.id+'" data-udtk-niv="'+niveau.id+'" data-udtk-sid="'+s.id+'">✏️</button>'+
      '</span>';
    }
    g+='<div class="udtk-bloc'+(cat.officiel?' officiel':'')+(perso!==null?' modifie':'')+'">'+
         '<div class="udtk-bloc-head"><span class="udtk-age">'+cat.nom+'</span>'+
         (perso!==null?'<span class="udtk-tag">modifié</span>':'')+outils+'</div>'+
         '<div class="udtk-meta">coef '+r.k.toFixed(2)+' · barreau '+r.barreau+'/'+NB_BARREAUX+' · box '+r.box[0]+'/'+r.box[1]+' cm</div>'+
         '<div class="udtk-wod">'+corps+'</div>'+
         '<div class="udtk-note">'+
           (perso===null&&r.flags.max?'<span class="udtk-alerte">Charge proche du max : plancher ramené à 3 répétitions.</span>':'')+
           (cat.alerte?'<span class="udtk-alerte">'+cat.alerte+'</span>':'')+
           cat.note+
         '</div>'+
       '</div>';
  }

  return '<div class="udtk" data-udtk-card="'+s.id+'">'+
    '<div class="udtk-head"><span class="udtk-titre">Kids &amp; Teens</span>'+
      '<div class="udtk-tabs">'+tabs+'</div></div>'+
    voieHtml+
    '<p class="udtk-legende">'+niveau.legende+'</p>'+
    '<div class="udtk-grid">'+g+'</div></div>';
}

var CACHE={};

function rafraichir(sid,niv){
  var s=CACHE[sid]; if(!s)return;
  var hote=document.querySelector('[data-udtk-card="'+sid+'"]');
  if(!hote)return;
  var neuf=document.createElement('div');
  neuf.innerHTML=blocKids(s,niv);
  if(neuf.firstElementChild)hote.replaceWith(neuf.firstElementChild);
}
function toast(msg){
  try{if(typeof showToast==='function'){showToast(msg);return;}}catch(e){}
}
function concerne(s){
  if(!s||!s.id||!s.programme_id)return false;
  var prog=null;
  try{if(typeof getProgById==='function')prog=getProgById(s.programme_id);}catch(e){}
  if(!prog)return false;
  var slug=(prog.slug||'').toLowerCase(), nom=(prog.name||'').toLowerCase();
  for(var i=0;i<PROGS.length;i++){
    if(slug.indexOf(PROGS[i])>=0||nom.indexOf(PROGS[i])>=0)return true;
  }
  return false;
}

/* Changement de voie */
document.addEventListener('change',function(e){
  var sel=e.target.closest?e.target.closest('[data-udtk-voie]'):null;
  if(!sel)return;
  var sid=sel.getAttribute('data-udtk-sid'), s=CACHE[sid];
  if(!s)return;
  var bloc=sel.closest('.udtk');
  var on=bloc?bloc.querySelector('.udtk-tabs button.on'):null;
  var niv=on?on.getAttribute('data-udtk-niveau'):'rx';
  enregistrerVoie(s,sel.value||null)
    .then(function(){rafraichir(sid,niv);})
    .catch(function(err){toast('❌ Changement de voie impossible');if(window.console)console.error('[kids-scaling]',err);});
},true);

/* Onglets, crayon, enregistrer, annuler, réinitialiser */
document.addEventListener('click',function(e){
  if(!e.target.closest)return;

  var tab=e.target.closest('[data-udtk-niveau]');
  if(tab){
    e.preventDefault(); e.stopPropagation();
    rafraichir(tab.getAttribute('data-udtk-sid'),tab.getAttribute('data-udtk-niveau'));
    return;
  }

  var crayon=e.target.closest('[data-udtk-edit]');
  if(crayon){
    e.preventDefault(); e.stopPropagation();
    var sid=crayon.getAttribute('data-udtk-sid'),
        cat=crayon.getAttribute('data-udtk-cat'),
        niv=crayon.getAttribute('data-udtk-niv');
    var s=CACHE[sid]; if(!s)return;
    var bloc=crayon.closest('.udtk-bloc'), zone=bloc.querySelector('.udtk-wod');
    if(bloc.querySelector('.udtk-edit'))return;

    var perso=retouche(s,cat,niv), txt=perso;
    if(txt===null){
      var niveau=null;
      for(var i=0;i<NIVEAUX.length;i++){if(NIVEAUX[i].id===niv)niveau=NIVEAUX[i];}
      var src=texteSource(s,niveau);
      var gen=scaleWod(src,{categorie:cat,niveau:niv,intensite:REGIMES[s.type]||'auto',voie:voieDe(s)});
      txt=gen?gen.texte:'';
    }
    var ta=document.createElement('textarea');
    ta.className='udtk-edit'; ta.value=txt; ta.spellcheck=false;
    ta.dataset.sid=sid; ta.dataset.cat=cat; ta.dataset.niv=niv;
    var btns=document.createElement('div');
    btns.className='udtk-btns';
    btns.innerHTML='<button type="button" class="udtk-btn primaire" data-udtk-save="1">Enregistrer</button>'+
                   '<button type="button" class="udtk-btn" data-udtk-cancel="1">Annuler</button>'+
                   (perso!==null?'<button type="button" class="udtk-btn danger" data-udtk-reset="1" data-udtk-sid="'+sid+'" data-udtk-cat="'+cat+'" data-udtk-niv="'+niv+'">Réinitialiser</button>':'');
    zone.innerHTML=''; zone.appendChild(ta); zone.appendChild(btns);
    ta.focus();
    return;
  }

  var save=e.target.closest('[data-udtk-save]');
  if(save){
    e.preventDefault(); e.stopPropagation();
    var ta2=save.closest('.udtk-wod').querySelector('.udtk-edit');
    var s2=CACHE[ta2.dataset.sid]; if(!s2)return;
    save.disabled=true; save.textContent='…';
    enregistrerRetouche(s2,ta2.dataset.cat,ta2.dataset.niv,ta2.value)
      .then(function(){toast('✅ Scaling enregistré');rafraichir(ta2.dataset.sid,ta2.dataset.niv);})
      .catch(function(err){
        save.disabled=false; save.textContent='Enregistrer';
        toast('❌ Enregistrement impossible');
        if(window.console)console.error('[kids-scaling]',err);
      });
    return;
  }

  var cancel=e.target.closest('[data-udtk-cancel]');
  if(cancel){
    e.preventDefault(); e.stopPropagation();
    var ta3=cancel.closest('.udtk-wod').querySelector('.udtk-edit');
    rafraichir(ta3.dataset.sid,ta3.dataset.niv);
    return;
  }

  var reset=e.target.closest('[data-udtk-reset]');
  if(reset){
    e.preventDefault(); e.stopPropagation();
    var sid4=reset.getAttribute('data-udtk-sid'),
        cat4=reset.getAttribute('data-udtk-cat'),
        niv4=reset.getAttribute('data-udtk-niv');
    var s4=CACHE[sid4]; if(!s4)return;
    enregistrerRetouche(s4,cat4,niv4,null)
      .then(function(){toast('↺ Scaling automatique rétabli');rafraichir(sid4,niv4);})
      .catch(function(err){toast('❌ Réinitialisation impossible');if(window.console)console.error('[kids-scaling]',err);});
    return;
  }
},true);

/* ======================= PATCH buildSessionCard ======================= */

if(!window.__patchBound_kidsScaling){
  window.__patchBound_kidsScaling=true;

  var brancher=function(){
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
      }catch(err){if(window.console)console.warn('[kids-scaling]',err);}
      return html;
    };
    return true;
  };

  if(!brancher()){
    var essais=0;
    var tmr=setInterval(function(){if(brancher()||++essais>40)clearInterval(tmr);},100);
    document.addEventListener('studio:ready',brancher);
  }
}

/* ================= RÉGLAGES (table kids_scaling_config) ================= */

function appliquerConfig(cfg){
  if(!cfg||typeof cfg!=='object')return;
  var i;
  if(cfg.cats)for(i=0;i<CATS.length;i++){
    var v=cfg.cats[CATS[i].id];
    if(typeof v==='number'&&v>0)CATS[i].k=v;
  }
  if(cfg.niveaux)for(i=0;i<NIVEAUX.length;i++){
    var n=cfg.niveaux[NIVEAUX[i].id];
    if(typeof n==='number'&&n>0)NIVEAUX[i].k=n;
  }
  if(cfg.regimes)for(var t in cfg.regimes){
    if(Object.prototype.hasOwnProperty.call(cfg.regimes,t))REGIMES[t]=cfg.regimes[t];
  }
  if(cfg.voies)for(var t2 in cfg.voies){
    if(Object.prototype.hasOwnProperty.call(cfg.voies,t2))VOIE_PAR_TYPE[t2]=cfg.voies[t2];
  }
  if(cfg.grille)for(var a in cfg.grille){
    if(Object.prototype.hasOwnProperty.call(cfg.grille,a))GRILLE[a]=cfg.grille[a];
  }
  if(cfg.echelles)for(i=0;i<ECHELLES.length;i++){
    var e=cfg.echelles[ECHELLES[i].id];
    if(e&&typeof e==='object')ECHELLES[i].v=e;
  }
}

async function chargerConfig(){
  try{
    var r=await sb.from('kids_scaling_config').select('config').eq('id',1).single();
    if(r&&r.data&&r.data.config)appliquerConfig(r.data.config);
  }catch(e){if(window.console)console.warn('[kids-scaling] config non chargée',e);}
  var vus=document.querySelectorAll('[data-udtk-card]');
  for(var i=0;i<vus.length;i++){
    var sid=vus[i].getAttribute('data-udtk-card');
    var on=vus[i].querySelector('.udtk-tabs button.on');
    rafraichir(sid,on?on.getAttribute('data-udtk-niveau'):'rx');
  }
}

async function sauverConfig(cfg){
  var maj={config:cfg,updated_at:new Date().toISOString()};
  try{
    var u=window.currentUser||(typeof currentUser!=='undefined'?currentUser:null);
    if(u)maj.updated_by=u.id;
  }catch(e){}
  var res=await sb.from('kids_scaling_config').update(maj).eq('id',1);
  if(res&&res.error)throw res.error;
  appliquerConfig(cfg);
}

/* ================= PANNEAU DANS « 🧰 OUTILS » ================= */

var TYPES={wod:'WOD',strength:'Force',weightlifting:'Weightlifting',gymnastics:'Gymnastics',
  renforcement:'Renforcement',bodybuilding:'Bodybuilding',skill:'Skill',warmup:'Échauffement',
  mobility:'Mobilité',engine:'Engine',run:'Run'};
var REGIME_LBL={auto:'Auto (reps)',metcon:'Metcon — coef plein',lourd:'Lourd — −15 %',max:'Max — −20 %'};

function styleReglages(){
  if(document.getElementById('udtk-cfg-style'))return;
  var st=document.createElement('style');
  st.id='udtk-cfg-style';
  st.textContent=
   '.udtkc-sec{margin-bottom:18px}'+
   '.udtkc-h{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:4px}'+
   '.udtkc-p{font-size:12px;color:var(--muted);margin:0 0 10px;line-height:1.5}'+
   '.udtkc-row{display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:6px}'+
   '.udtkc-lbl{flex:1;min-width:0;font-size:13px;font-weight:600}'+
   '.udtkc-row input[type=number]{width:84px;font:inherit;font-size:13px;padding:6px 8px;background:var(--card2);color:var(--text);border:1px solid var(--border2);border-radius:8px;text-align:right}'+
   '.udtkc-row select{font:inherit;font-size:12px;padding:6px 8px;background:var(--card2);color:var(--text);border:1px solid var(--border2);border-radius:8px}'+
   '.udtkc-grille{width:100%;border-collapse:separate;border-spacing:4px;font-size:12px}'+
   '.udtkc-grille th{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:800;text-align:center}'+
   '.udtkc-grille th:first-child{text-align:left}'+
   '.udtkc-grille td{text-align:center}'+
   '.udtkc-grille td:first-child{text-align:left;font-weight:700}'+
   '.udtkc-grille select{width:100%;font:inherit;font-size:12px;padding:6px 4px;background:var(--card2);color:var(--text);border:1px solid var(--border2);border-radius:8px;text-align:center}'+
   '.udtkc-mv{background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:6px;overflow:hidden}'+
   '.udtkc-mv>summary{cursor:pointer;padding:10px 12px;font-size:13px;font-weight:700;list-style:none}'+
   '.udtkc-mv>summary::-webkit-details-marker{display:none}'+
   '.udtkc-mv[open]>summary{border-bottom:1px solid var(--border)}'+
   '.udtkc-mv-body{padding:10px 12px}'+
   '.udtkc-voie-h{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin:10px 0 2px}'+
   '.udtkc-voie-d{font-size:11px;color:var(--muted);margin:0 0 7px;line-height:1.45}'+
   '.udtkc-bl{display:flex;align-items:center;gap:8px;margin-bottom:5px}'+
   '.udtkc-bl span{flex:0 0 68px;font-size:11px;color:var(--muted);font-weight:700}'+
   '.udtkc-bl input{flex:1;min-width:0;font:inherit;font-size:12px;padding:6px 8px;background:var(--card2);color:var(--text);border:1px solid var(--border2);border-radius:8px}'+
   '.udtkc-bar{position:sticky;bottom:0;display:flex;gap:8px;padding:12px 0;background:linear-gradient(transparent,var(--dark) 30%)}'+
   '.udtkc-save{flex:1;font:inherit;font-size:13px;font-weight:800;padding:12px;border:0;border-radius:10px;background:var(--accent);color:#0b1512;cursor:pointer}'+
   '.udtkc-reset{font:inherit;font-size:12px;font-weight:700;padding:12px 14px;border:1px solid var(--border2);border-radius:10px;background:transparent;color:var(--muted);cursor:pointer}';
  document.head.appendChild(st);
}

function panneauReglages(){
  var panel=document.getElementById('admin-outils-panel');
  if(!panel)return;
  styleReglages();
  var i,c,w;

  var h='<div class="ot-bar"><button class="ot-back" id="udtkc-back">‹ Outils</button>'+
        '<div class="ot-bar-ti">🧒 Scaling Kids &amp; Teens</div></div>';

  h+='<div class="udtkc-sec"><div class="udtkc-h">Charge — coefficients par tranche d\'âge</div>'+
     '<p class="udtkc-p">Part de la charge adulte. L\'âge ne pilote que la charge, jamais le choix du mouvement.</p>';
  for(i=0;i<CATS.length;i++){
    h+='<div class="udtkc-row"><span class="udtkc-lbl">'+CATS[i].nom+'</span>'+
       '<input type="number" step="0.01" min="0.05" max="1" data-udtkc-cat="'+CATS[i].id+'" value="'+CATS[i].k+'"></div>';
  }
  h+='</div>';

  h+='<div class="udtkc-sec"><div class="udtkc-h">Charge — coefficients par niveau</div>'+
     '<p class="udtkc-p">Appliqués par-dessus la tranche d\'âge.</p>';
  for(i=0;i<NIVEAUX.length;i++){
    h+='<div class="udtkc-row"><span class="udtkc-lbl">'+NIVEAUX[i].nom+'</span>'+
       '<input type="number" step="0.01" min="0.1" max="1" data-udtkc-niv="'+NIVEAUX[i].id+'" value="'+NIVEAUX[i].k+'"></div>';
  }
  h+='</div>';

  h+='<div class="udtkc-sec"><div class="udtkc-h">Charge — régime par type de séance</div>'+
     '<p class="udtkc-p">Plus la charge approche du max, plus l\'écart avec l\'adulte se creuse.</p>';
  for(var t in TYPES){
    if(!Object.prototype.hasOwnProperty.call(TYPES,t))continue;
    var cur=REGIMES[t]||'auto', o1='';
    for(var k1 in REGIME_LBL){
      if(!Object.prototype.hasOwnProperty.call(REGIME_LBL,k1))continue;
      o1+='<option value="'+k1+'"'+(k1===cur?' selected':'')+'>'+REGIME_LBL[k1]+'</option>';
    }
    h+='<div class="udtkc-row"><span class="udtkc-lbl">'+TYPES[t]+'</span>'+
       '<select data-udtkc-reg="'+t+'">'+o1+'</select></div>';
  }
  h+='</div>';

  h+='<div class="udtkc-sec"><div class="udtkc-h">Mouvement — voie par type de séance</div>'+
     '<p class="udtkc-p">';
  for(w=0;w<VOIES.length;w++)h+='<b>'+VOIES[w].nom+'</b> — '+VOIES[w].desc+'<br>';
  h+='</p>';
  for(var t3 in TYPES){
    if(!Object.prototype.hasOwnProperty.call(TYPES,t3))continue;
    var curv=VOIE_PAR_TYPE[t3]||'volume', o2='';
    for(w=0;w<VOIES.length;w++){
      o2+='<option value="'+VOIES[w].id+'"'+(VOIES[w].id===curv?' selected':'')+'>'+VOIES[w].nom+'</option>';
    }
    h+='<div class="udtkc-row"><span class="udtkc-lbl">'+TYPES[t3]+'</span>'+
       '<select data-udtkc-voie="'+t3+'">'+o2+'</select></div>';
  }
  h+='</div>';

  h+='<div class="udtkc-sec"><div class="udtkc-h">Mouvement — grille âge × niveau</div>'+
     '<p class="udtkc-p">Quel barreau de l\'échelle prend chaque bloc. 1 = le plus facile, '+NB_BARREAUX+' = mouvement adulte inchangé.</p>'+
     '<table class="udtkc-grille"><tr><th>Tranche</th>';
  for(i=0;i<NIVEAUX.length;i++)h+='<th>'+NIVEAUX[i].nom+'</th>';
  h+='</tr>';
  for(c=CATS.length-1;c>=0;c--){
    h+='<tr><td>'+CATS[c].nom.replace(' ans','')+'</td>';
    for(i=0;i<NIVEAUX.length;i++){
      var b=barreau(CATS[c].id,NIVEAUX[i].id), o3='';
      for(var x=1;x<=NB_BARREAUX;x++)o3+='<option value="'+x+'"'+(x===b?' selected':'')+'>'+x+'</option>';
      h+='<td><select data-udtkc-gr="'+CATS[c].id+'" data-udtkc-grn="'+NIVEAUX[i].id+'">'+o3+'</select></td>';
    }
    h+='</tr>';
  }
  h+='</table></div>';

  h+='<div class="udtkc-sec"><div class="udtkc-h">Mouvement — échelles de progression</div>'+
     '<p class="udtkc-p">Six barreaux par voie, du plus facile au plus dur. Un barreau vide conserve le mouvement d\'origine.</p>';
  for(i=0;i<ECHELLES.length;i++){
    var ech=ECHELLES[i], corps='';
    for(w=0;w<VOIES.length;w++){
      var vid=VOIES[w].id, tab=(ech.v&&ech.v[vid])||[];
      corps+='<div class="udtkc-voie-h">'+VOIES[w].nom+'</div>';
      for(var b2=0;b2<NB_BARREAUX;b2++){
        var val=String(tab[b2]||'').replace(/"/g,'&quot;');
        corps+='<label class="udtkc-bl"><span>Barreau '+(b2+1)+'</span>'+
          '<input type="text" data-udtkc-ech="'+ech.id+'" data-udtkc-ev="'+vid+'" data-udtkc-eb="'+b2+'" value="'+val+'" placeholder="'+
          (b2+1===NB_BARREAUX?'mouvement adulte inchangé':'—')+'"></label>';
      }
    }
    h+='<details class="udtkc-mv"><summary>'+ech.nom+'</summary><div class="udtkc-mv-body">'+corps+'</div></details>';
  }
  h+='</div>';

  h+='<div class="udtkc-bar"><button class="udtkc-save" id="udtkc-save">Enregistrer les réglages</button>'+
     '<button class="udtkc-reset" id="udtkc-reset">Rétablir</button></div>';

  panel.innerHTML=h;

  document.getElementById('udtkc-back').addEventListener('click',function(){
    try{if(typeof window.renderOutilsTab==='function')window.renderOutilsTab();}catch(e){}
  });

  document.getElementById('udtkc-save').addEventListener('click',function(){
    var btn=this; btn.disabled=true; btn.textContent='…';
    var cfg={cats:{},niveaux:{},regimes:{},voies:{},grille:{},echelles:{}};
    panel.querySelectorAll('[data-udtkc-cat]').forEach(function(el){
      var v=parseFloat(el.value); if(v>0)cfg.cats[el.getAttribute('data-udtkc-cat')]=v;
    });
    panel.querySelectorAll('[data-udtkc-niv]').forEach(function(el){
      var v=parseFloat(el.value); if(v>0)cfg.niveaux[el.getAttribute('data-udtkc-niv')]=v;
    });
    panel.querySelectorAll('[data-udtkc-reg]').forEach(function(el){
      cfg.regimes[el.getAttribute('data-udtkc-reg')]=el.value;
    });
    panel.querySelectorAll('[data-udtkc-voie]').forEach(function(el){
      cfg.voies[el.getAttribute('data-udtkc-voie')]=el.value;
    });
    panel.querySelectorAll('[data-udtkc-gr]').forEach(function(el){
      var a=el.getAttribute('data-udtkc-gr'), n=el.getAttribute('data-udtkc-grn');
      if(!cfg.grille[a])cfg.grille[a]={};
      cfg.grille[a][n]=parseInt(el.value,10)||NB_BARREAUX;
    });
    panel.querySelectorAll('[data-udtkc-ech]').forEach(function(el){
      var id=el.getAttribute('data-udtkc-ech'), vid=el.getAttribute('data-udtkc-ev'),
          b=parseInt(el.getAttribute('data-udtkc-eb'),10);
      if(!cfg.echelles[id])cfg.echelles[id]={};
      if(!cfg.echelles[id][vid])cfg.echelles[id][vid]=[];
      cfg.echelles[id][vid][b]=String(el.value||'').trim();
    });
    sauverConfig(cfg).then(function(){
      btn.disabled=false; btn.textContent='Enregistrer les réglages';
      toast('✅ Réglages enregistrés');
    }).catch(function(err){
      btn.disabled=false; btn.textContent='Enregistrer les réglages';
      toast('❌ Enregistrement impossible');
      if(window.console)console.error('[kids-scaling]',err);
    });
  });

  document.getElementById('udtkc-reset').addEventListener('click',function(){
    appliquerConfig(JSON.parse(JSON.stringify(USINE)));
    panneauReglages();
    toast('↺ Valeurs d\'usine rétablies — pense à enregistrer');
  });

  var p=document.getElementById('page-admin');
  if(p)p.scrollTop=0;
}

/* Carte dans la grille Outils, sans toucher à outils.js. */
function carteOutils(){
  var grille=document.querySelector('#admin-outils-panel .ot-grid');
  if(!grille||grille.querySelector('[data-udtkc-card]'))return;
  if(!estAdmin())return;
  var b=document.createElement('button');
  b.className='ot-card';
  b.setAttribute('data-udtkc-card','1');
  b.innerHTML='<span class="ot-card-ic">🧒</span><span class="ot-card-txt">'+
    '<span class="ot-card-ti">Scaling Kids &amp; Teens</span>'+
    '<span class="ot-card-sub">Coefficients de charge, échelles de progression par voie, grille âge × niveau.</span>'+
    '</span><span class="ot-card-go">›</span>';
  b.addEventListener('click',panneauReglages);
  grille.appendChild(b);
}

if(window.MutationObserver){
  var obs=new MutationObserver(function(){carteOutils();});
  var demarrer=function(){
    var hote=document.getElementById('admin-outils-panel');
    if(hote){obs.observe(hote,{childList:true,subtree:true});carteOutils();return true;}
    return false;
  };
  if(!demarrer()){
    var nn=0, iv=setInterval(function(){if(demarrer()||++nn>80)clearInterval(iv);},250);
  }
}

if(typeof sb!=='undefined'&&sb&&sb.from){
  setTimeout(chargerConfig,1200);
  document.addEventListener('studio:ready',function(){chargerConfig();});
}

window.UDTKids={scaleWod:scaleWod,profil:profil,blocKids:blocKids,barreau:barreau,
  chargerConfig:chargerConfig,sauverConfig:sauverConfig,panneauReglages:panneauReglages,
  CATS:CATS,NIVEAUX:NIVEAUX,RACKS:RACKS,ECHELLES:ECHELLES,GRILLE:GRILLE,VOIES:VOIES,
  VOIE_PAR_TYPE:VOIE_PAR_TYPE,REGIMES:REGIMES,PROGS:PROGS,USINE:USINE};

})();
