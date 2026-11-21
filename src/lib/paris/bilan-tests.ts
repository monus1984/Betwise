/**
 * Bilan des paris test (lot « Paris test complets », 21/11/2026). Calculé sur les tickets et sélections enregistrés,
 * jamais sur des résultats déclarés après coup : la cote et la date sont celles de l'enregistrement.
 * Un ticket remboursé compte comme réglé sans gain ni perte ; un ticket annulé est ignoré ; une sélection annulée
 * ou remboursée n'entre pas dans la réussite des sélections.
 */
export type TestBet = {
  statut: "en_cours" | "gagne" | "perdu" | "rembourse" | "annule";
  mise: number; gain_net: number | null; cote_totale: number | null; placed_at: string;
  selections: { market: string; resultat: string; cote: number; origine: string | null; competition: string | null }[];
};

export type Ligne = { cle: string; n: number; justes: number; taux: number };
export type BilanTests = {
  tickets: number; enCours: number; gagnes: number; perdus: number; rembourses: number;
  tauxTickets: number | null; selections: number; selectionsJustes: number; tauxSelections: number | null;
  mises: number; net: number; rendement: number | null; coteMoyenne: number | null;
  parFamille: Ligne[]; parCompetition: Ligne[]; parOrigine: Ligne[];
};

/** Famille d'un marché, pour le bilan : ce que l'utilisateur reconnaît sur son ticket. */
export function familleTest(code: string): string {
  if (code.startsWith("HT_") || code.startsWith("H2_") || ["HTFT", "HMG", "WEH", "BH", "WBH", "SBH"].includes(code)) return "Mi-temps";
  if (["DC_OU", "1X2_OU", "DC_BTTS", "1X2_BTTS", "OU_BTTS", "COMBO"].includes(code)) return "Combinés du match";
  if (/^(CORN|CARD|SHOT|SOT|FOUL|OFF|RED)/.test(code)) return "Corners, cartons, tirs";
  if (/^(BUT|DBL|PAST|PCARD|PSHOT|PSOT)/.test(code)) return "Joueurs";
  if (code === "1X2") return "Résultat";
  if (["DC", "DNB"].includes(code)) return "Double chance, remboursé si nul";
  if (["AH", "EH"].includes(code)) return "Handicaps";
  if (code === "OU") return "Plus / moins de buts";
  if (code === "BTTS") return "Les deux équipes marquent";
  if (/^(TT|OE|MG|CS|FTS|LTS|WTN|GB|OG|PK)/.test(code)) return "Autres paris sur les buts";
  return "Autres";
}

const pct = (a: number, b: number) => (b ? a / b : null);

function regroupe(items: { cle: string; juste: boolean }[]): Ligne[] {
  const m = new Map<string, { n: number; justes: number }>();
  for (const i of items) { const e = m.get(i.cle) ?? { n: 0, justes: 0 }; e.n++; if (i.juste) e.justes++; m.set(i.cle, e); }
  return [...m].map(([cle, e]) => ({ cle, n: e.n, justes: e.justes, taux: e.justes / e.n })).sort((a, b) => b.n - a.n || b.taux - a.taux);
}

export function bilanTests(bets: TestBet[], depuis?: Date): BilanTests {
  const dans = bets.filter((b) => b.statut !== "annule" && (!depuis || Date.parse(b.placed_at) >= depuis.getTime()));
  const regles = dans.filter((b) => b.statut !== "en_cours");
  const tranches = regles.filter((b) => b.statut !== "rembourse");
  const gagnes = regles.filter((b) => b.statut === "gagne").length, perdus = regles.filter((b) => b.statut === "perdu").length;
  const mises = tranches.reduce((x, b) => x + Number(b.mise), 0);
  const net = regles.reduce((x, b) => x + Number(b.gain_net ?? 0), 0);
  const cotes = tranches.map((b) => Number(b.cote_totale)).filter((c) => c > 1);
  const sels = dans.flatMap((b) => b.selections).filter((s) => s.resultat === "gagne" || s.resultat === "perdu");
  const it = (k: (s: (typeof sels)[number]) => string) => regroupe(sels.map((s) => ({ cle: k(s), juste: s.resultat === "gagne" })));
  return {
    tickets: regles.length, enCours: dans.length - regles.length, gagnes, perdus, rembourses: regles.length - gagnes - perdus,
    tauxTickets: pct(gagnes, gagnes + perdus), selections: sels.length, selectionsJustes: sels.filter((s) => s.resultat === "gagne").length,
    tauxSelections: pct(sels.filter((s) => s.resultat === "gagne").length, sels.length),
    mises, net, rendement: mises ? net / mises : null, coteMoyenne: cotes.length ? cotes.reduce((a, b) => a + b, 0) / cotes.length : null,
    parFamille: it((s) => familleTest(s.market)), parCompetition: it((s) => s.competition ?? "Hors compétitions suivies"), parOrigine: it((s) => s.origine ?? "Mon choix"),
  };
}
