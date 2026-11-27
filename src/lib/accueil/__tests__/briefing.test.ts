import { describe, expect, it } from "vitest";
import { briefing, quand, type PropBrief } from "../briefing";

const now = new Date("2026-11-19T17:00:00Z");
const p = (o: Partial<PropBrief>): PropBrief => ({ matchId: "m1", home: "Bayern", away: "Cologne", kickoff: "2026-11-20T19:30:00Z", label: "Bayern gagne", p: 0.86, profil: "sur", cote: 1.2, bookmaker: "1xBet", ...o });

describe("briefing parlé de Betster", () => {
  it("dit le jour et l'heure simplement", () => {
    expect(quand("2026-11-20T19:30:00Z", now)).toBe("demain à 19 h 30");
    expect(quand("2026-11-19T20:00:00Z", now)).toBe("aujourd’hui à 20 h");
  });
  it("cite toutes les propositions retenues, profil par profil, avec probabilité, risque, cote et raison tirée des données", () => {
    const b = briefing({ prenom: "Mounir", synthese: "3 matchs analysés.", maintenant: now,
      profils: { sur: [p({})], audacieux: [p({ matchId: "m2", home: "Troyes", away: "Le Havre", label: "Moins de 2,5 buts", p: 0.66, profil: "audacieux", cote: null, bookmaker: null })], risque: [] },
      pourquoi: new Map([["m1", { forme: "Forme A", face: "Face-à-face, 2 derniers : 2 victoires Bayern, 0 victoire Cologne", buts: null }]]) });
    expect(b).toHaveLength(3);
    expect(b[0]).toBe("Bonjour Mounir ! 3 matchs analysés.");
    expect(b[1]).toContain("Profil prudent, 1 proposition. Bayern contre Cologne, demain à 19 h 30 : Bayern gagne. Ça passe 86 fois sur 100, risque de perte 14 %, cote 1,20 chez 1xBet. Face-à-face");
    expect(b[2]).toContain("Profil équilibré, 1 proposition. Troyes contre Le Havre");
    expect(b[2]).not.toContain("cote");
  });
  it("n'invente rien quand il n'y a pas de proposition", () => {
    const b = briefing({ prenom: "", synthese: "Pas de match analysé aujourd’hui.", profils: { sur: [], audacieux: [], risque: [] }, pourquoi: new Map() });
    expect(b).toHaveLength(2);
    expect(b[1]).toContain("je ne t’en invente pas");
  });
});
