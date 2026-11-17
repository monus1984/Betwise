import { describe, expect, it } from "vitest";
import { direForce, forces, type Ligne } from "./forces";

const l = (market: string, sel: string, resultat: string, param: number | null = null): Ligne => ({ market, sel, resultat, param });

describe("points forts", () => {
  const lignes = [
    ...Array.from({ length: 9 }, () => l("OU", "Plus", "gagne", 1.5)), l("OU", "Plus", "perdu", 1.5),
    l("OU", "Moins", "perdu", 1.5), l("OU", "Moins", "perdu", 1.5), l("OU", "Moins", "gagne", 1.5),
    l("BTTS", "Oui", "gagne"), l("BTTS", "Oui", "gagne"), l("BTTS", "Oui", "gagne"),
    l("1X2", "1", "gagne"), l("1X2", "2", "perdu"), l("1X2", "1", "en_attente"),
  ];
  const f = forces(lignes);
  it("classe par réussite, puis par volume, et sépare plus et moins", () => {
    expect(f.map((x) => x.libelle)).toEqual(["Les deux équipes marquent", "Plus de 1,5 but", "Moins de 1,5 but"]);
    expect(f[1]).toMatchObject({ gagnes: 9, regles: 10 });
  });
  it("ignore ce qui a moins de 3 résultats et ce qui n'est pas réglé", () => {
    expect(f.some((x) => x.cle === "1X2")).toBe(false);
  });
  it("se dit en une phrase, avec le volume", () => {
    expect(direForce(f[1])).toBe("Plus de 1,5 but : 9 sur 10 (90 %)");
  });
});
