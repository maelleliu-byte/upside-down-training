const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const PRICE_TO_SLUG = {
  'price_1TThBIGfW5FegIxCy3Bd5zmi': 'affiliate',
  'price_1TThDzGfW5FegIxCGRb4q1tN': 'training'
};

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

  // Gérer les événements Stripe
  if (stripeEvent.type === 'checkout.session.completed' ||
      stripeEvent.type === 'invoice.payment_succeeded') {

    const session = stripeEvent.data.object;
    const customerEmail = session.customer_email || session.customer_details?.email;
    const priceId = session.lines?.data?.[0]?.price?.id ||
                    stripeEvent.data.object.lines?.data?.[0]?.pricing?.price_id;

    if (!customerEmail) {
      console.log('No email found in event');
      return { statusCode: 200, body: 'OK' };
    }

    const progSlug = PRICE_TO_SLUG[priceId];
    if (!progSlug) {
      console.log('No slug found for price:', priceId);
      return { statusCode: 200, body: 'OK' };
    }

    // Trouver l'athlète par email
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', customerEmail)
      .single();

    if (!profile) {
      console.log('No profile found for email:', customerEmail);
      return { statusCode: 200, body: 'OK' };
    }

    // Trouver le programme par slug
    const { data: programme } = await supabase
      .from('programmes')
      .select('id')
      .eq('slug', progSlug)
      .single();

    if (!programme) {
      console.log('No programme found for slug:', progSlug);
      return { statusCode: 200, body: 'OK' };
    }

    // Donner l'accès
    const { error } = await supabase
      .from('programme_access')
      .upsert({
        athlete_id: profile.id,
        programme_id: programme.id
      }, { onConflict: 'athlete_id,programme_id' });

    if (error) {
      console.error('Error granting access:', error);
      return { statusCode: 500, body: 'Error granting access' };
    }

    console.log(`Access granted to ${customerEmail} for ${progSlug}`);
  }

  // Gérer les résiliations
  if (stripeEvent.type === 'customer.subscription.deleted') {
    const subscription = stripeEvent.data.object;
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const customerId = subscription.customer;

    // Récupérer l'email via le customer Stripe
    const customer = await stripe.customers.retrieve(customerId);
    const customerEmail = customer.email;
    const progSlug = PRICE_TO_SLUG[priceId];

    if (customerEmail && progSlug) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', customerEmail)
        .single();

      const { data: programme } = await supabase
        .from('programmes')
        .select('id')
        .eq('slug', progSlug)
        .single();

      if (profile && programme) {
        await supabase
          .from('programme_access')
          .delete()
          .eq('athlete_id', profile.id)
          .eq('programme_id', programme.id);

        console.log(`Access revoked for ${customerEmail} from ${progSlug}`);
      }
    }
  }

  return { statusCode: 200, body: 'OK' };
};
