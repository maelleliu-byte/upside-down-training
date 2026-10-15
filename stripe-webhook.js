// netlify/functions/stripe-webhook.js
// Webhook Stripe — supporte multi-tenant (tous les studios)
// Plus besoin de table PRICE_TO_SLUG codée en dur

const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // ── PAIEMENT RÉUSSI ──────────────────────────────────────────
  if (
    stripeEvent.type === 'checkout.session.completed' ||
    stripeEvent.type === 'invoice.payment_succeeded'
  ) {
    const obj = stripeEvent.data.object;

    // Récupérer le priceId
    let priceId = null;
    const lineItem = obj.lines?.data?.[0];
    if (lineItem) {
      priceId = lineItem.price?.id || lineItem.plan?.id;
    }
    // Pour checkout.session.completed le price est dans les metadata ou line_items
    if (!priceId && obj.metadata?.price_id) {
      priceId = obj.metadata.price_id;
    }

    // Récupérer l'email
    let email = obj.customer_email || obj.customer_details?.email;
    if (!email && obj.customer) {
      try {
        const customer = await stripe.customers.retrieve(
          obj.customer,
          // Si c'est un compte Connect, préciser le stripeAccount
          stripeEvent.account ? { stripeAccount: stripeEvent.account } : {}
        );
        email = customer.email;
      } catch (e) {
        console.log('Could not retrieve customer:', e.message);
      }
    }

    // Récupérer athlete_id depuis les metadata (mis par create-checkout-session)
    const athleteId = obj.metadata?.athlete_id || null;

    console.log('Email:', email, 'PriceId:', priceId, 'AthleteId:', athleteId);

    if (!priceId) {
      console.log('No priceId found');
      return { statusCode: 200, body: 'OK' };
    }

    // Trouver le programme via stripe_price_id en DB (marche pour TOUS les studios)
    const { data: programme } = await supabase
      .from('programmes')
      .select('id, slug, studio_id')
      .eq('stripe_price_id', priceId)
      .maybeSingle();

    // Fallback : ancienne table PRICE_TO_SLUG pour tes programmes Upside Down existants
    const LEGACY_PRICE_TO_SLUG = {
      'price_1TThBIGfW5FegIxCy3Bd5zmi': 'affiliate',
      'price_1TThDzGfW5FegIxCGRb4q1tN': 'training',
      'price_1TVVEsGfW5FegIxCD0fssSlu': 'hyrox',
      'price_1TVVFiGfW5FegIxCmwl0GkBV': 'kids',
    };

    let programmeId = programme?.id;
    let studioId = programme?.studio_id;

    if (!programmeId) {
      // Essayer le fallback legacy
      const legacySlug = LEGACY_PRICE_TO_SLUG[priceId];
      if (legacySlug) {
        const { data: legacyProg } = await supabase
          .from('programmes')
          .select('id, studio_id')
          .eq('slug', legacySlug)
          .maybeSingle();
        programmeId = legacyProg?.id;
        studioId = legacyProg?.studio_id;
      }
    }

    if (!programmeId) {
      console.log('No programme found for price:', priceId);
      return { statusCode: 200, body: 'OK' };
    }

    // Trouver le profil : d'abord par athleteId (metadata), sinon par email
    let profileId = athleteId;
    if (!profileId && email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();
      profileId = profile?.id;
    }

    if (!profileId) {
      console.log('No profile found for email:', email);
      return { statusCode: 200, body: 'OK' };
    }

    // Donner l'accès
    const { error } = await supabase
      .from('programme_access')
      .upsert(
        { athlete_id: profileId, programme_id: programmeId },
        { onConflict: 'athlete_id,programme_id' }
      );

    if (error) {
      console.error('Error granting access:', error);
      return { statusCode: 500, body: 'Error' };
    }

    console.log(`✅ Accès accordé : ${email || profileId} → programme ${programmeId}`);
  }

  // ── RÉSILIATION ──────────────────────────────────────────────
  if (stripeEvent.type === 'customer.subscription.deleted') {
    const subscription = stripeEvent.data.object;
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const customerId = subscription.customer;

    let email = null;
    try {
      const customer = await stripe.customers.retrieve(
        customerId,
        stripeEvent.account ? { stripeAccount: stripeEvent.account } : {}
      );
      email = customer.email;
    } catch (e) {
      console.log('Could not retrieve customer for deletion:', e.message);
    }

    if (!priceId) {
      return { statusCode: 200, body: 'OK' };
    }

    // Trouver le programme
    let programmeId = null;
    let programmeSlug = null;
    let programmePriceId = null;
    const { data: programme } = await supabase
      .from('programmes')
      .select('id, slug, stripe_price_id')
      .eq('stripe_price_id', priceId)
      .maybeSingle();
    programmeId = programme?.id;
    programmeSlug = programme?.slug || null;
    programmePriceId = programme?.stripe_price_id || null;

    // Fallback legacy
    if (!programmeId) {
      const LEGACY_PRICE_TO_SLUG = {
        'price_1TThBIGfW5FegIxCy3Bd5zmi': 'affiliate',
        'price_1TThDzGfW5FegIxCGRb4q1tN': 'training',
        'price_1TVVEsGfW5FegIxCD0fssSlu': 'hyrox',
        'price_1TVVFiGfW5FegIxCmwl0GkBV': 'kids',
      };
      const legacySlug = LEGACY_PRICE_TO_SLUG[priceId];
      if (legacySlug) {
        const { data: legacyProg } = await supabase
          .from('programmes')
          .select('id, slug, stripe_price_id')
          .eq('slug', legacySlug)
          .maybeSingle();
        programmeId = legacyProg?.id;
        programmeSlug = legacyProg?.slug || null;
        programmePriceId = legacyProg?.stripe_price_id || null;
      }
    }

    if (!email || !programmeId) {
      console.log('Missing email or programme for deletion');
      return { statusCode: 200, body: 'OK' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (profile) {
      const subId = subscription.id;

      // L'abonnement est mort côté Stripe : on le marque résilié chez nous,
      // sinon une ligne « active » fantôme fausse tous les contrôles suivants.
      if (subId) {
        const { error: updErr } = await supabase
          .from('stripe_subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', subId);
        if (updErr) console.error('Maj statut abonnement:', updErr.message);
      }

      // GARDE-FOU : ne jamais révoquer si l'athlète a un AUTRE abonnement
      // actif ou en essai sur le MÊME programme (cas changement de carte :
      // le nouvel abo est créé, puis l'ancien finit par être supprimé).
      // Même logique que le trigger sync_programme_access en base.
      const { data: otherSubs, error: subsErr } = await supabase
        .from('stripe_subscriptions')
        .select('stripe_subscription_id, status, stripe_price_id, programme_slug')
        .eq('user_id', profile.id)
        .in('status', ['active', 'trialing']);

      if (subsErr) {
        // En cas de doute on ne touche à rien : mieux vaut un accès de trop
        // qu'un athlète coupé à tort.
        console.error('Lecture stripe_subscriptions impossible, révocation annulée:', subsErr.message);
        return { statusCode: 200, body: 'OK' };
      }

      const stillActive = (otherSubs || []).some((s) => {
        if (s.stripe_subscription_id === subId) return false;
        return s.programme_slug
          ? s.programme_slug === programmeSlug
          : (!!programmePriceId && s.stripe_price_id === programmePriceId);
      });

      if (stillActive) {
        console.log(`⏸️ Révocation ignorée : ${email} a encore un abonnement actif sur le programme ${programmeId}`);
        return { statusCode: 200, body: 'OK' };
      }

      // Révocation douce : on date la fin d'accès au lieu de supprimer la
      // ligne, comme le fait le trigger. L'historique est conservé et une
      // reprise d'abonnement remet simplement expires_at à NULL.
      const nowIso = new Date().toISOString();
      const { error: revErr } = await supabase
        .from('programme_access')
        .update({ expires_at: nowIso })
        .eq('athlete_id', profile.id)
        .eq('programme_id', programmeId)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

      if (revErr) {
        console.error('Erreur révocation accès:', revErr.message);
        return { statusCode: 500, body: 'Error' };
      }

      console.log(`🚫 Accès révoqué : ${email} → programme ${programmeId}`);
    }
  }

  return { statusCode: 200, body: 'OK' };
};
