import { describe, expect, it } from "vitest";
import { buildCombos, coteEstimee, legsParam, parseLegs, singlesOf, type Option } from "../build";

const id = (k: number) => `00000000-0000-0000-0000-${String(k).padStart(12, "0")}`;
const opt = (m: number, p: number, market = "DC", cote: number | null = null): Option => ({
  matchId: id(m), kickoff: `2026-11-12T${String(10 + m).padStart(2, "0")}:00:00Z`, home: "A", away: "B", comp: "PL",
  market, param: null, sel: "1N", label: "x", famille: "resultat", p, cote, source: "marche",
});

describe("combinés à cote visée", () => {
  const pool = [opt(1, 0.8), opt(1, 0.7, "OU"), opt(2, 0.75), opt(3, 0.85), opt(4, 0.7), opt(5, 0.8), opt(6, 0.72)];
  it("atteint la cible avec une sélection par match et peu de sélections", () => {
    const [c] = buildCombos(pool, 2.5, 1);
    expect(c.atteint).toBe(true);
    expect(c.cote).toBeGreaterThanOrEqual(2.5);
    expect(new Set(c.legs.map((l) => l.matchId)).size).toBe(c.legs.length);
    expect(c.legs.length).toBeLessThanOrEqual(4);
    expect(c.p).toBeCloseTo(c.legs.reduce((x, l) => x * l.p, 1), 9);
  });
  it("plusieurs combinés sans match en commun", () => {
    const cs = buildCombos(pool, 1.8, 3);
    const ids = cs.flatMap((c) => c.legs.map((l) => l.matchId));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("signale une cible hors d'atteinte", () => {
    const cs = buildCombos([opt(1, 0.9), opt(2, 0.9)], 10, 3);
    expect(cs).toHaveLength(1);
    expect(cs[0].atteint).toBe(false);
  });
  it("préfère la cote de référence quand elle existe", () => {
    expect(coteEstimee({ p: 0.5, cote: 1.95 })).toBe(1.95);
    expect(coteEstimee({ p: 0.5, cote: null })).toBeCloseTo(2 / 1.05, 6);
  });
});

describe("simples et liens", () => {
  it("une option par marché et au plus trois par match", () => {
    const s = singlesOf([opt(1, 0.9), opt(1, 0.8), opt(1, 0.7, "OU"), opt(1, 0.6, "BTTS"), opt(1, 0.55, "TT1")]);
    expect(s.map((x) => x.market)).toEqual(["DC", "OU", "BTTS"]);
  });
  it("aller-retour du lien prérempli", () => {
    const o = { ...opt(3, 0.7, "DC_OU"), param: 1.5, sel: "1N|Plus" };
    expect(parseLegs(legsParam([o]))).toEqual([{ match: id(3), market: "DC_OU", param: "1.5", sel: "1N|Plus", cote: "1.36" }]);
  });
});
