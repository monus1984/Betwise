# Maquettes du nouvel accueil

Toile de travail : https://claude.ai/artifact/GAPCwyuyWox9gKRW4Eq4nN (privée à Mounir tant qu'il ne la partage pas).
Sources des artboards : `canvas/project/` (format Design Component `.dc.html`, lisible comme du HTML).

| Artboard | État | Version |
| --- | --- | --- |
| `Main.dc.html` | Jour chargé, thème sombre | 19/11 v1 |
| `Clair.dc.html` | Jour chargé, thème clair (même écran, importé avec `theme="clair"`) | 19/11 v1 |

Données fictives. Ordre validé le 19/11 (`04-arbitrage.md`) : avis de Betster et matchs du jour, Coach, import, tipsters.
L'avatar est un emplacement : les trois pistes d'image sont attendues de ChatGPT (`02-brief.md`, section 6).
Ce qui reste à dessiner : soirée en direct, lendemain, jour creux, nouvel abonné, hors ligne.

## v2 — 19/11, 11:23, après la revue de ChatGPT

| Artboard | État |
| --- | --- |
| `Main.dc.html` | Jour chargé, sombre, écran réel 360 × 800 (le contenu défile, coupon et onglets fixés) |
| `Clair.dc.html` | Idem, thème clair |
| `PageEntiere.dc.html` | Toute la page d'un coup, pour la lecture |

Corrections : voir `04-arbitrage.md`, section 6.

## v3 — 19/11, 11:32 : les autres états

Rangée du bas de la toile, tous en thème sombre, écran 360 × 800. Un seul composant (`Main.dc.html`, propriété `etat`) : la structure ne change pas, seul le contenu change.

| Artboard | État | Ce qui change |
| --- | --- | --- |
| `Direct.dc.html` | Soirée en direct | Carte « Ce soir avec Betster » : état de chaque sélection du coupon ; scores et minute sur les cartes ; mention que les pourcentages sont ceux d'avant le match (pas de probabilité en direct dans le moteur) ; matchs terminés avec « passé » ou « pas passé » |
| `Lendemain.dc.html` | Lendemain | Carte « Le bilan d'hier » : 4 sur 5, probabilité annoncée en moyenne, recul sur 30 jours ; puis les matchs du jour |
| `Creux.dc.html` | Jour creux | Prochains matchs couverts (ici la Ligue des champions : « marché seul, pas d'avis du modèle »), accès au calendrier et à l'import ; pas de bloc Tipsters ni de coupon |
| `Nouveau.dc.html` | Nouvel abonné | Avis de Betster et matchs comme d'habitude ; bloc « Bien démarrer » en trois étapes ; carte Coach vide qui dit ce qui y apparaîtra |
| `HorsLigne.dc.html` | Hors ligne | Bandeau en tête, données datées de la dernière mise à jour, ajout au coupon en attente du réseau |

Le « match non couvert » apparaît dans chaque état (Ligue 1 ivoirienne), sans pourcentage.
Les chiffres sur 30 jours du bilan (46 sur 53, 78 % annoncés, 87 % passés) sont ceux, réels, des coups du jour BETWISE mesurés le 19/11 ; tout le reste est fictif.
