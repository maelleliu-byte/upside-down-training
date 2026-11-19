-- Profils enfants rattachés à un parent (déjà appliqué en base le 19/11/2026).
alter table public.profiles
  add column if not exists parent_id uuid references public.profiles(id) on delete set null,
  add column if not exists birth_date date,
  add column if not exists child_status text check (child_status in ('pending','validated','refused'));
create index if not exists profiles_parent_id_idx on public.profiles(parent_id);

-- Le lien parent/enfant et la validation ne s'écrivent que côté serveur (clé service).
create or replace function public.profiles_guard_family_cols()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if coalesce(auth.role(),'') = 'service_role' then return new; end if;
  if tg_op = 'INSERT' then
    new.parent_id := null; new.child_status := null;
    return new;
  end if;
  if (new.parent_id is distinct from old.parent_id)
  or (new.child_status is distinct from old.child_status) then
    raise exception 'Lien parent / enfant modifiable uniquement par le serveur';
  end if;
  return new;
end;$$;
drop trigger if exists trg_profiles_guard_family on public.profiles;
create trigger trg_profiles_guard_family before insert or update on public.profiles
  for each row execute function public.profiles_guard_family_cols();
