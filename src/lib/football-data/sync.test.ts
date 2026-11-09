import { describe, expect, it } from "vitest";
import { mapStatus, seasonLabel } from "./sync";

describe("mapStatus", () => {
  it("ramène les statuts football-data.org à la taxonomie betwise", () => {
    expect(mapStatus("FINISHED")).toBe("termine");
    expect(mapStatus("AWARDED")).toBe("termine");
    expect(mapStatus("IN_PLAY")).toBe("en_cours");
    expect(mapStatus("PAUSED")).toBe("en_cours");
    expect(mapStatus("POSTPONED")).toBe("reporte");
    expect(mapStatus("SUSPENDED")).toBe("reporte");
    expect(mapStatus("CANCELLED")).toBe("annule");
    expect(mapStatus("SCHEDULED")).toBe("programme");
    expect(mapStatus("TIMED")).toBe("programme");
  });
});

describe("seasonLabel", () => {
  it("écrit une saison à cheval sur deux années en 2026-27", () => {
    expect(seasonLabel("2026-08-15", "2027-05-24")).toBe("2026-27");
  });
  it("garde l'année seule pour une saison calendaire", () => {
    expect(seasonLabel("2026-01-28", "2026-12-06")).toBe("2026");
  });
});
