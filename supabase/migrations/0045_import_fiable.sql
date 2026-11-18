-- 0045 — Appliquée le 2026-11-18. Import fiable : plus aucune ligne écartée, marchés par période et penalty,
-- registre des libellés non compris. Test rejouable : supabase/tests/import_fiable.sql (20 contrôles).

-- 1. Nouveaux marchés (ajouts seulement)
insert into betwise.markets (code, libelle_fr, a_parametre) values
  ('LIBRE',   'Autre pari (réglé à la main)', false),
  ('PK',      'Penalty sifflé dans le match', false),
  ('PKB',     'But sur penalty dans le match', false),
  ('DBL',     'Un joueur marque un doublé', false),
  ('WEH',     'Gagne au moins une mi-temps', false),
  ('BH',      'But dans les deux mi-temps', false),
  ('H2_BTTS', '2e mi-temps : les deux marquent', false),
  ('H2_DC',   '2e mi-temps : double chance', false),
  ('HT_TT1',  'Mi-temps : buts de l''équipe à domicile', true),
  ('HT_TT2',  'Mi-temps : buts de l''équipe à l''extérieur', true),
  ('H2_TT1',  '2e mi-temps : buts de l''équipe à domicile', true),
  ('H2_TT2',  '2e mi-temps : buts de l''équipe à l''extérieur', true)
on conflict (code) do nothing;

-- 2. settle_selection() : deux branches ajoutées avant « OE » (le reste de la fonction est inchangé, définition complète en base).
--    Les marchés préfixés HT_ / H2_ étaient déjà réglés par renvoi sur le marché de base : H2_BTTS, H2_DC, HT_TT1… n'ont besoin d'aucun code.
--      WEH (gagne au moins une mi-temps) : sélection 1 ou 2 ; gagné si l'équipe mène à la mi-temps OU marque plus que l'autre en 2e mi-temps.
--      BH  (but dans les deux mi-temps)  : Oui / Non ; au moins un but avant ET après la mi-temps.
--    Sans score à la mi-temps : « en_attente ».

-- 3. settle_sel() : une branche ajoutée avant « ET / PEN / QUALIF », réglée sur la feuille de match.
--      PK  (penalty sifflé)  : Oui si la chronologie contient un penalty marqué ou manqué.
--      PKB (but sur penalty) : Oui si la chronologie contient un but sur penalty.
--      DBL (doublé)          : Oui si un même joueur figure deux fois parmi les buteurs.
--    Seulement quand le détail du match est définitif (matches.details_at) et la feuille d'événements publiée ; sinon « en_attente ».

-- 4. place_bet() : une ligne « LIBRE » n'est copiée ni dans odds_observations ni dans predictions.

-- 5. set_selection_result(p_selection_id uuid, p_result settle_result) → void (security definer, « authenticated ») :
--    règle à la main une ligne d'un pari en cours que l'application ne règle pas seule (marché LIBRE, match non suivi,
--    match terminé sans donnée pour trancher). Refuse : pari d'un autre compte, pari déjà réglé, match pas terminé,
--    ligne que le score suffit à régler. Trace dans bet_versions, puis finalize_bet() (pari réel : simple proposition).
--    « en_attente » annule le geste et retire la proposition.

-- 6. Registre des libellés non compris : ni compte, ni montant, ni cote. Lecture réservée à l'administration.
create table if not exists betwise.libelles_inconnus (
  id bigint generated always as identity primary key,
  bookmaker text not null default '',
  genre text not null default 'ticket',
  marche text not null default '',
  choix text not null default '',
  raison text,
  n integer not null default 1,
  premiere_vue timestamptz not null default now(),
  derniere_vue timestamptz not null default now(),
  traite_le timestamptz
);
create unique index if not exists libelles_inconnus_cle on betwise.libelles_inconnus (lower(bookmaker), lower(marche), lower(choix));
alter table betwise.libelles_inconnus enable row level security;
revoke all on betwise.libelles_inconnus from anon, authenticated;
-- log_libelle_inconnu(p_bookmaker, p_genre, p_marche, p_choix, p_raison) → void (security definer, « authenticated ») :
--   ajoute le libellé ou augmente son compteur.

-- Définitions complètes des fonctions : en base (pg_get_functiondef).
