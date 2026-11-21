# BETWISE — Brief consolidé des orientations produit et améliorations
Date : 21 novembre 2026
Statut : brief de cadrage à analyser par Claude, pas une autorisation de tout développer immédiatement.

## Instruction à Claude

Avant toute intervention :
1. Lire ce brief en entier.
2. Relire les documents déjà présents dans le dépôt, en particulier `CLAUDE.md`, `docs/collaboration.md`, les documents de conception de l'accueil dans `docs/design/accueil/`, l'audit UX/Betster dans `docs/audit/` et les documents Betster dans `docs/brand/`.
3. Vérifier l'état actuel du code, des données, des écrans et des fonctionnalités. Ne pas supposer qu'un point décrit ici est absent ou déjà implémenté : établir un état réel.
4. Produire un audit de couverture : déjà fait / partiellement fait / à faire / bloqué / à vérifier, avec chemins de fichiers et preuves.
5. Proposer un plan découpé en lots, dépendances, critères d'acceptation, risques et coûts éventuels. Ne pas lancer tous les chantiers en même temps.
6. Respecter le workflow de collaboration existant : brief → audit Claude → avis ChatGPT → arbitrage utilisateur → validation → développement sur branche → tests/bilan → revue ChatGPT → itération.
7. Ne pas modifier `main`. Travailler sur la branche de travail appropriée et proposer des changements par lots/PR si le workflow du dépôt le prévoit. Ne pas effectuer de changement de schéma, migration ou écriture Supabase sans accord explicite de l'utilisateur.

## Vision produit

BETWISE doit être un compagnon de pratique, de suivi et d'analyse des paris sportifs pour les utilisateurs africains, mobile-first, utile et accessible sans dépenses importantes au stade du prototype.

BETWISE ne doit pas être un simple clone de Flashscore ni un agrégateur de pronostics. Sa boucle de valeur :
**Comprendre un match → construire ou importer un ticket → tester ses choix → mesurer ses résultats → apprendre de son historique.**

L'application doit aider l'utilisateur à comprendre et mesurer ses choix, sans promettre de gains ni présenter une analyse comme une certitude.

## 1. Couverture des matchs et expérience de navigation inspirée de Flashscore

Objectif : permettre de retrouver beaucoup plus de matchs et de naviguer facilement, avec une densité d'information utile comparable à une application de scores.

À examiner/améliorer :
- Matchs du jour, en direct et à venir.
- Recherche par équipe, compétition et pays.
- Filtres par date, pays, championnat et statut.
- Favoris équipes/compétitions.
- Scores et statuts de match à jour lorsque la source le permet.
- Fiche de match avec accès aux statistiques et marchés disponibles.
- Couverture élargie : grandes compétitions, divisions secondaires, Belgique, Turquie, Pays-Bas, Danemark, Norvège, Saudi Pro League, compétitions africaines et championnats locaux, selon disponibilité réelle des données.

Comparer les fournisseurs de données selon couverture des divisions, statistiques, scores live, cotes, fréquence de mise à jour, limites gratuites, coût et droits de réutilisation. Ne pas promettre une couverture équivalente à Flashscore sans preuve. Éviter de dépendre d'un scraping fragile ou contraire aux conditions des sites.

## 2. Import de tickets par lien Betclic et 1xBet — fonctionnalité majeure

L'utilisateur doit pouvoir retrouver/importer un coupon en collant un lien de partage Betclic ou 1xBet. Ce parcours doit être distinct de l'OCR et prioritaire lorsque le contenu du coupon est accessible.

Entrée unifiée « Importer un ticket » :
- Coller un lien de coupon Betclic.
- Coller un lien de coupon 1xBet.
- Saisir un code de coupon 1xBet si applicable.
- Importer une capture d'écran.
- Saisir ou dicter manuellement un ticket.

Comportement attendu :
1. Détecter la plateforme et le format du lien.
2. Suivre les redirections de manière sécurisée et limitée aux domaines autorisés.
3. Vérifier si les sélections du coupon sont réellement accessibles sans connexion ni compte utilisateur.
4. Extraire les matchs, équipes, marchés, sélections, cotes visibles et informations de date.
5. Rattacher chaque sélection au bon événement dans la base sportive BETWISE.
6. Afficher un aperçu et demander confirmation/correction avant enregistrement.
7. Si le lien ne permet pas l'extraction, expliquer clairement la limite et proposer le code de coupon, l'OCR ou la saisie manuelle.

À vérifier techniquement sur des liens réels de partage de Betclic Côte d'Ivoire et 1xBet :
- Le contenu est-il disponible dans le HTML, une réponse structurée ou chargé dynamiquement ?
- Le lien ouvre-t-il un coupon, une app, une redirection ou nécessite-t-il une session ?
- Le code de coupon 1xBet est-il exploitable sans connexion à un compte ?
- Quels champs et types de marchés sont effectivement récupérables ?
- Les liens expirent-ils et quelles sont les contraintes des plateformes ?

Ne pas affirmer que la récupération directe fonctionne avant les tests. Respecter les conditions d'utilisation et la sécurité des URL (allowlist des domaines, protection SSRF, validation des redirections). Ne jamais demander ni utiliser les identifiants personnels du bookmaker.

## 3. Reconnaissance robuste des tickets et marchés

Moteur d'import indépendant du bookmaker, avec profils Betclic et 1xBet au départ, extensible à d'autres sources.

Pipeline :
- OCR/lecture de l'image ou extraction du texte/link.
- Identification des équipes, événements, dates, marchés, sélections et cotes.
- Normalisation vers une structure BETWISE commune.
- Résolution du match à partir des équipes, compétition et date.
- Validation utilisateur avant création.

Le système doit gérer les noms abrégés/variantes, clubs homonymes, drapeaux et coupons multi-sélections. Un ticket de 20 sélections est un cas de test représentatif.

Reconnaître progressivement les marchés : 1X2, double chance, buts, handicaps, mi-temps et autres marchés réellement observés. Ne pas limiter l'import à quelques marchés populaires.

Pour chaque élément, afficher un état : reconnu avec confiance élevée / reconnu mais à confirmer / partiellement reconnu / non reconnu. L'utilisateur doit pouvoir corriger uniquement les éléments ambigus. Ne jamais attribuer silencieusement un mauvais match ou marché. Les sélections inconnues peuvent être conservées dans le ticket sans analyse automatisée.

Conserver la cote du ticket au moment de l'import lorsqu'elle est disponible. Ne pas remplacer silencieusement la cote initiale par une cote actuelle.

## 4. Cotes Betclic et gestion des cotes

Les cotes Betclic sont importantes pour les utilisateurs ciblés, mais la disponibilité d'une source officielle, fiable et autorisée doit être vérifiée.

Distinguer :
- Cotes de référence provenant d'un fournisseur de données.
- Cotes Betclic si une source autorisée et exploitable existe.
- Cotes présentes sur le ticket utilisateur ou saisies par lui.

Pour le prototype, conserver les cotes extraites du coupon est une voie immédiatement testable. Calculer, lorsque les données sont présentes :
- cote totale du ticket ;
- mise virtuelle ou mise déclarée ;
- gain potentiel théorique ;
- résultat et bilan après règlement.

Conserver au minimum la cote au moment de l'enregistrement. L'historique complet des variations de cote est une évolution ultérieure dépendant des données disponibles.

## 5. Paris test (tickets virtuels)

Créer une expérience complète permettant de tester des sélections et tickets sans argent réel :
- Création à partir d'un match, d'un ticket importé, d'un pronostic ou de la voix.
- Mise virtuelle configurable.
- Cotes figées au moment de l'enregistrement.
- Suivi des sélections jusqu'au résultat final.
- Comparaison des choix personnels et pronostics de tipsters.
- Historique et statistiques sur une période donnée.

Distinguer clairement :
- taux de réussite des sélections ;
- taux de réussite des tickets ;
- rendement théorique ;
- rendement réel déclaré, s'il est renseigné ;
- performance par marché, championnat et tipster.

Ne pas présenter un taux de réussite comme une preuve automatique de rentabilité. Un ticket combiné peut perdre malgré plusieurs sélections gagnantes.

## 6. Historique et apprentissage personnel

BETWISE doit devenir une mémoire analytique du parieur, à partir des tickets réellement enregistrés, sans prétendre prédire son comportement ou garantir ses résultats.

Exemples d'insights calculés :
- marchés sur lesquels l'utilisateur réussit mieux ou moins bien ;
- résultats des tickets selon le nombre de sélections ;
- performance par championnat et type de pari ;
- évolution des performances sur 30 jours ou une période choisie.

Pour le prototype, privilégier des statistiques déterministes à partir des données enregistrées plutôt qu'une IA coûteuse.

## 7. Évaluation objective des tipsters et sources de pronostics

Permettre de suivre les tipsters et d'évaluer leurs résultats sur un historique vérifiable.

Indicateurs possibles :
- nombre de pronostics enregistrés ;
- taux de réussite ;
- cote moyenne ;
- rendement théorique si cotes et mises sont disponibles ;
- régularité ;
- performance par championnat et marché.

Enregistrer chaque pronostic au moment de sa publication, avec horodatage et cote disponible. Éviter les modifications rétroactives ou la suppression sélective des pronostics perdants. Distinguer les données vérifiées des déclarations de l'utilisateur ou du tipster.

## 8. Coach contextualisé et factuel

Le Coach ne doit pas seulement réciter des statistiques. Il doit expliquer l'enjeu d'un match et le contexte du championnat :
- classement et points ;
- écarts entre équipes ;
- résultats récents ;
- matchs restants ;
- enjeu titre, qualification européenne ou maintien lorsque vérifiable ;
- confrontations directes pertinentes ;
- statut promu/relégué si confirmé.

Structure de l'analyse :
1. Faits : statistiques et données sourcées.
2. Contexte : ce que le match représente pour les équipes.
3. Lecture BETWISE : interprétation prudente et limites.

Exemple de questions conversationnelles :
- Pourquoi ce match est-il important pour cette équipe ?
- Quels éléments soutiennent ou fragilisent ce pronostic ?
- Pourquoi les cotes diffèrent-elles ?
- Quelles données manquent ?

Le Coach doit signaler les données partielles ou insuffisantes et ne jamais inventer un enjeu. Distinguer « peut prendre la première place » de « prendra la première place en cas de victoire » uniquement si le calcul le confirme.

## 9. Qualité et provenance des données

Ajouter un indicateur de disponibilité/qualité des données pour matchs, analyses et tickets :
- données complètes ;
- données partielles ;
- données insuffisantes.

Afficher les sources ou la date de mise à jour lorsque c'est possible. Ne pas donner le même niveau d'assurance à un match bien documenté et à une compétition pour laquelle peu de données sont disponibles.

## 10. Création et gestion de tickets par la voix

Permettre à l'utilisateur de dire, par exemple : « Crée un ticket test : victoire du Real Madrid, victoire de Porto et double chance sur Craïova. »

Parcours :
1. transcription vocale ;
2. identification des matchs et marchés ;
3. création d'un ticket structuré en brouillon ;
4. affichage pour correction ;
5. confirmation explicite avant enregistrement.

Utiliser une solution navigateur/système ou dictée mobile à faible coût si adaptée. Prévoir une alternative texte lorsque la reconnaissance vocale n'est pas disponible ou fiable. La voix ne doit pas enregistrer automatiquement un ticket ambigu.

## 11. UX/UI, accueil et fiche de match

L'UX doit faciliter trois actions principales :
- trouver et comprendre un match ;
- importer/créer un ticket ;
- suivre les Paris test et ses performances.

Ne pas surcharger l'accueil. Pour un nouvel utilisateur : explication rapide, matchs et invitation à un premier Paris test. Pour un utilisateur actif : favoris, tickets en cours, résultats test et sources suivies.

Fiche de match à trois niveaux :
1. Comprendre rapidement : score/statut, classement, forme, enjeu, marchés disponibles.
2. Analyser : statistiques, confrontations, domicile/extérieur, tendances.
3. Approfondir : Coach, sources, historique des cotes si disponible, justification.

S'inspirer de la densité/navigation de Flashscore pour l'exploration des matchs, sans copier l'interface. Prioriser la lisibilité sur téléphone Android et la performance.

## 12. Référence vidéo concurrente et direction artistique

La vidéo promotionnelle partagée sert de référence de direction artistique et de mise en scène :
- identité sportive et technologique cohérente ;
- univers de stade, lumière et graphisme ;
- animation courte ;
- présentation des fonctionnalités par bénéfice ;
- cohérence entre publicité, app et Betster.

Ne pas conclure de la vidéo seule que l'application concurrente possède une meilleure UX ou des fonctionnalités supérieures. L'exemple ne permet pas d'évaluer la navigation réelle, la qualité des données, la fluidité ou la facilité de création de tickets.

Pour BETWISE, viser une identité visuelle forte, mais conserver une interface plus fonctionnelle, claire et pédagogique.

## 13. Tutoriels courts par section

Ajouter un accès « Comment ça marche ? » dans chaque section :
- Matchs ;
- Prédictions ;
- Import/mes tickets ;
- Paris test ;
- Coach ;
- Sources/tipsters.

Préférer des tutoriels courts (environ 15 à 30 secondes), préenregistrés, en français, sous-titrés, optionnels et rejouables. Réduire les coûts par des contenus réutilisables. Ne pas bloquer l'utilisateur par un tutoriel obligatoire.

## 14. Betster et expérience vidéo/vocale

Betster réaliste avec synchronisation labiale est un chantier séparé et ambitieux. Ne pas le rendre bloquant pour les améliorations fonctionnelles.

À court terme :
- voix française simple ;
- tutoriels audio/vidéo ;
- animation légère et réutilisable ;
- animations de données et accompagnement pédagogique.

À moyen terme, étudier un avatar plus réaliste, sa technologie, les coûts récurrents, la latence, la qualité de synchronisation labiale et les contraintes d'intégration. Ne pas engager de dépense ou intégrer un service payant sans validation de l'utilisateur. Consulter les documents Betster existants avant de proposer une nouvelle direction.

## 15. Notifications et consultation hors connexion

Notifications optionnelles, limitées aux événements utiles :
- match favori bientôt ;
- ticket test terminé ;
- nouveau pronostic d'une source suivie ;
- résultat mis à jour ;
- analyse importante disponible.

L'utilisateur choisit ce qu'il reçoit. Éviter les notifications intrusives.

Si l'architecture le permet sans complexité excessive, prévoir une consultation hors connexion partielle des tickets enregistrés, matchs récents, analyses déjà chargées et résultats personnels. Les scores live, nouvelles cotes et données actualisées nécessitent une connexion.

## Priorités proposées

### Lot 0 — Audit de l'existant
Cartographier l'état actuel de chaque point dans le code et les documents. Identifier les fonctionnalités déjà réalisées et les lacunes. Pas de refonte aveugle.

### Lot 1 — Couverture et navigation des matchs
Recherche, filtres, compétitions, données, disponibilité et fiche match.

### Lot 2 — Import universel de tickets
Liens Betclic/1xBet, code 1xBet si exploitable, OCR, normalisation des marchés, résolution d'événements, validation et sécurité.

### Lot 3 — Paris test
Création, suivi, règlement, statistiques et cote initiale.

### Lot 4 — Historique utilisateur et mesure des tipsters
Performance fiable, horodatage, anti-modification rétroactive.

### Lot 5 — UX/UI
Améliorer les parcours Matchs, import de ticket, Paris test et accueil selon l'audit réel.

### Lot 6 — Coach contextuel et qualité des données
Enjeux vérifiés, sources, limites et données manquantes.

### Lot 7 — Voix et tutoriels
Dictée de ticket, correction/confirmation, tutoriels courts.

### Lot 8 — Betster avancé
Étude séparée, coût/risque/technologie, puis décision utilisateur.

## Critères de réussite du prototype

Un testeur doit pouvoir :
1. retrouver un match pertinent ;
2. importer un coupon Betclic ou 1xBet si son format est accessible, sinon obtenir une explication et un fallback clair ;
3. corriger les sélections ambiguës ;
4. créer un ticket test ;
5. suivre les résultats ;
6. comprendre son bilan sans confusion entre réussite et rentabilité ;
7. consulter une analyse de match factuelle et comprendre les limites des données.

## Livrable attendu de Claude avant développement

Créer un audit structuré avec :
- état actuel de chaque chantier ;
- preuves et fichiers concernés ;
- limites techniques démontrées, notamment pour les liens de coupons et les cotes Betclic ;
- proposition de lots ordonnés et dépendances ;
- critères d'acceptation testables ;
- estimation des coûts récurrents éventuels ;
- recommandation du premier lot à exécuter.

Ne pas commencer par une refonte générale de l'interface. Le socle prioritaire est : **couverture des matchs + import fiable des tickets + Paris test**, puis UX/Coach/voix et Betster.
