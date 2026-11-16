import { describe, expect, it } from "vitest";
import { debutSemaine, etatBudget, type PariB } from "./budget";

const NOW = new Date("2026-11-18T12:00:00Z"); // mercredi
const p = (mise: number, statut: string, gain: number | null, place: string, regle: string | null = null): PariB => ({ mise, statut, gain_net: gain, placed_at: place, settled_at: regle });
const B = { miseSemaine: 10000, perteMaxSemaine: 5000 };

describe("budget de la semaine", () => {
  it("la semaine commence le lundi à minuit", () => {
    expect(debutSemaine(NOW).toISOString()).toBe("2026-11-16T00:00:00.000Z");
    expect(debutSemaine(new Date("2026-11-22T23:59:00Z")).toISOString()).toBe("2026-11-16T00:00:00.000Z"); // dimanche soir
    expect(debutSemaine(new Date("2026-11-16T00:00:00Z")).toISOString()).toBe("2026-11-16T00:00:00.000Z");
  });
  it("ne compte que les paris de la semaine, et ignore les annulés", () => {
    const e = etatBudget(B, [p(2000, "en_cours", null, "2026-11-17T10:00:00Z"), p(9000, "perdu", -9000, "2026-11-14T10:00:00Z", "2026-11-14T20:00:00Z"), p(4000, "annule", null, "2026-11-17T11:00:00Z")], NOW);
    expect(e.mises).toBe(2000);
    expect(e.perte).toBe(0);
    expect(e.statut).toBe("libre");
    expect(e.motif).toBeNull();
  });
  it("proche à 80 %, atteint à 100 %, avec le motif chiffré", () => {
    expect(etatBudget(B, [p(8000, "en_cours", null, "2026-11-17T10:00:00Z")], NOW).statut).toBe("proche");
    const e = etatBudget(B, [p(3000, "perdu", -3000, "2026-11-16T10:00:00Z", "2026-11-16T20:00:00Z"), p(2500, "perdu", -2500, "2026-11-17T10:00:00Z", "2026-11-17T20:00:00Z")], NOW);
    expect(e.statut).toBe("atteint");
    expect(e.motif).toMatch(/5.500 F/);
    expect(e.restePerte).toBe(0);
  });
  it("un gain compense une perte de la même semaine, mais ne rend pas de budget de mise", () => {
    const e = etatBudget(B, [p(4000, "perdu", -4000, "2026-11-16T10:00:00Z", "2026-11-16T20:00:00Z"), p(6000, "gagne", 9000, "2026-11-17T10:00:00Z", "2026-11-17T20:00:00Z")], NOW);
    expect(e.perte).toBe(0);
    expect(e.mises).toBe(10000);
    expect(e.statut).toBe("atteint");
    expect(e.motif).toContain("Mises de la semaine");
  });
});
