# Accueil Prédictions — implémentation et revue

19 novembre 2026. Branche **`accueil`**, commit **`454d267`** (remplace la première version `40c372a`). Aperçu : https://betwise-git-accueil-snvci.vercel.app (base de production, connexion nécessaire). Non fusionné ; aucune écriture en base.

## Ce qui a changé

| Consigne | Réalisation | Fichiers |
| --- | --- | --- |
| Quatre onglets : Prédictions (entrée), Matchs, Coach, Sources (D14) | Barre d'onglets à quatre entrées ; Mes paris dans la navigation du Coach (Discussion, Outils, Mes paris) et en raccourci sur l'accueil ; routes inchangées | `src/components/tab-bar.tsx`, `src/components/coach-nav.tsx`, `src/app/(app)/paris/page.tsx` |
| Betster en tête, synthèse utile | Portrait, « Bonjour … », synthèse calculée à partir des comptes réels (matchs en direct, analysés, propositions, demain), heure de mise à jour, « Parler à Betster » | `src/components/accueil.tsx` (`BandeauBetster`), `src/app/(app)/page.tsx` |
| Propositions par profil Prudent / Équilibré / Audacieux (D15) | Trois onglets, cartes à faire défiler ; source : les coups du jour (3 par niveau, avec cote de référence), sinon les meilleures options de demain ; chaque carte : marché, probabilité, cote et bookmaker, heure du relevé, couverture, « perd N fois sur 100 », réussite constatée du niveau sur 4 004 matchs | `src/components/profils-du-jour.tsx`, `src/components/proposition.tsx`, `src/lib/accueil/load.ts` |
| Renommage des niveaux partout (D15) | Libellés de l'écran et du Coach conversationnel (consignes, outils) | `src/lib/coach/categories.ts`, `prompt.ts`, `tools.ts`, `plan.ts`, `daily.ts`, `src/app/(app)/coach/objectif-card.tsx`, `src/app/(app)/options/options-view.tsx` |
| Plusieurs matchs avec propositions par risque | Cartes de match : noms d'équipe en entier, barre 1 / N / 2, jusqu'à trois propositions (meilleure option de chaque niveau, marchés différents, moteur d'options existant), « Toutes les options » | `src/components/accueil.tsx` (`CarteMatchUI`), `parProfil()` dans `load.ts` |
| Demain et les prochains jours | Section « Demain » toujours présente (deux propositions par match) ; elle remonte au-dessus des matchs du jour quand rien n'est analysé aujourd'hui ; sinon « Les prochains jours » (repli) | `Demain`, `page.tsx` |
| Raccourcis Coach | Bankroll (masquable), Budget et objectifs, Mes paris (en cours, à confirmer), Parler à Betster ; premier point de vigilance | `RaccourcisCoach` |
| Aucun écran mort | Chaîne aujourd'hui → demain → prochains jours ; matchs non couverts : « Analyse statistique indisponible », sans chiffre | `page.tsx` |

Conservé de la première version (D16) : chargement en lecture seule, règles testées (`src/lib/accueil/regles.ts`), avatar, masquage des montants, import, tipsters du jour, « À faire ».

## Tests

| Contrôle | Résultat |
| --- | --- |
| Tests automatiques | 202 sur 202 |
| Types et construction | Sans erreur |
| Aperçu local, données fictives, 360 × 800, sombre et clair | Relu sur captures, aucune erreur de console |

## Pas vérifié

- L'écran connecté sur les vraies données (je ne peux pas me connecter). Le 19/11 est un jour sans match couvert : l'accueil doit montrer Betster, « Les meilleures options de demain » (Bayern – Cologne, Troyes – Le Havre, Athletic – Espanyol), puis « Demain ».
- Le temps de chargement : l'accueil charge maintenant les options d'aujourd'hui et de demain en plus des matchs du jour.

## Limites

- Justification d'une proposition : la source du chiffre et la réussite constatée du niveau ; pas encore l'argument du match (forme, face-à-face), prévu en P1.
- Stratégies et montantes : absentes, donc pas de raccourci.
- Betster : image fixe ; animation et voix en P2 (consigne 6).
- Marchés joueurs : jamais proposés (pas de probabilité).
- Écran Matchs (recherche, noms complets dans la liste, fiche en cinq parties) : étape suivante, non commencée.

## Revue de ChatGPT

_À ajouter ici._
