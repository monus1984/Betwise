import { describe, expect, it } from "vitest";
import { cotesBookmaker, mapAfBet } from "./bookmakers";
import type { AfOdds } from "./client";

// Valeurs réellement renvoyées pour 1xBet sur un match de Premier League (sonde du 19/11/2026)
const RELEVE: AfOdds = {
  fixture: { id: 1557467 }, update: "2026-11-18T03:34:19+00:00",
  bookmakers: [
    { id: 8, name: "Bet365", bets: [{ name: "Match Winner", values: [{ value: "Home", odd: "1.80" }] }] },
    { id: 11, name: "1xBet", bets: [
      { name: "Match Winner", values: [{ value: "Home", odd: "1.81" }, { value: "Draw", odd: "4.34" }, { value: "Away", odd: "4.29" }] },
      { name: "Second Half Winner", values: [{ value: "Home", odd: "2.00" }, { value: "Draw", odd: "2.91" }, { value: "Away", odd: "4.10" }] },
      { name: "Asian Handicap", values: [{ value: "Home -1.25", odd: "2.54" }, { value: "Away -1.25", odd: "1.54" }, { value: "Home -1", odd: "2.24" }, { value: "Away -1", odd: "1.67" }, { value: "Home +0", odd: "1.33" }, { value: "Away +0", odd: "3.20" }, { value: "Home -1.5", odd: "2.90" }, { value: "Away -1.5", odd: "1.42" }] },
      { name: "Goals Over/Under", values: [{ value: "Over 1.5", odd: "1.13" }, { value: "Under 1.5", odd: "5.36" }, { value: "Over 2.0", odd: "1.20" }, { value: "Over 2.25", odd: "1.36" }, { value: "Over 2.5", odd: "1.51" }, { value: "Under 2.5", odd: "2.55" }, { value: "Over 0.5", odd: "1.00" }, { value: "Under 0.5", odd: "11.60" }, { value: "Over 8.5", odd: "11.60" }] },
      { name: "Goals Over/Under First Half", values: [{ value: "Over 1.5", odd: "2.18" }, { value: "Under 1.5", odd: "1.69" }] },
      { name: "HT/FT Double", values: [{ value: "Home/Draw", odd: "15.00" }, { value: "Draw/Home", odd: "4.85" }, { value: "Away/Away", odd: "7.00" }] },
      { name: "Both Teams Score", values: [{ value: "Yes", odd: "1.50" }, { value: "No", odd: "2.45" }] },
      { name: "Exact Score", values: [{ value: "1:0", odd: "10.00" }, { value: "2:1", odd: "8.00" }, { value: "5:0", odd: "51.00" }] },
      { name: "Highest Scoring Half", values: [{ value: "Draw", odd: "4.05" }, { value: "1st Half", odd: "3.04" }, { value: "2nd Half", odd: "1.97" }] },
      { name: "Double Chance", values: [{ value: "Home/Draw", odd: "1.26" }, { value: "Home/Away", odd: "1.26" }, { value: "Draw/Away", odd: "2.11" }] },
      { name: "Total - Home", values: [{ value: "Over 1.5", odd: "1.55" }, { value: "Over 1", odd: "1.12" }] },
      { name: "Home Team Total Goals(1st Half)", values: [{ value: "Over 0.5", odd: "1.58" }, { value: "Under 2", odd: "1.01" }] },
      { name: "Both Teams To Score - Second Half", values: [{ value: "Yes", odd: "2.65" }] },
      { name: "Odd/Even", values: [{ value: "Odd", odd: "1.85" }, { value: "Even", odd: "1.85" }] },
      { name: "Corners Over Under", values: [{ value: "Over 9.5", odd: "1.62" }, { value: "Over 9", odd: "1.41" }] },
      { name: "Corners Asian Handicap", values: [{ value: "Home -1", odd: "1.59" }] },
      { name: "Cards Over/Under", values: [{ value: "Over 4.5", odd: "2.10" }] },
    ] },
  ],
};

describe("cotes d'un bookmaker (API-Football)", () => {
  it("fait correspondre les marchés simples", () => {
    expect(mapAfBet("Match Winner", "Draw")).toEqual({ market: "1X2", param: null, sel: "N" });
    expect(mapAfBet("Double Chance", "Home/Away")).toEqual({ market: "DC", param: null, sel: "12" });
    expect(mapAfBet("Both Teams Score - First Half", "No")).toEqual({ market: "HT_BTTS", param: null, sel: "Non" });
    expect(mapAfBet("Highest Scoring Half", "2nd Half")).toEqual({ market: "HMG", param: null, sel: "2" });
    expect(mapAfBet("HT/FT Double", "Draw/Home")).toEqual({ market: "HTFT", param: null, sel: "N/1" });
    expect(mapAfBet("Odd/Even", "Odd")).toEqual({ market: "OE", param: null, sel: "Impair" });
    expect(mapAfBet("Exact Score", "2:1")).toEqual({ market: "CS", param: null, sel: "2-1" });
  });
  it("ne garde que les demi-lignes des plus / moins", () => {
    expect(mapAfBet("Goals Over/Under", "Under 2.5")).toEqual({ market: "OU", param: 2.5, sel: "Moins" });
    expect(mapAfBet("Goals Over/Under", "Over 2.0")).toBeNull();
    expect(mapAfBet("Goals Over/Under", "Over 2.25")).toBeNull();
    expect(mapAfBet("Total - Away", "Over 1")).toBeNull();
    expect(mapAfBet("Away Team Total Goals(2nd Half)", "Over 0.5")).toEqual({ market: "H2_TT2", param: 0.5, sel: "Plus" });
  });
  it("écrit le handicap du point de vue de l'équipe choisie", () => {
    // « Away -1.5 » est l'autre côté de « Home -1.5 » : l'extérieur avec +1,5
    expect(mapAfBet("Asian Handicap", "Home -1.5")).toEqual({ market: "AH", param: -1.5, sel: "1" });
    expect(mapAfBet("Asian Handicap", "Away -1.5")).toEqual({ market: "AH", param: 1.5, sel: "2" });
    expect(mapAfBet("Asian Handicap", "Away +0")).toEqual({ market: "DNB", param: null, sel: "2" });
    expect(mapAfBet("Asian Handicap", "Home -1.25")).toBeNull();
    expect(mapAfBet("Asian Handicap", "Home -0.5")).toBeNull();
  });
  it("laisse de côté ce qui n'a pas de marché correspondant", () => {
    expect(mapAfBet("Corners Asian Handicap", "Home -1")).toBeNull();
    expect(mapAfBet("Marché inconnu", "Home")).toBeNull();
    expect(mapAfBet("Match Winner", "Autre")).toBeNull();
  });
  it("ne reprend que le bookmaker demandé, sans doublon ni cote de 1,00", () => {
    const rows = cotesBookmaker(RELEVE, 11);
    const get = (m: string, p: number | null, s: string) => rows.find((r) => r.m === m && r.p === p && r.s === s)?.c ?? null;
    expect(get("1X2", null, "1")).toBe(1.81); // 1xBet, pas Bet365 (1,80)
    expect(get("OU", 2.5, "Plus")).toBe(1.51);
    expect(get("OU", 0.5, "Plus")).toBeNull(); // 1,00 n'est pas un prix
    expect(get("OU", 0.5, "Moins")).toBe(11.6);
    expect(get("OU", 8.5, "Plus")).toBeNull(); // ligne au-delà de 6,5
    expect(get("DNB", null, "1")).toBe(1.33);
    expect(get("AH", 1, "2")).toBe(1.67);
    expect(get("AH", 1.5, "2")).toBe(1.42);
    expect(get("CS", null, "5-0")).toBeNull(); // scores au-delà de 4 buts non repris
    expect(get("HT_TT1", 0.5, "Plus")).toBe(1.58);
    expect(get("CORN", 9.5, "Plus")).toBe(1.62);
    expect(get("CARD", 4.5, "Plus")).toBe(2.1);
    expect(new Set(rows.map((r) => `${r.m}|${r.p}|${r.s}`)).size).toBe(rows.length);
    expect(cotesBookmaker(RELEVE, 99)).toEqual([]);
  });
});
