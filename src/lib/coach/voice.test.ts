import { describe, expect, it } from "vitest";
import { pickVoice, spoken } from "./voice";

describe("voix du Coach", () => {
  it("préfère une voix française féminine et de bonne qualité", () => {
    const v = (name: string, lang = "fr-FR") => ({ name, lang });
    expect(pickVoice([v("Thomas"), v("Samantha", "en-US"), v("Amélie", "fr-CA"), v("Audrey")])?.name).toBe("Audrey");
    expect(pickVoice([v("Audrey"), v("Audrey (Enhanced)")])?.name).toBe("Audrey (Enhanced)");
    expect(pickVoice([v("Thomas"), v("Amélie", "fr-CA")])?.name).toBe("Amélie");
    expect(pickVoice([v("Google français")])?.name).toBe("Google français");
    expect(pickVoice([v("Samantha", "en-US")])).toBeNull();
  });
  it("dit les chiffres naturellement", () => {
    expect(spoken("**Cote 1,8** : 24 % · mise 10 000 F")).toBe("Cote 1 virgule 8 : 24 pour cent · mise 10000 francs");
  });
});
