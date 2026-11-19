import { describe, expect, it } from "vitest";
import { forcesEtFaiblesses, type LigneAxe } from "../analyse";

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
