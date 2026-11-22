# Revue indépendante UX/UI — ChatGPT

Date : 22 novembre 2026
Référence auditée : audit de Claude du 22/11/2026, production `main` au commit `de8e3de`, rapport et mesures déposés dans ce dossier.
Statut : avis indépendant et recommandations ; aucune correction réalisée.

## 1. Périmètre et limite de cette revue

J'ai lu le `README.md` de ce dossier, `01-audit.md`, `02-mesures.md`, ainsi que l'avis Claude `docs/design/tipsters-ia/01-avis-claude.md` pour répondre à ses questions.

**Limite à noter :** les captures sont bien référencées dans le README, mais je n'ai pas pu les afficher dans mon environnement de revue. Je ne prétends donc pas avoir inspecté visuellement les 195 images ni manipulé l'application. Les constats ci-dessous s'appuient sur les observations, mesures, chemins et composants consignés par Claude. Les propositions de parcours sont une analyse UX, pas des constats de test utilisateur.

## 2. Conclusion générale

L'audit est solide dans sa structure : il distingue les constats des recommandations, relie les défauts aux composants et donne des mesures. Je partage l'essentiel de ses priorités.

Mon point principal : **BETWISE doit d'abord être fiable et intelligible avant d'être plus dense ou plus spectaculaire.** Pour un produit d'analyse de paris, une information de marché incohérente, un ticket test réglable trop tôt ou un niveau de risque contradictoire détruit davantage la confiance qu'un défaut cosmétique.

Je ne commencerais pas par une refonte globale. Je traiterais les incohérences de données et les obstacles aux actions principales, puis la lisibilité, puis les finitions.

## 3. Priorités indépendantes

### P0 — à traiter avant d'élargir le test

| Sujet | Avis ChatGPT | Critère d'acceptation |
| --- | --- | --- |
| P0-1 — coups du jour / tâches en retard | Priorité absolue, car l'accueil peut être obsolète au moment où l'utilisateur consulte. La correction d'horloge est un problème de fiabilité produit, pas seulement de présentation. | Les tâches s'exécutent dans une fenêtre définie et surveillée ; chaque sélection est rattachée à la date locale du match ; l'écran affiche clairement l'heure de dernière actualisation et un état de retard. |
| P0-2 — menu des championnats | Priorité absolue : l'utilisateur ne peut pas naviguer si les noms se ressemblent ou sont coupés. La proposition de Claude (nom complet + métadonnées secondaires) est la bonne direction. | Noms complets visibles à 360 px et 320 px ; pays/division et nombre de matchs sont secondaires ; le chevron, favori et action de classement restent distincts et utilisables. |
| P0-3 — libellés des sélections | Priorité absolue : le pourcentage n'a pas de valeur si l'utilisateur ne comprend pas le marché. Le nom de la sélection doit primer sur les chiffres. | Le libellé complet du marché/sélection est visible sans ellipse sur les formats courants ; les probabilités et cotes sont sur une ligne secondaire ; le détail reste accessible. |
| P0-4 — niveaux de risque | Priorité absolue et correction transversale. Il faut une source de vérité, pas une correction écran par écran. | Une seule fonction/règle utilisée par toutes les vues et statistiques ; cote et bookmaker clairement identifiés ; aucune cote sous le minimum autorisé classée « Prudent » ; tests unitaires couvrant les bornes. |

### P1 — ordre que je recommande

1. **P1-3 — chiffres contradictoires sur la fiche match.** Corriger avant d'optimiser les cartes : une cote de référence et une cote bookmaker doivent être distinguées, datées et nommées. Les probabilités reprises dans plusieurs composants doivent venir d'une source de données unique.
2. **P1-5 — textes factuellement faux.** Je remonterais ce point dans le haut du P1, proche du P0 : les messages d'aide et d'état doivent refléter la réalité (filtre, pays/heure, couverture du modèle, actualisation). Un texte faux donne une mauvaise explication au lieu d'aider.
3. **P1-4 — règlement manuel d'un pari test avant le coup d'envoi.** C'est une faille d'intégrité de l'expérience. Masquer l'action avant le début du match est nécessaire, mais ne suffit pas à garantir l'historique : côté serveur, le règlement doit être impossible avant l'heure de fin/état vérifié, et les tickets verrouillés ne doivent pas être modifiables/supprimables par le parcours utilisateur.
4. **P1-1 — Betster flottant.** Corriger le recouvrement sans supprimer Betster de l'expérience. Détails ci-dessous.
5. **P1-2 — fenêtre d'aide sous les éléments fixes.** Corriger via une couche de dialogue/portal cohérente, avec fermeture accessible, focus et zone tactile non recouverte.
6. **P1-13 — import : hiérarchie des actions.** Le choix du fichier est l'action principale ; les actions d'analyse doivent être désactivées tant qu'une entrée valide n'est pas fournie. En mode test, afficher le contexte dès l'arrivée.
7. **P1-8 — classement des sources.** Revoir les seuils et l'incertitude avant de mettre en avant des rangs ou des qualificatifs comme « confirmé ». Afficher le volume d'observations près du résultat.
8. **P1-10 et P1-11 — performance/hydratation de l'accueil.** Diagnostiquer d'abord l'erreur intermittente et les appels lents ; optimiser ensuite. Ne pas réduire le contenu au hasard pour masquer le problème.
9. **P1-7 — montante incohérente avec le niveau choisi.** Le formulaire doit recalculer les paliers ou expliquer clairement qu'il sort de la plage de risque choisie.
10. **P1-6, P1-9, P1-12, P1-14, P1-15.** Traiter ensuite les titres, codes internes, contrastes, tri et navigation historique. P1-15 peut remonter si l'historique est un parcours important pour les tests de sources et les paris test.

Les priorités P0/P1 du rapport sont globalement justifiées. Je ne rétrograderais pas les incohérences de risque, les textes faux ni le règlement prématuré.

## 4. Betster flottant — avis sur P1-1

Je recommande de **conserver Betster comme présence de marque et point d'accès permanent**, mais pas nécessairement sous la forme d'une bulle fixe à la même position sur chaque écran.

### Règle de placement
- Sur la fiche match, le bouton principal « Tester cette sélection » / « Parier sur ce match » doit rester entièrement visible. Betster devrait être dans l'en-tête, dans une action secondaire ou dans un emplacement qui ne croise pas la CTA.
- Sur les listes denses (Matchs, Marchés, Options), la bulle ne doit jamais recouvrir les contrôles de la colonne droite. Prévoir un espace de sécurité en bas et à droite, ou déplacer Betster dans un emplacement non superposé.
- Sur l'accueil, Betster peut rester plus visible, car c'est l'écran de découverte et de relation avec le Coach.
- Sur les écrans où la conversation Betster est déjà l'objet principal, ne pas afficher une deuxième bulle flottante.
- Si la bulle est réduite visuellement, conserver une cible tactile d'au moins 44–48 px, avec marge par rapport aux actions voisines. Le visuel compact ne doit pas devenir un petit bouton difficile à toucher.
- Tester avec le clavier ouvert, le bas de page, la barre d'onglets, le mode sombre et une largeur de 320 px.

**Décision recommandée :** position contextuelle plutôt que suppression globale ou réduction uniforme. La présence de Betster doit aider à comprendre « je peux demander une explication », pas devenir un obstacle aux actions.

## 5. Accueil — que garder au-dessus de la ligne de flottaison ? (P1-10)

L'accueil mesuré à 9,9 écrans et 2,7 s de médiane (avec un pic à 24 s) est trop long pour une page d'entrée, mais il ne faut pas seulement le raccourcir : il faut rendre le premier écran décisionnel.

### Ordre de contenu proposé
1. **En-tête compact :** BETWISE, date/jour, état de fraîcheur des données. Éviter un grand bandeau qui consomme près d'un quart de l'écran.
2. **« Les coups du jour » :** montrer au maximum 1 à 2 cartes compactes au premier écran, avec match, sélection complète, cote/source et probabilité si disponible. Un « Voir tous les coups » ouvre la liste complète.
3. **Accès rapide aux matchs :** recherche ou bouton « Tous les matchs », date et compétition. L'utilisateur doit pouvoir passer immédiatement de la découverte à la recherche.
4. **Betster :** une invitation concise à poser une question, sans répéter un long texte explicatif.
5. **Contenu secondaire sous le premier écran :** coups supplémentaires, tendances, autres profils, « demain », détails de justification.

### Pour les cartes de sélection
- Une ligne pour le match, une ligne pour le marché complet, une ligne compacte pour cote/source et probabilité.
- Le raisonnement long doit être replié derrière « Pourquoi ? » ; ne pas supprimer l'explication, car c'est un élément de confiance.
- Afficher « actualisé à… » et un état « données en retard » si nécessaire.
- Si aucun coup du jour n'est disponible, expliquer pourquoi et donner un accès utile aux matchs, plutôt qu'afficher un contenu daté sous un titre actuel.

Le premier écran doit répondre à trois questions : **qu'est-ce qui est pertinent aujourd'hui, sur quoi porte la sélection, et où puis-je vérifier ou explorer davantage ?**

## 6. Parcours d'un nouveau testeur : inscription au premier pari test

L'audit a capturé l'inscription et les écrans de pari test, mais ne couvre pas le parcours d'écriture. Voici le parcours cible à tester, non un parcours que je prétends avoir exécuté.

1. **Inscription / connexion.** Confirmation claire de l'entrée dans l'application ; éviter de demander des informations non nécessaires.
2. **Premier écran.** Une courte explication de BETWISE et de la différence entre analyse, prédiction et pari test. Pas de tutoriel imposé long.
3. **Découverte d'un match.** L'utilisateur trouve un match par recherche, compétition ou sélection du jour.
4. **Fiche match.** Il comprend les équipes, le marché, la cote/source, la probabilité et les limites des données. Les termes doivent être explicites.
5. **Action directe.** CTA « Tester cette sélection » depuis la carte ou la fiche. Le marché et la sélection sont préremplis ; l'utilisateur ne doit pas les ressaisir.
6. **Récapitulatif avant enregistrement.** Match, marché, sélection, cote/source et heure de prise ; mise virtuelle proposée clairement. Si une donnée manque, la marquer et demander confirmation.
7. **Confirmation.** Un seul bouton explicite « Enregistrer le pari test ». Éviter les actions concurrentes ou le règlement immédiat.
8. **État après enregistrement.** Confirmation courte, ticket visible dans Paris test, statut « En attente du résultat » et retour vers le match ou le ticket.
9. **Après le match.** Règlement vérifié ou demande de correction clairement séparée, sans bouton de résultat accessible avant la fin.

### Critères de test
- Un testeur novice doit pouvoir créer son premier pari test sans connaître les termes techniques.
- Aucun marché ne doit être prérempli sans être visible et confirmable.
- L'utilisateur doit comprendre qu'il s'agit d'une simulation, pas d'un pari réel.
- Aucun pari test ne peut être réglé avant le match.
- Le parcours doit être testé sur un vrai téléphone Android, à 360 px et 320 px, et avec un réseau mobile moyen.

## 7. Points complémentaires que je mettrais dans le prochain audit

Ce ne sont pas des défauts observés dans les captures, mais des contrôles à ajouter, car ils sont importants pour un nouveau testeur et pour la confiance :

- **Onboarding :** première visite, compréhension de la valeur, possibilité de passer l'aide et de la retrouver.
- **États de données :** chargement, erreur, données partielles, données périmées, absence de couverture, et action de réessayer.
- **Accessibilité manuelle :** ordre de focus, noms accessibles, navigation clavier, VoiceOver/TalkBack, taille réelle des cibles tactiles. Le rapport précise que ces tests n'ont pas été réalisés.
- **Parcours d'écriture :** import capture, correction OCR, saisie manuelle, enregistrement, annulation et prévention des doublons.
- **Compte ancien :** historique de bankroll, montante active, bilans et notifications ; l'audit ne couvre qu'un compte neuf.
- **Téléphone et réseau local :** mesurer sur un Android moyen et réseau mobile en Côte d'Ivoire avant de fixer des objectifs de performance.
- **Confidentialité des captures et journaux :** poursuivre l'anonymisation des sources dans les captures publiques. L'incident décrit dans l'audit justifie un contrôle automatique avant publication.

## 8. Lot A — recommandation de validation

Je suis d'accord pour commencer par le lot A de Claude, mais j'ajouterais à son périmètre les P1-3 et P1-4 si les corrections peuvent être faites sans toucher aux données de production. Sinon, les séparer en deux sous-lots :

- **A1 — lisibilité et textes :** P0-2, P0-3, P1-2, P1-5, P1-6, P1-9, P1-12, P1-13, P1-14 et finitions de libellés.
- **A2 — confiance et intégrité :** P1-3, P1-4, P1-7, P1-8 ; ajouter tests et verrouillage appropriés.
- **B — horloge / coups du jour :** P0-1, après validation des changements d'infrastructure.
- **C — niveaux de risque unifiés :** P0-4 et P1-7, une règle et tests de bornes.
- **D — Betster :** P1-1, placement contextuel à valider sur les écrans denses.
- **E — accueil :** P1-10, après diagnostic de P1-11 ; mesurer avant/après.
- **F — historique et sources :** P1-8/P1-15 et les écrans de sources, en gardant les volumes d'observation visibles.

Pour chaque lot, demander une capture avant/après, les tests exécutés, la liste des fichiers modifiés et un contrôle mobile. Pas de merge ou de déploiement sans validation de Mounir.

## 9. Réponse à la section 12 de l'avis Claude — tipsters IA

La réponse détaillée est consignée dans `docs/design/tipsters-ia/02-reponse-chatgpt-point-12.md`. En résumé : je suis largement d'accord avec les écarts proposés par Claude ; je précise les conditions de comparaison, de verrouillage et de contrôle indépendant.
