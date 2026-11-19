import { describe, expect, it } from "vitest";
import { bilanDe, forcesEtFaiblesses, type LigneAxe, type Prono } from "../analyse";

const l = (axe: LigneAxe["axe"], valeur: string, nb: number, gagnes: number): LigneAxe => ({ axe, valeur, nb, gagnes, rendement: null });

describe("forces et faiblesses d'une source", () => {
  it("retient les critères nettement au-dessus ou au-dessous de la réussite générale, avec assez de résultats", () => {
    const r = forcesEtFaiblesses([l("marche", "OU", 10, 9), l("marche", "1X2", 10, 4), l("competition", "PL", 6, 4), l("marche", "BTTS", 2, 2)], 0.65, { PL: "Premier League" });
    expect(r.forces.map((x) => x.libelle)).toEqual(["Plus / moins de buts"]);
    expect(r.faiblesses.map((x) => x.libelle)).toEqual(["Victoire / nul"]);
  });
  it("ne dit rien sans réussite générale ou sans écart net", () => {
    expect(forcesEtFaiblesses([l("marche", "OU", 10, 7)], null)).toEqual({ forces: [], faiblesses: [] });
    expect(forcesEtFaiblesses([l("marche", "OU", 10, 7)], 0.68)).toEqual({ forces: [], faiblesses: [] });
  });
});

describe("bilan d'une source", () => {
  const p = (resultat: string, marche = "OU", cote: number | null = 2): Prono => ({ source_id: "s", marche, competition: "PL", risque: null, resultat, cote });
  it("ne compte que les pronos réglés : ni les en attente ni les remboursés", () => {
    const b = bilanDe([p("gagne"), p("gagne"), p("perdu"), p("en_attente"), p("en_attente"), p("rembourse")]);
    expect(b.regles).toBe(3);
    expect(b.taux).toBeCloseTo(2 / 3, 5);
    expect(b.lignes.find((l) => l.axe === "marche")).toMatchObject({ nb: 3, gagnes: 2 });
  });
  it("calcule le rendement à mise égale sur les cotes connues", () => {
    expect(bilanDe([p("gagne", "OU", 2), p("perdu", "OU", 3), p("gagne", "OU", null)]).rendement).toBeCloseTo(0, 5);
    expect(bilanDe([p("en_attente")]).taux).toBeNull();
  });
});
