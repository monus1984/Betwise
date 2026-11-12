/** Taxonomie fermée des marchés (miroir de la table betwise.markets). */
export const MARKETS = ["1X2", "DC", "DNB", "OU", "BTTS", "AH", "CS"] as const;
/** Avec les marchés combinés (une sélection, deux conditions). */
export const MARKETS_ALL = ["1X2", "DC", "DNB", "OU", "BTTS", "AH", "CS", "DC_OU", "1X2_OU", "TT1", "TT2", "DC_BTTS", "1X2_BTTS", "OU_BTTS",
  "HT_1X2", "HT_DC", "HT_OU", "HT_BTTS", "H2_1X2", "H2_OU", "HTFT", "HMG", "OE", "MG", "EH", "WTN",
  "HT_CS", "CORN", "CORN1", "CORN2", "CORN_1X2", "CARD", "CARD1", "CARD2", "RED", "SHOT", "SOT", "SOT1", "SOT2", "BUT", "BUT1", "ET", "PEN", "QUALIF"] as const;
/** Marchés réglés sur le détail du match (statistiques, buteurs) : pas de probabilité BETWISE. */
export const MARKETS_SANS_PROBA = ["CORN", "CORN1", "CORN2", "CORN_1X2", "CARD", "CARD1", "CARD2", "RED", "SHOT", "SOT", "SOT1", "SOT2", "BUT", "BUT1", "ET", "PEN", "QUALIF"];
export type MarketCode = (typeof MARKETS_ALL)[number];
