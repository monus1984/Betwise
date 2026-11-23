import { describe, expect, it } from "vitest";
import { relation } from "./relation";

const p = (market: string, sel: string, param: number | null = null) => ({ market, param, sel });

describe("relation entre deux paris d'un même match", () => {
  it("les deux marquent entraîne plus de 1,5 but (pas l'inverse) ; victoire entraîne double chance", () => {
    expect(relation(p("BTTS", "Oui"), p("OU", "Plus", 1.5))).toBe("entraine");
    expect(relation(p("OU", "Plus", 1.5), p("BTTS", "Oui"))).toBe("suit");
    expect(relation(p("1X2", "1"), p("DC", "1N"))).toBe("entraine");
    expect(relation(p("OU", "Plus", 2.5), p("OU", "Plus", 1.5))).toBe("entraine");
  });
  it("contradictions et paris sans lien", () => {
    expect(relation(p("1X2", "1"), p("1X2", "2"))).toBe("contredit");
    expect(relation(p("OU", "Moins", 1.5), p("BTTS", "Oui"))).toBe("contredit");
    expect(relation(p("1X2", "1"), p("BTTS", "Oui"))).toBe("neutre");
    expect(relation(p("1X2", "1"), p("1X2", "1"))).toBe("meme");
    expect(relation(p("CS", "2-1"), p("1X2", "1"))).toBe("entraine");
    expect(relation(p("CS", "2-1"), p("CS", "1-1"))).toBe("contredit");
  });
});
