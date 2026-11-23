import { describe, expect, it } from "vitest";
import { consensus, soutient, type Avis } from "./consensus";

const a = (sourceId: string, regles: number, market: string, sel: string, param: number | null = null, ia = false): Avis => ({ sourceId, nom: sourceId, ia, regles, market, param, sel, cote: null });
const verdict = { market: "DC", param: null, sel: "1N", label: "Lorient ou nul" };

describe("ce que disent les sources", () => {
  it("un avis plus exigeant soutient le choix de Betster", () => {
    expect(soutient({ market: "1X2", param: null, sel: "1" }, verdict)).toBe(true);
    expect(soutient({ market: "1X2", param: null, sel: "2" }, verdict)).toBe(false);
    expect(soutient({ market: "OU", param: 2.5, sel: "Plus" }, { market: "OU", param: 1.5, sel: "Plus" })).toBe(true);
    expect(soutient({ market: "OU", param: 1.5, sel: "Plus" }, { market: "OU", param: 2.5, sel: "Plus" })).toBe(false);
  });
  it("les 5 IA ne comptent qu'une fois, seules les sources confirmées pèsent", () => {
    const avis = [a("ia1", 0, "1X2", "1", null, true), a("ia2", 0, "DC", "1N", null, true), a("ia3", 0, "1X2", "1", null, true), a("petit", 4, "1X2", "2"), a("pro", 40, "DC", "1N")];
    const c = consensus(avis, verdict);
    expect(c.pour).toEqual({ confirmees: 1, autres: 0, ia: 3 });
    expect(c.contre).toEqual({ confirmees: 0, autres: 1, ia: 0 });
    expect(c.conclusion).toContain("1 source confirmée et les tipsters IA vont dans le même sens");
    expect(c.conclusion).not.toMatch(/\bsûr/);
    expect(c.groupes[0].betster).toBe(true);
  });
  it("désaccord d'une source confirmée : signal de prudence ; rien de confirmé : choix sur les cotes seules", () => {
    expect(consensus([a("pro", 50, "1X2", "2")], verdict).conclusion).toContain("signal de prudence");
    expect(consensus([a("petit", 3, "1X2", "2")], verdict).conclusion).toContain("cotes seules");
    expect(consensus([a("pro", 50, "1X2", "2")], null).conclusion).toContain("pas d'avis");
  });
});
