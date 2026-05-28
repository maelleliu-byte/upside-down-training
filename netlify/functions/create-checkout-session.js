// netlify/functions/create-checkout-session.js
// Crée une session de paiement Stripe Checkout
// Le paiement va sur le compte Stripe du COACH, pas le tien

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
    // Vérifier l'utilisateur connecté via le token Supabase
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Non authentifié' })
      };
    }

    const { price_id, programme_slug } = JSON.parse(event.body);

    // Récupérer le programme et le stripe_account_id du studio
    const { data: prog } = await sb
      .from('programmes')
      .select('*, studios(slug, stripe_account_id, name)')
      .eq('stripe_price_id', price_id)
      .maybeSingle();

    const stripeAccountId =
      prog?.stripe_account_id ||
      prog?.studios?.stripe_account_id;

    if (!stripeAccountId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Stripe non configuré pour ce studio' })
      };
    }

    // URL de retour après paiement
    const appDomain = process.env.APP_DOMAIN || 'https://ton-app.netlify.app';
    const studioSlug = prog?.studios?.slug || programme_slug || '';
    const successUrl = `${appDomain}/${studioSlug}?success=1&prog=${programme_slug || ''}`;
    const cancelUrl  = `${appDomain}/${studioSlug}?canceled=1`;

    // Créer la session Checkout sur le compte du COACH
    const session = await stripe.checkout.sessions.create(
      {
        mode: prog?.type === 'oneshot' ? 'payment' : 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: price_id, quantity: 1 }],
        customer_email: user.email,
        success_url: successUrl,
        cancel_url: cancelUrl,
        ...(prog?.type !== 'oneshot' && {
          subscription_data: {
            trial_period_days: 14,
            metadata: {
              athlete_id: user.id,
              programme_slug: programme_slug || '',
              studio_id: prog?.studio_id || '',
            }
          }
        }),
        metadata: {
          athlete_id: user.id,
          programme_slug: programme_slug || '',
          studio_id: prog?.studio_id || '',
        }
      },
      { stripeAccount: stripeAccountId }  // ← paiement sur le compte du COACH
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url })
    };

  } catch (err) {
    console.error('create-checkout-session error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
