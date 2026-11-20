-- Sécurité : accès aux tests de profilage + fonctions internes appelables via l'API.

-- 1) Tests L-V / PC / lactate (lv_tests, cp_tests, endurance_tests)
--    Avant : n'importe quel admin, de n'importe quel studio, pouvait lire, modifier
--    et supprimer les tests de TOUS les athlètes de la plateforme.
--    Après : l'athlète lui-même, son coach attitré, ou un admin de SON studio
--    (is_staff_of ; les admins Upside Down gardent l'accès global).
create or replace function public.lv_can_access(p_athlete uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p_athlete = auth.uid()
    or exists (select 1 from profiles p where p.id = p_athlete and p.coach_id = auth.uid())
    or public.is_staff_of(p_athlete);
$function$;

-- 2) Fonctions internes : appelées uniquement par des triggers SECURITY DEFINER
--    ou par pg_cron (rôle postgres), jamais par le front.
--    vbt_pct_load renvoyait le record (1RM…) de n'importe quel athlète, même sans
--    être connecté ; les autres permettaient de déclencher des recalculs / purges.
revoke execute on function public.vbt_pct_load(uuid, text, text, numeric) from public, anon, authenticated;
revoke execute on function public.update_studio_athlete_count(uuid) from public, anon, authenticated;
revoke execute on function public.recompute_studio_athlete_count(uuid) from public, anon, authenticated;
revoke execute on function public.purge_expired_programme_access() from public, anon, authenticated;
