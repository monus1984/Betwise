# Betster : variantes d'expression à produire (brief pour ChatGPT)

> **19/11, 17 h : solution de repli seulement.** L'audit de ChatGPT écarte l'alternance de PNG comme livraison finale. La cible est décrite dans `etude-avatar-reel.md`.

19/11, demande de Mounir : rendre Betster plus vivant. L'animation actuelle (branche `accueil`, `src/components/betster-anime.tsx`) bouge le portrait validé sans le modifier. Pour aller plus loin (clignement, bouche qui suit la voix, sourire), il faut des variantes **du même portrait**. Elles ne seront intégrées qu'après validation de Mounir (règle CLAUDE.md : pas de nouvelle apparence sans validation).

## Référence

`docs/brand/betster/reference/betster-reference.png` : même personnage, même tenue (casquette, casque audio, veste aux couleurs BETWISE), même fond de stade, même cadrage, même lumière.

## Images demandées

| Fichier | Expression | Ce qui change par rapport à la référence |
| --- | --- | --- |
| `betster-yeux-fermes.png` | Clignement | Paupières fermées, rien d'autre |
| `betster-bouche-a.png` | Parole, bouche entrouverte | Lèvres légèrement écartées (son « è ») |
| `betster-bouche-o.png` | Parole, bouche ouverte | Bouche ouverte arrondie (son « o ») |
| `betster-sourire.png` | Bonne nouvelle | Sourire plus large, dents visibles |
| `betster-concentre.png` | Réflexion | Sourcils légèrement froncés, regard de côté |

## Contraintes techniques

- Carré, 1024 × 1024 px minimum, PNG.
- **Cadrage strictement identique** à la référence : tête au même endroit, à la même taille. Seule la zone du visage concernée change ; sinon l'image « saute » quand on passe d'une variante à l'autre.
- Mêmes couleurs, même logo sur la veste, même fond.
- Pas de texte ajouté, pas d'autre personnage.

## Intégration prévue (après validation)

- Clignement toutes les 3 à 6 secondes (yeux fermés pendant 120 ms).
- Pendant la voix : alternance référence / bouche A / bouche O selon le niveau sonore réel (déjà calculé dans `src/lib/coach/speak.ts`, `niveauVoix()`).
- Sourire quand l'accueil annonce une bonne nouvelle (pari gagné, objectif de montante atteint) ; concentré pendant que le Coach consulte les données.
- Images converties en WebP 112 px et 256 px, chargées une seule fois.
