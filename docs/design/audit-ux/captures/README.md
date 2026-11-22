# Captures des écrans

Prises le 22 novembre 2026 à 10 h 05 (GMT) sur `https://betwise-iota.vercel.app`, version `main` au commit `de8e3de`, par le robot `scripts/audit-ecrans.ts` (branche `accueil`, commit `4c169fa`).

- **clair** : téléphone de 360 × 780, découpé en écrans (tranche 1 = ce qu'on voit à l'ouverture). Les pages très longues sont limitées à leurs premiers écrans ; le nombre total est indiqué.
- **sombre** : même téléphone, les deux premiers écrans de 36 écrans. Les 15 autres n'apportaient rien de plus que la version claire.
- **petit** : téléphone de 320 × 640, thème clair, deux premiers écrans.
- Compte utilisé : le compte d'audit, sans historique autre que trois paris test du matin. Les états « utilisateur ancien » (bilan rempli, bankroll, montante en cours) ne sont donc pas couverts.
- Les noms des sources partagées sont remplacés par « Source 1 », « Source 2 »… Les chiffres sont les vrais.
- Images réduites à 540 px de large. Adresse directe d'une image : `https://raw.githubusercontent.com/monus1984/Betwise/design-accueil/docs/design/audit-ux/captures/clair/02-matchs-1.jpg`.

Deux pièges de lecture :

- Sur une capture de page entière, la barre d'onglets et Betster flottant n'apparaissent qu'une fois, sur la tranche 1. Sur les écrans où le robot a touché quelque chose avant la capture (championnat déroulé), ils peuvent apparaître au milieu de la page : c'est la position de l'écran à ce moment-là, pas un défaut.
- Le champ « Date et heure du ticket » s'affiche au format américain dans le détail d'un pari : c'est le navigateur du robot, pas l'application.

| Écran | Adresse | Composant principal | Clair | Sombre | 320 px |
| --- | --- | --- | --- | --- | --- |
| Connexion | `/connexion` | `src/app/(auth)/connexion` | [1](clair/00a-connexion-1.jpg) | [1](sombre/00a-connexion-1.jpg) | — |
| Inscription | `/inscription` | `src/app/(auth)/inscription` | [1](clair/00b-inscription-1.jpg) | [1](sombre/00b-inscription-1.jpg) | — |
| Prédictions (accueil) | `/` | `src/app/(app)/page.tsx, src/components/accueil.tsx, profils-du-jour.tsx, recherche-pourcentage.tsx` | [1](clair/01-predictions-1.jpg) [2](clair/01-predictions-2.jpg) [3](clair/01-predictions-3.jpg) [4](clair/01-predictions-4.jpg) [5](clair/01-predictions-5.jpg) [6](clair/01-predictions-6.jpg) [7](clair/01-predictions-7.jpg) [8](clair/01-predictions-8.jpg) [9](clair/01-predictions-9.jpg) [10](clair/01-predictions-10.jpg) | [1](sombre/01-predictions-1.jpg) [2](sombre/01-predictions-2.jpg) [3](sombre/01-predictions-3.jpg) [4](sombre/01-predictions-4.jpg) (sur 10) | [1](petit/01-predictions-1.jpg) [2](petit/01-predictions-2.jpg) (sur 13) |
| Prédictions, onglet Audacieux | `/` | `src/components/profils-du-jour.tsx` | [1](clair/01b-predictions-audacieux-1.jpg) | — | — |
| Prédictions, aide ouverte | `/` | `src/components/aide.tsx` | [1](clair/01c-predictions-aide-1.jpg) | [1](sombre/01c-predictions-aide-1.jpg) | — |
| Matchs, aujourd’hui | `/matchs` | `src/app/(app)/matchs/page.tsx` | [1](clair/02-matchs-1.jpg) [2](clair/02-matchs-2.jpg) [3](clair/02-matchs-3.jpg) [4](clair/02-matchs-4.jpg) | [1](sombre/02-matchs-1.jpg) [2](sombre/02-matchs-2.jpg) (sur 4) | [1](petit/02-matchs-1.jpg) [2](petit/02-matchs-2.jpg) (sur 4) |
| Matchs, premier championnat déroulé | `/matchs` | `src/app/(app)/matchs/page.tsx` | [1](clair/02b-matchs-championnat-ouvert-1.jpg) [2](clair/02b-matchs-championnat-ouvert-2.jpg) [3](clair/02b-matchs-championnat-ouvert-3.jpg) [4](clair/02b-matchs-championnat-ouvert-4.jpg) | [1](sombre/02b-matchs-championnat-ouvert-1.jpg) [2](sombre/02b-matchs-championnat-ouvert-2.jpg) (sur 4) | [1](petit/02b-matchs-championnat-ouvert-1.jpg) [2](petit/02b-matchs-championnat-ouvert-2.jpg) (sur 5) |
| Matchs, hier (matchs terminés) | `/matchs?d=<hier>` | `src/app/(app)/matchs/page.tsx` | [1](clair/02c-matchs-hier-1.jpg) [2](clair/02c-matchs-hier-2.jpg) [3](clair/02c-matchs-hier-3.jpg) (sur 4) | [1](sombre/02c-matchs-hier-1.jpg) [2](sombre/02c-matchs-hier-2.jpg) (sur 4) | — |
| Matchs, filtre Terminés | `/matchs?s=termines` | `src/app/(app)/matchs/page.tsx` | [1](clair/02d-matchs-termines-1.jpg) | — | — |
| Matchs, filtre À venir | `/matchs?s=programmes` | `src/app/(app)/matchs/page.tsx` | [1](clair/02e-matchs-a-venir-1.jpg) (sur 4) | — | — |
| Matchs, filtre En direct | `/matchs?f=direct` | `src/app/(app)/matchs/page.tsx` | [1](clair/02f-matchs-direct-1.jpg) | [1](sombre/02f-matchs-direct-1.jpg) | — |
| Matchs, filtre Suivis | `/matchs?f=suivis` | `src/app/(app)/matchs/page.tsx` | [1](clair/02g-matchs-suivis-1.jpg) | — | — |
| Matchs, recherche « barcelona » | `/matchs?q=barcelona` | `src/app/(app)/matchs/page.tsx` | [1](clair/02h-matchs-recherche-1.jpg) [2](clair/02h-matchs-recherche-2.jpg) | [1](sombre/02h-matchs-recherche-1.jpg) [2](sombre/02h-matchs-recherche-2.jpg) | — |
| Matchs, recherche sans résultat | `/matchs?q=zzqqxx` | `src/app/(app)/matchs/page.tsx` | [1](clair/02i-matchs-recherche-vide-1.jpg) | — | — |
| Matchs, aide ouverte | `/matchs` | `src/components/aide.tsx, page-header.tsx` | [1](clair/02j-matchs-aide-1.jpg) | — | — |
| Fiche match à venir, Analyse (Juventus – Venezia) | `/matchs/<id>` | `src/app/(app)/matchs/[id]/page.tsx, src/components/match-recit.tsx` | [1](clair/03a-match-analyse-1.jpg) [2](clair/03a-match-analyse-2.jpg) [3](clair/03a-match-analyse-3.jpg) [4](clair/03a-match-analyse-4.jpg) | [1](sombre/03a-match-analyse-1.jpg) [2](sombre/03a-match-analyse-2.jpg) (sur 4) | [1](petit/03a-match-analyse-1.jpg) [2](petit/03a-match-analyse-2.jpg) (sur 4) |
| Fiche match à venir, hors modèle (Erzurumspor – Göztepe), capture de 09 h 06 | `/matchs/<id>` | `src/app/(app)/matchs/[id]/page.tsx` | [1](clair/03k-match-hors-modele-1.jpg) [2](clair/03k-match-hors-modele-2.jpg) [3](clair/03k-match-hors-modele-3.jpg) | — | — |
| Fiche match à venir, Stats | `/matchs/<id>?t=stats` | `src/app/(app)/matchs/[id]/page.tsx` | [1](clair/03b-match-stats-1.jpg) [2](clair/03b-match-stats-2.jpg) [3](clair/03b-match-stats-3.jpg) | [1](sombre/03b-match-stats-1.jpg) [2](sombre/03b-match-stats-2.jpg) (sur 3) | — |
| Fiche match à venir, Marchés | `/matchs/<id>?t=marches` | `src/app/(app)/matchs/[id]/markets.tsx` | [1](clair/03c-match-marches-1.jpg) [2](clair/03c-match-marches-2.jpg) [3](clair/03c-match-marches-3.jpg) [4](clair/03c-match-marches-4.jpg) [5](clair/03c-match-marches-5.jpg) (sur 8) | [1](sombre/03c-match-marches-1.jpg) [2](sombre/03c-match-marches-2.jpg) (sur 8) | [1](petit/03c-match-marches-1.jpg) [2](petit/03c-match-marches-2.jpg) (sur 10) |
| Fiche match à venir, Sources | `/matchs/<id>?t=sources` | `src/app/(app)/matchs/[id]/page.tsx` | [1](clair/03d-match-sources-1.jpg) [2](clair/03d-match-sources-2.jpg) | [1](sombre/03d-match-sources-1.jpg) [2](sombre/03d-match-sources-2.jpg) | — |
| Fiche match terminé, Analyse (Real Madrid – Celta) | `/matchs/<id>` | `src/app/(app)/matchs/[id]/page.tsx` | [1](clair/03e-match-termine-1.jpg) [2](clair/03e-match-termine-2.jpg) [3](clair/03e-match-termine-3.jpg) | [1](sombre/03e-match-termine-1.jpg) [2](sombre/03e-match-termine-2.jpg) (sur 3) | — |
| Fiche match terminé, Stats | `/matchs/<id>?t=stats` | `src/app/(app)/matchs/[id]/page.tsx` | [1](clair/03f-match-termine-stats-1.jpg) [2](clair/03f-match-termine-stats-2.jpg) [3](clair/03f-match-termine-stats-3.jpg) [4](clair/03f-match-termine-stats-4.jpg) | — | — |
| Fiche match terminé, Marchés | `/matchs/<id>?t=marches` | `src/app/(app)/matchs/[id]/markets.tsx` | [1](clair/03g-match-termine-marches-1.jpg) [2](clair/03g-match-termine-marches-2.jpg) (sur 8) | — | — |
| Fiche match en direct | `/matchs/<id>` | `src/app/(app)/matchs/[id]/page.tsx` | non capturé : aucune donnée à ce moment-là | | |
| Fiche match sans cote (Lyon W – Strasbourg W) | `/matchs/<id>` | `src/app/(app)/matchs/[id]/page.tsx` | [1](clair/03i-match-sans-cote-1.jpg) [2](clair/03i-match-sans-cote-2.jpg) | [1](sombre/03i-match-sans-cote-1.jpg) [2](sombre/03i-match-sans-cote-2.jpg) | — |
| Fiche match, adresse inconnue | `/matchs/<id inconnu>` | `src/app/not-found.tsx` | [1](clair/03j-match-introuvable-1.jpg) | — | — |
| Classement | `/matchs/classement` | `src/components/standings-table.tsx` | [1](clair/04-classement-1.jpg) [2](clair/04-classement-2.jpg) | [1](sombre/04-classement-1.jpg) [2](sombre/04-classement-2.jpg) | — |
| Mes paris, en cours | `/paris` | `src/app/(app)/paris/page.tsx` | [1](clair/05a-paris-en-cours-1.jpg) | [1](sombre/05a-paris-en-cours-1.jpg) | — |
| Mes paris, réglés | `/paris?f=regles` | `src/app/(app)/paris/page.tsx` | [1](clair/05b-paris-regles-1.jpg) | — | — |
| Paris test | `/paris?vue=tests` | `src/app/(app)/paris/page.tsx, bet-card.tsx` | [1](clair/05c-paris-test-1.jpg) [2](clair/05c-paris-test-2.jpg) | [1](sombre/05c-paris-test-1.jpg) [2](sombre/05c-paris-test-2.jpg) | [1](petit/05c-paris-test-1.jpg) [2](petit/05c-paris-test-2.jpg) (sur 3) |
| Détail d’un pari test | `/paris/<id>` | `src/app/(app)/paris/[id]/page.tsx` | [1](clair/05d-detail-pari-1.jpg) [2](clair/05d-detail-pari-2.jpg) | [1](sombre/05d-detail-pari-1.jpg) [2](sombre/05d-detail-pari-2.jpg) | — |
| Ajouter | `/paris/ajouter` | `src/app/(app)/paris/ajouter/page.tsx` | [1](clair/06a-ajouter-1.jpg) [2](clair/06a-ajouter-2.jpg) | [1](sombre/06a-ajouter-1.jpg) [2](sombre/06a-ajouter-2.jpg) | — |
| Nouveau pari | `/nouveau` | `src/app/(app)/nouveau/new-bet-form.tsx` | [1](clair/06b-nouveau-pari-1.jpg) [2](clair/06b-nouveau-pari-2.jpg) [3](clair/06b-nouveau-pari-3.jpg) | [1](sombre/06b-nouveau-pari-1.jpg) [2](sombre/06b-nouveau-pari-2.jpg) (sur 3) | [1](petit/06b-nouveau-pari-1.jpg) [2](petit/06b-nouveau-pari-2.jpg) (sur 4) |
| Nouveau pari, mode test | `/nouveau?test=1` | `src/app/(app)/nouveau/new-bet-form.tsx` | [1](clair/06c-nouveau-test-1.jpg) [2](clair/06c-nouveau-test-2.jpg) (sur 3) | — | — |
| Importer | `/import` | `src/app/(app)/import/import-flow.tsx` | [1](clair/06d-importer-1.jpg) [2](clair/06d-importer-2.jpg) | [1](sombre/06d-importer-1.jpg) [2](sombre/06d-importer-2.jpg) | — |
| Importer, arrivée en mode test | `/import?test=1` | `src/app/(app)/import/import-flow.tsx` | [1](clair/06e-importer-test-1.jpg) [2](clair/06e-importer-test-2.jpg) | — | — |
| Coach, synthèse | `/coach` | `src/app/(app)/coach/page.tsx, tableau-de-bord.tsx` | [1](clair/07a-coach-1.jpg) [2](clair/07a-coach-2.jpg) | [1](sombre/07a-coach-1.jpg) [2](sombre/07a-coach-2.jpg) | — |
| Coach, conversation avec Betster | `/coach?v=discussion` | `src/app/(app)/coach/chat.tsx` | [1](clair/07b-coach-discussion-1.jpg) [2](clair/07b-coach-discussion-2.jpg) | [1](sombre/07b-coach-discussion-1.jpg) [2](sombre/07b-coach-discussion-2.jpg) | — |
| Bankroll | `/bankroll` | `src/app/(app)/bankroll/page.tsx` | [1](clair/07c-bankroll-1.jpg) [2](clair/07c-bankroll-2.jpg) | [1](sombre/07c-bankroll-1.jpg) [2](sombre/07c-bankroll-2.jpg) | — |
| Montantes | `/montantes` | `src/app/(app)/montantes/nouvelle.tsx` | [1](clair/07d-montantes-1.jpg) [2](clair/07d-montantes-2.jpg) | [1](sombre/07d-montantes-1.jpg) [2](sombre/07d-montantes-2.jpg) | — |
| Une montante | `/montantes/<id>` | `src/app/(app)/montantes/[id]` | non capturé : aucune donnée à ce moment-là | | |
| Options du jour | `/options` | `src/app/(app)/options/options-view.tsx` | [1](clair/07f-options-1.jpg) [2](clair/07f-options-2.jpg) [3](clair/07f-options-3.jpg) (sur 6) | [1](sombre/07f-options-1.jpg) [2](sombre/07f-options-2.jpg) (sur 6) | [1](petit/07f-options-1.jpg) [2](petit/07f-options-2.jpg) (sur 7) |
| Sources, mes sources | `/sources` | `src/app/(app)/sources/page.tsx` | [1](clair/08a-sources-1.jpg) | [1](sombre/08a-sources-1.jpg) | — |
| Sources, analyse | `/sources?f=analyse` | `src/app/(app)/sources/page.tsx` | [1](clair/08b-sources-analyse-1.jpg) | [1](sombre/08b-sources-analyse-1.jpg) | — |
| Sources, classement | `/sources?f=classement` | `src/app/(app)/sources/page.tsx, src/lib/sources/proof.ts` | [1](clair/08c-sources-classement-1.jpg) [2](clair/08c-sources-classement-2.jpg) [3](clair/08c-sources-classement-3.jpg) | [1](sombre/08c-sources-classement-1.jpg) [2](sombre/08c-sources-classement-2.jpg) (sur 3) | — |
| Sources, découvrir | `/sources?f=decouvrir` | `src/app/(app)/sources/page.tsx` | [1](clair/08d-sources-decouvrir-1.jpg) [2](clair/08d-sources-decouvrir-2.jpg) | [1](sombre/08d-sources-decouvrir-1.jpg) [2](sombre/08d-sources-decouvrir-2.jpg) | — |
| Fiche source, Modèle BETWISE | `/sources/<id>` | `src/app/(app)/sources/[id]/page.tsx, client.tsx` | [1](clair/08e-source-modele-1.jpg) [2](clair/08e-source-modele-2.jpg) [3](clair/08e-source-modele-3.jpg) [4](clair/08e-source-modele-4.jpg) (sur 11) | [1](sombre/08e-source-modele-1.jpg) [2](sombre/08e-source-modele-2.jpg) (sur 11) | [1](petit/08e-source-modele-1.jpg) [2](petit/08e-source-modele-2.jpg) (sur 15) |
| Fiche source, Coups du jour BETWISE | `/sources/<id>` | `src/app/(app)/sources/[id]/page.tsx` | [1](clair/08f-source-coups-du-jour-1.jpg) [2](clair/08f-source-coups-du-jour-2.jpg) [3](clair/08f-source-coups-du-jour-3.jpg) (sur 11) | — | — |
| Nouvelle source | `/sources/nouvelle` | `src/app/(app)/sources/nouvelle` | [1](clair/08g-nouvelle-source-1.jpg) [2](clair/08g-nouvelle-source-2.jpg) | [1](sombre/08g-nouvelle-source-1.jpg) [2](sombre/08g-nouvelle-source-2.jpg) | — |
| Comparer deux sources | `/sources/comparer` | `src/app/(app)/sources/comparer/page.tsx` | [1](clair/08h-comparer-1.jpg) | — | — |
| Mon bilan | `/bilan` | `src/app/(app)/bilan/page.tsx` | [1](clair/09a-bilan-1.jpg) | [1](sombre/09a-bilan-1.jpg) | — |
| Notifications | `/notifications` | `src/app/(app)/notifications/page.tsx` | [1](clair/09b-notifications-1.jpg) | [1](sombre/09b-notifications-1.jpg) | — |
| Réglages | `/reglages` | `src/app/(app)/reglages/page.tsx` | [1](clair/09c-reglages-1.jpg) | [1](sombre/09c-reglages-1.jpg) | — |
| Adresse inexistante | `/page-qui-n-existe-pas` | `src/app/not-found.tsx` | [1](clair/10-page-inexistante-1.jpg) | — | — |
