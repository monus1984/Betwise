# Audit de l'accueil actuel — 19 novembre 2026

État relevé dans le code (`main`, commit `6b9e1d2`) et en base (lecture seule). Les chiffres de couverture datent du 19/11 au matin.

Captures de l'accueil actuel : `docs/captures/accueil-clair.png`, `docs/captures/accueil-sombre.png` (16/11, avant les derniers ajustements).

## 1. Ce que montre l'accueil aujourd'hui

L'accueil actuel est un tableau de bord de bankroll. Il ne montre aucun match et aucune prédiction.

| Ordre | Bloc | Contenu | Lien |
| --- | --- | --- | --- |
| 1 | En-tête | Logo, nom, cloche (notifications non lues), réglages | — |
| 2 | Salutation | « Bonjour [pseudo] », « Ton aperçu du jour » | — |
| 3 | Carte bankroll | Solde, courbe des 30 derniers résultats, gain ou perte sur 7 jours, solde par bookmaker | Bankroll |
| 4 | Trois tuiles | En jeu, rendement, paris gagnés (avec le taux attendu) | Mes paris, Bilan |
| 5 | Points de vigilance | Deux au plus, déclenchés par des règles fixes : budget de la semaine, série de pertes, combinés trop longs | Coach, Bilan |
| 6 | À faire | Résultats à confirmer, paris à régler à la main, solde à comparer au bookmaker | Mes paris, Bankroll |
| 7 | Que veux-tu faire ? | Scanner un ticket, Analyser un match, Comparer mes sources, Parler au coach | Import, Matchs, Sources, Coach |
| 8 | Mes sources suivies | Quatre sources au plus, avec leur note | Sources |
| 9 | Installer l'application | Bouton PWA | — |

Ce qui manque au regard de la nouvelle vision : les matchs du jour, les probabilités, les coups du jour (qui vivent dans le Coach), la moindre présence de l'IA. L'écran parle d'argent avant de parler de football.

## 2. Navigation

- **Barre du bas, cinq onglets :** Accueil, Matchs, Sources, Mes paris, Coach.
- **Bouton flottant :** ajouter un pari ou importer un ticket. L'import est donc accessible partout, mais il n'est pas visible en tant que tel.
- **Coupon en cours :** barre au-dessus des onglets. On y ajoute des sélections depuis les matchs ou les coups du jour, avec la cote combinée.
- La feuille de route prévoit de renommer Matchs en Prédictions. Ce n'est pas fait.

## 3. Composants existants réutilisables

| Composant | Rôle | Fichier |
| --- | --- | --- |
| `TeamBadge` | Écusson rond à initiales (pas de logo de club) | `src/components/match-ui.tsx` |
| `ProbCells` | Trois cases 1 / N / 2, la plus probable mise en avant | idem |
| `PickBadge` | Issue la plus probable, sa probabilité, la cote, l'avis du modèle s'il diverge | idem |
| `CoupsDuJour` | Coups du jour rangés en Sûr / Audacieux / Risqué, mise conseillée, ajout au coupon | `src/app/(app)/coach/coups-du-jour.tsx` |
| `MatchRecit` | Analyse d'un match en étapes, lue à voix haute | `src/components/match-recit.tsx` |
| `Sparkline`, `LineChart` | Courbes | `src/components/` |
| `AddToSlip`, `SlipBar` | Coupon | `src/components/slip.tsx` |
| `LiveRefresh`, `GoalWatcher` | Scores en direct, alerte de but | `src/components/` |
| `Card`, `Chip`, `Badge`, `Empty`, `Notice` | Briques de base | `src/components/ui.tsx` |

Il n'y a pas de bibliothèque d'interface : tout est en Tailwind, avec des couleurs nommées par rôle.

## 4. Fonctions opérationnelles

| Fonction | État | Précision |
| --- | --- | --- |
| Probabilités par match | En production | Tirées des cotes de référence sans la marge du bookmaker, avec le modèle de Poisson (5 grands championnats) en second avis ; sur 4 004 matchs, l'écart entre annoncé et arrivé reste sous 1 point |
| Probabilités sur 93 marchés | En production | Dont mi-temps, buts d'une équipe, combinés ; les marchés de statistiques et de joueurs n'ont pas de probabilité |
| Coups du jour | En production | Chaque jour, trois catégories selon la cote ; 46 gagnés sur 53 réglés en 6 jours, trop peu pour conclure |
| Analyse d'un match | En production | Récit en étapes (enjeu, forme, dernier match, face-à-face, joueur du moment, chiffre clé, verdict), écrit par des règles et non par un modèle de langage ; rien n'est inventé si la base n'a pas la donnée |
| Lecture à voix haute | En production, limitée | Voix Google Gemini ; offre gratuite plafonnée à 10 lectures par jour pour tout le monde |
| Coach conversationnel | En production | Modèle de langage avec outils ; ne reçoit ni identité ni montant en francs |
| Cotes 1xBet | En production | Relevées toutes les 3 heures avec l'heure du relevé, 42 marchés |
| Scores en direct | En production | Rafraîchissement, alerte de but, notifications push |
| Import de tickets | En production | Capture, texte, vidéo d'écran ; 213 libellés réels sur 230 compris |
| Sources et tipsters | En production | Note sur les résultats réels |
| Bankroll, budget, objectifs | En production | Dans l'accueil et le Coach |

## 5. Couverture réelle des données (14 prochains jours)

| Compétition | Matchs | Probabilité du modèle | Cotes de référence | Cotes 1xBet | Compositions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Premier League | 29 | 21 | 20 | 20 | 0 |
| Liga | 22 | 20 | 20 | 20 | 0 |
| Serie A | 20 | 20 | 20 | 20 | 0 |
| Ligue des champions | 18 | 0 | 18 | 18 | 0 |
| Bundesliga | 18 | 18 | 18 | 17 | 0 |
| Ligue 1 | 18 | 18 | 18 | 18 | 0 |
| Coupe de la confédération CAF | 9 | 0 | 0 | 0 | 0 |
| Ligue 1 ivoirienne | 8 | 0 | 0 | 0 | 0 |
| Ligue des champions CAF | 8 | 0 | 0 | 0 | 0 |

À retenir pour l'accueil :

- **Les compétitions africaines et ivoiriennes n'ont aucune probabilité.** Le calendrier et les scores sont là, mais ni modèle ni cotes. Pour un public ivoirien, c'est le trou le plus visible. Les éliminatoires de la CAN et les matchs internationaux sont couverts quand ils ont lieu (fenêtres FIFA).
- **La Ligue des champions** n'a que les probabilités du marché (pas de modèle).
- **Les compositions et les blessés** ne sont récupérés qu'à la demande, sur l'onglet Stats d'un match (4 matchs en base). Rien de systématique.
- **Les jours creux existent.** Ce matin, 4 matchs seulement dans les 48 heures. L'accueil doit rester utile un jour sans match couvert.
- **Base historique :** 4 004 matchs des 5 grands championnats, 304 lignes de classement, les statistiques par joueur des 30 derniers jours (122 matchs).

## 6. Envisagé, mais pas opérationnel

À ne pas présenter comme existant dans les maquettes sans le signaler.

| Idée | État |
| --- | --- |
| Personnage ou avatar IA | Rien n'existe : ni dessin, ni nom, ni animation |
| Renommer Matchs en Prédictions | Pas fait |
| Fiche match en quatre niveaux | Pas faite (aujourd'hui : quatre onglets Analyse, Stats, Marchés, Sources) |
| Bilan du lendemain | Pas fait |
| Montantes des tipsters | Pas fait (étape 4) |
| Dictée vocale d'un prono | Pas fait (étape 5) |
| Animations, jeu | Pas fait (étape 6) |
| Probabilités en direct pendant le match | Pas fait |
| Probabilités pour un joueur (buteur, tirs) | Pas fait ; seul le règlement existe |
| Cotes Betclic Côte d'Ivoire | Absentes de tous les flux ; seulement via les tickets importés |
| Actualité, blessures systématiques, xG | Pas de source |

## 7. Direction artistique actuelle

- Couleurs nommées par rôle, thème clair et sombre (celui du téléphone par défaut). Aucune couleur écrite en dur : un test le vérifie.
- Vert d'action : `#0C6E5C` en clair, `#20BFA0` en sombre. Bleu nuit « terrain » : `#0B2B4C`. Gain, perte et nul ont chacun leur couleur, toujours doublée d'un mot.
- Typographies : Inter pour le texte, Barlow Condensed réservée aux scores.
- Écussons à initiales : pas de logos de clubs, ce sont des marques déposées.
- Ton : tutoiement, phrases courtes, jamais de leçon (« ne parie pas » est banni), toujours une proposition avec sa probabilité et son risque.
