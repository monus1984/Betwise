/** Taxonomie fermée des marchés (miroir de la table betwise.markets). */
export const MARKETS = ["1X2", "DC", "DNB", "OU", "BTTS", "AH", "CS"] as const;
/** Avec les marchés combinés (une sélection, deux conditions). */
export const MARKETS_ALL = ["1X2", "DC", "DNB", "OU", "BTTS", "AH", "CS", "DC_OU", "1X2_OU", "TT1", "TT2", "DC_BTTS", "1X2_BTTS", "OU_BTTS"] as const;
export type MarketCode = (typeof MARKETS_ALL)[number];
