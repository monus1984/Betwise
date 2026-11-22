# Audit UI/UX de BETWISE — état au 22 novembre 2026

Premier volet de la revue coordonnée demandée en section 21 de `docs/product/orientations-finalisation-prototype-nov-2026.md`. Ce document est factuel : ce que montrent les écrans, mesuré quand c'est mesurable. La revue indépendante de ChatGPT est attendue dans `03-avis-chatgpt.md`, puis un arbitrage commun dans `04-arbitrage.md`.

| | |
| --- | --- |
| Auteur | Claude, modèle `claude-fable-5-2` |
| Version auditée | production, `https://betwise-iota.vercel.app`, branche `main` au commit `de8e3de` |
| Moyens | un robot ouvre l'application avec un compte d'audit et capture chaque écran ; 51 écrans et états en thème clair, les mêmes en sombre, 9 à 320 px |
| Captures | [`captures/README.md`](captures/README.md), 195 images classées par écran |
| Mesures | [`02-mesures.md`](02-mesures.md) |
| Statut | constat et recommandations ; rien n'est corrigé |

## L'essentiel

Quatre problèmes passent avant tout le reste.

1. **Les coups du jour n'arrivent qu'en milieu d'après-midi.** Les tâches planifiées de GitHub partent avec 7 à 10 heures de retard. Le matin, l'accueil affiche « Les coups de demain ».
2. **Le menu des championnats est illisible.** 22 noms coupés sur 26 : « Süpe… », « Liga … », deux lignes « ITALIE Seri… » identiques.
3. **Sur la fiche d'un grand match, on ne peut pas lire sur quoi porte un pourcentage.** « Juven… 89 % », « Juven… 72 % », « Plus d… 81 % ».
4. **Les niveaux de risque ont quatre définitions, et l'écran contredit la règle du 21/11.** Une carte dit « Cote 1xBet 1,29 » et « Niveau Équilibré (cotes 1,30 à 1,54) ». Une autre classe « Prudent » une cote de 1,06.

Viennent ensuite 15 gênes nettes (P1) et une trentaine de finitions (P2).

L'application a aussi de vraies qualités, à ne pas casser : je les liste avant les défauts.

## Comment l'audit a été fait

- **Le compte.** `audit@betwise.invalid`, créé et ouvert par un robot, sans mot de passe. Il contient trois paris test enregistrés le matin même. Rien d'autre : pas de bilan, pas de bankroll, pas de montante.
- **Les captures.** Téléphone de 360 × 780, thème clair puis sombre, page entière. Le robot touche certains éléments pour montrer des états : onglets, filtres, championnat déroulé, aide ouverte. Une passe à 320 × 640 sur neuf écrans denses.
- **Les mesures.** Pour chaque écran : hauteur, temps d'affichage, textes coupés, taille des cibles tactiles, images en erreur, éléments recouverts par Betster flottant, contrastes (contrôle automatique axe), erreurs de console.
- **Le code.** Chaque défaut est rattaché au fichier qui le produit, sur la branche `accueil` au commit `b4ad73b`.

### Ce que cet audit ne couvre pas

- **Les états d'un utilisateur ancien** : bilan rempli, courbe de bankroll, montante en cours, notifications reçues. Le compte d'audit est neuf.
- **Un vrai téléphone.** Les temps viennent d'un serveur aux États-Unis, sur un navigateur de bureau qui imite un mobile. Pas de test sur un Android moyen ni sur le réseau d'Abidjan.
- **Les parcours qui écrivent** : importer une capture, dicter un pari, enregistrer un coupon, parler à Betster. Le robot regarde, il ne remplit rien.
- **Le direct.** Aucun match n'était en cours à 10 h 05.
- **Le lecteur d'écran et le clavier.** Seuls les contrôles automatiques ont tourné.

### Un incident à signaler

Entre 09 h 03 et 09 h 54, deux passages du robot ont déposé sur la branche publique `audit-ecrans` une capture de l'écran « Nouveau pari » où les noms des sources partagées (des pages et des tipsters) étaient lisibles. La branche a été remplacée. Depuis, le robot remplace ces noms par « Source 1 », « Source 2 »… avant chaque capture.

## Ce qui marche et qu'il faut garder

- **Les lignes de match.** Heure, écussons, équipes, pastille de probabilité : tout est aligné, à venir comme terminé. Le vainqueur est en gras, le score à droite. 189 écussons chargés sur l'écran Matchs, aucun en erreur.
- **L'analyse en étapes** de la fiche match : l'enjeu, la forme, le dernier match, le chiffre qui pèse, avec la source et la date du classement.
- **L'honnêteté des textes.** « Une probabilité reste une probabilité : à 75 %, un pari perd encore une fois sur quatre. » « Quand l'écart est aussi grand, c'est le plus souvent le marché qui a raison. » « Le modèle ne tient pas encore compte de ces absences. » C'est rare, et c'est ce qui rend l'application crédible.
- **L'onglet Stats** : forme en lettres et en couleurs, xG, confrontations, absents annoncés.
- **Les états vides de la recherche**, qui proposent quoi essayer.
- **La fraîcheur des cotes**, écrite partout (« relevée il y a 9 h »).
- **Le thème sombre**, cohérent sur presque tous les écrans.
- **La vitesse**, hors accueil : 0,4 à 1,4 s par écran.
- **Aucun écran ne déborde en largeur à 360 px.**

## Le match center, point par point

La section 21 demande de vérifier six choses.

| Point | Constat |
| --- | --- |
| Ordre chronologique | Aujourd'hui : oui. Tops matchs de 11 h 30 à 15 h 15, puis championnats classés par heure du prochain match. Jour passé : non, voir P1-15. |
| Écussons | Présents sur toutes les lignes. Celui de la Juventus, blanc, se voit à peine en thème clair. |
| Alignement équipes et scores | Bon. Une réserve : Betster flottant recouvre le score ou la pastille d'une ligne par écran. |
| Proportions des lignes | Lignes d'environ 55 px. Dans « Tops matchs », le nom de la compétition est répété au-dessus de chaque match, ce qui ajoute une vingtaine de pixels par ligne. |
| Densité | Le premier match apparaît vers 430 px du haut : bandeau d'environ 190 px avec cinq lignes de texte, recherche, jours, filtres. On voit 4 matchs à l'ouverture. |
| Lisibilité mobile | 181 textes de moins de 11 px sur l'écran. 3 noms d'équipe coupés sur les 8 tops matchs (« Brighton & Hove Albi… », « Real Racing Club de … »). Championnats illisibles, voir P0-2. |

## Les problèmes

Pour chacun : le constat, ce qu'il coûte à l'utilisateur, ce que je recommande, l'effort, et où regarder.

Effort : **S** moins d'une heure, **M** une demi-journée, **L** un à deux jours.

### P0 — trompeur ou bloquant sur un écran d'entrée

#### P0-1. Les coups du jour ne sont pas là le matin

- **Écran.** Prédictions, bloc « Les coups du jour ». C'est aussi un problème de fonctionnement.
- **Constat.** Le 22/11 à 09 h 04, le bloc s'intitule « Les coups de demain » et sa première carte porte sur un match du lundi à 20 h. Les coups du jour sont créés par une tâche planifiée à 07 h 30. Elle est partie à 15 h 29 le 21/11, 16 h 17 le 20/11, 16 h 41 le 19/11. Du 11 au 21 novembre, elle est partie chaque jour entre 14 h 23 et 17 h 16. Même retard pour les cotes de référence, prévues à 07 h 00 et arrivées entre 13 h 51 et 16 h 34. Pourtant un coup du jour existait pour Juventus – Venezia de 11 h 30 : il avait été créé la veille à 15 h 36 et rangé au 21/11.
- **Ce que ça coûte.** L'écran d'entrée ne montre pas les choix du jour avant le milieu d'après-midi, quand la moitié des matchs du week-end sont joués. Le matin, les cotes de référence ont 18 heures.
- **Recommandation.** Deux corrections. Déclencher les tâches depuis la base de données, à l'heure, au lieu de compter sur le planificateur de GitHub. Et rattacher un coup au jour de son match, pas au jour où il a été calculé.
- **Effort.** M. Dépend d'un jeton GitHub que Mounir doit créer, et d'une tâche planifiée en base : changement de production à valider.
- **Où regarder.** [`captures/clair/01-predictions-1.jpg`](captures/clair/01-predictions-1.jpg), [`03d-match-sources-1.jpg`](captures/clair/03d-match-sources-1.jpg). Code : `.github/workflows/run-model.yml`, `src/lib/coach/daily.ts`, `src/lib/accueil/load.ts` ligne 166.

#### P0-2. Le menu des championnats est illisible

- **Écran.** Matchs, bloc « Championnats », lignes repliées.
- **Constat.** À 360 px, 22 noms de championnat sur 26 sont coupés : « Süpe… », « Turq… », « Liga … », « Eredi… », « Seri… » deux fois, « Cham… », « Bund… » trois fois, « Supe… » trois fois. Le pays au-dessus est coupé aussi : « PAYS-BA », « ANGLETER », « ALLEMAG ». À 320 px, il reste une lettre. Une fois la ligne dépliée, le nom complet apparaît.
- **Ce que ça coûte.** C'est le menu demandé le 21/11 pour trouver un championnat. On ne peut pas distinguer la Serie A de la Serie B, ni les trois « Bund… ».
- **Recommandation.** Donner toute la largeur au nom. Deuxième ligne en petit : « Italie · 5 matchs · 11 h 30 ». Garder à droite l'étoile et le chevron. Déplacer « Classement » dans la section dépliée.
- **Effort.** S.
- **Où regarder.** [`clair/02-matchs-2.jpg`](captures/clair/02-matchs-2.jpg), [`clair/02-matchs-3.jpg`](captures/clair/02-matchs-3.jpg), [`petit/02-matchs-2.jpg`](captures/petit/02-matchs-2.jpg). Code : `src/app/(app)/matchs/page.tsx` lignes 119 à 130.

#### P0-3. Sur la fiche d'un grand match, le nom de la sélection est coupé

- **Écran.** Fiche match, onglet Analyse, bloc « Les issues les plus probables », quand le modèle couvre le match (les cinq grands championnats).
- **Constat.** Juventus – Venezia : « Juven… 89 % 1xBet 1,09 · modèle 88 % », « Plus d… 81 % », « Juven… 72 % », « Moins … 63 % ». Le nom dispose d'environ 55 px. Sur un match sans modèle, la ligne est plus courte et le nom tient ; c'est alors la pastille « estimation » qui est coupée en « es… ».
- **Ce que ça coûte.** Deux lignes « Juven… » se suivent, l'une à 89 %, l'autre à 72 %. Impossible de savoir laquelle est « Juventus ou nul ». Ce sont les matchs les plus consultés.
- **Recommandation.** Le nom sur sa propre ligne, les chiffres dessous. Le même gabarit que les propositions de l'accueil, qui sont lisibles.
- **Effort.** S.
- **Où regarder.** [`clair/03a-match-analyse-2.jpg`](captures/clair/03a-match-analyse-2.jpg), [`clair/03e-match-termine-1.jpg`](captures/clair/03e-match-termine-1.jpg). Code : `src/app/(app)/matchs/[id]/page.tsx` lignes 156 à 165.

#### P0-4. Quatre définitions des niveaux de risque, et l'écran contredit la règle

- **Écran.** Prédictions, Options du jour, Paris, Sources, Import, fiche match.
- **Constat.**
  - Carte d'un coup : « Cote 1xBet 1,29 » et, deux lignes plus bas, « Niveau Équilibré (cotes 1,30 à 1,54) ».
  - Bloc « Demain », Bodrum – Vanspor : pastille « Prudent » sur une « cote 1xBet 1,06 ». La règle du 21/11 fixe le minimum à 1,10.
  - Détail d'un pari test à 1,41 : « Équilibré » dans l'analyse du ticket, « Prudent » à côté du champ Cote, sur le même écran.
  - Paris et fiches de source : pastilles « Prudent », « Moyen », « Risqué ». Le mot « Moyen » n'existe nulle part ailleurs, et les seuils sont 1,50 et 2,20.
  - Options du jour : « Prudent 83–91 % », « Équilibré 67–83 % », « Audacieux 53–67 % », c'est-à-dire un découpage par probabilité.
- **Ce que ça coûte.** La règle fixée par Mounir n'est appliquée que sur une partie des écrans. Les statistiques par niveau de risque des sources reposent sur l'ancien découpage : elles ne répondent pas à la question « quels marchés passent à quel niveau ».
- **Recommandation.** Une seule fonction, de la cote affichée vers le niveau, appelée partout. Trois mots : Prudent, Équilibré, Audacieux. Pas de niveau sous 1,10. Classer sur la cote que voit le parieur (1xBet quand elle existe), pas sur la cote de référence.
- **Effort.** M. Dépend d'une nouvelle migration pour la fonction en base : changement de production à valider.
- **Où regarder.** [`clair/01-predictions-2.jpg`](captures/clair/01-predictions-2.jpg), [`clair/01-predictions-9.jpg`](captures/clair/01-predictions-9.jpg), [`clair/05d-detail-pari-1.jpg`](captures/clair/05d-detail-pari-1.jpg), [`clair/05d-detail-pari-2.jpg`](captures/clair/05d-detail-pari-2.jpg), [`clair/08e-source-modele-3.jpg`](captures/clair/08e-source-modele-3.jpg), [`clair/07f-options-1.jpg`](captures/clair/07f-options-1.jpg). Code : `src/lib/coach/categories.ts`, `src/app/(app)/options/options-view.tsx` ligne 14, `src/components/ui.tsx` ligne 92, `supabase/migrations/0001_schema.sql` ligne 282, `src/lib/stats/dashboard.ts` ligne 24.

### P1 — gêne nette sur un parcours principal

#### P1-1. Betster flottant recouvre des éléments d'action

- **Écran.** Tous, sauf Importer, Nouveau pari, Réglages et la conversation.
- **Constat.** La bulle fait 58 px, fixée en bas à droite. Sur la fiche d'un match à venir, elle recouvre en permanence le bout du bouton « Parier sur ce match », dans les quatre onglets. Ailleurs, tout ce qui est aligné à droite passe dessous en défilant : 70 éléments tactiles sur Prédictions, 154 sur Matchs, 183 sur Marchés, 126 sur Options. Ce sont les boutons « + », les pastilles de cote, les étoiles, les scores.
- **Ce que ça coûte.** À chaque arrêt du défilement, une action de la colonne de droite est cachée. Le pouce droit tombe sur Betster au lieu du « + ».
- **Recommandation.** Sur la fiche match, retirer la bulle et placer Betster dans l'en-tête, ou remonter la bulle au-dessus de la barre d'action. Ailleurs, la réduire à une pastille de 40 px hors de l'accueil. À arbitrer avec ChatGPT : Betster est un marqueur du produit, il ne s'agit pas de le faire disparaître.
- **Effort.** S à M.
- **Où regarder.** [`clair/03a-match-analyse-1.jpg`](captures/clair/03a-match-analyse-1.jpg), [`sombre/02-matchs-1.jpg`](captures/sombre/02-matchs-1.jpg), [`clair/04-classement-1.jpg`](captures/clair/04-classement-1.jpg). Code : `src/components/betster-fab.tsx`.

#### P1-2. L'aide s'ouvre sous la barre d'onglets

- **Écran.** Tous les écrans à bandeau bleu : Matchs, Mes paris, Importer, Coach, Sources.
- **Constat.** La fenêtre « Comment ça marche ? » s'ouvre, mais la barre d'onglets et Betster restent par-dessus. Les boutons « Écouter » et « Fermer » sont cachés ; il reste la croix en haut. Sur l'accueil, la même fenêtre s'ouvre correctement.
- **Cause.** Le bandeau crée son propre plan d'affichage (`isolation: isolate`), et la fenêtre est dessinée à l'intérieur.
- **Recommandation.** Dessiner la fenêtre hors du bandeau.
- **Effort.** S.
- **Où regarder.** [`clair/02j-matchs-aide-1.jpg`](captures/clair/02j-matchs-aide-1.jpg) contre [`clair/01c-predictions-aide-1.jpg`](captures/clair/01c-predictions-aide-1.jpg). Code : `src/app/globals.css` ligne 142, `src/components/aide.tsx`, `page-header.tsx`.

#### P1-3. Deux chiffres différents pour la même chose, sur le même écran

- **Écran.** Fiche match, onglet Analyse.
- **Constat.**
  - Juventus – Venezia : le bloc « Ce que disent les chiffres » annonce « Juventus FC · cote 1,36 ». Juste dessous, la même sélection est à « 1xBet 1,40 ». Le premier chiffre ne dit pas d'où il vient.
  - Erzurumspor – Göztepe : « Plus de 1,5 buts · cote ≈ 1,31 · estimation », puis « Plus de 1,5 buts · 1xBet 1,30 ».
  - Même match : le bandeau donne 32 %, 28 %, 39 %. La carte « Ce que disent les cotes » donne 33 %, 26 %, 40 %. La note sous la carte dit pourtant que ces trois chiffres « sont repris tels quels ».
- **Ce que ça coûte.** Le doute. Un utilisateur qui voit deux probabilités pour le même nul ne croit plus aucune des deux.
- **Recommandation.** Un seul chiffre par sélection : la cote 1xBet quand elle existe, nommée. La carte doit lire les mêmes probabilités que le bandeau.
- **Effort.** S.
- **Où regarder.** [`clair/03a-match-analyse-2.jpg`](captures/clair/03a-match-analyse-2.jpg) pour la Juventus ; [`clair/03k-match-hors-modele-1.jpg`](captures/clair/03k-match-hors-modele-1.jpg), [`-2`](captures/clair/03k-match-hors-modele-2.jpg) et [`-3`](captures/clair/03k-match-hors-modele-3.jpg) pour Erzurumspor – Göztepe. Code : `src/app/(app)/matchs/[id]/page.tsx` lignes 174 à 181, `src/components/match-recit.tsx`.

#### P1-4. Un pari test peut être déclaré gagné avant le match

- **Écran.** Paris test, et détail d'un pari.
- **Constat.** Trois tests enregistrés à 09 h 04 pour des matchs de 10 h 30 à 16 h 00. Chaque carte affiche aussitôt trois gros boutons, « Gagné », « Perdu », « Remboursé », puis « Saisi en double ? Supprimer ».
- **Ce que ça coûte.** Un toucher par erreur règle un pari qui n'a pas commencé. Ces boutons occupent la moitié de chaque carte. Et la promesse « rien ne se modifie après coup », écrite sur le même écran, n'est pas tenue.
- **Recommandation.** Cacher ces boutons jusqu'à la fin du match. Ensuite, n'en faire qu'un lien secondaire, pour les matchs que l'application ne règle pas seule.
- **Effort.** S.
- **Où regarder.** [`clair/05c-paris-test-1.jpg`](captures/clair/05c-paris-test-1.jpg), [`clair/05c-paris-test-2.jpg`](captures/clair/05c-paris-test-2.jpg). Code : `src/app/(app)/paris/bet-card.tsx`.

#### P1-5. Cinq textes qui disent quelque chose de faux

| Écran | Texte affiché | Ce qui est vrai | Fichier |
| --- | --- | --- | --- |
| Mes paris, vide | « Le bouton + en bas permet d'en ajouter un. » | le « + » est en haut, dans le bandeau | `paris/page.tsx` ligne 55 |
| Matchs, filtre Terminés, à 10 h | « Aucun match ce jour-là. » | la journée compte 86 matchs, aucun n'est encore fini | `matchs/page.tsx` |
| Fiche sans cote, le jour du match | « Elles arrivent chaque matin à partir de J-14. » | on est à J-0, et elles arrivent l'après-midi ; deux cartes de suite répètent le message | `matchs/[id]/page.tsx` ligne 185 |
| Fiche d'un match de Süper Lig ([capture](captures/clair/03k-match-hors-modele-3.jpg)) | « Le modèle ne couvre pas encore ce match (sélections nationales, Ligue des champions). » | c'est un match de championnat turc | `matchs/[id]/page.tsx` ligne 183 |
| Aide de l'écran Matchs | « Les matchs sont rangés par pays », « Analyse statistique indisponible » | ils sont rangés par heure ; l'écran dit « pas encore d'analyse » | `src/lib/aide/contenu.ts` |

Effort : S pour l'ensemble. Captures : [`05a-paris-en-cours-1.jpg`](captures/clair/05a-paris-en-cours-1.jpg), [`02d-matchs-termines-1.jpg`](captures/clair/02d-matchs-termines-1.jpg), [`03i-match-sans-cote-2.jpg`](captures/clair/03i-match-sans-cote-2.jpg), [`02j-matchs-aide-1.jpg`](captures/clair/02j-matchs-aide-1.jpg).

#### P1-6. Des titres et un onglet coupés

- **Constat.** « Tester un ch… » en titre de l'écran Nouveau pari en mode test. « Coups du jour BET… » en titre d'une fiche de source. L'onglet « Sources (… » sur toute fiche match qui a des sources.
- **Cause.** Dans le bandeau, le titre est coupé dès que le bouton de droite est large (« Importer un ticket », « Suivre »).
- **Recommandation.** Laisser le titre passer sur deux lignes, ou placer le bouton sous le titre. Pour l'onglet : « Sources » et une pastille pour le nombre.
- **Effort.** S.
- **Où regarder.** [`clair/06c-nouveau-test-1.jpg`](captures/clair/06c-nouveau-test-1.jpg), [`clair/08f-source-coups-du-jour-1.jpg`](captures/clair/08f-source-coups-du-jour-1.jpg). Code : `src/components/page-header.tsx`.

#### P1-7. Montante : le niveau choisi et la cote demandée se contredisent

- **Constat.** Formulaire par défaut : 1 000 F, objectif 10 000 F, 4 paliers, niveau « Équilibré » (cotes 1,30 à 1,54). Le texte dessous dit : « Il faut une cote d'environ 1,78 à chaque palier. » Rien ne signale l'écart.
- **Ce que ça coûte.** L'utilisateur crée une montante « Équilibré » qui exige en réalité des cotes de niveau Audacieux.
- **Recommandation.** Calculer le nombre de paliers à partir du niveau choisi (ici, 6 à 9 selon la cote), ou afficher l'écart et proposer de corriger.
- **Effort.** S à M.
- **Où regarder.** [`clair/07d-montantes-1.jpg`](captures/clair/07d-montantes-1.jpg). Code : `src/app/(app)/montantes/nouvelle.tsx` lignes 15 à 35.

#### P1-8. Sources : des mots trop forts pour de petits échantillons

- **Constat.**
  - Une source est dite « Confirmé » à partir de 30 pronos réglés.
  - Le classement démarre à 3 résultats. Une source à 6 justes sur 8 est classée 2e, devant une autre à 55 sur 68.
  - L'onglet Analyse annonce une « force » ou une « faiblesse » à partir de 3 résultats.
  - Tableau « Par compétition et par marché » : un rendement est affiché pour un seul prono (« −100 % », « +52 % »). Le tableau voisin, lui, n'affiche rien sous 5 pronos.
- **Ce que ça coûte.** À 30 pronos autour de 1,70, la marge d'erreur du rendement est de ± 30 points. Le classement récompense la chance.
- **Recommandation.** Classer sur la borne basse de l'intervalle de confiance. Relever les seuils : 30 pour être classé, 100 pour « Confirmé ». Un seul seuil d'affichage dans les tableaux.
- **Effort.** M.
- **Où regarder.** [`clair/08c-sources-classement-1.jpg`](captures/clair/08c-sources-classement-1.jpg), [`clair/08f-source-coups-du-jour-2.jpg`](captures/clair/08f-source-coups-du-jour-2.jpg). Code : `src/lib/sources/proof.ts`, `analyse.ts`.

#### P1-9. Des codes internes à l'écran

- **Constat.** Fiche d'une source, colonne « Axe » : OU, DC, BTTS, 1X2, CANQ, UNL, AMI, CH1, GR1, SC1, TR2, mêlés à « Bundesliga » et « Ligue 1 ». Détail d'un pari : « TR2 · dim. 22 nov. ».
- **Recommandation.** Les libellés existent déjà (`markets-fr.ts`, `competitions.ts`) : les utiliser. Séparer marchés et compétitions en deux tableaux.
- **Effort.** S.
- **Où regarder.** [`clair/08f-source-coups-du-jour-2.jpg`](captures/clair/08f-source-coups-du-jour-2.jpg), [`clair/05d-detail-pari-2.jpg`](captures/clair/05d-detail-pari-2.jpg).

#### P1-10. L'accueil est long, et lent par moments

- **Constat.** 9,9 écrans de haut. Chargé 16 fois de suite : 2,7 s en médiane, 4 fois au-dessus de 5 s, 24 s au pire. Les autres écrans s'affichent en 0,4 à 1,4 s. Chaque carte de match du jour occupe à elle seule un écran entier.
- **Ce que ça coûte.** L'écran d'entrée est le plus lent de l'application. Sur un téléphone moyen et un réseau mobile, ce sera pire.
- **Recommandation.** Afficher d'abord Betster et les coups du jour. Charger ensuite les matchs du jour et le bloc Demain. Replier le « pourquoi » de chaque carte. Garder en mémoire une minute les données communes à tous les utilisateurs.
- **Effort.** M à L.
- **Où regarder.** [`02-mesures.md`](02-mesures.md), section « L'accueil chargé 16 fois de suite ». Code : `src/lib/accueil/load.ts`.

#### P1-11. Une erreur intermittente au chargement de l'accueil

- **Constat.** 2 chargements sur 45 ont levé une erreur d'hydratation React (n° 418), suivie de 12 erreurs en cascade. La page s'affiche quand même.
- **Ce que je ne sais pas.** La cause. La version de production ne dit pas quel composant est en faute.
- **Recommandation.** Reproduire avec une version de développement, qui nomme le composant.
- **Effort.** M, pour le diagnostic.

#### P1-12. Thème sombre : trois défauts visibles

| Constat | Où | Cause probable |
| --- | --- | --- |
| Le « ? » du bouton Aide est invisible sur les bandeaux bleus | [`sombre/02-matchs-1.jpg`](captures/sombre/02-matchs-1.jpg) | blanc sur blanc |
| Le nombre de matchs sous le jour sélectionné est illisible (contraste 1,06) | idem | `text-white/70` sur une pastille devenue blanche |
| Les zones de saisie d'Importer et d'Options sont grises, hors palette | [`sombre/06d-importer-1.jpg`](captures/sombre/06d-importer-1.jpg) | couleur par défaut du navigateur |

Effort : S.

#### P1-13. Importer : l'action principale a l'air secondaire

- **Constat.** « Choisir des captures ou une vidéo », l'action principale de l'écran, est un bouton gris. Les deux boutons inactifs, « Lire mon pari » et « Lire le texte », sont verts. Arrivé par « Tester un ticket », l'écran est identique : rien ne dit qu'on est en mode test avant l'étape de vérification.
- **Recommandation.** Bouton principal plein. Un bandeau « Mode test » dès l'arrivée.
- **Effort.** S.
- **Où regarder.** [`clair/06d-importer-1.jpg`](captures/clair/06d-importer-1.jpg), [`clair/06e-importer-test-1.jpg`](captures/clair/06e-importer-test-1.jpg). Code : `src/app/(app)/import/import-flow.tsx`.

#### P1-14. Recherche par probabilité : noms coupés, tri mal nommé

- **Constat.** 6 choix sur 8 ont leur nom coupé : « 2e mi-temps : Une équi… », « Mi-temps : Plus de 0,5 … ». Avec le tri « Par heure », la liste commence par 11:30, 11:30, 10:30, 10:30 : les grands championnats passent d'abord, comme demandé le 21/11, mais le bouton ne le dit pas.
- **Recommandation.** Nom sur deux lignes. Deux sous-titres, « Grands championnats » et « Autres matchs », chacun trié par heure.
- **Effort.** S.
- **Où regarder.** [`clair/01-predictions-2.jpg`](captures/clair/01-predictions-2.jpg). Code : `src/components/recherche-pourcentage.tsx`.

#### P1-15. Matchs d'un jour passé : les grands matchs sont introuvables

- **Constat.** Onglet « Hier », 124 matchs. « Tops matchs » n'en montre qu'un : un match de Ligue 1 ivoirienne affiché « 18:00 », sans résultat, un jour après. La Premier League est 18e du menu, la Bundesliga 19e.
- **Recommandation.** Pour un jour passé : en tops, les résultats des grandes compétitions ; dans le menu, les championnats épinglés, puis les grands, puis le reste. Vérifier pourquoi ce match ivoirien est resté « programmé ».
- **Effort.** S à M.
- **Où regarder.** [`clair/02c-matchs-hier-1.jpg`](captures/clair/02c-matchs-hier-1.jpg), [`clair/02c-matchs-hier-3.jpg`](captures/clair/02c-matchs-hier-3.jpg).

### P2 — finitions

| N° | Écran | Constat | Recommandation |
| --- | --- | --- | --- |
| 1 | Paris, sources, stats | nombres avec un point : « cote 1.41 », « Plus de 2.5 buts », « +0.9 % », « 3.8 » ; ailleurs, une virgule | virgule partout |
| 2 | Plusieurs | la monnaie s'écrit « F », « F CFA » et « FCFA » | une seule écriture |
| 3 | Plusieurs | « Simuler un pari », « Tester un choix », « Paris test », « Test sans mise » pour la même chose | choisir un mot |
| 4 | Sources | « Pronostiqueur » dans les formulaires, « tipster » ailleurs | choisir |
| 5 | Réglages | bouton « Accueil », alors que l'onglet s'appelle « Prédictions » | aligner |
| 6 | Coach | l'onglet « Coach » ouvre un tableau de bord ; la conversation est derrière Betster | à discuter : renommer, ou y mettre la conversation |
| 7 | Stats d'un match | motifs d'absence en anglais : « Knee Injury », « Hamstring Injury » | traduire la douzaine de motifs |
| 8 | Matchs, Sources | cinq lignes de texte dans le bandeau, environ 190 px, un quart de l'écran | une ligne, le reste dans l'aide |
| 9 | Sources | deux boutons côte à côte, « + Source » et « + », qui ne font pas la même chose | un seul, avec un choix |
| 10 | Bankroll, Mes paris | la barre d'onglets est au-dessus du bandeau ; sur Coach et Montantes, au-dessous | une seule place |
| 11 | Fiche source, détail d'un pari, nouvelle source | le bandeau recouvre l'élément placé au-dessus de lui : lien « ‹ Sources », bandeau « Test sans mise » | retirer la marge négative quand un élément précède |
| 12 | Classement | la forme est donnée par des points de couleur seulement ; l'onglet Stats, lui, met des lettres | lettres V, N, D |
| 13 | Options, Marchés | 81 cibles de moins de 24 px sur Options (« Tester », « ⋯ »), 25 sur Marchés | agrandir à 40 px |
| 14 | Matchs, Marchés, Options | 150 à 190 textes de moins de 11 px par écran | 12 px au minimum pour une information utile |
| 15 | Plusieurs | contrastes juste sous le seuil : pastille « Équilibré » 4,45 ; plages d'Options 4,0 ; note de confidentialité du Coach 4,16 | foncer d'un ton |
| 16 | Matchs | un lien et un bouton à l'intérieur de l'en-tête qui déplie un championnat, 26 fois | les sortir de l'en-tête (réglé par P0-2) |
| 17 | Prédictions à 320 px | la page déborde de 21 px | corriger le carrousel |
| 18 | Montantes | le curseur des paliers est dans le bleu du navigateur | couleur de la marque |
| 19 | Adresse inconnue | pas de barre d'onglets ; « ou le pari a été retiré » sur une adresse de match | garder la navigation, texte neutre |
| 20 | Marchés d'un match terminé | sept écrans de cotes grisées, sans dire ce qui est passé | marquer les sélections gagnées, replier le reste |
| 21 | Matchs, clair | l'écusson blanc de la Juventus se voit à peine | fond gris léger sous les écussons |
| 22 | Conversation | la note de confidentialité est coupée par la zone de saisie | marge basse |
| 23 | Fiche « Coups du jour BETWISE » | bouton « + Ajouter le lien de sa page » sur une source du système | le retirer pour ces sources |
| 24 | Nouvelle source | deux champs pour un lien : « Identifiant ou lien », « Lien de la page » | un seul |
| 25 | Matchs, En direct | « Aucun match en direct pour l'instant », sans suite | donner l'heure du prochain coup d'envoi et un lien |
| 26 | Options du jour | la liste s'ouvre sur 60 choix à 90 ou 91 %, surtout des mi-temps et des championnats féminins | grands championnats d'abord, comme sur l'accueil |
| 27 | Fiche source | 10 écrans ; chaque match apparaît deux fois, avec un gros bouton « Jouer ce prono » | regrouper par match, bouton discret |
| 28 | Fiche source | le score disparaît quand les noms sont longs : « Lille OSC – Olympique Lyonnais 0… » | noms courts, score sur sa ligne |
| 29 | Compositions | noms coupés : « T. Alexander-A… », « Álvaro Fernánd… » | deux lignes ou taille réduite |
| 30 | Recherche | pastille coupée : « 2 marqu… » | élargir la pastille pour écrire « 2 marquent » en entier |

## Ordre de traitement proposé

Un lot à la fois, comme convenu.

| Lot | Contenu | Touche la production ? | Effort |
| --- | --- | --- | --- |
| A. Lisibilité | P0-2, P0-3, P1-2, P1-5, P1-6, P1-9, P1-12, P1-13, P1-14, et les P2 n° 1, 2, 7, 11, 16 | non, écrans seulement | une journée |
| B. Horloge et coups du jour | P0-1 | oui : tâche planifiée en base, jeton GitHub | une demi-journée, après accord |
| C. Niveaux de risque | P0-4, P1-7 | oui : une fonction en base | une demi-journée, après accord |
| D. Betster flottant et paris test | P1-1, P1-4 | non | une demi-journée, après arbitrage sur Betster |
| E. Accueil plus court et plus rapide | P1-10, P1-11 | non | un à deux jours |
| F. Sources : seuils et classement | P1-8 | non | une demi-journée |

Je commencerais par A : c'est ce que les testeurs voient en premier, et rien n'y touche aux données. B vient ensuite, parce qu'il conditionne aussi l'expérience des tipsters IA (`docs/design/tipsters-ia/01-avis-claude.md`).

## Ce que j'attends de la revue de ChatGPT

- **Un regard sur ce que je n'ai pas vu.** Je connais le code : je lis les écrans avec ce que je sais qu'ils veulent dire. Un œil neuf verra autre chose.
- **Un avis sur Betster flottant (P1-1).** C'est le seul point où corriger le défaut peut abîmer une intention du produit.
- **Un avis sur la longueur de l'accueil (P1-10).** Que garder au-dessus de la ligne de flottaison ?
- **Les priorités.** J'ai classé P0 ce qui trompe ou empêche de lire. Si ChatGPT classe autrement, je veux le lire.
- **Le parcours d'un nouveau testeur**, de l'inscription au premier pari test. Je l'ai regardé écran par écran, pas comme un parcours.

## Ce qui reste à vérifier

- Les états d'un compte ancien, le direct, et les parcours d'écriture.
- Les temps sur un vrai téléphone, en Côte d'Ivoire.
- La cause de l'erreur intermittente de l'accueil.
- La cause du retard des tâches planifiées de GitHub. Je mesure le retard sur douze jours ; je ne sais pas pourquoi il est si long.
- Le match de Ligue 1 ivoirienne resté « programmé » un jour après : cas isolé, ou défaut du règlement pour ce championnat ?
