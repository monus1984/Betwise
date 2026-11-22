import { describe, expect, it } from "vitest";
import { bilan, choisir, evaluer as evaluerA, mise, raison, relevesComparables, type Candidat, type DejaJoue } from "./strategie";

const NOW = Date.parse("2026-11-22T17:50:00Z");
const evaluer = (x: Candidat) => evaluerA(x, NOW);

const c = (o: Partial<Candidat>): Candidat => ({
  matchId: "m1", kickoff: "2026-11-22T15:00:00Z", comp: "PL", market: "1X2", param: null, sel: "1", p: 0.7, pModele: null, cote: 1.5, coteRef: 1.42, coteAt: "2026-11-22T16:30:00Z", refAt: "2026-11-22T15:17:00Z", ...o,
});
const vide = (): DejaJoue => ({ matchs: new Set(), parProfil: { sur: 0, audacieux: 0, risque: 0 }, parFamille: {}, total: 0 });

describe("tipster virtuel", () => {
  it("garde un prix au-dessus de la valeur juste", () => {
    const e = evaluer(c({}))!;
    expect(e.profil).toBe("audacieux");
    expect(e.valeur).toBeCloseTo(0.05, 5);
  });
  it("refuse sans écart suffisant, les amicaux, les cotes trop hautes et le désaccord du modèle", () => {
    expect(evaluer(c({ cote: 1.44 }))).toBeNull(); // +0,8 % < 2 %
    expect(evaluer(c({ comp: "AMI" }))).toBeNull();
    expect(evaluer(c({ p: 0.3, cote: 3.6 }))).toBeNull();
    expect(evaluer(c({ pModele: 0.6 }))).toBeNull();
    expect(evaluer(c({ p: 0.95, cote: 1.05 }))).toBeNull(); // sous 1,10
  });
  it("le modèle corrige la valeur juste", () => {
    expect(evaluer(c({ pModele: 0.75 }))!.pJuste).toBeCloseTo(0.71, 5);
  });
  it("un pari par match, deux par profil, six par jour", () => {
    const cands = [
      c({ matchId: "a", cote: 1.6 }), c({ matchId: "a", sel: "N", p: 0.65, cote: 1.7 }),
      c({ matchId: "b", cote: 1.55 }), c({ matchId: "c", cote: 1.52 }), c({ matchId: "d", cote: 1.62 }),
    ];
    const out = choisir(cands, vide(), NOW);
    // d et a remplissent les deux places Audacieux, b reste dehors, c passe en Équilibré
    expect(out.map((x) => x.matchId)).toEqual(["d", "a", "c"]);
  });
  it("tient compte de ce qui a déjà été joué", () => {
    const d = vide(); d.matchs.add("a"); d.total = 6;
    expect(choisir([c({ matchId: "z" })], d, NOW)).toEqual([]);
  });
  it("refuse deux relevés trop éloignés ou une cote 1xBet trop vieille (cas du 22/11 au matin)", () => {
    const matin = Date.parse("2026-11-22T09:04:00Z");
    const cas = { coteAt: "2026-11-22T00:01:00Z", refAt: "2026-11-21T15:17:00Z" };
    expect(relevesComparables(cas, matin)).toBe(false);
    expect(evaluerA(c(cas), matin)).toBeNull();
    expect(relevesComparables({ coteAt: "2026-11-22T16:30:00Z", refAt: "2026-11-22T15:17:00Z" }, NOW)).toBe(true);
    expect(relevesComparables({ coteAt: "2026-11-22T10:00:00Z", refAt: "2026-11-22T09:30:00Z" }, NOW)).toBe(false); // relevée il y a près de 8 h
    expect(relevesComparables({ coteAt: "2026-11-22T16:30:00Z", refAt: null }, NOW)).toBe(false);
  });
  it("mise : quart de Kelly borné et arrondi", () => {
    expect(mise(100_000, 0.1)).toBe(2500);
    expect(mise(100_000, 0.5)).toBe(3000);
    expect(mise(100_000, 0.001)).toBe(500);
  });
  it("raison chiffrée et bilan", () => {
    expect(raison(evaluer(c({}))!)).toContain("1xBet paie 1,50");
    const b = bilan([{ mise: 1000, gain_net: 500, statut: "gagne" }, { mise: 1000, gain_net: -1000, statut: "perdu" }, { mise: 800, gain_net: null, statut: "en_cours" }]);
    expect(b).toMatchObject({ bankroll: 99_500, enJeu: 800, regles: 2, gagnes: 1 });
    expect(b.roi).toBeCloseTo(-0.25, 5);
  });
});
