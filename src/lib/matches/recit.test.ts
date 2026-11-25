import { describe, expect, it } from "vitest";
import { buildRecit, zoneFr, type RecitInput } from "./recit";
import type { StandingRow } from "./standings";

const rang = (team_nom: string, rang: number, points: number, bp: number, bc: number, forme: string, zone: string | null = null): StandingRow =>
  ({ comp_code: "UNL", groupe: "Ligue A - Groupe A", af_team_id: rang, rang, team_nom, team_id: team_nom, joues: 5, gagnes: 3, nuls: 0, perdus: 2, bp, bc, diff: bp - bc, points, forme, zone, updated_at: "2026-11-15T10:00:00Z" });
const pick = (market: string, param: number | null, sel: string, p: number, cote: number | null = null) => ({ market, param, sel, p, cote, book: null, pModele: null });

const base: RecitInput = {
  home: "Belgique", away: "Italie",
  rangs: { home: rang("Belgique", 3, 9, 8, 6, "WLWLW", "Possible Play-off"), away: rang("Italie", 1, 10, 11, 6, "WWDWL", "Play Offs: Quarter-finals") },
  passes: [
    { date: "2026-11-12T17:00:00Z", home: "Turquie", away: "Belgique", sh: 1, sa: 2, buteurs: [{ n: "A. Güler", e: "1" }, { n: "K. De Bruyne", e: "2" }, { n: "C. De Ketelaere", e: "2" }] },
    { date: "2026-11-12T19:45:00Z", home: "Italie", away: "France", sh: 3, sa: 1, buteurs: [{ n: "M. Retegui", e: "1" }, { n: "M. Retegui", e: "1" }, { n: "M. Olise", e: "2" }] },
    { date: "2026-10-10T18:45:00Z", home: "Italie", away: "Belgique", sh: 0, sa: 2, buteurs: [] },
  ],
  picks: [pick("OU", 0.5, "Plus", 0.95), pick("DC", null, "1N", 0.74), pick("OU", 1.5, "Plus", 0.7, 1.36), pick("DC", null, "12", 0.86), pick("1X2", null, "1", 0.41, 2.3), pick("BTTS", null, "Oui", 0.58), pick("HT_OU", 0.5, "Plus", 0.7)],
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
  it("ajoute domicile/extérieur, calendrier, absents et confrontations quand les données existent (23/11)", () => {
    const table = Array.from({ length: 10 }, (_, i) => ({ ...rang(`E${i}`, i + 4, 5, 8, 8 + i, "WLDLW"), groupe: "Ligue A - Groupe A" }));
    const home = { ...rang("Lorient", 8, 18, 15, 9, "WWWWW"), joues: 12, domicile: { j: 6, g: 4, n: 2, p: 0, bp: 10, bc: 3 } };
    const away = { ...rang("Rennes", 9, 15, 14, 14, "LDLLD"), joues: 12, exterieur: { j: 6, g: 1, n: 1, p: 4, bp: 5, bc: 11 } };
    const r2 = buildRecit({ ...base, home: "Lorient", away: "Rennes", rangs: { home, away }, table: [...table, home, away], passes: [], kickoff: "2026-11-22T14:00:00Z",
      calendrier: { home: [], away: [{ date: "2026-11-26T17:45:00Z", comp: "Ligue Europa", adversaire: "Porto", avant: false }] },
      absents: [{ equipe: "Rennes", joueurs: ["A", "B"] }],
      h2h: [0, 1, 2].map((i) => ({ date: `202${5 - i}-03-01T15:00:00Z`, home: "Lorient", away: "Rennes", sh: 2, sa: 1, buteurs: [] })) });
    const cles = r2.etapes.map((e) => e.cle);
    expect(cles).toEqual(["enjeu", "forme", "terrain", "calendrier", "absents", "face", "chiffre"]);
    const txt = r2.texte;
    expect(txt).toContain("Lorient à domicile cette saison : 4 victoires, 2 nuls, 0 défaite en 6 matchs (10 buts marqués, 3 encaissés) : invaincu à domicile.");
    expect(txt).toContain("Rennes à l'extérieur cette saison : 1 victoire");
    expect(txt).toContain("Rennes rejoue");
    expect(txt).toContain("4 jours après");
    expect(txt).toContain("Rennes : 2 absents annoncés, dont A, B.");
    expect(txt).toContain("Sur les 3 dernières confrontations : 3 victoires de Lorient, 0 nul, 0 victoire de Rennes.");
    expect(txt).toContain("Lorient a gagné les 3 dernières.");
    expect(txt).toContain("5 victoires sur 5");
    expect(txt).toContain("aucune victoire sur les 5 derniers");
    expect(txt).toContain("Lorient a la meilleure défense du classement (9 buts encaissés en 12 matchs).");
  });
  it("sans ces données, aucune étape nouvelle n'apparaît", () => {
    expect(buildRecit({ ...base, h2h: [], absents: [], calendrier: { home: [], away: [] }, kickoff: "2026-11-22T14:00:00Z" }).etapes.map((e) => e.cle)).toEqual(["enjeu", "forme", "dernier", "face", "joueur", "chiffre"]);
  });
});

describe("l'essentiel (25/11)", () => {
  it("ne retient que les faits nets, 4 au plus, en phrases courtes", () => {
    const c = buildRecit({ ...base,
      rangs: { home: { ...rang("Lens", 2, 25, 20, 6, "WWWWD"), joues: 11, domicile: { j: 6, g: 5, n: 1, p: 0, bp: 12, bc: 2 } } as never, away: { ...rang("Nantes", 15, 9, 9, 18, "LLDLL"), joues: 11 } as never },
      home: "Lens", away: "Nantes", passes: [], butsAttendus: 2.6, absents: [{ equipe: "Nantes", joueurs: ["A", "B", "C"] }] }).cles;
    expect(c.length).toBeLessThanOrEqual(4);
    expect(c).toContain("Lens invaincu à domicile cette saison (5 V, 1 N).");
    expect(c.some((x) => x.startsWith("Nantes en difficulté"))).toBe(true);
    expect(c.some((x) => x.startsWith("Écart au classement"))).toBe(true);
    expect(c.every((x) => x.length <= 110)).toBe(true);
    expect(c.some((x) => x.includes("2,6 buts"))).toBe(false); // ni ouvert ni fermé : pas retenu
  });
  it("reste vide quand rien n'est tranché", () => {
    expect(buildRecit({ ...base, rangs: { home: null, away: null }, passes: [], butsAttendus: 2.5 }).cles).toEqual([]);
  });
});

describe("la rédaction de Betster (25/11)", () => {
  const m = (date: string, home: string, away: string, sh: number, sa: number) => ({ date, home, away, sh, sa, buteurs: [] });
  const entree = (picks: RecitInput["picks"]): RecitInput => ({
    home: "Lille OSC", away: "Bayern Munich",
    rangs: { home: { ...rang("Lille OSC", 9, 15, 18, 19, "LDLWD"), joues: 12 }, away: { ...rang("Bayern Munich", 1, 30, 40, 10, "WWDDW"), joues: 12, exterieur: { j: 6, g: 5, n: 1, p: 0, bp: 18, bc: 4 } } },
    passes: [m("2026-11-22", "Lille OSC", "Nantes", 1, 1), m("2026-11-22", "Freiburg", "Bayern Munich", 2, 2), m("2026-11-08", "Lyon", "Lille OSC", 2, 1), m("2026-11-08", "Bayern Munich", "Union Berlin", 3, 1), m("2026-11-01", "Lille OSC", "Angers", 0, 0), m("2026-11-01", "Bayern Munich", "Leverkusen", 2, 2), m("2026-10-25", "Metz", "Lille OSC", 0, 2), m("2026-10-25", "Gladbach", "Bayern Munich", 0, 3)],
    picks, source: "marche", butsAttendus: 2.9, kickoff: "2026-11-26T20:00:00Z",
    absents: [{ equipe: "Bayern Munich", joueurs: ["H. Kane", "M. Olise", "J. Musiala", "L. Díaz"] }],
  });
  it("sur un choix de résultat : classement, forme, absents, puis le choix en une phrase", () => {
    const r = buildRecit(entree([pick("DC", null, "N2", 0.82, 1.25), pick("1X2", null, "2", 0.55, 1.9)])).redaction;
    expect(r.length).toBeLessThanOrEqual(5);
    expect(r[0]).toBe("Bayern Munich est 1er, Lille OSC 9e : l'écart au classement est net.");
    expect(r).toContain("Bayern Munich est invaincu à l'extérieur cette saison (5 V, 1 N).");
    expect(r).toContain("Bayern Munich sera privé de H. Kane, M. Olise, J. Musiala et L. Díaz.");
    expect(r[r.length - 1]).toBe("Je ne vois pas Bayern Munich perdre : nul ou Bayern Munich (82 chances sur 100 d'après les cotes).");
  });
  it("sur un choix de buts : marqués et encaissés, puis le choix", () => {
    const r = buildRecit(entree([pick("BTTS", null, "Oui", 0.62, 1.6)])).redaction;
    expect(r).toContain("Bayern Munich a marqué à chacun de ses 4 derniers matchs.");
    expect(r[r.length - 1]).toBe("Des buts de chaque côté : les deux équipes marquent (62 chances sur 100 d'après les cotes).");
    expect(r.join(" ")).not.toMatch(/sur 4 de ses 4/);
  });
  it("sans cote, donne les faits et ne tranche pas", () => {
    const r = buildRecit(entree([])).redaction;
    expect(r[r.length - 1]).toBe("Pas encore de cote sur ce match : je ne tranche pas.");
  });
});
