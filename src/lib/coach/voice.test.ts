import { describe, expect, it } from "vitest";
import { pickVoice, prononcer, spoken } from "./voice";

describe("voix du Coach", () => {
  it("préfère une voix française masculine et de bonne qualité", () => {
    const v = (name: string, lang = "fr-FR") => ({ name, lang });
    expect(pickVoice([v("Audrey"), v("Samantha", "en-US"), v("Thomas")])?.name).toBe("Thomas");
    expect(pickVoice([v("Thomas"), v("Thomas (Enhanced)")])?.name).toBe("Thomas (Enhanced)");
    expect(pickVoice([v("Amélie", "fr-CA")])?.name).toBe("Amélie");
    expect(pickVoice([v("Samantha", "en-US")])).toBeNull();
  });
  it("dit les chiffres naturellement", () => {
    expect(spoken("**Cote 1,8** : 24 % · mise 10 000 F")).toBe("Cote 1 virgule 8 : 24 pour cent · mise 10000 francs");
  });
  it("prépare les noms d'équipe, les heures et les bookmakers pour la voix", () => {
    expect(prononcer("FC Bayern München contre 1. FC Köln, demain à 19 h 30")).toBe("Bayern Munich contre Cologne, demain à 19 heures 30");
    expect(prononcer("Athletic Club contre RCD Espanyol de Barcelona, demain à 20 h")).toBe("Athletic Club contre Espanyol, demain à 20 heures");
    expect(prononcer("Cote 1,65 chez 1xBet")).toBe("Cote 1,65 chez One X Bet");
    expect(prononcer("Arsenal FC contre AC Milan")).toBe("Arsenal contre Milan");
    expect(prononcer("Profil prudent. CA Osasuna contre Málaga CF, demain à 17 h 30 : 2e mi-temps : Málaga CF : moins de 1,5 buts."))
      .toBe("Profil prudent. Osasuna contre Malaga, demain à 17 heures 30 : deuxième mi-temps : Malaga : moins de 1,5 buts.");
    expect(prononcer("Forme sur les 5 derniers : CA Osasuna 1V 1N 3D, Málaga CF 0V 2N 3D."))
      .toBe("Forme sur les 5 derniers : Osasuna 1 victoire, 1 nul, 3 défaites, Malaga 0 victoire, 2 nuls, 3 défaites.");
    expect(prononcer("Bologna FC 1909 contre Udinese Calcio, demain à 14 h")).toBe("Bologne contre Udinese, demain à 14 heures");
  });
});
