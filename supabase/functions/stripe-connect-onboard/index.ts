// Crée (si besoin) le compte Stripe Connect Standard du studio et renvoie le lien d'onboarding.
//
// Sécurité : JWT utilisateur obligatoire, réservé au propriétaire du studio
// (studios.owner_id). Le studio est déduit du profil, jamais du body.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Vérifier auth
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers: corsHeaders });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: 'Session invalide' }), { status: 401, headers: corsHeaders });

    // Récupérer le studio du coach
    const { data: profile } = await supabase
      .from('profiles')
      .select('studio_id')
      .eq('id', user.id)
      .single();

    if (!profile?.studio_id) {
      return new Response(JSON.stringify({ error: 'Aucun studio associé' }), { status: 400, headers: corsHeaders });
    }

    // stripe_account_id doit être lu ici, sinon un nouveau compte Connect
    // serait créé (et l'ancien écrasé) à chaque clic sur « Connecter Stripe ».
    const { data: studio } = await supabase
      .from('studios')
      .select('id, slug, name, owner_id, stripe_account_id')
      .eq('id', profile.studio_id)
      .single();

    if (!studio) return new Response(JSON.stringify({ error: 'Studio introuvable' }), { status: 404, headers: corsHeaders });

    // Vérifier que c'est bien le owner
    if (studio.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Accès refusé — propriétaire uniquement' }), { status: 403, headers: corsHeaders });
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
    const appUrl = Deno.env.get('APP_URL') || 'https://upside-down-training.netlify.app';

    let stripeAccountId = studio.stripe_account_id;

    if (!stripeAccountId) {
      const createRes = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          type: 'standard',
          'metadata[studio_id]': studio.id,
          'metadata[studio_slug]': studio.slug,
        }).toString(),
      });

      const account = await createRes.json();
      if (account.error) {
        console.error('Stripe account create error:', account.error);
        return new Response(JSON.stringify({ error: account.error.message }), { status: 500, headers: corsHeaders });
      }

      stripeAccountId = account.id;

      await supabase
        .from('studios')
        .update({ stripe_account_id: stripeAccountId, stripe_onboarding_complete: false })
        .eq('id', studio.id);
    }

    // Générer le lien d'onboarding Stripe
    const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        account: stripeAccountId,
        refresh_url: `${appUrl}/studio-settings?connect=refresh`,
        return_url: `${appUrl}/studio-settings?connect=success`,
        type: 'account_onboarding',
      }).toString(),
    });

    const link = await linkRes.json();
    if (link.error) {
      console.error('Stripe account link error:', link.error);
      return new Response(JSON.stringify({ error: link.error.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ url: link.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('stripe-connect-onboard error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
