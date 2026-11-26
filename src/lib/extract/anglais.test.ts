import { describe, expect, it } from "vitest";
import { normalizePick } from "./ticket";

/** Écritures de tipsters en anglais et lectures fausses corrigées le 21/11/2026. */
const lit = (p: string, m = "") => normalizePick(m, p, "Arsenal", "Chelsea");

describe("écritures anglaises des tipsters", () => {
  it.each([
    ["1 HT", "HT_1X2", null, "1"], ["X HT", "HT_1X2", null, "N"], ["1st half over 0.5", "HT_OU", 0.5, "Plus"],
    ["Home Over 1.5", "TT1", 1.5, "Plus"], ["Away team under 0.5", "TT2", 0.5, "Moins"], ["Home -1", "AH", -1, "1"],
    ["Draw no bet 1", "DNB", null, "1"], ["DNB away", "DNB", null, "2"], ["Win either half 1", "WEH", null, "1"],
    ["1 to win both halves", "WBH", null, "1"], ["Win to nil 2", "WTN", null, "2"], ["Clean sheet home", "TT2", 0.5, "Moins"],
    ["Home team to score", "TT1", 0.5, "Plus"], ["Exact score 2-1", "CS", null, "2-1"], ["Score exact 2-1", "CS", null, "2-1"],
    ["Mbappé anytime", "BUT", null, "Mbappé"], ["Chelsea to score", "TT2", 0.5, "Plus"],
  ])("%s", (p, code, param, sel) => {
    expect(lit(p)).toMatchObject({ market_code: code, market_param: param, selection: sel, ok: true });
  });
  it("résultat à la mi-temps avec le marché à part", () => expect(lit("1", "Mi-temps")).toMatchObject({ market_code: "HT_1X2", selection: "1", ok: true }));
});

describe("lectures fausses corrigées", () => {
  it("« ou les deux marquent » : on garde le résultat, jamais « les deux marquent » (26/11)", () => {
    for (const p of ["Away or GG", "1 or GG", "Arsenal ou les deux marquent"]) expect(lit(p)).toMatchObject({ market_code: "1X2", ok: true });
  });
  it("« Corners 1X2 » n'est plus lu comme le résultat du match", () => {
    expect(lit("1", "Corners 1X2")).toMatchObject({ market_code: "CORN_1X2", selection: "1", ok: true });
    expect(lit("Corners 1X2 : 2")).toMatchObject({ market_code: "CORN_1X2", selection: "2", ok: true });
  });
  it("le total d'une équipe n'est plus lu comme le total du match", () => {
    expect(lit("Plus de 1.5", "Total équipe 1")).toMatchObject({ market_code: "TT1", market_param: 1.5, selection: "Plus", ok: true });
  });
  it("paiement anticipé et « excl. » : lus mais à confirmer", () => {
    expect(lit("1X (1up)")).toMatchObject({ market_code: "DC", selection: "1N", ok: true });
    expect(lit("2up").ok).toBe(false);
    expect(lit("Excl. 1 goal")).toMatchObject({ market_code: "LIBRE", ok: false });
  });
});
