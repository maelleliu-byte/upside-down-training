import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Encode base64url
function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  const binary = atob(padded);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateVapidHeaders(endpoint: string, vapidPublic: string, vapidPrivate: string) {
  const audience = new URL(endpoint).origin;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp: expiration, sub: 'mailto:admin@upside-down.fr' };

  const encHeader  = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sigInput   = `${encHeader}.${encPayload}`;

  const keyData = base64urlToUint8Array(vapidPrivate);
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    // Wrap raw EC key in PKCS8 envelope
    (() => {
      const header = new Uint8Array([0x30,0x41,0x02,0x01,0x00,0x30,0x13,0x06,0x07,0x2a,0x86,0x48,0xce,0x3d,0x02,0x01,0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07,0x04,0x27,0x30,0x25,0x02,0x01,0x01,0x04,0x20]);
      const combined = new Uint8Array(header.length + keyData.length);
      combined.set(header); combined.set(keyData, header.length);
      return combined.buffer;
    })(),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(sigInput)
  );

  const jwt = `${sigInput}.${uint8ArrayToBase64url(new Uint8Array(sig))}`;
  return {
    Authorization: `vapid t=${jwt},k=${vapidPublic}`,
    'Content-Type': 'application/octet-stream',
  };
}

async function sendWebPush(subscription: { endpoint: string; p256dh: string; auth: string }, payload: string) {
  // Encrypt payload using ECDH + AES-GCM (Web Push encryption)
  const clientPublicKey = base64urlToUint8Array(subscription.p256dh);
  const clientAuth      = base64urlToUint8Array(subscription.auth);

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  );

  const clientKey = await crypto.subtle.importKey(
    'raw', clientPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, true, []
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey }, serverKeyPair.privateKey, 256
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF
  async function hkdf(ikm: ArrayBuffer, salt: Uint8Array, info: Uint8Array, length: number) {
    const key = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8
    ));
  }

  const prk = await hkdf(sharedBits, clientAuth,
    new TextEncoder().encode('Content-Encoding: auth\0'), 32);

  const keyInfo = new Uint8Array([
    ...new TextEncoder().encode('Content-Encoding: aesgcm\0'),
    0x00, 0x41, ...clientPublicKey,
    0x00, 0x41, ...serverPublicKeyRaw,
  ]);
  const nonceInfo = new Uint8Array([
    ...new TextEncoder().encode('Content-Encoding: nonce\0'),
    0x00, 0x41, ...clientPublicKey,
    0x00, 0x41, ...serverPublicKeyRaw,
  ]);

  const contentKey  = await hkdf(prk, salt, keyInfo, 16);
  const nonce       = await hkdf(prk, salt, nonceInfo, 12);

  const aesKey = await crypto.subtle.importKey('raw', contentKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const payloadBytes = new TextEncoder().encode(payload);
  const padded = new Uint8Array(payloadBytes.length + 2);
  padded.set(payloadBytes, 2);

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded)
  );

  const body = new Uint8Array(encrypted);

  const vapidHeaders = await generateVapidHeaders(subscription.endpoint, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const headers: Record<string, string> = {
    ...vapidHeaders,
    'Content-Encoding': 'aesgcm',
    'Encryption': `salt=${uint8ArrayToBase64url(salt)}`,
    'Crypto-Key': `dh=${uint8ArrayToBase64url(serverPublicKeyRaw)};vapid=${VAPID_PUBLIC_KEY}`,
    'Content-Type': 'application/octet-stream',
    'TTL': '86400',
  };

  const resp = await fetch(subscription.endpoint, { method: 'POST', headers, body });
  return resp;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  }

  try {
    const { athlete_id, badge_emoji, badge_name, coach_note } = await req.json();

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Récupérer les subscriptions de l'athlète
    const { data: subs } = await sb
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', athlete_id);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const payload = JSON.stringify({
      title: `${badge_emoji} Badge débloqué !`,
      body: coach_note ? `${badge_name} — "${coach_note}"` : badge_name,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        const resp = await sendWebPush(sub, payload);
        if (resp.status === 410 || resp.status === 404) {
          // Subscription expirée — supprimer
          await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        } else {
          sent++;
        }
      } catch (e) {
        console.error('Push error:', e);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});
