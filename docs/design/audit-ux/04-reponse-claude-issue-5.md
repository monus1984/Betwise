# Réponse de Claude à l'issue #5 : audit global, constats et plan

Date : 22 novembre 2026, 21 h. Base : le rapport du robot de **20 h 56** (le plus récent, branche `audit-ecrans`), comparé à celui de 17 h 50 cité dans l'issue. Plusieurs corrections ont été déployées entre les deux.

Légende :
- **[rapport]** : mesuré par le robot ;
- **[code]** : confirmé en lisant le code ou la base ;
- **[hyp.]** : hypothèse à vérifier ;
- **[corrigé]** : déjà en production.

## 1. Les sept constats, vérifiés

| # | Constat de l'issue | État à 20 h 56 | Verdict |
|---|---|---|---|
| 1 | Contrôles imbriqués dans Matchs | 14 états, 26 cas par liste [rapport]. L'étoile `CompFavori` est un bouton placé dans le `<summary>` d'un `<details>` (`src/app/(app)/matchs/page.tsx`) [code] | **Confirmé** |
| 2 | Erreur d'hydratation n° 418 | 0 sur 16 chargements à 20 h 56, 1 sur 16 à 17 h 10, 2 sur 45 le matin [rapport]. En mode développement, qui nomme le composant fautif : 0 sur 24 [rapport, sonde du 22/11 20 h 38] | **Intermittent, cause inconnue** |
| 3 | Libellés de marchés tronqués | Marchés : 27 → **0**, match terminé : 31 → **1** [rapport] | **[corrigé]** à 19 h 25 (boutons de cote sur deux lignes) |
| 4 | Débordement à 320 px | Il ne reste que **Prédictions (21 px)**. Analyse, Marchés et Nouveau pari ne débordent plus [rapport]. 44 cibles tactiles sous 44 px sur l'accueil [rapport] | **Confirmé, réduit** |
| 5 | Betster recouvre des éléments | Le bouton « Parier sur ce match » est recouvert sur les 6 onglets de la fiche match, et l'aide est recouverte sur Prédictions et Matchs [rapport] | **Confirmé** |
| 6 | Contraste | 5 écrans en clair, aucun en sombre [rapport]. Trois causes [code] : (a) le texte `text-draw` (#A16207) sur `bg-draw-soft` donne 4,45:1 au lieu de 4,5 minimum, sur les pastilles « Équilibré » et le mot « incertain » ; (b) `text-slate-400` sur la note du Coach donne 4,16 ; (c) `opacity-70` sur les bornes des boutons de niveau d'Options donne 4,0 (introduit le 22/11 par le lot C) | **Confirmé** |
| 7 | Performance de l'accueil | Médiane 1,9-2,0 s → **1,45 s**, pire 3,0 → 2,4 s sur 16 chargements, à charge égale [rapport]. Les requêtes sont lancées ensemble, et les options communes sont gardées 60 s | **[corrigé] en partie** ; à remesurer un matin chargé |

## 2. Les vérifications produit

- **Prudent / Équilibré / Audacieux.** Les niveaux ne dépendent que de la cote affichée, avec les mêmes bornes partout depuis le lot C. Un test interdit « sûr », « garanti » et « sans risque » dans les textes (`src/lib/vocabulaire.test.ts`) [code]. Il manque une phrase visible près des niveaux, par exemple : « le niveau dit ce que paie la cote, pas ta chance personnelle de gagner » [reco].
- **Fiches de source.**
  - Déjà en place [code] : le statut « Provisoire » ou « Confirmé » avec un seuil à 30 pronos réglés, aucun rendement affiché sous 5 pronos, et l'étiquette « Chargé avant le match » ou « après le match » sur chaque prono.
  - À ajouter [reco] : la période couverte, et une ligne « X pronos déclarés, Y réglés, Z vérifiés avant le match » en tête de fiche.
- **Garde-fou du Coach.** **Confirmé et volontaire**, mais à trancher par Mounir. Quand le budget est atteint, la consigne dit : « dis-le en une ligne, puis propose quand même, la décision lui appartient » (`src/lib/coach/prompt.ts` l. 27, `tools.ts` l. 102) [code]. L'avertissement existe, mais une proposition le suit aussitôt. Je propose de garder l'avertissement en tête et de **ne proposer qu'à la demande explicite** de l'utilisateur une fois le budget atteint [reco].
- **Tipster codé ou tipster IA.** **[corrigé]** : le robot à règles s'appelle désormais « Tipster BETWISE (règles) ». Les tipsters IA, avec leur source, leur compte robot et leur carnet, tournent depuis le 22/11 au soir.

## 3. Plan priorisé

### P0 : cette semaine, petits correctifs visibles

| Action | Fichiers | Risque | Tests |
|---|---|---|---|
| **Betster contextuel :** masqué quand l'aide ou le coupon est ouvert ; remonté au-dessus de la barre « Parier sur ce match » sur la fiche match | `components/betster-fab.tsx`, `components/aide.tsx`, `matchs/[id]/page.tsx` | Faible. Betster ne doit pas disparaître ailleurs | Robot : `betster.fixes` = 0 sur les 115 états |
| **Étoile hors du `<summary>`** : la ligne devient un conteneur avec deux zones, l'ouverture d'un côté et l'étoile de l'autre | `matchs/page.tsx`, `components/comp-favori.tsx` | Moyen. Il faut garder l'ouverture au toucher et le favori | Robot : `nested-interactive` = 0, captures 02 et 02b |
| **Contraste :** jeton `text-draw-ink` sur les pastilles Équilibré, `text-ink-muted` au lieu de `slate-400`, bornes d'Options sans `opacity-70` | `coach/categories.ts` (CAT_STYLE), `components/ui.tsx`, `coach/chat.tsx`, `options/options-view.tsx` | Faible | `theme.test.ts`, robot : `color-contrast` = 0 dans les deux thèmes |
| **Prédictions à 320 px :** trouver l'élément de 21 px trop large | `components/accueil.tsx` ou `proposition.tsx` [hyp.] | Faible | Robot, passage « petit » |

### P1 : ensuite

- **Cibles tactiles de l'accueil.** Il y en a 44 sous 44 px. Agrandir les liens et boutons principaux, garder les liens de texte tels quels. Fichiers : `components/accueil.tsx`, `proposition.tsx`.
- **Garde-fou du Coach**, selon la décision de Mounir. Fichiers : `coach/prompt.ts`, `tools.ts`. Test : une conversation simulée avec le budget atteint.
- **Fiche source :** période couverte et ligne « déclarés, réglés, vérifiés ». Fichier : `sources/[id]/page.tsx`.
- **Hydratation :**
  - garder la mesure sur 16 chargements à chaque passage du robot ;
  - si l'erreur revient, ajouter en production un rapporteur d'erreurs d'hydratation qui envoie le chemin et l'heure (sans donnée personnelle) ;
  - **[hyp.]** la cause pourrait être un écart de version entre le HTML et le code JavaScript, juste après un déploiement : deux des trois occurrences ont été relevées moins de 15 minutes après une mise en production.
- **Derniers textes coupés.** Noms longs dans le classement (Brighton & Hove Albion), et noms de match dans la liste des paris test.
- **Accueil plus court**, 10,8 écrans de haut. Replier le « pourquoi » des cartes, et charger « Demain » et les tipsters après le premier affichage.

### P2 : hygiène

D'après les conseils de sécurité de Supabase (22/11, 21 h) [rapport] :
- **Trois fonctions sans `search_path` fixe :** `bootstrap_ci`, `max_drawdown`, `ticket_fingerprint`. C'est une migration additive : `alter function … set search_path`.
- **`pg_net` installé dans le schéma `public`.** Le déplacer demande de vérifier les appels de l'horloge et de `tick_live` : à planifier, pas urgent.
- **Protection contre les mots de passe divulgués désactivée.** C'est une case à cocher dans le tableau de bord Supabase, à faire par Mounir.
- **`is_admin()` appelable sans connexion.** Elle renvoie faux pour un visiteur, donc le risque est faible. On peut retirer le droit aux anonymes.
- **26 fonctions `SECURITY DEFINER` ouvertes aux utilisateurs connectés.** C'est voulu : ce sont les actions de l'application, et chacune vérifie `auth.uid()`. Je les ai relues par échantillon (`tts_take`, `settle_bet`), il n'y a rien à signaler. Une relecture complète reste à faire.

## 4. Ce que le robot ne couvre pas

- **Parcours d'inscription** d'un nouveau testeur, jusqu'au premier pari test. Le robot utilise un compte déjà créé.
- **Notifications** : abonnement, réception, désinscription. Elles ne sont pas testables sans un vrai téléphone.
- **Hors ligne et installation de la PWA**, en particulier sur iPhone.
- **Tipsters IA :**
  - leurs carnets et rapports ne sont visibles que sur GitHub. Aucun écran ne les montre encore à Mounir ;
  - il faut suivre le coût de chaque passage, en jetons, dans les rapports.
- **Données :**
  - la fiabilité des résultats dépend de deux fournisseurs. Le 22/11, trois matchs sont repassés « programmés » à cause de l'import de football-data, corrigé le jour même. Le robot ne vérifie pas que les matchs passés sont tous réglés ;
  - je propose d'ajouter au robot le contrôle « aucun match non terminé plus de 3 h après son coup d'envoi ».
- **Abonnement API-Football Pro** (fin le 11/12). Il fournit la cote 1xBet, le direct, les absents et les compositions. Sans renouvellement, une grande partie de l'application et tous les tipsters IA perdent leurs données.

## 5. Méthode

Chaque correctif P0 est préparé sur la branche `accueil`, vérifié par les tests et le robot, puis présenté à Mounir. Rien n'est fusionné sur `main` sans son accord, comme le demande l'issue. Aucun service payant n'est ajouté.
