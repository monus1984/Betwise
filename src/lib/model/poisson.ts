/**
 * Modèle BETWISE v1 : Poisson à forces d'attaque/défense pondérées dans le temps.
 * - Pondération exponentielle (demi-vie 365 jours) et lissage vers un point de départ (6 matchs fictifs) :
 *   la moyenne de la ligue, ou un niveau « promu » (attaque 0,8, défense 1,2) pour une équipe absente
 *   de la première saison de l'historique. Réglages retenus sur un backtest de 1 953 matchs
 *   (oct. 2025 → nov. 2026, 5 ligues) : log-loss 1X2 0,9995 contre 0,973 pour le marché.
 *   Le modèle ne voit que les buts et reste un peu moins affirmatif que le marché sur les favoris.
 * - Nul rehaussé de 10 % (Poisson indépendant les sous-estime : 23 % prédits, 25 % observés).
 * - Pas de blessures, compositions ni calendrier. Piste v2 : tirs cadrés (colonnes HST/AST du même CSV).
 * Les probabilités sont ensuite comparées aux cotes de référence pour juger le modèle comme une source.
 */

export type HistMatch = { date: Date; home: string; away: string; hg: number; ag: number };
export type Ratings = {
  mu: number; homeAdv: number; teams: Map<string, { att: number; def: number; n: number }>;
};

export const DEFAULTS = { halfLifeDays: 365, priorMatches: 6, promotedAtt: 0.8, promotedDef: 1.2 };
const DRAW_BOOST = 0.1;

export function fitRatings(matches: HistMatch[], asOf = new Date(), o: Partial<typeof DEFAULTS> = {}): Ratings {
  const opts = { ...DEFAULTS, ...o };
  const HALF_LIFE_DAYS = opts.halfLifeDays, PRIOR_MATCHES = opts.priorMatches;
  // Promu : équipe absente de la première saison de l'historique → point de départ plus faible que la moyenne
  const minT = Math.min(...matches.map((m) => m.date.getTime()));
  const firstSeen = new Map<string, number>();
  for (const m of matches) for (const n of [m.home, m.away]) firstSeen.set(n, Math.min(firstSeen.get(n) ?? Infinity, m.date.getTime()));
  const promoted = (n: string) => (firstSeen.get(n) ?? minT) - minT > 200 * 86400000;
  const w = (d: Date) => Math.pow(0.5, Math.max(0, (asOf.getTime() - d.getTime()) / 86400000) / HALF_LIFE_DAYS);
  const names = new Set<string>();
  for (const m of matches) { names.add(m.home); names.add(m.away); }
  const teams = new Map<string, { att: number; def: number; n: number }>();
  const priorAtt = new Map<string, number>(), priorDef = new Map<string, number>();
  for (const n of names) {
    const p = promoted(n);
    priorAtt.set(n, p ? opts.promotedAtt : 1); priorDef.set(n, p ? opts.promotedDef : 1);
    teams.set(n, { att: priorAtt.get(n)!, def: priorDef.get(n)!, n: 0 });
  }

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
      // lissage : PRIOR_MATCHES matchs fictifs joués au niveau du point de départ (moyenne, ou promu)
      t.att = t.att * ((gf.get(n) ?? 0) + PRIOR_MATCHES * mu * priorAtt.get(n)!) / ((ef.get(n) ?? 0) + PRIOR_MATCHES * mu * t.att);
      t.def = t.def * ((ga.get(n) ?? 0) + PRIOR_MATCHES * mu * priorDef.get(n)!) / ((ea.get(n) ?? 0) + PRIOR_MATCHES * mu * t.def);
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
  const tot = p1 + pN + p2; // queue tronquée à 10 buts
  const t1x2 = p1 + pN * (1 + DRAW_BOOST) + p2;
  return { lambdaHome: lh, lambdaAway: la, p1: p1 / t1x2, pN: (pN * (1 + DRAW_BOOST)) / t1x2, p2: p2 / t1x2, pPlus25: pPlus / tot, pMoins25: 1 - pPlus / tot, pBttsOui: pBtts / tot, pBttsNon: 1 - pBtts / tot, topScore };
}

/** Niveau de risque 1 (très sûr) → 5 (très incertain) d'après la probabilité de la sélection. */
export function riskLevel(p: number) {
  return p >= 0.65 ? 1 : p >= 0.55 ? 2 : p >= 0.45 ? 3 : p >= 0.35 ? 4 : 5;
}
