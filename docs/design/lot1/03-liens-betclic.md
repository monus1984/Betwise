# Liens « Copie mon pari » de Betclic Côte d'Ivoire : test de faisabilité (22/11/2026)

## Ce que contient un partage

Deux exemples réels fournis par Mounir. Format du message :

```
"<4 premiers choix séparés par des virgules>, ..." @<cote totale> : Copie mon pari!
https://www.betclic.ci/bet/<code de 8 caractères>
```

- Le lien est un code court : les sélections n'y sont pas.
- Le texte donne la cote totale et les quatre premiers libellés de choix, sans les matchs, sans les marchés, sans les cotes par ligne, et tronqué au-delà de quatre.

## Ce que répond Betclic à une lecture par serveur

Test du 22/11 depuis GitHub Actions (script `scripts/probe-odds-international.ts`, branche `audit-lot1`), identifiant de client honnête (`BetwiseLinkCheck/0.1`), 3 requêtes, `robots.txt` d'abord.

| Adresse | Réponse |
| --- | --- |
| `https://www.betclic.ci/robots.txt` | 403, page « Betclic - Error 403 Forbidden », servie par CloudFront |
| `https://www.betclic.ci/bet/3je2fsnx` | 403, même page (« Please try again in a few minutes », Err 0x2005002) |
| `https://www.betclic.ci/bet/8t9xhdez` | 403, même page |

La page d'erreur ne dit pas la cause (origine géographique ou client non navigateur). L'outil de lecture web de Claude a reçu lui aussi une erreur côté site pour les deux liens.

## Conclusion

- Lecture automatique côté serveur : refusée par Betclic. La contourner (se faire passer pour un navigateur, relais situé en Côte d'Ivoire) reviendrait à contourner une protection : exclu par les règles du projet.
- Non vérifié : ce que voit un visiteur non connecté depuis la Côte d'Ivoire (aucun navigateur de Mounir n'était joignable).
- Une application web ne peut pas lire la page d'un autre site depuis le téléphone ; la capture d'écran reste le moyen de récupérer les sélections.

## Proposition : « lien + capture »

1. Reconnaître le message « Copie mon pari » (collé dans Importer ou reçu par le menu Partager).
2. Créer un coupon Betclic « à compléter » : lien, cote totale, premiers choix, source (pronostiqueur).
3. Boutons « Ouvrir dans Betclic » et « Ajouter la capture » ; le lecteur de tickets remplit les sélections.
4. Contrôle : le produit des cotes lues doit redonner la cote totale du message, sinon une ligne manque.

À valider par Mounir avant développement (changement de base à préciser).
