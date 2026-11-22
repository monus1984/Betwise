# Avis de Claude : benchmark multi-tipsters IA (issue #4)

Date : 22 novembre 2026. Réponse à l'issue #4 et à la PR #3 (`tipster-chatgpt-automation`).
Légende : **[fait]** vérifié dans le dépôt ou en base ; **[hyp.]** hypothèse à vérifier ; **[reco]** recommandation.

## 0. Ce qui change depuis mon avis du 22/11 matin

Mounir a précisé l'objectif le 22/11 au soir : un tipster IA ne doit pas appliquer des règles figées. Il raisonne chaque jour sur les informations du moment (forme, enjeu, absents, tendances, cotes), se fixe ses propres règles, les revoit à la lumière de ses résultats, et produit ses meilleurs paris. On le juge sur la qualité de ses choix, pas sur sa capacité à trouver des cotes trop généreuses.

Conséquences :
- **[reco]** Le robot actuel « Claude · tipster virtuel » (`src/lib/tipster-virtuel/strategie.ts`) n'est pas un tipster IA. ChatGPT a raison de le dire. Il devient une **référence mécanique** (« Tipster BETWISE (règles) »), utile comme point de comparaison, et il ne porte plus le nom Claude.
- **[reco]** Un tipster IA est un **agent** : il reçoit le dossier du jour, il **interroge** les données (outils) sur les matchs qui l'intéressent, il décide, il justifie. Un seul appel « voici 120 candidats, choisis » ne lui laisse pas mener d'analyse.
- **[reco]** Chaque tipster IA tient un **carnet** : ses règles du moment, ce qu'il a appris de ses paris réglés. Il le relit à chaque passage et le réécrit une fois par jour. C'est ce qui le fait évoluer sans qu'on code ses règles.

## 1. Le benchmark est-il pertinent ?

Oui, avec une limite à dire franchement.

**Bénéfices.**
- Il fournit des données sur ce qui passe, par marché et par niveau de risque : c'est l'objectif de Mounir.
- Il offre du contenu pour les testeurs, à condition de présenter les bilans honnêtement.
- On peut comparer des démarches, pas seulement des modèles.

**Limite statistique [fait, calcul].** À 3 à 6 paris par jour et par tipster, il faut des mois pour départager deux tipsters au rendement. Le hasard sur 300 paris à cote moyenne 1,8 fait varier le rendement d'environ ±10 points : une différence de 3 à 5 points de rendement entre deux modèles ne se voit pas avant plusieurs centaines de paris. Les mesures de calibration (score de Brier, log loss) convergent plus vite, parce que chaque pari apporte une information même s'il est perdu.
- **[reco]** Critère principal : la **calibration**. Quand le tipster annonce 75 %, est-ce que ça passe 75 fois sur 100 ? Elle est comparée à celle du marché, c'est-à-dire aux cotes de référence sans marge.
- **[reco]** Critères suivants : la **réussite par niveau** comparée à ce que la cote laissait espérer, puis le rendement.
- **[reco]** Afficher partout l'**intervalle** et le **nombre de paris**, jamais un classement sec sous 100 paris réglés (même règle que les sources depuis A2).

**Biais à anticiper.**
- **Corrélation [hyp. forte].** Avec le même dossier et des données publiques semblables, les modèles choisiront souvent les mêmes paris. On mesure le taux de choix communs. Un classement entre tipsters qui jouent les mêmes matchs ne dit pas grand-chose.
- **Versions qui changent [fait].** Un alias de modèle peut pointer vers une autre version du jour au lendemain. On enregistre l'identifiant exact renvoyé par l'API à chaque passage, et on ne compare que des périodes à version stable.
- **Surapprentissage par le carnet [hyp.].** Un agent qui « apprend » sur 20 paris va surréagir. Le carnet doit noter l'échantillon derrière chaque règle, et une règle ne change pas sur moins de 15 à 20 paris réglés (consigne dans le prompt).
- **Abstention stratégique.** Un tipster qui ne joue que les rares évidences aura un bon taux mais peu de paris. Le taux d'abstention et le nombre de paris sont publiés à côté de la réussite.
- **Fuite d'information.** Il n'y en a pas sur des matchs futurs. Si un tipster a la recherche web, tous l'ont, ou aucun. Sinon, la comparaison mesure l'accès à l'information, pas le raisonnement.

## 2. Modèles pour un MVP

- **[fait]** Une clé API Anthropic est déjà configurée sur Vercel (`ANTHROPIC_API_KEY`, utilisée par le Coach et la lecture de tickets).
- **[fait]** Une clé Gemini existe aussi sur Vercel (`GEMINI_API_KEY`).
- **[fait]** Pas de clé OpenAI ni OpenRouter dans le projet.

**[reco] MVP à deux tipsters IA plus la référence mécanique, pas quatre d'emblée.**
1. **Claude**, par l'API Anthropic directe, puisque la clé existe. Modèle Sonnet pour le quotidien.
2. **ChatGPT**, par l'API OpenAI (PR #3) ou par OpenRouter.
3. **Référence mécanique**, sans IA, qui sert de témoin.

Gemini et Grok viennent ensuite, quand le dispositif tourne sans incident pendant deux semaines. Quatre tipsters dès le départ, c'est quatre fois les erreurs d'intégration et le coût, pour des écarts qu'on ne pourra pas lire avant des semaines.

## 3. Équité du test

- **Dossier commun gelé [reco].** Un seul dossier par passage : matchs dans les 20 min à 10 h, cotes 1xBet et de référence relevées **dans la même réponse** (fait depuis le 22/11 sur la branche accueil), données d'analyse. Il est enregistré en JSON avec une empreinte (hash) et son heure. Tous les tipsters reçoivent le même.
- **Mêmes outils [reco].** Chaque agent a les mêmes outils de lecture :
  - fiche d'un match : forme, classement et enjeu, absents et compositions quand elles sont connues, xG, confrontations ;
  - cotes d'un match ;
  - historique de ses propres paris.

  Ce sont les fonctions déjà écrites pour le Coach et la fiche match. Aucun outil d'écriture : c'est l'orchestrateur qui enregistre.
- **Prompt commun [reco].** Une consigne commune, versionnée (`prompt_version`), avec un seul ajout par tipster : son carnet. Les règles d'usage de l'outil peuvent différer légèrement selon le fournisseur, mais pas les consignes de jeu.
- **Indépendance et verrouillage.**
  - Les tipsters tournent en parallèle sans voir les choix des autres.
  - Le choix est enregistré avant le coup d'envoi : la table `predictions` le marque « vérifié » si `logged_at` précède le match [fait].
  - Le texte complet de la décision va dans le rapport.
- **Mêmes règles de jeu [reco].**
  - Simples uniquement, mise fixe de 1 000 F.
  - 6 paris par jour au plus, 2 par niveau au plus.
  - Cote 1,10 à 3,00, sur les cotes réellement relevées.
  - Une abstention est permise et comptée.

## 4. Architecture

**[reco] Un orchestrateur, des profils, un format de sortie.**
- `scripts/tipsters-ia.ts` (orchestrateur) :
  1. construire et geler le dossier ;
  2. lancer chaque profil en parallèle, avec un délai maximal et un plafond de jetons ;
  3. valider les sorties ;
  4. enregistrer (prono dans la source du tipster, pari virtuel dans son compte robot) ;
  5. écrire un rapport par tipster.

  Un tipster en échec n'empêche pas les autres de passer.
- `src/lib/tipsters-ia/profils.ts` : liste des profils (id, nom affiché, fournisseur, modèle exact, compte robot, source, actif ou non).
- `src/lib/tipsters-ia/agent.ts` : boucle d'agent commune, une couche par fournisseur. Anthropic est déjà dans `src/lib/llm/provider.ts`. On ajoute OpenAI ou OpenRouter, au format compatible OpenAI.
- **Carnet :** une table `tipster_carnets` (profil, date, texte, version), migration additive à valider. Le carnet est réécrit au passage du matin après lecture des paris réglés de la veille.
- **Où ça tourne :** GitHub Actions, déclenché à l'heure par l'horloge Supabase (en place depuis le 22/11). Pas de limite de durée gênante, contrairement à une fonction Vercel. Il faut la clé Anthropic aussi dans les secrets GitHub [hyp. : je ne peux pas lister les secrets GitHub, à vérifier par Mounir].

**PR #3.**
- **À garder :**
  - `compteRobot` et `sessionRobot`, la généralisation des comptes robots ;
  - le schéma JSON strict ;
  - le contrôle que l'identifiant choisi existe dans le dossier ;
  - la branche de rapports séparée ;
  - le passage sans appel quand la clé manque.
- **À refaire :**
  - un seul appel sans outils ne laisse pas d'analyse possible ;
  - les 120 candidats sont triés par écart mécanique avec le marché : ça oriente le choix vers la « chasse à la cote », ce que Mounir ne veut pas ;
  - la sortie repasse par `choisir()` de la stratégie mécanique, avec son seuil de valeur et la mise Kelly : un choix du modèle peut donc être rejeté par les règles du robot ;
  - le code est spécifique à un fournisseur.

  Je propose de fusionner la partie comptes robots et de refondre le reste dans l'orchestrateur.

## 5. OpenRouter : risques opérationnels

- **Intérêt :** une clé et une facturation pour plusieurs fournisseurs, un format d'appel commun, et des crédits prépayés qui servent de plafond de dépense naturel.
- **Risques :**
  - une couche de plus en cas de panne ;
  - les limites de débit et la latence varient selon le fournisseur ;
  - des modèles retirés ou des alias modifiés ;
  - des frais sur l'achat de crédits [hyp. : montant à vérifier sur leur page tarifaire] ;
  - des données transmises à OpenRouter puis au fournisseur. Ce sont des données de matchs et de cotes, sans donnée personnelle des testeurs, donc acceptable.
  - le support des outils (appels de fonctions) varie selon les modèles [hyp. : à vérifier modèle par modèle].
- **[reco]** Claude reste en appel direct, puisque la clé existe. OpenRouter est réservé aux autres modèles, s'il simplifie vraiment l'ajout de Gemini et de Grok. Pour un seul ChatGPT, l'API OpenAI directe suffit.

## 6. Secrets, plafonds, pannes

- Les clés restent uniquement dans les secrets GitHub et Vercel, jamais dans les rapports. Les rapports ne contiennent ni clé ni en-tête.
- **Plafonds :**
  - par passage : nombre maximal d'étapes d'outils (par exemple 12) et de jetons ;
  - par mois : plafond de dépense réglé chez chaque fournisseur (console Anthropic, OpenAI, crédits OpenRouter) ;
  - un compteur de jetons dans chaque rapport, et un bilan des coûts hebdomadaire.
- **Panne d'un fournisseur :** le profil est marqué « absent » pour ce passage. Ce n'est ni une abstention ni un échec du tipster, et ce n'est pas compté dans ses statistiques.

## 7. Format de sortie et validation

Sortie stricte, au format JSON imposé :

```json
{ "paris": [{ "candidat": "C017", "probabilite": 0.78, "niveau": "Prudent", "raison": "…", "infos_utilisees": ["absents", "forme"] }],
  "abstention": "…", "carnet_proposition": "…" }
```

Contrôles du serveur :
- l'identifiant existe dans le dossier ;
- le match n'a pas commencé ;
- la cote est réellement relevée et comprise entre 1,10 et 3,00 ;
- le niveau correspond à la cote ;
- la probabilité est comprise entre 0,01 et 0,99 ;
- au plus un pari par match.

Clé d'unicité : `profil|match|marché|ligne|sélection` (même principe que `dedupe_key`). Un pari invalide est rejeté et noté dans le rapport, il n'est jamais corrigé.

## 8. Plan progressif

**Étape 1 : tipster Claude seul, une semaine.**
- Orchestrateur et agent avec outils, Claude Sonnet.
- Carnet, mise fixe de 1 000 F, 3 passages par jour.
- Rapport par passage.
- La référence mécanique continue à côté.
- **Accepté si :**
  - 7 jours sans passage en échec ;
  - chaque pari a une raison qui cite au moins une information du dossier ;
  - 0 pari invalide enregistré ;
  - coût réel mesuré et conforme à l'estimation.

**Étape 2 : ChatGPT avec le même orchestrateur.**
- **Accepté si :** mêmes critères, et le même dossier (même empreinte) a été donné aux deux.

**Étape 3 : écran de comparaison dans l'application.**
- Calibration, réussite par niveau comparée à la cote, nombre de paris, abstentions, choix communs.
- Bandeau « échantillon insuffisant » sous 100 paris.

**Étape 4 : Fusion, puis Gemini ou Grok.**
- La Fusion : chacun choisit seul, puis on garde les choix que l'autre accepte après critique.

## 9. Coût estimé [hyp. de volume]

Le tarif API de Sonnet 5.5 est de 2 $ par million de jetons en entrée et 10 $ en sortie.

Hypothèses de volume par passage :
- un dossier d'environ 30 000 jetons ;
- 8 à 12 appels d'outils, soit environ 150 000 jetons en entrée cumulés, parce que la conversation est renvoyée à chaque tour ;
- environ 8 000 jetons en sortie.

Résultat : environ 0,40 $ par passage, soit environ 1,2 $ par jour et 30 à 40 $ par mois pour 3 passages par jour. Le cache des prompts peut réduire nettement l'entrée, puisque le dossier et les consignes sont répétés d'un tour à l'autre.

Le chiffre réel sera mesuré pendant l'étape 1. Aucune dépense ne sera engagée sans l'accord explicite de Mounir.

## 10. À vérifier avant d'écrire la moindre ligne

1. Mounir valide la dépense de l'étape 1 et le modèle (Sonnet).
2. La clé Anthropic est présente dans les secrets GitHub, ou Mounir l'y ajoute lui-même.
3. Un plafond de dépense mensuel est réglé dans la console Anthropic.
4. Le compte API Pro API-Football, d'où viennent la cote 1xBet, les absents et les compositions, expire le 11/12. Sans renouvellement, les tipsters IA perdent l'essentiel de leurs données.
