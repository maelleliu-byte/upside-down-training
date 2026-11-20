// Archive le produit + prix Stripe d'un programme (appelé avant sa suppression).
//
// Sécurité :
//  - JWT utilisateur obligatoire, appelant admin
//  - On reçoit un programme_id (jamais des IDs Stripe fournis par le client) :
//    les IDs à archiver sont relus en base, et le programme doit appartenir
//    au studio de l'appelant (studio_id NULL = Upside Down)
//  - Archivage sur le bon compte (compte Connect du studio si les IDs y sont)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Non authentifié' }, 401);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: 'Session invalide' }, 401);

    const { data: caller } = await supabase
      .from('profiles').select('role, studio_id').eq('id', user.id).maybeSingle();
    if (!caller || caller.role !== 'admin') return json({ error: 'Réservé aux coachs/admins' }, 403);

    const { programme_id } = await req.json();
    if (!programme_id) return json({ error: 'programme_id requis' }, 400);

    const { data: prog } = await supabase
      .from('programmes')
      .select('id, studio_id, stripe_product_id, stripe_price_id')
      .eq('id', programme_id)
      .maybeSingle();
    if (!prog) return json({ error: 'Programme introuvable' }, 404);
    if ((prog.studio_id ?? null) !== (caller.studio_id ?? null)) {
      return json({ error: 'Accès refusé — programme d\'un autre studio' }, 403);
    }
    if (!prog.stripe_product_id && !prog.stripe_price_id) return json({ ok: true, archived: false });

    // Les IDs peuvent être sur le compte Connect du studio ou sur le compte plateforme
    // (programme créé avant la connexion Stripe du studio) : on essaie les deux.
    const accounts: Array<Record<string, string>> = [];
    if (prog.studio_id) {
      const { data: studio } = await supabase
        .from('studios').select('stripe_account_id').eq('id', prog.studio_id).maybeSingle();
      if (studio?.stripe_account_id) accounts.push({ stripeAccount: studio.stripe_account_id });
    }
    accounts.push({});

    let archived = false;
    for (const opts of accounts) {
      try {
        if (prog.stripe_price_id) await stripe.prices.update(prog.stripe_price_id, { active: false }, opts);
        if (prog.stripe_product_id) await stripe.products.update(prog.stripe_product_id, { active: false }, opts);
        archived = true;
        break;
      } catch (e) {
        console.warn('archive', opts.stripeAccount || 'platform', (e as Error).message);
      }
    }
    return json({ ok: true, archived });
  } catch (e) {
    console.error('delete-stripe-product error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
