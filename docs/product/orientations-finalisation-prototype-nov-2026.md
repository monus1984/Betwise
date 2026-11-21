# Orientations produit — finalisation du prototype BETWISE

Date : 21 novembre 2026
Statut : brief produit à auditer et prioriser ; aucune autorisation de fusion, déploiement ou dépense.

## 1. Objectif et contrainte principale

La priorité de Mounir est de **finaliser un prototype BETWISE crédible avec des coûts faibles ou nuls**, avant d'engager des frais importants ou des services récurrents.

Il ne s'agit pas d'ajouter des fonctionnalités sans ordre. Le prototype doit permettre à un utilisateur de :
1. retrouver un nombre suffisant de matchs et compétitions ;
2. consulter une fiche match utile ;
3. créer ou importer un ticket Betclic ou 1xBet, y compris par voix ou lien de coupon lorsque techniquement possible ;
4. tester ses intuitions ou les pronostics d'un tipster sans argent réel ;
5. suivre et comprendre ses résultats.

Avant toute modification, Claude doit lire ce brief, le fichier CLAUDE.md, l'audit du 19 novembre et les briefs produit/brand déjà référencés. Il doit ensuite auditer l'état réel du code et des branches : ne pas considérer une fonctionnalité comme absente si elle existe déjà, ni comme terminée uniquement parce qu'un document la mentionne.

## 2. Couverture des matchs — ambition d'expérience proche de Flashscore

La couverture actuelle présente trop peu de matchs. BETWISE doit progresser vers une expérience de consultation large, pratique et régulière, inspirée des usages de Flashscore, sans copier son identité visuelle ou ses écrans à l'identique.

### Compétitions à vérifier et élargir
- Championnats européens majeurs et secondaires ;
- Belgique ;
- Turquie ;
- Pays-Bas ;
- Danemark ;
- Norvège ;
- Saudi Pro League ;
- deuxièmes divisions (D2) ;
- compétitions africaines et championnats locaux lorsque les données sont disponibles.

Cette liste est une demande de couverture, pas une affirmation que les fournisseurs actuels la supportent. Claude doit produire une matrice réelle : compétition/division, matchs disponibles, historique/statistiques, marchés, cotes, fraîcheur, fournisseur et limites.

### Expérience Matchs souhaitée
- davantage de matchs présentés, y compris matchs à venir et en direct si les données le permettent ;
- navigation par date, pays et championnat ;
- recherche par équipe et compétition ;
- filtres et favoris ;
- noms de clubs complets et lisibles ;
- accès rapide au score, statut, statistiques, marchés, cotes et analyse ;
- fiche match structurée, lisible sur téléphone, avec détails progressifs ;
- états clairs quand les données sont partielles ou indisponibles.

Ne jamais afficher un match, une statistique ou un marché comme disponible sans preuve dans la source.

## 3. Cotes Betclic — priorité marché utilisateur

Les cotes Betclic sont actuellement absentes ou insuffisamment intégrées, alors que Mounir indique que Betclic est très utilisé par les utilisateurs ciblés dans ses marchés.

Claude doit :
- auditer les sources de cotes réellement intégrées ;
- vérifier s'il existe une source autorisée, fiable et économiquement viable pour les cotes Betclic ;
- comparer couverture, fraîcheur, coûts, limites et droits d'utilisation ;
- privilégier Betclic dans les parcours utilisateur si les données sont accessibles légalement et techniquement ;
- distinguer clairement cotes Betclic, cotes d'un autre fournisseur et cotes importées depuis le ticket utilisateur.

Pour le prototype à faible coût, conserver la cote visible sur le ticket importé ou saisie par l'utilisateur, avec l'heure/date d'enregistrement, peut être une solution transitoire. Ne pas présenter une cote comme Betclic si elle provient d'une autre source.

Aucun abonnement ou frais fournisseur ne doit être engagé sans validation explicite de Mounir.

## 4. Reconnaissance de tickets — Betclic et 1xBet

La reconnaissance doit viser une couverture aussi large que raisonnablement possible des options et marchés proposés par Betclic et 1xBet, et ne pas être limitée à quelques marchés 1X2.

### Modes d'import à prendre en charge
- capture d'écran ou image du coupon ;
- texte copié/collé ;
- lien de coupon ou de partage ;
- code de coupon si la plateforme le propose et si le format est exploitable ;
- création manuelle ou correction d'une sélection.

### Pipeline attendu
1. identifier le bookmaker et le type de coupon ;
2. extraire les matchs, équipes, dates, marchés, sélections et cotes visibles ;
3. normaliser les intitulés des marchés dans un modèle BETWISE commun ;
4. rattacher chaque sélection au bon événement, championnat et date ;
5. signaler les éléments ambigus ou non reconnus ;
6. demander à l'utilisateur de confirmer/corriger avant d'enregistrer.

### Principes de fiabilité
- reconnaître les variantes d'écriture et les noms abrégés de clubs ;
- ne pas confondre deux équipes portant des noms similaires ;
- ne pas rejeter tout le ticket lorsqu'une seule sélection est inconnue ;
- conserver les sélections non reconnues comme « à confirmer » si possible ;
- ne jamais inventer la cote, l'adversaire, la date ou le marché manquant ;
- prévoir un statut par sélection : reconnu, partiel, non reconnu, à confirmer.

Claude doit établir une taxonomie des marchés réellement rencontrés sur les coupons Betclic et 1xBet, comparer cette liste à ce que le code sait déjà parser, puis proposer les ajouts par lots. Ne pas promettre « tous les marchés » sans tests représentatifs et limites documentées.

## 5. Import de coupon via un lien Betclic ou 1xBet

Mounir souhaite que l'utilisateur puisse coller un lien de coupon Betclic ou 1xBet et retrouver les sélections dans BETWISE.

### Comportement attendu
- l'utilisateur colle le lien ;
- BETWISE identifie le domaine et le type de lien ;
- le système tente d'extraire les sélections si le contenu est publiquement accessible et autorisé ;
- les données sont normalisées et associées aux matchs ;
- l'utilisateur vérifie et confirme avant création du ticket.

### Étude technique obligatoire
Claude doit tester des exemples réels de liens de partage pour les deux plateformes et documenter les résultats. Les liens peuvent être des redirections, des deep links, des pages dynamiques, expirer ou nécessiter une session. **La possibilité dépend du format et de l'accessibilité du coupon ; elle ne doit pas être considérée comme garantie.**

Prévoir des solutions de repli :
- OCR de capture d'écran ;
- code de coupon, si exploitable ;
- texte copié ;
- saisie/correction manuelle.

Ne pas demander ni stocker les identifiants de compte bookmaker, ne pas contourner une authentification ou une protection d'accès, et vérifier les conditions d'utilisation. Sécuriser le traitement des URL contre les redirections malveillantes et les accès serveur non sûrs (SSRF).

## 6. Paris test — expérience de pratique et de mesure

Les Paris test doivent devenir une expérience complète, pas un simple ticket virtuel.

L'utilisateur doit pouvoir :
- créer un ticket test depuis un match, un ticket importé, une intuition personnelle ou un pronostic de tipster ;
- ajouter un ticket ou une sélection par saisie ou voix ;
- choisir une mise virtuelle ;
- enregistrer la cote disponible au moment de la création ;
- suivre les résultats jusqu'au règlement ;
- comparer ses propres intuitions à celles de tipsters ;
- mesurer sa performance sur une période.

### Indicateurs à prévoir
- taux de réussite des sélections terminées ;
- taux de réussite des tickets terminés ;
- bilan virtuel (gain/perte théorique) ;
- cote moyenne ;
- performance par type de marché ;
- performance par compétition ;
- performance par tipster et période.

Distinguer clairement ticket et sélection. Gérer les paris annulés, remboursés, void et les tickets partiellement réglés. Conserver date/heure et cote initiale pour éviter les modifications rétroactives. Les résultats de tipsters doivent être calculés sur un historique enregistré, pas sur des résultats déclaratifs modifiables après coup.

Les Paris test sont une fonctionnalité de mesure et d'apprentissage, pas une promesse de gain ni une incitation à miser de l'argent réel.

## 7. Création de tickets et paris par la voix

Mounir souhaite pouvoir créer des tickets ou paris par commande vocale, y compris pour des championnats qui ne sont pas encore bien couverts par la recherche ou les données BETWISE.

Exemple d'intention : « Ajoute en pari test la victoire de l'équipe X contre l'équipe Y dans le championnat Z ».

### Parcours prototype
1. transcription de la parole en texte ;
2. extraction de l'intention, du match, du championnat, du marché et de la sélection ;
3. recherche/association au match si disponible ;
4. si le championnat ou l'événement n'est pas couvert, proposer une création manuelle structurée avec les informations que l'utilisateur fournit, sans inventer les données manquantes ;
5. afficher le ticket récapitulatif ;
6. confirmation explicite avant enregistrement.

Commencer avec la dictée native du téléphone ou une solution navigateur gratuite si compatible. Tester les limites Android/navigateurs et prévoir la saisie texte comme alternative. Ne pas lancer d'API vocale payante sans validation.

## 8. Refonte UX/UI

Mounir considère que l'UX/UI peut encore être nettement améliorée.

Axes attendus :
- audit de tous les parcours sur un téléphone Android de largeur cible 360 px ;
- améliorer la hiérarchie, la lisibilité et la densité utile des écrans ;
- rendre la navigation Matchs proche des habitudes d'applications de scores : dates, compétitions, recherche, favoris et accès rapide aux matchs ;
- simplifier les parcours d'import, de correction et de confirmation des tickets ;
- faire des Paris test une expérience visible et facile à comprendre ;
- réduire les écrans vides et les impasses ;
- utiliser des états de chargement, erreurs, données partielles et absence de couverture compréhensibles ;
- conserver l'identité BETWISE validée et les conventions du design system lorsqu'elles sont pertinentes.

Ne pas lancer une refonte globale non ciblée. Produire d'abord un audit avec captures, problèmes priorisés et proposition de parcours, puis traiter par lots cohérents.

## 9. Vidéo concurrente — référence de direction artistique

Mounir a partagé dans la conversation ChatGPT une vidéo promotionnelle d'une application concurrente, à utiliser comme référence d'inspiration pour la présentation visuelle et la mise en scène de l'application.

Éléments à étudier dans cette référence :
- univers sports-tech et cohérence graphique ;
- présentation dynamique des écrans ;
- transitions et animations ;
- mise en avant des bénéfices produit ;
- équilibre entre démonstration de fonctionnalités et identité visuelle.

Il s'agit d'une référence d'inspiration, pas d'une demande de copier l'interface, la marque ou les contenus. **La vidéo n'est pas actuellement dans le dépôt GitHub** : Claude ne doit pas prétendre l'avoir consultée depuis le dépôt. Si une analyse image par image est nécessaire, demander à Mounir d'ajouter la vidéo ou des captures dans le dépôt ou dans un emplacement accessible à Claude.

## 10. Coach — analyse contextuelle et narrative

Mounir souhaite une analyse plus vivante que la simple récitation de statistiques.

Le Coach doit contextualiser le match avec des éléments vérifiés :
- enjeu de classement ;
- course au titre, qualification européenne, maintien ou montée ;
- possibilité de prendre/reprendre une place ;
- importance du résultat par rapport aux concurrents ;
- dynamique récente et réaction attendue, formulée avec prudence ;
- statut de promu ou niveau de division, uniquement si vérifié ;
- confrontations et calendrier, si pertinents.

Exemple de style attendu (exemple illustratif, à ne pas utiliser comme fait sans données à jour) : expliquer qu'une victoire pourrait permettre à une équipe de prendre la première place ou de revenir dans la course, plutôt que simplement annoncer sa forme sur cinq matchs.

### Règles éditoriales
- séparer faits vérifiés, contexte, interprétation et estimation ;
- ne pas inventer une motivation, une rivalité ou un enjeu ;
- ne pas affirmer qu'une équipe « doit gagner » comme si cela garantissait le résultat ;
- utiliser « pourrait », « enjeu de », « en cas de victoire » lorsque la situation le nécessite ;
- fournir la source, la date de mise à jour ou un indicateur de fraîcheur lorsque possible ;
- ne pas produire de narration contextuelle si les données de classement ou de compétition manquent.

## 11. Tutoriels dans chaque section

Prévoir une aide courte et contextuelle dans chaque section, accessible par un bouton du type « Comment ça marche ? ».

Sections à couvrir au minimum :
- Matchs ;
- Prédictions ;
- Mes paris / import de tickets ;
- Paris test ;
- Coach / bankroll ;
- Sources / tipsters.

Format souhaité :
- mini vidéo ou tutoriel vocal/visuel de 15 à 30 secondes ;
- sous-titres ;
- possibilité de passer, fermer et revoir ;
- pas de tutoriel imposé à chaque visite.

Pour le prototype, privilégier des tutoriels préenregistrés ou des aides simples à faible coût. Betster pourra les présenter plus tard ; ne pas rendre leur disponibilité dépendante du futur avatar réaliste.

## 12. Betster et maîtrise des coûts

Le besoin d'un Betster plus réaliste est déjà décrit dans l'audit du 19 novembre. Il reste valable, mais la priorité actuelle est de finaliser le prototype sans frais lourds.

Claude doit :
- garder l'étude de l'avatar réaliste comme chantier séparé ;
- privilégier d'abord les améliorations à coût faible : voix existante, sous-titres, états de conversation, tutoriels et animations légères utiles ;
- ne pas présenter une animation CSS d'image fixe comme un personnage humain réaliste ;
- comparer les solutions et leurs coûts avant toute dépense ;
- ne retenir aucun fournisseur ni engager de coût récurrent sans approbation de Mounir.

## 13. Améliorations supplémentaires proposées

Ces points sont des propositions complémentaires à valider, et non des décisions déjà implémentées.

### Indicateur de qualité des données
Afficher lorsque pertinent :
- données complètes ;
- données partielles ;
- données insuffisantes ;
- source et fraîcheur.

Cela aidera l'utilisateur à comprendre pourquoi certains matchs, marchés ou analyses sont disponibles et d'autres non.

### Historique de performance du parieur
Construire progressivement un historique fiable de ses Paris test et tickets enregistrés, pour identifier :
- marchés où il réussit le mieux ;
- compétitions suivies ;
- performances par tipster ;
- erreurs récurrentes ;
- évolution dans le temps.

Ne pas utiliser une « mémoire » qui modifie ou réécrit les résultats historiques.

### Transparence de l'analyse
Pour chaque recommandation ou analyse, rendre visible la distinction entre :
- données observées ;
- estimation du modèle ;
- contexte éditorial ;
- information manquante.

## 14. Priorisation suggérée pour le prototype

Claude doit proposer une estimation effort/impact/coût après audit du code existant. Ordre de discussion proposé :

P0 — Socle et valeur immédiate
1. audit de couverture matchs/compétitions et qualité des données ;
2. amélioration de l'expérience Matchs et recherche ;
3. diagnostic des cotes Betclic et solution transitoire ;
4. audit du parseur de tickets Betclic/1xBet et matrice des marchés.

P1 — Parcours différenciants
5. import de coupon par lien, avec tests réels et solutions de repli ;
6. Paris test complets et statistiques ;
7. création de tickets par voix, avec confirmation ;
8. UX/UI des tickets et Paris test.

P2 — Expérience enrichie
9. Coach contextuel/narratif basé sur données vérifiées ;
10. tutoriels vocaux ou vidéo par section ;
11. amélioration de Betster dans la limite du budget ;
12. indicateurs de qualité des données et historique de performance.

Ce classement est une proposition à confirmer après audit. Ne pas démarrer plusieurs lots simultanément.

## 15. Livrables demandés à Claude

Avant de coder :
1. confirmer les branches et commits concernés, notamment l'état réel de la branche applicative accueil ;
2. auditer les fonctionnalités déjà présentes ;
3. fournir une matrice de couverture des compétitions et marchés ;
4. fournir une matrice de reconnaissance de tickets avec exemples Betclic et 1xBet ;
5. tester la faisabilité des liens de coupons et documenter les limites ;
6. vérifier les sources/couts/droits pour les cotes Betclic ;
7. proposer une roadmap effort/impact/coût pour un prototype à faible budget ;
8. identifier les écrans UX/UI à revoir en priorité.

Après chaque lot :
- fichiers modifiés ;
- tests exécutés et résultats ;
- cas réels utilisés (sans données privées) ;
- limites et cas non reconnus ;
- coûts éventuels ;
- capture sur Android/mobile si possible.

## 16. Garde-fous

- Pas de frais, API payante ou abonnement récurrent sans accord explicite de Mounir.
- Pas de migration ou changement de production sans approbation explicite.
- Pas de fusion de branche ni déploiement sans approbation explicite.
- Ne pas modifier main directement.
- Ne pas supposer que design-accueil contient le code de accueil.
- Ne pas inventer matchs, marchés, cotes, données, analyses, résultats ou disponibilité.
- Ne pas garantir la reconnaissance de tous les coupons/marchés avant tests.
- Ne pas demander les identifiants Betclic/1xBet ni contourner les protections.
- Respecter les droits de données, les conditions des plateformes et la confidentialité.
- Conserver la validation utilisateur avant création/enregistrement d'un ticket importé ou dicté.

## Critère de réussite du prototype

Un utilisateur peut retrouver un match dans une couverture suffisamment large, consulter une analyse lisible, importer ou dicter un ticket Betclic/1xBet (ou utiliser un mode de repli clair), corriger les sélections, le suivre en Paris test et mesurer ses résultats sans engager d'argent réel.

Le produit doit être fiable et honnête sur ses limites, utilisable sur un Android moyen et réalisable sans coûts lourds.

## 17. Valeur différenciante BETWISE — suivi, analyse personnelle et bankroll

Ces fonctionnalités doivent être considérées comme des éléments centraux de la proposition de valeur, et pas comme de simples options secondaires.

### Sources et tipsters
- Permettre à l'utilisateur de suivre les sources de pronostics qu'il consulte (tipsters, pages ou communautés).
- Enregistrer les pronostics suivis avec leur source, date/heure, sélection et cote disponible au moment de l'enregistrement.
- Calculer les performances à partir des pronostics réellement enregistrés et réglés : taux de réussite, rendement théorique si les données nécessaires sont présentes, régularité et résultats par championnat ou marché.
- Ne pas présenter une source comme fiable sur la base d'un petit échantillon ou de résultats modifiables rétroactivement. Afficher le nombre de pronostics et la période observée.

### Analyse des tickets et profil du parieur
- Analyser les tickets enregistrés ou importés, ainsi que les Paris test, afin d'identifier les forces et faiblesses personnelles.
- Mettre en évidence les performances par type de marché, plage de cote, compétition, format simple/combiné, nombre de sélections et source/tipster.
- Repérer les tendances récurrentes et les erreurs possibles, sans jugement ni formulation culpabilisante.
- Distinguer taux de réussite des sélections, taux de réussite des tickets, rendement théorique et bilan réel déclaré. Ne pas déduire la rentabilité du seul taux de réussite.
- Les observations doivent être calculées sur l'historique disponible, avec taille d'échantillon et période visibles ; ne pas inventer de conclusions lorsque les données sont insuffisantes.

### Bankroll et accompagnement du Coach
- Faire du volet bankroll un outil de suivi : capital de départ, solde, mises, gains/pertes, évolution et historique.
- Permettre à Betster d'expliquer les mouvements et les tendances observées dans la bankroll à partir des données de l'utilisateur.
- Le Coach accompagne l'utilisateur avant, pendant et après ses choix : comprendre un match, examiner un ticket, suivre un résultat, analyser ses performances et consulter sa bankroll.
- Le Coach peut signaler une concentration excessive des mises, une baisse de bankroll ou une série de pertes, sans présenter cela comme une prédiction ni encourager à récupérer les pertes.
- Les conseils doivent rester informatifs, non prescriptifs et transparents. Aucune garantie de gain, aucune incitation à augmenter les mises ; l'utilisateur garde le contrôle.

## 18. Brief de direction pour la vidéo promotionnelle BETWISE

Claude doit utiliser ce brief pour préparer une vidéo de présentation. La vidéo de référence concurrente sert à inspirer le rythme et la mise en scène, sans copier sa marque, ses scènes ou son interface. L'enregistrement de BETWISE fourni par Mounir sert à comprendre les sections et les fonctionnalités réelles ; il ne doit pas être utilisé comme simple séquence de captures défilantes.

### Positionnement à transmettre
BETWISE est un compagnon analytique du parieur : il permet d'explorer les matchs, de comprendre les sélections, de retrouver et analyser ses tickets, de tester ses intuitions, de suivre ses sources, de mesurer ses résultats et de gérer sa bankroll avec l'aide de Betster.

### Fonctionnalités à mettre en scène en priorité
1. Centre de matchs organisé et riche, inspiré des usages de Flashscore : écussons, matchs classés du plus proche au plus éloigné, horaires/statuts lisibles et accès aux informations.
2. Betster qui analyse les matchs du jour encore à venir (pas uniquement ceux du lendemain), présente les sélections du jour avec probabilités estimées lorsque le modèle et les données le permettent, puis explique le contexte factuel.
3. Import intelligent de tickets Betclic et 1xBet par lien, code ou capture, selon la faisabilité réelle ; reconnaissance des sélections et validation par l'utilisateur.
4. Analyse des tickets : mettre en évidence les forces et faiblesses du parieur et ses performances par marché, cote, championnat, format de ticket et source.
5. Paris test : suivre ses intuitions et pronostics sans argent réel, puis mesurer les résultats.
6. Suivi des sources/tipsters : comparer les pronostics enregistrés avec transparence sur le nombre d'observations et la période.
7. Bankroll : visualiser le capital, les mises, les gains/pertes et l'évolution, avec Betster comme accompagnateur explicatif.
8. Voix et Coach conversationnel : demander une analyse ou construire un ticket par la voix lorsque cette fonction est effectivement disponible.

### Direction artistique et réalisation attendue
- Produire une véritable publicité motion design / vidéo IA sports-tech, pas un diaporama de captures d'écran.
- Prévoir un stade de football cinématographique, éclairages dynamiques, scènes en profondeur, smartphone mis en scène en perspective ou en 3D, animations de données, transitions maîtrisées, titres cinétiques et voix off française.
- Les vrais écrans BETWISE doivent apparaître ponctuellement comme preuve du produit, intégrés dans une composition visuelle travaillée.
- Construire un storyboard scène par scène, avec durée, visuel, mouvement caméra, texte écran, voix off et fonctionnalité représentée.
- Choisir une durée courte (environ 35 à 45 secondes) et un format vertical 9:16, sauf autre décision validée.
- Ne pas prétendre qu'un montage de captures 2D constitue une publicité 3D. Utiliser les outils vidéo adaptés disponibles et préciser les coûts/crédits avant toute génération payante.

### Proposition de narration
« Les matchs. Les analyses. Tes tickets. Tes résultats. »
Puis montrer le parcours : explorer les matchs → comprendre une sélection avec Betster → importer/analyser un ticket → tester ses intuitions → mesurer ses performances et suivre sa bankroll.

### Signature proposée
« BETWISE — Comprends les matchs. Construis tes tickets. Teste tes intuitions. Apprends de tes résultats. »

Ne montrer comme déjà disponible que les fonctionnalités réellement présentes et testées dans le prototype. Les fonctionnalités en développement doivent être indiquées comme concept ou à venir. Les probabilités sont des estimations, jamais des garanties.