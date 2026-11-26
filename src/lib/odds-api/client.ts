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
export type OddsBookmaker = { key: string; title: string; last_update?: string; markets: OddsMarket[] };
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

  /** Cotes 1X2 d'une liste de bookmakers précis (1 crédit par appel jusqu'à 10 bookmakers), ex. betclic_fr. */
  oddsBookmakers(sportKey: string, bookmakers: string[], from?: string, to?: string) {
    const params: Record<string, string> = { bookmakers: bookmakers.join(","), markets: "h2h", oddsFormat: "decimal", dateFormat: "iso" };
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
    // Lettres sans accent décomposable (Bodø, Ærø, Łódź, ß) : sinon elles disparaissent (24/11)
    .replace(/ø/g, "o").replace(/æ/g, "ae").replace(/ß/g, "ss").replace(/ł/g, "l").replace(/đ/g, "d").replace(/ı/g, "i")
    .replace(/\bman\s*\.?\s*(?=city|utd|united)/g, "manchester ")
    .replace(/\bmunich\b/g, "munchen").replace(/\bmünchen\b/g, "munchen").replace(/\butd\b/g, "united")
    // « City » et « United » sont retirés plus bas : on garde Manchester City et Manchester United distincts
    .replace(/\bmanchester (city|united)\b/g, (_, x: string) => `manchester${x}`)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(fc|cf|sc|ac|as|us|sv|rb|ssc|afc|cfc|club|calcio|de|futbol|football|hotspur|wanderers|united|city)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    // Équipe féminine : « F. », « W », « Women », « Frauen », « Féminines » ne forment qu'un seul mot
    .replace(/\b(f|w|women|frauen|feminines?|ladies|fem)\b/g, " fem ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Score de similarité grossier entre deux noms normalisés : part de mots communs. */
export function teamSimilarity(a: string, b: string): number {
  const A = new Set(normalizeTeam(a).split(" ").filter(Boolean));
  const B = new Set(normalizeTeam(b).split(" ").filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  // Une équipe féminine n'est jamais la même que l'équipe masculine du club (24/11)
  if (A.has("fem") !== B.has("fem")) return 0;
  // Un mot long à une lettre près compte comme le même (« Broendby » / « Brøndby », fautes de frappe)
  // Mots de 8 lettres ou plus : deux fautes tolérées (« Torrence » / « Torreense », 26/11)
  const proche = (w: string, l: Set<string>) => l.has(w) || (w.length >= 6 && [...l].some((x) => x.length >= 6 && Math.abs(x.length - w.length) <= 1 && distance(w, x) <= (w.length >= 8 && x.length >= 8 ? 2 : 1)));
  let common = 0;
  for (const w of A) if (proche(w, B)) common++;
  const jaccard = common / Math.max(A.size, B.size);
  // Nom court contenu dans le nom long (« Bodo » / « Bodø/Glimt », « Slovan » / « ŠK Slovan Bratislava », 24/11) :
  // tous les mots du nom court, d'au moins 4 lettres, se retrouvent dans le nom long.
  const [petit, grand] = A.size <= B.size ? [A, B] : [B, A];
  const generique = /^(real|sporting|atletico|athletic|racing|dynamo|dinamo|inter|olympique|union|deportivo|sporting|club|royal|nacional|national|saint|santa|san|young|boys|rangers|rovers|town|county|wanderers)$/;
  // Les mots de 3 lettres ou moins (« al », « el », « fk ») doivent être là aussi, mais un mot distinctif de 4 lettres au moins est exigé
  const contenu = [...petit].every((w) => proche(w, grand)) && [...petit].some((w) => w.length >= 4 && !generique.test(w));
  return contenu ? Math.max(jaccard, 0.85) : jaccard;
}

/** Distance d'édition (Levenshtein), pour deux mots courts. */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
