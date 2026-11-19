# Betster réel : étude comparative et recommandation

19/11, 17 h. Réponse à l'audit de ChatGPT (`docs/audit/2026-11-19-audit-ux-et-betster-reel.md`). Aucune dépense engagée, aucun compte créé, aucune intégration. Prix relevés le 19/11 sur les pages des fournisseurs ou, quand c'est indiqué, sur des comparatifs ; à revérifier au moment de souscrire.

## 1. Ce que je reconnais

L'audit a raison : ce qui est en place sur `accueil` est une animation CSS d'une image fixe (respiration, inclinaison, halo calé sur le niveau de la voix). Ce n'est pas un personnage incarné. Je ne l'appellerai plus « Betster animé » sans préciser « animation du portrait ». Le brief de variantes PNG (`variantes-expressions-brief.md`) devient une solution de repli, pas la cible.

## 2. État des branches (point 1 de l'audit)

- `accueil` : 8 commits devant `main`, 0 derrière. Code uniquement, plus les migrations 0051 et 0052, **déjà appliquées en production avec l'accord de Mounir** (16 h 15 et 16 h 22) : la base est en avance sur `main`. Ces migrations sont additives ; l'application en production ne les utilise pas tant que `accueil` n'est pas fusionnée.
- `design-accueil` : documents, maquettes et référence Betster uniquement.
- Aucun fichier modifié des deux côtés : les deux branches peuvent être fusionnées dans `main` séparément, sans conflit. Ordre proposé, chacun sur Ok de Mounir : `design-accueil` (documents) puis `accueil` (code) après vérification de l'aperçu connecté.

## 3. Les deux approches

### A. Personnage 3D temps réel

Principe : un modèle 3D riggé (visage à formes de bouche, squelette pour tête, buste, bras, mains), animé dans le navigateur (Three.js). La bibliothèque libre TalkingHead fait déjà la synchronisation labiale, les expressions et les gestes à partir d'une voix et de ses visèmes.

| Critère | Constat |
| --- | --- |
| Fidélité au portrait | Faible à moyenne sans travail sur mesure : il faut faire modéliser Betster en 3D par un artiste (visage, tenue, casquette, casque audio, logo). Le rendu restera « 3D de jeu vidéo », pas photoréaliste |
| Bouche, expressions, gestes | Bons et entièrement pilotables (on décide quand il sourit, montre l'écran, etc.) |
| Interaction en direct | Oui, latence quasi nulle : rendu sur le téléphone |
| Coût récurrent | Aucun par minute (seulement la voix, déjà en place) |
| Coût de création | Modélisation et rig sur mesure : devis d'artiste à demander, je ne donne pas de chiffre sans devis |
| Téléphones Android moyens | Risque réel : WebGL, modèle de plusieurs Mo, batterie. À mesurer |
| Réseau lent | Bon après le premier chargement (modèle mis en cache) |
| Dépendance | Faible : les fichiers 3D nous appartiennent |

### B. Humain numérique photoréaliste généré à partir de l'image

Principe : un service anime le portrait validé (une seule image suffit chez plusieurs fournisseurs) et diffuse une vidéo générée en direct (WebRTC) ou des clips pré-rendus.

| Fournisseur | Depuis une image | Gestes | Direct | Prix relevé | Remarques |
| --- | --- | --- | --- | --- | --- |
| Runway Characters | Oui, photoréaliste ou illustré | Mains et corps annoncés | Oui | 2 crédits par 6 s, 1 crédit = 0,01 $ → environ 0,20 $/min | Sessions de 5 min max selon un répertoire d'API |
| HeyGen LiveAvatar | Oui | Gestes annoncés | Oui | Formule à 99 $/mois (1 100 crédits) ; 1 crédit = 30 s en mode complet ou 1 min en mode « avatar seul » | Le mode « avatar seul » garde notre Coach et notre voix |
| Anam | Oui | Visage surtout | Oui | Gratuit 30 min (usage commercial exclu) ; 12 $/mois → 50 min puis 0,16 $/min | Le plus simple pour un prototype gratuit |
| LemonSlice | Oui, y compris illustré | « Parle avec les mains » par consigne | Oui | 8 $/mois → 41 min puis 0,22 $/min | Droits commerciaux non précisés sur la page |
| HeyGen (clips) | Oui (Photo Avatar) | Selon le moteur | Non, pré-rendu | Avatar IV Photo Avatar : 3 $ la minute de vidéo | Réutilisable en publicité |
| Google Gemini Live Avatar | Avatar personnalisé soumis à approbation de Google | — | Oui | Environ 0,39 $/min de parole (estimation d'un comparatif) | Réservé à Gemini Enterprise ; sessions courtes |
| Tavus | Plutôt à partir d'une vidéo (« replica ») | Oui | Oui | 59 $/mois puis environ 0,35 $/min (comparatifs) | Moins adapté : Betster n'existe qu'en image |

Points communs : fidélité élevée au portrait (c'est l'image elle-même qui est animée), latence annoncée sous la seconde, coût à la minute, dépendance au fournisseur (l'avatar ne s'exporte pas), conditions d'usage à lire avant toute souscription (le portrait est une image générée qui porte le logo BETWISE : vérifier que la marque et un personnage non réel sont acceptés).

## 4. Ordre de grandeur pour BETWISE

Hypothèse de test : 20 testeurs, 5 réponses lues par jour chacun, 30 s par réponse, soit environ 1 500 min de vidéo par mois.

- Tout en direct à 0,16–0,22 $/min : **240 à 330 $ par mois** pour 20 testeurs ; proportionnel ensuite au nombre d'abonnés. Pas tenable en accès gratuit illimité.
- Un clip quotidien commun (« Betster présente les matchs du jour », 60 s, pré-rendu une fois pour tous) : environ **3 $ par jour**, quel que soit le nombre d'abonnés, réutilisable en publicité.

## 5. Recommandation

Un modèle **hybride, approche B** :

1. **Clip du jour pré-rendu** en tête de l'accueil : Betster présente les matchs et les propositions, texte écrit à partir des vraies données, sous-titré, coupé par défaut. Coût fixe et faible, fidélité maximale, réutilisable en publicité.
2. **Betster en direct** seulement quand l'abonné ouvre la conversation en mode vidéo, avec un quota (par exemple quelques minutes par jour pendant le test) et un repli automatique sur le portrait et la voix actuels en réseau lent.
3. L'approche A (3D) n'est pas retenue pour l'instant : elle demande une modélisation sur mesure, s'éloigne du portrait validé et pèse sur les téléphones moyens. À rouvrir si les coûts à la minute deviennent bloquants.

## 6. Prototype (point 6 de l'audit)

Je propose de tester **deux fournisseurs** sur le même texte de 25 s en français, avec le portrait validé :

- Anam (formule gratuite, suffisante pour un prototype non commercial) ;
- Runway Characters ou HeyGen (gestes des mains annoncés), quelques dollars de crédits.

Critères : bouche fidèle à la parole, clignements, au moins deux gestes, passage neutre → concentré → accueillant, synchronisation voix et sous-titres, lecture sur un Android de milieu de gamme. Les deux vidéos sont montrées à Mounir avant toute décision.

**Ce qu'il faut de Mounir** : choisir les deux fournisseurs, créer les comptes (je ne peux pas le faire), mettre les clés dans Vercel (jamais dans la conversation), fixer un plafond de dépense pour le prototype.

## Sources

- Anam, tarifs : https://anam.ai/pricing
- LemonSlice, tarifs : https://lemonslice.com/pricing ; API : https://lemonslice.com/avatar-api
- HeyGen LiveAvatar : https://help.heygen.com/en/articles/12758516-introducing-liveavatar ; tarifs API : https://help.heygen.com/en/articles/10060327-heygen-api-pricing-explained
- Runway Characters : https://runway.com/ja/product/characters ; https://runway.com/ko/product/characters ; https://runwayml.com/news/introducing-runway-characters
- Comparatif temps réel (Gemini, Runway, HeyGen) : https://www.creativeainews.com/articles/real-time-ai-avatars-gemini-meta-runway-heygen-2026/
- Tavus (comparatif) : https://usagepricing.com/blueprint/tavus
- TalkingHead : https://github.com/met4citizen/talkinghead
