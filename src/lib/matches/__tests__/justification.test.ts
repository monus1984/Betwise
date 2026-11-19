import { describe, expect, it } from "vitest";
import { bilan, pourquoi, type Joue } from "../justification";

const j = (at: string, h: string, a: string, sh: number, sa: number): Joue => ({ at, h, a, sh, sa });
const passes = [
  j("2026-11-10", "A", "X", 2, 0), j("2026-11-03", "Y", "A", 1, 1), j("2026-10-27", "A", "B", 3, 1),
  j("2026-11-09", "B", "Z", 0, 1), j("2026-11-02", "W", "B", 2, 2),
  j("2026-03-01", "B", "A", 0, 2),
].sort((x, y) => y.at.localeCompare(x.at));

describe("justification d'un match", () => {
  it("compte la forme d'une équipe sur ses derniers matchs", () => {
    expect(bilan("A", passes)).toMatchObject({ n: 4, v: 3, nu: 1, d: 0 });
  });
  it("résume forme et face-à-face sans rien inventer", () => {
    const r = pourquoi({ homeId: "A", awayId: "B", home: "Alpha", away: "Beta" }, passes);
    expect(r.forme).toBe("Forme sur les 4 derniers : Alpha 3V 1N 0D, Beta 0V 1N 3D");
    expect(r.face).toBe("Face-à-face, 2 derniers : 2 victoires Alpha, 0 victoire Beta");
  });
  it("se tait quand l'historique manque", () => {
    expect(pourquoi({ homeId: "Q", awayId: "R", home: "Q", away: "R" }, passes)).toEqual({ forme: null, face: null, buts: null });
  });
});
