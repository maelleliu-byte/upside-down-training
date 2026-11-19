// Aligne le prix Stripe des studios abonnés sur leur nombre d'athlètes.
//   POST { studio_id }  → un seul studio (appelé par le trigger SQL dès qu'un
//                          seuil est franchi : 10→11, 29→30, et retour)
//   POST {}             → tous les studios abonnés (filet de sécurité mensuel, pg_cron)
// Appel interne uniquement : en-tête x-internal-secret obligatoire.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { ensureSubscriptionTier, isInternalCall, tierForCount } from '../_shared/studio-tiers.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (!(await isInternalCall(req, supabase))) {
    return new Response('Forbidden', { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  let query = supabase
    .from('studios')
    .select('id, name, plan_tier, athlete_count, stripe_subscription_id')
    .not('stripe_subscription_id', 'is', null)
    .eq('billing_exempt', false);
  if (body?.studio_id) query = query.eq('id', body.studio_id);

  const { data: studios, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const results: unknown[] = [];
  for (const studio of studios || []) {
    const tier = tierForCount(studio.athlete_count || 0);
    try {
      const changed = await ensureSubscriptionTier(stripe, studio.stripe_subscription_id, tier);
      if (changed || studio.plan_tier !== tier) {
        await supabase.from('studios').update({ plan_tier: tier }).eq('id', studio.id);
      }
      results.push({ studio: studio.name, tier, stripe_changed: changed });
    } catch (e) {
      console.error(`Sync KO pour ${studio.id} :`, (e as Error).message);
      results.push({ studio: studio.name, error: (e as Error).message });
    }
  }

  console.log('Billing sync:', JSON.stringify(results));
  return new Response(JSON.stringify({ checked: (studios || []).length, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
