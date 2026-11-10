import { describe, expect, it } from "vitest";
import { buildTeamMap } from "../teams";
import { fitRatings, predict } from "../poisson";

const db = (names: string[]) => names.map((nom, i) => ({ id: String(i), nom, alias: [] as string[] }));

describe("rapprochement des noms football-data.co.uk", () => {
  it("Angleterre", () => {
    const teams = db(["Manchester United FC", "Manchester City FC", "Nottingham Forest FC", "Wolverhampton Wanderers FC", "Tottenham Hotspur FC", "Brighton & Hove Albion FC", "West Ham United FC", "AFC Bournemouth"]);
    const m = buildTeamMap(["Man United", "Man City", "Nott'm Forest", "Wolves", "Tottenham", "Brighton", "West Ham", "Bournemouth", "Everton"], teams);
    expect([...m.values()]).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", null]);
  });
  it("Espagne / Italie", () => {
    const teams = db(["Athletic Club", "Club Atlético de Madrid", "Real Madrid CF", "Real Sociedad de Fútbol", "Real Betis Balompié", "RCD Espanyol de Barcelona", "FC Barcelona", "RC Celta de Vigo", "FC Internazionale Milano", "AC Milan", "AS Roma", "Hellas Verona FC", "Parma Calcio 1913"]);
    const m = buildTeamMap(["Ath Bilbao", "Ath Madrid", "Real Madrid", "Sociedad", "Betis", "Espanol", "Barcelona", "Celta", "Inter", "Milan", "Roma", "Verona", "Parma"], teams);
    expect([...m.values()]).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
  });
  it("Allemagne / France", () => {
    const teams = db(["FC Bayern München", "Bayer 04 Leverkusen", "Eintracht Frankfurt", "1. FC Köln", "Borussia Mönchengladbach", "Borussia Dortmund", "FC St. Pauli 1910", "Paris Saint-Germain FC", "Paris FC", "Olympique Lyonnais", "Olympique de Marseille", "Stade Rennais FC 1901", "Stade Brestois 29", "AS Saint-Étienne", "Le Havre AC"]);
    const m = buildTeamMap(["Bayern Munich", "Leverkusen", "Ein Frankfurt", "FC Koln", "M'gladbach", "Dortmund", "St Pauli", "Paris SG", "Paris FC", "Lyon", "Marseille", "Rennes", "Brest", "St Etienne", "Le Havre"], teams);
    expect([...m.values()]).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"]);
  });
});

describe("modèle Poisson", () => {
  it("donne l'avantage au domicile et somme à 1", () => {
    const hist = [];
    const d = new Date("2026-10-01");
    for (let i = 0; i < 40; i++) hist.push({ date: d, home: i % 2 ? "A" : "B", away: i % 2 ? "B" : "A", hg: 2, ag: 1 });
    const r = fitRatings(hist, new Date("2026-11-01"));
    const p = predict(r, "A", "B")!;
    expect(p.p1 + p.pN + p.p2).toBeCloseTo(1, 6);
    expect(p.p1).toBeGreaterThan(p.p2);
    expect(r.homeAdv).toBeGreaterThan(1.3);
  });
});

describe("égalités", () => {
  it("Paris FC ne se confond pas avec le PSG aliasé « Paris »", () => {
    const teams = [{ id: "psg", nom: "Paris Saint-Germain FC", alias: ["PSG", "Paris"] }, { id: "pfc", nom: "Paris FC", alias: [] }];
    expect([...buildTeamMap(["Paris FC", "Paris SG"], teams).values()]).toEqual(["pfc", "psg"]);
  });
});
