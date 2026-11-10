/**
 * Client The Odds API v4 — cotes de référence européennes (plan gratuit, 500 crédits / mois).
 * Coût d'un appel = nb de marchés × nb de régions. On appelle regions=eu, markets=h2h,totals → 2 crédits
 * par compétition et par passage. Six compétitions, un passage par jour : ~360 crédits / mois.
 * Les en-têtes x-requests-remaining / x-requests-used sont lus et remontés pour le compteur admin.
 */

const BASE = "https://api.the-odds-api.com/v4";

/** Correspondance code football-data.org → fragments attendus dans le titre The Odds API. */
/** Clés exactes The Odds API (une recherche par mots-clés confondait la Liga avec la Copa del Rey, la Bundesliga avec l'Autriche). */
export const SPORT_KEYS: Record<string, string> = {
  PL: "soccer_epl",
  PD: "soccer_spain_la_liga",
  SA: "soccer_italy_serie_a",
  BL1: "soccer_germany_bundesliga",
  FL1: "soccer_france_ligue_one",
  CL: "soccer_uefa_champs_league",
  UNL: "soccer_uefa_nations_league",
};

export type OddsSport = { key: string; group: string; title: string; description: string; active: boolean; has_outrights: boolean };
export type OddsOutcome = { name: string; price: number; point?: number };
export type OddsMarket = { key: "h2h" | "totals" | "spreads"; outcomes: OddsOutcome[] };
export type OddsBookmaker = { key: string; title: string; markets: OddsMarket[] };
export type OddsEvent = {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
};

export class OddsApiClient {
  remaining: number | null = null;
  used: number | null = null;

  constructor(private apiKey: string) {
    if (!apiKey) throw new Error("ODDS_API_KEY manquant");
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE}${path}`);
    url.searchParams.set("apiKey", this.apiKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url);
    const rem = res.headers.get("x-requests-remaining");
    const used = res.headers.get("x-requests-used");
    if (rem) this.remaining = Number(rem);
    if (used) this.used = Number(used);
    if (!res.ok) throw new Error(`odds-api ${res.status} sur ${path}: ${await res.text()}`);
    return (await res.json()) as T;
  }

  /** Liste des sports (gratuit : ne consomme pas de crédit). */
  sports() {
    return this.get<OddsSport[]>("/sports", { all: "false" });
  }

  /**
   * Résout la clé The Odds API d'une compétition football-data.org à partir des titres.
   * Retourne null si la compétition n'a pas de marché ouvert en ce moment.
   */
  static resolveSportKey(sports: OddsSport[], fdCode: string): string | null {
    const key = SPORT_KEYS[fdCode];
    if (!key) return null;
    return sports.some((s) => s.key === key && s.active) ? key : null;
  }

  /** Calendrier d'une compétition (gratuit). */
  events(sportKey: string) {
    return this.get<{ id: string; commence_time: string; home_team: string; away_team: string }[]>(`/sports/${sportKey}/events`, { dateFormat: "iso" });
  }

  /** Scores des matchs en cours et terminés depuis daysFrom jours (2 crédits avec daysFrom). */
  scores(sportKey: string, daysFrom = 3) {
    return this.get<unknown[]>(`/sports/${sportKey}/scores`, { daysFrom: String(daysFrom), dateFormat: "iso" });
  }

  /** Cotes d'une compétition : 1X2 (h2h) et plus/moins (totals), bookmakers européens, décimales. */
  odds(sportKey: string, from?: string, to?: string) {
    const params: Record<string, string> = { regions: "eu", markets: "h2h,totals", oddsFormat: "decimal", dateFormat: "iso" };
    if (from) params.commenceTimeFrom = from;
    if (to) params.commenceTimeTo = to;
    return this.get<OddsEvent[]>(`/sports/${sportKey}/odds`, params);
  }
}

/** Médiane des cotes d'un marché/sélection sur tous les bookmakers : la « cote de référence ». */
export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x) && x > 1).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Normalise un nom d'équipe pour le rapprochement : minuscules, sans accents, sans suffixes de club. */
export function normalizeTeam(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(fc|cf|sc|ac|as|us|sv|rb|ssc|afc|cfc|club|calcio|de|futbol|football|hotspur|wanderers|united|city)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Score de similarité grossier entre deux noms normalisés : part de mots communs. */
export function teamSimilarity(a: string, b: string): number {
  const A = new Set(normalizeTeam(a).split(" ").filter(Boolean));
  const B = new Set(normalizeTeam(b).split(" ").filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  return common / Math.max(A.size, B.size);
}
