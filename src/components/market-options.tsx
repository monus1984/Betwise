/** Options d'un sélecteur de marché, rangées par famille comme chez un bookmaker. */
const GROUPS: [string, string[]][] = [
  ["Résultat", ["1X2", "DC", "DNB", "AH", "EH", "WTN", "QUALIF"]],
  ["Buts", ["OU", "BTTS", "TT1", "TT2", "OE", "MG", "CS"]],
  ["Combinés du match", ["DC_OU", "1X2_OU", "DC_BTTS", "1X2_BTTS", "OU_BTTS"]],
  ["Mi-temps", ["HT_1X2", "HT_DC", "HT_OU", "HT_BTTS", "HT_CS", "H2_1X2", "H2_OU", "HTFT", "HMG"]],
  ["Buteurs", ["BUT", "BUT1"]],
  ["Corners", ["CORN", "CORN1", "CORN2", "CORN_1X2"]],
  ["Cartons", ["CARD", "CARD1", "CARD2", "RED"]],
  ["Tirs", ["SHOT", "SOT", "SOT1", "SOT2"]],
  ["Prolongation", ["ET", "PEN"]],
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
