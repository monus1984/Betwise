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
