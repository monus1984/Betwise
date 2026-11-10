/**
 * Modèle BETWISE v1 : Poisson à forces d'attaque/défense pondérées dans le temps.
 * - Pondération exponentielle (demi-vie 150 jours) : les matchs récents comptent plus.
 * - Lissage vers la moyenne (k matchs fictifs) pour les promus et les débuts de saison.
 * - Pas de correction Dixon-Coles des scores serrés (v2), pas de blessures ni de calendrier.
 * Les probabilités sont ensuite comparées aux cotes de référence pour juger le modèle comme une source.
 */

export type HistMatch = { date: Date; home: string; away: string; hg: number; ag: number };
export type Ratings = {
  mu: number; homeAdv: number; teams: Map<string, { att: number; def: number; n: number }>;
};

const HALF_LIFE_DAYS = 150;
const PRIOR_MATCHES = 4;

export function fitRatings(matches: HistMatch[], asOf = new Date()): Ratings {
  const w = (d: Date) => Math.pow(0.5, Math.max(0, (asOf.getTime() - d.getTime()) / 86400000) / HALF_LIFE_DAYS);
  const names = new Set<string>();
  for (const m of matches) { names.add(m.home); names.add(m.away); }
  const teams = new Map<string, { att: number; def: number; n: number }>();
  for (const n of names) teams.set(n, { att: 1, def: 1, n: 0 });

  let sw = 0, sg = 0;
  for (const m of matches) { const k = w(m.date); sw += k; sg += k * (m.hg + m.ag); teams.get(m.home)!.n += k; teams.get(m.away)!.n += k; }
  const mu = sg / (2 * sw); // buts par équipe et par match
  let homeAdv = 1.2;

  for (let iter = 0; iter < 60; iter++) {
    const gf = new Map<string, number>(), ef = new Map<string, number>(), ga = new Map<string, number>(), ea = new Map<string, number>();
    let hg = 0, he = 0;
    for (const m of matches) {
      const k = w(m.date), h = teams.get(m.home)!, a = teams.get(m.away)!;
      const lh = mu * homeAdv * h.att * a.def, la = mu * a.att * h.def;
      gf.set(m.home, (gf.get(m.home) ?? 0) + k * m.hg); ef.set(m.home, (ef.get(m.home) ?? 0) + k * lh);
      gf.set(m.away, (gf.get(m.away) ?? 0) + k * m.ag); ef.set(m.away, (ef.get(m.away) ?? 0) + k * la);
      ga.set(m.home, (ga.get(m.home) ?? 0) + k * m.ag); ea.set(m.home, (ea.get(m.home) ?? 0) + k * la);
      ga.set(m.away, (ga.get(m.away) ?? 0) + k * m.hg); ea.set(m.away, (ea.get(m.away) ?? 0) + k * lh);
      hg += k * m.hg; he += k * lh;
    }
    let sa = 0, sd = 0;
    for (const [n, t] of teams) {
      // lissage : PRIOR_MATCHES matchs fictifs à la moyenne
      t.att = t.att * ((gf.get(n) ?? 0) + PRIOR_MATCHES * mu) / ((ef.get(n) ?? 0) + PRIOR_MATCHES * mu);
      t.def = t.def * ((ga.get(n) ?? 0) + PRIOR_MATCHES * mu) / ((ea.get(n) ?? 0) + PRIOR_MATCHES * mu);
      sa += t.att; sd += t.def;
    }
    const na = sa / teams.size, nd = sd / teams.size;
    for (const t of teams.values()) { t.att /= na; t.def /= nd; }
    homeAdv = homeAdv * hg / he;
  }
  return { mu, homeAdv, teams };
}

function poissonPmf(l: number, k: number) { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; }

export type MatchProbs = {
  lambdaHome: number; lambdaAway: number;
  p1: number; pN: number; p2: number; pPlus25: number; pMoins25: number; pBttsOui: number; pBttsNon: number;
  topScore: string;
};

export function predict(r: Ratings, home: string, away: string): MatchProbs | null {
  const h = r.teams.get(home), a = r.teams.get(away);
  if (!h || !a) return null;
  const lh = r.mu * r.homeAdv * h.att * a.def, la = r.mu * a.att * h.def;
  const MAX = 10;
  let p1 = 0, pN = 0, p2 = 0, pPlus = 0, pBtts = 0, best = 0, topScore = "";
  for (let i = 0; i <= MAX; i++) for (let j = 0; j <= MAX; j++) {
    const p = poissonPmf(lh, i) * poissonPmf(la, j);
    if (i > j) p1 += p; else if (i === j) pN += p; else p2 += p;
    if (i + j > 2.5) pPlus += p;
    if (i > 0 && j > 0) pBtts += p;
    if (p > best) { best = p; topScore = `${i}-${j}`; }
  }
  const tot = p1 + pN + p2; // renormalisation (queue tronquée à 10 buts)
  return { lambdaHome: lh, lambdaAway: la, p1: p1 / tot, pN: pN / tot, p2: p2 / tot, pPlus25: pPlus / tot, pMoins25: 1 - pPlus / tot, pBttsOui: pBtts / tot, pBttsNon: 1 - pBtts / tot, topScore };
}

/** Niveau de risque 1 (très sûr) → 5 (très incertain) d'après la probabilité de la sélection. */
export function riskLevel(p: number) {
  return p >= 0.65 ? 1 : p >= 0.55 ? 2 : p >= 0.45 ? 3 : p >= 0.35 ? 4 : 5;
}
