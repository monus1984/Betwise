import { describe, expect, it } from "vitest";
import { lireDemande, fichiersCites, PANELS } from "../../scripts/conseil-ia";

describe("conseil d'IA : lecture de la demande", () => {
  it("panel par défaut, panel gratuit, liste choisie", () => {
    expect(lireDemande("/conseil").modeles).toEqual(PANELS.grands);
    expect(lireDemande("/conseil gratuit Que penses-tu ?")).toEqual({ modeles: PANELS.gratuit, question: "Que penses-tu ?" });
    expect(Object.keys(lireDemande("/conseil chatgpt,grok Avis ?").modeles)).toEqual(["ChatGPT", "Grok"]);
    expect(lireDemande("/conseil Faut-il refaire l'accueil ?")).toEqual({ modeles: PANELS.grands, question: "Faut-il refaire l'accueil ?" });
  });
  it("ne lit jamais un fichier de secrets ni hors du dépôt", () => {
    expect(fichiersCites("voir @.env.local et @../x.ts et @package.json").map((f) => f.chemin)).toEqual(["package.json"]);
  });
});
