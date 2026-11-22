import { describe, expect, it } from "vitest";
import { gainPour1000 } from "./proposition";

describe("gain pour 1 000 F", () => {
  it("arrondit au franc, espace normal entre les milliers", () => {
    expect(gainPour1000(1.29)).toBe("1 290 F");
    expect(gainPour1000(2.105)).toBe("2 105 F");
    expect(gainPour1000(12.4)).toBe("12 400 F");
  });
});
