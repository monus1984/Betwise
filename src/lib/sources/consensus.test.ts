import { describe, expect, it } from "vitest";
import { consensus, lignesAvis, pointDuJour, soutient, type Avis } from "./consensus";

const a = (sourceId: string, regles: number, market: string, sel: string, param: number | null = null, ia = false): Avis => ({ sourceId, nom: sourceId, ia, regles, market, param, sel, cote: null });
const verdict = { market: "DC", param: null, sel: "1N", label: "Lorient ou nul" };

describe("ce que disent les sources", () => {
  it("un avis plus exigeant soutient le choix de Betster", () => {
    expect(soutient({ market: "1X2", param: null, sel: "1" }, verdict)).toBe(true);
    expect(soutient({ market: "1X2", param: null, sel: "2" }, verdict)).toBe(false);
    expect(soutient({ market: "OU", param: 2.5, sel: "Plus" }, { market: "OU", param: 1.5, sel: "Plus" })).toBe(true);
    expect(soutient({ market: "OU", param: 1.5, sel: "Plus" }, { market: "OU", param: 2.5, sel: "Plus" })).toBe(false);
  });
  it("les 5 IA ne comptent qu'une fois, chaque source humaine compte", () => {
    const avis = [a("ia1", 0, "1X2", "1", null, true), a("ia2", 0, "DC", "1N", null, true), a("ia3", 0, "1X2", "1", null, true), a("petit", 4, "1X2", "2"), a("pro", 40, "DC", "1N")];
    const c = consensus(avis, verdict);
    expect(c.pour).toEqual({ confirmees: 1, autres: 0, ia: 3 });
    expect(c.contre).toEqual({ confirmees: 0, autres: 1, ia: 0 });
    expect(c.conclusion).toContain("1 source (dont 1 confirmée) et les tipsters IA avec lui, 1 source contre. La majorité le conforte.");
    expect(c.conclusion).not.toMatch(/\bsûr/);
    expect(c.groupes[0].betster).toBe(true);
  });
  it("un nouveau tipster compte aussi ; sans aucun avis, choix sur les cotes seules", () => {
    expect(consensus([a("pro", 50, "1X2", "2")], verdict).conclusion).toContain("signal de prudence");
    expect(consensus([a("petit", 3, "1X2", "2")], verdict).conclusion).toContain("1 source pense l'inverse");
    expect(consensus([a("petit", 3, "1X2", "1"), a("nouveau", 0, "DC", "1N")], verdict).conclusion).toContain("2 sources vont dans le même sens");
    expect(consensus([a("autre", 3, "OU", "Plus", 2.5)], verdict).conclusion).toContain("cotes seules");
    expect(consensus([a("pro", 50, "1X2", "2")], null).conclusion).toContain("pas d'avis");
  });
  it("chaque prono affiche qui le confirme, même sur un autre marché ; les IA ne se confirment pas entre elles", () => {
    const l = lignesAvis([a("Grok", 0, "BTTS", "Oui", null, true), a("ChatGPT", 0, "OU", "Plus", 1.5, true), a("Paul", 3, "OU", "Plus", 1.5), a("Awa", 12, "OU", "Moins", 1.5)], { market: "BTTS", param: null, sel: "Oui" });
    const paul = l.find((x) => x.avis.sourceId === "Paul")!;
    expect(paul.confirment).toEqual(["IA"]);
    expect(paul.contredisent).toEqual(["Awa"]);
    expect(paul.betster).toBe("avec"); // le verdict « les deux marquent » entraîne « plus de 1,5 »
    const grok = l.find((x) => x.avis.sourceId === "Grok")!;
    expect(grok.confirment).toEqual([]); // « plus de 1,5 » n'entraîne pas « les deux marquent »
    expect(grok.contredisent).toEqual(["Awa"]);
  });
  it("le point du jour : les paris portés par le plus de sources, un par match, et un combiné jusqu'à 3,00", () => {
    const c = (matchId: string, voix: number, p: number, cote: number) => ({ matchId, match: matchId, label: `pari ${matchId}${voix}`, voix, qui: [], p, cote });
    const r = pointDuJour([c("A", 4, 0.8, 1.25), c("A", 2, 0.9, 1.1), c("B", 3, 0.7, 1.4), c("C", 2, 0.85, 1.2), c("D", 1, 0.95, 1.05), c("E", 3, 0.55, 1.9)]);
    expect(r.simples.map((x) => x.matchId)).toEqual(["A", "B", "E", "C"]);
    expect(r.simples[0].voix).toBe(4);
    // A·C (1,50) est la combinaison la plus probable qui atteint 1,50
    expect(r.combine!.selections.map((x) => x.matchId).sort()).toEqual(["A", "C"]);
    expect(r.combine!.cote).toBe(1.5);
    expect(pointDuJour([c("A", 3, 0.9, 1.1), c("B", 3, 0.9, 1.1)]).combine).toBeNull(); // 1,21 : trop bas
  });
  it("la conclusion compte une source dont le pari est entraîné par celui de Betster (24/11)", () => {
    const v = { market: "TT1", param: 2.5, sel: "Plus", label: "Real : plus de 2,5 buts" };
    const c = consensus([a("s4", 3, "OU", "Plus", 2.5)], v);
    expect(c.pour.autres).toBe(1);
    expect(c.conclusion).toContain("va dans le même sens");
  });
});
