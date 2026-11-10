-- 0015 : historique des résultats (football-data.co.uk) pour le modèle de risque + unicité des estimations
create table if not exists betwise.match_history (
  id uuid primary key default gen_random_uuid(),
  ligue text not null,            -- code football-data.co.uk : E0, SP1, I1, D1, F1
  saison text not null,           -- ex. 2526
  played_on date not null,
  home_nom text not null,
  away_nom text not null,
  home_goals smallint not null,
  away_goals smallint not null,
  cote_1 numeric(7,3), cote_n numeric(7,3), cote_2 numeric(7,3),   -- moyenne marché (colonnes AvgH/AvgD/AvgA)
  cote_plus25 numeric(7,3), cote_moins25 numeric(7,3),
  imported_at timestamptz not null default now(),
  unique (ligue, played_on, home_nom, away_nom)
);
create index if not exists match_history_ligue_date_idx on betwise.match_history (ligue, played_on desc);
alter table betwise.match_history enable row level security;
-- lecture ouverte aux connectés (données publiques), écriture réservée aux jobs (service_role)
create policy history_read on betwise.match_history for select to authenticated using (true);

-- Une estimation par match / marché / sélection / version de modèle : recalcul quotidien = upsert
create unique index if not exists model_estimates_unique on betwise.model_estimates (match_id, market_code, coalesce(market_param, 0), selection, model_version);
alter table betwise.model_estimates add column if not exists updated_at timestamptz not null default now();
