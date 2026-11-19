import { describe, expect, it } from "vitest";
import { avisDuJour, couverture, expression, ilYA, libelleMarche, publieAvant } from "../regles";

describe("règles de l'accueil", () => {
  it("couverture : d'où vient la probabilité", () => {
    expect(couverture({ source: "marche", model: {} })).toBe("marche_modele");
    expect(couverture({ source: "marche", model: null })).toBe("marche");
    expect(couverture({ source: "modele", model: {} })).toBe("modele");
    expect(couverture(null)).toBe("aucune");
  });

  it("expression de Betster (D13) : probabilité et couverture, jamais l'accord marché / modèle", () => {
    expect(expression({ p: 0.68, couverture: "marche_modele", coteFraiche: true })).toBe("positive");
    expect(expression({ p: 0.68, couverture: "marche", coteFraiche: true })).toBe("positive");
    expect(expression({ p: 0.6, couverture: "marche", coteFraiche: true })).toBe("positive");
    expect(expression({ p: 0.59, couverture: "marche_modele", coteFraiche: true })).toBe("prudente");
    expect(expression({ p: 0.75, couverture: "marche", coteFraiche: false })).toBe("prudente");
    expect(expression({ p: 0.75, couverture: "modele", coteFraiche: false })).toBe("prudente");
    expect(expression({ p: null, couverture: "aucune", coteFraiche: false })).toBe("neutre");
  });

  it("avis du jour (D10) : premier Audacieux, sinon premier Sûr, seulement avant le coup d'envoi", () => {
    const p = (categorie: string, statut = "programme") => ({ categorie, statut });
    expect(avisDuJour([p("sur"), p("audacieux"), p("risque")])).toEqual(p("audacieux"));
    expect(avisDuJour([p("risque"), p("sur")])).toEqual(p("sur"));
    expect(avisDuJour([p("audacieux", "en_cours"), p("sur")])).toEqual(p("sur"));
    expect(avisDuJour([p("risque")])).toBeNull();
  });

  it("le marché est toujours nommé", () => {
    expect(libelleMarche("1X2")).toBe("Résultat");
    expect(libelleMarche("DC")).toBe("Double chance");
    expect(libelleMarche("OU")).toBe("Autre marché : plus / moins de buts");
    expect(libelleMarche("BTTS")).toBe("Autre marché : les deux marquent");
  });

  it("âge d'un relevé et heure de publication", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    expect(ilYA("2026-11-22T10:00:00Z", now)).toBe("il y a 2 h");
    expect(ilYA("2026-11-22T11:35:00Z", now)).toBe("il y a 25 min");
    expect(ilYA("2026-11-21T08:00:00Z", now)).toBe("hier");
    expect(publieAvant("2026-11-22T10:00:00Z", "2026-11-22T13:30:00Z")).toBe(true);
    expect(publieAvant("2026-11-22T15:00:00Z", "2026-11-22T13:30:00Z")).toBe(false);
    expect(publieAvant(null, "2026-11-22T13:30:00Z")).toBeNull();
  });
});
