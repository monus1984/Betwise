-- 0046 — Mesure des probabilités : une ligne par jour de mesure, périmètre et famille de marchés.
-- Écrite par scripts/mesure-probabilites.ts (service_role). Lecture ouverte aux comptes connectés : ce sont des statistiques
-- sur des matchs publics, sans aucune donnée d'utilisateur.
create table if not exists betwise.mesures_probabilites (
  id bigint generated always as identity primary key,
  mesure_le date not null default current_date,
  perimetre text not null,
  cle text not null,
  libelle text not null,
  n integer not null,
  proba_moyenne numeric,
  frequence numeric,
  brier numeric,
  brier_reference numeric,
  log_loss numeric,
  detail jsonb,
  created_at timestamptz not null default now(),
  unique (mesure_le, perimetre, cle)
);
alter table betwise.mesures_probabilites enable row level security;
create policy mesures_probabilites_lecture on betwise.mesures_probabilites for select to authenticated using (true);
revoke all on betwise.mesures_probabilites from anon, authenticated;
grant select on betwise.mesures_probabilites to authenticated;
