// netlify/functions/create-athlete.js
// Permet à un coach (role=admin) de créer directement un profil athlète
// dans SON studio, sans passer par le lien /register.
//
// Sécurité :
//  - Vérifie le JWT envoyé par le front (Authorization: Bearer <access_token>)
//  - Relit le profil de l'appelant via ce JWT (pas fait confiance au body)
//  - Refuse si l'appelant n'est pas admin
//  - Force studio_id = studio de l'appelant (jamais celui envoyé par le client)
//    → un admin externe ne peut jamais créer un athlète dans un autre studio

const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

    const callerStudioId = callerProfile.studio_id ?? null; // null = Upside Down

    // 3) Lire les données envoyées
    const body = JSON.parse(event.body || '{}');
    const email = (body.email || '').trim().toLowerCase();
    const fullName = (body.full_name || '').trim();
    const gender = body.gender || null; // 'male' | 'female' | null
    let password = body.password;

    if (!email || !fullName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email et nom complets requis' }) };
    }
    if (!password) {
      // Génère un mot de passe temporaire aléatoire si le coach n'en fournit pas
      password = 'Uds-' + Math.random().toString(36).slice(-8) + '!7';
    }

    // 4) Créer le compte auth (email confirmé directement — pas de mail à cliquer)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });
    if (createErr) {
      return { statusCode: 400, body: JSON.stringify({ error: createErr.message }) };
    }
    const newUserId = created.user.id;

    // 5) Créer/compléter le profil — studio_id FORCÉ à celui du coach appelant
    const { error: upsertErr } = await supabaseAdmin.from('profiles').upsert({
      id: newUserId,
      email,
      full_name: fullName,
      role: 'athlete',
      studio_id: callerStudioId,
      gender
    }, { onConflict: 'id' });

    if (upsertErr) {
      // rollback : supprime le compte auth orphelin pour ne pas polluer
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
      return { statusCode: 400, body: JSON.stringify({ error: upsertErr.message }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        athlete: { id: newUserId, email, full_name: fullName },
        temp_password: body.password ? null : password // renvoyé seulement si auto-généré
      })
    };

  } catch (err) {
    console.error('create-athlete error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Erreur serveur' }) };
  }
};
