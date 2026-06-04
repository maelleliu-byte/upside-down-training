const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  webpush.setVapidDetails(
    'mailto:contact@upside-training.fr',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  console.log('[notif] supabase url:', process.env.SUPABASE_URL);
  console.log('[notif] env check:', {
    url: process.env.SUPABASE_URL ? 'OK' : 'MANQUANT',
    key: process.env.SUPABASE_SERVICE_KEY ? 'OK' : 'MANQUANT',
    vapidPub: process.env.VAPID_PUBLIC_KEY ? 'OK' : 'MANQUANT',
    vapidPriv: process.env.VAPID_PRIVATE_KEY ? 'OK' : 'MANQUANT',
  });

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { scoreId, type, fromName, fromUserId } = body;
  console.log('[notif] reçu:', { scoreId, type, fromName, fromUserId });

  if (!scoreId || !type || !fromUserId) {
    return { statusCode: 400, body: 'Missing fields' };
  }

  // Test fetch direct pour bypasser le client JS
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/wod_scores?id=eq.${scoreId}&select=athlete_id`,
    {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      }
    }
  );
  const rows = await res.json();
  console.log('[notif] fetch direct:', JSON.stringify(rows));

  // 1. Récupérer le propriétaire du score
  const { data: score, error: scoreErr } = await sb
    .from('wod_scores')
    .select('athlete_id')
    .eq('id', scoreId)
    .maybeSingle();

  console.log('[notif] wod_scores result:', JSON.stringify({ score, scoreErr }));

  if (!score) {
    // Utiliser le résultat du fetch direct si le client JS échoue
    if (rows && rows.length > 0) {
      console.log('[notif] using fetch direct result');
      rows[0].athlete_id && await sendNotification(rows[0].athlete_id, scoreId, type, fromName, fromUserId, sb);
    } else {
      console.log('[notif] score introuvable partout');
    }
    return { statusCode: 200, body: 'OK' };
  }

  await sendNotification(score.athlete_id, scoreId, type, fromName, fromUserId, sb);
  return { statusCode: 200, body: 'OK' };
};

async function sendNotification(athleteId, scoreId, type, fromName, fromUserId, sb) {
  if (athleteId === fromUserId) {
    console.log('[notif] self-interaction, skipped');
    return;
  }

  console.log('[notif] score owner:', athleteId);

  const { data: subs, error: subErr } = await sb
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', athleteId);

  console.log('[notif] subscriptions trouvées:', subs?.length ?? 0, subErr?.message);

  if (!subs || subs.length === 0) return;

  const webpush = require('web-push');
  const payload = JSON.stringify({
    title: type === 'like' ? "❤️ Quelqu'un a liké ton score !" : '💬 Nouveau commentaire !',
    body: type === 'like'
      ? `${fromName} a aimé ton score`
      : `${fromName} a commenté ton score`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `score-${type}-${scoreId}`,
  });

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(`[notif] envoyée OK → ${subs[i].endpoint.substring(0, 50)}...`);
    } else {
      console.log(`[notif] ERREUR → ${subs[i].endpoint.substring(0, 50)}... | ${r.reason?.statusCode} ${r.reason?.message}`);
    }
  });

  const expiredEndpoints = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected' && r.reason?.statusCode === 410) {
      expiredEndpoints.push(subs[i].endpoint);
    }
  });
  if (expiredEndpoints.length > 0) {
    await sb.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
  }
}
