// netlify/functions/validate-child.js
// Lien cliqué par le coach dans le mail « Profil enfant à valider ».
// GET ?id=<enfant>&action=validate|refuse&sig=<hmac>
// Le lien est signé (HMAC) : pas besoin d'être connecté pour valider.

const { createClient } = require('@supabase/supabase-js');
const { send, template } = require('./lib/mailer');
const { checkSig, isKidEmail } = require('./lib/family');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const APP_URL = process.env.APP_URL || 'https://upside-down-training.netlify.app';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function page(titre, texte, ok, formulaire) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titre)}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#06100e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;padding:16px">
<div style="max-width:420px;width:100%;background:#0b1512;border-radius:16px;padding:28px 24px;text-align:center">
<div style="font-size:40px">${ok ? '✅' : '⚠️'}</div>
<div style="color:#fff;font-size:19px;font-weight:700;margin:10px 0 8px">${esc(titre)}</div>
<div style="color:#8aa5a0;font-size:14px;line-height:1.5">${esc(texte)}</div>
${formulaire || `<a href="${APP_URL}" style="display:inline-block;margin-top:20px;background:#2dd4bf;color:#06100e;text-decoration:none;font-weight:700;font-size:14px;padding:11px 20px;border-radius:10px">Ouvrir l'app</a>`}
</div></body></html>`,
  };
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const id = String(q.id || '');
  const action = q.action === 'refuse' ? 'refuse' : q.action === 'validate' ? 'validate' : '';
  if (!id || !action || !checkSig(id, action, q.sig)) {
    return page('Lien invalide', 'Ce lien de validation est incorrect ou incomplet.', false);
  }

  const { data: enfant } = await sb.from('profiles')
    .select('id, email, full_name, parent_id, child_status').eq('id', id).maybeSingle();
  if (!enfant || !enfant.parent_id || !isKidEmail(enfant.email)) {
    return page('Profil introuvable', 'Ce profil enfant n\'existe plus.', false);
  }

  // Un GET (clic dans le mail, ou robot anti-spam qui ouvre le lien) ne fait
  // qu'afficher la confirmation : seul le bouton (POST) change le statut.
  if (event.httpMethod !== 'POST') {
    const qs = `id=${encodeURIComponent(id)}&action=${action}&sig=${encodeURIComponent(q.sig)}`;
    const valider = action === 'validate';
    return page(valider ? `Valider ${enfant.full_name} ?` : `Refuser ${enfant.full_name} ?`,
      valider
        ? 'Le parent pourra passer sur ce profil et prendre l\'abonnement Kids & Teens.'
        : 'Le parent sera prévenu que le profil n\'est pas validé.',
      true,
      `<form method="POST" action="?${qs}" style="margin-top:20px"><button type="submit" style="font:inherit;border:0;cursor:pointer;background:${valider ? '#2dd4bf' : '#f85149'};color:#06100e;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">${valider ? '✅ Confirmer la validation' : 'Confirmer le refus'}</button></form>`);
  }

  const statut = action === 'validate' ? 'validated' : 'refused';
  if (enfant.child_status === statut) {
    return page(action === 'validate' ? 'Déjà validé' : 'Déjà refusé',
      `${enfant.full_name} est déjà ${action === 'validate' ? 'validé(e)' : 'refusé(e)'}.`, true);
  }

  const { error } = await sb.from('profiles').update({ child_status: statut }).eq('id', id);
  if (error) return page('Erreur', 'La mise à jour a échoué, réessaie dans un instant.', false);

  // On prévient le parent.
  const { data: parent } = await sb.from('profiles')
    .select('email, full_name').eq('id', enfant.parent_id).maybeSingle();
  if (parent?.email) {
    await send({
      to: [parent.email],
      subject: action === 'validate'
        ? `Le profil de ${enfant.full_name} est validé`
        : `Le profil de ${enfant.full_name} n'a pas été validé`,
      html: template(enfant.full_name,
        action === 'validate' ? 'Profil validé' : 'Profil non validé',
        action === 'validate'
          ? [['Bonne nouvelle', `Tu peux maintenant passer sur le profil de ${enfant.full_name} depuis l'app et prendre son abonnement Kids & Teens.`]]
          : [['Info', `Le coach n'a pas validé le profil de ${enfant.full_name}. Contacte ton coach pour en savoir plus.`]]),
    });
  }

  return action === 'validate'
    ? page('Profil validé', `${enfant.full_name} est validé(e). Le parent vient d'être prévenu par mail.`, true)
    : page('Profil refusé', `${enfant.full_name} a été refusé(e). Le parent vient d'être prévenu par mail.`, true);
};
