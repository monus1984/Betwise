-- 0057 (23/11) : de quoi nourrir l'analyse de Betster sans rien inventer.
--   standings : bilans à domicile et à l'extérieur de la saison (déjà renvoyés par API-Football, jusqu'ici ignorés).
--   match_extras : confrontations directes sur plusieurs saisons (une requête API-Football par match, gardée).
-- Ajouts seulement. Réversible : supprimer les quatre colonnes.
alter table betwise.standings add column if not exists domicile jsonb, add column if not exists exterieur jsonb;
alter table betwise.match_extras add column if not exists h2h jsonb, add column if not exists h2h_at timestamptz;
