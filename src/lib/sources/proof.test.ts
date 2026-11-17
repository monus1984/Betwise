import { describe, expect, it } from "vitest";
import { VIDE, classer, lire, niveau, raison, rendement, resume, reussite, type Proof } from "./proof";

const P = (x: Partial<Proof>): Proof => ({ ...VIDE, ...x });

describe("note d'une source", () => {
  // La vue compte tous les pronos non annulés. Cas réel : 27 pronos saisis après les matchs, 24 justes sur 26 réglés.
  const koudouss = P({ prouves: 27, prouvesRegles: 26, prouvesGagnes: 24, avecCote: 26, unites: 5.31, apresCoup: 27, apresCoupRegles: 26, apresCoupGagnes: 24 });
  const telegram = P({ prouves: 24, prouvesRegles: 24, prouvesGagnes: 19, avecCote: 24, unites: 0.96 });

  it("un prono saisi après le match compte comme les autres", () => {
    expect(niveau(koudouss)).toBe("tendance");
    expect(reussite(koudouss)).toBeCloseTo(24 / 26, 6);
    expect(resume(koudouss)).toBe("24 justes sur 26");
  });
  it("les chiffres s'affichent dès le premier prono réglé, sans attendre un seuil", () => {
    const s = P({ prouves: 6, prouvesRegles: 4, prouvesGagnes: 3 });
    expect(niveau(s)).toBe("debut");
    expect(resume(s)).toBe("3 justes sur 4");
    expect(raison(s)).toBe("");
  });
  it("sans prono réglé : une invitation à en charger, pas un refus", () => {
    expect(resume(VIDE)).toBe("à suivre");
    expect(raison(VIDE)).toContain("ajoute ceux qu’elle publie");
    expect(resume(P({ prouves: 2 }))).toBe("en attente");
  });
  it("paliers : tendance dès 10, confirmé dès 30, établi dès 100", () => {
    expect([1, 9, 10, 29, 30, 99, 100].map((n) => niveau(P({ prouves: n, prouvesRegles: n })))).toEqual(["debut", "debut", "tendance", "tendance", "provisoire", "provisoire", "etabli"]);
  });
  it("classement : dès 3 pronos réglés, par rendement", () => {
    const { classees, nonEtablies } = classer([{ nom: "K", proof: koudouss }, { nom: "T", proof: telegram }, { nom: "D", proof: P({ prouves: 1, prouvesRegles: 1, prouvesGagnes: 1 }) }]);
    expect(classees.map((s) => s.nom)).toEqual(["K", "T"]);   // +0,20 par prono devant +0,04
    expect(nonEtablies.map((s) => s.nom)).toEqual(["D"]);
    expect(rendement(telegram)).toBeCloseTo(0.04, 6);
  });
  it("lit une ligne de la vue, chiffres en texte compris", () => {
    expect(lire({ prouves: "24", prouves_regles: 24, prouves_gagnes: 19, prouves_avec_cote: 24, prouves_unites: "1.40", attendu: "0.7100", apres_coup: 0 })).toMatchObject({ prouves: 24, unites: 1.4, attendu: 0.71 });
    expect(lire(null)).toEqual(VIDE);
  });
});
