# BETWISE — architecture UX et expérience Betster

Date : 19 novembre 2026  
Statut : orientation produit formulée à partir des observations utilisateur ; à appliquer progressivement après revue de l'existant.

## 1. Principe directeur

La prédiction est la porte d'entrée de l'application. L'utilisateur doit découvrir immédiatement des rencontres, des analyses et des propositions exploitables. Le Coach accompagne cette expérience, mais ne doit pas être isolé dans son onglet.

Trois principes :
- **Découvrir** : trouver rapidement les matchs, analyses et marchés pertinents.
- **Comprendre** : accéder à des statistiques lisibles et à des analyses réellement argumentées.
- **Piloter** : suivre sa bankroll, ses objectifs et ses stratégies avec l'aide du Coach.

L'application ne doit jamais afficher un accueil vide ou un message du type « rien à analyser » sans proposer une alternative utile.

## 2. Navigation principale souhaitée

Ordre de navigation :

1. **Prédictions** — écran d'accueil et recommandations.
2. **Matchs** — recherche et exploration de toutes les rencontres.
3. **Coach** — gestion personnelle et conversation avec Betster.
4. **Sources** — tipsters, pronostiqueurs, fiabilité et historique.

Les libellés exacts peuvent être ajustés au design system, mais cette hiérarchie fonctionnelle doit être respectée.

## 3. Onglet Prédictions — accueil

Betster apparaît en haut de l'écran et présente une synthèse, ses recommandations et les analyses à consulter. Il doit être visible sans prendre toute la place.

Contenu recommandé :
- message d'accueil et synthèse de Betster ;
- recommandations et analyses du Coach ;
- meilleures options du jour ;
- propositions pour les rencontres à venir, notamment le lendemain ;
- plusieurs matchs, avec des propositions réparties par niveaux de risque ;
- accès rapide à la gestion Coach (bankroll, montantes, objectifs) et à la discussion directe.

Les propositions doivent être sélectionnées selon la disponibilité, la fraîcheur et la qualité des données. Ne pas fabriquer une sélection pour remplir l'écran.

### États dynamiques — aucun écran mort

- Des opportunités existent aujourd'hui : les mettre en avant.
- Peu d'opportunités aujourd'hui : remonter les rencontres du lendemain ou des prochains jours.
- Pas de prédiction calculée pour une rencontre : proposer les statistiques disponibles ou expliquer clairement la limite.
- Aucun match suffisamment couvert : proposer un contenu d'analyse, un bilan ou une action utile (par exemple explorer les prochains matchs).
- Afficher clairement la date et l'heure de mise à jour des données.

## 4. Onglet Matchs — exploration approfondie

L'utilisateur doit pouvoir :
- parcourir les matchs par date et championnat ;
- rechercher une équipe ou une rencontre ;
- filtrer les compétitions et les matchs ;
- identifier clairement les équipes, écussons, horaires et compétitions.

### Fiche détaillée d'un match

La fiche doit rendre les informations immédiatement lisibles et proposer au minimum :

- **Aperçu** : contexte, probabilités disponibles et synthèse.
- **Analyse** : tendances, forme récente, confrontations, facteurs déterminants et explication claire du modèle.
- **Statistiques** : données des équipes et indicateurs pertinents, avec période et source lorsque disponibles.
- **Marchés** : ensemble des marchés réellement couverts par le moteur, avec probabilités calculées lorsqu'elles existent.
- **Sources / cotes** : sources de données, pronostiqueurs et cotes disponibles, avec fraîcheur de l'information.

L'analyse doit être précise et traçable : distinguer faits statistiques, estimation du modèle et interprétation. Ne pas présenter une donnée absente comme si elle était disponible.

### Lisibilité mobile

- Éviter les noms d'équipes tronqués : autoriser deux lignes ou une mise en page adaptée.
- Ne pas sacrifier la lisibilité pour afficher trop d'informations sur une seule ligne.
- Hiérarchiser équipes, compétition, date/heure et probabilités.
- Les statistiques doivent être préorganisées de manière utile, sans imposer à l'utilisateur de configurer chaque vue.

## 5. Marchés et niveaux de risque

Pour chaque rencontre, proposer plusieurs marchés pertinents, pas uniquement le résultat final. Selon la couverture réelle des données, les familles peuvent inclure :
- résultat et double chance ;
- total de buts et buts par équipe ;
- les deux équipes marquent ;
- première et deuxième mi-temps ;
- corners, cartons, tirs et autres statistiques ;
- marchés joueurs (buteur, tirs, tirs cadrés) uniquement lorsque les données et modèles correspondants sont disponibles.

Présenter les propositions selon trois profils :
- **Prudent** : estimation de probabilité plus élevée, sans jamais signifier « sûr ».
- **Équilibré** : compromis entre probabilité estimée et cote.
- **Audacieux** : probabilité estimée plus faible et potentiel de cote plus élevé.

Chaque proposition doit afficher, si disponible :
- intitulé du marché ;
- probabilité estimée ;
- cote et bookmaker/source ;
- niveau de risque ;
- justification statistique courte ;
- heure de dernière actualisation.

Afficher quelques options sélectionnées par défaut, puis permettre « Voir toutes les options » pour explorer le catalogue. Ne pas assimiler une cote élevée à une meilleure valeur sans analyse de la probabilité et de la marge.

## 6. Onglet Coach — accompagnement et gestion

Le Coach doit permettre à l'abonné de :
- créer et paramétrer une bankroll ;
- définir un capital de départ et suivre son évolution ;
- fixer des objectifs et des pourcentages de progression/gain souhaités ;
- construire et suivre des stratégies de mises, dont des montantes, avec avertissements sur les risques ;
- consulter son tableau de bord, ses performances et ses historiques ;
- discuter directement avec Betster.

La gestion Coach reste accessible depuis l'accueil Prédictions, sous forme de raccourcis ou de cartes compactes. L'onglet Coach conserve les outils complets.

L'application doit informer et aider à arbitrer, sans présenter les montantes ou objectifs de gains comme une méthode fiable de profit. Montrer les risques de pertes et les limites de chaque stratégie.

## 7. Betster — personnage animé et parlant

### Référence visuelle

La référence à respecter est le portrait fourni par l'utilisateur : personnage masculin souriant, casquette bleu nuit avec emblème vert, veste bleu nuit et accents vert lumineux, casque audio autour du cou, logo BETWISE sur la tenue, ambiance de stade sombre avec éclairage turquoise et cercle lumineux vert.

Cette image est la référence visuelle du personnage. Ne pas la remplacer par une autre variante ou réinterpréter son visage sans validation explicite. Le nom **Betster** désigne ici le personnage IA de travail ; le nom définitif de la plateforme reste un sujet distinct et non tranché.

### Comportement souhaité

Betster ne doit pas être un avatar statique. L'objectif est un personnage animé qui :
- parle avec une voix identifiable ;
- synchronise les mouvements de bouche avec la parole (lip-sync) ;
- utilise des expressions faciales cohérentes ;
- accompagne ses analyses par des gestes mesurés ;
- peut adopter des attitudes positives, concentrées/prudentes et neutres ;
- intervient dans l'accueil, les analyses de matchs et la conversation Coach sans interrompre constamment l'utilisateur.

### Exigences de conception et de réalisation

Une image fixe seule ne suffit pas à produire ce comportement. Prévoir une chaîne dédiée :
- création d'un modèle/personnage animé cohérent avec le portrait de référence (2D riggé ou 3D) ;
- système d'animation faciale et corporelle ;
- synthèse vocale (TTS) avec voix et langue(s) définies ;
- synchronisation audio-visuelle et gestion des interruptions ;
- états de conversation (écoute, réflexion, parole, réponse terminée) ;
- solution de repli légère pour les appareils mobiles et connexions faibles.

Ne pas lancer une animation coûteuse en permanence. Prévoir une expérience progressive : animation courte à l'ouverture ou sur demande, lecture vocale facultative, sous-titres toujours disponibles et mode silencieux. Mesurer l'impact sur les performances, la batterie, les données mobiles et le temps de chargement.

## 8. Sources

L'onglet Sources regroupe les tipsters/pronostiqueurs, leur historique, leurs performances et les indicateurs de fiabilité. La méthodologie de calcul de fiabilité doit être transparente (volume de pronostics, période, résultats, cotes, ROI si calculable). Distinguer les données vérifiées des déclarations des contributeurs.

## 9. Priorités de réalisation

1. **P0 — Architecture et accueil Prédictions** : hiérarchie, recommandations, états dynamiques, accès Coach.
2. **P0 — Fiche Matchs** : lisibilité mobile, statistiques, analyses et navigation.
3. **P1 — Catalogue de marchés** : exploiter les marchés effectivement couverts et classer les propositions par risque.
4. **P1 — Coach** : bankroll, stratégies, objectifs et conversation.
5. **P2 — Betster animé** : cadrage technique, prototype vocal/animation puis intégration progressive.
6. **P2 — Sources** : présentation et transparence des indicateurs de fiabilité.

Avant de développer, auditer les composants, routes, modèles et capacités déjà présents dans le dépôt. Réutiliser ce qui fonctionne ; ne pas réécrire le moteur de prédiction ni déclarer une fonctionnalité opérationnelle sans vérification.

## 10. Consignes à Claude

- Prendre ce document comme brief UX de référence pour les prochains travaux.
- Ne pas tout modifier en une seule passe : procéder écran par écran et valider chaque étape.
- Commencer par l'accueil Prédictions et la fiche Matchs.
- Préserver les fonctionnalités et données existantes ; vérifier les capacités réelles avant d'annoncer une couverture de marchés.
- Ne pas inventer de probabilités, cotes, statistiques, analyses ou sources.
- Garder la gestion Coach accessible depuis Prédictions tout en conservant un espace Coach complet.
- Respecter strictement le portrait Betster fourni comme référence.
- Ne pas remplacer globalement le nom de la plateforme : le naming reste provisoire.
