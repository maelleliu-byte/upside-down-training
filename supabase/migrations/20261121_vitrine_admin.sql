-- Textes et photo de la vitrine, modifiables dans Admin → Programmations
alter table programmes
  add column if not exists vitrine_visible  boolean not null default false,
  add column if not exists vitrine_order    integer,
  add column if not exists vitrine_link     text,
  add column if not exists vitrine_title    text,
  add column if not exists vitrine_tagline  text,
  add column if not exists vitrine_chips    text[],
  add column if not exists vitrine_desc     text,
  add column if not exists vitrine_features text[],
  add column if not exists vitrine_photo    text,
  add column if not exists vitrine_pos      text;
create unique index if not exists programmes_vitrine_link_uniq on programmes (lower(vitrine_link)) where vitrine_link is not null;

-- Reprise des textes validés (uniquement si encore vides)
update programmes p set
  vitrine_visible = v.visible, vitrine_order = v.ord, vitrine_link = v.link, vitrine_title = v.title,
  vitrine_tagline = v.tag, vitrine_chips = v.chips, vitrine_desc = v.descr, vitrine_features = v.feats,
  vitrine_photo = v.photo, vitrine_pos = v.pos
from (values
 ('training', true, 1, 'training', 'TRAINING', 'Programmation des athlètes Upside Down.',
  array['Cycles structurés','5 à 6 séances / sem.'],
  'Une programmation accessible à tous, qui permet de progresser grâce à des cycles structurés, avec un accès et un échange direct avec le coach.',
  array['Suivi des performances','Périodisation structurée','Accès direct au coach','Groupe WhatsApp dédié'], '/img/progs/training.jpg', '55% 42%'),
 ('affiliate', true, 2, 'affiliate', 'AFFILIATE', 'Programmation générale CrossFit pour les salles.',
  array['Programmation salle','WOD quotidien','4 niveaux'],
  'Le WOD du jour et les blocs complémentaires, prêts à coacher : tips coach, targets et scaling pour chaque niveau.',
  array['WOD quotidien','Blocs supplémentaires : haltérophilie, gymnastique','Team WOD','Coaching tips & targets','Suivi des scores'], '/img/progs/affiliate.jpg', '50% 40%'),
 ('hyrox', true, 3, 'hyrox', 'HYROX', 'Prépare ta prochaine course hybride.',
  array['Solo','Force','Skill','Engine','Run'],
  'Une programmation HYROX en solo, pour les athlètes qui préparent une hybrid race ou un HYROX.',
  array['Séances course à pied spécifiques','Séances engine (ergo spécifique)','HYROX simulation','Skill','Force'], '/img/progs/hyrox.jpg', '50% 30%'),
 ('3-days-prgm', true, 4, '3days', E'3 DAYS\nPRGM', 'Maintenir ou développer ton fitness en 3 séances par semaine.',
  array['3 séances / sem.','45 à 75 min','Structure fixe','3 niveaux'],
  'Pour ceux qui veulent conserver ou développer leur fitness global avec un format court et régulier.',
  array['Force','Workouts','Scaling intégré : débutant, intermédiaire, avancé','Programmation basée sur les 3 modalités du CrossFit : monostructurel, gymnastique, haltérophilie'], '/img/progs/3days.jpg', '50% 30%'),
 ('running-club', true, 5, 'running', E'RUNNING\nCLUB', 'Courir plus vite, plus longtemps, sans se blesser.',
  array['2 à 4 séances / sem.','1 à 2 RUN','1 COMPROMISED RUN','1 RENFO CAP'],
  'Une programmation running construite sur tes allures : zones calculées depuis ta vitesse critique, tests réguliers pour suivre ta progression.',
  array['Séances calibrées','Allures personnalisées','Renfo spécifique course à pied','Tests et suivi des allures réguliers tout au long de l''année'], '/img/progs/running.jpg', '50% 38%'),
 ('fix-toes-to-bar', true, 6, 't2b', E'TOES\nTO BAR', 'Débloquer ton premier toes to bar et le rendre fiable.',
  array['3 séances / sem.','Programme ciblé','Achat unique'],
  'Programmation spécifique pour débloquer ton premier toes to bar et le rendre fiable.',
  array['Mobilité épaule + chaîne postérieure','Renfo abdos et fléchisseurs de hanche','Technique de kipping et progressions T2B'], '/img/progs/t2b.jpg', '45% 50%'),
 ('kids', false, 7, 'kids', E'KIDS\n& TEENS', 'Bouger, progresser et prendre confiance, de 8 à 16 ans.',
  array['8 – 16 ans','Fondamentaux','Coordination'],
  'Programmation jeunes athlètes, adaptée au développement de chacun.',
  array['Adapté au développement','Mouvements fondamentaux','Coordination & motricité','Suivi de la progression'], '/img/progs/kids.jpg', '30% 40%')
) as v(slug, visible, ord, link, title, tag, chips, descr, feats, photo, pos)
where p.slug = v.slug and p.studio_id is null and p.vitrine_title is null;

-- Fonction publique de la vitrine : lit les textes en base
drop function if exists public.vitrine_programmes();
create function public.vitrine_programmes()
returns table (id uuid, slug text, name text, color text, type text,
               price_monthly numeric, price_oneshot numeric, is_free boolean, has_stripe boolean,
               vitrine_order int, vitrine_link text, vitrine_title text, vitrine_tagline text,
               vitrine_chips text[], vitrine_desc text, vitrine_features text[], vitrine_photo text, vitrine_pos text)
language sql stable security definer set search_path = public as $$
  select p.id, p.slug, p.name, p.color, p.type, p.price_monthly, p.price_oneshot,
         coalesce(p.is_free,false), p.stripe_price_id is not null,
         p.vitrine_order, p.vitrine_link, p.vitrine_title, p.vitrine_tagline,
         p.vitrine_chips, p.vitrine_desc, p.vitrine_features, p.vitrine_photo, p.vitrine_pos
  from programmes p
  where p.is_active and p.studio_id is null and p.vitrine_visible
  order by p.vitrine_order nulls last, p.name
$$;
revoke all on function public.vitrine_programmes() from public;
grant execute on function public.vitrine_programmes() to anon, authenticated;

-- Photos de la vitrine (bucket public, écriture réservée aux admins)
insert into storage.buckets (id, name, public) values ('vitrine','vitrine',true) on conflict (id) do nothing;
drop policy if exists vitrine_read on storage.objects;
create policy vitrine_read on storage.objects for select using (bucket_id = 'vitrine');
drop policy if exists vitrine_admin_write on storage.objects;
create policy vitrine_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'vitrine' and exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (bucket_id = 'vitrine' and exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
