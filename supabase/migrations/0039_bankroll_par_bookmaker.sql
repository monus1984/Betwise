-- 0039 — Appliquée le 2026-11-16. Solde par bookmaker et boîte de notifications.
-- Un mouvement hors pari (dépôt, retrait, recalage) porte son bookmaker ; un mouvement lié à un pari prend celui du pari.
alter table betwise.bankroll_transactions add column if not exists bookmaker text;

create or replace view betwise.my_bankroll_journal with (security_invoker = true) as
  select t.id, t.bankroll_id, t.type, t.montant, t.bet_id, t.note, t.at,
         nullif(trim(coalesce(t.bookmaker, b.bookmaker)), '') as bookmaker
    from betwise.bankroll_transactions t
    join betwise.bankrolls k on k.id = t.bankroll_id and k.active
    left join betwise.bets b on b.id = t.bet_id;
grant select on betwise.my_bankroll_journal to authenticated;

-- Fonctions créées (définitions complètes en base, security definer, exécution réservée à « authenticated ») :
--   bankroll_move_bk(p_type tx_type, p_montant numeric, p_bookmaker text, p_note text default null) → bankroll_transactions
--       dépôt ou retrait sur un compte de bookmaker.
--   bankroll_align_bk(p_bookmaker text, p_solde numeric) → numeric
--       recale un seul compte : l'écart avec le solde réel est inscrit au journal (type ajustement), rien n'est effacé.
--   notifications_read() → integer
--       marque comme lues les notifications de l'utilisateur (les écritures directes sont fermées depuis 0036).
-- Reprise des données du compte principal, d'après ses indications du 16/11 : dépôts du 12/11 et recalage → Betclic ;
-- dépôt du 16/11 → 1xBet ; retrait du 16/11 (transfert) → Betclic.
