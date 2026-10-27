// netlify/functions/lib/mailer.js
// Notifications internes Upside Down Training — envoi via Resend.
// Utilisé par : notify-signup.js (trigger DB) et stripe-webhook.js (achat de prog).
//
// Variables d'env Netlify nécessaires :
//   RESEND_API_KEY   -> clé API Resend (la même que celle du SMTP Supabase)
//   NOTIFY_TO        -> destinataires admin, séparés par des virgules (optionnel)
//   NOTIFY_FROM      -> expéditeur (optionnel)

const RESEND_URL = 'https://api.resend.com/emails';

const FROM =
  process.env.NOTIFY_FROM ||
  'Upside Down Training <notifications@send.upsidedown-training.fr>';

const ADMINS = (process.env.NOTIFY_TO || 'upsidedowntraining0@gmail.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const APP_URL = process.env.APP_URL || 'https://upside-down-training.netlify.app';

// ── Helpers ────────────────────────────────────────────────────
function esc(v) {
  if (v === null || v === undefined || v === '') return '—';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function template(title, badge, rows) {
  const lines = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 0;color:#8aa5a0;font-size:13px;width:120px;vertical-align:top;">${esc(label)}</td>
          <td style="padding:6px 0;color:#ffffff;font-size:14px;font-weight:600;">${esc(value)}</td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="fr"><body style="margin:0;padding:24px;background:#06100e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#0b1512;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="padding:20px 24px;border-bottom:1px solid #1b2a26;">
        <div style="color:#2dd4bf;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">${esc(badge)}</div>
        <div style="color:#ffffff;font-size:19px;font-weight:700;margin-top:6px;">${esc(title)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lines}</table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 24px 24px;">
        <a href="${APP_URL}" style="display:inline-block;background:#2dd4bf;color:#06100e;text-decoration:none;font-weight:700;font-size:14px;padding:11px 20px;border-radius:10px;">Ouvrir l'app</a>
      </td>
    </tr>
  </table>
</body></html>`;
}

async function send({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[mailer] RESEND_API_KEY absent — email non envoyé :', subject);
    return;
  }
  if (!to || !to.length) {
    console.warn('[mailer] aucun destinataire pour :', subject);
    return;
  }
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error('[mailer] Resend', res.status, await res.text());
    } else {
      console.log('[mailer] envoyé →', to.join(', '), '|', subject);
    }
  } catch (e) {
    // Une notif ratée ne doit jamais faire échouer l'inscription ou le paiement
    console.error('[mailer] erreur réseau :', e.message);
  }
}

// Admins UDT + le coach du studio concerné (si studio externe)
async function recipientsFor(supabase, studioId) {
  const to = [...ADMINS];
  let studioName = 'Upside Down';
  if (studioId) {
    const { data } = await supabase
      .from('studios')
      .select('name, contact_email')
      .eq('id', studioId)
      .maybeSingle();
    if (data?.name) studioName = data.name;
    if (data?.contact_email) to.push(data.contact_email);
  }
  return { to: [...new Set(to.map((e) => e.toLowerCase()))], studioName };
}

// ── Notif 1 : nouvelle inscription ─────────────────────────────
async function notifySignup(supabase, profile) {
  const { to, studioName } = await recipientsFor(supabase, profile.studio_id);
  const who = profile.full_name || profile.email;
  const isCoach = profile.role === 'admin' || profile.role === 'coach';

  await send({
    to,
    subject: isCoach
      ? `Nouveau coach : ${who} (${studioName})`
      : `Nouvelle inscription : ${who} (${studioName})`,
    html: template(who, isCoach ? 'Nouveau coach' : 'Nouvelle inscription', [
      ['Nom', profile.full_name],
      ['Email', profile.email],
      ['Rôle', profile.role],
      ['Studio', studioName],
      ['Date', new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })],
    ]),
  });
}

// ── Notif 2 : prise de programme ───────────────────────────────
async function notifyPurchase(supabase, { profile, programme, renewal }) {
  const { to, studioName } = await recipientsFor(
    supabase,
    programme?.studio_id || profile.studio_id
  );
  const who = profile.full_name || profile.email;
  const progName = programme?.name || programme?.slug || 'Programme';
  const price =
    programme?.price_monthly != null
      ? `${programme.price_monthly} €/mois`
      : programme?.price_oneshot != null
      ? `${programme.price_oneshot} €`
      : null;

  await send({
    to,
    subject: renewal
      ? `Réactivation : ${who} → ${progName}`
      : `Nouvelle prog : ${who} → ${progName}`,
    html: template(
      `${who} → ${progName}`,
      renewal ? 'Accès réactivé' : 'Nouvelle prise de prog',
      [
        ['Athlète', profile.full_name],
        ['Email', profile.email],
        ['Programme', progName],
        ['Tarif', price],
        ['Studio', studioName],
        ['Date', new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })],
      ]
    ),
  });
}

module.exports = { send, template, notifySignup, notifyPurchase };
