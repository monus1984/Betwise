import { describe, expect, it } from "vitest";
import { VIDE, classer, lire, niveau, raison, rendement, resume, reussite, type Proof } from "./proof";

const P = (x: Partial<Proof>): Proof => ({ ...VIDE, ...x });

describe("niveau de preuve d'une source", () => {
  // Cas réel du 16 novembre : 27 pronos, tous saisis après les matchs, 24 justes.
  const koudouss = P({ apresCoup: 27, apresCoupRegles: 27, apresCoupGagnes: 24 });
  const telegram = P({ prouves: 24, prouvesRegles: 24, prouvesGagnes: 19, avecCote: 24, unites: 1.4 });

  it("un prono saisi après le coup d'envoi n'entre pas dans la note, quel que soit son résultat", () => {
    expect(niveau(koudouss)).toBe("non_etabli");
    expect(reussite(koudouss)).toBeNull();
    expect(resume(koudouss)).toBe("Non établi");
    expect(raison(koudouss)).toBe("Ses 27 pronos ont tous été saisis après le coup d’envoi.");
  });
  it("sous le seuil de 10 pronos prouvés réglés : non établi, avec le compte", () => {
    const s = P({ prouves: 6, prouvesRegles: 4, prouvesGagnes: 4 });
    expect(niveau(s)).toBe("non_etabli");
    expect(raison(s)).toBe("4 pronos prouvés réglés sur 10 requis.");
  });
  it("paliers : tendance dès 10, provisoire dès 30, établi dès 100", () => {
    expect([10, 29, 30, 99, 100].map((n) => niveau(P({ prouves: n, prouvesRegles: n })))).toEqual(["tendance", "tendance", "provisoire", "provisoire", "etabli"]);
  });
  it("le résumé donne toujours le volume", () => {
    expect(resume(telegram)).toBe("19 justes sur 24 prouvés");
    expect(rendement(telegram)).toBeCloseTo(1.4 / 24, 6);
  });
  it("le classement écarte les sources non établies, même avec 24 justes sur 27 après coup", () => {
    const { classees, nonEtablies } = classer([{ nom: "K", proof: koudouss }, { nom: "T", proof: telegram }, { nom: "C", proof: P({ prouves: 45, prouvesRegles: 35, prouvesGagnes: 30, avecCote: 35, unites: -0.5 }) }]);
    expect(classees.map((s) => s.nom)).toEqual(["T", "C"]);   // rendement +0,06 devant −0,01
    expect(nonEtablies.map((s) => s.nom)).toEqual(["K"]);
  });
  it("lit une ligne de la vue, chiffres en texte compris", () => {
    expect(lire({ prouves: "24", prouves_regles: 24, prouves_gagnes: 19, prouves_avec_cote: 24, prouves_unites: "1.40", attendu: "0.7100", apres_coup: 0 })).toMatchObject({ prouves: 24, unites: 1.4, attendu: 0.71 });
    expect(lire(null)).toEqual(VIDE);
  });
});
