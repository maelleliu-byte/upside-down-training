// Mail envoyé au propriétaire d'un studio quand son premier athlète s'inscrit :
// il a GRACE_DAYS jours pour s'abonner avant la mise en pause du studio.
// Appelé par le trigger SQL trg_notify_studio_billing_start (x-internal-secret).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isInternalCall, TIERS } from '../_shared/studio-tiers.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('BILLING_FROM_EMAIL') || 'Upside Down Training <billing@upsidedown-training.fr>';
const APP_URL = Deno.env.get('APP_URL') || 'https://upside-down-training.netlify.app';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const eur = (cents: number) => `${cents / 100} €/mois`;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (!(await isInternalCall(req, supabase))) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const { studio_id } = await req.json();
    if (!studio_id) return new Response(JSON.stringify({ error: 'studio_id requis' }), { status: 400 });

    const { data: studio } = await supabase
      .from('studios')
      .select('id, name, slug, owner_id, contact_email, athlete_count, billing_invite_sent_at, billing_grace_until, billing_exempt')
      .eq('id', studio_id)
      .single();
    if (!studio) return new Response(JSON.stringify({ error: 'Studio introuvable' }), { status: 404 });
    if (studio.billing_invite_sent_at || studio.billing_exempt) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    let toEmail = studio.contact_email;
    if (!toEmail && studio.owner_id) {
      const { data: ownerAuth } = await supabase.auth.admin.getUserById(studio.owner_id);
      toEmail = ownerAuth?.user?.email || null;
    }
    if (!toEmail) {
      console.log(`Aucun email pour le studio ${studio_id}`);
      return new Response(JSON.stringify({ error: 'Aucun email trouvé' }), { status: 200 });
    }

    const settingsUrl = `${APP_URL}/${studio.slug}/settings`;
    const deadline = studio.billing_grace_until
      ? new Date(studio.billing_grace_until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;
    const grid = Object.values(TIERS).map((t) => `<li>${t.label} — ${t.range} — <strong>${eur(t.amount)}</strong></li>`).join('');

    if (RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: toEmail,
          subject: `${studio.name} — active ton abonnement Upside Down`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto">
              <h2>Ton premier athlète est inscrit 🎉</h2>
              <p>Ton studio <strong>${esc(studio.name)}</strong> compte maintenant ${studio.athlete_count} athlète(s) sur Upside Down Training.</p>
              <p>Active ton abonnement${deadline ? ` <strong>avant le ${deadline}</strong>` : ''} pour que tes athlètes gardent l'accès. Tu as 30 jours d'essai gratuit, puis le tarif suit ton nombre d'athlètes :</p>
              <ul>${grid}</ul>
              <p><a href="${settingsUrl}" style="display:inline-block;background:#e8ff47;color:#0a0a0a;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Activer mon abonnement</a></p>
              <p style="color:#888;font-size:13px">Ou copie ce lien : ${settingsUrl}</p>
            </div>`,
        }),
      });
      if (!res.ok) console.error('Resend error:', await res.text());
    } else {
      console.log(`RESEND_API_KEY absent — invitation non envoyée pour ${studio.name}`);
    }

    await supabase.from('studios').update({ billing_invite_sent_at: new Date().toISOString() }).eq('id', studio_id);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('notify-studio-billing-start error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});
