import { describe, expect, it } from "vitest";
import { parseCsv } from "./history";

describe("historique football-data.co.uk", () => {
  const csv = [
    "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HTR,AvgH,AvgD,AvgA,Avg>2.5,Avg<2.5",
    "E0,16/08/2025,15:00,Alpha,Beta,3,1,H,1,1,D,1.85,3.6,4.2,1.8,2.02",
    "E0,17/08/2025,15:00,Gamma,Delta,0,0,D,,,D,2.4,3.2,3.1,2.1,1.75",
  ].join("\n");
  it("lit le score final, les cotes et le score à la pause", () => {
    const [a, b] = parseCsv(csv, "E0", "2526");
    expect(a).toMatchObject({ played_on: "2025-08-16", home_goals: 3, away_goals: 1, ht_home_goals: 1, ht_away_goals: 1, cote_1: 1.85, cote_plus25: 1.8 });
    // score à la pause absent du fichier : null, jamais 0
    expect(b).toMatchObject({ home_goals: 0, away_goals: 0, ht_home_goals: null, ht_away_goals: null });
  });
  it("fonctionne sur un fichier sans colonnes de mi-temps", () => {
    const [a] = parseCsv("Date,HomeTeam,AwayTeam,FTHG,FTAG,AvgH,AvgD,AvgA\n16/08/2025,Alpha,Beta,2,0,1.5,4,6", "E0", "2526");
    expect(a.ht_home_goals).toBeNull();
    expect(a.home_goals).toBe(2);
  });
});
