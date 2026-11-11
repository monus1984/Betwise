-- 0018 : historique API-Football avec buts attendus (xG) et tirs, pour le modèle v2 ; identifiants d'équipes sur les matchs
create table if not exists betwise.af_history (
  fixture_id integer primary key,
  league integer not null, season integer not null,
  played_at timestamptz not null,
  home_id integer not null, home_nom text not null,
  away_id integer not null, away_nom text not null,
  home_goals smallint not null, away_goals smallint not null,
  xg_home numeric(5,2), xg_away numeric(5,2),
  shots_home smallint, shots_away smallint, sot_home smallint, sot_away smallint,
  stats_checked boolean not null default false,
  imported_at timestamptz not null default now()
);
create index if not exists af_history_league_date_idx on betwise.af_history (league, played_at desc);
alter table betwise.af_history enable row level security;
create policy af_history_read on betwise.af_history for select to authenticated using (true);
alter table betwise.matches add column if not exists af_home_id integer;
alter table betwise.matches add column if not exists af_away_id integer;
