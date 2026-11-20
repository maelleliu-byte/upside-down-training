-- Séances perso écrites par un athlète : texte brut uniquement.
--
-- Un athlète peut créer / modifier ses propres séances perso (RLS
-- personal_sessions_athlete_*). Ces séances s'affichent chez son coach, et
-- certains champs (titre, consignes, couleur, lien YouTube…) sont injectés
-- dans le HTML par de nombreux écrans. On neutralise donc, côté base, tout ce
-- qu'un athlète écrit : plus de balises, plus de guillemets / chevrons, liens
-- http(s) uniquement, couleur au format #hex, champs JSON réservés au coach.
--
-- Le staff (admin du studio de l'athlète, admin Upside Down) et le serveur
-- (service_role) ne sont pas concernés : le contenu des coachs reste du HTML
-- mis en forme (il est nettoyé à l'affichage par DOMPurify).
-- En modification, seuls les champs changés sont neutralisés : un athlète qui
-- déplace une séance de son coach (date, ordre) ne touche pas à son contenu.

create or replace function public.plain_text(t text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case when t is null then null else
    translate(
      regexp_replace(
        regexp_replace(t, '<\s*br\s*/?\s*>|<\s*/\s*(p|div|li)\s*>', E'\n', 'gi'),
        '<[^>]*>', '', 'g'),
      '<>"''`', '‹›”’‘')
  end;
$function$;

create or replace function public.personal_sessions_guard_athlete_input()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if coalesce(auth.role(), '') = 'service_role' or auth.uid() is null then return new; end if;
  if public.is_staff_of(new.athlete_id) then return new; end if;

  if tg_op = 'INSERT' or new.title is distinct from old.title then new.title := plain_text(new.title); end if;
  if tg_op = 'INSERT' or new.content is distinct from old.content then new.content := plain_text(new.content); end if;
  if tg_op = 'INSERT' or new.type is distinct from old.type then new.type := plain_text(new.type); end if;
  if tg_op = 'INSERT' or new.target is distinct from old.target then new.target := plain_text(new.target); end if;
  if tg_op = 'INSERT' or new.tips is distinct from old.tips then new.tips := plain_text(new.tips); end if;
  if tg_op = 'INSERT' or new.score_type is distinct from old.score_type then new.score_type := plain_text(new.score_type); end if;
  if tg_op = 'INSERT' or new.youtube_label is distinct from old.youtube_label then new.youtube_label := plain_text(new.youtube_label); end if;
  if tg_op = 'INSERT' or new.scaling_inter is distinct from old.scaling_inter then new.scaling_inter := plain_text(new.scaling_inter); end if;
  if tg_op = 'INSERT' or new.scaling_scaled is distinct from old.scaling_scaled then new.scaling_scaled := plain_text(new.scaling_scaled); end if;
  if tg_op = 'INSERT' or new.scaling_foundation is distinct from old.scaling_foundation then new.scaling_foundation := plain_text(new.scaling_foundation); end if;
  if tg_op = 'INSERT' or new.score_labels is distinct from old.score_labels then new.score_labels := plain_text(new.score_labels); end if;
  if tg_op = 'INSERT' or new.score_label1 is distinct from old.score_label1 then new.score_label1 := plain_text(new.score_label1); end if;
  if tg_op = 'INSERT' or new.score_label2 is distinct from old.score_label2 then new.score_label2 := plain_text(new.score_label2); end if;
  if tg_op = 'INSERT' or new.score_note_label is distinct from old.score_note_label then new.score_note_label := plain_text(new.score_note_label); end if;

  if (tg_op = 'INSERT' or new.youtube_url is distinct from old.youtube_url)
     and new.youtube_url is not null and new.youtube_url !~ '^https?://[^\s<>"''`]+$' then
    new.youtube_url := null;
  end if;
  if (tg_op = 'INSERT' or new.color is distinct from old.color)
     and new.color is not null and new.color !~ '^#[0-9a-fA-F]{3,8}$' then
    new.color := null;
  end if;

  -- Champs structurés (vidéos, VBT, EF, kids) : réservés au coach.
  if tg_op = 'INSERT' then
    new.videos := null; new.vbt := null; new.ef := null; new.kids := null;
  else
    new.videos := old.videos; new.vbt := old.vbt; new.ef := old.ef; new.kids := old.kids;
  end if;
  return new;
end;
$function$;

revoke execute on function public.personal_sessions_guard_athlete_input() from public, anon, authenticated;

-- « aa_ » : les triggers BEFORE s'exécutent par ordre alphabétique ; celui-ci
-- passe avant ceux qui génèrent du contenu (VBT…).
drop trigger if exists aa_personal_sessions_guard_athlete on public.personal_sessions;
create trigger aa_personal_sessions_guard_athlete
  before insert or update on public.personal_sessions
  for each row execute function public.personal_sessions_guard_athlete_input();
