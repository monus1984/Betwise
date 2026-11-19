# Audit indépendant — expérience BETWISE et exigence Betster animé

Date : 19 novembre 2026
Périmètre : branches `accueil` et `design-accueil`, documents de bilan et fichiers applicatifs consultés via GitHub.
Statut : audit documentaire et lecture de code ciblée ; pas une recette complète de l'application connectée.

## 1. État des branches

- `main` : référence de départ observée au commit `6b9e1d2`.
- `accueil` : 7 commits en avance sur `main`. La comparaison contient des changements applicatifs (pages, composants, logique métier, tests) ainsi que les migrations `0051_montantes.sql` et `0052_montante_rattacher.sql`.
- `design-accueil` : 24 commits en avance sur `main`. La comparaison consultée porte sur des documents, maquettes et ressources de référence ; elle n'intègre pas les changements applicatifs de la branche `accueil`.
- Aucune pull request n'a été retrouvée dans la recherche effectuée. Les deux branches restent donc à traiter séparément ; ne pas supposer que les travaux de `accueil` sont déjà dans `design-accueil` ou dans `main`.

## 2. Travaux applicatifs identifiés sur `accueil`

La comparaison GitHub confirme des modifications sur :
- accueil et chargement des données ;
- profils de propositions et composants de cartes ;
- navigation et accès Coach ;
- tableau de bord Coach ;
- import/ajout de paris ;
- analyse des sources ;
- justification statistique des matchs ;
- gestion des montantes ;
- animation actuelle du portrait Betster ;
- migrations de base de données 0051 et 0052.

Les bilans Claude documentent des tests automatisés et des vérifications locales. Cela constitue une preuve de travail réalisé, mais pas une validation complète en conditions réelles. Plusieurs écrans connectés et le temps de chargement sur réseau mobile étaient explicitement signalés comme non vérifiés.

## 3. Points de vigilance produit et UX

1. L'accueil Prédictions est mieux orienté vers les propositions, mais sa qualité finale doit être jugée sur un téléphone, avec des données réelles et sur une connexion mobile moyenne.
2. La recherche de match n'existe pas encore selon l'audit de Claude.
3. La fiche match approfondie (statistiques, analyse, marchés, sources) reste un lot distinct.
4. Les marchés joueurs ne doivent pas être proposés comme prédictions calculées tant que les données et modèles requis ne sont pas disponibles.
5. Les montantes existent désormais dans le code et les migrations de la branche `accueil`. Il faut tester les cas d'échec, l'arrêt volontaire, la perte d'un palier, les paris annulés/remboursés et les probabilités cumulées. Ne jamais présenter une montante comme une méthode fiable de profit.
6. Les affirmations de tests doivent être reliées à leur branche et commit exacts. Un test réussi ne prouve pas qu'un écran a été validé par un utilisateur connecté.

## 4. Audit précis de Betster actuel

Lecture du code de `src/components/betster-anime.tsx`, `src/components/betster-fab.tsx`, `src/lib/coach/speak.ts` et des règles CSS sur la branche `accueil`.

Ce qui existe :
- une image WebP fixe `/betster/betster-112.webp` ;
- des animations CSS de respiration, rotation légère, agrandissement et halo ;
- un état visuel « repos / pense / parle » ;
- une enveloppe sonore calculée à partir de l'audio TTS pour faire varier l'échelle et la rotation du portrait ;
- une voix TTS serveur avec repli sur la voix du téléphone ;
- un bouton flottant qui ouvre la conversation du Coach.

Ce qui n'existe pas dans le code inspecté :
- modèle 2D riggé ou modèle 3D du personnage ;
- animation du visage indépendante de l'image ;
- ouverture/fermeture réelle de la bouche synchronisée aux phonèmes ;
- expressions faciales réellement animées ;
- tête, épaules, bras et mains animés avec une gestuelle naturelle ;
- personnage vidéo photoréaliste ou avatar temps réel ;
- interaction audiovisuelle continue où le personnage écoute, répond et réagit comme un présentateur virtuel.

**Conclusion : l'implémentation actuelle anime le cadre et transforme légèrement une image fixe. Elle ne répond pas à la demande d'un personnage IA réaliste et incarné.** Il ne faut plus appeler cela « personnage animé » sans préciser qu'il s'agit d'une animation CSS du portrait.

## 5. Nouvelle exigence produit — Betster doit devenir un véritable personnage IA

La demande de Mounir est explicite : il veut un personnage virtuel réaliste, vivant, animé, qui donne l'impression d'une personne présente à l'écran — pas une image fixe avec un halo ou un zoom.

### Résultat attendu

Betster doit devenir un présentateur/analyste virtuel crédible, basé sur le portrait de référence validé, capable de :
- parler avec une voix cohérente et reconnaissable ;
- synchroniser précisément les lèvres avec la parole ;
- cligner naturellement des yeux et produire des expressions faciales nuancées ;
- bouger la tête, le buste, les épaules, les bras et les mains ;
- accompagner ses analyses avec une gestuelle naturelle et pertinente ;
- écouter, réfléchir, prendre la parole et terminer sa réponse avec des états visuels distincts ;
- présenter les analyses de matchs et les recommandations dans l'application ;
- être réutilisé dans les publicités vidéo digitales et les démonstrations du produit.

Le visage, la tenue, les couleurs et les attributs distinctifs doivent rester fidèles à l'image de référence expressément validée par Mounir. Aucun changement de visage ou nouvelle direction artistique sans validation.

### Ce qui ne constitue PAS une livraison acceptable

- agrandir/réduire une image ;
- faire tourner un halo autour d'un portrait ;
- faire pivoter légèrement une image entière ;
- alterner quelques PNG de bouche sans continuité convaincante ;
- présenter une voix TTS seule comme un personnage animé ;
- générer une vidéo promotionnelle isolée qui ne peut pas être réutilisée dans l'application.

Ces techniques peuvent servir de prototype transitoire, mais ne satisfont pas le besoin final.

### Pistes techniques à étudier et comparer

Claude doit étudier au minimum deux approches, sans choisir un fournisseur avant d'avoir comparé le résultat :

A. **Personnage 3D réaliste temps réel** : modèle humain 3D, rig facial et corporel, animation des lèvres, expressions et gestes. Examiner les possibilités d'intégration web/mobile, le poids, le rendu sur Android milieu de gamme et le coût de production.

B. **Humain numérique photoréaliste / vidéo générée** : personnage rendu à partir du portrait validé, avec synchronisation labiale et gestes. Déterminer si l'approche peut fonctionner de façon interactive dans l'application ou seulement sous forme de clips pré-rendus. Ne pas confondre une vidéo préfabriquée avec un avatar conversationnel temps réel.

Pour chaque approche, documenter :
- fidélité au portrait de référence ;
- réalisme du visage, de la bouche et des gestes ;
- interaction en direct ou lecture de clips pré-rendus ;
- latence entre réponse du Coach et prise de parole ;
- compatibilité navigateur/PWA/iOS/Android ;
- consommation de données, batterie et puissance ;
- fonctionnement en réseau lent et solution de repli ;
- coût de création, coût par minute ou par interaction ;
- droits commerciaux, confidentialité et conditions d'utilisation ;
- dépendance au fournisseur et possibilité d'exporter les assets.

Ne pas présumer qu'un fournisseur autorise l'usage commercial, la création à partir d'une image ou le déploiement dans une application. Vérifier les conditions officielles avant recommandation.

## 6. Prototype exigé avant intégration

Avant de développer l'intégration complète, produire un prototype démontrable avec le portrait de référence :

1. Betster en plan buste, face caméra.
2. Il prononce un texte d'analyse d'environ 20 à 30 secondes en français.
3. Les lèvres suivent réellement la parole.
4. Il cligne des yeux, bouge légèrement la tête et utilise au moins deux gestes naturels.
5. Il passe d'une expression neutre à une expression concentrée puis accueillante.
6. La voix, le mouvement et les sous-titres restent synchronisés.
7. Le rendu est évalué sur un téléphone Android de milieu de gamme.

Le prototype doit être montré à Mounir pour validation visuelle et comportementale avant toute intégration produit ou dépense récurrente.

## 7. Plan d'action demandé à Claude

1. Confirmer l'état exact des branches et commits ; clarifier comment les changements de `accueil` seront intégrés au flux de travail sans écraser les documents de `design-accueil`.
2. Terminer la revue UX de l'accueil et des fiches matchs séparément de la production du personnage.
3. Réaliser une étude comparative des deux approches d'avatar réaliste décrites ci-dessus.
4. Présenter une recommandation argumentée avec coûts, limites et dépendances.
5. Produire un prototype court de Betster réaliste, parlant et gestuel, à partir du portrait validé.
6. Attendre la validation explicite de Mounir avant de retenir un fournisseur, engager des frais, modifier l'apparence du personnage ou intégrer le système en production.

Aucune migration, écriture en base, fusion de branche ou déploiement n'est autorisé par ce brief.

## 8. Critère d'acceptation final

La question n'est pas « est-ce que l'image bouge ? ». La question est : **« Est-ce que l'utilisateur a réellement l'impression qu'un analyste virtuel est présent, qu'il lui parle, le regarde, explique les matchs et accompagne ses propos avec des gestes naturels ? »**

Si la réponse est non, Betster n'est pas encore livré.
