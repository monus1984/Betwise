import { describe, expect, it } from "vitest";
import { estimerBetclicCI } from "./betclic-ci";

describe("estimerBetclicCI", () => {
  it("applique +3,3 % avec une fourchette de +1,7 à +5,7 %", () => {
    expect(estimerBetclicCI(1.4)).toEqual({ cote: 1.45, bas: 1.42, haut: 1.48 });
  });
  it("retrouve l'ordre de grandeur des captures du 21/11 (Nice–PSG, France 5,60 → CI 5,75)", () => {
    const e = estimerBetclicCI(5.6)!;
    expect(e.bas).toBeLessThanOrEqual(5.75);
    expect(e.haut).toBeGreaterThanOrEqual(5.75);
  });
  it("ne renvoie rien sans cote valable", () => {
    expect(estimerBetclicCI(null)).toBeNull();
    expect(estimerBetclicCI(1)).toBeNull();
    expect(estimerBetclicCI(Number.NaN)).toBeNull();
  });
});
