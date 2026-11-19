// netlify/functions/family.js
// Profils enfants rattachés à un compte parent.
//
// POST { action: 'list' }                         → le parent + ses enfants
// POST { action: 'add', full_name, birth_date, gender }
//                                                 → crée l'enfant (en attente) et prévient le coach
// POST { action: 'switch', target_id }            → renvoie un token_hash pour se connecter
//                                                   sur un autre profil de la famille
//
// Sécurité :
//  - l'appelant est identifié par son JWT (Authorization: Bearer <access_token>)
//  - la famille est toujours recalculée en base, jamais lue dans le body
//  - on ne bascule que vers un membre de SA famille, et vers un enfant validé
//
// Variables d'env : SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY,
//                   NOTIFY_SECRET (ou FAMILY_SECRET), APP_URL (optionnel)

const { createClient } = require('@supabase/supabase-js');
const { send, template } = require('./lib/mailer');
const { kidEmail, sign, ageFrom } = require('./lib/family');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const APP_URL = process.env.APP_URL || 'https://app.upsidedown-training.fr';
const ADMINS = (process.env.NOTIFY_TO || 'upsidedowntraining0@gmail.com')
  .split(',').map((s) => s.trim()).filter(Boolean);

const COLS = 'id, email, full_name, gender, birth_date, parent_id, child_status, studio_id, avatar_url';
const MAX_ENFANTS = 8;

function out(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

async function caller(event) {
  const h = event.headers.authorization || event.headers.Authorization || '';
  const token = h.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: prof } = await sb.from('profiles').select(COLS).eq('id', data.user.id).maybeSingle();
  return prof || null;
}

// Le parent de la famille (lui-même s'il n'a pas de parent) et ses enfants.
async function famille(me) {
  const parentId = me.parent_id || me.id;
  const { data: parent } = me.parent_id
    ? await sb.from('profiles').select(COLS).eq('id', parentId).maybeSingle()
    : { data: me };
  const { data: enfants } = await sb.from('profiles').select(COLS)
    .eq('parent_id', parentId).order('created_at', { ascending: true });
  return { parent, enfants: enfants || [] };
}

function publique(p) {
  if (!p) return null;
  return {
    id: p.id, full_name: p.full_name, gender: p.gender, birth_date: p.birth_date,
    age: ageFrom(p.birth_date), avatar_url: p.avatar_url,
    child_status: p.child_status, est_enfant: !!p.parent_id,
  };
}

async function destinatairesCoach(studioId) {
  const to = [...ADMINS];
  let studioName = 'Upside Down';
  if (studioId) {
    const { data } = await sb.from('studios').select('name, contact_email').eq('id', studioId).maybeSingle();
    if (data?.name) studioName = data.name;
    if (data?.contact_email) to.push(data.contact_email);
  }
  return { to: [...new Set(to.map((e) => e.toLowerCase()))], studioName };
}

function bouton(href, label, couleur) {
  return `<a href="${href}" style="display:inline-block;background:${couleur};color:#06100e;text-decoration:none;font-weight:700;font-size:14px;padding:11px 20px;border-radius:10px;margin-right:8px">${label}</a>`;
}

async function mailValidation(parent, enfant) {
  const { to, studioName } = await destinatairesCoach(enfant.studio_id);
  const base = `${APP_URL}/.netlify/functions/validate-child?id=${enfant.id}`;
  const ok = `${base}&action=validate&sig=${sign(enfant.id, 'validate')}`;
  const ko = `${base}&action=refuse&sig=${sign(enfant.id, 'refuse')}`;
  const age = ageFrom(enfant.birth_date);
  let html = template(`${enfant.full_name} — profil enfant à valider`, 'Nouveau profil enfant', [
    ['Enfant', enfant.full_name],
    ['Âge', age != null ? `${age} ans` : null],
    ['Né(e) le', enfant.birth_date ? new Date(enfant.birth_date).toLocaleDateString('fr-FR') : null],
    ['Parent', parent.full_name],
    ['Email parent', parent.email],
    ['Studio', studioName],
  ]);
  // On remplace le bouton générique par Valider / Refuser.
  html = html.replace(/<a href="[^"]*"[^>]*>Ouvrir l'app<\/a>/,
    bouton(ok, '✅ Valider', '#2dd4bf') + bouton(ko, 'Refuser', '#8aa5a0'));
  await send({ to, subject: `Profil enfant à valider : ${enfant.full_name} (parent ${parent.full_name || parent.email})`, html });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return out(405, { error: 'Method Not Allowed' });
  let me;
  try { me = await caller(event); } catch (e) { me = null; }
  if (!me) return out(401, { error: 'Non authentifié' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return out(400, { error: 'JSON invalide' }); }

  try {
    if (body.action === 'list') {
      const f = await famille(me);
      return out(200, {
        moi: me.id,
        parent: publique(f.parent),
        enfants: f.enfants.map(publique),
      });
    }

    if (body.action === 'add') {
      // Un enfant n'ajoute pas d'enfant : il faut être sur le compte parent.
      if (me.parent_id) return out(403, { error: 'Reviens sur le profil parent pour ajouter un enfant.' });
      const fullName = String(body.full_name || '').trim().slice(0, 80);
      const birth = String(body.birth_date || '').trim();
      const gender = body.gender === 'male' || body.gender === 'female' ? body.gender : null;
      if (!fullName) return out(400, { error: 'Prénom et nom requis.' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return out(400, { error: 'Date de naissance requise.' });
      const age = ageFrom(birth);
      if (age == null || age < 4 || age > 17) return out(400, { error: 'Le profil enfant est prévu pour les 4-17 ans.' });

      const { count } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('parent_id', me.id);
      if ((count || 0) >= MAX_ENFANTS) return out(400, { error: 'Nombre maximum de profils enfants atteint.' });

      const email = kidEmail();
      const password = require('crypto').randomBytes(24).toString('base64url');
      const { data: created, error: cErr } = await sb.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: fullName, parent_id: me.id },
      });
      if (cErr) return out(400, { error: cErr.message });
      const kidId = created.user.id;

      const { data: enfant, error: uErr } = await sb.from('profiles').upsert({
        id: kidId, email, full_name: fullName, role: 'athlete',
        studio_id: me.studio_id ?? null, gender, birth_date: birth,
        parent_id: me.id, child_status: 'pending',
      }, { onConflict: 'id' }).select(COLS).single();
      if (uErr) {
        await sb.auth.admin.deleteUser(kidId).catch(() => {});
        return out(400, { error: uErr.message });
      }

      await mailValidation(me, enfant);
      return out(200, { enfant: publique(enfant) });
    }

    if (body.action === 'switch') {
      const targetId = String(body.target_id || '');
      const f = await famille(me);
      const membres = [f.parent, ...f.enfants].filter(Boolean);
      const cible = membres.find((m) => m.id === targetId);
      if (!cible || cible.id === me.id) return out(403, { error: 'Profil hors de ta famille.' });
      if (cible.parent_id && cible.child_status !== 'validated') {
        return out(403, { error: cible.child_status === 'refused'
          ? 'Ce profil a été refusé par le coach.'
          : 'Ce profil attend encore la validation du coach.' });
      }
      // Lien de connexion généré côté serveur : aucun mail n'est envoyé.
      const { data, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email: cible.email });
      if (error || !data?.properties?.hashed_token) return out(500, { error: 'Bascule impossible.' });
      return out(200, { token_hash: data.properties.hashed_token, type: 'magiclink' });
    }

    return out(400, { error: 'Action inconnue' });
  } catch (e) {
    console.error('[family]', e);
    return out(500, { error: 'Erreur serveur' });
  }
};
