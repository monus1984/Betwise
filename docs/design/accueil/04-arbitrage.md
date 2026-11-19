# 04 — Arbitrage : nouvel accueil

19 novembre 2026. Confronte le brief (`02-brief.md`) et l'avis de ChatGPT (`03-avis-chatgpt.md`, commit `d3ce95e`) au code et aux données réels (`01-audit.md`).

Les lignes « Décision » de l'avis de ChatGPT sont lues comme des recommandations : seules les décisions de Mounir, en section 4, engagent la suite.

## 1. Points d'accord

| Sujet | Brief et avis disent la même chose |
| --- | --- |
| Hiérarchie | La prédiction passe avant la bankroll ; l'accueil n'est pas un résumé de tous les onglets |
| Premier écran | Une analyse principale, sa probabilité, son risque ; deux ou trois autres en accès rapide |
| Matchs non couverts | Montrés, jamais masqués ; pas de pourcentage, de cote estimée ni de verdict inventé |
| Bankroll | Dans le Coach ; une ligne sur l'accueil ; les alertes restent visibles sans dominer |
| Avatar | Dans la carte « L'avis BETWISE », 48 à 56 px, voix facultative, personnage original |
| Scénarios | Pas dans ce lot ; plus tard, calculés à partir des scores probables, jamais inventés par un modèle de langage |
| Moment de la journée | Structure stable, contenu qui change avant, pendant et après les matchs, et les jours creux |
| Direction artistique | On garde les fondations (bleu nuit, vert, Inter, Barlow Condensed, écussons à initiales) et on renforce la personnalité |
| Garde-fous | Rien d'inventé, marché et modèle distingués, clair et sombre, léger sur réseau mobile |

## 2. Nuances et désaccords

**a. L'expression de l'avatar doit être calculée, pas choisie.** L'avis propose « confiant », « prudent », « neutre ». Sans règle, l'expression devient décorative, voire trompeuse. Ce que le moteur sait déjà dire pour chaque sélection : d'où vient la probabilité (cotes de référence ou modèle seul), l'écart entre le marché et le modèle, l'âge des données. Proposition :

| Expression | Règle proposée (à ajuster sur les mesures) |
| --- | --- |
| Confiant | Probabilité ≥ 60 %, marché et modèle à moins de 5 points l'un de l'autre, cotes de moins de 48 h |
| Prudent | Probabilité < 60 %, ou marché et modèle à plus de 5 points, ou modèle seul |
| Neutre | Pas de probabilité, ou données trop anciennes |
| Content, déçu | Lendemain seulement, sur le résultat de l'avis de la veille |

Cela sert aussi d'« indicateur de confiance » séparé de la probabilité, que l'avis demande à juste titre.

**b. Le bloc Sources : plus fort s'il parle des matchs du jour.** L'avis garde un aperçu des sources suivies. Une liste de noms et de notes n'a rien à faire sur un accueil prédictif. En revanche, « ce que disent tes sources sur les matchs du jour, face à BETWISE » est un vrai différenciateur, et les données existent (pronos importés, rattachés aux matchs). Proposition : ce bloc n'apparaît que si une source suivie a un prono sur un match du jour.

**c. La passerelle Coach ne montre que ce qui existe.** L'avis cite « Stratégies » : il n'y a encore ni montantes ni stratégies (étape 4). La passerelle affiche la bankroll en une ligne, le budget de la semaine s'il est fixé, et l'accès à la conversation.

**d. Ne pas écarter la piste « compagnon » trop tôt.** L'avis préfère l'analyste ou le stratège pour la crédibilité. Mounir a demandé un visage humain en miniature qui interagit, et une application « la plus fun possible ». Les trois pistes doivent être dessinées avant de choisir.

**e. Le hors ligne coûte plus qu'il n'y paraît.** Aujourd'hui, un bandeau signale la coupure, mais l'accueil n'est pas gardé en cache. Afficher « les dernières données consultées, avec leur heure » demande de mettre la page en cache dans le service worker. Faisable, mais c'est du travail : à classer P1 plutôt que P0.

**f. Renommer Matchs en Prédictions dans ce lot.** Ce n'est pas dans la liste de l'avis. C'est un petit changement, cohérent avec la nouvelle hiérarchie, prévu dans la feuille de route.

**g. Qui fait les maquettes.** Aucun de nous deux ne dessine dans Figma. Proposition :
- **Claude** produit les écrans en haute fidélité, en HTML, avec les vraies couleurs, polices et composants de l'application, en clair et en sombre, avec des données fictives. Ce qui est montré est alors ce qui sera construit.
- **ChatGPT** produit les images des trois pistes d'avatar (génération d'images) et fait la revue des écrans.

## 3. Priorités proposées pour ce lot

| Priorité | Élément | Effort |
| --- | --- | --- |
| P0 | Nouvel accueil, jour chargé, clair et sombre | Moyen : composants existants réorganisés |
| P0 | Matchs non couverts affichés honnêtement | Faible |
| P0 | Indicateur de confiance et expression de l'avatar calculés (2a) | Faible : données déjà là |
| P0 | Matchs renommé Prédictions | Faible |
| P1 | États en direct, jour creux, nouvel abonné, lendemain | Moyen |
| P1 | Avatar en image fixe, trois pistes puis une | Dépend des images de ChatGPT |
| P1 | Hors ligne avec dernières données | Moyen |
| Lot suivant | Scénarios de match | Moyen |
| Lot à part | Couverture CAF et Ligue 1 ivoirienne (fournisseur de cotes) | Élevé, à étudier |
| Plus tard | Compositions, direct, joueurs | Élevé |

## 4. Décisions à prendre par Mounir

| N° | Question | Recommandation de Claude |
| --- | --- | --- |
| D1 | Ordre des blocs : avis BETWISE, matchs à suivre, import, paris en cours, tes sources sur les matchs du jour, Coach | Oui |
| D2 | Bankroll en une ligne sur l'accueil, détail dans le Coach ; alertes en bandeau compact | Oui |
| D3 | Expression de l'avatar et indicateur de confiance calculés par une règle (2a) | Oui |
| D4 | Bloc Sources seulement quand une source suivie a un prono du jour (2b) | Oui |
| D5 | Les trois pistes d'avatar dessinées avant de choisir (2d) | Oui |
| D6 | Maquettes : écrans en HTML par Claude, avatar par ChatGPT (2g) | Oui |
| D7 | Matchs renommé Prédictions dans ce lot (2f) | Oui |
| D8 | Scénarios dans le lot suivant ; couverture africaine dans un lot à part, juste après | Oui |
| D9 | Nom du personnage | À toi |

### Décisions de Mounir — 19/11/2026, 11:05

| N° | Réponse de Mounir | Suite |
| --- | --- | --- |
| D1 | « Matchs du jour avec les indicateurs de confiance ; Coach BETWISE comprenant la partie bankroll et coaching perso et chat etc. ; Import et ensuite source… néanmoins donnez-moi vos meilleurs avis » | Ordre retenu ; proposition détaillée de Claude en section 5, à valider |
| D2 | « Pas forcément pour, mais je suis ouvert à tes suggestions » | Bankroll en une ligne non retenue telle quelle ; proposition en section 5 |
| D3 | OK | Expression de l'avatar et indicateur de confiance calculés par une règle |
| D4 | « Je pense qu'il faut changer même le nom de l'onglet et le positionner (Mes pronostiqueurs, Mon réseau ou autre) » | Renommer l'onglet Sources ; proposition en section 5 |
| D5 | OK | Trois pistes d'avatar dessinées avant de choisir |
| D6 | OK | Écrans en HTML par Claude, images de l'avatar par ChatGPT |
| D7 | « Prédictions » (11:09) | Onglet Matchs renommé Prédictions dans ce lot |
| D8 | OK | Scénarios au lot suivant ; couverture africaine dans un lot à part, juste après |
| D9 | « Betster = mélange entre Betwise et tipster (ton avis ?) » | Nom proposé par Mounir ; avis de Claude en section 5 ; vérification de marque à faire |

## 5. Propositions de Claude après les décisions (à valider)

**Accueil, dans l'ordre de D1 :**
1. **Matchs du jour.** En tête, l'avis de Betster : le coup du jour le plus solide, avec l'avatar, sa probabilité, sa cote et son indicateur de confiance. Dessous, les matchs du jour, chacun avec sa barre 1 / N / 2 et son indicateur de confiance. Un match sur lequel l'abonné a un pari en cours porte une pastille « ton pari » et son état en direct : les paris en cours n'ont plus besoin d'un bloc à part.
2. **Coach BETWISE.** Une carte : solde et tendance sur 7 jours, budget de la semaine s'il est fixé, la vigilance du moment s'il y en a une, et « parler au coach ». Un bouton œil masque les montants (utile en public) ; le choix est gardé sur le téléphone.
3. **Import.** Un bouton visible en permanence (dans l'en-tête ou le bouton flottant actuel, renommé « Importer »), plus un rappel dans la page quand un ticket attend.
4. **Pronostiqueurs.** Ce que tes pronostiqueurs suivis disent des matchs du jour, face à l'avis de BETWISE (D4 de la section 4).

**Bankroll (D2) :** pas d'une seule ligne, mais une carte Coach compacte (point 2 ci-dessus). Les points de vigilance passent dans cette carte au lieu d'un bandeau à part.

**Nom de l'onglet Sources (D4) :** dans une barre de cinq onglets, il y a la place pour 9 à 10 caractères. « Mes pronostiqueurs » ne tient pas, « Mon réseau » est flou. Proposition : **« Tipsters »** sur l'onglet, mot que tes utilisateurs emploient déjà, et « Mes pronostiqueurs » en titre de page. Ordre des onglets : Accueil · Prédictions · Mes paris · Tipsters · Coach.

**Betster (D9) :** bon nom. Court, se lit pareil en français et en anglais, on y entend « bet », « tipster » et « best », et il va bien à un personnage qui donne son avis. Deux réserves : une recherche rapide ne montre pas de marque connue de ce nom, mais ce n'est pas une vérification de marque (à faire auprès de l'OAPI pour l'Afrique francophone avant d'en faire un logo) ; et le personnage parle au nom de BETWISE, il ne doit pas passer pour un tipster de plus qu'on note comme les autres.

### Validation des propositions — 19/11/2026, 11:09

Mounir : « D7 = Prédictions ; D1 et D2, D4 = ok ». Les propositions de la section 5 (ordre de l'accueil, carte Coach avec masquage des montants, onglet « Tipsters » et ordre des onglets) sont retenues. Prochaine étape : maquettes HTML du jour chargé, clair et sombre.

## 6. Revue des maquettes par ChatGPT (`03b-revue-maquettes-chatgpt.md`, commit `9f3d99e`) — 19/11, 11:20

Tous les points P0 sont retenus. Ils sont corrigés dans la maquette v2 (`maquettes/canvas/project/`, publiée à 11:23).

| Point P0 | Correction |
| --- | --- |
| « Confiance » laisse croire à une mesure calibrée | Remplacé par **convergence** (écart marché / modèle). **Couverture** (marché et modèle, marché seul, rien) et **fraîcheur** (heure du relevé de la cote) sont affichées à part, sur chaque carte. La pastille « Confiant » de l'avatar est retirée : l'expression reste portée par le visage seul |
| La probabilité d'un autre marché sous la barre 1 / N / 2 prête à confusion | Le marché est toujours nommé au-dessus de la sélection : « Résultat », « Double chance », « Autre marché : total de buts » |
| Règle de choix de l'avis de Betster | Documentée ci-dessous ; la carte dit pourquoi ce choix et précise que ce n'est pas un calcul de valeur |
| Onglets placés au bas du contenu, coupon absent | Les deux premiers cadres montrent l'écran réel (360 × 800) : le contenu défile, la barre « Mon coupon » et les onglets restent fixés en bas. Un troisième cadre montre la page entière |
| Densité de la carte principale | Phrase de synthèse raccourcie, un seul bouton principal « Voir l'analyse », ajout au coupon en bouton secondaire |

Autres points de la revue retenus : état actif des filtres, bloc Tipsters avec le match et le marché exacts, le niveau de preuve (« publié avant le match, heure vérifiée », « heure non vérifiée ») et un bilan avec sa période ; budget affiché seulement s'il est fixé ; masquage des montants gardé sur le téléphone ; aucune donnée fictive ne passe en production.

### Les indicateurs, définis

| Indicateur | Ce qu'il dit | Calcul (provisoire) |
| --- | --- | --- |
| Probabilité | Chance estimée de la sélection | Cotes de référence sans la marge (méthode « puissance »), sinon modèle seul, et c'est dit |
| Convergence | Le marché et le modèle disent-ils la même chose ? | Forte : moins de 3 points d'écart ; moyenne : 3 à 10 ; divergent : plus de 10 ; absente si l'un des deux manque |
| Couverture | Qu'a-t-on pour ce match ? | Marché et modèle, marché seul, modèle seul, rien |
| Fraîcheur | Quand la cote a-t-elle été lue ? | Heure du relevé ; au-delà de 48 h, la cote n'est plus affichée |

Les seuils de convergence reprennent ceux qui servent déjà au classement des coups du jour (bonus sous 3 points, pénalité au-delà de 10). Ce sont des règles provisoires : elles ne disent rien de la fiabilité tant qu'elles ne sont pas mesurées par famille de marchés. La mesure est à faire avant l'intégration (`scripts/mesure-probabilites.ts` sait déjà grouper par tranche).

### La règle de l'avis de Betster

Ce que fait le moteur aujourd'hui (`src/lib/coach/daily.ts`) : chaque matin, sur les matchs des 24 heures qui viennent et seulement là où une cote de référence existe, chaque sélection reçoit un score égal à sa probabilité, plus 3 points si le modèle est d'accord, moins 6 points s'il est nettement en dessous, plus 3 points si une cote est vérifiable, moins 3 points pour un match amical. Les trois meilleures de chaque catégorie (Sûr, Audacieux, Risqué, selon la cote) deviennent les coups du jour.

Proposition : **l'avis de Betster est le premier coup du jour de la catégorie Audacieux** (cote 1,20 à 1,50), parce que c'est la catégorie qui équilibre chance et gain ; à défaut, le premier Sûr. La carte le dit en une phrase. Il n'existe aucun calcul de valeur (probabilité face à la cote) : rien dans l'écran ne doit le laisser entendre. Un tel calcul peut venir plus tard, mesuré, dans un lot à part.

### À trancher par Mounir

| N° | Question | Recommandation |
| --- | --- | --- |
| D10 | L'avis de Betster = premier coup du jour Audacieux, sinon premier Sûr | Oui |
| D11 | « Convergence » à la place de « confiance » dans l'écran | Oui |

### Décisions de Mounir — 19/11/2026, 11:29

« ok avançons » : D10 (avis de Betster = premier coup du jour Audacieux, sinon premier Sûr) et D11 (« convergence » à la place de « confiance ») retenus. Suite : les autres états de l'accueil.

## 7. Mesure de la convergence — 19/11, 14:40

Détail : `05-mesure-convergence.md`. Sur 2 952 matchs, la probabilité du marché est aussi fiable quand le modèle diverge que quand il est d'accord ; en cas de désaccord, c'est le modèle qui se trompe. La convergence ne doit donc pas être présentée comme un signal de fiabilité.

| N° | Question | Recommandation |
| --- | --- | --- |
| D12 | Retirer la convergence de l'accueil ; garder probabilité, couverture et fraîcheur ; l'avis du modèle reste dans la fiche match comme second avis | Oui |
| D13 | Expression de Betster fondée sur la probabilité et la couverture (positive ≥ 60 % avec cote fraîche, prudente sinon, neutre sans donnée) | Oui |

D11 (« convergence » à la place de « confiance ») devient sans objet si D12 est retenu.

### Décisions de Mounir — 19/11/2026, 14:40

« D12 et 13 validé » : la convergence est retirée de l'accueil (probabilité, couverture et fraîcheur restent) ; l'avis du modèle reste dans la fiche match comme second avis ; l'expression de Betster suit la probabilité et la couverture. D11 est sans objet. Maquettes mises à jour le même jour (filtre « 60 % et plus »).
