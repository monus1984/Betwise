# Nouvel accueil BETWISE — dossier de conception

Dossier partagé entre Mounir, Claude et ChatGPT pour l'étape 3 de la feuille de route (nouvel accueil et personnage).

| Fichier | Contenu | Écrit par |
| --- | --- | --- |
| `01-audit.md` | L'accueil actuel, les composants, les données réellement disponibles, ce qui marche et ce qui n'existe pas encore | Claude |
| `02-brief.md` | La vision, ce que l'écran doit faire, la direction artistique, les contraintes, les données manquantes, les questions ouvertes | Claude |
| `03-avis-chatgpt.md` | Second regard indépendant sur le brief, propositions UI/UX, maquettes | ChatGPT |
| `04-synthese.md` | Ce qui est retenu de chaque proposition et pourquoi, pour validation | Claude |
| `maquettes/` | Images et maquettes, nommées `AAAA-MM-JJ_auteur_sujet.png` | tous |

## Déroulé

1. Claude écrit l'audit et le brief (ce dossier, branche `design-accueil`).
2. Mounir relit et transmet à ChatGPT.
3. ChatGPT répond dans `03-avis-chatgpt.md` et `maquettes/`, ou Mounir colle sa réponse à Claude.
4. Claude fait la synthèse dans `04-synthese.md`. Mounir tranche.
5. Après validation seulement : développement sur une branche dédiée, aperçu Vercel, puis mise en production sur l'accord de Mounir.

## Règles de cette phase

- Supabase et Vercel : lecture seule. Aucune écriture en production.
- GitHub : uniquement ce dossier, sur la branche `design-accueil` ou une branche propre à chacun. Jamais `main`.
- Aucun secret, aucune clé, aucune donnée personnelle (montants, e-mail, noms de comptes) dans les documents ni dans les maquettes. Les maquettes utilisent des chiffres fictifs.
- Le code de l'application n'est modifié que par Claude, après validation, pour éviter que deux personnes écrasent le travail de l'autre.
