-- BETWISE — migration 0001 : schéma V1 dans un schéma dédié « betwise »
-- Cloisonnement : aucun objet dans public, aucun déclencheur sur auth.users.
-- Copie exacte de la migration appliquée le 2026-11-09 sur arbitre-finance (version 20261109093043).
create schema if not exists betwise;
set search_path to betwise, public;

create type betwise.source_type as enum ('perso','tipster','page_facebook','compte_instagram','canal_telegram','site','modele_betwise');
create type betwise.source_visibility as enum ('privee','partagee');
create type betwise.prediction_status as enum ('verifie','declare','annule');
create type betwise.settle_result as enum ('en_attente','gagne','perdu','rembourse');
create type betwise.risk_category as enum ('prudent','moyen','risque');
create type betwise.bet_type as enum ('simple','combine');
create type betwise.bet_status as enum ('en_cours','gagne','perdu','rembourse','annule');
create type betwise.import_channel as enum ('manuel','texte','capture','prono','telegram');
create type betwise.tx_type as enum ('depot','retrait','mise','gain','ajustement');
create type betwise.match_status as enum ('programme','en_cours','termine','reporte','annule');
create type betwise.eval_status as enum ('tendance','provisoire','evalue');
create type betwise.metric_axis as enum ('marche','competition','risque');

create table betwise.competitions (
  id uuid primary key default gen_random_uuid(),
  code_externe text unique,
  nom text not null,
  pays text,
  saison text not null,
  couverte_auto boolean not null default false,
  created_at timestamptz not null default now()
);
create table betwise.teams (
  id uuid primary key default gen_random_uuid(),
  code_externe text unique,
  nom text not null,
  alias text[] not null default '{}',
  competition_id uuid references betwise.competitions(id),
  created_at timestamptz not null default now()
);
create index teams_alias_gin on betwise.teams using gin (alias);
create table betwise.matches (
  id uuid primary key default gen_random_uuid(),
  code_externe text unique,
  competition_id uuid not null references betwise.competitions(id),
  home_team_id uuid not null references betwise.teams(id),
  away_team_id uuid not null references betwise.teams(id),
  kickoff_at timestamptz not null,
  statut betwise.match_status not null default 'programme',
  score_home smallint,
  score_away smallint,
  source_resultat text,
  result_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index matches_kickoff_idx on betwise.matches (kickoff_at);
create index matches_statut_idx on betwise.matches (statut);
create table betwise.markets (
  code text primary key,
  libelle_fr text not null,
  a_parametre boolean not null default false,
  version smallint not null default 1
);
insert into betwise.markets (code, libelle_fr, a_parametre) values
  ('1X2','Résultat du match',false),('DC','Double chance',false),('DNB','Remboursé si nul',false),
  ('OU','Plus / Moins de buts',true),('BTTS','Les deux équipes marquent',false),
  ('AH','Handicap asiatique',true),('CS','Score exact',false);

create table betwise.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pseudo text not null,
  devise text not null default 'XOF',
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);
create table betwise.bankrolls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  capital_initial numeric(14,2) not null default 0,
  devise text not null default 'XOF',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index bankrolls_one_active_per_user on betwise.bankrolls (user_id) where active;
create table betwise.user_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mise_max numeric(14,2),
  perte_max_jour numeric(14,2),
  perte_max_semaine numeric(14,2),
  nb_paris_max_jour smallint,
  valid_from timestamptz not null default now()
);
create index user_limits_user_idx on betwise.user_limits (user_id, valid_from desc);

create table betwise.sources (
  id uuid primary key default gen_random_uuid(),
  type betwise.source_type not null,
  nom text not null,
  identifiant_externe text,
  description text,
  visibilite betwise.source_visibility not null default 'privee',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index sources_perso_unique on betwise.sources (created_by) where type = 'perso';
create index sources_visibilite_idx on betwise.sources (visibilite);
create table betwise.source_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references betwise.sources(id) on delete cascade,
  followed_at timestamptz not null default now(),
  primary key (user_id, source_id)
);
create table betwise.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  kind text not null check (kind in ('ticket','prono')),
  json_extrait jsonb,
  confiance jsonb,
  corrections jsonb,
  created_at timestamptz not null default now()
);
create table betwise.predictions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references betwise.sources(id),
  match_id uuid references betwise.matches(id),
  match_libre text,
  market_code text not null references betwise.markets(code),
  market_param numeric(5,2),
  selection text not null,
  cote_annoncee numeric(7,3),
  probabilite_annoncee numeric(5,4),
  risque_annonce betwise.risk_category,
  risque_calcule betwise.risk_category,
  published_at timestamptz,
  logged_at timestamptz not null default now(),
  statut betwise.prediction_status not null default 'declare',
  motif_annulation text,
  submitted_by uuid references auth.users(id) on delete set null,
  upload_id uuid references betwise.uploads(id),
  resultat betwise.settle_result not null default 'en_attente',
  settled_at timestamptz,
  dedupe_key text
);
create unique index predictions_dedupe on betwise.predictions (dedupe_key);
create index predictions_source_idx on betwise.predictions (source_id, logged_at desc);
create index predictions_match_idx on betwise.predictions (match_id);
create table betwise.prediction_versions (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references betwise.predictions(id) on delete cascade,
  changes jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create table betwise.odds_observations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references betwise.matches(id),
  market_code text not null references betwise.markets(code),
  market_param numeric(5,2),
  selection text not null,
  cote numeric(7,3) not null,
  bookmaker text,
  origine text not null check (origine in ('ticket','saisie','api')),
  observed_at timestamptz not null default now(),
  observed_by uuid references auth.users(id) on delete set null
);
create index odds_match_idx on betwise.odds_observations (match_id, market_code);

create table betwise.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bankroll_id uuid not null references betwise.bankrolls(id),
  type betwise.bet_type not null default 'simple',
  mise numeric(14,2) not null check (mise > 0),
  cote_totale numeric(9,3),
  statut betwise.bet_status not null default 'en_cours',
  gain_net numeric(14,2),
  placed_at timestamptz not null default now(),
  source_import betwise.import_channel not null default 'manuel',
  raw_text text,
  upload_id uuid references betwise.uploads(id),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);
create index bets_user_idx on betwise.bets (user_id, placed_at desc);
create table betwise.bet_selections (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references betwise.bets(id) on delete cascade,
  match_id uuid references betwise.matches(id),
  match_libre text,
  market_code text not null references betwise.markets(code),
  market_param numeric(5,2),
  selection text not null,
  cote numeric(7,3) not null,
  cote_observed_at timestamptz not null default now(),
  origin_source_id uuid not null references betwise.sources(id),
  prediction_id uuid references betwise.predictions(id),
  risque_calcule betwise.risk_category,
  resultat betwise.settle_result not null default 'en_attente',
  settled_at timestamptz
);
create index bet_selections_bet_idx on betwise.bet_selections (bet_id);
create index bet_selections_match_idx on betwise.bet_selections (match_id);
create index bet_selections_origin_idx on betwise.bet_selections (origin_source_id);
create table betwise.bankroll_transactions (
  id uuid primary key default gen_random_uuid(),
  bankroll_id uuid not null references betwise.bankrolls(id) on delete cascade,
  type betwise.tx_type not null,
  montant numeric(14,2) not null,
  bet_id uuid references betwise.bets(id),
  note text,
  at timestamptz not null default now()
);
create index bankroll_tx_idx on betwise.bankroll_transactions (bankroll_id, at desc);

create table betwise.source_metrics (
  source_id uuid not null references betwise.sources(id) on delete cascade,
  periode text not null check (periode in ('30j','90j','180j','total')),
  nb_declares integer not null default 0,
  nb_verifies integer not null default 0,
  nb_gagnes integer not null default 0,
  nb_regles integer not null default 0,
  taux_reussite numeric(5,4),
  rendement numeric(7,4),
  ic_bas numeric(7,4),
  ic_haut numeric(7,4),
  pire_serie numeric(7,4),
  statut_eval betwise.eval_status not null default 'tendance',
  computed_at timestamptz not null default now(),
  primary key (source_id, periode)
);
create table betwise.source_metrics_by_axis (
  source_id uuid not null references betwise.sources(id) on delete cascade,
  periode text not null,
  axe betwise.metric_axis not null,
  valeur text not null,
  nb_declares integer not null default 0,
  nb_gagnes integer not null default 0,
  rendement numeric(7,4),
  computed_at timestamptz not null default now(),
  primary key (source_id, periode, axe, valeur)
);
create table betwise.model_estimates (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references betwise.matches(id),
  market_code text not null references betwise.markets(code),
  market_param numeric(5,2),
  selection text not null,
  probabilite numeric(5,4) not null,
  cote_reference numeric(7,3),
  niveau_risque smallint check (niveau_risque between 1 and 5),
  justification jsonb,
  model_version text not null,
  prediction_id uuid references betwise.predictions(id),
  created_at timestamptz not null default now()
);
create index model_estimates_match_idx on betwise.model_estimates (match_id);

create table betwise.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titre text,
  created_at timestamptz not null default now()
);
create table betwise.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references betwise.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool')),
  contenu text,
  fonctions jsonb,
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz not null default now()
);
create index messages_conv_idx on betwise.messages (conversation_id, created_at);
create table betwise.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  ecran text,
  message text not null,
  created_at timestamptz not null default now()
);

create or replace function betwise.risk_from_odds(c numeric)
returns betwise.risk_category language sql immutable as $$
  select case when c is null then null
              when c < 1.50 then 'prudent'::betwise.risk_category
              when c <= 2.20 then 'moyen'::betwise.risk_category
              else 'risque'::betwise.risk_category end
$$;

create or replace function betwise.is_admin()
returns boolean language sql stable security definer set search_path = betwise, public as $$
  select exists (select 1 from betwise.profiles where user_id = auth.uid() and role = 'admin')
$$;

create or replace function betwise.ensure_profile(p_pseudo text default null)
returns betwise.profiles language plpgsql security definer set search_path = betwise, public as $$
declare uid uuid := auth.uid(); p betwise.profiles;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  insert into betwise.profiles (user_id, pseudo)
  values (uid, coalesce(p_pseudo, (select split_part(coalesce(email,''),'@',1) from auth.users where id = uid), 'joueur'))
  on conflict (user_id) do nothing;
  insert into betwise.sources (type, nom, visibilite, created_by)
  select 'perso','Moi','privee', uid
  where not exists (select 1 from betwise.sources where created_by = uid and type = 'perso');
  insert into betwise.bankrolls (user_id)
  select uid where not exists (select 1 from betwise.bankrolls where user_id = uid and active);
  select * into p from betwise.profiles where user_id = uid;
  return p;
end $$;

create or replace function betwise.predictions_before_insert()
returns trigger language plpgsql set search_path = betwise, public as $$
declare k timestamptz;
begin
  new.logged_at := now();
  new.risque_calcule := betwise.risk_from_odds(new.cote_annoncee);
  if new.match_id is not null then
    select kickoff_at into k from betwise.matches where id = new.match_id;
    new.statut := case when now() < k then 'verifie'::betwise.prediction_status else 'declare'::betwise.prediction_status end;
  else
    new.statut := 'declare';
  end if;
  new.dedupe_key := new.source_id::text || '|' || coalesce(new.match_id::text, lower(coalesce(new.match_libre,''))) || '|' ||
    new.market_code || '|' || coalesce(new.market_param::text,'') || '|' || lower(new.selection) || '|' ||
    to_char(coalesce(new.published_at, new.logged_at) at time zone 'UTC','YYYY-MM-DD');
  return new;
end $$;
create trigger trg_predictions_before_insert
before insert on betwise.predictions for each row execute function betwise.predictions_before_insert();

create or replace function betwise.bet_selections_before_insert()
returns trigger language plpgsql set search_path = betwise, public as $$
begin
  new.risque_calcule := betwise.risk_from_odds(new.cote);
  return new;
end $$;
create trigger trg_bet_selections_before_insert
before insert on betwise.bet_selections for each row execute function betwise.bet_selections_before_insert();

grant usage on schema betwise to anon, authenticated, service_role;
grant all on all tables in schema betwise to authenticated, service_role;
grant all on all sequences in schema betwise to authenticated, service_role;
grant execute on all functions in schema betwise to authenticated, service_role;
alter default privileges in schema betwise grant all on tables to authenticated, service_role;
alter default privileges in schema betwise grant all on sequences to authenticated, service_role;
alter default privileges in schema betwise grant execute on functions to authenticated, service_role;

alter table betwise.competitions enable row level security;
alter table betwise.teams enable row level security;
alter table betwise.matches enable row level security;
alter table betwise.markets enable row level security;
alter table betwise.profiles enable row level security;
alter table betwise.bankrolls enable row level security;
alter table betwise.user_limits enable row level security;
alter table betwise.sources enable row level security;
alter table betwise.source_follows enable row level security;
alter table betwise.uploads enable row level security;
alter table betwise.predictions enable row level security;
alter table betwise.prediction_versions enable row level security;
alter table betwise.odds_observations enable row level security;
alter table betwise.bets enable row level security;
alter table betwise.bet_selections enable row level security;
alter table betwise.bankroll_transactions enable row level security;
alter table betwise.source_metrics enable row level security;
alter table betwise.source_metrics_by_axis enable row level security;
alter table betwise.model_estimates enable row level security;
alter table betwise.conversations enable row level security;
alter table betwise.messages enable row level security;
alter table betwise.feedback enable row level security;

create policy ref_read on betwise.competitions for select to authenticated using (true);
create policy ref_read on betwise.teams for select to authenticated using (true);
create policy ref_read on betwise.matches for select to authenticated using (true);
create policy ref_read on betwise.markets for select to authenticated using (true);
create policy ref_read on betwise.source_metrics for select to authenticated using (true);
create policy ref_read on betwise.source_metrics_by_axis for select to authenticated using (true);
create policy ref_read on betwise.model_estimates for select to authenticated using (true);
create policy ref_read on betwise.odds_observations for select to authenticated using (true);
create policy admin_write on betwise.matches for all to authenticated using (betwise.is_admin()) with check (betwise.is_admin());
create policy admin_write on betwise.competitions for all to authenticated using (betwise.is_admin()) with check (betwise.is_admin());
create policy admin_write on betwise.teams for all to authenticated using (betwise.is_admin()) with check (betwise.is_admin());

create policy own on betwise.profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on betwise.bankrolls for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on betwise.user_limits for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on betwise.uploads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on betwise.bets for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on betwise.conversations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on betwise.source_follows for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_insert on betwise.feedback for insert to authenticated with check (user_id = auth.uid());
create policy admin_read on betwise.feedback for select to authenticated using (betwise.is_admin());
create policy own on betwise.bet_selections for all to authenticated
  using (exists (select 1 from betwise.bets b where b.id = bet_id and b.user_id = auth.uid()))
  with check (exists (select 1 from betwise.bets b where b.id = bet_id and b.user_id = auth.uid()));
create policy own on betwise.bankroll_transactions for all to authenticated
  using (exists (select 1 from betwise.bankrolls k where k.id = bankroll_id and k.user_id = auth.uid()))
  with check (exists (select 1 from betwise.bankrolls k where k.id = bankroll_id and k.user_id = auth.uid()));
create policy own on betwise.messages for all to authenticated
  using (exists (select 1 from betwise.conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from betwise.conversations c where c.id = conversation_id and c.user_id = auth.uid()));

create policy sources_read on betwise.sources for select to authenticated
  using (visibilite = 'partagee' or created_by = auth.uid() or type = 'modele_betwise');
create policy sources_insert on betwise.sources for insert to authenticated with check (created_by = auth.uid());
create policy sources_update on betwise.sources for update to authenticated using (created_by = auth.uid());

create policy predictions_read on betwise.predictions for select to authenticated
  using (exists (select 1 from betwise.sources s where s.id = source_id
                 and (s.visibilite = 'partagee' or s.created_by = auth.uid() or s.type = 'modele_betwise')));
create policy predictions_insert on betwise.predictions for insert to authenticated
  with check (submitted_by = auth.uid() and exists (select 1 from betwise.sources s where s.id = source_id
                 and (s.visibilite = 'partagee' or s.created_by = auth.uid())));
create policy versions_read on betwise.prediction_versions for select to authenticated
  using (exists (select 1 from betwise.predictions p where p.id = prediction_id));
create policy versions_insert on betwise.prediction_versions for insert to authenticated with check (changed_by = auth.uid());
create policy odds_insert on betwise.odds_observations for insert to authenticated with check (observed_by = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('betwise-uploads','betwise-uploads', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy betwise_uploads_own on storage.objects for all to authenticated
  using (bucket_id = 'betwise-uploads' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'betwise-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

insert into betwise.sources (type, nom, visibilite, description)
values ('modele_betwise','Modèle BETWISE','partagee','Estimations du moteur statistique BETWISE, notées comme toute autre source');
