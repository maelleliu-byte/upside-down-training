// Crée ou met à jour le produit + prix Stripe d'un programme.
//
// Sécurité :
//  - JWT utilisateur obligatoire (la clé anon seule ne suffit pas : getUser échoue)
//  - L'appelant doit être admin (profiles.role = 'admin')
//  - Le programme doit appartenir au studio de l'appelant
//    (studio_id NULL = Upside Down, géré uniquement par les admins Upside Down)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Identifier l'appelant
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Non authentifié' }, 401);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: 'Session invalide' }, 401);

    const { data: caller } = await supabase
      .from('profiles').select('role, studio_id').eq('id', user.id).maybeSingle();
    if (!caller || caller.role !== 'admin') return json({ error: 'Réservé aux coachs/admins' }, 403);

    const { programme_id, name, description, price_monthly, price_oneshot, currency, type } = await req.json();
    const isOneshot = type === 'oneshot' || (!price_monthly && price_oneshot);
    const priceValue = isOneshot ? price_oneshot : price_monthly;
    if (!programme_id || !name || !priceValue) {
      return json({ error: 'programme_id, name, et un prix requis' }, 400);
    }
    const cents = Math.round(Number(priceValue) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return json({ error: 'Prix invalide' }, 400);

    // 2) Récupérer le programme et vérifier qu'il appartient au studio de l'appelant
    const { data: prog } = await supabase
      .from('programmes').select('*').eq('id', programme_id).maybeSingle();
    if (!prog) return json({ error: 'Programme introuvable' }, 404);
    if ((prog.studio_id ?? null) !== (caller.studio_id ?? null)) {
      return json({ error: 'Accès refusé — programme d\'un autre studio' }, 403);
    }

    // Récupérer le stripe_account_id du studio si programme d'un studio externe
    let stripeAccountId: string | null = null;
    if (prog.studio_id) {
      const { data: studio } = await supabase
        .from('studios')
        .select('stripe_account_id, stripe_onboarding_complete')
        .eq('id', prog.studio_id)
        .single();
      if (studio?.stripe_account_id && studio?.stripe_onboarding_complete) {
        stripeAccountId = studio.stripe_account_id;
      }
    }

    // Options Connect : si studio externe, créer sur son compte
    const connectOptions = stripeAccountId ? { stripeAccount: stripeAccountId } : {};

    let productId = prog.stripe_product_id as string | null;
    let priceId = prog.stripe_price_id as string | null;

    // Si on change de compte Connect (ou qu'on en a un maintenant), repartir de zéro
    if (stripeAccountId && productId) {
      try {
        await stripe.products.retrieve(productId, {}, connectOptions);
      } catch {
        productId = null;
        priceId = null;
      }
    }

    // 3) Créer ou MAJ le Product
    if (productId) {
      await stripe.products.update(productId, {
        name,
        description: description || undefined,
      }, connectOptions);
    } else {
      const product = await stripe.products.create({
        name,
        description: description || undefined,
        metadata: { programme_id, programme_slug: prog.slug || '' },
      }, connectOptions);
      productId = product.id;
    }

    // 4) Créer un nouveau Price si besoin
    let needNewPrice = !priceId;
    if (priceId) {
      try {
        const existing = await stripe.prices.retrieve(priceId, {}, connectOptions);
        const wasRecurring = !!existing.recurring;
        const modeChanged = wasRecurring === isOneshot;
        if (existing.unit_amount !== cents || existing.currency !== (currency || 'eur') || modeChanged) {
          await stripe.prices.update(priceId, { active: false }, connectOptions);
          needNewPrice = true;
        }
      } catch {
        needNewPrice = true;
      }
    }

    if (needNewPrice) {
      const priceParams: Stripe.PriceCreateParams = {
        product: productId,
        unit_amount: cents,
        currency: currency || 'eur',
        metadata: { programme_id, type: isOneshot ? 'oneshot' : 'subscription' },
      };
      if (!isOneshot) priceParams.recurring = { interval: 'month' };
      const price = await stripe.prices.create(priceParams, connectOptions);
      priceId = price.id;
    }

    // 5) Stocker en DB
    const updatePayload: Record<string, unknown> = {
      stripe_product_id: productId,
      stripe_price_id: priceId,
    };
    if (isOneshot) updatePayload.price_oneshot = Number(priceValue);
    else updatePayload.price_monthly = Number(priceValue);
    await supabase.from('programmes').update(updatePayload).eq('id', programme_id);

    return json({ ok: true, stripe_product_id: productId, stripe_price_id: priceId, connect: !!stripeAccountId });
  } catch (e) {
    console.error('create-stripe-product error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
