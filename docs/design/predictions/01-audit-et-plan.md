# Accueil Prédictions — audit et plan d'intervention

19 novembre 2026, 15:40. Suite au retour de Mounir sur la première version (« assez déçu ») et aux consignes déposées par ChatGPT à 15:16 : `CLAUDE.md` et `docs/product/architecture-ux-predictions-coach-betster.md`.
Version jugée : branche `accueil`, commit `40c372a` (non fusionnée).

## 1. Écart entre la première version et les consignes

| Consigne | Première version (`accueil`) | Écart |
| --- | --- | --- |
| Prédictions = premier onglet et écran d'entrée ; 4 onglets : Prédictions, Matchs, Coach, Sources | 5 onglets : Accueil, Prédictions, Mes paris, Tipsters, Coach | Structure de navigation différente |
| Betster en haut : message d'accueil et synthèse utile | Betster dans une carte « avis du jour » ; absent un jour creux sauf dans la carte de repli | Pas de synthèse de la journée |
| Meilleures options du jour, par profil Prudent / Équilibré / Audacieux | Un seul coup du jour mis en avant, les autres derrière un lien | Les 9 coups du jour existent mais ne sont pas montrés |
| Propositions pour demain et les jours à venir | Seulement en jour creux (3 lignes) | Demain absent les jours de match |
| Plusieurs matchs, avec des propositions par niveau de risque | Une sélection par match | Une seule option par match |
| Accès rapide au Coach : bankroll, objectifs, stratégies, discussion | Une grande carte bankroll | Trop financier, pas de raccourcis |
| Aucun écran mort ; heure de mise à jour visible | Jour creux minimal ; pas d'heure de mise à jour globale | L'accueil du 19/11 (jour sans match) paraît vide |
| Qualité visuelle « aboutie », dépasser les concurrents | Les cartes et la densité de l'ancienne application, réordonnées | Rendu trop proche de l'existant |

## 2. Ce qui existe et peut être réutilisé

| Besoin | Existant | État |
| --- | --- | --- |
| Propositions par niveau de risque | Coups du jour : 3 sélections par catégorie (Sûr, Audacieux, Risqué) chaque matin, sur 24 h, avec cote de référence (`src/lib/coach/daily.ts`, `categories.ts`) ; réussite constatée sur 4 004 matchs : 88 %, 76 %, 59 % | Opérationnel ; à renommer à l'écran |
| Plusieurs options par match | Moteur d'options (`src/lib/options/`) : par période (aujourd'hui, demain, 48 h), probabilité, cote, source marché ou modèle, familles résultat, buts, mi-temps, combinés | Opérationnel (écran Options du Coach) |
| Matchs de demain | `loadOptions(db, "demain")`, `loadRepli` | Opérationnel |
| Analyse argumentée d'un match | Récit en étapes (`src/lib/matches/recit.ts`) : enjeu, forme, dernier match, face-à-face, joueur du moment, chiffre clé, verdict | Opérationnel, un match à la fois (coûteux en série) |
| Cote par bookmaker et heure | Cotes 1xBet, heure du relevé, 42 marchés | Opérationnel |
| Coach : bankroll, budget, objectifs, conversation | Pages Bankroll, Coach (outils, budget), conversation | Opérationnel |
| Stratégies, montantes | — | **N'existe pas** (étape 4 de la feuille de route) |
| Navigation Matchs par date et championnat | Bandeau des jours, filtres de compétition, en direct, suivis | Opérationnel |
| Recherche d'équipe ou de match | — | **N'existe pas** |
| Noms d'équipes complets | Noms raccourcis et coupés (`shortName`, `truncate`) dans la liste des matchs | À corriger (étape 3) |
| Betster animé et parlant | Image fixe, voix Gemini plafonnée à 10 lectures par jour | P2 : cadrage technique, pas maintenant |
| Matchs africains et ivoiriens | Calendrier et scores, ni cote ni modèle | Limite de données, affichée honnêtement |

## 3. Plan proposé pour la refonte P0 (accueil Prédictions uniquement)

1. **Navigation à quatre onglets** : Prédictions (écran d'entrée, `/`), Matchs (`/matchs`), Coach, Sources. Routes inchangées. « Mes paris » sort de la barre : accessible depuis le Coach et depuis un bloc « Mes paris en cours » de l'accueil.
2. **Bandeau Betster en tête** : portrait, salutation, synthèse calculée de la journée (« 4 matchs analysés aujourd'hui, 9 propositions ; demain, 12 matchs »), heure de la dernière mise à jour, bouton « Parler à Betster » (conversation du Coach).
3. **Meilleures options du jour, par profil** : trois onglets Prudent, Équilibré, Audacieux, trois propositions chacun, issues des coups du jour existants (Sûr → Prudent, Audacieux → Équilibré, Risqué → Audacieux) ; chaque proposition : marché, probabilité, cote et bookmaker, heure du relevé, risque dit en clair (« perd N fois sur 100 »), réussite constatée de la catégorie sur 4 004 matchs. Jamais « sûr ».
4. **Matchs du jour avec plusieurs propositions** : pour chaque match, jusqu'à trois options du moteur d'options (une par profil quand elles existent), puis « Voir toutes les options » vers la fiche. Noms d'équipes en entier, sur deux lignes si besoin.
5. **Demain et les prochains jours** : toujours présent sous les matchs du jour ; remonte en tête quand aujourd'hui est maigre.
6. **Raccourcis Coach** : une rangée compacte (Bankroll, Budget et objectifs, Mes paris, Parler à Betster), avec le point de vigilance s'il y en a un, montants masquables. « Stratégies / montantes » n'apparaît pas tant qu'elles n'existent pas.
7. **Aucun écran mort** : aujourd'hui → demain → 48 h → prochains matchs couverts ; plus l'import et le bilan d'hier quand il existe.
8. Justification courte d'une proposition : en P0, la source du chiffre (marché et modèle, marché seul) et la réussite constatée de son niveau de risque ; l'argument tiré du récit (forme, face-à-face) en P1, parce qu'il coûte une analyse complète par match.

Hors de ce lot : fiche Matchs (étape 3), catalogue de marchés (étape 4), Coach complet et montantes (étape 5), Betster animé (étape 6).

## 4. Décisions à prendre

| N° | Question | Recommandation |
| --- | --- | --- |
| D14 | « Mes paris » quitte la barre d'onglets : bloc sur l'accueil et accès depuis le Coach | Oui |
| D15 | Profils de risque : Sûr → Prudent, Audacieux → Équilibré, Risqué → Audacieux, partout dans l'application | Oui |
| D16 | La première version (`accueil`) sert de base : on garde le chargement, les règles testées, l'avatar et le masquage des montants, on refait la page et la navigation | Oui |
