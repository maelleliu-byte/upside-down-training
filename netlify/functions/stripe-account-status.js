// netlify/functions/stripe-account-status.js
// Vérifie le statut d'un compte Stripe Connect (virements activés ?)

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
    const { stripe_account_id } = JSON.parse(event.body);

    if (!stripe_account_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'stripe_account_id requis' })
      };
    }

    const account = await stripe.accounts.retrieve(stripe_account_id);

    // Mettre à jour onboarding_complete en DB si tout est activé
    if (account.charges_enabled && account.payouts_enabled) {
      await sb
        .from('studios')
        .update({ stripe_onboarding_complete: true })
        .eq('stripe_account_id', stripe_account_id);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: account.id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        email: account.email,
        display_name: account.business_profile?.name,
        currency: account.default_currency,
        country: account.country,
      })
    };

  } catch (err) {
    console.error('stripe-account-status error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
