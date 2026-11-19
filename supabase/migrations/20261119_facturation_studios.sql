-- Facturation des studios au nombre d'athlètes.
--
--   Starter 1–10 athlètes → 20 €/mois · Scale 11–29 → 40 €/mois · Pro 30+ → 60 €/mois
--   (montants et prix Stripe : supabase/functions/_shared/studio-tiers.ts)
--
-- Cycle de vie :
--   1er athlète inscrit, pas d'abonnement → mail d'invitation + délai de grâce de 14 j
--   abonnement (30 j d'essai)             → billing_status = 'active'
--   seuil franchi (10↔11, 29↔30)          → sync-studio-billing-tiers, prorata immédiat
--   paiement refusé                       → 'past_due' + délai de grâce de 14 j
--   délai dépassé / abonnement terminé    → 'paused' : les athlètes perdent l'accès
--
-- Appels base → edge functions : en-tête x-internal-secret, valeur stockée dans le
-- Vault ('internal_trigger_secret') et relue par les fonctions elles-mêmes
-- (aucune variable d'environnement à synchroniser). Création / rotation :
--   select vault.create_secret(encode(extensions.gen_random_bytes(24),'hex'), 'internal_trigger_secret');

-- ── Colonnes ────────────────────────────────────────────────────────
alter table public.studios
  add column if not exists billing_exempt boolean not null default false,
  add column if not exists billing_grace_until timestamptz;

alter table public.studios drop constraint if exists studios_billing_status_check;
alter table public.studios
  add constraint studios_billing_status_check
  check (billing_status in ('active', 'past_due', 'paused'));

-- Le studio Upside Down ne se facture pas à lui-même
update public.studios set billing_exempt = true where slug = 'upside';

-- ── Helpers ─────────────────────────────────────────────────────────
create or replace function public.studio_tier_for_count(n integer)
returns text language sql immutable as $$
  select case when coalesce(n, 0) <= 10 then 'starter'
              when n <= 29 then 'scale'
              else 'pro' end;
$$;

create or replace function public._internal_trigger_secret()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'internal_trigger_secret' limit 1;
$$;
revoke all on function public._internal_trigger_secret() from public, anon, authenticated;
-- Les edge functions internes comparent l'en-tête x-internal-secret à cette valeur
grant execute on function public._internal_trigger_secret() to service_role;

create or replace function public._call_internal_function(fn text, payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://tltqtpbaaxiwwpvuzszt.supabase.co/functions/v1/' || fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', public._internal_trigger_secret()
    ),
    body := payload
  );
end;
$$;
revoke all on function public._call_internal_function(text, jsonb) from public, anon, authenticated;

-- ── Verrou : un coach ne modifie pas sa facturation depuis le navigateur ──
-- La policy studios_update_owner autorise l'UPDATE de toute la ligne ; ces
-- colonnes ne bougent que via les edge functions (service_role), les fonctions
-- SECURITY DEFINER (compteur d'athlètes) ou le superadmin Upside Down.
create or replace function public.studios_guard_billing_cols()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not coalesce(public.is_upside_admin(), false) then
    if new.plan_tier              is distinct from old.plan_tier
    or new.athlete_count          is distinct from old.athlete_count
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.stripe_customer_id     is distinct from old.stripe_customer_id
    or new.billing_status         is distinct from old.billing_status
    or new.billing_paused_at      is distinct from old.billing_paused_at
    or new.billing_grace_until    is distinct from old.billing_grace_until
    or new.billing_invite_sent_at is distinct from old.billing_invite_sent_at
    or new.billing_exempt         is distinct from old.billing_exempt then
      raise exception 'Les champs de facturation du studio ne sont pas modifiables ici'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_studios_a_guard_billing on public.studios;
create trigger trg_studios_a_guard_billing
  before update on public.studios
  for each row execute function public.studios_guard_billing_cols();

-- ── Palier affiché + ouverture du délai de grâce ────────────────────
create or replace function public.trg_studios_billing_before()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.athlete_count is distinct from old.athlete_count then
    -- Sans abonnement, plan_tier suit le compteur (affichage). Avec abonnement,
    -- c'est le webhook qui l'écrit une fois Stripe à jour.
    if new.stripe_subscription_id is null then
      new.plan_tier := public.studio_tier_for_count(new.athlete_count);
    end if;

    -- Premier athlète d'un studio non abonné : 14 jours pour s'abonner
    if coalesce(old.athlete_count, 0) = 0 and new.athlete_count > 0
       and new.stripe_subscription_id is null
       and not new.billing_exempt
       and new.billing_grace_until is null
       and new.billing_status <> 'paused' then
      new.billing_grace_until := now() + interval '14 days';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_studios_billing_before on public.studios;
create trigger trg_studios_billing_before
  before update of athlete_count on public.studios
  for each row execute function public.trg_studios_billing_before();

-- ── Mail d'invitation (secret lu dans le Vault, studios exemptés ignorés) ──
create or replace function public.trg_notify_studio_billing_start()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(old.athlete_count, 0) = 0 and new.athlete_count > 0
     and new.owner_id is not null
     and new.stripe_subscription_id is null
     and new.billing_invite_sent_at is null
     and not new.billing_exempt then
    perform public._call_internal_function('notify-studio-billing-start', jsonb_build_object('studio_id', new.id));
  end if;
  return new;
end;
$$;

-- ── Seuil franchi sur un studio abonné → Stripe au prorata ──────────
create or replace function public.trg_studios_tier_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stripe_subscription_id is not null
     and not new.billing_exempt
     and public.studio_tier_for_count(new.athlete_count) is distinct from public.studio_tier_for_count(old.athlete_count) then
    perform public._call_internal_function('sync-studio-billing-tiers', jsonb_build_object('studio_id', new.id));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_studios_tier_changed on public.studios;
create trigger trg_studios_tier_changed
  after update of athlete_count on public.studios
  for each row execute function public.trg_studios_tier_changed();

-- ── Mise en pause à l'échéance du délai de grâce (quotidien) ────────
create or replace function public.pause_overdue_studios()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.studios
     set billing_status = 'paused', billing_paused_at = now()
   where not billing_exempt
     and billing_status <> 'paused'
     and billing_grace_until is not null
     and billing_grace_until < now()
     and (stripe_subscription_id is null or billing_status = 'past_due');
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.pause_overdue_studios() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pause-overdue-studios-daily') then
    perform cron.unschedule('pause-overdue-studios-daily');
  end if;
  if exists (select 1 from cron.job where jobname = 'sync-studio-billing-tiers-monthly') then
    perform cron.unschedule('sync-studio-billing-tiers-monthly');
  end if;
end $$;

select cron.schedule('pause-overdue-studios-daily', '15 3 * * *', 'select public.pause_overdue_studios();');
select cron.schedule('sync-studio-billing-tiers-monthly', '0 4 1 * *',
  $$select public._call_internal_function('sync-studio-billing-tiers', '{}'::jsonb);$$);
