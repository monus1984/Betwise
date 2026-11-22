import { describe, expect, it } from "vitest";
import { motifFr } from "./motifs";

describe("motifs d'absence", () => {
  it("traduit les motifs courants", () => {
    expect(motifFr("Knee Injury")).toBe("blessure (genou)");
    expect(motifFr("Hamstring Injury")).toBe("blessure (ischios)");
    expect(motifFr("Red Card")).toBe("carton rouge");
    expect(motifFr("Injury")).toBe("blessure");
    expect(motifFr("Inconnu XYZ")).toBe("Inconnu XYZ");
    expect(motifFr(null)).toBeNull();
  });
});
