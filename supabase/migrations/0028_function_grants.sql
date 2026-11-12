-- 0028 : droits d'exécution des fonctions. Revue de sécurité du 12/11/2026 : des fonctions internes étaient appelables
-- par l'API publique (sans connexion). Aucune ne laissait lire ou modifier les données d'autrui, mais on ferme la porte.

-- Fonctions internes (règlement automatique, calculs, déclencheurs) : plus appelables par l'API publique
revoke execute on function betwise.settle_pending(), betwise.settle_by_match(uuid), betwise.compute_source_metrics(),
  betwise.trg_notify_bet_settled(), betwise.trg_notify_match_live(), betwise.trg_notify_prediction() from public, anon, authenticated;
grant execute on function betwise.settle_pending(), betwise.settle_by_match(uuid), betwise.compute_source_metrics() to service_role;

-- Fonctions de l'utilisateur connecté : réservées aux comptes connectés
revoke execute on function
  betwise.bankroll_move(betwise.tx_type, numeric, text), betwise.cancel_prediction(uuid, text), betwise.delete_duplicate_bet(uuid), betwise.ensure_profile(text),
  betwise.log_prediction(uuid, text, text, uuid, text, numeric, numeric, betwise.risk_category, timestamptz, uuid),
  betwise.place_bet(numeric, jsonb, betwise.import_channel, text, uuid, timestamptz),
  betwise.place_bet(numeric, jsonb, betwise.import_channel, text, uuid, timestamptz, jsonb, boolean),
  betwise.set_selection_origin(uuid, uuid), betwise.settle_bet(uuid, betwise.settle_result),
  betwise.update_bet(uuid, numeric, text, timestamptz), betwise.update_selection(uuid, numeric, uuid, text, text, numeric, text, boolean)
from public, anon;
grant execute on function
  betwise.bankroll_move(betwise.tx_type, numeric, text), betwise.cancel_prediction(uuid, text), betwise.delete_duplicate_bet(uuid), betwise.ensure_profile(text),
  betwise.log_prediction(uuid, text, text, uuid, text, numeric, numeric, betwise.risk_category, timestamptz, uuid),
  betwise.place_bet(numeric, jsonb, betwise.import_channel, text, uuid, timestamptz),
  betwise.place_bet(numeric, jsonb, betwise.import_channel, text, uuid, timestamptz, jsonb, boolean),
  betwise.set_selection_origin(uuid, uuid), betwise.settle_bet(uuid, betwise.settle_result),
  betwise.update_bet(uuid, numeric, text, timestamptz), betwise.update_selection(uuid, numeric, uuid, text, text, numeric, text, boolean)
to authenticated, service_role;
