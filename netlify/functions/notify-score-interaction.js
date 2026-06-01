const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

webpush.setVapidDetails(
  'mailto:contact@upside-training.fr',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { scoreId, type, fromName, fromUserId } = body;
  // type = 'like' | 'comment'

  if (!scoreId || !type || !fromUserId) {
    return { statusCode: 400, body: 'Missing fields' };
  }

  // 1. Récupérer le propriétaire du score
  const { data: score, error: scoreErr } = await sb
    .from('wod_scores')
    .select('athlete_id')
    .eq('id', scoreId)
    .single();

  if (scoreErr || !score) {
    return { statusCode: 404, body: 'Score not found' };
  }

  // Ne pas notifier si on like/commente son propre score
  if (score.athlete_id === fromUserId) {
    return { statusCode: 200, body: 'Self-interaction, skipped' };
  }

  // 2. Récupérer toutes les push subscriptions du propriétaire
  const { data: subs } = await sb
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', score.athlete_id);

  if (!subs || subs.length === 0) {
    return { statusCode: 200, body: 'No subscription found' };
  }

  // 3. Construire le payload de la notification
  const payload = JSON.stringify({
    title: type === 'like' ? '❤️ Quelqu\'un a liké ton score !' : '💬 Nouveau commentaire !',
    body: type === 'like'
      ? `${fromName} a aimé ton score`
      : `${fromName} a commenté ton score`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `score-${type}-${scoreId}`, // regroupe les notifs du même score
  });

  // 4. Envoyer à toutes les subscriptions (multi-device)
  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      )
    )
  );

  // Nettoyer les subscriptions expirées (410 Gone)
  const expiredEndpoints = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected' && r.reason?.statusCode === 410) {
      expiredEndpoints.push(subs[i].endpoint);
    }
  });
  if (expiredEndpoints.length > 0) {
    await sb
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints);
  }

  return { statusCode: 200, body: 'OK' };
};
