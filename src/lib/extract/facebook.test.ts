import { describe, expect, it } from "vitest";
import { normalizePick, parsePublished } from "./ticket";

// Formats relevés sur une page Facebook de tipster (story en tableau, « COTE 3 », listes en anglais), 12/11/2026.
const n = (pick: string, home: string | null, away: string | null, team: string | null = null, alias?: { home?: string[]; away?: string[] }) => {
  const r = normalizePick("", pick, home, away, team, alias);
  return `${r.market_code}${r.market_param !== null ? ` ${r.market_param}` : ""} ${r.selection} ${r.ok ? "ok" : "KO"}`;
};

describe("pronos Facebook", () => {
  it("story en tableau : code entre les deux équipes", () => {
    expect(n("2x", "Turquie", "Belgique")).toBe("DC N2 ok");
    expect(n("V2", "Tchéquie", "Espagne")).toBe("1X2 2 ok");
    expect(n("+2", "Italie", "France")).toBe("OU 2 Plus ok");
    expect(n("GG", "Angleterre", "Croatie")).toBe("BTTS Oui ok");
    expect(n("V1", "RD Congo", "Sierra Leone")).toBe("1X2 1 ok");
    expect(n("1x", "Bénin", "Centrafrique")).toBe("DC 1N ok");
    expect(n("NG", "Bénin", "Centrafrique")).toBe("BTTS Non ok");
  });
  it("équipe nommée seule, en français ou en anglais", () => {
    expect(n("VICTOIRE", "Tchéquie", "Espagne", "ESPAGNE")).toBe("1X2 2 ok");
    expect(n("Win", "Angleterre", "Croatie", "England", { home: ["England"], away: ["Croatia"] })).toBe("1X2 1 ok");
    expect(n("Victoire", "Saint-Marin", "Biélorussie", "Belarus", { home: ["San Marino"], away: ["Belarus"] })).toBe("1X2 2 ok");
    expect(n("Victoire", "RD Congo", "Sierra Leone", "DR Congo", { home: ["Congo DR"] })).toBe("1X2 1 ok");
    expect(n("+1,5", "Sénégal", "Soudan", "Sénégal")).toBe("OU 1.5 Plus ok");
    expect(n("+1,5 BUTS DANS LE MATCHS", "Monténégro", "Lettonie", "Lettonie")).toBe("OU 1.5 Plus ok");
    expect(n("double+1,5 BUTS DANS LE MATCHS", "Tchéquie", "Espagne", "Espagne")).toBe("DC_OU 1.5 N2|Plus ok");
  });
  it("combinés écrits dans le choix", () => {
    expect(n("👉Angleterre ou Nul & +1.5 buts", "Angleterre", "Croatie")).toBe("DC_OU 1.5 1N|Plus ok");
    expect(n("➡️Ghana gagne & +1.5 bus", "Ghana", "Somalie")).toBe("1X2_OU 1.5 1|Plus ok");
    expect(n("➡️RDC gagne & +1.5 buts", "RD Congo", "Sierra Leone")).toBe("1X2_OU 1.5 1|Plus ok");
    expect(n("➡️Sénégal gagne & +2.5 buts", "Sénégal", "Soudan")).toBe("1X2_OU 2.5 1|Plus ok");
    expect(n("Italie gagne et les deux équipes marquent", "Italie", "France")).toBe("1X2_BTTS 1|Oui ok");
  });
  it("buts simples", () => {
    expect(n("👉Plus 2.5 buts", "Italie", "France")).toBe("OU 2.5 Plus ok");
    expect(n("👉Les deux équipes marquent", "Turquie", "Belgique")).toBe("BTTS Oui ok");
    expect(n("+2 BUTS", "Tchéquie", "Espagne")).toBe("OU 2 Plus ok");
    expect(n("au-moins une équipe marque+1,5 BUTS", "Angleterre", "Croatie")).toBe("OU 1.5 Plus ok");
    expect(n("au moins une équipe va marquer+1,5 BUTS", "Italie", "France")).toBe("OU 1.5 Plus ok");
  });
  it("but + corners : signalé, pas deviné", () => {
    const r = normalizePick("", "1BUT+ 3 CORNERS", "Turquie", "Belgique", "Turquie");
    expect(r.ok).toBe(false); expect(r.reason).toMatch(/corners/);
  });
  it("âge d'un post lu comme une heure de publication", () => {
    const now = Date.UTC(2026, 10, 12, 20, 0);
    expect(parsePublished("13 h", now)).toBe("2026-11-12T07:00:00.000Z");
    expect(parsePublished("il y a 15 heures", now)).toBe("2026-11-12T05:00:00.000Z");
    expect(parsePublished("07:47", now)).toBeNull();
  });
});
