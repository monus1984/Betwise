/** Client API-Football v3 (offre Pro : 7 500 requêtes/jour, toutes compétitions). */
const BASE = "https://v3.football.api-sports.io";

export type AfFixture = {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null } };
  league: { id: number; season: number; round?: string };
  teams: { home: { id: number; name: string; winner?: boolean | null }; away: { id: number; name: string; winner?: boolean | null } };
  /** Présents seulement quand le match est demandé par identifiant (byIds). */
  events?: { time: { elapsed: number | null; extra: number | null }; team: { id: number }; player: { name: string | null }; type: string; detail: string; comments: string | null }[];
  goals: { home: number | null; away: number | null };
  statistics?: { team: { id: number }; statistics: { type: string; value: number | string | null }[] }[];
  score: { fulltime: { home: number | null; away: number | null }; halftime?: { home: number | null; away: number | null } };
};
export type AfStanding = { rank: number; team: { id: number; name: string }; points: number; goalsDiff: number; group: string | null; form: string | null; description: string | null; all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } } };
export type AfOdds = {
  fixture: { id: number };
  bookmakers: { name: string; bets: { name: string; values: { value: string; odd: string }[] }[] }[];
};

export const cleanKey = (k: string) => k.trim().replace(/^["']|["']$/g, "").trim();

export class ApiFootball {
  calls = 0; remaining: string | null = null;
  private key: string;
  /** La clé est nettoyée : un espace, un retour à la ligne ou des guillemets collés par erreur la rendent invalide. */
  constructor(key: string) { this.key = cleanKey(key); }

  private async get<T>(path: string): Promise<{ response: T[]; paging?: { current: number; total: number }; errors?: unknown }> {
    this.calls++;
    const r = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": this.key } });
    this.remaining = r.headers.get("x-ratelimit-requests-remaining");
    if (!r.ok) throw new Error(`API-Football ${path} → HTTP ${r.status}`);
    const j = (await r.json()) as { response: T[]; paging?: { current: number; total: number }; errors?: unknown };
    const errs = j.errors && (Array.isArray(j.errors) ? j.errors.length : Object.keys(j.errors as object).length);
    if (errs) throw new Error(`API-Football ${path} → ${JSON.stringify(j.errors)}`);
    return j;
  }

  fixtures(league: number, season: number, from: string, to: string) {
    return this.get<AfFixture>(`/fixtures?league=${league}&season=${season}&from=${from}&to=${to}`).then((j) => j.response);
  }
  season(league: number, season: number) { return this.get<AfFixture>(`/fixtures?league=${league}&season=${season}&status=FT-AET-PEN`).then((j) => j.response); }
  live() { return this.get<AfFixture>(`/fixtures?live=all`).then((j) => j.response); }
  /** Jusqu'à 20 matchs par identifiant (scores finaux des matchs sortis du direct). */
  byIds(ids: number[]) { return this.get<AfFixture>(`/fixtures?ids=${ids.slice(0, 20).join("-")}`).then((j) => j.response); }

  /** Classement d'une compétition : un tableau par groupe (un seul pour un championnat). */
  standings(league: number, season: number) {
    return this.get<{ league: { standings: AfStanding[][] } }>(`/standings?league=${league}&season=${season}`).then((j) => j.response[0]?.league.standings ?? []);
  }

  /** Cotes d'avant-match d'une compétition (10 matchs par page). */
  async odds(league: number, season: number, maxPages = 6) {
    const out: AfOdds[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const j = await this.get<AfOdds>(`/odds?league=${league}&season=${season}&page=${page}`);
      out.push(...j.response);
      if (!j.paging || page >= j.paging.total) break;
    }
    return out;
  }
}
