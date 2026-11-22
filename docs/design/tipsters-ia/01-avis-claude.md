# Tipsters IA — avis de Claude

Réponse à la demande de revue de la section 19 de `docs/product/orientations-finalisation-prototype-nov-2026.md` (et aux sections 20 et 22 sur les autres modèles).

| | |
| --- | --- |
| Auteur | Claude, modèle `claude-fable-5-2` |
| Date | 22 novembre 2026 |
| Code lu | branche `accueil`, commit `b4ad73b` |
| Statut | Avis. Rien n'est construit au-delà du pilote décrit au point 1. Mounir décide. |

## Ce que je propose, en dix lignes

1. **Trois profils IA, pas plus : ChatGPT, Claude, Fusion.** Plus deux lignes de comparaison qui ne coûtent rien : un témoin mécanique (les « Coups du jour BETWISE », qui existent déjà) et un « Consensus » calculé (les paris que ChatGPT et Claude ont choisis chacun de leur côté).
2. **Un compte par décideur, jamais par stratégie.** Le niveau de risque, le format du ticket et la règle de mise ne sont pas des comptes : ce sont des colonnes. Le système les calcule à partir des mêmes choix verrouillés.
3. **Mise fixe pour tous** (1 000 F sur une bankroll virtuelle de 100 000 F). C'est la seule façon de comparer les choix sans comparer les mises.
4. **Une seule définition des niveaux de risque**, celle de Mounir du 21/11, appliquée à la cote réellement prise : Prudent 1,10 à 1,29, Équilibré 1,30 à 1,54, Audacieux 1,55 à 3,00.
5. **Simples et combinés en V1. Montantes simulées par le système**, sans décision d'une IA.
6. **Le rendement seul ne départagera personne avant des mois.** Il faut deux mesures plus rapides : l'écart avec la cote de clôture, et la justesse des probabilités annoncées sur une liste de matchs commune. Et pour savoir quels marchés passent à quel niveau de risque, un tableau calculé sur toutes les sélections du jour répondra plus vite que les tipsters (point 7).
7. **Aucun autre modèle au départ.** Gemini en premier renfort, parce qu'il a un palier gratuit et que le projet a déjà sa clé. Les autres ensuite, un par un.
8. **Sans frais nouveaux, c'est faisable** : Claude joue par une session planifiée, ChatGPT dépose ses choix sur GitHub, un robot les enregistre. La version entièrement automatique par API coûterait de l'ordre de 20 à 40 $ par mois (estimation, point 10).
9. **Quatre préalables techniques** avant de lancer, dont un sérieux : les tâches planifiées de GitHub partent avec 7 à 10 heures de retard, tous les jours (point 9).
10. **Huit semaines minimum, et pas de vainqueur annoncé sous 300 paris réglés par profil.**

Les points où je m'écarte du brief de ChatGPT sont regroupés au point 12, pour qu'il puisse y répondre.

## 1. Où on en est réellement

### Le pilote lancé ce matin

À la demande de Mounir (22/11, 08 h 49), j'ai créé un compte d'audit et un tipster virtuel :

- compte `audit@betwise.invalid`, ouvert par un robot avec la clé de service, sans mot de passe ;
- source privée « Claude · tipster virtuel » dans le compte de Mounir, qu'il suit déjà ;
- trois paris test enregistrés à 09 h 04 : Go Ahead Eagles −1,5 à 2,81 ; victoire de Göztepe à 2,68 ; Sivasspor moins de 0,5 but en 2e mi-temps à 1,41 ;
- règles dans `src/lib/tipster-virtuel/strategie.ts` : parier seulement quand 1xBet paie au-dessus de la cote juste, au plus 6 paris par jour.

### Deux choses à dire franchement sur ce pilote

**Ce n'est pas « Claude qui réfléchit chaque jour ».** C'est une règle que j'ai écrite une fois et qu'un robot applique. Pour l'expérience demandée, il faut choisir entre les deux (point 3).

**Les trois premiers paris reposent sur une comparaison bancale.** J'ai comparé une cote 1xBet relevée le 22/11 à 00 h 01 avec une cote de référence relevée le 21/11 à 15 h 17. Près de neuf heures séparent les deux relevés. L'écart de prix que j'ai annoncé à Mounir (« je paie moins cher que le marché ») peut donc venir d'un simple mouvement de cote entre-temps. Je garde ces trois paris, rien n'est effacé, mais ils comptent comme rodage. Depuis le commit `b4ad73b`, la règle refuse de comparer deux relevés séparés de plus de 3 heures, ou une cote 1xBet de plus de 6 heures.

Je le signale ici parce que ce défaut concernera tous les profils : sans relevés pris au même moment, personne ne peut dire qu'une cote est « bonne ».

### Ce que l'application sait déjà

Trois mesures existent et cadrent l'expérience.

| Mesure | Résultat | Source |
| --- | --- | --- |
| Probabilités tirées des cotes, 4 004 matchs des cinq grands championnats | Annoncé et arrivé à 1 ou 2 points près dans toutes les familles, mi-temps comprises | `docs/mesures/2026-11-19_resultats.md` |
| Coups du jour BETWISE, du 12 au 21/11 | 68 pronos réglés, 55 gagnés : 81 % de réussite pour 80 % attendus d'après les cotes, rendement +1 % | fiche de la source, 22/11 |
| Modèle BETWISE, du 19 au 21/11 | 58 réglés, 26 gagnés : 45 % de réussite pour 61 % attendus d'après les cotes, rendement −27 % | fiche de la source, 22/11 |

Deux leçons.

**La question « quels marchés passent selon le niveau de risque » a déjà une bonne partie de sa réponse.** Quand la probabilité vient des cotes, un choix annoncé à 75 % passe à peu près 75 fois sur 100, quel que soit le marché mesuré. Les marchés ne « passent » pas plus ou moins : c'est le prix qui change. Ce qui reste à apprendre est ailleurs : quelqu'un sait-il choisir mieux que la cote, et sur quels marchés le bookmaker prend-il le moins de marge ?

**Un jugement moins juste que le marché se paie.** Le Modèle BETWISE joue son favori sur deux marchés par match. Sur 58 pronos, il fait nettement moins bien que ce que les cotes annonçaient. C'est peu de pronos, mais la mesure du 19/11 disait déjà que le modèle est moins juste que les cotes. Une IA qui s'écarte du marché sur la foi de son seul raisonnement court le même risque.

## 2. Combien de profils

**Trois profils IA, comme demandé : ChatGPT, Claude, Fusion.** Je n'en ajouterais pas.

J'ajoute en revanche deux lignes de comparaison, sans compte ni décision supplémentaire.

| Ligne | Qui décide | Coût | À quoi elle sert |
| --- | --- | --- | --- |
| ChatGPT | ChatGPT seul | relais de Mounir, ou API | profil demandé |
| Claude | Claude seul | session planifiée, ou API | profil demandé |
| Fusion | les deux, après échange écrit | deux échanges de plus | profil demandé |
| Témoin | personne : les Coups du jour BETWISE, mécaniques | rien, ils existent | dire si une IA fait mieux que la règle déjà en place |
| Consensus | personne : calculé | rien | les paris choisis par ChatGPT et par Claude séparément ; c'est l'étalon de Fusion |

Sans témoin, on comparera des IA entre elles sans savoir si l'une d'elles apporte quelque chose à BETWISE. Sans Consensus, on ne saura pas si la discussion de Fusion vaut mieux que le simple fait d'être d'accord.

**Pourquoi pas plus de comptes.** Chaque compte divise les données. Au rythme prévu (6 paris par jour au plus), un profil produit environ 110 paris par niveau de risque en huit semaines. C'est déjà trop peu pour conclure (point 7). Avec des comptes par persona, par format et par niveau, on n'aurait que du bruit.

## 3. Quels profils, quelles stratégies

### Séparer trois choses que le brief mélange un peu

| Dimension | Exemples | Comment la traiter |
| --- | --- | --- |
| Qui choisit | ChatGPT, Claude, Fusion, Témoin | un compte par décideur |
| Comment on mise | mise fixe, part de bankroll, quart de Kelly | calculé par le système sur les mêmes choix |
| Quel format | simple, combiné, montante | simples et combinés déclarés ; montantes simulées |

Le brief dit déjà « distinguer les performances du modèle, de la stratégie de mise et du format de ticket ». Je propose d'aller au bout : seule la première dimension demande des comptes.

### Stratégie écrite ou décision quotidienne ?

Il y a deux façons de faire jouer une IA.

- **Stratégie écrite.** L'IA rédige ses règles une fois, un robot les applique. Gratuit, reproductible, vérifiable ligne à ligne. Mais on compare alors deux jeux de règles, pas deux jugements. C'est mon pilote de ce matin.
- **Décision quotidienne.** Chaque jour, l'IA reçoit le même dossier de données et rend ses choix. C'est ce que demande la section 19 (« prend ses décisions quotidiennes »).

Je retiens la **décision quotidienne, encadrée par des limites écrites**. L'IA choisit, mais un robot refuse tout choix hors des clous : sélection absente du dossier, cote différente de celle du dossier, match déjà commencé, plafond dépassé. Mes règles de ce matin deviennent ces limites communes, pas la stratégie de Claude.

### Les mêmes obligations pour tous

- Même dossier du jour, et rien d'autre : pas de recherche web, pas d'information extérieure. Une ligue « avec recherche web » pourra venir plus tard, à part.
- Même mise, mêmes plafonds, mêmes niveaux de risque.
- Chaque choix porte : marché, sélection, cote du dossier, probabilité estimée par l'IA, niveau de risque, raison en deux phrases, identifiant exact du modèle.
- L'abstention est permise, avec sa raison. Elle est comptée.

### Un panel de pronostics, en plus des paris

Je propose que chaque IA donne aussi, chaque jour, sa probabilité sur une liste fixe : les 8 « tops matchs » du jour, trois questions par match (qui gagne, plus de 2,5 buts, les deux marquent). Elle ne mise rien dessus.

L'intérêt est concret. Les paris tombent sur des matchs différents selon les profils, donc ils se comparent mal. Le panel porte sur les mêmes matchs pour tout le monde : 24 probabilités par jour et par IA, notées contre le résultat et contre la probabilité du marché. C'est la mesure la plus rapide pour savoir si une IA voit quelque chose que la cote ne voit pas.

Si le relais manuel de ChatGPT rend ce panel trop lourd, on peut le retirer sans casser le reste.

## 4. Fusion : ce qu'elle vaut et comment la faire

### Ce que j'en attends vraiment

Peu de gain sur le rendement, pour deux raisons.

- ChatGPT et Claude ont appris sur des textes largement communs. Leurs erreurs se ressemblent plus que celles de deux parieurs humains.
- Une discussion entre deux IA tend à donner raison à celle qui argumente avec le plus d'assurance, pas à celle qui a raison.

Je ne peux pas chiffrer cet effet à l'avance : c'est justement ce que l'expérience doit mesurer. Fusion a en revanche deux intérêts réels. Elle filtre : ne jouer que ce qui résiste à la critique de l'autre donne moins de paris, mieux argumentés. Et elle produit un contenu que BETWISE pourrait montrer un jour, deux analyses et leur désaccord sur un même match.

### La méthode : un échange écrit, une règle fixée d'avance

1. ChatGPT et Claude verrouillent leurs choix séparément.
2. Chacun reçoit les choix et les raisons de l'autre.
3. Chacun répond une seule fois, par écrit : pour chaque pari de l'autre, « j'accepte », « je refuse » ou « je modifie », avec la raison. Chacun peut aussi réviser sa propre probabilité ; l'ancienne et la nouvelle sont gardées.
4. **Le robot applique la règle, aucune IA n'a le dernier mot.** Un pari entre dans Fusion seulement si les deux l'acceptent après l'échange. En cas de désaccord, pas de pari, et le désaccord est consigné avec les deux arguments. La probabilité de Fusion est la moyenne des deux probabilités révisées.
5. Tout est gardé : les deux analyses de départ, les deux réponses, la décision, l'heure.

Un seul tour, pas de négociation. Ce n'est ni une moyenne automatique ni une copie des comptes autonomes : un pari proposé par un seul peut entrer s'il convainc l'autre, et un pari commun peut sortir si l'un change d'avis.

### Comment juger si Fusion sert à quelque chose

En la comparant à trois lignes : chaque profil seul, le Consensus calculé, et la moyenne simple des probabilités sur le panel. Si Fusion ne fait pas mieux que le Consensus, la discussion n'apporte rien de mesurable et on le dira.

### La cadence

Tous les jours si tout passe par API. Sinon le week-end seulement (vendredi soir pour samedi et dimanche) : la concertation demande à Mounir de relancer ChatGPT une deuxième fois, et ce n'est pas tenable au quotidien.

## 5. Niveaux de risque

### Une seule définition, mesurable

Je reprends les bornes fixées par Mounir le 21/11, appliquées à **la cote réellement prise** (cote 1xBet du dossier).

| Niveau | Cote prise | Chance de passer correspondante, marge du bookmaker retirée (5 %) |
| --- | --- | --- |
| Prudent | 1,10 à 1,29 | environ 74 à 87 % |
| Équilibré | 1,30 à 1,54 | environ 62 à 73 % |
| Audacieux | 1,55 à 3,00 | environ 32 à 61 % |
| Hors expérience | sous 1,10, ou au-dessus de 3,00 | |

Le plafond à 3,00 est un ajout de ma part. Au-delà, il faut tant de paris pour juger qu'on n'apprendra rien en huit semaines. Pour un combiné, le niveau se lit sur la cote totale du ticket.

### Les paramètres d'exposition

| Paramètre | Valeur proposée |
| --- | --- |
| Bankroll virtuelle | 100 000 F par profil et par format |
| Mise | fixe, 1 000 F (1 % de la bankroll de départ) |
| Simples par jour | 2 au plus par niveau, 6 au total, un seul par match |
| Combinés par jour | 1 au plus |
| Arrêt | le profil est suspendu et revu si sa bankroll perd 40 % depuis son plus haut |

### Un préalable : l'application a aujourd'hui quatre définitions

L'audit des écrans (voir `docs/design/audit-ux/01-audit.md`) montre que les trois mêmes mots recouvrent quatre découpages différents.

| Où | Découpage |
| --- | --- |
| Prédictions, coups du jour (`categories.ts`) | cote 1,10–1,29 / 1,30–1,54 / 1,55 et plus |
| Options du jour (`options-view.tsx`) | probabilité 83–91 % / 67–83 % / 53–67 % |
| Paris, sources, import (fonction `risk_from_odds` en base) | « Prudent » sous 1,50 / « Moyen » 1,50 à 2,20 / « Risqué » au-dessus |
| Tableau de bord (`stats/dashboard.ts`) | idem, plus « Très risqué » au-dessus de 5 |

Les statistiques « par niveau de risque » des sources utilisent la troisième. Tant que ce n'est pas unifié, un tableau « réussite par niveau de risque » ne veut pas dire la même chose d'un écran à l'autre. C'est à régler avant de lancer.

## 6. Formats de tickets en V1

| Format | V1 | Limites |
| --- | --- | --- |
| Simples | oui, c'est la référence | voir point 5 |
| Combinés | oui, dans un livre de comptes séparé | 1 par jour ; 2 ou 3 sélections ; matchs différents ; chaque sélection doit figurer dans les simples du jour du même profil ; cote totale 5,00 au plus |
| Montantes | simulées par le système, sans décision d'IA | voir ci-dessous |

**Pourquoi les sélections d'un combiné doivent déjà être jouées en simple.** On peut alors comparer le combiné à ses propres sélections jouées séparément. La différence entre les deux mesure l'effet du format, et rien d'autre.

**Pourquoi les montantes sont simulées.** Une montante n'est pas un choix de pari, c'est une façon de miser : on rejoue le gain palier après palier. Le système peut donc l'appliquer aux simples Prudent déjà verrouillés de chaque profil, sans qu'aucune IA décide quoi que ce soit de plus. Paramètres fixés avant le lancement :

- mise de départ 5 000 F, 4 paliers, on encaisse au quatrième ;
- un palier perdu, la montante est perdue et la suivante repart à 5 000 F ;
- budget de 10 montantes (50 000 F), arrêt quand il est dépensé.

Aucune mise n'augmente après une perte. L'écran montrera combien de montantes vont au bout et combien on a perdu, sans arrondir les angles.

## 7. Les indicateurs

Toujours affichés avec le nombre de paris et la période.

| Indicateur | Existe déjà ? | Remarque |
| --- | --- | --- |
| Paris joués, abstentions, paris par jour | en partie | |
| Réussite, et réussite attendue d'après les cotes | oui (fiche source) | |
| Rendement à mise fixe, avec son intervalle de confiance | oui en partie | l'intervalle doit être affiché, pas seulement « non établi » |
| Bankroll, plus forte baisse, pire série, écart-type du résultat par jour | en partie | |
| **Écart avec la cote de clôture** | non | à construire : relevé de la cote 1xBet juste avant le coup d'envoi |
| **Justesse des probabilités** (score de Brier, comparé au marché) | le calcul existe (`src/lib/mesure/calibration.ts`) | à brancher sur le panel |
| Recouvrement entre profils, et résultat des paris communs contre les paris propres | non | simple à calculer |
| Par marché, par compétition, par niveau, par format | oui pour les sources | à rebaser sur les nouveaux niveaux |
| Coût par pari enregistré | non | seulement si on passe par API |

### Pourquoi le rendement ne suffira pas

Voici la marge d'erreur du rendement (intervalle à 95 %), calculée pour une cote typique de chaque niveau.

| Niveau (cote typique) | 100 paris | 300 paris | 1 000 paris |
| --- | ---: | ---: | ---: |
| Prudent (1,20) | ± 9 points | ± 5 points | ± 3 points |
| Équilibré (1,42) | ± 13 points | ± 8 points | ± 4 points |
| Audacieux (2,00) | ± 20 points | ± 11 points | ± 6 points |

La marge d'un bookmaker tourne autour de quelques points. Deux profils sérieux se sépareront donc de quelques points de rendement, pas plus. Pour voir un écart de 5 points entre deux profils, il faut environ 700 paris chacun en Prudent, 1 400 en Équilibré, 3 100 en Audacieux. À 2 paris par niveau et par jour, cela fait un à quatre ans.

C'est pour cela que je demande deux mesures plus rapides. L'écart avec la cote de clôture compare deux prix au lieu d'attendre un résultat : il parle en quelques semaines. Le panel donne 24 probabilités par jour sur les mêmes matchs pour tous.

### Pour la question de Mounir : un tableau des marchés

Mounir veut savoir « quels sont les marchés qui passent ou pas selon le niveau de risque ». Les tipsters IA y répondront lentement : six paris par jour chacun. Le système peut y répondre bien plus vite, sans IA.

L'application calcule déjà chaque jour des milliers de sélections avec leur probabilité et, quand elle existe, leur cote 1xBet : le 22/11 à 9 h, 6 180 sélections avaient une cote 1xBet, sur les 66 matchs des huit heures suivantes. Il suffit de les noter toutes après les matchs, pas seulement celles qui ont été jouées. On obtient alors, par famille de marché et par niveau de risque :

- la réussite annoncée et la réussite constatée ;
- la marge moyenne de 1xBet, c'est-à-dire ce que le parieur perd en moyenne en jouant ce marché sans choisir.

Ce tableau dira où le parieur est le moins désavantagé. Les tipsters IA diront ensuite si bien choisir fait mieux que ce tableau. La mesure hebdomadaire existe déjà (`scripts/mesure-probabilites.ts`) ; il lui manque le découpage par niveau de risque et la marge par marché.

### Les seuils de lecture

| Paris réglés du profil | Ce qu'on a le droit de dire |
| --- | --- |
| moins de 100 | rodage : on vérifie que tout s'enregistre, on ne commente pas les résultats |
| 100 à 299 | tendance, avec l'intervalle affiché |
| 300 et plus | on peut comparer les profils sur l'écart à la clôture et sur le panel ; le rendement reste une tendance |

À noter : la fiche d'une source affiche aujourd'hui « Confirmé » dès 30 pronos réglés, et le classement démarre à 3 (`src/lib/sources/proof.ts`). À 30 pronos autour de 1,70, la marge d'erreur du rendement est de ± 30 points. Le mot est trop fort pour ce qu'il mesure.

## 8. Les autres modèles IA

### Ma recommandation

1. **Au lancement : aucun.** Le protocole ne dépend pas du modèle. Ajouter un participant plus tard, c'est ajouter un fichier de choix.
2. **Premier renfort, après deux semaines sans accroc : Gemini.** Palier gratuit, et le projet a déjà une clé Gemini (elle sert à la voix).
3. **Deuxième : DeepSeek**, si Mounir accepte quelques dollars par mois et que le paiement passe.
4. **Grok, Mistral, Meta : pas maintenant.** Détails ci-dessous.

Je suis d'accord avec ChatGPT sur l'ordre Gemini puis DeepSeek. Je suis plus prudent que lui sur le calendrier : pas de troisième modèle tant que les trois profils de base ne tournent pas seuls.

### Accès, prix et limites, relevés le 22/11/2026

Prix par million de jetons, entrée puis sortie. Ces tarifs changent souvent, plusieurs sont promotionnels : à relire avant toute activation.

| Modèle | Accès | Prix lu | Ce qu'il apporterait | Limites |
| --- | --- | --- | --- | --- |
| OpenAI, `gpt-6.2-sol` | API payante, distincte de l'abonnement ChatGPT | 2,00 $ / 10,00 $ (`gpt-6.1-terra` : 1,00 $ / 5,00 $) | automatiser le profil ChatGPT | pas de palier gratuit sur la page de prix |
| Anthropic, Claude Opus 5.5 | API payante, distincte de l'abonnement Claude | 4,00 $ / 20,00 $ (Sonnet 5.5 : 2,00 $ / 10,00 $) | automatiser le profil Claude sans session planifiée | |
| Google, Gemini (modèles Flash) | API avec palier gratuit | gratuit sur le palier gratuit ; payant, par exemple 1,50 $ / 9,00 $ pour Gemini 3.5 Flash | troisième avis, sans frais | sur le palier gratuit, Google utilise les données pour améliorer ses produits ; quotas journaliers à vérifier ; la clé du projet est rangée dans Vercel, pas dans GitHub |
| DeepSeek, `deepseek-v4-pro` | API prépayée | 0,66 à 1,32 $ / 1,98 à 3,96 $ selon l'heure (`deepseek-flash` : 0,15 à 0,30 $ / 0,60 à 1,20 $) | un avis très bon marché | tarif doublé de 01 h à 04 h et de 06 h à 10 h UTC en semaine, c'est-à-dire à notre heure de décision ; moyen de paiement depuis la Côte d'Ivoire à vérifier |
| xAI, `grok-4.7` | API prépayée | 2,00 $ / 6,00 $ ; recherche web 5 $ les 1 000 appels | l'actualité des équipes par la recherche | son intérêt casse la règle « mêmes données pour tous » : à réserver à une ligue « avec recherche » |
| Mistral | API | non vérifié | un modèle européen | conditions du palier gratuit et de l'accès API modifiées en 2026 d'après des sources non officielles ; je n'ai pas pu le confirmer sur la page de Mistral |
| Meta, `muse-spark-1.2` | Meta Model API, en aperçu public | 1,25 $ / 4,25 $ ; version « contributor » à 0,10 $ / 0,20 $ où Meta utilise les données | un cinquième avis | aperçu d'abord réservé aux États-Unis ; un accès élargi est annoncé, sans liste de pays que j'aie pu lire |

**Sur Meta AI précisément (section 22).** Le compte Meta AI de Mounir, celui de l'application et de WhatsApp, ne peut pas être branché à BETWISE : ce n'est pas une API. L'API de Meta est un service séparé, avec un compte développeur. Tant que son ouverture à la Côte d'Ivoire n'est pas vérifiée, Meta AI ne peut servir qu'à une comparaison à la main, et ne doit pas être présenté comme un tipster intégré. ChatGPT avait raison de le signaler.

### Deux points que la shortlist ne traite pas

**Les versions changent toutes les quelques semaines.** Entre septembre et novembre, OpenAI et Anthropic ont chacun sorti plusieurs modèles. Un profil « ChatGPT » qui change de modèle en cours de route n'est plus le même joueur. Chaque choix doit porter l'identifiant exact du modèle, et un changement de modèle ouvre une nouvelle saison du profil.

**Le canal compte autant que le modèle.** ChatGPT dans l'application de Mounir et ChatGPT par API ne se comportent pas pareil : consignes différentes, mémoire, outils. Il faut choisir un canal par profil et s'y tenir pendant une saison.

### Phase de test pour un nouveau modèle

Une semaine à blanc sur les mêmes dossiers que les autres, sans entrer au classement. On vérifie trois choses : le format de sortie est respecté, aucune donnée n'est inventée (le robot rejette toute sélection ou cote absente du dossier, et on compte les rejets), et le coût réel par jour. Ensuite seulement il entre, avec sa propre date de départ.

## 9. Le protocole V1 et ses préalables

### Une journée type

| Heure (GMT, heure d'Abidjan) | Étape |
| --- | --- |
| 08 h 00 | Le robot rafraîchit les cotes, puis publie le dossier du jour : matchs, cotes de référence, cote 1xBet, probabilités, forme, classement. Un seul fichier, avec son empreinte. |
| jusqu'à 12 h 00 | Chaque IA lit le dossier et rend son fichier de choix. Le robot contrôle chaque ligne et enregistre : un prono dans la source du profil, un pari test sur son compte. Heure prise sur le serveur. |
| au fil de la journée | Un choix n'est accepté que si son match commence au moins 30 minutes plus tard. Après 12 h, il est accepté mais classé « hors délai » et compté à part. |
| 10 minutes avant chaque match | Relevé de la cote de clôture pour les sélections jouées. |
| après les matchs | Règlement automatique sur le score. Aucun règlement à la main. |
| le lendemain matin | Mise à jour des tableaux. |

### L'indépendance des choix

Le dépôt GitHub est public. Sans précaution, ChatGPT pourrait lire les choix de Claude, et inversement. Je propose : Claude joue en premier, à heure fixe, et ses choix vont directement en base, où ils restent invisibles. Ils ne sont publiés dans le dépôt qu'au dépôt du fichier de ChatGPT, ou à midi. Le robot refuse le passage de Claude si le fichier de ChatGPT du jour existe déjà.

### Le verrouillage

- Personne ne peut ouvrir les comptes des profils : adresse en `.invalid`, pas de mot de passe, session ouverte par le robot seulement.
- Le robot n'a que deux gestes sur ces comptes : enregistrer un choix avant le coup d'envoi, et lire.
- Chaque passage dépose aussi son rapport sur une branche publique du dépôt, datée par GitHub.

Point faible à connaître : les écrans de l'application permettent aujourd'hui de modifier un pari test, de le déclarer gagné à la main avant le match, et de le supprimer. Sur ces comptes, personne ne peut le faire puisque personne ne peut s'y connecter. Mais la garantie tient au fait que le code du robot est public, pas à un verrou en base. Si l'expérience devient publique, il faudra un vrai verrou.

### Comment ChatGPT joue sans API

ChatGPT écrit déjà dans le dépôt par le compte de Mounir : ses trois commits de ce matin en sont la preuve. Il peut donc déposer un fichier `tipsters/choix/chatgpt/AAAA-MM-JJ.json`. Un dépôt déclenche le robot tout de suite, sans passer par les tâches planifiées. Il faut seulement que Mounir lui dise chaque matin « fais tes choix du jour ».

Si ChatGPT sait planifier cette tâche lui-même avec un accès en écriture à GitHub, le relais disparaît. Je ne l'ai pas vérifié : c'est une question pour lui.

### Comment Claude joue sans API

Par une session planifiée, incluse dans l'abonnement de Mounir : chaque matin une session neuve lit le dossier, décide, dépose ses choix. Elle consomme un peu de l'usage de l'abonnement tous les jours. Le modèle utilisé est celui de la session, noté dans chaque choix.

### Les quatre préalables

| Préalable | Pourquoi | Ce que ça change en production | Réversible ? |
| --- | --- | --- | --- |
| **Une horloge fiable** | Les tâches planifiées de GitHub partent avec 7 à 10 heures de retard, chaque jour depuis au moins le 10/11 : les cotes prévues à 07 h 00 arrivent entre 13 h 51 et 16 h 34, le modèle et les coups du jour prévus à 07 h 30 entre 14 h 23 et 17 h 16 | une tâche planifiée dans la base, qui déclenche les automatisations à l'heure, et un jeton GitHub que Mounir crée et range lui-même dans le coffre de Supabase | oui : on supprime la tâche et le jeton |
| **Des prix relevés au même moment** | sans cela, aucune « bonne cote » n'est mesurable (voir point 1) | rien en base ; l'import des cotes change | oui |
| **La cote de clôture** | pour l'indicateur le plus rapide | de nouvelles lignes dans les relevés de cotes, une tâche toutes les 5 minutes | oui |
| **Les niveaux de risque unifiés** | point 5 | la fonction `risk_from_odds` et quatre écrans | oui, par une nouvelle migration |

Le premier préalable dépasse l'expérience : il explique pourquoi l'accueil affiche « Les coups de demain » le matin. Je le détaille dans l'audit.

### Une dépendance à trancher

Les cotes 1xBet viennent de l'abonnement API-Football Pro, qui se termine le 11 décembre 2026 d'après nos notes. Sans lui, plus de cote 1xBet, donc plus d'expérience sous cette forme. Huit semaines nous emmènent à la mi-janvier : il faut décider du renouvellement avant de lancer.

## 10. Les coûts

**Sans frais nouveaux.** Claude par session planifiée, ChatGPT par dépôt GitHub, Fusion le week-end, Gemini sur son palier gratuit le jour où on l'ajoute. Le prix se paie en temps : Mounir relance ChatGPT chaque matin.

**Tout automatique, par API.** Mon estimation, à vérifier sur une semaine d'essai :

| Poste | Hypothèse | Par mois |
| --- | --- | --- |
| Profil ChatGPT, `gpt-6.2-sol` | 25 000 jetons lus et 20 000 écrits par jour, raisonnement compris | environ 8 $ |
| Profil Claude, Opus 5.5 | idem | environ 15 $ |
| Fusion, un échange par jour et par modèle | 35 000 lus, 8 000 écrits | environ 14 $ |
| Total | | **environ 37 $**, ou une vingtaine avec `gpt-6.1-terra` et Sonnet 5.5 |

Ce sont deux comptes développeur à ouvrir (OpenAI et Anthropic), chacun avec un moyen de paiement. Rien ne sera activé sans l'accord de Mounir.

## 11. Ce que je ne sais pas

- Si ChatGPT peut planifier seul une tâche qui écrit sur GitHub.
- Si l'API de Meta est ouverte en Côte d'Ivoire, et ce que Mistral propose aujourd'hui gratuitement.
- Les quotas exacts du palier gratuit de Gemini sur la clé du projet.
- Le nombre de jetons réel d'un dossier du jour : mes coûts sont des ordres de grandeur.
- Si l'API-Football renvoie, dans le même appel que 1xBet, les cotes d'un bookmaker de référence. Ce serait la façon la plus propre d'avoir deux prix au même moment. À sonder.
- Le prix du renouvellement d'API-Football Pro.
- Pourquoi GitHub retarde autant les tâches planifiées de ce dépôt. Je constate le retard sur douze jours, je n'en connais pas la cause.

## 12. Là où je m'écarte du brief de ChatGPT

Pour sa contre-revue. Sur le reste, je suis d'accord.

| Sujet | Brief | Mon avis |
| --- | --- | --- |
| Montantes | un type de pari à faire expérimenter par les comptes | une règle de mise, simulée par le système sur les simples verrouillés |
| Niveaux de risque | « les seuils précis restent à proposer » | ils existent depuis le 21/11 ; le vrai travail est de supprimer les trois autres définitions |
| Comparaison | ROI, drawdown, volatilité, calibration | le ROI ne tranchera pas à l'échelle de l'expérience ; la cote de clôture et le panel passent devant |
| Fusion | profil à part entière | d'accord, mais jugée contre un Consensus calculé, et réduite au week-end si le relais est manuel |
| Témoin | absent | indispensable, et il existe déjà |
| Autres modèles | Gemini et DeepSeek en première phase | aucun au lancement ; Gemini après deux semaines |
| Données | « mêmes données » | je précise : un seul dossier, aucune recherche web, sinon les profils ne jouent pas au même jeu |
| Versions de modèle | « conserver le nom/version » | un changement de modèle ouvre une nouvelle saison |

**Un conflit d'intérêts à nommer.** Je construis le robot et je suis l'un des joueurs. Pour que ce soit acceptable : le code est public, le même contrôle s'applique à tous les fichiers de choix, et ChatGPT relit le protocole avant le lancement. S'il veut un contrôle de plus, je le prends.

## 13. Ce que Mounir doit trancher

| Décision | Mon choix | Coût ou effet |
| --- | --- | --- |
| Nombre de profils | 3 profils IA, plus Témoin et Consensus | aucun compte de plus que prévu |
| Mise et bankroll | 1 000 F fixes sur 100 000 F | |
| Plafond des cotes | 3,00 | |
| Formats | simples et combinés ; montantes simulées | |
| Canal | sans frais pour commencer | un message à ChatGPT chaque matin |
| Durée | 1 semaine de rodage, puis 8 semaines | jusqu'à la mi-janvier |
| Préalables | les quatre du point 9, l'horloge d'abord | un jeton GitHub à créer ; des changements en base à valider un par un |
| API-Football Pro | renouveler avant le 11/12 si l'expérience est lancée | prix à vérifier |
| Tableau des marchés | à construire en parallèle : c'est lui qui répond le plus vite à la question des marchés | aucun coût |
| Mon pilote actuel | il continue comme rodage, avec la nouvelle règle sur les relevés | il jouera peu tant que l'horloge n'est pas réparée |

## Sources des prix

Pages lues le 22/11/2026.

- OpenAI : https://developers.openai.com/api/docs/pricing.md
- Google : https://ai.google.dev/gemini-api/docs/pricing
- DeepSeek : https://api-docs.deepseek.com/quick_start/pricing
- xAI : https://docs.x.ai/developers/pricing.md
- Meta : https://developer.meta.com/ai/models/muse-spark-1-2/ et https://developer.meta.com/ai/resources/blog/build-with-muse-spark/
- Anthropic : https://platform.claude.com/docs/en/about-claude/pricing ; prix d'Opus 5.5 recoupé avec https://betanews.com/article/claude-opus-5-5-launch-price-cut/
- Mistral : https://mistral.ai/fr/pricing (formules) ; conditions d'accès API lues seulement sur une source non officielle, https://agentdeals.dev/mistral-api-pricing-2026
