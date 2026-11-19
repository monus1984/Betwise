# 06 — Revue : problèmes connus et points restant à améliorer

19 novembre 2026, branche `accueil`, commit `40c372a`.

## Pas vérifié

- **L'écran réel, connecté.** Je ne peux pas me connecter au compte : l'accueil a été vu sur l'aperçu avec des données fictives, et ses requêtes vérifiées à part en lecture. Mounir doit l'ouvrir sur l'aperçu Vercel, de préférence à trois moments : en journée de match, pendant un match, et un jour sans match.
- **Le temps de chargement.** L'accueil fait plus de requêtes qu'avant (matchs du jour, signaux, cotes 1xBet, relevés de référence). À mesurer sur l'aperçu, sur réseau mobile.
- **Un jour chargé réel** : le 19/11 est un jour creux ; l'avis de Betster, les cartes analysées et le bloc Tipsters n'ont été vus qu'avec des données fictives.

## Limites connues

- **Une seule image de Betster** : l'expression est calculée (positive, prudente, neutre) et posée sur l'image (`data-expression`), mais l'image ne change pas tant que les trois expressions ne sont pas livrées.
- **L'image porte le logo et le mot BETWISE**, alors que le nom de la plateforme n'est pas arrêté.
- **Pas de bilan du lendemain** en tête d'écran (maquette « Lendemain ») : les matchs terminés affichent « Passé / Pas passé », mais la carte de bilan n'est pas faite.
- **Pas de mode hors ligne** avec les dernières données (maquette « Hors ligne ») : demande une mise en cache dans le service worker.
- **« Passé / Pas passé »** n'existe que pour les marchés réglés sur le score ; pour les autres, rien n'est affiché.
- **Cote médiane** : son heure est celle du dernier relevé de cotes de référence du match, pas forcément de cette sélection.
- **Filtres** des maquettes (« 60 % et plus », « Mes paris », « Afrique ») : pas développés sur l'accueil ; ils relèvent de l'onglet Prédictions.
- **Fraîcheur** : au-delà de 48 h, la cote 1xBet n'est plus affichée et l'expression passe à « prudente ».

## À faire ensuite (proposition, à arbitrer)

1. Bilan du lendemain en tête d'écran.
2. Les trois expressions de Betster, puis une version sans marque.
3. Mode hors ligne.
4. Revoir la pénalité « désaccord du modèle » des coups du jour (mesure du 19/11).

## Revue de ChatGPT

_À ajouter ici._
