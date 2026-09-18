// netlify/functions/empty-studio.js
// Vide un studio : supprime tous les profils rattachés (athlètes + coachs),
// annule leurs abonnements Stripe individuels, supprime leurs comptes Auth,
// puis supprime le contenu du studio (programmes, benchmarks, mouvements,
// cycle_plans, badges, movement_videos, session_type_colors) qui bloquerait
// sinon la suppression du studio (contraintes FK NO ACTION).
//
// Ne touche PAS à l'abonnement SaaS du studio lui-même (stripe_subscription_id
// sur studios) — ça reste géré séparément, volontairement, pour ne pas
// couper la facturation sans confirmation explicite.
//
// Sécurité : réservé au superadmin Upside Down (profile.role='admin' ET studio_id=NULL)

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
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Non authentifié' }) };

    const { data: callerAuth, error: callerErr } = await supabaseAdmin.auth.getUser(token);
    if (callerErr || !callerAuth?.user) return { statusCode: 401, body: JSON.stringify({ error: 'Session invalide' }) };

    const { data: callerProfile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('role, studio_id')
      .eq('id', callerAuth.user.id)
      .single();
    if (profErr || !callerProfile) return { statusCode: 403, body: JSON.stringify({ error: 'Profil introuvable' }) };
    const isUpsideSuperadmin = callerProfile.role === 'admin' && (callerProfile.studio_id === null || callerProfile.studio_id === undefined);
    if (!isUpsideSuperadmin) return { statusCode: 403, body: JSON.stringify({ error: 'Réservé au superadmin Upside Down' }) };

    const body = JSON.parse(event.body || '{}');
    const studioId = body.studio_id;
    if (!studioId) return { statusCode: 400, body: JSON.stringify({ error: 'studio_id requis' }) };

    const { data: studio, error: studioErr } = await supabaseAdmin
      .from('studios').select('id, name, slug').eq('id', studioId).single();
    if (studioErr || !studio) return { statusCode: 404, body: JSON.stringify({ error: 'Studio introuvable' }) };

    const deleted = { profiles: [], stripe_subs_cancelled: [], errors: [] };

    // 1) Tous les profils rattachés au studio (athlètes + coachs)
    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from('profiles').select('id, full_name, role').eq('studio_id', studioId);
    if (profilesErr) return { statusCode: 500, body: JSON.stringify({ error: profilesErr.message }) };

    for (const p of (profiles || [])) {
      // 1a) Annuler ses abonnements Stripe actifs (programmes athlète)
      const { data: subs } = await supabaseAdmin
        .from('stripe_subscriptions')
        .select('id, stripe_subscription_id')
        .eq('user_id', p.id)
        .in('status', ACTIVE_STATUSES);

      for (const sub of (subs || [])) {
        try {
          await stripe.subscriptions.cancel(sub.stripe_subscription_id);
        } catch (e) {
          if (e.code !== 'resource_missing') {
            deleted.errors.push({ profile: p.id, error: 'cancel sub: ' + e.message });
          }
        }
      }
      deleted.stripe_subs_cancelled.push(...(subs || []).map(s => s.stripe_subscription_id));

      // 1b) Supprimer le compte Auth (cascade sur profiles via FK id -> auth.users)
      const { error: delUserErr } = await supabaseAdmin.auth.admin.deleteUser(p.id);
      if (delUserErr) {
        deleted.errors.push({ profile: p.id, error: 'delete user: ' + delUserErr.message });
        continue;
      }
      deleted.profiles.push({ id: p.id, name: p.full_name, role: p.role });
    }

    // 2) Contenu du studio qui bloquerait sinon la suppression (FK NO ACTION)
    const contentTables = ['programmes', 'benchmarks', 'movements', 'cycle_plans', 'badges', 'movement_videos', 'session_type_colors'];
    const contentDeleted = {};
    for (const table of contentTables) {
      const { error, count } = await supabaseAdmin
        .from(table).delete({ count: 'exact' }).eq('studio_id', studioId);
      if (error) {
        deleted.errors.push({ table, error: error.message });
      } else {
        contentDeleted[table] = count || 0;
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: deleted.errors.length === 0,
        studio: studio.name,
        profiles_deleted: deleted.profiles,
        stripe_subs_cancelled: deleted.stripe_subs_cancelled,
        content_deleted: contentDeleted,
        errors: deleted.errors,
      }),
    };

  } catch (err) {
    console.error('empty-studio error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Erreur serveur' }) };
  }
};
