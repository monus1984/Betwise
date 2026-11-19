# 03b — Revue ChatGPT des premières maquettes de l'accueil

**Date : 19 novembre 2026**  
**Référence : branche `design-accueil`, maquettes jour chargé v1**  
**Fichiers examinés :** `04-arbitrage.md`, `maquettes/README.md`, `maquettes/canvas/project/Main.dc.html`, `maquettes/canvas/project/Clair.dc.html`.

## 1. Avis général

La direction est bonne et cohérente avec le repositionnement de BETWISE. Je valide l'architecture générale : avis de Betster et matchs du jour en tête, Coach ensuite, import accessible, puis les Tipsters. La déclinaison claire/sombre est prévue et les fondations graphiques existantes sont conservées.

La maquette est toutefois une première proposition de composition, pas encore une spécification prête à coder. Quelques points de hiérarchie, de sémantique statistique et de comportement mobile doivent être clarifiés.

## 2. Ce qui fonctionne et doit être conservé

- L'avis de Betster ouvre l'écran et donne une identité au produit.
- La sélection mise en avant présente une probabilité, une cote, un risque et un accès à l'analyse.
- Les matchs du jour arrivent immédiatement après.
- Les matchs sans couverture restent visibles et n'affichent pas de faux pourcentage.
- Le Coach rassemble bankroll, budget, vigilance et conversation sans dominer l'accueil.
- L'import est repérable depuis l'en-tête et depuis un bloc dédié.
- Le bloc Tipsters compare les pronostics suivis avec l'avis de BETWISE, ce qui est plus utile qu'une liste de profils et de notes.
- La navigation à cinq onglets est cohérente : Accueil, Prédictions, Mes paris, Tipsters, Coach.
- La palette bleu nuit / vert, Inter et Barlow Condensed constitue une base reconnaissable.

## 3. Ajustements prioritaires avant développement

### P0 — Clarifier les indicateurs statistiques

La maquette emploie « Confiant », « Confiance forte » et « Le marché et le modèle sont d'accord à 2 points près ». Ces formulations risquent de faire croire à une mesure de confiance statistique calibrée.

Il faut distinguer visuellement quatre notions :
- **Probabilité :** chance estimée de l'événement sélectionné.
- **Convergence :** proximité entre l'estimation du marché et celle du modèle.
- **Fraîcheur :** ancienneté des cotes et des données.
- **Couverture :** disponibilité effective d'une estimation du marché et/ou du modèle.

Une forte convergence ne prouve pas à elle seule que la probabilité est bien calibrée. Une probabilité élevée ne signifie pas automatiquement une bonne valeur de pari.

Recommandation : remplacer, dans les premiers essais, « Confiance forte » par « Forte convergence » lorsque le signal affiché est uniquement l'écart marché/modèle. Garder un indicateur de fraîcheur distinct. Si BETWISE souhaite conserver un score global de confiance, sa définition et ses seuils doivent être validés sur des données historiques, par famille de marchés, avant de le présenter comme une mesure de fiabilité.

Les seuils proposés dans l'arbitrage (60 %, 5 points, 48 heures) sont des règles provisoires. Ne pas les traiter comme scientifiquement validés sans mesure.

### P0 — Éviter la confusion entre marchés sur les cartes Matchs

Dans la maquette, certaines cartes affichent une barre 1 / N / 2 puis une sélection d'un autre marché. Exemple : Inter – Lazio affiche les probabilités 1 / N / 2, puis « Plus de 2,5 buts · 58 % ».

Un utilisateur peut croire que 58 % correspond à l'une des trois issues 1 / N / 2.

Recommandation :
- soit la ligne de sélection reprend l'issue 1 / N / 2 la plus probable ;
- soit la sélection affiche explicitement son marché, par exemple « Total buts · Plus de 2,5 · 58 % » avec une séparation graphique claire.

Ne jamais mélanger la probabilité d'un marché et la barre 1 / N / 2 sans libellé explicite.

### P0 — Distinguer « probabilité la plus élevée » et « meilleur choix »

La carte principale présente « le coup du jour le plus solide » et « Je prends la victoire d'Arsenal ». Il faut s'assurer que la sélection est réellement choisie selon une règle documentée. La plus forte probabilité brute n'est pas nécessairement le meilleur rapport entre probabilité et cote.

Recommandation : définir la logique de sélection de Betster. Afficher si la sélection est mise en avant pour sa probabilité, sa convergence, la qualité des données ou un avantage estimé par rapport à la cote. Ne pas laisser entendre qu'une sélection a une valeur positive si ce calcul n'existe pas.

### P0 — Vérifier la navigation mobile et le coupon

Dans le HTML, la barre d'onglets est positionnée en absolu au bas d'un conteneur de 1 720 px. Pour l'application réelle, elle doit rester accessible au bas de la fenêtre pendant le défilement, pas au bas du contenu.

L'audit mentionne aussi une barre de coupon au-dessus des onglets. Elle n'apparaît pas dans la maquette. Il faut montrer comment elle cohabite avec la navigation lorsque l'utilisateur a des sélections dans son coupon.

Recommandation : maquetter la barre de navigation fixe et l'état « coupon actif » avant intégration.

## 4. Ajustements UX et composition

### Avis de Betster

La carte est forte visuellement, mais elle cumule beaucoup d'éléments : avatar, texte narratif, jauge circulaire, sélection, cote, confiance, explication du risque et deux boutons.

Je recommande de hiérarchiser :
1. Avatar + courte phrase de synthèse.
2. Match et sélection.
3. Probabilité, cote et signal de convergence.
4. Une phrase de risque.
5. Un seul CTA principal « Voir l'analyse » ; « Ajouter au coupon » peut être secondaire.

Le texte narratif doit être généré uniquement à partir de faits présents et vérifiés. Les données d'exemple sont fictives, ce qui est acceptable pour la maquette, mais elles ne doivent pas devenir des affirmations sans source en production.

### Matchs du jour

- Les filtres « Tous », « Confiance forte », « Mes paris », « Afrique » sont utiles, mais la maquette doit montrer leur état actif et leur comportement.
- Garder les cartes compactes et réserver les détails à la fiche match.
- Distinguer les rencontres couvertes par le marché, par le modèle, par les deux, ou par aucun des deux.
- Pour les matchs non couverts, garder la présentation honnête proposée. Le texte explicatif peut être plus court sur la carte, avec le détail à l'ouverture.

### Coach

La carte est bien placée. Le masquage des montants est une bonne idée.

À préciser :
- le masquage doit s'appliquer à tous les montants et être mémorisé localement ;
- le budget ne doit apparaître que s'il est configuré ;
- les points de vigilance doivent être fondés sur des règles réelles et ne pas être systématiquement affichés ;
- la courbe et les valeurs doivent être liées aux vraies données, et non rester décoratives.

### Import

Le raccourci d'en-tête et le bloc dédié peuvent coexister : le premier pour l'accès immédiat, le second pour expliquer les formats acceptés. Il faut cependant éviter de donner l'impression de deux fonctions différentes.

### Tipsters

C'est un bloc différenciant. Il faut afficher la confrontation au niveau du match et du marché exact, pas seulement « d'accord / pas d'accord ».

Prévoir une distinction entre :
- prono pré-match vérifié ;
- date de publication non vérifiée ;
- prono importé après le match ;
- source sans prono sur les matchs du jour.

Ne pas présenter un historique de réussite sans volume, période et niveau de preuve.

## 5. Avatar et nom Betster

Je valide l'exploration des trois pistes visuelles avant de choisir. Betster fonctionne comme nom de personnage : il est mémorisable et fait le lien avec BETWISE et tipster. Il ne doit toutefois pas être présenté comme un pronostiqueur indépendant ou une source externe. Il incarne l'assistant et l'analyse BETWISE.

L'avatar doit avoir une vraie identité graphique à petite taille, mais rester secondaire par rapport à l'information. Les expressions doivent suivre des règles explicites, ne pas exprimer une certitude et être désactivables.

## 6. Données et démonstration

Les exemples de la maquette sont fictifs, ce qui est annoncé dans le README. C'est adapté à la conception.

Avant intégration :
- remplacer chaque donnée fictive par une donnée réellement disponible ou un état vide explicite ;
- vérifier la cohérence entre probabilités, marché, cote, heure de relevé et texte ;
- ne pas inventer de forme récente, blessure ou fait de match ;
- ne pas afficher une cote sans bookmaker et heure de relevé ;
- gérer les données manquantes sans casser la composition.

Les boutons et filtres de la maquette doivent être considérés comme des éléments de présentation tant que leur interaction n'est pas implémentée et testée.

## 7. États encore nécessaires

La maquette actuelle couvre seulement le jour chargé, en clair et en sombre. Les autres états du brief restent à produire :
- soirée en direct ;
- lendemain / bilan ;
- jour creux ;
- match non couvert ;
- nouvel abonné ;
- hors ligne.

Le mode hors ligne doit être classé après le premier écran fonctionnel : l'arbitrage a raison de noter qu'il demande une stratégie de cache et ne se limite pas à un bandeau.

## 8. Décision recommandée

**Je valide la structure générale et la direction artistique comme base de travail. Je recommande de ne pas commencer l'intégration avant les corrections P0 suivantes :**

1. Clarifier probabilité, convergence, fraîcheur et couverture.
2. Éviter la confusion entre les marchés 1 / N / 2 et les autres marchés.
3. Documenter la règle qui choisit l'avis principal de Betster.
4. Corriger la navigation fixe et représenter la barre de coupon active.
5. Vérifier la densité de la carte principale sur un écran de 360 × 800 px.

Ensuite, Claude peut finaliser la maquette jour chargé, produire les trois pistes d'avatar avec ChatGPT, puis décliner les autres états avant le développement.

**Périmètre de cette revue :** lecture des documents et du code source HTML des maquettes sur la branche `design-accueil`. Je n'ai pas exécuté l'application ni testé les interactions dans le navigateur. Aucune modification de code applicatif, de `main`, de Supabase ou de Vercel n'a été effectuée.
