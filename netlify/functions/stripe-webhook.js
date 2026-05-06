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

    const obj = stripeEvent.data.object;
    const customerEmail = obj.customer_email ||
                          obj.customer_details?.email ||
                          obj.customer_email;

    // Récupérer le priceId selon le type d'événement
    let priceId = null;
    if (stripeEvent.type === 'invoice.payment_succeeded') {
      priceId = obj.lines?.data?.[0]?.price?.id;
    } else {
      priceId = obj.lines?.data?.[0]?.price?.id;
    }

    // Si pas d'email direct, récupérer via customer Stripe
    let email = customerEmail;
    if (!email && obj.customer) {
      try {
        const customer = await stripe.customers.retrieve(obj.customer);
        email = customer.email;
      } catch(e) {
        console.log('Could not retrieve customer:', e.message);
      }
    }

    console.log('Email:', email, 'PriceId:', priceId);

    if (!email) {
      console.log('No email found');
      return { statusCode: 200, body: 'OK' };
    }

    const progSlug = PRICE_TO_SLUG[priceId];
    if (!progSlug) {
      console.log('No slug found for price:', priceId);
      return { statusCode: 200, body: 'OK' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!profile) {
      console.log('No profile for email:', email);
      return { statusCode: 200, body: 'OK' };
    }

    const { data: programme } = await supabase
      .from('programmes')
      .select('id')
      .eq('slug', progSlug)
      .single();

    if (!programme) {
      console.log('No programme for slug:', progSlug);
      return { statusCode: 200, body: 'OK' };
    }

    const { error } = await supabase
      .from('programme_access')
      .upsert({
        athlete_id: profile.id,
        programme_id: programme.id
      }, { onConflict: 'athlete_id,programme_id' });

    if (error) {
      console.error('Error granting access:', error);
      return { statusCode: 500, body: 'Error' };
    }

    console.log(`Access granted: ${email} → ${progSlug}`);
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
