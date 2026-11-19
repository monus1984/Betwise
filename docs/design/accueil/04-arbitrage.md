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

### Décisions de Mounir

_À remplir après sa réponse, datées et dans ses mots._
