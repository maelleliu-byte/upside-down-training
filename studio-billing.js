// ===== FACTURATION STUDIO : pause et rappels dans l'app =====
// studios.billing_status (tenu par le webhook Stripe et pg_cron) :
//   paused   → les athlètes voient un écran de suspension ; les coachs gardent
//              l'accès avec un bandeau qui renvoie vers les Paramètres
//   past_due → bandeau d'alerte pour les coachs (date limite)
//   active sans abonnement + délai en cours → bandeau de rappel pour les coachs
// Le studio Upside Down (profil sans studio_id) n'est jamais concerné.

async function checkStudioBilling(){
  const sid=currentProfile?.studio_id;
  if(!sid)return false;
  let studio=null;
  try{
    const {data}=await sb.from('studios')
      .select('name,slug,owner_id,billing_status,billing_grace_until,billing_exempt,stripe_subscription_id')
      .eq('id',sid).maybeSingle();
    studio=data;
  }catch(e){console.warn('[billing] lecture studio impossible',e);}
  // En cas d'erreur de lecture, on ne bloque jamais l'athlète
  if(!studio||studio.billing_exempt)return false;

  const isCoach=currentProfile.role==='admin'||studio.owner_id===currentUser?.id;
  const status=studio.billing_status||'active';
  const settingsUrl='/'+studio.slug+'/settings';
  const fmt=iso=>new Date(iso).toLocaleDateString('fr-FR',{day:'numeric',month:'long'});

  if(status==='paused'&&!isCoach){
    _showStudioPausedScreen(studio.name);
    return true; // ne pas lancer l'app
  }

  if(!isCoach)return false;
  if(status==='paused'){
    _showBillingBanner('danger','Studio en pause : tes athlètes n\'ont plus accès à l\'app.','Réactiver',settingsUrl);
  }else if(status==='past_due'){
    _showBillingBanner('warn','Paiement refusé'+(studio.billing_grace_until?' — mets à jour ta carte avant le '+fmt(studio.billing_grace_until):'')+'.','Régulariser',settingsUrl);
  }else if(!studio.stripe_subscription_id&&studio.billing_grace_until){
    _showBillingBanner('warn','Abonne-toi avant le '+fmt(studio.billing_grace_until)+' pour que tes athlètes gardent l\'accès.','S\'abonner',settingsUrl);
  }
  return false;
}

function _showStudioPausedScreen(studioName){
  const main=document.getElementById('main-app');
  if(main)main.style.display='none';
  const auth=document.getElementById('auth-screen');
  if(auth)auth.classList.add('hidden');
  const splash=document.getElementById('splash-screen');
  if(splash)splash.style.display='none';
  let el=document.getElementById('studio-paused-screen');
  if(!el){
    el=document.createElement('div');
    el.id='studio-paused-screen';
    el.style.cssText='position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--bg,#0a0a0a);color:var(--text,#f0f0f0);text-align:center';
    document.body.appendChild(el);
  }
  const safe=String(studioName||'Ton studio').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  el.innerHTML='<div style="max-width:360px">'
    +'<div style="font-size:44px;margin-bottom:12px">⏸️</div>'
    +'<div style="font-size:20px;font-weight:800;margin-bottom:10px">'+safe+' est momentanément suspendu</div>'
    +'<div style="font-size:14px;color:var(--muted,#888);line-height:1.6;margin-bottom:22px">L\'accès aux séances reviendra dès que ton coach aura réglé l\'abonnement du studio. Tes données sont conservées.</div>'
    +'<button onclick="doLogout()" style="background:transparent;border:1px solid #333;color:inherit;border-radius:10px;padding:12px 18px;font-size:14px;font-weight:700;cursor:pointer">Se déconnecter</button>'
    +'</div>';
}

function _showBillingBanner(kind,text,cta,href){
  if(document.getElementById('studio-billing-banner'))return;
  const c=kind==='danger'?['#ff4747','#fff']:['#ff8c47','#0a0a0a'];
  const el=document.createElement('div');
  el.id='studio-billing-banner';
  el.style.cssText='position:sticky;top:0;z-index:500;display:flex;align-items:center;gap:10px;padding:10px 16px;background:'+c[0]+';color:'+c[1]+';font-size:13px;font-weight:700;line-height:1.4';
  el.innerHTML='<span style="flex:1;min-width:0"></span>'
    +'<a style="flex-shrink:0;background:rgba(0,0,0,.18);color:inherit;text-decoration:none;border-radius:8px;padding:6px 10px"></a>'
    +'<button aria-label="Masquer" style="flex-shrink:0;background:none;border:none;color:inherit;font-size:18px;cursor:pointer;padding:0 2px">×</button>';
  el.children[0].textContent=text;
  el.children[1].textContent=cta;
  el.children[1].href=href;
  el.children[2].onclick=()=>el.remove();
  const main=document.getElementById('main-app');
  (main||document.body).prepend(el);
}
