import { describe, expect, it } from "vitest";
import { garderEtatExistant } from "./sync";

describe("import football-data : pas de retour en arrière", () => {
  it("garde un match terminé ou en cours que football-data annonce encore programmé", () => {
    expect(garderEtatExistant("termine", "programme")).toBe(true);
    expect(garderEtatExistant("en_cours", "programme")).toBe(true);
    expect(garderEtatExistant("termine", "en_cours")).toBe(true);
  });
  it("laisse avancer, reporter ou annuler", () => {
    expect(garderEtatExistant("programme", "termine")).toBe(false);
    expect(garderEtatExistant("en_cours", "termine")).toBe(false);
    expect(garderEtatExistant("en_cours", "reporte")).toBe(false);
    expect(garderEtatExistant("programme", "annule")).toBe(false);
  });
});
