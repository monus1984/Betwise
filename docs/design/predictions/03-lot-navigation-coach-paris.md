# Lot du 19/11 (15 h 54) : navigation, Coach, Mes paris, justification

Branche **`accueil`**, commit **`60eaf29`**. Aperçu : https://betwise-git-accueil-snvci.vercel.app (base de production, connexion nécessaire). Non fusionné. Aucune écriture en base.

Demande de Mounir, résumée : remettre l'onglet Mes paris ; rendre les noms d'équipe lisibles dans Matchs ; retirer Discussion au profit d'un Betster flottant ; un tableau de bord et un onglet Bankroll dans le Coach ; dans Mes paris, charger, simuler, charger les pronos de la communauté, et analyser les sources avec leurs forces et faiblesses ; puis la justification par match, les montantes et Betster animé, dans cet ordre.

## Ce qui est fait

| Demande | Réalisation | Fichiers |
| --- | --- | --- |
| Onglet Mes paris | Barre : Prédictions, Matchs, Mes paris, Coach. Mes paris a trois vues : Mes paris, Ajouter, Sources | `src/components/tab-bar.tsx`, `src/components/coach-nav.tsx` (`ParisNav`) |
| Retirer Discussion, Betster flottant | Le bouton « + » flottant est remplacé par le portrait de Betster (halo discret, coupé si l'utilisateur réduit les animations). Il ouvre la conversation (`/coach?v=discussion`). Masqué dans la conversation, la saisie, l'import et les réglages ; il remonte quand le coupon est ouvert | `src/components/betster-fab.tsx`, `src/app/(app)/layout.tsx`, `src/app/globals.css` |
| Coach : tableau de bord | Bankroll (masquable), résultat sur 7 jours, en jeu, rendement, gagnés ; paris en cours et résultats à confirmer ; points de vigilance (règles fixes) ; habitudes (séries, mise après perte et après gain, combinés perdus à une sélection près, détail par type) ; points forts ; budget. Écran d'accueil vide si aucun pari | `src/app/(app)/coach/tableau-de-bord.tsx`, `coach/page.tsx` |
| Coach : onglet Bankroll | Onglets Tableau de bord, Bankroll, Outils | `coach-nav.tsx` (`CoachNav`), `bankroll/page.tsx` |
| Mes paris : charger, simuler, communauté | Page Ajouter : charger un ticket, saisir un pari, simuler un pari (pari test, hors bankroll), charger les pronos de ma communauté ; lien pour ajouter une source | `src/app/(app)/paris/ajouter/page.tsx` |
| Stats des sources, forces et faiblesses | Sources › Analyse : pour chaque source suivie, pronos réglés, réussite face à l'attendu, rendement, pire série, part publiée avant le match ; forces et faiblesses par compétition, marché et niveau de cote | `src/lib/sources/analyse.ts` (+ tests), `sources/page.tsx` |
| Noms d'équipe dans Matchs | Noms complets (plus d'abréviation ni de coupure), 15 px, contraste plein, écusson 24 px ; la proposition passe sous les noms au lieu de leur prendre la largeur | `src/app/(app)/matchs/page.tsx` |
| Justification par match | Sous les propositions : forme des deux équipes sur leurs 5 derniers matchs, bilan des dernières confrontations, buts par match. Source : l'historique importé (cinq grands championnats, depuis 2024) et les matchs terminés en base. Rien n'est affiché quand l'historique manque | `src/lib/matches/justification.ts` (+ tests), `src/lib/accueil/load.ts`, `src/components/accueil.tsx` (`Pourquoi`) |

Règle d'une force ou d'une faiblesse : au moins 3 résultats réglés sur le critère, et un écart d'au moins 10 points avec la réussite générale de la source. En dessous, l'écran dit « Aucune nette pour l'instant ».

## Tests

- 37 fichiers, 207 tests réussis (5 nouveaux : forces et faiblesses, forme et face-à-face). Contrôle de types et compilation réussis.
- Aperçu fictif de l'accueil capturé en clair et en sombre, sans erreur console : la justification s'affiche sous les propositions.
- Vérifié en base (lecture seule) : Bayern – Cologne de demain aurait « 2 victoires Bayern » sur les deux dernières confrontations (5-1 en mai, 3-1 en janvier).

## Limites, à vérifier sur l'aperçu

- Le tableau de bord, Ajouter, Sources › Analyse et la barre n'ont pas de version fictive : à vérifier connecté sur l'aperçu.
- Justification absente pour la Ligue des champions (une seule des deux équipes a parfois un historique), la CAF et la Ligue 1 ivoirienne : pas d'historique importé. Pour les grands championnats, la forme mélange championnat et coupes suivies.
- « Charger les pronos de ma communauté » ouvre l'import existant ; le choix ticket ou prono se fait toujours dans l'écran d'import.
- Analyse des sources : les critères de compétition et de niveau de cote sont encore peu remplis (3 compétitions, 3 niveaux) ; les forces et faiblesses apparaîtront avec plus de coupons.

## Montantes (à valider avant toute écriture en base)

Les montantes n'existent pas encore. Proposition :

- Une montante = un objectif (ex. 1 000 F → 10 000 F), une mise de départ, un nombre de paliers prévu. Chaque palier est un pari réel de l'application, dont la mise est le gain du palier précédent.
- États : en cours, atteinte, cassée (un palier perdu), arrêtée par l'utilisateur. Jamais supprimée.
- Écran : la progression palier par palier, la probabilité cumulée d'aller au bout (produit des probabilités des paliers joués et, pour les paliers restants, celle du niveau choisi), et la proposition du palier suivant parmi les options du jour.
- Migration nécessaire, **additive** : table `betwise.montantes` (utilisateur, nom, mise de départ, objectif, paliers prévus, statut, dates) avec lecture et écriture limitées au propriétaire, et deux colonnes facultatives sur `bets` (`montante_id`, `palier`). Rien de ce qui existe n'est modifié ; réversible en supprimant la table et les deux colonnes tant qu'aucune montante n'est créée.

Je n'applique rien sans ton Ok explicite.

## Betster animé et parlant (cadrage)

- Portrait validé conservé tel quel ; aucune nouvelle apparence générée.
- Étape 1, sans risque : animations légères du portrait existant (respiration, clignement par superposition, halo pendant qu'il « réfléchit »), désactivées si l'utilisateur réduit les animations.
- Étape 2 : voix lue sur les réponses du Coach, avec Gemini comme préféré. Sous-titres toujours affichés, mode silencieux par défaut, aucun montant ni identité envoyés au service de voix.
- Étape 3 : lèvres synchronisées, seulement si l'étape 2 est adoptée par les testeurs.
- À trancher : le fournisseur de voix et son coût par réponse.

## Prochaine étape

Ton retour sur l'aperçu. Ensuite : montantes si tu valides la migration, puis l'étape 1 de Betster animé.

## Suite du 19/11 (16 h 15 – 16 h 30)

### Montantes (validées par Mounir)

- Migrations **0051** (table `montantes`, colonnes `bets.montante_id` et `bets.palier`) et **0052** (fonction `montante_rattacher`) appliquées en production après Ok explicite (16 h 15 et 16 h 22). Additives ; aucune donnée existante modifiée.
- Coach › Montantes : création (mise, objectif, paliers, niveau, avec la cote à trouver par palier et la chance d'aller au bout d'après les cotes), fiche (paliers en couleur, capital, options des prochaines 48 h proches de la cote à trouver, rattachement du pari, arrêt). Statut atteinte ou cassée déduit des paris réglés.
- Commits `ce8af37`, `adcaaf3`. Règles testées : `src/lib/montantes/regles.ts`.
- Limite : un pari rattaché ne se détache pas (pas de suppression rétroactive) ; non essayé sur un vrai compte.

### Betster animé, étape 1

- Portrait validé inchangé. L'animation porte sur le cadre : respiration au repos, anneau qui tourne pendant que le Coach consulte les données, halo pendant la lecture à voix haute. Bouton Stop, texte toujours affiché, voix coupée par défaut (réglage existant), aucune animation si le téléphone demande moins de mouvement.
- `src/components/betster-anime.tsx`, `src/app/(app)/coach/chat.tsx`, `src/components/accueil.tsx`, `src/app/globals.css`. Commit `f2a32b4`.
- Étapes suivantes à décider : fournisseur de voix (Gemini préféré) et son coût, puis lèvres synchronisées.

## Finition du lot (19/11, 17 h)

Branche `accueil`, commit **`37dfdb4`** : 9 commits devant `main`, fusion sans conflit vérifiée. 38 fichiers de tests, 217 tests réussis ; contrôle de types et compilation réussis ; aperçu Vercel prêt, aucune erreur dans les journaux de l'aperçu sur la dernière heure (ce qui ne prouve pas qu'un écran connecté a été ouvert).

- **Défaut corrigé, analyse des sources** : les statistiques par critère en base (`source_metrics_by_axis.nb_declares`) comptent aussi les pronos en attente et remboursés ; la réussite par critère était donc sous-estimée. L'écran calcule maintenant sur les seuls pronos gagnés ou perdus (`bilanDe()`, testé). La fonction de calcul en base n'est pas modifiée.
- **Montantes, cas limites testés** (demande de l'audit) : palier remboursé, montante arrêtée, montante cassée, paliers épuisés sans objectif atteint, pari annulé, palier en cours.
- **Animation du portrait** : renommée dans le code, ce n'est pas un personnage incarné (voir `docs/brand/betster/etude-avatar-reel.md`). Décision sur l'avatar réel reportée par Mounir, après son évaluation des coûts.

### Reste non vérifié, à tester par Mounir

1. Coach : tableau de bord, Bankroll, Montantes (créer, placer un pari, rattacher, arrêter), Outils.
2. Mes paris : Ajouter (quatre entrées), Sources › Analyse.
3. Matchs : noms d'équipe sur un petit écran, y compris les noms longs.
4. Accueil : justification sous les propositions (présente pour les cinq grands championnats seulement).
5. Betster flottant : ne gêne ni le coupon ni les boutons du bas ; conversation, voix et bouton Stop.
6. Temps de chargement de l'accueil sur réseau mobile (deux requêtes de plus pour la justification).
