import { describe, expect, it } from "vitest";
import { OddsApiClient, median, normalizeTeam, teamSimilarity } from "./client";

describe("median", () => {
  it("calcule la médiane et ignore les valeurs invalides", () => {
    expect(median([1.8, 1.9, 2.1])).toBe(1.9);
    expect(median([1.8, 2.2])).toBeCloseTo(2.0);
    expect(median([0, 1, NaN])).toBeNull();
  });
});

describe("rapprochement des équipes", () => {
  it("normalise les suffixes de club", () => {
    expect(normalizeTeam("Paris Saint-Germain FC")).toBe("paris saint germain");
    expect(normalizeTeam("FC Bayern München")).toBe("bayern munchen");
  });
  it("reconnaît un même club sous deux libellés", () => {
    expect(teamSimilarity("Manchester City", "Manchester City FC")).toBe(1);
    expect(teamSimilarity("Borussia Dortmund", "Bayer Leverkusen")).toBeLessThan(0.5);
  });
});

describe("resolveSportKey", () => {
  const sports = [
    { key: "soccer_epl", group: "Soccer", title: "EPL", description: "English Premier League", active: true, has_outrights: false },
    { key: "soccer_epl_winner", group: "Soccer", title: "EPL Winner", description: "", active: true, has_outrights: true },
    { key: "soccer_uefa_champs_league", group: "Soccer", title: "UEFA Champions League", description: "", active: true, has_outrights: false },
  ];
  it("retrouve la clé sans prendre les marchés vainqueur final", () => {
    expect(OddsApiClient.resolveSportKey(sports, "PL")).toBe("soccer_epl");
    expect(OddsApiClient.resolveSportKey(sports, "CL")).toBe("soccer_uefa_champs_league");
    expect(OddsApiClient.resolveSportKey(sports, "SA")).toBeNull();
  });
});
