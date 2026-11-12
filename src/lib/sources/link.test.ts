import { describe, expect, it } from "vitest";
import { linkLabel, linkOf, normalizeLink } from "./link";

describe("lien d'une source", () => {
  it("accepte ce qu'on colle vraiment", () => {
    expect(normalizeLink("https://www.facebook.com/share/1AbCdEf/")).toBe("https://www.facebook.com/share/1AbCdEf/");
    expect(normalizeLink("facebook.com/unepage")).toBe("https://facebook.com/unepage");
    expect(normalizeLink("http://t.me/moncanal")).toBe("https://t.me/moncanal");
    expect(normalizeLink("@moncanal", "canal_telegram")).toBe("https://t.me/moncanal");
    expect(normalizeLink("@niro.sport", "compte_instagram")).toBe("https://www.instagram.com/niro.sport");
  });
  it("refuse le reste", () => {
    expect(normalizeLink("javascript:alert(1)")).toBeNull();
    expect(normalizeLink("tg://resolve?domain=x")).toBeNull();
    expect(normalizeLink("@pseudo", "tipster")).toBeNull();
    expect(normalizeLink("Manu le parieur")).toBeNull();
    expect(normalizeLink("")).toBeNull();
  });
  it("déduit le lien de l'identifiant quand rien n'est enregistré", () => {
    expect(linkOf({ lien: null, identifiant_externe: "@moncanal", type: "canal_telegram" })).toBe("https://t.me/moncanal");
    expect(linkOf({ lien: null, identifiant_externe: "Manu", type: "tipster" })).toBeNull();
    expect(linkOf({ lien: "https://t.me/a", identifiant_externe: "@b", type: "canal_telegram" })).toBe("https://t.me/a");
  });
  it("nomme le site", () => {
    expect(linkLabel("https://m.facebook.com/x")).toBe("Facebook");
    expect(linkLabel("https://t.me/x")).toBe("Telegram");
    expect(linkLabel("https://exemple.ci/pronos")).toBe("exemple.ci");
  });
});
