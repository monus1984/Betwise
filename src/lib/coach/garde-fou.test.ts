import { describe, expect, it } from "vitest";
import { gardeFou } from "./garde-fou";
import { etatBudget } from "./budget";

const calme = { serie: 0, budget: null };

describe("garde-fou du Coach", () => {
  it("refuse un combiné « pour se refaire », quel que soit l'état de la bankroll", () => {
    for (const m of ["Fais-moi un combiné à 10 pour me refaire", "je veux rattraper mes pertes ce soir", "Je mets tout sur un gros combiné, je vais tout miser", "un quitte ou double pour récupérer ma mise", "je double ma mise jusqu'à ce que ça passe, doubler la mise quoi"]) {
      const g = gardeFou(m, calme);
      expect(g.bloque, m).toBe(true);
      expect(g.consigne).toContain("aucun combiné");
    }
  });
  it("laisse passer une demande ordinaire", () => {
    for (const m of ["Quoi jouer aujourd'hui ?", "Fais-moi un combiné à 3 en Audacieux", "Analyse-moi Sénégal – Ghana", "Que valent mes sources ?", "Refais-moi le point sur ma bankroll"])
      expect(gardeFou(m, calme).bloque, m).toBe(false);
  });
  it("bloque après trois pertes de suite, pas après deux", () => {
    expect(gardeFou("Quoi jouer ?", { serie: 2, budget: null }).bloque).toBe(false);
    const g = gardeFou("Quoi jouer ?", { serie: 3, budget: null });
    expect(g.bloque).toBe(true);
    expect(g.raisons[0]).toContain("3 paris");
  });
  it("bloque quand la limite de perte de la semaine est atteinte, en citant les montants", () => {
    const b = etatBudget({ miseSemaine: 10000, perteMaxSemaine: 5000 }, [{ mise: 6000, statut: "perdu", gain_net: -6000, placed_at: "2026-11-17T10:00:00Z", settled_at: "2026-11-17T20:00:00Z" }], new Date("2026-11-18T12:00:00Z"));
    const g = gardeFou("Quoi jouer ?", { serie: 1, budget: b });
    expect(g.bloque).toBe(true);
    expect(g.raisons.join(" ")).toMatch(/6.000 F/);
  });
});
