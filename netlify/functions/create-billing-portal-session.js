// netlify/functions/create-billing-portal-session.js
// Crée une session Stripe Billing Portal pour qu'un athlète puisse gérer/résilier
// son abonnement lui-même. Fonctionne multi-tenant : si le programme appartient
// à un studio externe (Stripe Connect), on ouvre le portail sur le compte du coach ;
// sinon (studio_id NULL = Upside Down) on ouvre le portail sur le compte principal.

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
    // ── Auth ──────────────────────────────────────────────
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Non authentifié' }) };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const { programme_id } = body;

    // ── Récupérer les accès "abonnement" actifs de l'athlète ──
    const { data: accesses, error: accErr } = await sb
      .from('programme_access')
      .select('programme_id, programmes!inner(id, name, type, stripe_price_id, stripe_account_id, is_free)')
      .eq('athlete_id', user.id)
      .eq('programmes.type', 'subscription')
      .not('programmes.stripe_price_id', 'is', null);

    if (accErr) {
      console.error('accesses error:', accErr);
      return { statusCode: 500, body: JSON.stringify({ error: accErr.message }) };
    }

    let candidates = (accesses || []).map(a => a.programmes).filter(p => p && !p.is_free);

    if (!candidates.length) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Aucun abonnement payant actif trouvé.' })
      };
    }

    // Si plusieurs abonnements et qu'aucun programme_id précis n'est fourni,
    // on renvoie la liste pour que le front laisse l'athlète choisir.
    if (!programme_id && candidates.length > 1) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          choices: candidates.map(p => ({ programme_id: p.id, name: p.name }))
        })
      };
    }

    const targetProg = programme_id
      ? candidates.find(p => p.id === programme_id)
      : candidates[0];

    if (!targetProg) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Programme introuvable' }) };
    }

    const stripeAccountId = targetProg.stripe_account_id || null;
    const accountOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;

    // ── Retrouver le customer Stripe via l'email ──
    const customers = await stripe.customers.list(
      { email: user.email, limit: 1 },
      accountOpts
    );
    const customer = customers.data?.[0];

    if (!customer) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: "Impossible de retrouver ton compte de paiement Stripe. Contacte ton coach." })
      };
    }

    const appDomain = process.env.APP_DOMAIN || 'https://ton-app.netlify.app';

    const portalSession = await stripe.billingPortal.sessions.create(
      {
        customer: customer.id,
        return_url: `${appDomain}/`,
      },
      accountOpts
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: portalSession.url })
    };

  } catch (err) {
    console.error('create-billing-portal-session error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
