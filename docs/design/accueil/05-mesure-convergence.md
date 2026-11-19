# Mesure : la convergence marché / modèle dit-elle quelque chose de la fiabilité ?

19 novembre 2026, 14:40. Exécution GitHub Actions `44544463465`, branche `mesure-convergence` (script `scripts/mesure/base.ts`, section « Convergence »), **sans enregistrement en base**.

## Méthode

- 2 952 matchs des cinq grands championnats (août 2024 à novembre 2026), où le modèle est rejoué semaine après semaine sans connaître l'avenir, et où les cotes moyennes de clôture sont retrouvées.
- Pour chaque match, l'issue que le marché donne favorite (1, N ou 2). La probabilité affichée est celle du marché, marge retirée par la méthode « puissance », comme dans l'application.
- Convergence = écart entre la probabilité du modèle et celle du marché sur cette issue, avec les seuils provisoires de l'arbitrage : moins de 3 points, 3 à 10, plus de 10.
- Limite : seul le résultat du match (1 / N / 2) est mesuré, et seulement sur les cinq championnats où le modèle existe.

## Résultats

### Toutes les favorites du marché (2 952 matchs)

| Convergence | Matchs | Part | Annoncé (marché) | Arrivé | Écart (points) | Brier marché | Brier modèle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Forte (moins de 3 points) | 832 | 28 % | 51,8 % | 52,3 % | +0,4 | 0,237 | 0,237 |
| Moyenne (3 à 10 points) | 1 493 | 51 % | 52,8 % | 54,3 % | +1,5 | 0,228 | 0,233 |
| Divergence (plus de 10 points) | 627 | 21 % | 56,4 % | 56,1 % | −0,3 | 0,228 | 0,254 |

### Favorites à 60 % ou plus (840 matchs)

| Convergence | Matchs | Part | Annoncé (marché) | Arrivé | Écart (points) | Brier marché | Brier modèle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Forte | 200 | 24 % | 69,2 % | 71,5 % | +2,3 | 0,202 | 0,202 |
| Moyenne | 401 | 48 % | 71,2 % | 74,6 % | +3,4 | 0,183 | 0,191 |
| Divergence | 239 | 28 % | 71,0 % | 70,7 % | −0,3 | 0,199 | 0,228 |

(Brier : plus bas = meilleur.)

## Ce que ça veut dire

1. **La probabilité du marché est fiable quelle que soit la convergence.** Dans les trois groupes, l'annoncé et l'arrivé sont à moins de 3,5 points. Un favori « en divergence » arrive aussi souvent que prévu (71,0 % annoncés, 70,7 % arrivés).
2. **Quand ils divergent, c'est le modèle qui se trompe, pas le marché.** Le Brier du modèle se dégrade nettement en divergence (0,254 contre 0,228 pour le marché) ; il n'est jamais meilleur que le marché.
3. **Afficher « Marché et modèle divergent » comme signal de prudence serait trompeur** : l'utilisateur lirait « moins fiable » alors que la probabilité affichée l'est autant.
4. ChatGPT avait raison de mettre en garde (revue du 19/11, point P0) : la convergence n'est pas une mesure de fiabilité. Les chiffres le confirment.

À noter au passage, sans rien changer dans ce lot : les coups du jour retirent 6 points aux sélections où le modèle est nettement en dessous du marché. Sur ces chiffres, cette pénalité n'est pas justifiée par une moins bonne fiabilité ; à revoir dans un lot à part.

## Proposition

- **Retirer la convergence de l'accueil.** Les cartes gardent la probabilité, la couverture (marché et modèle, marché seul) et la fraîcheur de la cote.
- **Garder l'avis du modèle dans la fiche match**, présenté comme un second avis (« le modèle voit 61 % ») et non comme une note de confiance.
- **Expression de Betster** : fondée sur la probabilité et la couverture, plus sur la convergence. Positive : probabilité ≥ 60 % avec une cote de référence fraîche. Prudente : sous 60 %, ou modèle seul. Neutre : pas de donnée, jour creux, hors ligne.
- **Filtre « Forte convergence »** remplacé par « 60 % et plus ».
