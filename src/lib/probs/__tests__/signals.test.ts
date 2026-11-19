import { describe, expect, it } from "vitest";
import { makeGrid } from "../grid";
import { coteAffichee, picksOf, probaDirecte, probasMarche, releveFrais, type CoteBookmaker, type Signal } from "../signals";
import { legFrom } from "../../slip/leg";

const book = (market: string, param: number | null, sel: string, cote: number): CoteBookmaker => ({ market, param, sel, cote, bookmaker: "1xBet", releveAt: "2026-11-18T03:34:19+00:00" });
function signal(bookAll: CoteBookmaker[]): Signal {
  const cotes = { c1: 1.85, cN: 3.6, c2: 4.2, plus25: 1.8, moins25: 2.02 };
  const ml = probasMarche(cotes)!;
  const ref: Record<string, number> = { "1X2||1": 1.85, "1X2||N": 3.6, "1X2||2": 4.2, "OU|2.5|Plus": 1.8, "OU|2.5|Moins": 2.02 };
  return {
    source: "marche", lh: ml.lh, la: ml.la, grid: ml.grid, approx: false, market: { lh: ml.lh, la: ml.la, grid: ml.grid }, model: null,
    refOdd: (m, p, s) => ref[`${m}|${p ?? ""}|${s}`] ?? null,
    direct: (m, p, s) => probaDirecte(cotes, m, p, s),
    bookOdd: (m, p, s) => { const o = bookAll.find((x) => x.market === m && x.param === p && x.sel === s); return o ? { cote: o.cote, bookmaker: o.bookmaker, releveAt: o.releveAt } : null; },
    bookAll,
  };
}

describe("cote affichée : bookmaker d'abord, médiane ensuite", () => {
  const sg = signal([book("1X2", null, "1", 1.81), book("DC", null, "1N", 1.26), book("BTTS", null, "Oui", 1.5)]);
  const picks = picksOf(sg, "all");
  const get = (m: string, p: number | null, s: string) => picks.find((x) => x.market === m && x.param === p && x.sel === s)!;

  it("garde les deux cotes sur la sélection et choisit celle du bookmaker", () => {
    const p = get("1X2", null, "1");
    expect(p.cote).toBe(1.85);
    expect(p.book).toEqual({ cote: 1.81, bookmaker: "1xBet", releveAt: "2026-11-18T03:34:19+00:00" });
    expect(coteAffichee(p)).toEqual({ cote: 1.81, origine: "bookmaker", bookmaker: "1xBet" });
  });
  it("retombe sur la médiane, étiquetée comme telle, quand le bookmaker n'a pas la sélection", () => {
    const p = get("OU", 2.5, "Plus");
    expect(p.book).toBeNull();
    expect(coteAffichee(p)).toEqual({ cote: 1.8, origine: "mediane", bookmaker: null });
  });
  it("donne une vraie cote à un marché qui n'avait qu'une estimation", () => {
    const p = get("DC", null, "1N");
    expect(p.cote).toBeNull();
    expect(coteAffichee(p)?.cote).toBe(1.26);
    expect(coteAffichee(get("DC", null, "N2"))).toBeNull(); // ni bookmaker ni médiane : estimation
  });
  it("la probabilité ne dépend pas de la cote du bookmaker", () => {
    const sans = picksOf(signal([]), "all").find((x) => x.market === "1X2" && x.sel === "1")!;
    expect(get("1X2", null, "1").p).toBeCloseTo(sans.p, 10);
  });
  it("le coupon porte la cote du bookmaker et son nom ; sinon la médiane, sinon une estimation marquée", () => {
    const base = { matchId: "m", home: "A", away: "B", kickoff: "2026-11-21T15:00:00Z", comp: "PL" };
    const a = legFrom({ ...base, market: "1X2", param: null, sel: "1", p: 0.52, cote: 1.85, book: { cote: 1.81, bookmaker: "1xBet" } });
    expect([a.cote, a.estimee, a.book]).toEqual([1.81, false, "1xBet"]);
    const b = legFrom({ ...base, market: "OU", param: 2.5, sel: "Plus", p: 0.53, cote: 1.8 });
    expect([b.cote, b.estimee, b.book]).toEqual([1.8, false, null]);
    const c = legFrom({ ...base, market: "DC", param: null, sel: "N2", p: 0.5, cote: null });
    expect([c.cote, c.estimee, c.book]).toEqual([1.9, true, null]);
    // corners : pas de probabilité, mais une vraie cote
    const d = legFrom({ ...base, market: "CORN", param: 9.5, sel: "Plus", p: null, cote: null, book: { cote: 1.62, bookmaker: "1xBet" } });
    expect([d.cote, d.estimee, d.p]).toEqual([1.62, false, null]);
  });
});

describe("fraîcheur d'un relevé de bookmaker", () => {
  const now = Date.parse("2026-11-19T00:20:00Z");
  it("accepte un relevé de la veille, refuse un relevé de dix jours", () => {
    expect(releveFrais("2026-11-18T03:34:19+00:00", "2026-11-21T15:00:00Z", now)).toBe(true);
    expect(releveFrais("2026-11-08T16:55:15+00:00", "2026-11-28T15:00:00Z", now)).toBe(false);
  });
  it("après le coup d'envoi, compare au coup d'envoi : le dernier relevé d'avant-match reste valable", () => {
    expect(releveFrais("2026-11-12T18:00:10+00:00", "2026-11-12T19:00:00Z", now)).toBe(true);
    expect(releveFrais("2026-11-09T18:00:00+00:00", "2026-11-12T19:00:00Z", now)).toBe(false);
  });
});

describe("probabilités tirées des cotes", () => {
  it("somment à 1 et annoncent le favori plus haut que la simple règle de trois", () => {
    const c = { c1: 1.3, cN: 5.5, c2: 9, plus25: 1.5, moins25: 2.6 };
    const p = ["1", "N", "2"].map((s) => probaDirecte(c, "1X2", null, s)!);
    expect(p[0] + p[1] + p[2]).toBeCloseTo(1, 6);
    expect(p[0]).toBeGreaterThan(probaDirecte(c, "1X2", null, "1", "proportionnelle")!);
    expect(probaDirecte(c, "OU", 2.5, "Plus")! + probaDirecte(c, "OU", 2.5, "Moins")!).toBeCloseTo(1, 6);
    expect(probaDirecte(c, "OU", 1.5, "Plus")).toBeNull();
    expect(makeGrid(1.5, 1.1).length).toBeGreaterThan(5);
  });
});
