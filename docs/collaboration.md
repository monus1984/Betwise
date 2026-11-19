# Travailler à trois sur BETWISE

Règles validées par Mounir le 19 novembre 2026. GitHub sert de mémoire commune : briefs, avis, décisions et bilans y sont conservés, pour que chacun reparte de l'état réel du projet à chaque session.

## Les rôles

| Qui | Rôle |
| --- | --- |
| Mounir | Vision et arbitrage : il fixe les objectifs et prend les décisions |
| Claude | Analyse technique et développement : audite le code et les données, propose des options, développe après validation, documente |
| ChatGPT | Second regard indépendant : lit les documents et le code poussés, challenge les choix, évalue l'UX, propose des améliorations |
| GitHub | Mémoire et espace de travail commun |

L'avis de ChatGPT n'est jamais une validation. Seul Mounir arbitre.

## Le cycle

1. **Brief** : Mounir exprime le besoin et le résultat attendu.
2. **Analyse** : Claude audite et prépare ses propositions.
3. **Avis indépendant** : ChatGPT lit les documents et formule ses recommandations.
4. **Arbitrage** : Claude présente les points d'accord, les désaccords et les choix à faire.
5. **Validation** : Mounir décide.
6. **Développement** : Claude code sur une branche dédiée.
7. **Contrôle** : Claude dépose un bilan (modifications, tests, limites).
8. **Revue** : ChatGPT lit le bilan et le diff, et challenge le résultat.
9. **Itération** : on corrige, puis on passe au lot suivant.

On travaille par lots cohérents, un à la fois. Seule exception : un défaut en production (pari mal réglé, erreur d'import, écran cassé). Claude le signale comme tel et le traite à part, sans l'ajouter en silence au lot en cours.

## Un dossier par lot

Chaque lot a son dossier, par exemple `docs/design/accueil/`. Tous les fichiers ne sont pas toujours nécessaires, mais les noms restent les mêmes.

| Fichier | Contenu | Écrit par |
| --- | --- | --- |
| `01-audit.md` | État initial, données réellement disponibles, contraintes | Claude |
| `02-brief.md` | Besoin, objectifs, critères de réussite | Claude, d'après Mounir |
| `03-avis-chatgpt.md` | Recommandations indépendantes | ChatGPT |
| `04-arbitrage.md` | Points d'accord, désaccords, options ; puis les décisions de Mounir, datées et dans ses mots | Claude |
| `05-implementation.md` | Ce qui a été développé, avec la branche et le commit | Claude |
| `06-revue.md` | Tests, problèmes connus, points restant à améliorer ; la revue de ChatGPT y est ajoutée | Claude, puis ChatGPT |
| `maquettes/` | Images, nommées `AAAA-MM-JJ_auteur_sujet.png` | tous |

## Les garde-fous

- **`main` reste protégé.** Chaque lot passe par une pull request ; elle n'est fusionnée qu'avec l'accord explicite de Mounir.
- **Branches dédiées.** Claude développe sur une branche par lot. ChatGPT écrit seulement dans les dossiers de documentation, sur une branche de travail.
- **Supabase de production.** Aucune modification sans l'accord explicite de Mounir, demandé à chaque fois, en disant ce qu'elle change et si on peut revenir en arrière. Les aperçus Vercel utilisent la base de production : un aperçu qui a besoin d'une migration demande donc cet accord avant d'être testable.
- **Lecture seule par défaut** sur Supabase et Vercel pour ChatGPT.
- **Aucun secret** ni identifiant sensible, aucune donnée personnelle (montants réels, e-mail, comptes) dans les documents ou les maquettes.
- **Annoncé ou opérationnel.** Un document distingue toujours ce qui existe et marche de ce qui est envisagé.
- **Tests et limites documentés.** Une fonctionnalité n'est pas terminée parce que le code est écrit : elle l'est quand elle est testée, en production et revue.
- **Version citée.** Chaque bilan donne la branche et le commit, pour que la revue porte sur la bonne version.
