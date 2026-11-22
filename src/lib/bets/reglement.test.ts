import { describe, expect, it } from "vitest";
import { reglableA, reglableMaintenant } from "./reglement";

const now = Date.parse("2026-11-22T14:00:00Z");
describe("règlement à la main", () => {
  it("refusé avant la fin du dernier match", () => {
    expect(reglableMaintenant([{ kickoff_at: "2026-11-22T13:00:00Z" }], now)).toBe(false);
    expect(reglableA([{ kickoff_at: "2026-11-22T10:00:00Z" }, { kickoff_at: "2026-11-22T13:00:00Z" }])?.toISOString()).toBe("2026-11-22T15:15:00.000Z");
  });
  it("permis après, ou si les matchs sont terminés, ou sans match reconnu", () => {
    expect(reglableMaintenant([{ kickoff_at: "2026-11-22T11:00:00Z" }], now)).toBe(true);
    expect(reglableMaintenant([{ kickoff_at: "2026-11-22T13:30:00Z", statut: "termine" }], now)).toBe(true);
    expect(reglableMaintenant([{ kickoff_at: null }], now)).toBe(true);
  });
});
