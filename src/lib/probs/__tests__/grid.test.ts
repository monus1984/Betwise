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
  it("retrouve les buts attendus à partir de cotes", () => {
    const l = lambdasFromOdds({ c1: 1.24, cN: 6.1, c2: 10.825, plus25: 1.47, moins25: 2.62 })!;
    expect(l.lh + l.la).toBeGreaterThan(3.1); expect(l.lh + l.la).toBeLessThan(3.5);
    expect(l.lh).toBeGreaterThan(l.la * 3);
    expect(probOf(makeGrid(l.lh, l.la), "OU", 2.5, "Plus")).toBeCloseTo((1 / 1.47) / (1 / 1.47 + 1 / 2.62), 3);
  });
});
