import { describe, expect, it } from "vitest";
import { enjeux, zoneDe } from "./enjeux";
import type { StandingRow } from "./standings";

const row = (team_nom: string, rang: number, points: number, zone: string | null = null, joues = 12): StandingRow =>
  ({ comp_code: "PD", groupe: "", af_team_id: rang, rang, team_nom, team_id: team_nom, joues, gagnes: 0, nuls: 0, perdus: 0, bp: 0, bc: 0, diff: 0, points, forme: null, zone, updated_at: "2026-11-21T07:00:00Z" });

// Classement fictif de 10 équipes : 4 places Ligue des champions, 1 Ligue Europa, 2 relégables
const table = [
  row("Real", 1, 30, "Champions League league stage"), row("Barça", 2, 28, "Champions League league stage"), row("Atlético", 3, 24, "Champions League league stage"),
  row("Villarreal", 4, 22, "Champions League league stage"), row("Betis", 5, 20, "Europa League league stage"), row("Séville", 6, 19),
  row("Celta", 7, 15), row("Getafe", 8, 12), row("Alavés", 9, 10, "Relegation"), row("Cadix", 10, 8, "Relegation"),
];
const de = (h: string, a: string, comp = "PD") => enjeux({ home: h, away: a, comp, homeRow: table.find((r) => r.team_nom === h)!, awayRow: table.find((r) => r.team_nom === a)!, table });

describe("enjeux de classement", () => {
  it("traduit les zones du fournisseur", () => {
    expect(zoneDe("Promotion - Champions League (League phase)")).toEqual({ sens: "haut", label: "la Ligue des champions" });
    expect(zoneDe("Relegation - League One")).toEqual({ sens: "bas", label: "la zone de relégation" });
    expect(zoneDe("Bundesliga (Relegation Group)")).toEqual({ sens: "bas", label: "la poule de relégation" });
    expect(zoneDe("Eredivisie (Relegation)")).toEqual({ sens: "bas", label: "la zone de barrage pour le maintien" });
    expect(zoneDe(null)).toBeNull();
  });
  it("course au titre : leader menacé et poursuivant qui peut passer devant", () => {
    const l = de("Barça", "Real");
    expect(l).toContain("Barça est à 2 points du leader Real : en cas de victoire, il pourrait passer en tête si Real ne gagne pas.");
    expect(l).toContain("Real est en tête avec 2 points d’avance sur Barça.");
    expect(l).toContain("Une défaite pourrait lui coûter la première place.");
    expect(l).toContain("En cas de victoire, Barça passerait devant Real au classement.");
  });
  it("places européennes : à portée de la dernière place qualificative", () => {
    const l = de("Betis", "Celta");
    expect(l).toContain("Betis est à 2 points de la 4e place, la dernière pour la Ligue des champions : une victoire pourrait l’y faire entrer.");
  });
  it("maintien : en zone rouge, et marge réduite au-dessus", () => {
    const l = de("Alavés", "Getafe");
    expect(l).toContain("Alavés est 9e, dans la zone de relégation ; Getafe, premier non concerné, a 2 points de plus.");
    expect(l).toContain("Getafe n’a que 2 points d’avance sur la zone de relégation.");
    expect(l).toContain("En cas de victoire, Alavés passerait devant Getafe au classement.");
  });
  it("ne dit rien sans données suffisantes", () => {
    expect(enjeux({ home: "A", away: "B", comp: "PD", homeRow: null, awayRow: table[0], table })).toEqual([]);
    const tot = table.map((r) => ({ ...r, joues: 2 }));
    expect(enjeux({ home: "Real", away: "Barça", comp: "PD", homeRow: tot[0], awayRow: tot[1], table: tot })).toEqual([]);
  });
  it("phase de ligue européenne : pas de « leader » ni de titre", () => {
    const l = de("Barça", "Real", "CL");
    expect(l.some((x) => x.includes("leader") || x.includes("en tête"))).toBe(false);
  });
});
