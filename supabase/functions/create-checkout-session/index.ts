import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:3000';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'No auth' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: 'Invalid token' }, 401);

    // Profil enfant : il n'a pas d'email à lui. Le client Stripe porte l'email
    // du parent (factures, reçus), l'abonnement reste celui de l'enfant.
    let billingEmail = user.email;
    {
      const { data: me } = await supabase
        .from('profiles').select('parent_id, child_status').eq('id', user.id).maybeSingle();
      if (me?.parent_id) {
        if (me.child_status !== 'validated') {
          return json({ error: 'Profil enfant pas encore validé par le coach' }, 403);
        }
        const { data: parent } = await supabase
          .from('profiles').select('email').eq('id', me.parent_id).maybeSingle();
        if (parent?.email) billingEmail = parent.email;
      }
    }

    const { price_id, programme_slug } = await req.json();
    if (!price_id) return json({ error: 'price_id required' }, 400);

    // Récupérer le programme + studio
    const { data: programme } = await supabase
      .from('programmes')
      .select('id, slug, studio_id')
      .eq('stripe_price_id', price_id)
      .maybeSingle();

    // Récupérer le stripe_account_id + slug du studio
    let stripeAccountId: string | null = null;
    let studioSlug: string | null = null;
    if (programme?.studio_id) {
      const { data: studio } = await supabase
        .from('studios')
        .select('stripe_account_id, stripe_onboarding_complete, slug')
        .eq('id', programme.studio_id)
        .single();
      if (studio?.stripe_account_id && studio?.stripe_onboarding_complete) {
        stripeAccountId = studio.stripe_account_id;
        studioSlug = studio.slug;
      }
    }

    // IMPORTANT : undefined (pas {}) quand pas de compte Connect.
    // Stripe-node rejette un objet d'options vide ({}) avec "Unknown arguments".
    const connectOptions = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;

    // Customer Stripe
    let customerId: string;
    if (stripeAccountId) {
      const { data: existing } = await supabase
        .from('stripe_customers')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .eq('stripe_account_id', stripeAccountId)
        .maybeSingle();

      if (existing?.stripe_customer_id) {
        customerId = existing.stripe_customer_id;
      } else {
        const customer = await stripe.customers.create(
          { email: billingEmail, metadata: { supabase_user_id: user.id } },
          connectOptions
        );
        customerId = customer.id;
        await supabase.from('stripe_customers').upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          stripe_account_id: stripeAccountId,
          email: billingEmail,
        });
      }
    } else {
      const { data: existing } = await supabase
        .from('stripe_customers')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .is('stripe_account_id', null)
        .maybeSingle();

      if (existing?.stripe_customer_id) {
        customerId = existing.stripe_customer_id;
      } else {
        const customer = await stripe.customers.create({
          email: billingEmail,
          metadata: { supabase_user_id: user.id },
        });
        customerId = customer.id;
        await supabase.from('stripe_customers').upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          stripe_account_id: null,
          email: billingEmail,
        });
      }
    }

    // Détecter mode (oneshot vs subscription)
    let isOneshot = false;
    try {
      const priceObj = connectOptions
        ? await stripe.prices.retrieve(price_id, {}, connectOptions)
        : await stripe.prices.retrieve(price_id);
      isOneshot = !priceObj.recurring;
    } catch (e) {
      console.error('price retrieve failed', price_id, (e as Error).message);
      return json({ error: 'price_id invalide' }, 400);
    }

    // URLs de retour
    const slug = programme_slug || programme?.slug || '';
    const baseUrl = studioSlug ? `${APP_URL}/${studioSlug}` : APP_URL;
    const successUrl = `${baseUrl}?subscription=success&prog=${encodeURIComponent(slug)}`;
    const cancelUrl = `${baseUrl}?subscription=canceled`;

    const baseParams: any = {
      customer: customerId,
      line_items: [{ price: price_id, quantity: 1 }],
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id, programme_slug: slug },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    };

    const session = isOneshot
      ? await stripe.checkout.sessions.create(
          { ...baseParams, mode: 'payment', payment_intent_data: { metadata: { supabase_user_id: user.id, programme_slug: slug } } },
          connectOptions
        )
      : await stripe.checkout.sessions.create(
          { ...baseParams, mode: 'subscription', subscription_data: { trial_period_days: 14, metadata: { supabase_user_id: user.id, programme_slug: slug } } },
          connectOptions
        );

    return json({ url: session.url });

  } catch (e) {
    console.error('checkout error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
