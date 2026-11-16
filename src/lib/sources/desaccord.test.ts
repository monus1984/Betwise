import { describe, expect, it } from "vitest";
import { contredit, desaccords, type PronoM } from "./desaccord";

const p = (source: string, market: string, sel: string, param: number | null = null): PronoM => ({ source, market, sel, param });

describe("désaccords entre sources", () => {
  it("même marché, issues opposées", () => {
    expect(contredit(p("A", "1X2", "1"), p("B", "1X2", "2"))).toBe(true);
    expect(contredit(p("A", "OU", "Plus", 2.5), p("B", "OU", "Moins", 2.5))).toBe(true);
    expect(contredit(p("A", "BTTS", "Oui"), p("B", "BTTS", "non"))).toBe(true);
  });
  it("pas de désaccord si les deux peuvent passer", () => {
    expect(contredit(p("A", "OU", "Plus", 1.5), p("B", "OU", "Moins", 3.5))).toBe(false);  // lignes différentes
    expect(contredit(p("A", "1X2", "1"), p("B", "DC", "1N"))).toBe(false);                  // la victoire est dans la double chance
    expect(contredit(p("A", "DC", "1N"), p("B", "DC", "N2"))).toBe(false);                  // le nul les met d'accord
    expect(contredit(p("A", "1X2", "1"), p("B", "OU", "Plus", 2.5))).toBe(false);
  });
  it("résultat contre double chance sans issue commune", () => {
    expect(contredit(p("A", "1X2", "2"), p("B", "DC", "1N"))).toBe(true);
    expect(contredit(p("A", "1X2", "N"), p("B", "DC", "12"))).toBe(true);
  });
  it("une source ne se contredit pas elle-même", () => {
    expect(contredit(p("A", "1X2", "1"), p("A", "1X2", "2"))).toBe(false);
  });
  it("liste chaque paire une fois", () => {
    expect(desaccords([p("A", "1X2", "1"), p("B", "1X2", "2"), p("C", "1X2", "1")])).toHaveLength(2);
  });
});
