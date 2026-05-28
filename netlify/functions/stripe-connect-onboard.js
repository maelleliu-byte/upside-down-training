// netlify/functions/stripe-connect-onboard.js
// Crée un compte Stripe Connect Express pour un nouveau coach
// et renvoie l'URL d'onboarding Stripe

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    const { studio_id, return_url, refresh_url } = JSON.parse(event.body);

    // Récupérer le studio
    const { data: studio, error: studioErr } = await sb
      .from('studios')
      .select('*')
      .eq('id', studio_id)
      .single();

    if (studioErr || !studio) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Studio introuvable' })
      };
    }

    let accountId = studio.stripe_account_id;

    // Créer le compte Stripe Connect Express si pas encore fait
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        email: studio.contact_email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: studio.name,
          url: studio.website || undefined,
        },
        metadata: {
          studio_id: studio_id,
          studio_slug: studio.slug,
        }
      });
      accountId = account.id;

      // Sauvegarder dans Supabase
      await sb
        .from('studios')
        .update({ stripe_account_id: accountId })
        .eq('id', studio_id);
    }

    // Générer le lien d'onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refresh_url,
      return_url: return_url,
      type: 'account_onboarding',
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: accountLink.url })
    };

  } catch (err) {
    console.error('stripe-connect-onboard error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
