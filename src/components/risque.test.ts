import { describe, expect, it } from "vitest";
import { riskFromOdds, RISK_LABEL } from "./ui";
import { categorieFromOdds, CAT_LABEL } from "@/lib/coach/categories";

describe("un seul découpage des niveaux de risque", () => {
  it("les pastilles des paris et des sources suivent les bornes des profils", () => {
    for (const c of [1.05, 1.1, 1.29, 1.3, 1.41, 1.54, 1.55, 2.2, 4]) {
      const r = riskFromOdds(c), p = categorieFromOdds(c);
      expect(r === null ? null : RISK_LABEL[r]).toBe(p === null ? null : CAT_LABEL[p]);
    }
  });
  it("pas de niveau sous 1,10", () => expect(riskFromOdds(1.06)).toBeNull());
});
