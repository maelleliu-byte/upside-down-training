// STRIPE / ABOS
async function loadMyAccess(){
  if(!currentUser)return;
  const {data,error}=await sb.from('programme_access').select('programme_id').eq('athlete_id',currentUser.id);
  myAccessIds=new Set((data||[]).map(a=>a.programme_id).filter(Boolean));
  myAccess=new Set();
  programmes.forEach(p=>{
    if(myAccessIds.has(p.id))myAccess.add(p.slug);
  });
}

function hasAccess(prog){
  if(!prog)return false;
  if(currentProfile?.role==='admin')return true;
  return myAccessIds.has(prog.id)||myAccess.has(prog.slug);
}
async function renderPlans(){
  await loadMyAccess();
  const list=document.getElementById('plans-list');
  // Liste TOUS les programmes de la DB.
  // Un programme est "abonnable" si stripe_price_id est rempli (créé manuellement
  // ou via la Edge Function create-stripe-product).
  const cards=programmes.map(p=>{
    const slug=p.slug;
    const stripeCfg=STRIPE_PLANS[slug]; // override pour les 4 historiques (features etc)
    const hasAccess=myAccess.has(slug)||myAccessIds.has(p.id)||currentProfile?.role==='admin';
    const icon=stripeCfg?.icon||p.icon||'💪';
    const name=stripeCfg?.name||p.name;
    const color=stripeCfg?.color||p.color||'#999';
    const isOneshot=p.type==='oneshot';
    const priceVal=(isOneshot?p.price_oneshot:p.price_monthly)||(stripeCfg?.price?parseFloat(stripeCfg.price):null);
    const price=priceVal?priceVal+'€':'—';
    const period=priceVal?(isOneshot?'':'/mois'):'';
    const desc=stripeCfg?.desc||p.description||'';
    const features=stripeCfg?.features||[];
    const stripePriceId=p.stripe_price_id||stripeCfg?.priceId;
    return`<div class="plan-card ${slug==='affiliate'?'featured':''}">
      <div class="plan-header"><div><div class="plan-name" style="color:${color}">${name}</div></div><div><div class="plan-price-val">${price}</div><div class="plan-price-period">${period}</div></div></div>
      ${desc?`<div class="plan-desc">${desc}</div>`:''}
      ${features.length?`<div class="plan-features">${features.map(f=>`<div class="plan-feature">${f}</div>`).join('')}</div>`:''}
      ${hasAccess
        ?`<div class="access-badge">✓ Accès actif</div>`
        :stripePriceId
          ?`<button class="btn-subscribe locked" onclick="subscribeToProg('${p.id}')">💳 ${isOneshot?'Acheter':"S'abonner"} — ${price}${period}${isOneshot?'':`<div style="font-size:11px;font-weight:600;opacity:.85;margin-top:2px">14 jours d'essai gratuits</div>`}</button>`
          :`<div style="text-align:center;padding:14px;background:rgba(255,140,71,.1);border:1px dashed rgba(255,140,71,.4);border-radius:10px;color:var(--orange);font-size:12px;font-weight:700">⚠️ Paiement non configuré</div>`
      }
    </div>`;
  }).join('');
  list.innerHTML=cards||'<div style="padding:40px;text-align:center;color:var(--muted);font-size:13px">Aucun programme disponible</div>';
}

// Nouvelle fonction qui prend l'ID du programme et lit son stripe_price_id depuis la DB
function subscribeToProg(programmeId){
  const prog=programmes.find(p=>p.id===programmeId);
  if(!prog){showToast('❌ Programme introuvable');return;}
  if(!currentUser){showToast('⚠️ Connecte-toi d\'abord');return;}
  const priceId=prog.stripe_price_id||STRIPE_PLANS[prog.slug]?.priceId;
  if(!priceId){showToast('❌ Stripe non configuré pour ce programme');return;}
  showToast('⏳ Redirection vers Stripe...');
  (async()=>{
    try{
      const {data:{session}}=await sb.auth.getSession();
      const token=session?.access_token;
      if(!token){showToast('⚠️ Session expirée — reconnecte-toi');return;}
      const fnUrl=(window.SUPABASE_URL||sb.supabaseUrl||'').replace(/\/$/,'')+'/functions/v1/create-checkout-session';
      const res=await fetch(fnUrl,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        body:JSON.stringify({price_id:priceId,programme_slug:prog.slug})
      });
      const data=await res.json();
      if(data.error){showToast('❌ '+data.error);console.error(data);return;}
      if(data.url){window.location.href=data.url;}
      else{showToast('❌ Pas d\'URL retournée');}
    }catch(e){
      console.error('subscribe error',e);
      showToast('❌ Erreur : '+e.message);
    }
  })();
}
function subscribeTo(slug){
  const plan=STRIPE_PLANS[slug];if(!plan)return;
  if(!currentUser){showToast('⚠️ Connecte-toi d\'abord');return;}
  // Appel à la Edge Function Supabase qui crée la Checkout Session
  showToast('⏳ Redirection vers Stripe...');
  (async()=>{
    try{
      const {data:{session}}=await sb.auth.getSession();
      const token=session?.access_token;
      if(!token){showToast('⚠️ Session expirée — reconnecte-toi');return;}
      const fnUrl=(window.SUPABASE_URL||sb.supabaseUrl||'').replace(/\/$/,'')+'/functions/v1/create-checkout-session';
      const res=await fetch(fnUrl,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        body:JSON.stringify({price_id:plan.priceId,programme_slug:slug})
      });
      const data=await res.json();
      if(data.error){showToast('❌ '+data.error);console.error(data);return;}
      if(data.url){window.location.href=data.url;}
      else{showToast('❌ Pas d\'URL retournée');}
    }catch(e){
      console.error('subscribe error',e);
      showToast('❌ Erreur : '+e.message);
    }
  })();
}
