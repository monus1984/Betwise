import { describe, expect, it } from "vitest";
import { buildRecit, zoneFr, type RecitInput } from "./recit";
import type { StandingRow } from "./standings";

const rang = (team_nom: string, rang: number, points: number, bp: number, bc: number, forme: string, zone: string | null = null): StandingRow =>
  ({ comp_code: "UNL", groupe: "Ligue A - Groupe A", af_team_id: rang, rang, team_nom, team_id: team_nom, joues: 5, gagnes: 3, nuls: 0, perdus: 2, bp, bc, diff: bp - bc, points, forme, zone, updated_at: "2026-11-15T10:00:00Z" });
const pick = (market: string, param: number | null, sel: string, p: number, cote: number | null = null) => ({ market, param, sel, p, cote, pModele: null });

const base: RecitInput = {
  home: "Belgique", away: "Italie",
  rangs: { home: rang("Belgique", 3, 9, 8, 6, "WLWLW", "Possible Play-off"), away: rang("Italie", 1, 10, 11, 6, "WWDWL", "Play Offs: Quarter-finals") },
  passes: [
    { date: "2026-11-12T17:00:00Z", home: "Turquie", away: "Belgique", sh: 1, sa: 2, buteurs: [{ n: "A. Güler", e: "1" }, { n: "K. De Bruyne", e: "2" }, { n: "C. De Ketelaere", e: "2" }] },
    { date: "2026-11-12T19:45:00Z", home: "Italie", away: "France", sh: 3, sa: 1, buteurs: [{ n: "M. Retegui", e: "1" }, { n: "M. Retegui", e: "1" }, { n: "M. Olise", e: "2" }] },
    { date: "2026-10-10T18:45:00Z", home: "Italie", away: "Belgique", sh: 0, sa: 2, buteurs: [] },
  ],
  picks: [pick("OU", 0.5, "Plus", 0.95), pick("DC", null, "1N", 0.74), pick("OU", 1.5, "Plus", 0.78, 1.25), pick("DC", null, "12", 0.86), pick("1X2", null, "1", 0.41, 2.3), pick("BTTS", null, "Oui", 0.58), pick("HT_OU", 0.5, "Plus", 0.7)],
  source: "marche", butsAttendus: 2.7,
};

describe("récit d'un match", () => {
  const r = buildRecit(base);
  it("déroule les étapes dans l'ordre de l'analyste", () => {
    expect(r.etapes.map((e) => e.cle)).toEqual(["enjeu", "forme", "dernier", "face", "joueur", "chiffre"]);
  });
  it("dit l'enjeu avec le classement et l'écart", () => {
    const e = r.etapes[0].lignes.join(" ");
    expect(e).toContain("Belgique est 3e avec 9 points en 5 matchs, en position de barragiste.");
    expect(e).toContain("Italie est 1er avec 10 points");
    expect(e).toContain("1 point d’écart");
  });
  it("retrouve le dernier match de chacun, le match aller et le buteur en forme", () => {
    expect(r.etapes[2].lignes[0]).toContain("Turquie 1–2 Belgique (K. De Bruyne, C. De Ketelaere pour Belgique)");
    expect(r.etapes[3].titre).toBe("Le match aller");
    expect(r.etapes[3].lignes[0]).toContain("Italie 0–2 Belgique");
    expect(r.etapes[4].lignes).toEqual(["M. Retegui (Italie) : 2 buts sur les 2 derniers matchs."]);
  });
  it("rend un verdict Audacieux, de préférence avec une vraie cote, et propose plus probable et plus osé", () => {
    expect(r.verdict).toMatchObject({ market: "OU", param: 1.5, sel: "Plus", categorie: "audacieux" });
    expect(r.autres.map((c) => c.categorie)).toEqual(["sur", "risque"]);
    expect(r.texte).toContain("Le choix le plus probable :");
    expect(r.texte).not.toContain("mi-temps");
  });
  it("n'invente rien quand la base est vide", () => {
    const v = buildRecit({ ...base, rangs: { home: null, away: null }, passes: [], picks: [], source: null, butsAttendus: null });
    expect(v.etapes).toEqual([]);
    expect(v.verdict).toBeNull();
    expect(v.texte).toContain("aucun choix à mettre en avant");
  });
  it("ne traduit une zone de classement que s'il la connaît", () => {
    expect(zoneFr("Relegation")).toBe("en position de relégation");
    expect(zoneFr("Something new")).toBeNull();
    expect(zoneFr(null)).toBeNull();
  });
});
