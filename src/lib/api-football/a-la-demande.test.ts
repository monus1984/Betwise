import { describe, expect, it } from "vitest";
import { choisirMatch, nomCherchable } from "./a-la-demande";
import type { AfFixture } from "./client";

const fx = (id: number, date: string, h: [number, string], a: [number, string]) =>
  ({ fixture: { id, date, status: { short: "NS", elapsed: null } }, league: { id: 17, season: 2026 }, teams: { home: { id: h[0], name: h[1] }, away: { id: a[0], name: a[1] } }, goals: { home: null, away: null }, score: { halftime: { home: null, away: null }, fulltime: { home: null, away: null } } }) as unknown as AfFixture;

describe("match introuvable : recherche chez API-Football", () => {
  it("nettoie le nom pour la recherche", () => {
    expect(nomCherchable("Istanbul Başakşehir")).toBe("Istanbul Basaksehir");
    expect(nomCherchable("Al-Hilal SFC")).toBe("Al Hilal");
    expect(nomCherchable("UD Almería")).toBe("Almeria");
  });
  it("prend le match le plus proche de la date du prono, contre l'adversaire nommé", () => {
    const l = [fx(1, "2026-11-23T17:00:00Z", [10, "Al Hilal"], [20, "Neftchi Fargona"]), fx(2, "2026-11-26T06:00:00Z", [30, "Al Nassr"], [10, "Al Hilal"])];
    expect(choisirMatch(l, 10, "2026-11-23T08:00:00Z")?.fixture.id).toBe(1);
    expect(choisirMatch(l, 10, "2026-11-23T08:00:00Z", "Al Nassr")?.fixture.id).toBe(2);
    expect(choisirMatch(l, 10, "2026-11-23T08:00:00Z", "Pakhtakor")).toBeNull();
    expect(choisirMatch(l, 10, "2026-11-10T08:00:00Z")).toBeNull();
  });
});
