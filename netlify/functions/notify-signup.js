// netlify/functions/notify-signup.js
// Appelé par le trigger Postgres `trg_profiles_notify_signup` (pg_net)
// à chaque nouvelle ligne dans `profiles`.
//
// Variables d'env Netlify nécessaires :
//   NOTIFY_SECRET    -> même valeur que dans le trigger SQL
//   RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

const { createClient } = require('@supabase/supabase-js');
const { notifySignup } = require('./lib/mailer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Garde-fou : l'endpoint est public, on vérifie le secret partagé
  const secret =
    event.headers['x-notify-secret'] || event.headers['X-Notify-Secret'];
  if (!process.env.NOTIFY_SECRET || secret !== process.env.NOTIFY_SECRET) {
    console.warn('[notify-signup] secret invalide');
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: 'Bad JSON' };
  }

  const profileId = body.profile_id;
  if (!profileId) return { statusCode: 400, body: 'Missing profile_id' };

  // On relit le profil en base plutôt que de faire confiance au payload
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, studio_id')
    .eq('id', profileId)
    .maybeSingle();

  if (error || !profile) {
    console.error('[notify-signup] profil introuvable :', profileId, error?.message);
    return { statusCode: 200, body: 'OK' };
  }

  await notifySignup(supabase, profile);

  return { statusCode: 200, body: 'OK' };
};
