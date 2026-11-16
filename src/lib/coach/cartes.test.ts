import { describe, expect, it } from "vitest";
import { cartesDe } from "./cartes";

describe("cartes du Coach", () => {
  it("une carte par écran, trois au plus, sans doublon", () => {
    const c = cartesDe([{ nom: "etat_bankroll" }, { nom: "bilan_paris" }, { nom: "bilan_par_origine" }, { nom: "paris_en_cours" }, { nom: "mes_tests" }]);
    expect(c.map((x) => x.href)).toEqual(["/bankroll", "/bilan", "/paris"]);
  });
  it("un match analysé renvoie à sa fiche", () => {
    expect(cartesDe([{ nom: "analyse_match", sortie: [{ match_id: "abc", match: "A – B", competition: "CAN" }] }])[0]).toMatchObject({ titre: "A – B", href: "/matchs/abc" });
  });
  it("rien pour une fonction sans écran, ni pour une sortie inattendue", () => {
    expect(cartesDe([{ nom: "coups_du_jour" }, { nom: "analyse_match", sortie: { trouve: false } }, {}])).toEqual([]);
  });
});
