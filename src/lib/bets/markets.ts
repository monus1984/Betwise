/** Taxonomie fermée des marchés (miroir de la table betwise.markets). */
export const MARKETS = ["1X2", "DC", "DNB", "OU", "BTTS", "AH", "CS"] as const;
/** Avec les marchés combinés (une sélection, deux conditions). */
export const MARKETS_ALL = ["1X2", "DC", "DNB", "OU", "BTTS", "AH", "CS", "DC_OU", "1X2_OU", "TT1", "TT2", "DC_BTTS", "1X2_BTTS", "OU_BTTS",
  "HT_1X2", "HT_DC", "HT_OU", "HT_BTTS", "H2_1X2", "H2_OU", "HTFT", "HMG", "OE", "MG", "EH", "WTN",
  "HT_CS", "CORN", "CORN1", "CORN2", "CORN_1X2", "CARD", "CARD1", "CARD2", "RED", "SHOT", "SOT", "SOT1", "SOT2", "BUT", "BUT1", "ET", "PEN", "QUALIF",
  "H2_BTTS", "H2_DC", "HT_TT1", "HT_TT2", "H2_TT1", "H2_TT2", "WEH", "BH", "PK", "PKB", "DBL", "LIBRE",
  // Ajoutés le 19/11 (0049) : mi-temps, buts d'une équipe, ordre des buts, joueurs, statistiques, combiné libre
  "HT_AH", "H2_AH", "HT_DNB", "H2_DNB", "HT_OE", "H2_OE", "H2_CS", "OE1", "OE2", "MG1", "MG2", "WBH", "SBH",
  "FTS", "LTS", "GB", "OG", "PKM", "BUTL", "BUT2", "BUT3", "PCARD", "CARD_1X2", "RED1", "RED2", "SHOT1", "SHOT2",
  "CORN_AH", "CORN_OE", "CORN_DC", "FOUL", "FOUL1", "FOUL2", "OFF", "OFF1", "OFF2", "COMBO",
  // Ajoutés le 19/11 (0050) : statistiques d'un joueur, choix « Plus|Nom »
  "PSHOT", "PSOT", "PAST"] as const;
/** Marchés réglés sur le détail du match (statistiques, buteurs) : pas de probabilité BETWISE. */
export const MARKETS_SANS_PROBA = ["CORN", "CORN1", "CORN2", "CORN_1X2", "CARD", "CARD1", "CARD2", "RED", "SHOT", "SOT", "SOT1", "SOT2", "BUT", "BUT1", "ET", "PEN", "QUALIF", "PK", "PKB", "DBL", "LIBRE",
  "GB", "OG", "PKM", "BUTL", "BUT2", "BUT3", "PCARD", "CARD_1X2", "RED1", "RED2", "SHOT1", "SHOT2", "CORN_AH", "CORN_OE", "CORN_DC", "FOUL", "FOUL1", "FOUL2", "OFF", "OFF1", "OFF2", "PSHOT", "PSOT", "PAST"];
/** Marchés dont le choix est un nom de joueur. */
export const MARKETS_JOUEUR = ["BUT", "BUT1", "BUTL", "BUT2", "BUT3", "PCARD", "PSHOT", "PSOT", "PAST"];
/** Statistiques d'un joueur : la sélection porte le sens et le nom, « Plus|Harry Kane », la ligne est dans market_param. */
export const MARKETS_STAT_JOUEUR = ["PSHOT", "PSOT", "PAST"];
/** Pari non reconnu, gardé avec son libellé d'origine : jamais réglé automatiquement, l'utilisateur le règle à la main. */
export const MARCHE_LIBRE = "LIBRE";
export type MarketCode = (typeof MARKETS_ALL)[number];
