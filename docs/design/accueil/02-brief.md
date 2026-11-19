# Brief — nouvel accueil BETWISE

Version 1, 19 novembre 2026. À lire après `01-audit.md`.

## 1. Le problème

Aujourd'hui, quand un abonné ouvre BETWISE, il voit d'abord son solde. Les applications concurrentes ouvrent sur les matchs du jour et ce qu'elles en pensent. Les probabilités de BETWISE existent et sont mesurées, mais elles sont rangées deux écrans plus loin (Matchs, ou Coach pour les coups du jour).

Le nouvel accueil doit répondre en quelques secondes à la question que se pose un parieur le matin : **qu'est-ce qui vaut le coup aujourd'hui, et à quel risque ?**

## 2. La vision

| Principe | Ce que ça veut dire pour l'accueil |
| --- | --- |
| La prédiction IA est le cœur | Le premier écran montre les matchs du jour et l'avis de BETWISE, avant tout chiffre de bankroll |
| Présentation premium | Les matchs, les probabilités et les scénarios sont mis en scène, pas listés ; la lecture doit donner envie d'ouvrir la fiche |
| Vivant, intuitif, mobile-first | Pensé pour un écran de 360 px tenu d'une main ; l'état du jour change au fil des heures (avant, pendant, après les matchs) |
| Le Coach reste un univers à part | Bankroll, budget, montantes et conversation vivent dans le Coach. L'accueil peut y renvoyer, il ne le remplace pas |
| L'import est facile d'accès | Scanner un ticket reste à un geste, visible, sans chercher |
| Un avatar IA | Un personnage qui incarne l'avis de BETWISE, envisagé dès maintenant dans la direction artistique (dessin à l'étape 3, animation à l'étape 6) |

## 3. Pour qui

- Parieurs d'Afrique de l'Ouest francophone, d'abord en Côte d'Ivoire, qui jouent surtout chez Betclic et 1xBet.
- Ils suivent les grands championnats européens, la CAN et ses éliminatoires, et les compétitions africaines.
- Ils jouent beaucoup de combinés à petites cotes, suivent des tipsters sur Telegram, WhatsApp et Facebook, et partagent des captures de tickets.
- Téléphone Android de milieu de gamme, données mobiles parfois chères ou lentes.
- Test fermé aujourd'hui à 3 comptes, 20 testeurs visés.

**À compléter par Mounir :** deux ou trois profils réels de testeurs (âge, habitudes, ce qu'ils attendent), sans nom.

## 4. Ce que l'écran doit faire

Hypothèses de contenu, dans un ordre à discuter. Elles servent de point de départ, pas de maquette.

1. **L'avis du jour.** Une phrase et un ou deux coups mis en avant, portés par l'avatar : la sélection, sa probabilité, sa cote, son risque. Sur un jour sans match couvert, l'écran le dit et propose quand même quelque chose (prochains matchs, meilleure probabilité des jours suivants, un ticket à importer).
2. **Les matchs du jour.** Pour chacun : les deux équipes, l'heure ou le score en direct, la barre 1 / N / 2, l'issue la plus probable. Un match sans probabilité (CAF, Ligue 1 ivoirienne) est montré honnêtement, sans fausse précision.
3. **Les scénarios.** Pour les matchs phares, deux ou trois façons dont le match peut tourner (par exemple « match fermé », « favori qui déroule ») avec leurs probabilités. À valider : ce n'est pas encore produit par le moteur (voir section 8).
4. **Mes paris en jeu.** Un rappel compact des paris en cours et de leur état en direct, sans montant si l'abonné ne le souhaite pas.
5. **Scanner un ticket.** Action toujours visible.
6. **Passerelles.** Vers le Coach (bankroll, budget, conversation) et vers les sources, en un geste, sans reprendre leur contenu.

La bankroll ne disparaît pas : elle passe dans le Coach, ou dans un résumé d'une ligne. Les alertes de vigilance (budget atteint, série de pertes) doivent rester visibles quelque part sans dominer l'écran.

## 5. Les états de l'écran

Les maquettes doivent couvrir au moins :

| État | Situation |
| --- | --- |
| Matin, jour chargé | 15 matchs couverts, coups du jour publiés |
| Soirée, matchs en direct | Scores qui bougent, paris en cours qui gagnent ou perdent |
| Lendemain | Bilan : ce que BETWISE avait annoncé et ce qui est arrivé |
| Jour creux | Aucun match couvert dans les 48 heures |
| Compétition non couverte | Match de Ligue 1 ivoirienne sans probabilité |
| Nouvel abonné | Aucun pari, aucune source suivie |
| Hors ligne | Réseau coupé |

## 6. Direction artistique

Ce qu'on garde :

- Couleurs par rôle, thèmes clair et sombre, jamais de couleur seule pour porter un sens.
- Le vert d'action et le bleu nuit « terrain » comme base, à faire évoluer si une proposition le justifie.
- Barlow Condensed pour les scores, Inter pour le texte, ou une alternative argumentée.
- Écussons à initiales : pas de logos de clubs ni de compétitions, pas de photos de joueurs.

Ce qu'on vise :

- Dépasser visuellement les quatre applications benchmarkées (BetAnalyz et les autres de la feuille de route), sans copier leur look de casino.
- Un rendu premium : hiérarchie nette, chiffres lisibles d'un coup d'œil, mouvement utile (un score qui change, une probabilité qui se remplit) plutôt que décoratif.
- Une identité qu'on reconnaît sans le logo.

L'avatar :

- Un personnage original, avec un visage humain en miniature (demande de Mounir), qui apparaît quand l'IA parle : avis du jour, analyse d'un match, Coach.
- Il doit rester lisible en petit (40 à 64 px) et avoir quelques expressions (confiant, prudent, content, déçu).
- Pas de ressemblance avec une personne réelle, un joueur connu ou un personnage existant.
- À l'étape 3 : deux ou trois pistes dessinées, en image fixe. L'animation vient à l'étape 6.
- La voix existe déjà (Gemini), mais elle est plafonnée à 10 lectures par jour tant que la facturation n'est pas activée. Un avatar qui parle à chaque ouverture épuiserait ce plafond.

**À compléter par Mounir :** le nom du personnage, s'il en a un en tête, et les références visuelles qu'il aime (applications, marques, illustrateurs).

## 7. Contraintes techniques

| Contrainte | Conséquence pour la conception |
| --- | --- |
| Next.js 15, rendu côté serveur, Tailwind, aucune bibliothèque d'interface | Tout composant se construit à la main ; éviter les effets qui demandent une grosse librairie |
| Application installable (PWA), réseau ivoirien | Écran léger, images rares et petites, pas de vidéo en fond ; l'accueil doit s'afficher même lent |
| Thèmes clair et sombre obligatoires | Chaque maquette en deux versions, ou au moins une preuve que les deux tiennent |
| Données en direct par rafraîchissement, pas en flux continu | Un score se met à jour toutes les minutes environ, pas à la seconde |
| Voix plafonnée | La lecture à voix haute reste un geste volontaire |
| Le modèle de langage ne reçoit ni identité ni montant | L'avatar ne peut pas dire « tu as perdu 5 000 F » ; il parle en unités ou en pourcentages |
| Notifications sans montant | Idem pour tout ce qui sort de l'application |
| Accessibilité | Contraste suffisant, cibles tactiles de 44 px, jamais la couleur seule |

## 8. Données manquantes

Ce que l'accueil ne pourra pas montrer sans travail en amont.

| Donnée | Situation | Effort |
| --- | --- | --- |
| Probabilités CAF et Ligue 1 ivoirienne | Ni modèle ni cotes | Élevé : trouver une source de cotes, ou un modèle sans historique suffisant |
| Scénarios de match | Le moteur calcule les scores probables, pas des scénarios nommés | Moyen : à construire à partir de la grille des scores |
| Compositions, blessés | À la demande seulement | Faible à moyen : relevé systématique avant les matchs suivis, coût en requêtes à mesurer |
| Probabilités en direct | Absentes | Élevé |
| Probabilités pour un joueur | Absentes | Moyen à élevé |
| Cotes Betclic Côte d'Ivoire | Absentes des flux | Hors de portée sans accord ; seulement via les tickets |
| Actualité | Aucune source | Hors périmètre pour l'instant |
| Bilan du lendemain | Les données existent, l'écran non | Faible |

## 9. Ce qu'on ne fait pas

- Pas de leçon de morale ni de « ne parie pas » ; BETWISE avertit, donne les probabilités et le risque, et propose toujours.
- Pas de faux chiffres : une estimation est marquée comme telle, un match sans donnée est montré sans probabilité.
- Pas de surveillance des sources : un prono entré après le match n'est pas traqué.
- Pas de suppression rétroactive des paris ou des pronos.

## 10. Questions pour le second regard

1. L'ordre de la section 4 est-il le bon pour un parieur ivoirien qui ouvre l'application le matin ? Qu'est-ce qui doit tenir sur le premier écran, sans faire défiler ?
2. Comment montrer un match sans probabilité sans donner l'impression d'une application incomplète ?
3. Où mettre la bankroll et les alertes pour qu'elles restent présentes sans voler la place de la prédiction ?
4. L'avatar : quelle place, quelle taille, quand apparaît-il, et comment éviter qu'il devienne un gadget ?
5. Les scénarios valent-ils l'effort de développement, ou une barre 1 / N / 2 et l'issue la plus probable suffisent-elles au début ?
6. Quels éléments des concurrents faut-il dépasser en priorité, et lesquels éviter ?
7. Faut-il un accueil qui change selon le moment de la journée (avant, pendant, après les matchs), ou un écran stable ?

## 11. Ce qu'on attend des maquettes

- Écran de 360 × 800 px, thème sombre et thème clair.
- Les sept états de la section 5, au moins en fil de fer pour les moins importants.
- Deux ou trois pistes pour l'avatar.
- Des données fictives mais plausibles : de vrais noms d'équipes, des probabilités qui somment à 100 %, des cotes cohérentes avec les probabilités.
- Pour chaque choix fort, une phrase qui dit pourquoi.

## 12. Comment on jugera

| Critère | Question |
| --- | --- |
| Utilité | En dix secondes, sait-on quoi jouer aujourd'hui et à quel risque ? |
| Honnêteté | Ce qui est affiché existe-t-il vraiment dans le moteur, et l'incertitude est-elle visible ? |
| Différence | Reconnaît-on BETWISE sans le logo ? Fait-il mieux que les concurrents benchmarkés ? |
| Faisabilité | Se construit-il avec les données et les composants existants, ou que faut-il ajouter, et à quel coût ? |
| Mobile | Tient-il d'une main, sur un réseau lent, en clair comme en sombre ? |
