# Mesures par écran

Relevées par le robot le 22 novembre 2026 à 10 h 05 (GMT), thème clair, téléphone de 360 × 780. Fichier brut : branche `audit-ecrans`, `rapports/ecrans/index.json`.

## Comment lire

- **Écrans** : hauteur de la page, en nombre d'écrans de 780 px.
- **Affichage** : temps jusqu'à la fin du chargement de la page, mesuré depuis un serveur de GitHub aux États-Unis. Sur un téléphone à Abidjan, ce sera plus long : c'est un plancher, utile pour comparer les écrans entre eux.
- **Textes coupés** : textes terminés par « … » parce qu'ils ne tiennent pas dans leur case.
- **Cibles** : boutons, liens et champs de moins de 24 px (seuil d'accessibilité WCAG 2.2) et de moins de 44 px (confort du pouce), sur le total.
- **Sous Betster** : éléments tactiles placés dans la colonne que recouvre Betster flottant, et qui passent donc dessous en défilant.
- **Petits textes** : nombre de textes de moins de 11 px, puis de 11 à 11,5 px.
- **Contraste** : textes sous le seuil de contraste (contrôle automatique axe). Les textes posés sur les bandeaux en dégradé ne sont pas contrôlés par l'outil.

| Écran | Écrans | Affichage | Textes coupés | Cibles < 24 px | Cibles < 44 px | Sous Betster | Petits textes (moins de 11 px / 11 à 11,5 px) | Contraste | Erreurs console |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Connexion | 1 | 1,2 s | 0 | 1 | 2 sur 5 | — | 0 / 0 | 0 | 0 |
| Inscription | 1,1 | 0,4 s | 0 | 2 | 3 sur 7 | — | 0 / 0 | 0 | 0 |
| Prédictions (accueil) | 9,9 | 4,2 s | 9 | 8 | 59 sur 88 | 70 | 125 / 211 | 0 | 13 |
| Prédictions, onglet Audacieux | 9,9 | 2,7 s | 9 | 8 | 59 sur 88 | 70 | 125 / 207 | 0 | 0 |
| Prédictions, aide ouverte | 9,9 | 3,3 s | 9 | 8 | 63 sur 92 | 72 | 125 / 216 | 0 | 0 |
| Matchs, aujourd’hui | 3,2 | 1,4 s | 47 | 0 | 181 sur 299 | 154 | 181 / 136 | 0 | 0 |
| Matchs, premier championnat déroulé | 3,5 | 1,1 s | 46 | 0 | 181 sur 299 | 154 | 181 / 132 | 0 | 0 |
| Matchs, hier (matchs terminés) | 3,1 | 1,1 s | 12 | 0 | 101 sur 250 | 193 | 71 / 122 | 0 | 0 |
| Matchs, filtre Terminés | 1 | 0,9 s | 0 | 0 | 9 sur 33 | 8 | 37 / 5 | 0 | 0 |
| Matchs, filtre À venir | 3,2 | 1,2 s | 47 | 0 | 181 sur 299 | 154 | 181 / 136 | 0 | 0 |
| Matchs, filtre En direct | 1 | 1,0 s | 0 | 0 | 9 sur 33 | 8 | 37 / 5 | 0 | 0 |
| Matchs, filtre Suivis | 1 | 0,8 s | 0 | 0 | 9 sur 33 | 8 | 37 / 5 | 0 | 0 |
| Matchs, recherche « barcelona » | 1,4 | 0,8 s | 5 | 0 | 21 sur 35 | 18 | 23 / 9 | 0 | 0 |
| Matchs, recherche sans résultat | 1 | 0,6 s | 0 | 0 | 4 sur 10 | 4 | 1 / 5 | 0 | 0 |
| Matchs, aide ouverte | 3,2 | 1,0 s | 47 | 0 | 184 sur 302 | 156 | 181 / 141 | 0 | 0 |
| Fiche match à venir, Analyse (Juventus – Venezia) | 3,2 | 1,0 s | 4 | 2 | 22 sur 29 | 17 | 5 / 36 | 1 | 0 |
| Fiche match à venir, Stats | 2,7 | 0,9 s | 0 | 2 | 10 sur 17 | 6 | 33 / 36 | 0 | 0 |
| Fiche match à venir, Marchés | 7,6 | 0,9 s | 8 | 25 | 102 sur 275 | 183 | 189 / 365 | 0 | 0 |
| Fiche match à venir, Sources | 1,2 | 0,8 s | 0 | 3 | 11 sur 18 | 5 | 1 / 17 | 0 | 0 |
| Fiche match terminé, Analyse (Real Madrid – Celta) | 2,3 | 0,7 s | 2 | 2 | 12 sur 18 | 6 | 2 / 17 | 0 | 0 |
| Fiche match terminé, Stats | 3,5 | 0,8 s | 2 | 2 | 9 sur 15 | 4 | 35 / 41 | 0 | 0 |
| Fiche match terminé, Marchés | 7,4 | 0,8 s | 20 | 13 | 51 sur 240 | 174 | 189 / 357 | 0 | 0 |
| Fiche match sans cote (Lyon W – Strasbourg W) | 1,6 | 0,7 s | 0 | 1 | 10 sur 17 | 6 | 1 / 20 | 0 | 0 |
| Fiche match, adresse inconnue | 1 | 0,6 s | 0 | 0 | 0 sur 1 | — | 0 / 0 | 0 | 0 |
| Classement | 1,5 | 0,5 s | 7 | 1 | 42 sur 48 | 3 | 0 / 14 | 0 | 0 |
| Mes paris, en cours | 1 | 1,0 s | 0 | 0 | 8 sur 14 | 5 | 1 / 5 | 0 | 0 |
| Mes paris, réglés | 1 | 0,8 s | 0 | 0 | 8 sur 14 | 5 | 1 / 5 | 0 | 0 |
| Paris test | 2 | 0,7 s | 1 | 9 | 29 sur 37 | 15 | 1 / 18 | 0 | 0 |
| Détail d’un pari test | 1,9 | 0,7 s | 1 | 3 | 8 sur 21 | 7 | 3 / 16 | 1 | 0 |
| Ajouter | 1,2 | 0,6 s | 0 | 1 | 3 sur 13 | 6 | 0 / 5 | 0 | 0 |
| Nouveau pari | 2,5 | 0,7 s | 46 | 0 | 201 sur 213 | — | 0 / 6 | 0 | 0 |
| Nouveau pari, mode test | 2,8 | 0,6 s | 47 | 0 | 201 sur 213 | — | 0 / 6 | 0 | 0 |
| Importer | 1,4 | 0,7 s | 0 | 0 | 2 sur 12 | — | 1 / 6 | 0 | 0 |
| Importer, arrivée en mode test | 1,4 | 4,8 s | 0 | 0 | 2 sur 12 | — | 1 / 6 | 0 | 0 |
| Coach, synthèse | 1,2 | 0,8 s | 0 | 1 | 10 sur 17 | 8 | 1 / 7 | 0 | 0 |
| Coach, conversation avec Betster | 1,2 | 0,5 s | 0 | 1 | 7 sur 17 | — | 0 / 6 | 1 | 0 |
| Bankroll | 1,3 | 0,7 s | 0 | 0 | 8 sur 14 | 4 | 0 / 10 | 0 | 0 |
| Montantes | 1,1 | 0,7 s | 0 | 1 | 8 sur 18 | 7 | 0 / 5 | 0 | 0 |
| Options du jour | 5,3 | 1,1 s | 40 | 81 | 144 sur 188 | 126 | 40 / 314 | 4 | 0 |
| Sources, mes sources | 1 | 0,5 s | 0 | 0 | 7 sur 15 | 7 | 1 / 9 | 0 | 0 |
| Sources, analyse | 1 | 0,5 s | 0 | 1 | 8 sur 14 | 6 | 1 / 7 | 0 | 0 |
| Sources, classement | 2,8 | 0,7 s | 1 | 0 | 8 sur 28 | 20 | 10 / 70 | 0 | 0 |
| Sources, découvrir | 1,5 | 0,5 s | 0 | 0 | 7 sur 31 | 23 | 1 / 37 | 0 | 0 |
| Fiche source, Modèle BETWISE | 10,6 | 0,9 s | 36 | 1 | 37 sur 43 | 2 | 65 / 276 | 0 | 0 |
| Fiche source, Coups du jour BETWISE | 10,2 | 0,7 s | 12 | 1 | 10 sur 17 | 4 | 64 / 276 | 0 | 0 |
| Nouvelle source | 1,4 | 0,5 s | 0 | 3 | 3 sur 15 | 7 | 0 / 5 | 0 | 0 |
| Comparer deux sources | 1 | 0,7 s | 0 | 0 | 4 sur 10 | 4 | 0 / 5 | 0 | 0 |
| Mon bilan | 1 | 0,7 s | 0 | 1 | 7 sur 13 | 4 | 0 / 5 | 0 | 0 |
| Notifications | 1 | 0,5 s | 0 | 0 | 1 sur 7 | 2 | 0 / 6 | 0 | 0 |
| Réglages | 1,1 | 0,7 s | 1 | 1 | 4 sur 13 | — | 0 / 6 | 0 | 0 |
| Adresse inexistante | 1 | 0,4 s | 0 | 0 | 0 sur 1 | — | 0 / 0 | 0 | 1 |

## Contrastes insuffisants relevés

| Thème | Écran | Élément | Contraste mesuré | Couleurs |
| --- | --- | --- | ---: | --- |
| clair | Fiche match à venir, Analyse (Juventus – Venezia) | « Équilibré » | 4,45 | #a16207 sur #fcf3dc |
| clair | Coach, conversation avec Betster | « Le coach ne reçoit ni ton nom ni tes montants en F CFA : il  » | 4,16 | #697786 sur #f3f4f6 |
| clair | Options du jour | « 83–91 % » | 4 | #708192 sur #ffffff |
| clair | Options du jour | « 67–83 % » | 4 | #708192 sur #ffffff |
| clair | Options du jour | « 53–67 % » | 4 | #708192 sur #ffffff |
| clair | Options du jour | « 67–91 % » | 3,91 | #b6d4ce sur #0c6e5c |
| sombre | Matchs, aujourd’hui | « 86 » | 1,06 | #fbfcfd sur #f3f5f7 |
| sombre | Matchs, hier (matchs terminés) | « 124 » | 1,06 | #fbfcfd sur #f3f5f7 |
| sombre | Options du jour | « 67–91 % » | 4,18 | #0f4c4b sur #20bfa0 |

Le seuil est de 4,5 pour un texte de cette taille. La ligne à 1,06 est le nombre de matchs sous le jour sélectionné, en thème sombre : texte blanc sur pastille blanche.

## Autres contrôles automatiques

- **Contrôles imbriqués** : sur l'écran Matchs, 26 en-têtes de championnat contiennent un lien (« Classement ») et un bouton (l'étoile) à l'intérieur de l'élément qui sert à déplier. Un lecteur d'écran ne sait pas lequel annoncer, et un toucher imprécis déplie au lieu d'ouvrir le classement.
- **Images** : 189 écussons sur l'écran Matchs, aucun en erreur de chargement.
- **Débordement horizontal** : aucun écran ne déborde à 360 px. À 320 px, l'accueil déborde de 21 px.

## L'accueil chargé 16 fois de suite

Temps jusqu'à la fin du chargement, en secondes, dans l'ordre des essais :

- thème clair : 3,4, 2,7, 2,8, 2,6, 2,5, 2,6, 2,6, 2,6
- thème sombre : 8,8, 2,5, 2,7, 2,7, 2,6, 5,8, 24,0, 14,0

Médiane 2,7 s ; 4 chargements sur 16 au-dessus de 5 s ; le plus long, 24,0 s. Aucune erreur de console sur ces 16 essais.

Sur l'ensemble des passages du robot ce matin, l'accueil a été chargé 45 fois avec relevé des erreurs. 2 de ces chargements ont levé une erreur d'hydratation React (n° 418), suivie de 12 erreurs en cascade. Les deux fois, c'était la première page ouverte par le robot dans une session neuve ; les 32 chargements du test de répétition, eux aussi en session neuve, n'en ont levé aucune.

