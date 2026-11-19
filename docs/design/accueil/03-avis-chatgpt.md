# 03 — Avis ChatGPT : conception du nouvel accueil BETWISE

**Date : 19 novembre 2026**  
**Périmètre : direction produit, UX, hiérarchie de l'information et faisabilité**  
**Base de travail : 01-audit.md et 02-brief.md**

---

## 1. Diagnostic et orientation générale

Je valide le changement de philosophie proposé.

L'accueil actuel est construit autour du suivi financier de l'utilisateur. Or, la promesse centrale de BETWISE est désormais l'intelligence sportive : comprendre les matchs, évaluer les probabilités, confronter les analyses et aider à prendre une décision.

Il faut donc inverser la hiérarchie :

- **Accueil :** ce que BETWISE observe et analyse aujourd'hui.
- **Prédictions :** l'exploration approfondie des matchs et des marchés.
- **Coach :** le pilotage personnel, la bankroll, les budgets, les stratégies et l'assistant.
- **Sources :** les pronostics externes, leur suivi et leur fiabilité.
- **Mes paris :** le suivi des tickets et des résultats.

L'accueil ne doit pas devenir une version miniature de tous les autres onglets. Il doit être une véritable vitrine de l'intelligence BETWISE.

**Décision : la prédiction doit être le premier contenu visible, avant la bankroll et les statistiques personnelles.**

## 2. Réponses aux sept questions du brief

### Question 1 — Quel ordre et que montrer sans défiler ?

Je recommande l'ordre suivant :

1. En-tête compact : logo, date, notifications et profil.
2. Avis BETWISE : une analyse ou une sélection mise en avant.
3. Matchs à suivre : quelques rencontres pertinentes avec leurs probabilités.
4. Accès rapide à l'import d'un ticket.
5. Résumé discret des paris en cours.
6. Passerelles vers le Coach et les Sources.

Sur un écran de 360 × 800 px, le premier écran doit donner trois informations :
- Quelle est l'analyse principale de BETWISE aujourd'hui ?
- Quelle est la probabilité associée ?
- Quel est le niveau de risque ou d'incertitude ?

Je privilégierais une sélection principale accompagnée d'un accès à deux ou trois autres analyses, plutôt qu'une accumulation de cartes.

La bankroll ne doit plus occuper la première grande carte.

### Question 2 — Comment présenter un match sans probabilité ?

C'est particulièrement important pour les compétitions africaines et ivoiriennes.

Il ne faut surtout pas masquer ces matchs. Cela donnerait l'impression que BETWISE ignore le football local.

**Match couvert :**
- Probabilités disponibles.
- Cote de référence, si disponible.
- Avis du modèle.
- Indication de fraîcheur des données.

**Match non couvert :**
- Match et compétition.
- Date et heure.
- Mention « Analyse statistique indisponible ».
- Accès aux informations disponibles sur la rencontre.

On peut ajouter une explication discrète : « BETWISE ne dispose pas encore de données suffisantes pour calculer une probabilité fiable. »

Ne pas afficher de pourcentage, de cote estimée ou de verdict artificiel.

Il faut néanmoins faire de la couverture africaine une priorité produit. L'absence de données ne doit pas devenir une caractéristique permanente de l'expérience ivoirienne.

### Question 3 — Où placer la bankroll et les alertes ?

La bankroll doit vivre principalement dans le Coach.

Sur l'accueil, je recommande un résumé très compact, éventuellement une ligne :

« Mon suivi : 3 paris en cours · Voir mon Coach »

Les alertes importantes peuvent apparaître sous forme de notifications discrètes. Elles ne doivent pas concurrencer l'analyse sportive.

Une alerte de budget ou de série de pertes doit rester accessible, mais ne pas transformer l'accueil en tableau de contrôle financier.

### Question 4 — L'avatar : quelle place et quel rôle ?

Je suis favorable à l'avatar. Il peut devenir un élément fort de l'identité BETWISE.

Mais il ne doit pas être un simple personnage décoratif posé sur les cartes.

Je lui attribue trois fonctions :
- Incarnation de l'avis de BETWISE.
- Présentation des analyses importantes.
- Interface conversationnelle avec le Coach.

**Proposition de placement :**

L'avatar apparaît principalement dans la carte « L'avis BETWISE ». Taille recommandée : 48 à 56 px sur mobile. Il peut être accompagné d'une courte phrase et d'une expression adaptée à la situation.

Expressions possibles :
- Confiant : données relativement convergentes.
- Prudent : probabilité intéressante mais incertitude élevée.
- Neutre : données insuffisantes ou contradictoires.
- Satisfait : bilan positif après règlement.
- Déçu : résultat différent de l'analyse.

Une expression confiante ne doit jamais être confondue avec une garantie de résultat.

Je recommande un personnage original, semi-réaliste, stylisé, avec une identité technologique et sportive. Pas un robot générique, pas une mascotte enfantine et pas un visage photoréaliste.

L'avatar doit rester facultatif et ne pas imposer une lecture vocale à chaque ouverture.

Le nom du personnage reste à arbitrer avec Mounir.

### Question 5 — Les scénarios de match valent-ils le développement ?

Oui, mais pas en première priorité.

La barre 1 / N / 2 donne une information statistique. Les scénarios apportent une lecture plus humaine et plus accessible du match.

Exemples :
- Match fermé.
- Domination du favori.
- Rencontre équilibrée.
- Match susceptible de s'ouvrir en seconde période.

Cependant, les scénarios doivent être dérivés de données et de règles explicites. Il ne faut pas demander à un modèle de langage d'inventer des scénarios et de leur attribuer des probabilités.

Je recommande deux étapes :

**Étape 1 :** conserver les probabilités 1 / N / 2, l'issue la plus probable et les informations déjà produites par le moteur.

**Étape 2 :** construire les scénarios à partir de la distribution des scores probables, puis vérifier leur cohérence statistique.

Un scénario nommé ne doit recevoir une probabilité que si sa définition et son calcul sont établis.

### Question 6 — Que dépasser chez les concurrents ?

Je ne chercherais pas à reproduire leurs écrans ou leur densité d'informations.

BETWISE doit se différencier sur cinq points :
1. **Lisibilité :** comprendre rapidement l'analyse sans lire un tableau complexe.
2. **Transparence :** distinguer les probabilités du marché, celles du modèle et les informations indisponibles.
3. **Comparaison :** confronter BETWISE, les bookmakers et les sources suivies.
4. **Personnalisation :** intégrer progressivement les habitudes et les performances de l'utilisateur.
5. **Expérience :** une interface vivante, élégante, rapide et agréable à consulter.

Je veux éviter l'esthétique casino : trop de couleurs criardes, trop de badges, des animations permanentes, des promesses de gains et des chiffres partout.

Le produit doit donner une impression d'intelligence, pas d'excitation artificielle.

### Question 7 — L'accueil doit-il changer selon le moment de la journée ?

Oui. Je recommande un accueil adaptatif, avec une structure stable.

Il ne faut pas construire trois applications différentes selon l'heure. Les blocs principaux restent identiques, mais leur contenu évolue.

- **Avant les matchs :** analyses du jour, probabilités et sélections.
- **Pendant les matchs :** scores en direct, rencontres suivies et état des paris.
- **Après les matchs :** résultats et bilan des analyses précédentes.
- **Jour creux :** prochains matchs intéressants, couverture à venir, import de tickets et analyses disponibles.

Le jour creux ne doit jamais donner l'impression que BETWISE est vide.

---

## 3. Proposition de structure du nouvel accueil

### A. En-tête
- Logo BETWISE.
- Date et jour.
- Notifications.
- Accès au profil.

### B. Carte principale — L'avis BETWISE

C'est le bloc identitaire de l'accueil.

Contenu :
- Avatar.
- Phrase de synthèse.
- Match concerné.
- Sélection principale.
- Probabilité calculée.
- Cote disponible.
- Indicateur de risque.
- Bouton « Voir l'analyse ».

Cette carte doit être suffisamment forte visuellement pour être immédiatement identifiable.

### C. Les matchs à suivre

Présenter trois à cinq rencontres au maximum dans le premier aperçu.

Chaque carte peut contenir :
- Écussons à initiales.
- Noms des équipes.
- Compétition et heure.
- Probabilités 1 / N / 2.
- Issue la plus probable.
- Indication de couverture.

Un accès « Voir tous les matchs » ouvre l'univers Prédictions.

### D. Import rapide

Un bouton bien visible : « Importer un ticket ».

Il doit rester accessible à un geste, sans prendre toute la place de l'accueil.

### E. Mes paris en cours

Un résumé compact, avec les scores et l'état des rencontres.

Les montants restent masqués ou affichés selon le choix de l'utilisateur.

### F. Mon Coach

Une petite passerelle vers :
- Bankroll.
- Budget.
- Stratégies.
- Performances.

### G. Mes sources

Un aperçu des sources suivies et de leur activité, sans transformer l'accueil en classement de tipsters.

---

## 4. Les sept états à concevoir

Les sept états doivent répondre à des besoins différents, pas être de simples variantes de couleur.

| État | Contenu prioritaire |
|---|---|
| Jour chargé | Avis BETWISE, sélection principale, matchs à suivre |
| Soirée en direct | Scores, matchs suivis, état des paris |
| Lendemain | Bilan des analyses et résultats constatés |
| Jour creux | Prochains matchs, couverture à venir, import |
| Compétition non couverte | Match visible, absence de probabilité clairement expliquée |
| Nouvel abonné | Découverte des fonctionnalités, première analyse, premier import |
| Hors ligne | Dernières données consultées avec heure de mise à jour et indication qu'elles ne sont plus actualisées |

Pour le nouvel abonné, je recommande un accueil de découverte qui donne immédiatement accès à des analyses disponibles, même sans bankroll ni source enregistrée.

Pour le mode hors ligne, il faut éviter toute confusion entre une donnée historique et une information en direct.

---

## 5. Direction artistique proposée

Je recommande de conserver les fondations actuelles tout en renforçant leur personnalité.

**Palette :**
- Bleu nuit profond : univers sportif et technologique.
- Vert émeraude : action et identité BETWISE.
- Surfaces sombres et claires avec contraste maîtrisé.
- Couleurs de résultat utilisées avec un libellé explicite.

**Typographie :**
- Inter pour la lecture et les informations.
- Barlow Condensed pour les scores, résultats et chiffres sportifs importants.

**Composants :**
- Cartes avec hiérarchie claire.
- Probabilités représentées graphiquement.
- Indicateurs de risque lisibles.
- Écussons à initiales.
- Animations courtes, uniquement lorsqu'elles apportent une information.

Deux règles importantes :
1. Les probabilités doivent être visibles sans être confondues avec les cotes.
2. Le niveau de confiance et la disponibilité des données doivent être distincts de la probabilité de résultat.

Une probabilité de 65 % n'est pas automatiquement une recommandation à faible risque.

---

## 6. Avatar : premières pistes de conception

Je propose trois directions à explorer en image fixe.

**Piste A — L'analyste**  
Un visage humain stylisé, sobre, regard direct, expression intelligente. Tenue sportive-tech discrète. Il incarne l'expertise et la maîtrise des données.

**Piste B — Le stratège**  
Un personnage plus affirmé, avec une silhouette et un visage reconnaissables. Il incarne l'analyse, l'anticipation et la prise de décision.

**Piste C — Le compagnon**  
Un visage humain miniature plus accessible, avec plusieurs expressions. Il accompagne l'utilisateur dans ses analyses et son suivi.

Mon choix initial serait la piste A ou B. Je souhaite éviter une mascotte trop ludique qui ferait perdre à BETWISE sa crédibilité.

Le nom du personnage et les références visuelles personnelles restent à confirmer par Mounir.

---

## 7. Profils de testeurs à représenter

Les documents ne donnent pas encore les profils individuels des trois testeurs. Je ne les présenterais donc pas comme des personnes réelles déjà identifiées.

Pour la conception, je recommande de couvrir ces trois archétypes à valider avec Mounir :

**Profil 1 — Le parieur régulier**
- Suit quotidiennement les grands championnats.
- Consulte les probabilités et les cotes.
- Utilise principalement 1xBet ou Betclic.
- Attend une lecture rapide des matchs et une aide à la décision.

**Profil 2 — Le parieur communautaire**
- Suit des pronostiqueurs sur WhatsApp, Telegram ou Facebook.
- Reçoit et partage des captures de tickets.
- Utilise fréquemment les combinés.
- Attend un outil capable d'importer, comparer et évaluer les pronostics.

**Profil 3 — Le parieur gestionnaire**
- Suit ses mises, ses résultats et son budget.
- Veut comprendre sa rentabilité dans le temps.
- Utilise plusieurs bookmakers.
- Attend un Coach et un suivi personnel simples.

Ces profils sont des hypothèses de conception, pas des données d'entretiens.

---

## 8. Priorités de développement et faisabilité

Je recommande de distinguer la refonte visuelle des évolutions du moteur.

| Priorité | Élément | Orientation |
|---|---|---|
| P0 | Nouvel accueil | Réorganiser les composants et les données existants |
| P0 | États de couverture | Afficher correctement les matchs sans probabilité |
| P0 | Mode hors ligne | Identifier les données anciennes |
| P1 | Bilan du lendemain | Exploiter les résultats déjà disponibles |
| P1 | Avatar statique | Créer une identité visuelle originale |
| P1 | Scénarios | Définir des règles à partir des scores probables |
| P2 | Compositions et blessés | Étudier une récupération systématique |
| P2 | Couverture CAF et ivoirienne | Étudier les fournisseurs de cotes et les alternatives |
| P3 | Probabilités en direct | Étudier la faisabilité et le coût |
| P3 | Probabilités joueurs | Développer uniquement après validation des données |

Ne pas élargir le nombre de marchés ou afficher de nouvelles statistiques simplement pour enrichir l'interface. La fiabilité des données doit rester prioritaire.

---

## 9. Points techniques à respecter

- Réutiliser les composants existants lorsque cela est pertinent.
- Ne pas reconstruire le moteur de prédiction dans le cadre de cette refonte.
- Ne pas inventer de données pour remplir les cartes.
- Distinguer les probabilités issues du marché et celles issues du modèle.
- Ne pas présenter les scénarios comme opérationnels avant leur implémentation.
- Prévoir les états de chargement, d'erreur et d'absence de données.
- Garantir la cohérence des thèmes clair et sombre.
- Optimiser le rendu pour Android et les réseaux mobiles ivoiriens.
- Conserver une interface légère, sans vidéo ni animations coûteuses.
- Ne pas modifier les données de production dans le cadre de la conception.

---

## 10. Recommandation finale

Je recommande de commencer par trois livrables de conception :

**Livrable 1 — L'accueil principal**
- Jour chargé.
- Version claire et sombre.
- Écran mobile 360 × 800 px.
- Hiérarchie définitive des blocs.

**Livrable 2 — Les états alternatifs**
- Matchs en direct.
- Jour creux.
- Match non couvert.
- Nouvel abonné.
- Lendemain.
- Hors ligne.

**Livrable 3 — L'identité de l'avatar**
- Trois propositions graphiques.
- Expressions principales.
- Intégration dans la carte « L'avis BETWISE ».

Je souhaite que la première maquette soit suffisamment aboutie pour juger la qualité visuelle réelle du produit, pas simplement un wireframe fonctionnel.

**Décision produit :** l'accueil doit faire comprendre en quelques secondes que BETWISE est une plateforme d'intelligence sportive, et non un gestionnaire de bankroll auquel on a ajouté des prédictions.

La prochaine étape est de confronter cette proposition à la structure technique existante, puis de produire les maquettes avant toute intervention sur le code.

**Aucune modification de `main`, de Supabase ou de la production n'est nécessaire pour cette phase.**
