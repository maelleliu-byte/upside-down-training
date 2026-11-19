// Grille de facturation des studios (abonnement SaaS Upside Down).
// Source de vérité unique : studio-settings.html et la fonction SQL
// public.studio_tier_for_count() reprennent les mêmes seuils.
//
//   Starter : 1 à 10 athlètes   → 20 €/mois
//   Scale   : 11 à 29 athlètes  → 40 €/mois
//   Pro     : 30 athlètes et +  → 60 €/mois
//
// Les prix Stripe sont retrouvés par lookup_key et créés au premier besoin :
// aucun price_id à recopier à la main. Changer un montant = changer la
// lookup_key (ex. studio_pro_70eur) ; les abonnements en cours basculent
// sur le nouveau prix au prochain passage de sync-studio-billing-tiers.

import type Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

export type Tier = 'starter' | 'scale' | 'pro';

export const TIERS: Record<Tier, { label: string; amount: number; lookup_key: string; range: string }> = {
  starter: { label: 'Starter', amount: 2000, lookup_key: 'studio_starter_20eur', range: '1 à 10 athlètes' },
  scale:   { label: 'Scale',   amount: 4000, lookup_key: 'studio_scale_40eur',   range: '11 à 29 athlètes' },
  pro:     { label: 'Pro',     amount: 6000, lookup_key: 'studio_pro_60eur',     range: '30 athlètes et +' },
};

// Anciens prix (10 / 30 / 50 €) : reconnus pour lire le palier d'un abonnement
// existant, jamais utilisés pour en créer un.
const LEGACY_PRICE_TO_TIER: Record<string, Tier> = {
  'price_1Tfn7ZGfW5FegIxC8qWYOM8u': 'starter',
  'price_1Tfn7uGfW5FegIxCQuX6GlEU': 'scale',
  'price_1Tfn8BGfW5FegIxCvF7ycm6R': 'pro',
};

export const STUDIO_PRODUCT_ID = 'upside_studio_plan';

export function tierForCount(count: number): Tier {
  if (count <= 10) return 'starter';
  if (count <= 29) return 'scale';
  return 'pro';
}

export function tierForPrice(price: { id?: string; lookup_key?: string | null } | null | undefined): Tier | null {
  if (!price) return null;
  for (const [tier, t] of Object.entries(TIERS)) {
    if (price.lookup_key === t.lookup_key) return tier as Tier;
  }
  return (price.id && LEGACY_PRICE_TO_TIER[price.id]) || null;
}

const priceCache = new Map<Tier, string>();

async function ensureProduct(stripe: Stripe) {
  try {
    await stripe.products.retrieve(STUDIO_PRODUCT_ID);
  } catch {
    try {
      await stripe.products.create({ id: STUDIO_PRODUCT_ID, name: 'Upside Down — Abonnement studio' });
    } catch (e) {
      // Créé en parallèle par un autre appel : sans gravité
      if (!String((e as Error).message).includes('already exists')) throw e;
    }
  }
}

async function findPrice(stripe: Stripe, lookupKey: string): Promise<string | null> {
  const res = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  return res.data[0]?.id || null;
}

// Renvoie le price_id Stripe du palier, en le créant s'il n'existe pas encore.
export async function priceIdForTier(stripe: Stripe, tier: Tier): Promise<string> {
  const cached = priceCache.get(tier);
  if (cached) return cached;

  const t = TIERS[tier];
  let id = await findPrice(stripe, t.lookup_key);
  if (!id) {
    await ensureProduct(stripe);
    try {
      const price = await stripe.prices.create({
        product: STUDIO_PRODUCT_ID,
        currency: 'eur',
        unit_amount: t.amount,
        recurring: { interval: 'month' },
        lookup_key: t.lookup_key,
        nickname: `${t.label} — ${t.range}`,
        metadata: { tier },
      });
      id = price.id;
    } catch (e) {
      // lookup_key déjà prise par un appel concurrent : on relit
      id = await findPrice(stripe, t.lookup_key);
      if (!id) throw e;
    }
  }
  if (!id) throw new Error(`Prix Stripe introuvable pour ${tier}`);
  priceCache.set(tier, id);
  return id;
}

// Aligne l'abonnement Stripe sur le palier voulu (prorata immédiat).
// Renvoie true si le prix a changé.
export async function ensureSubscriptionTier(stripe: Stripe, subscriptionId: string, tier: Tier): Promise<boolean> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  if (['canceled', 'incomplete_expired'].includes(sub.status)) return false;
  const item = sub.items.data[0];
  const wantedPriceId = await priceIdForTier(stripe, tier);
  if (!item || item.price?.id === wantedPriceId) return false;

  await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: item.id, price: wantedPriceId }],
    proration_behavior: 'create_prorations',
    metadata: { ...sub.metadata, tier },
  });
  console.log(`Abonnement ${subscriptionId} : ${item.price?.id} → ${wantedPriceId} (${tier})`);
  return true;
}

// Délai laissé à un studio pour régulariser (pas encore abonné, ou paiement
// refusé) avant la mise en pause. Même valeur côté SQL (migration).
export const GRACE_DAYS = 14;

// Vérifie qu'un appel vient de la base (trigger / pg_cron) : l'en-tête
// x-internal-secret doit correspondre au secret du Vault.
let internalSecret: string | null = null;
export async function isInternalCall(
  req: Request,
  supabase: { rpc: (fn: string) => PromiseLike<{ data: unknown; error: unknown }> },
): Promise<boolean> {
  const given = req.headers.get('x-internal-secret');
  if (!given) return false;
  if (!internalSecret) {
    const { data, error } = await supabase.rpc('_internal_trigger_secret');
    if (error || typeof data !== 'string' || !data) {
      console.error('Secret interne illisible :', error);
      return false;
    }
    internalSecret = data;
  }
  return given === internalSecret;
}
