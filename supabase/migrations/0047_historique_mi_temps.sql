-- 0047 — Score à la pause dans l'historique des championnats (colonnes HTHG / HTAG des fichiers football-data.co.uk).
-- Sert à vérifier les probabilités des marchés de mi-temps sur plusieurs milliers de matchs.
alter table betwise.match_history add column if not exists ht_home_goals smallint;
alter table betwise.match_history add column if not exists ht_away_goals smallint;
