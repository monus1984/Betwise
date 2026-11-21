# Lot 1 — Audit : couverture des compétitions, cotes Betclic, écran Matchs

21/11/2026, 08 h 40. Lecture seule : deux sondages lancés depuis la branche `audit-lot1` (aucune écriture en base, aucune dépense).
Référence : `docs/product/orientations-finalisation-prototype-nov-2026.md` (§2, §3, §14 P0).

## 1. Ce que BETWISE couvre aujourd'hui

12 compétitions : Premier League, Liga, Serie A, Bundesliga, Ligue 1, Ligue des champions, Ligue des nations, éliminatoires CAN, amicaux internationaux, Ligue des champions CAF, Coupe CAF, Ligue 1 ivoirienne. Environ 370 matchs sur les 30 derniers jours, dont les sélections nationales de novembre.
Historique pour la justification (forme, face-à-face) : cinq grands championnats seulement (`af_history`, depuis 2024).

Contrôle sur des cas réels envoyés par Mounir : sur les 12 pronos d'une liste de tipster du 20/11 (Arabie saoudite, Norvège, D2 néerlandaise, League One, Suisse, Roumanie, Qatar, Chine, pays de Galles), **un seul** match est dans nos compétitions. Un ticket Betclic du 18/11 portait sur la Ligue des champions féminine, non suivie.

## 2. API-Football (fournisseur déjà en place)

- Forfait **Pro**, **7 500 requêtes par jour**, échéance **11/12/2026** (renouvellement à prévoir). Compteur du jour au moment de l'audit : 32.
- Les 30 compétitions demandées ont toutes une saison en cours chez le fournisseur, avec classement, statistiques de match (sauf Liga F), cotes et prédictions annoncés.

| Compétition | Matchs des 7 prochains jours |
| --- | --- |
| Belgique D1 / D2 | 13 / 10 |
| Turquie D1 / D2 | 13 / 9 |
| Pays-Bas D1 / D2 | 13 / 12 |
| Danemark D1 | 6 |
| Norvège D1 | 9 |
| Arabie saoudite D1 | 9 |
| Portugal D1 | 5 |
| Écosse, Suisse, Autriche, Grèce, Roumanie, Qatar (D1) | 13, 9, 9, 10, 11, 6 |
| Angleterre D2 / D3 | 35 / 27 |
| France D2, Allemagne D2, Italie D2, Espagne D2 | 4, 13, 29, 10 |
| Ligue Europa / Conférence | 18 / 18 |
| Ligue des champions féminine | 0 cette semaine |
| D1 féminines : Angleterre, France, Allemagne, Espagne, Italie | 7, 5, 6, 8, 6 |

**Total : environ 340 matchs de plus par semaine**, soit à peu près cinq fois le volume actuel hors trêve internationale.

Budget de requêtes estimé pour 30 compétitions de plus : calendrier toutes les 3 heures (8 par jour), cotes une fois par jour (2 à 3 pages), classement une fois par jour, soit environ 12 requêtes par compétition et par jour, **360 par jour sur 7 500**. L'historique de buts (deux saisons) coûte 1 à 2 requêtes par compétition, une seule fois. Les statistiques détaillées par match (une requête par match) seraient étalées sur plusieurs jours si on les veut.

## 3. Cotes Betclic

- API-Football **n'a pas Betclic** (vérifié le 19/11).
- **The Odds API** (déjà utilisé pour la cote de référence) sert **Betclic (FR)** (`betclic_fr`) : 20 matchs sur 20 en Premier League, 17 sur 17 en Ligue 1, mis à jour à la minute. Il couvre 47 compétitions de football, dont Belgique, Turquie, Pays-Bas, Danemark, Norvège, Arabie saoudite, D2 anglaise, allemande, italienne, espagnole et française, Bundesliga féminine.
- Exemples relevés à 08 h 39 : Manchester City – Fulham, Betclic (FR) 1,32 / 5,1 / 6,9 ; Nice – PSG (16 h 15), Betclic (FR) 5,6 / 4,95 / 1,39.
- **Limite importante :** c'est Betclic **France**. Les cotes de Betclic Côte d'Ivoire peuvent différer. À valider en comparant avec l'application Betclic CI sur un même match avant de les afficher comme « Betclic ». Sinon, les afficher « Betclic (France) ».
- Budget : formule gratuite, **500 crédits par mois**, dont 212 déjà utilisés au 21/11 par l'import actuel (7 compétitions × 2 marchés par jour). Il ne reste pas de quoi ajouter Betclic sans changer d'organisation. Piste sans frais : prendre la cote de référence (médiane européenne) dans API-Football, qui donne de nombreux bookmakers dans le forfait Pro, et réserver The Odds API à Betclic (paramètre `bookmakers=betclic_fr` : 1 crédit par compétition et par marché), soit environ 8 compétitions × 2 marchés par jour. Au-delà : formule payante de The Odds API, à chiffrer avant toute décision.

## 4. Écran Matchs aujourd'hui

Bandeau des jours (jours qui ont des matchs), filtre par compétition, filtres « en direct » et « suivis » (étoile). Liste des compétitions fixée en dur (`COMP_ORDER`, 12 codes). Manquent : recherche d'équipe ou de compétition, regroupement par pays, présentation compacte adaptée à des centaines de matchs, marquage clair des matchs sans analyse.

## 5. Recommandation pour le lot 1

1. Ajouter les compétitions par vagues (configuration API-Football, classement quotidien, historique de buts) : d'abord D1 européennes demandées, Arabie saoudite, Europa/Conférence et les D2 anglaise, allemande, italienne, espagnole et française ; ensuite féminines et autres D1.
2. Écran Matchs : regroupement par pays puis compétition, recherche, favoris de compétitions, ligne compacte ; un match sans analyse s'affiche, marqué « analyse statistique indisponible ».
3. Les propositions et la justification n'apparaissent que là où l'historique existe ; rien d'inventé pour les nouvelles compétitions tant que l'historique n'est pas chargé.
4. Cotes Betclic : test de concordance Betclic (FR) / Betclic CI par Mounir, puis décision d'affichage et d'organisation du budget The Odds API.

Écritures en production nécessaires (à valider par Mounir) : nouvelles lignes dans `competitions`, import des matchs et cotes des nouvelles compétitions par les tâches planifiées existantes. Aucune migration de schéma prévue à ce stade.

## Complément du 21/11 : Betclic Côte d'Ivoire contre Betclic France

Captures Betclic CI de Mounir (08 h 45 à 08 h 56) comparées au relevé The Odds API (`betclic_fr` et Pinnacle, 08 h 56 à 08 h 58), 1X2 seulement.

| Match | Betclic CI | Betclic France | Écart CI / France |
| --- | --- | --- | --- |
| Chelsea – Leeds | 2,02 / 3,48 / 3,60 | 1,93 / 3,38 / 3,48 | +4,7 / +3,0 / +3,4 % |
| Tottenham – Ipswich | 1,50 / 4,60 / 5,75 | 1,46 / 4,35 / 5,40 | +2,7 / +5,7 / +6,5 % |
| Nice – PSG | 5,75 / 5,10 / 1,45 | 5,60 / 4,95 / 1,39 | +2,7 / +3,0 / +4,3 % |
| Monaco – Auxerre | 1,40 / 4,90 / 7,25 | 1,36 / 4,65 / 6,75 | +2,9 / +5,4 / +7,4 % |
| Leverkusen – Paderborn | 1,27 / 6,60 / 8,50 | 1,20 / 6,60 / 8,50 | +5,8 / 0 / 0 % |
| Union Berlin – Leipzig | 5,60 / 4,90 / 1,47 | 5,50 / 4,75 / 1,41 | +1,8 / +3,2 / +4,3 % |

- Sur 18 cotes : médiane +3,3 %, moyenne +3,7 %, écart-type ≈ 2 %, de 0 à +7,4 %. Jamais en dessous de France.
- Marge : Betclic CI ≈ 6 % (5,6 à 7,9 % sur les 12 matchs capturés), Betclic France ≈ 10 %, Pinnacle 2,5 à 4 %.
- Ce matin-là, `betclic_fr` n'avait aucune cote Liga ni Serie A sur The Odds API.

Décision de Mounir (21/11) : afficher 1xBet, Betclic France et une estimation Betclic CI = France × 1,033, fourchette × 1,017 à × 1,057 (médiane ± un écart-type), toujours marquée comme estimation, jamais utilisée pour préremplir un pari ni calculer une value. À recalculer avec les tickets Betclic importés. Coût : 1 crédit par compétition et par jour (PL, L1, Bundesliga, Liga, Serie A, C1), arrêté sous 100 crédits restants.
