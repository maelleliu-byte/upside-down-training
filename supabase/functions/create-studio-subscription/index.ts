// Abonnement SaaS d'un studio à Upside Down.
//   POST {}                     → Checkout Stripe au palier du nombre d'athlètes actuel
//   POST { action: 'portal' }   → portail de facturation Stripe (carte, factures, résiliation)
// Réservé au propriétaire du studio.

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { priceIdForTier, tierForCount } from '../_shared/studio-tiers.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL') || 'https://upside-down-training.netlify.app';
const TRIAL_DAYS = 30;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Non authentifié' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return json({ error: 'Session invalide' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'subscribe';

    const { data: profile } = await supabase
      .from('profiles').select('studio_id').eq('id', user.id).single();
    if (!profile?.studio_id) return json({ error: 'Aucun studio associé' }, 400);

    const { data: studio } = await supabase
      .from('studios').select('*').eq('id', profile.studio_id).single();
    if (!studio) return json({ error: 'Studio introuvable' }, 404);
    if (studio.owner_id !== user.id) return json({ error: 'Seul le propriétaire du studio gère l\'abonnement' }, 403);

    const returnUrl = `${APP_URL}/${studio.slug}/settings`;

    // ── Portail de facturation ──────────────────────────────────
    if (action === 'portal') {
      if (!studio.stripe_customer_id) return json({ error: 'Aucun compte de facturation pour ce studio' }, 400);
      const portal = await stripe.billingPortal.sessions.create({
        customer: studio.stripe_customer_id,
        return_url: returnUrl,
      });
      return json({ url: portal.url });
    }

    // ── Nouvel abonnement ───────────────────────────────────────
    if (studio.billing_exempt) return json({ error: 'Ce studio est exempté de facturation' }, 400);
    if (studio.stripe_subscription_id) {
      return json({ error: 'Ce studio a déjà un abonnement — utilise « Gérer mon abonnement »' }, 400);
    }

    const athleteCount = studio.athlete_count || 0;
    const tier = tierForCount(athleteCount);
    const priceId = await priceIdForTier(stripe, tier);

    let customerId = studio.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: studio.contact_email || user.email,
        name: studio.name,
        metadata: { studio_id: studio.id, studio_slug: studio.slug },
      });
      customerId = customer.id;
      await supabase.from('studios').update({ stripe_customer_id: customerId }).eq('id', studio.id);
    }

    // Pas de deuxième essai gratuit pour un studio qui a déjà été abonné
    const previous = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 1 });
    const trialDays = previous.data.length ? undefined : TRIAL_DAYS;

    const meta = { studio_id: studio.id, studio_slug: studio.slug, tier };
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: meta,
      subscription_data: { metadata: meta, ...(trialDays ? { trial_period_days: trialDays } : {}) },
      payment_method_collection: 'always',
      success_url: `${returnUrl}?billing=success`,
      cancel_url: `${returnUrl}?billing=canceled`,
      allow_promotion_codes: true,
    });

    return json({ url: session.url, tier, athlete_count: athleteCount, trial_days: trialDays || 0 });

  } catch (e) {
    console.error('create-studio-subscription error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
