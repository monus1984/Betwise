import { describe, expect, it } from "vitest";
import { bilanTests, familleTest, type TestBet } from "./bilan-tests";

const sel = (market: string, resultat: string, origine: string | null = null, competition: string | null = "Ligue 1") => ({ market, resultat, cote: 1.8, origine, competition });
const bets: TestBet[] = [
  { statut: "gagne", mise: 1000, gain_net: 800, cote_totale: 1.8, placed_at: "2026-11-20T10:00:00Z", selections: [sel("1X2", "gagne", "Tipster A")] },
  { statut: "perdu", mise: 1000, gain_net: -1000, cote_totale: 3.2, placed_at: "2026-11-19T10:00:00Z", selections: [sel("OU", "gagne"), sel("BTTS", "perdu", null, "Liga")] },
  { statut: "rembourse", mise: 500, gain_net: 0, cote_totale: 2, placed_at: "2026-11-18T10:00:00Z", selections: [sel("DNB", "rembourse")] },
  { statut: "annule", mise: 500, gain_net: null, cote_totale: 2, placed_at: "2026-11-18T10:00:00Z", selections: [sel("1X2", "gagne")] },
  { statut: "en_cours", mise: 500, gain_net: null, cote_totale: 1.5, placed_at: "2026-11-21T10:00:00Z", selections: [sel("HT_1X2", "en_attente")] },
  { statut: "gagne", mise: 1000, gain_net: 500, cote_totale: 1.5, placed_at: "2026-10-01T10:00:00Z", selections: [sel("1X2", "gagne")] },
];

describe("bilan des paris test", () => {
  const b = bilanTests(bets);
  it("compte tickets et sélections à part, sans les annulés", () => {
    expect(b).toMatchObject({ tickets: 4, enCours: 1, gagnes: 2, perdus: 1, rembourses: 1, selections: 4, selectionsJustes: 3 });
    expect(b.tauxTickets).toBeCloseTo(2 / 3);
    expect(b.tauxSelections).toBeCloseTo(3 / 4);
  });
  it("bilan virtuel et rendement hors remboursés, cote moyenne des tickets tranchés", () => {
    expect(b.net).toBe(300);
    expect(b.mises).toBe(3000);
    expect(b.rendement).toBeCloseTo(0.1);
    expect(b.coteMoyenne).toBeCloseTo((1.8 + 3.2 + 1.5) / 3);
  });
  it("répartit par famille de marché, compétition et origine", () => {
    expect(b.parFamille.find((l) => l.cle === "Résultat")).toMatchObject({ n: 2, justes: 2 });
    expect(b.parCompetition.find((l) => l.cle === "Liga")).toMatchObject({ n: 1, justes: 0 });
    expect(b.parOrigine.find((l) => l.cle === "Tipster A")).toMatchObject({ n: 1, justes: 1 });
  });
  it("filtre une période", () => {
    expect(bilanTests(bets, new Date("2026-11-15T00:00:00Z")).tickets).toBe(3);
  });
  it("classe les marchés", () => {
    expect(familleTest("CORN1")).toBe("Corners, cartons, tirs");
    expect(familleTest("HT_OU")).toBe("Mi-temps");
    expect(familleTest("BUT")).toBe("Joueurs");
  });
});
