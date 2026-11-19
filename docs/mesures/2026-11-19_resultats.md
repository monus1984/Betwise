# Mesure des probabilités BETWISE — 19 novembre 2026

Sortie brute de `npx tsx scripts/mesure-probabilites.ts --enregistrer`, lancé sur GitHub Actions le 19/11/2026 à 00:20 UTC
(branche `etape-2`, passage 44428171243). Méthode de retrait de la marge en vigueur : puissance.
Lecture : « annoncé » est la probabilité moyenne affichée par l'application ; « arrivé » la part des sélections réellement
gagnées. « Écart moyen de calibration » : moyenne des écarts entre les deux, par tranche de probabilité, pondérée par le
nombre de sélections (0 = parfait). « Gain sur la moyenne » : part de l'erreur (score de Brier) retirée par rapport à une
prévision qui annoncerait toujours la fréquence moyenne (0 % = n'apprend rien, 100 % = devine tout).

À retenir :

- Marchés cotés et marchés déduits tiennent à 1 ou 2 points près sur 4 004 matchs de championnat ; les marchés de
  mi-temps aussi (4 003 matchs avec le score à la pause).
- La méthode proportionnelle annonçait les favoris trop bas. La méthode puissance la remplace depuis cette mesure.
- Les 136 matchs internationaux suivis par l'application disent la même chose avec plus de bruit (peu de matchs).
- Coups du jour : 53 pronos réglés en 6 jours. Trop peu pour juger un rendement.
- Le modèle maison reste moins juste que les cotes de clôture ; sa probabilité de « plus de 2,5 buts » est trop haute
  de 4 points quand il la donne favorite.



## 1. Probabilités « marché » : 136 matchs terminés avec des cotes relevées avant le coup d'envoi

Résultat du match (1, N, 2), log-loss : **0,776** · fréquences de base 1,033 · hasard 1,099 (plus bas = meilleur).
Par compétition : AMI 0,713 (36 matchs) · CANQ 0,832 (48 matchs) · UNL 0,768 (52 matchs).

| Famille de marchés | Origine | Matchs | Sélections | Favoris (≥ 50 %) : annoncé | arrivé | écart (points) | Écart moyen de calibration | Gain sur la moyenne |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Résultat du match | cote directe | 136 | 408 | 70,2 % | 72,3 % | +2,1 | 3,6 | 32,5 % |
| Plus / moins 2,5 buts | cote directe | 136 | 272 | 59,9 % | 60,6 % | +0,7 | 3,2 | 9,7 % |
| Double chance | déduit | 136 | 408 | 79,1 % | 79,6 % | +0,5 | 2,4 | 32,3 % |
| Remboursé si nul | déduit | 109 | 218 | 80,6 % | 83,5 % | +2,9 | 4,7 | 48,1 % |
| Plus / moins, autres lignes (0,5 à 4,5) | déduit | 136 | 1088 | 80,9 % | 81,3 % | +0,3 | 1,5 | 45,1 % |
| Les deux équipes marquent | déduit | 136 | 272 | 61,0 % | 61,0 % | +0,1 | 7,0 | 1,7 % |
| Buts d'une équipe | déduit | 136 | 1632 | 76,2 % | 76,6 % | +0,4 | 1,2 | 36,0 % |
| Handicap ±1,5 | déduit | 136 | 544 | 81,5 % | 82,0 % | +0,5 | 2,1 | 46,9 % |
| Combinés du match (deux conditions) | déduit | 136 | 7344 | 60,9 % | 62,4 % | +1,5 | 0,6 | 19,8 % |
| Pair / impair, tranche de buts, handicap européen, sans encaisser | déduit | 136 | 3264 | 68,3 % | 68,5 % | +0,1 | 0,5 | 28,5 % |
| 1re mi-temps (résultat, buts, les deux marquent) | déduit, mi-temps | 136 | 2176 | 70,1 % | 70,4 % | +0,3 | 1,7 | 22,6 % |
| 2e mi-temps (résultat, buts, les deux marquent) | déduit, mi-temps | 136 | 2176 | 70,1 % | 65,7 % | −4,4 | 4,4 | 16,1 % |
| Mi-temps / fin, mi-temps la plus prolifique, gagne une mi-temps, but dans les deux | déduit, mi-temps | 136 | 2176 | 64,5 % | 67,6 % | +3,1 | 1,0 | 28,2 % |

### Marchés cotés (résultat, plus/moins 2,5) : annoncé contre arrivé

| Probabilité annoncée | Sélections | Annoncé en moyenne | Arrivé | Intervalle à 95 % | Écart (points) |
| --- | ---: | ---: | ---: | --- | ---: |
| 0 à 30 % | 252 | 17,1 % | 15,1 % | 11–20 % | −2,1 |
| 30 à 50 % | 190 | 39,9 % | 41,1 % | 34–48 % | +1,2 |
| 50 à 60 % | 106 | 55,0 % | 50,0 % | 41–59 % | −5,0 |
| 60 à 70 % | 78 | 64,5 % | 71,8 % | 61–81 % | +7,3 |
| 70 à 80 % | 22 | 75,3 % | 72,7 % | 52–87 % | −2,6 |
| 80 à 90 % | 18 | 82,9 % | 94,4 % | 74–99 % | +11,6 |
| 90 à 100 % | 14 | 92,0 % | 100,0 % | 78–100 % | +8,0 |

### Marchés déduits de la grille de scores (hors mi-temps)

| Probabilité annoncée | Sélections | Annoncé en moyenne | Arrivé | Intervalle à 95 % | Écart (points) |
| --- | ---: | ---: | ---: | --- | ---: |
| 0 à 30 % | 7256 | 14,0 % | 13,6 % | 13–14 % | −0,4 |
| 30 à 50 % | 3396 | 40,0 % | 40,0 % | 38–42 % | +0,0 |
| 50 à 60 % | 1286 | 54,6 % | 56,5 % | 54–59 % | +1,9 |
| 60 à 70 % | 820 | 64,7 % | 63,5 % | 60–67 % | −1,2 |
| 70 à 80 % | 698 | 74,7 % | 75,1 % | 72–78 % | +0,4 |
| 80 à 90 % | 581 | 85,0 % | 85,5 % | 82–88 % | +0,5 |
| 90 à 100 % | 733 | 95,0 % | 95,9 % | 94–97 % | +0,9 |

### Marchés de mi-temps

| Probabilité annoncée | Sélections | Annoncé en moyenne | Arrivé | Intervalle à 95 % | Écart (points) |
| --- | ---: | ---: | ---: | --- | ---: |
| 0 à 30 % | 2385 | 14,3 % | 14,4 % | 13–16 % | +0,1 |
| 30 à 50 % | 1655 | 39,2 % | 41,1 % | 39–43 % | +1,8 |
| 50 à 60 % | 656 | 55,2 % | 51,5 % | 48–55 % | −3,7 |
| 60 à 70 % | 713 | 64,9 % | 64,7 % | 61–68 % | −0,3 |
| 70 à 80 % | 563 | 74,7 % | 76,0 % | 72–79 % | +1,3 |
| 80 à 90 % | 438 | 84,5 % | 80,4 % | 76–84 % | −4,2 |
| 90 à 100 % | 118 | 93,6 % | 95,8 % | 90–98 % | +2,2 |

Buts avant la pause : 187 sur 388 (48,2 %) sur 136 matchs. L'application suppose 45 %.

### Retrait de la marge : trois méthodes sur les mêmes matchs

| Méthode | Log-loss du résultat | Marchés cotés : écart moyen | favoris ≥ 60 % (sélections) | annoncé | arrivé | écart | outsiders < 20 % : écart | Marchés déduits : écart moyen | favoris ≥ 60 % : écart | Mi-temps : écart moyen |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| proportionnelle | 0,787 | 4,3 | 118 | 70,2 % | 81,4 % | +11,1 | −3,4 | 1,1 | +1,3 | 0,8 |
| puissance (application) | 0,776 | 3,3 | 132 | 71,7 % | 78,0 % | +6,3 | −2,0 | 0,5 | +0,1 | 1,3 |
| shin | 0,780 | 3,3 | 131 | 70,8 % | 77,9 % | +7,0 | −2,1 | 0,6 | +0,5 | 1,2 |

## 2. Coups du jour : 53 réglés sur 54 publiés (6 jours)

| Catégorie | Réglés | Annoncé en moyenne | Arrivé | Intervalle à 95 % | Écart (points) | Rendement à la cote de référence |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| Tous | 53 | 78,2 % | 86,8 % | 75–93 % | +8,6 | +14,8 % |
| risque | 18 | 65,2 % | 66,7 % | 44–84 % | +1,4 | +17,5 % |
| audacieux | 17 | 81,6 % | 100,0 % | 82–100 % | +18,4 | +15,4 % |
| sur | 18 | 87,8 % | 94,4 % | 74–99 % | +6,6 | +8,1 % |

## 3. Mêmes calculs sur l'historique des cinq championnats : 4004 matchs du 2024-08-15 au 2026-11-08, cotes moyennes de clôture

Résultat du match (1, N, 2), log-loss : **0,967** · fréquences de base 1,073 · hasard 1,099 (plus bas = meilleur).
Par compétition : D1 0,971 (693 matchs) · E0 0,996 (860 matchs) · F1 0,963 (702 matchs) · I1 0,956 (870 matchs) · SP1 0,950 (879 matchs).

| Famille de marchés | Origine | Matchs | Sélections | Favoris (≥ 50 %) : annoncé | arrivé | écart (points) | Écart moyen de calibration | Gain sur la moyenne |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Résultat du match | cote directe | 4004 | 12012 | 63,6 % | 63,4 % | −0,2 | 0,4 | 13,8 % |
| Plus / moins 2,5 buts | cote directe | 4004 | 8008 | 58,7 % | 58,8 % | +0,0 | 0,9 | 4,4 % |
| Double chance | déduit | 4004 | 12012 | 73,5 % | 73,3 % | −0,2 | 1,7 | 13,6 % |
| Remboursé si nul | déduit | 3007 | 6014 | 70,5 % | 71,6 % | +1,1 | 1,1 | 25,0 % |
| Plus / moins, autres lignes (0,5 à 4,5) | déduit | 4004 | 32032 | 80,5 % | 81,2 % | +0,7 | 0,7 | 44,0 % |
| Les deux équipes marquent | déduit | 4004 | 8008 | 56,2 % | 55,6 % | −0,6 | 0,6 | 1,8 % |
| Buts d'une équipe | déduit | 4004 | 48048 | 73,8 % | 74,3 % | +0,5 | 0,5 | 30,1 % |
| Handicap ±1,5 | déduit | 4004 | 16016 | 80,8 % | 82,3 % | +1,5 | 1,6 | 47,7 % |
| Combinés du match (deux conditions) | déduit | 4004 | 216216 | 58,4 % | 58,0 % | −0,5 | 0,1 | 14,0 % |
| Pair / impair, tranche de buts, handicap européen, sans encaisser | déduit | 4004 | 96096 | 67,0 % | 68,0 % | +1,0 | 0,7 | 26,4 % |
| 1re mi-temps (résultat, buts, les deux marquent) | déduit, mi-temps | 4003 | 64048 | 67,3 % | 67,5 % | +0,3 | 0,3 | 16,5 % |
| 2e mi-temps (résultat, buts, les deux marquent) | déduit, mi-temps | 4003 | 64048 | 66,8 % | 66,4 % | −0,4 | 0,4 | 14,9 % |
| Mi-temps / fin, mi-temps la plus prolifique, gagne une mi-temps, but dans les deux | déduit, mi-temps | 4003 | 64048 | 61,8 % | 62,9 % | +1,2 | 0,4 | 22,3 % |

### Marchés cotés (résultat, plus/moins 2,5) : annoncé contre arrivé

| Probabilité annoncée | Sélections | Annoncé en moyenne | Arrivé | Intervalle à 95 % | Écart (points) |
| --- | ---: | ---: | ---: | --- | ---: |
| 0 à 30 % | 7006 | 21,7 % | 21,8 % | 21–23 % | +0,1 |
| 30 à 50 % | 6903 | 40,5 % | 40,5 % | 39–42 % | −0,0 |
| 50 à 60 % | 3559 | 54,8 % | 55,2 % | 54–57 % | +0,4 |
| 60 à 70 % | 1728 | 64,3 % | 62,5 % | 60–65 % | −1,8 |
| 70 à 80 % | 629 | 74,0 % | 75,4 % | 72–79 % | +1,3 |
| 80 à 90 % | 174 | 83,5 % | 87,4 % | 82–92 % | +3,9 |
| 90 à 100 % | 21 | 91,5 % | 85,7 % | 65–95 % | −5,8 |

### Marchés déduits de la grille de scores (hors mi-temps)

| Probabilité annoncée | Sélections | Annoncé en moyenne | Arrivé | Intervalle à 95 % | Écart (points) |
| --- | ---: | ---: | ---: | --- | ---: |
| 0 à 30 % | 212272 | 15,6 % | 15,3 % | 15–15 % | −0,3 |
| 30 à 50 % | 108940 | 39,9 % | 39,9 % | 40–40 % | +0,0 |
| 50 à 60 % | 36065 | 54,2 % | 54,1 % | 54–55 % | −0,1 |
| 60 à 70 % | 23987 | 64,5 % | 65,6 % | 65–66 % | +1,1 |
| 70 à 80 % | 21420 | 75,0 % | 75,5 % | 75–76 % | +0,4 |
| 80 à 90 % | 18472 | 84,9 % | 85,7 % | 85–86 % | +0,8 |
| 90 à 100 % | 13286 | 93,9 % | 94,2 % | 94–95 % | +0,3 |

### Marchés de mi-temps

| Probabilité annoncée | Sélections | Annoncé en moyenne | Arrivé | Intervalle à 95 % | Écart (points) |
| --- | ---: | ---: | ---: | --- | ---: |
| 0 à 30 % | 63878 | 15,5 % | 15,5 % | 15–16 % | +0,0 |
| 30 à 50 % | 55643 | 39,6 % | 39,7 % | 39–40 % | +0,1 |
| 50 à 60 % | 23299 | 55,1 % | 55,2 % | 55–56 % | +0,1 |
| 60 à 70 % | 22923 | 64,8 % | 64,6 % | 64–65 % | −0,2 |
| 70 à 80 % | 17890 | 74,8 % | 75,4 % | 75–76 % | +0,6 |
| 80 à 90 % | 7945 | 83,5 % | 83,2 % | 82–84 % | −0,3 |
| 90 à 100 % | 566 | 91,9 % | 91,0 % | 88–93 % | −0,9 |

Buts avant la pause : 4966 sur 11302 (43,9 %) sur 4003 matchs. L'application suppose 45 %.

### Retrait de la marge : trois méthodes sur les mêmes matchs

| Méthode | Log-loss du résultat | Marchés cotés : écart moyen | favoris ≥ 60 % (sélections) | annoncé | arrivé | écart | outsiders < 20 % : écart | Marchés déduits : écart moyen | favoris ≥ 60 % : écart | Mi-temps : écart moyen |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| proportionnelle | 0,968 | 0,6 | 2298 | 67,2 % | 68,5 % | +1,2 | −2,0 | 0,5 | +1,0 | 0,3 |
| puissance (application) | 0,967 | 0,3 | 2552 | 68,2 % | 67,6 % | −0,7 | −0,8 | 0,3 | +0,7 | 0,1 |
| shin | 0,967 | 0,4 | 2468 | 67,9 % | 67,6 % | −0,3 | −1,1 | 0,3 | +0,8 | 0,1 |

## 4. Modèle maison rejoué semaine après semaine : 2955 matchs prédits sur 4011 en historique (2024-08-15 → 2026-11-08)

Résultat du match, log-loss sur les 2952 matchs où les cotes de clôture sont retrouvées (2952 sur 2955) :
modèle **0,987** · cotes de clôture **0,968** · fréquences de base 1,071 · hasard 1,099 (plus bas = meilleur).

| Marché (modèle) | Sélections | Écart moyen de calibration (points) | Gain sur la moyenne | Favoris ≥ 50 % : annoncé | arrivé | écart (points) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Résultat du match | 8865 | 0,5 | 11,8 % | 61,5 % | 63,0 % | +1,5 |
| Plus de 2,5 buts | 2955 | 3,7 | 1,5 % | 61,2 % | 57,0 % | −4,2 |
| Les deux marquent | 2955 | 1,7 | 0,3 % | 58,2 % | 57,1 % | −1,1 |

### Modèle, résultat du match : annoncé contre arrivé

| Probabilité annoncée | Sélections | Annoncé en moyenne | Arrivé | Écart (points) |
| --- | ---: | ---: | ---: | ---: |
| 0 à 30 % | 4910 | 22,5 % | 22,3 % | −0,2 |
| 30 à 50 % | 2558 | 38,8 % | 38,2 % | −0,5 |
| 50 à 60 % | 721 | 54,6 % | 56,2 % | +1,6 |
| 60 à 70 % | 442 | 64,3 % | 64,9 % | +0,7 |
| 70 à 80 % | 163 | 74,4 % | 78,5 % | +4,1 |
| 80 à 90 % | 65 | 83,6 % | 87,7 % | +4,1 |
| 90 à 100 % | 6 | 91,2 % | 50,0 % | −41,2 |

Par championnat (log-loss du modèle) : Liga 0,969 (673) · Ligue 1 0,989 (493) · Premier League 1,011 (648) · Serie A 0,975 (658) · Bundesliga 0,995 (483).

Résumé enregistré : 36 lignes pour le 2026-11-19.
