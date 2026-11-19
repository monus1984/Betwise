import { describe, expect, it } from "vitest";
import { lambdasFromOdds, makeGrid, probOf } from "../grid";
import { sansMarge } from "../marge";

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
    // la grille redonne la probabilité « plus de 2,5 » tirée des cotes, avec la méthode de retrait de marge en vigueur
    expect(probOf(makeGrid(l.lh, l.la), "OU", 2.5, "Plus")).toBeCloseTo(sansMarge([1.47, 2.62])[0], 3);
    const prop = lambdasFromOdds({ c1: 1.24, cN: 6.1, c2: 10.825, plus25: 1.47, moins25: 2.62 }, "proportionnelle")!;
    expect(probOf(makeGrid(prop.lh, prop.la), "OU", 2.5, "Plus")).toBeCloseTo((1 / 1.47) / (1 / 1.47 + 1 / 2.62), 3);
    // méthode puissance : le favori est annoncé plus haut, donc plus de buts attendus pour lui
    expect(l.lh / l.la).toBeGreaterThan(prop.lh / prop.la);
  });
});

describe("marchés par mi-temps ajoutés le 18/11", () => {
  const g = makeGrid(1.6, 1.1);
  it("les deux marquent, double chance et buts d'une équipe se calculent aussi par mi-temps", () => {
    expect(probOf(g, "H2_BTTS", null, "Oui")! + probOf(g, "H2_BTTS", null, "Non")!).toBeCloseTo(1, 6);
    expect(probOf(g, "H2_DC", null, "1N")!).toBeCloseTo(probOf(g, "H2_1X2", null, "1")! + probOf(g, "H2_1X2", null, "N")!, 6);
    expect(probOf(g, "HT_TT1", 0.5, "Plus")! + probOf(g, "HT_TT1", 0.5, "Moins")!).toBeCloseTo(1, 6);
    expect(probOf(g, "H2_TT2", 0.5, "Plus")!).toBeLessThan(probOf(g, "TT2", 0.5, "Plus")!);
  });
  it("gagner au moins une mi-temps est plus probable que gagner la première, sans être acquis", () => {
    const w = probOf(g, "WEH", null, "1")!;
    expect(w).toBeGreaterThan(Math.max(probOf(g, "HT_1X2", null, "1")!, probOf(g, "H2_1X2", null, "1")!));
    expect(w).toBeLessThan(1);
    expect(probOf(g, "WEH", null, "N")).toBeNull();
  });
  it("un but dans chaque mi-temps demande au moins deux buts", () => {
    const oui = probOf(g, "BH", null, "Oui")!;
    expect(oui + probOf(g, "BH", null, "Non")!).toBeCloseTo(1, 6);
    expect(oui).toBeLessThan(probOf(g, "OU", 1.5, "Plus")!);
  });
  it("un pari gardé tel quel n'a pas de probabilité", () => {
    expect(probOf(g, "LIBRE", null, "Bruno Fernandes décisif")).toBeNull();
    expect(probOf(g, "PKB", null, "Oui")).toBeNull();
  });
});

describe("marchés ajoutés le 19/11", () => {
  const g = makeGrid(1.7, 1.05);
  const p = (m: string, prm: number | null, s: string) => probOf(g, m, prm, s)!;
  it("les issues d'un même marché se partagent bien 100 %", () => {
    expect(p("OE1", null, "Pair") + p("OE1", null, "Impair")).toBeCloseTo(1, 6);
    expect(p("HT_OE", null, "Pair") + p("HT_OE", null, "Impair")).toBeCloseTo(1, 6);
    expect(["0-0", "1-1", "2-2", "3-99"].reduce((s, x) => s + p("MG2", null, x), 0)).toBeCloseTo(1, 4);
    expect(["0-0", "1-1", "2-2", "3-3", "4-4", "5-99"].reduce((s, x) => s + p("MG", null, x), 0)).toBeCloseTo(1, 6);
    expect(p("FTS", null, "1") + p("FTS", null, "2") + p("FTS", null, "Aucun")).toBeCloseTo(1, 6);
    expect(p("H2_DNB", null, "1") + p("H2_DNB", null, "2")).toBeCloseTo(1, 6);
  });
  it("le favori marque plus souvent en premier, gagne plus souvent les deux mi-temps", () => {
    expect(p("FTS", null, "1")).toBeGreaterThan(p("FTS", null, "2"));
    expect(p("WBH", null, "1")).toBeGreaterThan(p("WBH", null, "2"));
    expect(p("WBH", null, "1")).toBeLessThan(p("WEH", null, "1"));
    expect(p("SBH", null, "1")).toBeLessThan(p("TT1", 1.5, "Plus")); // marquer dans chaque mi-temps suppose au moins 2 buts
  });
  it("un combiné compté score par score retrouve les combinés déjà connus", () => {
    expect(p("COMBO", null, "1X2:1 & OU@2.5:Plus")).toBeCloseTo(p("1X2_OU", 2.5, "1|Plus"), 6);
    expect(p("COMBO", null, "DC:1N & BTTS:Oui")).toBeCloseTo(p("DC_BTTS", null, "1N|Oui"), 6);
    expect(p("COMBO", null, "OU@2.5:Plus & BTTS:Oui")).toBeCloseTo(p("OU_BTTS", 2.5, "Plus|Oui"), 6);
    expect(p("COMBO", null, "HT_1X2:1 & H2_1X2:1")).toBeCloseTo(p("WBH", null, "1"), 4);
    expect(p("COMBO", null, "HT_1X2:1 & 1X2:1")).toBeCloseTo(p("HTFT", null, "1/1"), 4);
    // deux conditions qui vont ensemble : plus probable que le produit des deux
    expect(p("COMBO", null, "1X2:1 & TT1@1.5:Plus")).toBeGreaterThan(p("1X2", null, "1") * p("TT1", 1.5, "Plus"));
    // trois conditions, dont une contradictoire
    expect(p("COMBO", null, "1X2:1 & BTTS:Non & TT2@0.5:Plus")).toBe(0);
  });
  it("pas de probabilité quand une condition ne se règle pas sur le score", () => {
    expect(probOf(g, "COMBO", null, "1X2:1 & CORN@8.5:Plus")).toBeNull();
    expect(probOf(g, "COMBO", null, "1X2:1")).toBeNull();
    expect(probOf(g, "GB", 15, "Oui")).toBeNull();
    expect(probOf(g, "HT_WEH", null, "1")).toBeNull();
  });
});
