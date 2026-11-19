import { describe, expect, it } from "vitest";
import { etat, pourLePalier } from "../regles";

const m = { mise_depart: 1000, objectif: 8000, paliers_prevus: 3, statut: "en_cours" };

describe("montantes", () => {
  it("réinvestit le gain de chaque palier et calcule la cote à trouver", () => {
    const e = etat(m, [{ palier: 1, mise: 1000, cote: 2, statut: "gagne", gain_net: 1000 }]);
    expect(e.capital).toBe(2000);
    expect(e.statut).toBe("en_cours");
    expect(e.coteParPalier).toBeCloseTo(2, 5);
    expect(e.chanceJuste).toBeCloseTo(0.25, 5);
  });
  it("est cassée dès qu'un palier perd, atteinte quand l'objectif est passé", () => {
    expect(etat(m, [{ palier: 1, mise: 1000, cote: 2, statut: "perdu", gain_net: -1000 }]).statut).toBe("cassee");
    expect(etat(m, [{ palier: 1, mise: 1000, cote: 9, statut: "gagne", gain_net: 8000 }]).statut).toBe("atteinte");
  });
  it("ignore les paris annulés et attend la fin d'un palier en cours", () => {
    const e = etat(m, [{ palier: 1, mise: 1000, cote: 2, statut: "annule", gain_net: null }, { palier: 2, mise: 1000, cote: 2, statut: "en_cours", gain_net: null }]);
    expect(e.enCours?.palier).toBe(2);
    expect(e.coteParPalier).toBeNull();
  });
  it("propose des options proches de la cote à trouver", () => {
    const o = [{ p: 0.5, cote: 2 }, { p: 0.7, cote: 1.4 }, { p: 0.45, cote: 2.2 }, { p: 0.3, cote: 3.2 }];
    expect(pourLePalier(o, 2)).toEqual([{ p: 0.5, cote: 2 }, { p: 0.45, cote: 2.2 }]);
  });
});
