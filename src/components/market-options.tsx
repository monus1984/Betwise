/** Options d'un sélecteur de marché, rangées par famille comme chez un bookmaker. */
const GROUPS: [string, string[]][] = [
  ["Résultat", ["1X2", "DC", "DNB", "AH", "EH", "WTN", "QUALIF"]],
  ["Buts", ["OU", "BTTS", "TT1", "TT2", "OE", "OE1", "OE2", "MG", "MG1", "MG2", "CS", "FTS", "LTS", "GB"]],
  ["Combinés du match", ["DC_OU", "1X2_OU", "DC_BTTS", "1X2_BTTS", "OU_BTTS", "COMBO"]],
  ["1re mi-temps", ["HT_1X2", "HT_DC", "HT_DNB", "HT_AH", "HT_OU", "HT_BTTS", "HT_TT1", "HT_TT2", "HT_OE", "HT_CS"]],
  ["2e mi-temps", ["H2_1X2", "H2_DC", "H2_DNB", "H2_AH", "H2_OU", "H2_BTTS", "H2_TT1", "H2_TT2", "H2_OE", "H2_CS"]],
  ["Les deux mi-temps", ["HTFT", "HMG", "WEH", "WBH", "SBH", "BH"]],
  ["Buteurs et joueurs", ["BUT", "BUT1", "BUTL", "BUT2", "BUT3", "DBL", "PCARD"]],
  ["Penalty, but contre son camp", ["PK", "PKB", "PKM", "OG"]],
  ["Corners", ["CORN", "CORN1", "CORN2", "CORN_1X2", "CORN_DC", "CORN_AH", "CORN_OE"]],
  ["Cartons", ["CARD", "CARD1", "CARD2", "CARD_1X2", "RED", "RED1", "RED2"]],
  ["Tirs, fautes, hors-jeu", ["SHOT", "SHOT1", "SHOT2", "SOT", "SOT1", "SOT2", "FOUL", "FOUL1", "FOUL2", "OFF", "OFF1", "OFF2"]],
  ["Prolongation", ["ET", "PEN"]],
  ["Autre", ["LIBRE"]],
];
export function MarketOptions({ markets }: { markets: { code: string; libelle_fr: string }[] }) {
  const by = new Map(markets.map((m) => [m.code, m]));
  const known = new Set(GROUPS.flatMap(([, codes]) => codes));
  const rest = markets.filter((m) => !known.has(m.code));
  return (
    <>
      {GROUPS.map(([label, codes]) => {
        const list = codes.map((c) => by.get(c)).filter((m): m is { code: string; libelle_fr: string } => !!m);
        return list.length ? <optgroup key={label} label={label}>{list.map((m) => <option key={m.code} value={m.code}>{m.libelle_fr}</option>)}</optgroup> : null;
      })}
      {rest.map((m) => <option key={m.code} value={m.code}>{m.libelle_fr}</option>)}
    </>
  );
}
