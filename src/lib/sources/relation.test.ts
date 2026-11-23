import { describe, expect, it } from "vitest";
import { relation } from "./relation";

const p = (market: string, sel: string, param: number | null = null) => ({ market, param, sel });

describe("relation entre deux paris d'un même match", () => {
  it("les deux marquent confirme plus de 1,5 but ; victoire confirme double chance", () => {
    expect(relation(p("BTTS", "Oui"), p("OU", "Plus", 1.5))).toBe("confirme");
    expect(relation(p("1X2", "1"), p("DC", "1N"))).toBe("confirme");
    expect(relation(p("OU", "Plus", 2.5), p("OU", "Plus", 1.5))).toBe("confirme");
  });
  it("contradictions et paris sans lien", () => {
    expect(relation(p("1X2", "1"), p("1X2", "2"))).toBe("contredit");
    expect(relation(p("OU", "Moins", 1.5), p("BTTS", "Oui"))).toBe("contredit");
    expect(relation(p("1X2", "1"), p("BTTS", "Oui"))).toBe("neutre");
    expect(relation(p("1X2", "1"), p("1X2", "1"))).toBe("meme");
    expect(relation(p("CS", "2-1"), p("1X2", "1"))).toBe("confirme");
    expect(relation(p("CS", "2-1"), p("CS", "1-1"))).toBe("contredit");
  });
});
