import { describe, expect, it } from "vitest";
import { coupsDuJour, memeJour } from "./daily";

const r = (id: string, jour: string, kickoff: string | null, match_id: string | null = id) => ({ id, jour, kickoff, match_id });

describe("coups du jour rattachés au jour du match", () => {
  it("compare en heure d'Abidjan", () => {
    expect(memeJour("2026-11-22T23:30:00Z", "2026-11-22")).toBe(true);
    expect(memeJour("2026-11-23T00:30:00Z", "2026-11-22")).toBe(false);
  });
  it("reprend les coups rangés la veille pour un match du jour et écarte ceux du lendemain", () => {
    const rows = [r("a", "2026-11-21", "2026-11-22T11:30:00Z"), r("b", "2026-11-21", "2026-11-21T20:00:00Z"), r("c", "2026-11-22", "2026-11-23T19:00:00Z"), r("d", "2026-11-22", "2026-11-22T15:00:00Z")];
    expect(coupsDuJour(rows, "2026-11-22").map((x) => x.id)).toEqual(["d", "a"]);
  });
  it("un match ne sert qu'une fois, le rangement du jour passe devant", () => {
    const rows = [r("veille", "2026-11-21", "2026-11-22T18:00:00Z", "m1"), r("jour", "2026-11-22", "2026-11-22T18:00:00Z", "m1")];
    expect(coupsDuJour(rows, "2026-11-22").map((x) => x.id)).toEqual(["jour"]);
  });
  it("ignore les lignes sans match", () => {
    expect(coupsDuJour([r("x", "2026-11-22", null, null)], "2026-11-22")).toEqual([]);
  });
});
