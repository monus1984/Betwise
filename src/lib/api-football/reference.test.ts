import { describe, expect, it } from "vitest";
import { referenceMediane } from "./bookmakers";
import type { AfOdds } from "./client";

const bk = (id: number, h: string, d: string, a: string, over?: string, under?: string) => ({ id, name: `b${id}`, bets: [
  { name: "Match Winner", values: [{ value: "Home", odd: h }, { value: "Draw", odd: d }, { value: "Away", odd: a }] },
  ...(over ? [{ name: "Goals Over/Under", values: [{ value: "Over 2.5", odd: over }, { value: "Under 2.5", odd: under! }] }] : []),
] });

describe("cote de référence relevée avec la cote 1xBet", () => {
  it("médiane des autres bookmakers, 1xBet exclu", () => {
    const o: AfOdds = { fixture: { id: 1 }, update: "2026-11-22T17:00:00Z", bookmakers: [bk(11, "9", "9", "9", "9", "9"), bk(1, "2.0", "3.4", "3.8", "1.9", "1.9"), bk(2, "2.1", "3.3", "3.6", "1.95", "1.85"), bk(3, "1.9", "3.5", "4.0", "1.85", "1.95"), bk(4, "2.2", "3.2", "3.5", "2.0", "1.8")] };
    const r = referenceMediane(o, 11);
    expect(r.find((x) => x.selection === "1")?.cote).toBe(2.05);
    expect(r.find((x) => x.selection === "Plus")?.cote).toBe(1.925);
    expect(r).toHaveLength(5);
  });
  it("rien sous 4 bookmakers", () => {
    const o: AfOdds = { fixture: { id: 1 }, bookmakers: [bk(1, "2", "3", "4"), bk(2, "2", "3", "4"), bk(3, "2", "3", "4")] };
    expect(referenceMediane(o, 11)).toEqual([]);
  });
});
