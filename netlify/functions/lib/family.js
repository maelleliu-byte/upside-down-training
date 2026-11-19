// netlify/functions/lib/family.js
// Outils partagés des profils enfants (comptes rattachés à un parent).

const crypto = require('crypto');

// Les enfants n'ont pas d'email à eux : on leur en donne un technique,
// jamais utilisé pour écrire (Stripe et les mails passent par le parent).
const KID_DOMAIN = 'kids.upsidedown-training.fr';

function isKidEmail(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith('@' + KID_DOMAIN);
}

function kidEmail() {
  return 'enfant-' + crypto.randomBytes(9).toString('hex') + '@' + KID_DOMAIN;
}

// Signature des liens « Valider / Refuser » envoyés au coach par mail.
function secret() {
  const s = process.env.FAMILY_SECRET || process.env.NOTIFY_SECRET;
  if (!s) throw new Error('FAMILY_SECRET / NOTIFY_SECRET absent');
  return s;
}
function sign(childId, action) {
  return crypto.createHmac('sha256', secret()).update(childId + ':' + action).digest('hex');
}
function checkSig(childId, action, sig) {
  if (!sig || typeof sig !== 'string') return false;
  const a = Buffer.from(sign(childId, action));
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function ageFrom(birthDate) {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

module.exports = { KID_DOMAIN, isKidEmail, kidEmail, sign, checkSig, ageFrom };
