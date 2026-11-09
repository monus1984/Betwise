/**
 * Client football-data.org v4 — plan gratuit.
 * - En-tête X-Auth-Token.
 * - Throttling piloté par les en-têtes de réponse (X-Requests-Available-Minute,
 *   X-RequestCounter-Reset), comme le demande l'auteur de l'API : on attend la
 *   réinitialisation du compteur plutôt que de prendre un 429.
 */

const BASE = "https://api.football-data.org/v4";

/** Compétitions gratuites retenues pour la V1 (codes football-data.org). */
export const COMPETITIONS_V1 = ["PL", "PD", "SA", "BL1", "FL1", "CL"] as const;
/** Gratuites également, activables plus tard si des testeurs y jouent. */
export const COMPETITIONS_EXTRA = ["ELC", "DED", "PPL", "BSA", "WC", "EC"] as const;

export type FdTeam = { id: number; name: string; shortName: string | null; tla: string | null };
export type FdScore = { fullTime: { home: number | null; away: number | null } };
export type FdMatch = {
  id: number;
  utcDate: string;
  status: "SCHEDULED" | "TIMED" | "IN_PLAY" | "PAUSED" | "FINISHED" | "POSTPONED" | "SUSPENDED" | "CANCELLED" | "AWARDED";
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: FdScore;
  competition: { id: number; code: string; name: string };
  season: { startDate: string; endDate: string };
};
export type FdMatchesResponse = { matches: FdMatch[] };
export type FdCompetition = { id: number; code: string; name: string; area: { name: string }; currentSeason: { startDate: string; endDate: string } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class FootballDataClient {
  private available = 10;
  private resetInSec = 60;

  constructor(private token: string) {
    if (!token) throw new Error("FOOTBALL_DATA_TOKEN manquant");
  }

  private async get<T>(path: string): Promise<T> {
    if (this.available <= 0) {
      const wait = (this.resetInSec + 1) * 1000;
      console.log(`[football-data] quota minute épuisé, pause ${wait / 1000}s`);
      await sleep(wait);
    }
    const res = await fetch(`${BASE}${path}`, { headers: { "X-Auth-Token": this.token } });
    const avail = res.headers.get("X-Requests-Available-Minute");
    const reset = res.headers.get("X-RequestCounter-Reset");
    if (avail) this.available = Number(avail);
    if (reset) this.resetInSec = Number(reset);

    if (res.status === 429) {
      const wait = (this.resetInSec + 1) * 1000;
      console.warn(`[football-data] 429 reçu, attente ${wait / 1000}s puis nouvel essai`);
      await sleep(wait);
      return this.get<T>(path);
    }
    if (!res.ok) throw new Error(`football-data ${res.status} sur ${path}: ${await res.text()}`);
    return (await res.json()) as T;
  }

  competition(code: string) {
    return this.get<FdCompetition>(`/competitions/${code}`);
  }

  /** Matchs d'une compétition entre deux dates (YYYY-MM-DD, incluses). */
  matches(code: string, dateFrom: string, dateTo: string) {
    return this.get<FdMatchesResponse>(`/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);
  }
}
