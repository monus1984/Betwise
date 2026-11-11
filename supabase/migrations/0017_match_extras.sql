-- 0017 : compositions, absents et statistiques d'un match (cache des réponses API-Football, rempli à la demande)
create table if not exists betwise.match_extras (
  match_id uuid primary key references betwise.matches(id) on delete cascade,
  lineups jsonb, lineups_at timestamptz,
  injuries jsonb, injuries_at timestamptz,
  stats jsonb, stats_at timestamptz
);
alter table betwise.match_extras enable row level security;
create policy extras_read on betwise.match_extras for select to authenticated using (true);
