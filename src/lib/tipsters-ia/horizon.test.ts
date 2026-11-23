import { describe, expect, it } from "vitest";
import { horizonHeures } from "./horizon";

describe("horizon des passages", () => {
  it("le matin couvre toute la journée, l'après-midi 10 h", () => {
    expect(horizonHeures(new Date("2026-11-23T07:50:00Z"))).toBe(17);
    expect(horizonHeures(new Date("2026-11-23T13:50:00Z"))).toBe(10);
    expect(horizonHeures(new Date("2026-11-23T17:50:00Z"))).toBe(10);
  });
});
