# Migrations BETWISE

Les migrations sont appliquées sur le projet Supabase **arbitre-finance**
(`iewowqgnjxnitkeqbxpm`), dans le schéma dédié `betwise`. Le schéma `public`
appartient à Kehiwa : aucune migration BETWISE ne doit y toucher.

| Fichier | Appliquée le | Contenu |
| --- | --- | --- |
| 0001_schema.sql | 2026-11-09 | 22 tables, 12 types, marchés, triggers, RLS, bucket `betwise-uploads`, source « Modèle BETWISE » |
| 0002_fix_search_path.sql | 2026-11-09 | `search_path` fixé sur `risk_from_odds` (avis sécurité Supabase) |
| 0003_ensure_profile_kehiwa_pseudo.sql | 2026-11-09 | `ensure_profile()` reprend le `display_name` Kehiwa par défaut |

Réglage requis côté tableau de bord : Project Settings → Data API → Exposed schemas → ajouter `betwise`.
| 0004_place_and_settle_bet.sql | 2026-11-09 | `place_bet()`, `settle_bet()`, `bankroll_move()` (transactions atomiques), vue `my_bankroll_summary` |
| 0005_place_bet_records_odds.sql | 2026-11-09 | `place_bet()` journalise la cote de chaque sélection rapprochée dans `odds_observations` (origine `ticket`) |
| 0006_settlement_and_predictions.sql | 2026-11-09 | `settle_selection()` (règles par marché), `settle_by_match()`, `settle_pending()`, `finalize_bet()`, `log_prediction()`, `cancel_prediction()`, vue `source_trend` |
| 0007_combined_markets_and_ticket_columns.sql | 2026-11-10 | marchés `DC_OU` et `1X2_OU` (règlement : deux conditions), colonnes `bets.nb_selections / detail_complet / coupon_externe / bookmaker`, `place_bet()` accepte un ticket résumé et un statut connu (`p_summary`) |
| 0008_fix_place_bet_type_cast.sql | 2026-11-10 | correction du cast `bet_type` (régression 0007) — remplacée par 0009, non archivée séparément |
| 0009_fix_place_bet_alias.sql | 2026-11-10 | version en service de `place_bet()` : cast explicite, alias JSON distincts ; testée sur les tickets Betclic (combiné 3 et replié 10) |
| 0010_duplicate_ticket_guard.sql | 2026-11-10 | empreinte `ticket_fingerprint` (bookmaker, minute, mise, cote) + index unique, refus explicite du doublon dans `place_bet()`, `delete_duplicate_bet()` sous 24 h |
| 0011_bet_editing.sql | 2026-11-10 | `bet_versions` (journal), `set_selection_origin()`, `update_selection()`, `update_bet()` |
| 0012_source_metrics_compute.sql | 2026-11-10 | `compute_source_metrics()` (rendement unitaire, IC 90 % bootstrap, pire série, détail marché/compétition/risque, 4 périodes), `source_cumulative()`, `max_drawdown()` |
| 0013_pg_cron_schedule.sql | 2026-11-10 | pg_cron : `betwise-source-metrics` 03:00 UTC, `betwise-keepalive` 05:30 UTC |
| 0014_fix_bootstrap_ci_types.sql | 2026-11-10 | `bootstrap_ci()` renvoie du numeric arrondi (erreur de type à la première exécution) |
| 0015_match_history_and_model.sql | 2026-11-10 | `match_history` (résultats et cotes moyennes football-data.co.uk, lecture connectés), index unique des `model_estimates` par version, `updated_at` |
| 0016_live_scores.sql | 2026-11-11 | Direct : `af_fixture_id`, `minute`, `live_at` sur matches ; pg_net ; `tick_live()` appelée chaque minute par pg_cron quand un match suivi est en cours |
| 0017_match_extras.sql | 2026-11-11 | `match_extras` : compositions, absents, statistiques (cache API-Football, lecture connectés) |
