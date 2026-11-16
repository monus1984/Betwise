-- 0042 — Appliquée le 2026-11-16. Cashout : le parieur encaisse avant la fin des matchs.
alter table betwise.bets add column if not exists cashout numeric;
-- cashout_bet(p_bet_id uuid, p_montant numeric) → bets (security definer, « authenticated ») :
--   règle un pari en cours sur le montant encaissé (gain net = montant − mise), inscrit « Cashout » au journal,
--   garde l'historique dans bet_versions et laisse en attente les sélections dont le match n'est pas terminé.
-- Définition complète en base.
