import { describe, expect, it } from "vitest";
import { bilanMoi, type SelMoi } from "./moi";

const NOW = Date.parse("2026-11-23T10:00:00Z");
const s = (resultat: string | null, cote: number, combine = false, placedAt = "2026-11-20T10:00:00Z", market = "1X2"): SelMoi => ({ resultat, cote, market, placedAt, combine });

describe("mes choix notés comme une source", () => {
  it("réussite, attendu et rendement à mise égale, simples et combinés séparés", () => {
    const b = bilanMoi([s("gagne", 2), s("perdu", 2), s("gagne", 1.25, true), s("perdu", 1.6, true, "2026-09-01T10:00:00Z", "OU"), s("en_attente", 1.5), s("rembourse", 1.8)], NOW);
    expect(b.regles).toBe(4);
    expect(b.justes).toBe(2);
    expect(b.reussite).toBe(0.5);
    expect(b.rendement).toBeCloseTo((1 - 1 + 0.25 - 1) / 4);
    expect(b.attendu).toBeCloseTo((0.5 + 0.5 + 0.8 + 0.625) / 4);
    expect(b.simples.regles).toBe(2);
    expect(b.dansCombines.regles).toBe(2);
    expect(b.trenteJours.regles).toBe(3);
    expect(b.enCours).toBe(1);
    expect(b.parNiveau.map((l) => l.cle)).toEqual(["Prudent", "Audacieux"]);
    expect(b.parMarche[0].cle).toBe("1X2");
  });
});
