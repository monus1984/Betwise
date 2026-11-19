# Instructions Claude — BETWISE

Ce fichier est le point d'entrée des consignes produit et de développement du dépôt. Le lire avant toute intervention.

## Mission immédiate

Faire évoluer l'expérience utilisateur vers une application **prédictions-first** : l'abonné arrive sur les prédictions et les recommandations, pas sur un tableau de bord de bankroll ni sur un écran vide.

Le brief de référence à lire intégralement avant de coder est :
- [Architecture UX, Prédictions, Coach et personnage Betster](docs/product/architecture-ux-predictions-coach-betster.md)
- [Décisions d'identité de marque et personnage IA](docs/brand/decisions-identite-personnage-ia.md)

## Ordre de travail obligatoire

### Étape 1 — Audit avant modification
- Examiner les routes, composants, navigation et écrans actuellement implémentés.
- Identifier ce qui existe réellement, ce qui est partiellement fonctionnel et ce qui manque.
- Vérifier les données et marchés effectivement couverts par le moteur avant de les afficher.
- Présenter un court état des lieux et un plan d'intervention ciblé.
- Ne pas réécrire le moteur de prédiction ni remplacer des fonctionnalités existantes sans nécessité démontrée.

### Étape 2 — Refonte de l'accueil « Prédictions » (priorité P0)
- Faire de Prédictions le premier onglet et l'écran d'entrée.
- Placer Betster en haut avec un message et une synthèse utiles.
- Afficher les opportunités du jour et des jours à venir, les analyses du Coach et plusieurs matchs.
- Présenter des propositions selon les profils Prudent, Équilibré et Audacieux.
- Donner un accès rapide aux fonctions Coach (bankroll, objectifs, stratégies et conversation).
- Prévoir des états alternatifs utiles lorsqu'il y a peu ou pas de matchs couverts : prochaines rencontres, analyses disponibles, statistiques ou contenu pédagogique. Ne jamais inventer une prédiction pour remplir l'écran.

### Étape 3 — Refonte de l'exploration « Matchs » (priorité P0)
- Permettre la recherche de rencontres et la navigation par date et championnat.
- Corriger les noms d'équipes tronqués et optimiser la lisibilité mobile.
- Organiser chaque fiche autour de l'aperçu, l'analyse, les statistiques, les marchés et les sources/cotes.
- Rendre les analyses claires, précises et reliées aux données disponibles.
- Distinguer explicitement les faits, les estimations du modèle et les commentaires générés.

### Étape 4 — Marchés et niveaux de risque (priorité P1)
- Exploiter les marchés réellement pris en charge.
- Présenter plusieurs options pertinentes par match, avec accès à « Voir toutes les options ».
- Afficher probabilité estimée, cote/source, niveau de risque, justification et fraîcheur lorsque ces informations existent.
- Ne jamais qualifier une option de sûre ou garantir un gain.
- Ne pas afficher les marchés joueurs comme calculés tant que les données et modèles nécessaires ne sont pas disponibles.

### Étape 5 — Coach (priorité P1)
- Regrouper bankroll, objectifs, suivi des performances, stratégies de mise/montantes et conversation avec Betster.
- Garder des raccourcis vers ces fonctions sur l'accueil Prédictions.
- Présenter clairement les risques de pertes associés aux stratégies de mises.

### Étape 6 — Betster animé et parlant (cadrage P2)
- Respecter le personnage et le portrait de référence validés par le propriétaire du produit.
- Préparer une proposition technique réaliste pour l'animation, la voix, la synchronisation labiale, les expressions et les gestes.
- Commencer par un prototype léger ; prévoir sous-titres, mode silencieux et solution adaptée aux téléphones moins puissants.
- **Ne pas substituer un autre avatar ni générer une nouvelle apparence sans validation.**
- Le brief décrit le portrait validé, mais si le fichier image de référence n'est pas présent dans le dépôt, le signaler et demander son ajout plutôt que prétendre l'avoir consulté ou en recréer un approximatif.

## Règles de réalisation

- Travailler par étapes, écran par écran ; ne pas lancer une refonte globale en une seule passe.
- Préserver les conventions, composants et design system existants lorsqu'ils sont adaptés.
- Respecter les règles du README, notamment le schéma Supabase `betwise`, la séparation du schéma `public` de Kehiwa et la protection des secrets.
- Ne jamais inventer de statistiques, probabilités, cotes, résultats, sources ou couverture fonctionnelle.
- Ne pas remplacer globalement BETWISE dans le code : le nom de la plateforme reste provisoire.
- Betster est le nom de travail du personnage IA, pas une décision définitive sur le nom de la plateforme.
- Ne pas modifier les migrations déjà appliquées ; suivre les conventions du dépôt pour toute évolution de schéma.
- Ne pas exposer de clés, jetons ou variables d'environnement dans les commits, logs ou réponses.

## Livrables attendus à chaque étape

1. Résumé de l'audit ou des changements.
2. Liste des fichiers modifiés.
3. Captures ou description précise des écrans concernés, si disponibles.
4. Tests exécutés et résultats ; signaler explicitement ceux qui n'ont pas pu être exécutés.
5. Limites restantes et prochaine étape proposée.

Commencer par l'audit, puis réaliser uniquement la refonte P0 de l'accueil Prédictions. Ne passer à la fiche Matchs qu'après vérification de cette première étape. Ne pas fusionner ni déployer sans autorisation explicite.
