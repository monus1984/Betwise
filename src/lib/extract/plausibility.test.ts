import { describe, expect, it } from "vitest";
import { vraisemblance } from "./plausibility";

describe("vraisemblance d'une ligne : cote lue contre chance estimée", () => {
  it("arrête les trois erreurs de lecture des 12 et 13 novembre", () => {
    // « − de 1,5, Total de buts – Sierra Leone » lu comme moins de 1,5 but dans RD Congo–Sierra Leone
    expect(vraisemblance(0.2, 1.03)?.sens).toBe("cote_trop_basse");
    // « Madagascar ne perd pas ou perd de 1 but » lu comme victoire de Madagascar
    expect(vraisemblance(0.45, 1.14)?.sens).toBe("cote_trop_basse");
    // tirs cadrés d'un joueur lus comme total du match (événement quasi certain payé 2,00)
    expect(vraisemblance(0.95, 2.0)?.sens).toBe("cote_trop_haute");
  });
  it("laisse passer une ligne cohérente, marge du bookmaker comprise", () => {
    expect(vraisemblance(0.55, 1.7)).toBeNull();
    expect(vraisemblance(0.88, 1.1)).toBeNull();
    expect(vraisemblance(0.3, 3.1)).toBeNull();
    expect(vraisemblance(0.08, 9)).toBeNull();      // outsider : l'écart en points est faible, pas d'alerte
    expect(vraisemblance(0.62, 1.9)).toBeNull();     // BETWISE un peu plus optimiste que le bookmaker
  });
  it("ne dit rien sans estimation ou sans cote", () => {
    expect(vraisemblance(null, 1.5)).toBeNull();
    expect(vraisemblance(0.5, null)).toBeNull();
    expect(vraisemblance(0.5, 1)).toBeNull();
  });
  it("explique l'alerte en clair", () => {
    expect(vraisemblance(0.2, 1.03)!.message).toContain("1,03");
    expect(vraisemblance(0.2, 1.03)!.message).toContain("20 %");
  });
});
