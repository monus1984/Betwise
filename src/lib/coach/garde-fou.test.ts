import { describe, expect, it } from "vitest";
import { alerteCoach } from "./garde-fou";
import { etatBudget } from "./budget";

const calme = { serie: 0, budget: null };

describe("alerte du Coach", () => {
  it("signale une demande de « se refaire », sans jamais refuser", () => {
    for (const m of ["Fais-moi un combiné à 10 pour me refaire", "je veux rattraper mes pertes ce soir", "je vais tout miser", "un quitte ou double pour récupérer ma mise"]) {
      const a = alerteCoach(m, calme);
      expect(a.active, m).toBe(true);
      expect(a.consigne).toContain("tu proposes quand même");
      expect(a.consigne).not.toMatch(/aucun pari|ne propose pas|désactiv/i);
    }
  });
  it("ne dit rien sur une demande ordinaire", () => {
    for (const m of ["Quoi jouer aujourd'hui ?", "Fais-moi un combiné à 3 en Audacieux", "Analyse-moi Sénégal – Ghana", "Refais-moi le point sur ma bankroll"])
      expect(alerteCoach(m, calme).active, m).toBe(false);
  });
  it("signale trois pertes de suite, pas deux", () => {
    expect(alerteCoach("Quoi jouer ?", { serie: 2, budget: null }).active).toBe(false);
    expect(alerteCoach("Quoi jouer ?", { serie: 3, budget: null }).raisons[0]).toContain("3 paris perdus");
  });
  it("signale le budget proche ou atteint, montants à l'appui", () => {
    const b = etatBudget({ miseSemaine: 10000, perteMaxSemaine: 5000 }, [{ mise: 6000, statut: "perdu", gain_net: -6000, placed_at: "2026-11-17T10:00:00Z", settled_at: "2026-11-17T20:00:00Z" }], new Date("2026-11-18T12:00:00Z"));
    const a = alerteCoach("Quoi jouer ?", { serie: 1, budget: b });
    expect(a.active).toBe(true);
    expect(a.raisons.join(" ")).toMatch(/6.000 F/);
  });
});
