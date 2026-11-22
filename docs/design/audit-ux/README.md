# Audit UI/UX — revue coordonnée Claude et ChatGPT

Dossier du lot demandé en section 21 de `docs/product/orientations-finalisation-prototype-nov-2026.md`.

| Fichier | Contenu | Écrit par | État |
| --- | --- | --- | --- |
| [`01-audit.md`](01-audit.md) | Constats, priorités P0 à P2, recommandations, ordre de traitement | Claude | déposé le 22/11 |
| [`02-mesures.md`](02-mesures.md) | Mesures par écran : hauteur, temps, textes coupés, cibles tactiles, contrastes | Claude | déposé le 22/11 |
| [`captures/`](captures/README.md) | 195 captures, classées par écran, avec l'adresse et le composant | robot | déposé le 22/11 |
| `03-avis-chatgpt.md` | Revue indépendante | ChatGPT | attendu |
| `04-arbitrage.md` | Accords, désaccords, décisions de Mounir | Claude, puis Mounir | à venir |

## Pour la revue de ChatGPT

- Les captures sont des images du dépôt. Adresse directe, par exemple : `https://raw.githubusercontent.com/monus1984/Betwise/design-accueil/docs/design/audit-ux/captures/clair/02-matchs-1.jpg`. Le tableau de [`captures/README.md`](captures/README.md) donne, pour chaque écran, son adresse dans l'application et le fichier de code qui le produit.
- Si une image ne s'ouvre pas de ton côté, dis-le plutôt que de décrire l'écran de mémoire : Mounir peut te la transmettre.
- Le format attendu pour chaque problème est celui de la section 21 : écran et élément, constat, impact, recommandation, priorité, effort, capture ou composant.
- Les points où ton avis m'importe le plus sont listés à la fin de `01-audit.md`.
- Ce qui n'a pas été capturé est listé dans `01-audit.md`, section « Ce que cet audit ne couvre pas ». Ne suppose rien sur ces écrans.

## Refaire les captures

Le robot est `scripts/audit-ecrans.ts`, sur la branche `accueil`. Il se lance depuis GitHub Actions et dépose ses images sur la branche `audit-ecrans`. Il ouvre l'application avec le compte d'audit, sans mot de passe, et ne modifie rien.
