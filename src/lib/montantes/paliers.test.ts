import { describe, expect, it } from "vitest";
import { coteParPalier, niveauDeCote, paliersPourNiveau } from "./paliers";

describe("montante : niveau et paliers", () => {
  it("le cas de l'audit : 1 000 → 10 000 en 4 paliers demande 1,78, donc Audacieux", () => {
    expect(coteParPalier(1000, 10000, 4)!).toBeCloseTo(1.778, 3);
    expect(niveauDeCote(1.778)).toBe("risque");
  });
  it("propose le nombre de paliers qui colle au niveau", () => {
    expect(paliersPourNiveau(1000, 10000, "audacieux")).toBe(6); // 1,47
    expect(paliersPourNiveau(1000, 10000, "risque")).toBe(3); // 2,15
    expect(paliersPourNiveau(1000, 10000, "sur")).toBe(10); // 1,26
    expect(paliersPourNiveau(1000, 50000, "sur")).toBeNull(); // impossible en 10 paliers
    expect(paliersPourNiveau(1000, 2000, "sur")).toBe(3); // 1,26
  });
});
