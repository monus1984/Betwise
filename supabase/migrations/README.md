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
| 0018_af_history.sql | 2026-11-11 | `af_history` (résultats, xG, tirs par match depuis API-Football) ; `af_home_id` / `af_away_id` sur matches |
| 0019_objectifs_coups_du_jour.sql | 2026-11-12 | `objectifs` (bankroll de départ, cible, échéance ; un actif par utilisateur), `daily_picks` (coups du jour par catégorie), source « Coups du jour BETWISE » |
| 0020_markets_and_tests.sql | 2026-11-12 | Marchés TT1/TT2 (buts par équipe), DC_BTTS, 1X2_BTTS, OU_BTTS ; règlement étendu ; `bets.virtuel` (paris de test) |
| 0021_virtual_bets.sql | 2026-11-12 | `place_bet(..., p_virtuel)` : un test ne touche pas la bankroll et enregistre le choix comme prono de chaque source d'origine ; `finalize_bet`, `settle_bet`, `my_bankroll_summary` ignorent les tests |
| 0022_update_bet_test_fingerprint.sql | 2026-11-12 | `update_bet` garde le préfixe de test dans l'empreinte d'un ticket de test |
| 0023_more_markets.sql | 2026-11-12 | Marchés de mi-temps, 2e mi-temps, mi-temps/fin, pair/impair, tranches de buts, handicap européen, gagne sans encaisser ; `matches.ht_home/ht_away` ; règlement étendu |
| 0024_stats_markets.sql | 2026-11-12 | Corners, cartons, tirs, buteurs, prolongation / tirs au but / qualification, score exact mi-temps ; `matches.details` ; `settle_sel` (règlement sur la fiche complète) ; `tick_live` complète le détail après le match |
| 0025_notifications.sql | 2026-11-12 | Notifications push : `push_subscriptions`, `notification_prefs`, `notifications` (file d'attente), `app_secrets` ; déclencheurs (pari réglé, prono d'une source suivie), `tick_notify()` chaque minute |
| 0026_live_notifications.sql | 2026-11-12 | `match_follows` (étoile sur un match), préférence `direct`, déclencheur sur `matches` : coup d'envoi, but, but annulé, mi-temps, fin |
| 0027_standings_team_follows.sql | 2026-11-12 | `standings` (classements, cache API-Football), `team_follows` (équipes suivies) ; le direct va aussi aux abonnés d'une équipe |
| 0028_function_grants.sql | 2026-11-12 | Fonctions internes retirées de l'API publique ; fonctions utilisateur réservées aux comptes connectés |
| 0029_source_link.sql | 2026-11-12 | `sources.lien` (page du tipster) et `set_source_link()` : le créateur le modifie, tout utilisateur peut le renseigner sur une source partagée qui n'en a pas |
| 0030_convert_bet_to_test.sql | 2026-11-12 | `convert_bet_to_test()` : un pari réel non joué devient un test ; les mouvements de bankroll sont compensés par un ajustement, rien n'est supprimé |
| 0031_correct_bet_result.sql | 2026-11-13 | `correct_bet_result()` : corriger le résultat d'un pari déjà réglé ; écart de bankroll compensé par un ajustement, changement journalisé |
| 0032_bet_assurance.sql | 2026-11-13 | Combiné « Assurance » : `bets.assurance`, `finalize_bet()` rembourse la mise si une seule sélection perd, `set_bet_assurance()` |
| 0033_tts_usage.sql | 2026-11-15 | `tts_usage` et `tts_take()` : compteur quotidien par compte pour la voix (synthèse vocale Gemini) |
| 0034_bankroll_align.sql | 2026-11-15 | `bankroll_align()` : recale la bankroll sur le solde réel du bookmaker par un mouvement d'ajustement noté |
| 0035_cote_payee.sql | 2026-11-15 | `cote_payee()` : Betclic paie sur la cote totale arrondie à 2 décimales ; `place_bet`, `finalize_bet`, `settle_bet`, `correct_bet_result` l'utilisent |
| 0036_confirmation_and_grants.sql | 2026-11-16 | Paris réels : résultat proposé (`bets.resultat_propose`), bankroll écrite seulement à la confirmation ; écritures directes retirées aux comptes connectés sur 23 tables ; ancien `place_bet` à 6 arguments fermé |
| 0037_bankroll_verifie_at.sql | 2026-11-16 | `bankrolls.verifie_at` : date du dernier rapprochement avec le solde du bookmaker |
| 0038_bet_recheck.sql | 2026-11-16 | `bet_recheck()` : après un import, sélections remises d’accord avec les scores, ticket « perdu » sans sélection perdue rouvert ; `settle_bet` ne marque plus perdues les sélections non jouées |
| 0039_bankroll_par_bookmaker.sql | 2026-11-16 | `bankroll_transactions.bookmaker`, vue `my_bankroll_journal`, `bankroll_move_bk()`, `bankroll_align_bk()` : solde et recalage par bookmaker ; `notifications_read()` |
| 0040_source_proof.sql | 2026-11-16 | Vues `source_proof` et `source_proof_by_market` : note et détail par marché sur les seuls pronos enregistrés avant le coup d'envoi |
| 0041_metrics_sur_pronos_prouves.sql | 2026-11-16 | `compute_source_metrics()` et `source_cumulative()` limitées aux pronos prouvés |
| 0042_cashout.sql | 2026-11-16 | `bets.cashout`, `cashout_bet()` : pari réglé sur le montant encaissé chez le bookmaker |
| 0043_budgets.sql | 2026-11-16 | Table `budgets` (une ligne par utilisateur, RLS) : budget de mise et perte maximale par semaine |
| 0044_tous_les_pronos_comptent.sql | 2026-11-17 | Note des sources sur tous leurs pronos non annulés, saisis avant ou après le match (annule l'effet de 0041) |
| 0045_import_fiable.sql | 2026-11-18 | Import sans ligne écartée : marché `LIBRE` (pari gardé tel quel), `set_selection_result()` pour régler une ligne à la main ; 11 marchés ajoutés (mi-temps, penalty, doublé) avec leur règlement ; registre `libelles_inconnus` et `log_libelle_inconnu()` |
| 0046_mesures_probabilites.sql | 2026-11-19 | Table `mesures_probabilites` : résumé de chaque mesure des probabilités (par périmètre et famille de marchés), écrit par `scripts/mesure-probabilites.ts` |
| 0047_historique_mi_temps.sql | 2026-11-19 | `match_history.ht_home_goals`, `ht_away_goals` : score à la pause, pour mesurer les marchés de mi-temps |
| 0048_cotes_par_bookmaker.sql | 2026-11-19 | Table `bookmaker_odds` (dernier relevé d'avant-match par bookmaker, avec l'heure du relevé) et `replace_bookmaker_odds()` réservée au service |
| 0049_marches_etendus.sql | 2026-11-19 | 37 marchés de plus (mi-temps, buts d'une équipe, ordre des buts, joueurs, corners, cartons, tirs, fautes, hors-jeu) et le combiné libre `COMBO` ; `settle_selection()` et `settle_sel()` étendues |
| 0050_stats_joueurs.sql | 2026-11-19 | Statistiques d'un joueur : marchés `PSHOT`, `PSOT`, `PAST` (choix « Plus\|Nom »), `joueur_de()` (un seul joueur doit répondre au nom), `settle_sel()` étendue ; 0 minute jouée = remboursé |
