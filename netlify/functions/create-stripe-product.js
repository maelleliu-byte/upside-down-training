// netlify/functions/create-stripe-product.js
// Crée un produit + prix Stripe sur le compte Connect du coach
// L'argent ira directement sur son compte, pas le tien

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
    const {
      programme_id,
      name,
      description,
      price_monthly,
      price_oneshot,
      currency = 'eur',
      type = 'subscription',
      stripe_account_id
    } = JSON.parse(event.body);

    if (!stripe_account_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Stripe non connecté pour ce studio. Va dans Paramètres → Stripe.' })
      };
    }

    // Créer le produit sur le compte Connect du coach (pas ton compte)
    const product = await stripe.products.create(
      {
        name,
        description: description || undefined,
        metadata: { programme_id }
      },
      { stripeAccount: stripe_account_id }  // ← sur le compte du COACH
    );

    let price;

    if (type === 'subscription' && price_monthly) {
      // Prix récurrent mensuel
      price = await stripe.prices.create(
        {
          product: product.id,
          unit_amount: Math.round(price_monthly * 100),
          currency,
          recurring: { interval: 'month' },
          trial_period_days: 14,
        },
        { stripeAccount: stripe_account_id }
      );
    } else if (type === 'oneshot' && price_oneshot) {
      // Prix unique
      price = await stripe.prices.create(
        {
          product: product.id,
          unit_amount: Math.round(price_oneshot * 100),
          currency,
        },
        { stripeAccount: stripe_account_id }
      );
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Prix manquant' })
      };
    }

    // Sauvegarder les IDs Stripe dans la DB
    await sb
      .from('programmes')
      .update({
        stripe_product_id: product.id,
        stripe_price_id: price.id,
        stripe_account_id: stripe_account_id,
      })
      .eq('id', programme_id);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: product.id,
        price_id: price.id,
        stripe_account_id,
      })
    };

  } catch (err) {
    console.error('create-stripe-product error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
