-- Vitrine publique des programmations : lecture anonyme limitée aux infos d'affichage
-- (nom, couleur, type, prix). Aucune séance, aucun athlète, aucun identifiant Stripe exposé.
create or replace function public.vitrine_programmes()
returns table (id uuid, slug text, name text, color text, type text,
               price_monthly numeric, price_oneshot numeric, is_free boolean, has_stripe boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.slug, p.name, p.color, p.type, p.price_monthly, p.price_oneshot,
         coalesce(p.is_free,false), p.stripe_price_id is not null
  from programmes p
  where p.is_active and p.studio_id is null
    and p.slug in ('training','affiliate','hyrox','3-days-prgm','running-club','fix-toes-to-bar','kids')
$$;
revoke all on function public.vitrine_programmes() from public;
grant execute on function public.vitrine_programmes() to anon, authenticated;
