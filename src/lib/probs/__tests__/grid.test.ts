import { describe, expect, it } from "vitest";
import { lambdasFromOdds, makeGrid, probOf } from "../grid";

describe("grille de scores", () => {
  const g = makeGrid(1.6, 1.1);
  it("les marchés sont cohérents entre eux", () => {
    const p1 = probOf(g, "1X2", null, "1")!, pn = probOf(g, "1X2", null, "N")!, p2 = probOf(g, "1X2", null, "2")!;
    expect(p1 + pn + p2).toBeCloseTo(1, 6);
    expect(probOf(g, "DC", null, "1N")).toBeCloseTo(p1 + pn, 6);
    expect(probOf(g, "OU", 2.5, "Plus")! + probOf(g, "OU", 2.5, "Moins")!).toBeCloseTo(1, 6);
    expect(probOf(g, "DC_OU", 2.5, "N2|Plus")! + probOf(g, "DC_OU", 2.5, "N2|Moins")!).toBeCloseTo(pn + p2, 6);
    expect(probOf(g, "OU", 1.5, "Plus")!).toBeGreaterThan(probOf(g, "OU", 2.5, "Plus")!);
    expect(probOf(g, "AH", -0.25, "1")).toBeNull();
    // Handicap −1,5 = gagner par 2 buts ou plus ; +1,5 côté adverse = son complément
    const ah = probOf(g, "AH", -1.5, "1")!;
    expect(ah).toBeCloseTo(probOf(g, "AH", 1.5, "2") === null ? 0 : 1 - probOf(g, "AH", 1.5, "2")!, 6);
    expect(probOf(g, "AH", -0.5, "1")).toBeCloseTo(p1, 6);
    expect(probOf(g, "AH", 0, "1")).toBeCloseTo(probOf(g, "DNB", null, "1")!, 6);
  });
  it("combos même match et buts par équipe", () => {
    const pn = probOf(g, "1X2", null, "N")!, p2 = probOf(g, "1X2", null, "2")!;
    expect(probOf(g, "DC_BTTS", null, "N2|Oui")! + probOf(g, "DC_BTTS", null, "N2|Non")!).toBeCloseTo(pn + p2, 6);
    expect(probOf(g, "1X2_BTTS", null, "1|Oui")!).toBeLessThan(probOf(g, "BTTS", null, "Oui")!);
    expect(probOf(g, "OU_BTTS", 2.5, "Plus|Oui")! + probOf(g, "OU_BTTS", 2.5, "Plus|Non")!).toBeCloseTo(probOf(g, "OU", 2.5, "Plus")!, 6);
    expect(probOf(g, "TT1", 0.5, "Plus")).toBeCloseTo(1 - Math.exp(-1.6), 1);
    expect(probOf(g, "TT1", 1.5, "Plus")!).toBeGreaterThan(probOf(g, "TT2", 1.5, "Plus")!);
  });
  it("mi-temps, pair/impair, tranches, handicap européen", () => {
    const s3 = (m: string, par: number | null = null) => ["1", "N", "2"].reduce((x, k) => x + probOf(g, m, par, k)!, 0);
    expect(s3("HT_1X2")).toBeCloseTo(1, 6); expect(s3("H2_1X2")).toBeCloseTo(1, 6); expect(s3("HMG")).toBeCloseTo(1, 6); expect(s3("EH", -1)).toBeCloseTo(1, 6);
    const htft = ["1", "N", "2"].flatMap((a) => ["1", "N", "2"].map((b) => probOf(g, "HTFT", null, `${a}/${b}`)!));
    expect(htft.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 3);
    // mi-temps/fin : la somme sur la mi-temps redonne le résultat final (à la troncature et au bonus de nul près)
    expect(probOf(g, "HTFT", null, "1/1")! + probOf(g, "HTFT", null, "N/1")! + probOf(g, "HTFT", null, "2/1")!).toBeCloseTo(probOf(g, "1X2", null, "1")!, 2);
    expect(probOf(g, "HT_1X2", null, "N")!).toBeGreaterThan(probOf(g, "1X2", null, "N")!);   // plus de nuls à la pause
    expect(probOf(g, "HT_OU", 0.5, "Plus")).toBeCloseTo(1 - Math.exp(-2.7 * 0.45), 4);
    expect(probOf(g, "HMG", null, "2")!).toBeGreaterThan(probOf(g, "HMG", null, "1")!);       // plus de buts en 2e mi-temps
    expect(probOf(g, "OE", null, "Pair")! + probOf(g, "OE", null, "Impair")!).toBeCloseTo(1, 6);
    expect(probOf(g, "MG", null, "0-2")! + probOf(g, "OU", 2.5, "Plus")!).toBeCloseTo(1, 6);
    expect(probOf(g, "EH", -1, "1")).toBeCloseTo(probOf(g, "AH", -1.5, "1")!, 6);            // gagner par 2 buts ou plus
    expect(probOf(g, "WTN", null, "1")!).toBeLessThan(probOf(g, "1X2", null, "1")!);
    expect(probOf(g, "EH", -0.5, "1")).toBeNull();
  });
  it("retrouve les buts attendus à partir de cotes", () => {
    const l = lambdasFromOdds({ c1: 1.24, cN: 6.1, c2: 10.825, plus25: 1.47, moins25: 2.62 })!;
    expect(l.lh + l.la).toBeGreaterThan(3.1); expect(l.lh + l.la).toBeLessThan(3.5);
    expect(l.lh).toBeGreaterThan(l.la * 3);
    expect(probOf(makeGrid(l.lh, l.la), "OU", 2.5, "Plus")).toBeCloseTo((1 / 1.47) / (1 / 1.47 + 1 / 2.62), 3);
  });
});
