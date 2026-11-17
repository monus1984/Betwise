import { describe, expect, it } from "vitest";
import { vigilance, type PariV } from "./vigilance";

const T = Date.parse("2026-11-16T12:00:00Z"), h = (n: number) => new Date(T + n * 3600000).toISOString();
const p = (mise: number, statut: string, place: number, regle: number | null = null, nb = 1): PariV => ({ mise, statut, placed_at: h(place), settled_at: regle === null ? null : h(regle), nb_selections: nb });
const cles = (a: ReturnType<typeof vigilance>) => a.map((x) => x.cle);

describe("points de vigilance", () => {
  it("rien à signaler sur des mises raisonnables", () => {
    expect(vigilance([p(500, "en_cours", 0), p(500, "gagne", -30, -28)], 20000)).toEqual([]);
  });
  it("mise de plus de 10 % : le capital compte les mises déjà sorties du solde", () => {
    const a = vigilance([p(4000, "en_cours", 0), p(2000, "en_cours", -1)], 21620);
    expect(cles(a)).toEqual(["mise"]);                 // 4 000 / 27 620 = 14 %, et 6 000 / 27 620 = 22 % reste sous 25 %
    expect(a[0].regle).toContain("10 %");
  });
  it("plus de 25 % en jeu", () => {
    expect(cles(vigilance([p(3000, "en_cours", 0), p(3000, "en_cours", -1), p(3000, "en_cours", -2)], 11000))).toContain("exposition");
  });
  it("trois pertes de suite, mais pas si un gain les sépare", () => {
    expect(cles(vigilance([p(500, "perdu", -9, -8), p(500, "perdu", -7, -6), p(500, "perdu", -5, -4)], 50000))).toEqual(["serie"]);
    expect(cles(vigilance([p(500, "perdu", -9, -8), p(500, "gagne", -7, -6), p(500, "perdu", -5, -4)], 50000))).toEqual([]);
  });
  it("mise augmentée dans les 24 h après une perte", () => {
    expect(cles(vigilance([p(1000, "perdu", -6, -4), p(2000, "en_cours", -1)], 100000))).toEqual(["apres_perte"]);
    expect(cles(vigilance([p(1000, "perdu", -6, -4), p(1200, "en_cours", -1)], 100000))).toEqual([]);
    expect(cles(vigilance([p(1000, "perdu", -60, -50), p(2000, "en_cours", -1)], 100000))).toEqual([]);
  });
  it("combinés longs en majorité", () => {
    const longs = [0, 1, 2, 3, 4].map((i) => p(100, "gagne", -10 - i, -9 - i, 7)), courts = [5, 6].map((i) => p(100, "gagne", -10 - i, -9 - i, 2));
    expect(cles(vigilance([...longs, ...courts], 100000))).toEqual(["combines"]);
  });
  it("chaque alerte cite son repère", () => {
    for (const a of vigilance([p(9000, "en_cours", 0), p(1000, "perdu", -6, -4)], 10000)) expect(a.regle).toMatch(/Repère/);
  });
});
