# Mesure des probabilités

Ce dossier garde les mesures de ce que valent les probabilités affichées par BETWISE, et de quoi les refaire.

## Refaire la mesure

| Quoi | Commande | Accès requis |
| --- | --- | --- |
| Tout (matchs suivis, coups du jour, cinq championnats, modèle rejoué) | `npx tsx scripts/mesure-probabilites.ts` | base (clé de service) |
| Idem, en enregistrant le résumé dans `betwise.mesures_probabilites` | `npx tsx scripts/mesure-probabilites.ts --enregistrer` | base (clé de service) |
| Les seuls matchs d'un jeu exporté, sans accès à la base | `npx tsx scripts/mesure-probabilites.ts --donnees docs/mesures/2026-11-18_matchs.json` | aucun |

Sur GitHub : action « Mesure des probabilités » (`.github/workflows/mesure-probabilites.yml`), à la demande et chaque lundi à
08:20 UTC. Le rapport complet s'affiche dans le résumé du passage.

## Ce que fait le script

1. **Probabilités « marché »** : pour chaque match terminé, il reprend les dernières cotes de référence relevées avant le
   coup d'envoi, recalcule les probabilités par la même fonction que la fiche match (`probasMarche`) et les confronte au
   score. L'issue de chaque sélection est calculée par `src/lib/mesure/issue.ts`, copie conforme du règlement en base
   (900 cas comparés un à un dans `issue.test.ts`).
2. **Coups du jour** : probabilité annoncée le jour même contre résultat, par catégorie.
3. **Cinq championnats** : mêmes calculs sur l'historique football-data.co.uk (cotes moyennes de clôture, score à la pause).
4. **Modèle maison** : rejoué semaine après semaine, sans jamais voir un match futur (`src/lib/mesure/modele.ts`), puis
   comparé aux cotes de clôture sur les mêmes matchs.
5. **Retrait de la marge** : trois méthodes sur les mêmes matchs (`src/lib/probs/marge.ts`).

## Fichiers

| Fichier | Contenu |
| --- | --- |
| `2026-11-19_resultats.md` | Rapport complet du 19/11/2026 |
| `2026-11-18_matchs.json` | 132 matchs terminés au 18/11 : `[compétition, cote 1, cote N, cote 2, cote +2,5, cote −2,5, buts domicile, buts extérieur, pause domicile, pause extérieur]` |

## Limites connues

- Les matchs suivis par l'application ne couvrent encore que trois semaines de matchs internationaux : aucun match de
  championnat n'a été joué depuis que les cotes sont relevées. Les championnats sont mesurés sur l'historique, avec des
  cotes moyennes de clôture, pas avec nos relevés.
- L'historique des championnats n'a ni corners ni cartons : ces marchés ne sont pas mesurés.
- Les réglages du modèle ont été choisis sur une partie de cet historique : sa mesure n'est pas totalement « à l'aveugle ».
