// netlify/functions/cancel-athlete-subscriptions.js
// Annule sur Stripe TOUS les abonnements actifs/trialing/impayés d'un athlète,
// avant que son profil ne soit supprimé côté admin.
//
// Sécurité :
//  - Vérifie le JWT envoyé par le front (Authorization: Bearer <access_token>)
//  - Relit le profil de l'appelant via ce JWT (pas fait confiance au body)
//  - Refuse si l'appelant n'est pas admin
//  - Refuse si l'athlète ciblé n'est pas dans le même studio que l'appelant
//    (sauf si l'appelant est admin Upside Down, studio_id = NULL, qui voit tout)
//  - Gère Stripe Connect : si l'abonnement appartient à un studio externe
//    (programmes.stripe_account_id renseigné), l'annulation est faite sur
//    le compte connecté correspondant, pas sur le compte plateforme.

const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Non authentifié' }) };
    }

    // 1) Identifier l'appelant à partir de son JWT
    const { data: callerAuth, error: callerErr } = await supabaseAdmin.auth.getUser(token);
    if (callerErr || !callerAuth?.user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Session invalide' }) };
    }
    const callerId = callerAuth.user.id;

    // 2) Charger le profil de l'appelant (rôle + studio)
    const { data: callerProfile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('role, studio_id')
      .eq('id', callerId)
      .single();
    if (profErr || !callerProfile) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Profil introuvable' }) };
    }
    if (callerProfile.role !== 'admin') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Réservé aux coachs/admins' }) };
    }
    const callerIsUpsideAdmin = callerProfile.studio_id === null || callerProfile.studio_id === undefined;

    // 3) Lire l'athlète ciblé
    const body = JSON.parse(event.body || '{}');
    const athleteId = body.athlete_id;
    if (!athleteId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'athlete_id requis' }) };
    }

    const { data: athleteProfile, error: athErr } = await supabaseAdmin
      .from('profiles')
      .select('id, studio_id')
      .eq('id', athleteId)
      .single();
    if (athErr || !athleteProfile) {
      // Profil déjà supprimé ou introuvable → rien à annuler, on ne bloque pas la suite
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, cancelled: [], errors: [], note: 'Athlète introuvable, rien à annuler' }) };
    }

    // 4) Vérifier que l'appelant a le droit de toucher à cet athlète (même studio)
    if (!callerIsUpsideAdmin && athleteProfile.studio_id !== callerProfile.studio_id) {
      return { statusCode: 403, body: JSON.stringify({ error: "Cet athlète n'appartient pas à ton studio" }) };
    }

    // 5) Récupérer ses abonnements Stripe actifs/en attente
    const { data: subs, error: subsErr } = await supabaseAdmin
      .from('stripe_subscriptions')
      .select('id, stripe_subscription_id, stripe_customer_id, programme_slug, status')
      .eq('user_id', athleteId)
      .in('status', ACTIVE_STATUSES);

    if (subsErr) {
      return { statusCode: 500, body: JSON.stringify({ error: subsErr.message }) };
    }
    if (!subs || subs.length === 0) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, cancelled: [], errors: [] }) };
    }

    // 6) Résoudre les comptes Stripe Connect concernés (studios externes)
    // Source la plus fiable : stripe_customers.stripe_account_id, indexé par
    // stripe_customer_id (un customer Stripe donné vit sur UN SEUL compte,
    // plateforme ou connecté — contrairement au programme, qui peut mal
    // orienter si plusieurs programmes/slugs se chevauchent).
    const { data: custRows } = await supabaseAdmin
      .from('stripe_customers')
      .select('stripe_customer_id, stripe_account_id')
      .eq('user_id', athleteId);
    const accountByCustomerId = {};
    (custRows || []).forEach(c => { accountByCustomerId[c.stripe_customer_id] = c.stripe_account_id || null; });

    // Repli : via programmes.stripe_account_id si le customer n'était pas connu
    const slugs = [...new Set(subs.map(s => s.programme_slug).filter(Boolean))];
    let accountBySlug = {};
    if (slugs.length) {
      const { data: progs } = await supabaseAdmin
        .from('programmes')
        .select('slug, stripe_account_id')
        .in('slug', slugs);
      (progs || []).forEach(p => { accountBySlug[p.slug] = p.stripe_account_id || null; });
    }

    const cancelled = [];
    const errors = [];

    for (const sub of subs) {
      // Compte candidat, du plus fiable au moins fiable
      const candidateAccounts = [];
      if (sub.stripe_customer_id in accountByCustomerId) candidateAccounts.push(accountByCustomerId[sub.stripe_customer_id]);
      if (sub.programme_slug && accountBySlug[sub.programme_slug] !== undefined) candidateAccounts.push(accountBySlug[sub.programme_slug]);
      candidateAccounts.push(null); // compte plateforme en dernier recours
      // Dédoublonne en gardant l'ordre
      const tried = new Set();
      const accounts = candidateAccounts.filter(a => { const k = a || '__platform__'; if (tried.has(k)) return false; tried.add(k); return true; });

      let resolvedAccount = undefined; // undefined = pas encore trouvé où vit l'abonnement
      let currentStatus = null;

      // 6a) Localiser l'abonnement : on essaie chaque compte candidat jusqu'à
      // en trouver un où Stripe le connaît réellement (retrieve, pas cancel,
      // pour ne rien modifier tant qu'on n'est pas sûr du bon compte).
      for (const acct of accounts) {
        try {
          const options = acct ? { stripeAccount: acct } : undefined;
          const s = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, options);
          resolvedAccount = acct;
          currentStatus = s.status;
          break;
        } catch (e) {
          if (e.code !== 'resource_missing') {
            // Erreur autre qu'"introuvable sur ce compte" → vraie erreur, on arrête là
            errors.push({ subscription_id: sub.stripe_subscription_id, error: e.message });
            resolvedAccount = null;
            break;
          }
          // sinon on continue d'essayer les autres comptes candidats
        }
      }

      if (resolvedAccount === null && currentStatus === null) {
        // Soit une vraie erreur déjà loguée ci-dessus, soit introuvable sur AUCUN
        // compte candidat (cas limite) → on le signale explicitement, on ne
        // suppose PAS que c'est déjà annulé.
        if (!errors.some(e => e.subscription_id === sub.stripe_subscription_id)) {
          errors.push({ subscription_id: sub.stripe_subscription_id, error: 'Introuvable sur les comptes Stripe testés (plateforme + Connect)' });
        }
        continue;
      }

      if (currentStatus === 'canceled') {
        cancelled.push(sub.stripe_subscription_id);
      } else {
        try {
          const options = resolvedAccount ? { stripeAccount: resolvedAccount } : undefined;
          await stripe.subscriptions.cancel(sub.stripe_subscription_id, {}, options);
          cancelled.push(sub.stripe_subscription_id);
        } catch (e) {
          console.error('Cancel error for', sub.stripe_subscription_id, e.message);
          errors.push({ subscription_id: sub.stripe_subscription_id, error: e.message });
          continue;
        }
      }

      // Reflète le nouveau statut localement (le profil sera de toute façon
      // supprimé juste après par le front, ce qui purge la table via CASCADE)
      await supabaseAdmin
        .from('stripe_subscriptions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', sub.id);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: errors.length === 0, cancelled, errors })
    };

  } catch (err) {
    console.error('cancel-athlete-subscriptions error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Erreur serveur' }) };
  }
};
