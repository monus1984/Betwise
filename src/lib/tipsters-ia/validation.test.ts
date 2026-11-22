import { describe, expect, it } from "vitest";
import { valider, type Option } from "./validation";

const NOW = Date.parse("2026-11-23T08:00:00Z");
const o = (id: string, matchId: string, cote: number, kickoff = "2026-11-23T15:00:00Z"): Option => ({ id, matchId, market: "1X2", param: null, sel: "1", label: "x", cote, releveAt: "2026-11-23T07:40:00Z", kickoff });
const options = new Map([o("M1.1", "a", 1.5), o("M1.2", "a", 2.1), o("M2.1", "b", 1.25), o("M3.1", "c", 1.05), o("M4.1", "d", 1.8, "2026-11-23T08:05:00Z")].map((x) => [x.id, x]));
const etat = { bankroll: 100_000, enJeu: 0, parisDuJour: 0, matchsJoues: new Set<string>() };
const raison = "Forme nettement meilleure à domicile, deux absents chez l'adversaire.";

describe("validation des décisions d'un tipster IA", () => {
  it("garde les options réelles, la cote relevée et plafonne la mise", () => {
    const r = valider([{ option: "M1.1", mise: 25_000, probabilite: 0.7, raison }], options, etat, NOW);
    expect(r.retenus).toHaveLength(1);
    expect(r.retenus[0].cote).toBe(1.5);
    expect(r.retenus[0].mise).toBe(10_000);
  });
  it("rejette option inventée, cote sous 1,10, match trop proche, deuxième pari sur un match", () => {
    const r = valider([
      { option: "M9.9", mise: 1000, probabilite: 0.6, raison },
      { option: "M3.1", mise: 1000, probabilite: 0.9, raison },
      { option: "M4.1", mise: 1000, probabilite: 0.6, raison },
      { option: "M1.1", mise: 1000, probabilite: 0.6, raison },
      { option: "M1.2", mise: 1000, probabilite: 0.5, raison },
    ], options, etat, NOW);
    expect(r.retenus.map((x) => x.id)).toEqual(["M1.1"]);
    expect(r.rejets).toHaveLength(4);
  });
  it("respecte l'engagement maximal et la limite du jour", () => {
    expect(valider([{ option: "M2.1", mise: 5000, probabilite: 0.8, raison }], options, { ...etat, enJeu: 38_000 }, NOW).retenus).toHaveLength(0);
    expect(valider([{ option: "M2.1", mise: 5000, probabilite: 0.8, raison }], options, { ...etat, parisDuJour: 8 }, NOW).retenus).toHaveLength(0);
  });
});
