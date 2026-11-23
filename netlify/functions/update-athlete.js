// netlify/functions/update-athlete.js
// Permet à un coach (role=admin) de corriger le nom et/ou l'adresse mail
// d'un compte de SON studio (faute de frappe à l'inscription, etc.).
//
// Sécurité :
//  - Vérifie le JWT envoyé par le front (Authorization: Bearer <access_token>)
//  - Relit le profil de l'appelant via ce JWT (pas fait confiance au body)
//  - Refuse si l'appelant n'est pas admin
//  - Refuse si le compte ciblé n'est pas dans le même studio que l'appelant
//    (studio_id null = Upside Down) → un admin ne touche jamais un autre studio
//  - L'email de connexion (auth.users) et celui du profil sont modifiés ensemble ;
//    si la mise à jour du profil échoue, l'email auth est remis à l'ancien.
//  - Stripe : les clients (customers) de l'athlète qui portent encore l'ancien
//    email sont mis à jour, sur le compte plateforme ou le compte Connect du
//    studio. Un échec Stripe ne bloque pas la correction du compte (signalé
//    dans la réponse).

const { createClient } = require('@supabase/supabase-js');
const { isKidEmail } = require('./lib/family');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const json = (statusCode, obj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(obj)
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json(401, { error: 'Non authentifié' });

    // 1) Identifier l'appelant
    const { data: callerAuth, error: callerErr } = await supabaseAdmin.auth.getUser(token);
    if (callerErr || !callerAuth?.user) return json(401, { error: 'Session invalide' });

    const { data: caller } = await supabaseAdmin
      .from('profiles')
      .select('role, studio_id')
      .eq('id', callerAuth.user.id)
      .single();
    if (!caller) return json(403, { error: 'Profil introuvable' });
    if (caller.role !== 'admin') return json(403, { error: 'Réservé aux coachs/admins' });

    // 2) Données envoyées
    const body = JSON.parse(event.body || '{}');
    const targetId = body.id;
    const fullName = (body.full_name || '').trim().replace(/\s+/g, ' ');
    const email = (body.email || '').trim().toLowerCase();
    if (!targetId) return json(400, { error: 'Compte non précisé' });
    if (!fullName) return json(400, { error: 'Le nom ne peut pas être vide' });

    // 3) Le compte ciblé doit appartenir au studio de l'appelant
    const { data: target } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, studio_id, parent_id')
      .eq('id', targetId)
      .single();
    if (!target) return json(404, { error: 'Compte introuvable' });
    if ((target.studio_id ?? null) !== (caller.studio_id ?? null)) {
      return json(403, { error: 'Ce compte n\'appartient pas à ton studio' });
    }

    const oldEmail = (target.email || '').toLowerCase();
    const emailChanged = !!email && email !== oldEmail;

    if (emailChanged) {
      // Profils enfants : l'email est technique (généré), on ne le modifie pas
      if (target.parent_id || isKidEmail(oldEmail)) {
        return json(400, { error: 'L\'email d\'un profil enfant ne se modifie pas' });
      }
      if (!EMAIL_RE.test(email)) return json(400, { error: 'Adresse mail invalide' });
    }

    // 4) Compte de connexion (auth.users)
    const authUpdate = { user_metadata: { full_name: fullName } };
    if (emailChanged) {
      authUpdate.email = email;
      authUpdate.email_confirm = true; // pas de mail de confirmation à cliquer
    }
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(targetId, authUpdate);
    if (authErr) {
      const msg = /already|exists|registered/i.test(authErr.message)
        ? 'Cette adresse mail est déjà utilisée par un autre compte'
        : authErr.message;
      return json(400, { error: msg });
    }

    // 5) Profil
    const profUpdate = { full_name: fullName };
    if (emailChanged) profUpdate.email = email;
    const { error: profErr } = await supabaseAdmin
      .from('profiles')
      .update(profUpdate)
      .eq('id', targetId);
    if (profErr) {
      // rollback de l'email de connexion pour garder auth et profil cohérents
      if (emailChanged) {
        await supabaseAdmin.auth.admin
          .updateUserById(targetId, { email: oldEmail, email_confirm: true })
          .catch(() => {});
      }
      return json(400, { error: profErr.message });
    }

    // 6) Stripe (seulement si l'email change)
    const stripeResult = emailChanged
      ? await updateStripeEmail(targetId, oldEmail, email)
      : { updated: 0, errors: [] };

    return json(200, {
      success: true,
      athlete: { id: targetId, full_name: fullName, email: emailChanged ? email : target.email },
      stripe: stripeResult
    });
  } catch (err) {
    console.error('update-athlete error:', err);
    return json(500, { error: err.message || 'Erreur serveur' });
  }
};

// Met à jour l'email des clients Stripe de l'athlète.
// Sources des customer IDs : stripe_customers (avec le compte Connect) puis
// stripe_subscriptions (compte déduit du programme). Pour chaque customer on
// essaie les comptes candidats jusqu'à trouver celui où il existe.
// On ne remplace que si l'email Stripe est vide ou égal à l'ancien : un email
// de facturation volontairement différent n'est pas écrasé.
async function updateStripeEmail(userId, oldEmail, newEmail) {
  const errors = [];
  let updated = 0;
  if (!process.env.STRIPE_SECRET_KEY) return { updated, errors: ['Clé Stripe absente'] };

  const candidates = {}; // customerId -> [account|null, ...]
  const add = (cid, acct) => {
    if (!cid) return;
    (candidates[cid] = candidates[cid] || []);
    if (!candidates[cid].includes(acct)) candidates[cid].push(acct);
  };

  const { data: custRows } = await supabaseAdmin
    .from('stripe_customers')
    .select('stripe_customer_id, stripe_account_id')
    .eq('user_id', userId);
  (custRows || []).forEach(c => add(c.stripe_customer_id, c.stripe_account_id || null));

  const { data: subs } = await supabaseAdmin
    .from('stripe_subscriptions')
    .select('stripe_customer_id, programme_slug')
    .eq('user_id', userId);
  const slugs = [...new Set((subs || []).map(s => s.programme_slug).filter(Boolean))];
  const accountBySlug = {};
  if (slugs.length) {
    const { data: progs } = await supabaseAdmin
      .from('programmes')
      .select('slug, stripe_account_id')
      .in('slug', slugs);
    (progs || []).forEach(p => { accountBySlug[p.slug] = p.stripe_account_id || null; });
  }
  (subs || []).forEach(s => {
    if (s.programme_slug && s.programme_slug in accountBySlug) add(s.stripe_customer_id, accountBySlug[s.programme_slug]);
  });
  Object.keys(candidates).forEach(cid => add(cid, null)); // plateforme en dernier recours

  for (const [cid, accounts] of Object.entries(candidates)) {
    let found = false;
    for (const acct of accounts) {
      const opts = acct ? { stripeAccount: acct } : undefined;
      try {
        const cust = await stripe.customers.retrieve(cid, opts);
        if (cust.deleted) { found = true; break; }
        found = true;
        const cur = (cust.email || '').toLowerCase();
        if (cur && cur !== oldEmail) break; // email de facturation différent : on n'y touche pas
        if (cur !== newEmail) {
          await stripe.customers.update(cid, { email: newEmail }, opts);
          updated++;
        }
        break;
      } catch (e) {
        if (e?.code === 'resource_missing') continue; // pas sur ce compte, on essaie le suivant
        found = true;
        errors.push(`${cid} : ${e.message}`);
        break;
      }
    }
    if (!found) errors.push(`${cid} : client introuvable sur Stripe`);
  }

  // Garder la copie locale cohérente
  await supabaseAdmin
    .from('stripe_customers')
    .update({ email: newEmail })
    .eq('user_id', userId)
    .eq('email', oldEmail)
    .then(() => {}, () => {});

  if (errors.length) console.warn('update-athlete stripe:', errors);
  return { updated, errors };
}
