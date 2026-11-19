// Webhook Stripe de l'abonnement SaaS des studios.
// Évènements à cocher sur l'endpoint Stripe :
//   checkout.session.completed, invoice.payment_succeeded, invoice.payment_failed,
//   customer.subscription.updated, customer.subscription.deleted
//
// Statuts côté studios.billing_status :
//   active   — abonné (essai compris) et à jour
//   past_due — paiement refusé : délai de grâce (billing_grace_until), puis pause
//   paused   — accès des athlètes suspendu ; le coach garde la page Paramètres
// La pause effective à l'échéance est faite par la fonction SQL
// public.pause_overdue_studios() (pg_cron, quotidien).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { ensureSubscriptionTier, GRACE_DAYS, tierForCount, tierForPrice } from '../_shared/studio-tiers.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const ok = () => new Response(JSON.stringify({ received: true }), {
  headers: { 'Content-Type': 'application/json' },
});

const STUDIO_FIELDS = 'id, name, athlete_count, billing_exempt, billing_status, billing_grace_until, stripe_subscription_id';

// Retrouve le studio : metadata.studio_id d'abord, sinon le customer Stripe.
async function findStudio(studioId?: string | null, customerId?: string | null) {
  if (studioId) {
    const { data } = await supabase.from('studios').select(STUDIO_FIELDS).eq('id', studioId).maybeSingle();
    if (data) return data;
  }
  if (customerId) {
    const { data } = await supabase.from('studios').select(STUDIO_FIELDS).eq('stripe_customer_id', customerId).maybeSingle();
    if (data) return data;
  }
  return null;
}

async function markActive(studioId: string, subscriptionId: string | null, extra: Record<string, unknown> = {}) {
  await supabase.from('studios').update({
    billing_status: 'active',
    billing_grace_until: null,
    billing_paused_at: null,
    ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
    ...extra,
  }).eq('id', studioId);
}

async function markPastDue(studio: any) {
  const graceUntil = studio.billing_grace_until
    || new Date(Date.now() + GRACE_DAYS * 86400000).toISOString();
  await supabase.from('studios').update({
    billing_status: studio.billing_status === 'paused' ? 'paused' : 'past_due',
    billing_grace_until: graceUntil,
  }).eq('id', studio.id);
  console.log(`Studio ${studio.id} en retard de paiement — pause prévue le ${graceUntil}`);
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('STRIPE_BILLING_WEBHOOK_SECRET');
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  if (!sig || !secret) return new Response('Missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret, undefined, cryptoProvider);
  } catch (e) {
    console.error('Signature invalide :', (e as Error).message);
    return new Response('Invalid signature', { status: 400 });
  }

  console.log('Billing webhook:', event.type, event.id);

  try {
    switch (event.type) {
      // ── Checkout terminé : on enregistre l'abonnement ─────────────
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode !== 'subscription' || !s.subscription) break;
        const studio = await findStudio(s.metadata?.studio_id, s.customer as string);
        if (!studio) { console.log('Studio introuvable pour la session', s.id); break; }

        const subId = s.subscription as string;
        // Le nombre d'athlètes a pu bouger pendant le checkout
        const tier = tierForCount(studio.athlete_count || 0);
        try { await ensureSubscriptionTier(stripe, subId, tier); }
        catch (e) { console.error('ensureSubscriptionTier :', (e as Error).message); }

        await markActive(studio.id, subId, { plan_tier: tier, is_active: true });
        console.log(`Studio ${studio.name} abonné — palier ${tier}`);
        break;
      }

      // ── Facture payée (essai à 0 € compris) ────────────────────────
      case 'invoice.payment_succeeded': {
        const inv = event.data.object as Stripe.Invoice;
        if (!inv.subscription) break;
        const studio = await findStudio(
          inv.subscription_details?.metadata?.studio_id,
          inv.customer as string,
        );
        if (!studio) break;
        await markActive(studio.id, inv.subscription as string);
        break;
      }

      // ── Paiement refusé : délai de grâce ──────────────────────────
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        if (!inv.subscription) break;
        const studio = await findStudio(
          inv.subscription_details?.metadata?.studio_id,
          inv.customer as string,
        );
        if (!studio || studio.billing_exempt) break;
        await markPastDue(studio);
        break;
      }

      // ── Changement de palier ou de statut ─────────────────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const studio = await findStudio(sub.metadata?.studio_id, sub.customer as string);
        if (!studio) break;
        // Un ancien abonnement qui bouge ne doit pas écraser l'actuel
        if (studio.stripe_subscription_id && studio.stripe_subscription_id !== sub.id) break;

        const tier = tierForPrice(sub.items?.data?.[0]?.price);
        if (tier) await supabase.from('studios').update({ plan_tier: tier }).eq('id', studio.id);

        if (sub.status === 'active' || sub.status === 'trialing') {
          await markActive(studio.id, sub.id);
        } else if ((sub.status === 'past_due' || sub.status === 'unpaid') && !studio.billing_exempt) {
          await markPastDue(studio);
        }
        break;
      }

      // ── Abonnement terminé (résiliation ou impayé définitif) ──────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const studio = await findStudio(sub.metadata?.studio_id, sub.customer as string);
        if (!studio) break;
        if (studio.stripe_subscription_id && studio.stripe_subscription_id !== sub.id) break;

        const shouldPause = !studio.billing_exempt && (studio.athlete_count || 0) > 0;
        await supabase.from('studios').update({
          stripe_subscription_id: null,
          billing_grace_until: null,
          ...(shouldPause
            ? { billing_status: 'paused', billing_paused_at: new Date().toISOString() }
            : { billing_status: 'active' }),
        }).eq('id', studio.id);
        console.log(`Studio ${studio.name} : abonnement terminé${shouldPause ? ' — mis en pause' : ''}`);
        break;
      }
    }
  } catch (e) {
    // 500 → Stripe renverra l'évènement plus tard
    console.error('studio-billing-webhook error', e);
    return new Response('Error', { status: 500 });
  }

  return ok();
});
