import { describe, expect, it } from "vitest";
import { detailsOf } from "./sync";
import type { AfFixture } from "./client";

const stats = (id: number, v: Record<string, number | null>) => ({ team: { id }, statistics: Object.entries(v).map(([type, value]) => ({ type, value })) });
const ev = (team: number, name: string, elapsed: number, detail = "Normal Goal", comments: string | null = null, type = "Goal") => ({ time: { elapsed, extra: null }, team: { id: team }, player: { name }, type, detail, comments });
const base: AfFixture = {
  fixture: { id: 1, date: "", status: { short: "FT", elapsed: 90 } }, league: { id: 1, season: 2026 },
  teams: { home: { id: 10, name: "A", winner: true }, away: { id: 20, name: "B", winner: false } }, goals: { home: 2, away: 1 }, score: { fulltime: { home: 2, away: 1 }, halftime: { home: 1, away: 0 } },
};

describe("détail d'un match terminé", () => {
  it("statistiques, buteurs sans csc ni tirs au but, issue", () => {
    const { details: d, hasStats } = detailsOf({ ...base,
      statistics: [stats(10, { "Corner Kicks": 7, "Yellow Cards": 2, "Red Cards": null, "Total Shots": 14, "Shots on Goal": 6 }), stats(20, { "Corner Kicks": 3, "Yellow Cards": 3, "Red Cards": 1, "Total Shots": 9, "Shots on Goal": 2 })],
      events: [ev(10, "K. Mbappé", 23), ev(20, "X. Csc", 30, "Own Goal"), ev(20, "V. Osimhen", 40, "Penalty"), ev(10, "R. Raté", 60, "Missed Penalty"), ev(10, "T. Tab", 120, "Penalty", "Penalty Shootout"), ev(10, "C. Carton", 70, "Yellow Card", null, "Card")] });
    expect(hasStats).toBe(true);
    expect(d).toMatchObject({ corners: [7, 3], jaunes: [2, 3], rouges: [0, 1], tirs: [14, 9], cadres: [6, 2], issue: "FT", vainqueur: "1" });
    expect(d.buteurs).toEqual([{ n: "K. Mbappé", e: "1", m: 23 }, { n: "V. Osimhen", e: "2", m: 40 }]);
  });
  it("sans statistiques ni événements : rien d'inventé", () => {
    const { details: d, hasStats } = detailsOf({ ...base, fixture: { ...base.fixture, status: { short: "PEN", elapsed: 120 } }, teams: { home: { id: 10, name: "A", winner: false }, away: { id: 20, name: "B", winner: true } } });
    expect(hasStats).toBe(false);
    expect(d.corners).toBeUndefined(); expect(d.buteurs).toBeUndefined();
    expect(d).toMatchObject({ issue: "PEN", vainqueur: "2" });
    // feuille d'événements vide alors qu'il y a eu des buts : buteurs non renseignés
    expect(detailsOf({ ...base, events: [] }).details.buteurs).toBeUndefined();
  });
});
