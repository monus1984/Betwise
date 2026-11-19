import { describe, expect, it } from "vitest";
import { rejouerModele, type MatchHist } from "./modele";
import { proportionnelle, puissance } from "./marge";

describe("rejeu du modèle", () => {
  // Quatre équipes, A la plus forte : un tour par semaine pendant 60 semaines
  const equipes = ["A", "B", "C", "D"], force: Record<string, number> = { A: 2.2, B: 1.4, C: 1.1, D: 0.7 };
  const matchs: MatchHist[] = [];
  let graine = 7; const alea = () => { graine = (graine * 48271) % 2147483647; return graine / 2147483647; };
  const buts = (l: number) => { let k = 0, p = Math.exp(-l), s = p; const u = alea(); while (u > s && k < 9) { k++; p *= l / k; s += p; } return k; };
  for (let w = 0; w < 60; w++) for (const [h, a] of [[equipes[w % 4], equipes[(w + 1) % 4]], [equipes[(w + 2) % 4], equipes[(w + 3) % 4]]]) {
    matchs.push({ ligue: "X", date: new Date(Date.UTC(2025, 0, 6) + w * 7 * 86400000), home: h, away: a, hg: buts(force[h] * 1.1), ag: buts(force[a]), xh: null, xa: null });
  }
  it("ne prédit un match qu'avec des matchs antérieurs, et seulement après assez d'historique", () => {
    const pr = rejouerModele(matchs, {}, { minEntrainement: 40 });
    expect(pr.length).toBe(120 - 40);
    expect(pr[0].date.getTime()).toBe(matchs[40].date.getTime());
    for (const p of pr) expect(p.p[0] + p.p[1] + p.p[2]).toBeCloseTo(1, 6);
  });
  it("reconnaît l'équipe la plus forte", () => {
    // Dans ce calendrier, A ne rencontre D qu'à l'extérieur : A doit rester favori malgré le terrain
    const pr = rejouerModele(matchs, {}, { minEntrainement: 40 }).filter((p) => p.home === "D" && p.away === "A");
    expect(pr.length).toBeGreaterThan(0);
    for (const p of pr) expect(p.p[2]).toBeGreaterThan(p.p[0]);
  });
});

describe("retrait de la marge", () => {
  it("les deux méthodes donnent des probabilités qui somment à 1", () => {
    for (const f of [proportionnelle, puissance]) expect(f([1.5, 4.2, 6.5]).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });
  it("la méthode puissance rend plus de probabilité au favori et en retire à l'outsider", () => {
    const a = proportionnelle([1.3, 5.5, 9]), b = puissance([1.3, 5.5, 9]);
    expect(b[0]).toBeGreaterThan(a[0]);
    expect(b[2]).toBeLessThan(a[2]);
  });
  it("sans marge, rien ne change", () => {
    expect(puissance([2, 2])).toEqual([0.5, 0.5]);
  });
});
