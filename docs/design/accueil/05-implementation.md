# 05 — Implémentation du nouvel accueil

19 novembre 2026. Branche **`accueil`** (depuis `main` = `6b9e1d2`), commit **`40c372a`**. Aperçu Vercel : https://betwise-git-accueil-snvci.vercel.app (base de production : données réelles, connexion nécessaire).
Rien n'est fusionné dans `main`. Aucune écriture en base, aucune migration.

## Ce qui est développé

| Élément | Fichiers | Décision |
| --- | --- | --- |
| Règles testées seules : couverture, expression de Betster, avis du jour, nom du marché, âge d'un relevé, publication avant le match | `src/lib/accueil/regles.ts`, tests `src/lib/accueil/__tests__/regles.test.ts` | D10, D12, D13 |
| Chargement de l'accueil (lecture seule) : avis, matchs du jour, jour creux, tipsters suivis | `src/lib/accueil/load.ts` ; `src/lib/coach/today.ts` passe en plus l'heure de publication des pronos | — |
| Blocs d'affichage | `src/components/accueil.tsx` | Maquettes v3 |
| Masquage des montants, gardé sur le téléphone | `src/components/montant.tsx` | D2 |
| Page d'accueil réorganisée | `src/app/(app)/page.tsx` | D1, D2 |
| Onglets Accueil, Prédictions, Mes paris, Tipsters, Coach ; titres « Prédictions » et « Mes pronostiqueurs » ; onglet « Tipsters » dans la fiche match | `src/components/tab-bar.tsx`, pages `matchs` et `sources` | D4, D7 |
| Avatar de Betster (une image, 112 px, 5 Ko) | `public/betster/betster-112.webp` | Character Bible |
| Aperçu avec données fictives, absent en production | `src/app/apercu/accueil/page.tsx` | — |

### Comportement

- **Avis de Betster** : premier coup du jour Audacieux du jour, sinon premier Sûr, seulement avant le coup d'envoi. Probabilité, cote 1xBet avec l'heure du relevé si elle a moins de 48 h, sinon cote médiane avec l'heure du dernier relevé de référence ; couverture (« Marché et modèle », « Marché seul ») ; « perd N fois sur 100 » ; mention « pas un calcul de valeur de la cote ».
- **Jour creux** : aucun coup du jour et aucun match analysé à venir aujourd'hui → les trois meilleures probabilités des jours suivants (fonction existante `loadRepli`), avec « estimation du modèle » quand il n'y a pas de cote.
- **Matchs du jour** : jour d'Abidjan, plus les matchs encore en cours ; en direct d'abord, puis à venir, puis terminés ; six cartes, puis un lien. Barre 1 / N / 2 ; sélection avec son marché nommé ; en direct, « probabilité d'avant le match » ; terminé, « Passé » ou « Pas passé » quand le marché se règle sur le score ; match sans signal : « Pas d'analyse pour ce match », sans chiffre.
- **Carte Coach** : solde, résultat sur 7 jours, en jeu, rendement, paris gagnés ; budget seulement s'il est fixé ; premier point de vigilance s'il y en a un ; « Parler au coach ». Nouvel abonné (aucun pari, aucun tipster suivi) : texte d'attente et bloc « Bien démarrer ».
- **Tipsters** : jusqu'à quatre pronos de tipsters suivis sur les matchs des 30 prochaines heures, avec le marché, l'avis BETWISE (« Comme Betster », « BETWISE : 24 % », « Pas d'analyse ») et « Publié avant le match, heure vérifiée », « Ajouté après le coup d'envoi » ou « Heure de publication non vérifiée ».
- **À faire** (résultats à confirmer, paris à régler à la main, solde à comparer) : conservé en bas de page.
- Retirés de l'accueil : les quatre tuiles d'action (remplacées par l'icône d'import dans l'en-tête et la carte Import) et la liste des sources suivies (remplacée par le bloc Tipsters du jour).

## Tests

| Contrôle | Résultat |
| --- | --- |
| Tests automatiques | 202 sur 202 (dont 5 nouveaux pour les règles de l'accueil) |
| Types (`tsc`) et construction | Sans erreur |
| Rendu de l'aperçu, 360 × 800, sombre et clair | Captures relues, aucune erreur dans la console |
| Données réelles du 19/11 (requêtes en lecture) | Aucun match couvert aujourd'hui : l'accueil affichera le jour creux avec les matchs du 20/11 (Bayern – Cologne, Troyes – Le Havre, Athletic – Espanyol) |
