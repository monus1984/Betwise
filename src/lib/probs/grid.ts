/**
 * Grille de scores (Poisson) d'un match et probabilité de n'importe quelle sélection.
 * Deux origines possibles pour les buts attendus :
 *  - « modele » : forces attaque/défense du modèle BETWISE ;
 *  - « marche » : buts attendus déduits des cotes de référence (1X2 + plus/moins 2,5), marge retirée.
 */
import { METHODE_MARGE, sansMarge, type MethodeMarge } from "./marge";
import { jambesDe } from "../bets/combo";
import { issue, type Score } from "../mesure/issue";

export type Grid = number[][];
const MAX = 10;
const pmf = (l: number, k: number) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };

export function makeGrid(lh: number, la: number, drawBoost = 0): Grid {
  const g: Grid = [];
  let tot = 0;
  for (let i = 0; i <= MAX; i++) { g[i] = []; for (let j = 0; j <= MAX; j++) { const p = pmf(lh, i) * pmf(la, j) * (i === j ? 1 + drawBoost : 1); g[i][j] = p; tot += p; } }
  for (let i = 0; i <= MAX; i++) for (let j = 0; j <= MAX; j++) g[i][j] /= tot;
  LAMBDAS.set(g, { lh, la });
  return g;
}

/**
 * Mi-temps : en moyenne 45 % des buts d'un match tombent avant la pause (ordre de grandeur constant d'un championnat
 * à l'autre). Les deux mi-temps sont traitées comme indépendantes. Non vérifié sur notre historique, qui n'a pas les
 * scores à la pause : probabilités indicatives.
 */
export const PART_1RE_MI_TEMPS = 0.45;
const LAMBDAS = new WeakMap<Grid, { lh: number; la: number }>();
const HALVES = new WeakMap<Grid, { ht: Grid; h2: Grid }>();
function halves(g: Grid): { ht: Grid; h2: Grid } | null {
  const cached = HALVES.get(g); if (cached) return cached;
  const l = LAMBDAS.get(g); if (!l) return null;
  const f = PART_1RE_MI_TEMPS;
  const v = { ht: makeGrid(l.lh * f, l.la * f), h2: makeGrid(l.lh * (1 - f), l.la * (1 - f)) };
  HALVES.set(g, v);
  return v;
}
const res = (i: number, j: number) => (i > j ? "1" : i < j ? "2" : "N");
const sum = (g: Grid, f: (i: number, j: number) => boolean) => { let s = 0; for (let i = 0; i <= MAX; i++) for (let j = 0; j <= MAX; j++) if (f(i, j)) s += g[i][j]; return s; };

const R1X2: Record<string, (i: number, j: number) => boolean> = { "1": (i, j) => i > j, N: (i, j) => i === j, "2": (i, j) => i < j };
const RDC: Record<string, (i: number, j: number) => boolean> = { "1N": (i, j) => i >= j, "12": (i, j) => i !== j, N2: (i, j) => i <= j };
type Rule = (i: number, j: number) => boolean;
const ou = (sel: string, line: number): Rule => (i, j) => (sel === "Plus" ? i + j > line : i + j < line);

/** Marchés qui existent aussi sur une seule mi-temps. */
const BASES_MI_TEMPS = new Set(["1X2", "DC", "DNB", "OU", "BTTS", "CS", "TT1", "TT2", "AH", "OE", "EH", "MG", "WTN", "OE1", "OE2", "MG1", "MG2"]);
const BTTS: Record<string, Rule> = { Oui: (i, j) => i > 0 && j > 0, Non: (i, j) => i === 0 || j === 0 };
/** Probabilité de gagner quand une égalité à la ligne rembourse : p(gagné) / (p(gagné) + p(perdu)). */
const sansRembourse = (g: Grid, win: Rule, push: Rule) => { const w = sum(g, win), l = sum(g, (i, j) => !win(i, j) && !push(i, j)); return w + l > 0 ? w / (w + l) : null; };

/** Probabilité d'une sélection ; null si le marché n'est pas calculable (ligne en quart, sélection inconnue). */
export function probOf(g: Grid, market: string, param: number | null, sel: string): number | null {
  const ouOk = (s: string) => s === "Plus" || s === "Moins";
  // Marché d'une seule mi-temps (« HT_ », « H2_ ») : le marché de base, calculé sur la grille de cette mi-temps
  if ((market.startsWith("HT_") || market.startsWith("H2_")) && BASES_MI_TEMPS.has(market.slice(3))) {
    const h = halves(g);
    return h ? probOf(market.startsWith("HT_") ? h.ht : h.h2, market.slice(3), param, sel) : null;
  }
  switch (market) {
    case "1X2": return R1X2[sel] ? sum(g, R1X2[sel]) : null;
    case "DC": return RDC[sel] ? sum(g, RDC[sel]) : null;
    case "DNB": { if (sel !== "1" && sel !== "2") return null; const a = sum(g, R1X2["1"]), b = sum(g, R1X2["2"]); return (sel === "1" ? a : b) / (a + b); }
    case "OU": return param === null || !ouOk(sel) ? null : sansRembourse(g, ou(sel, param), (i, j) => i + j === param);
    case "BTTS": return BTTS[sel] ? sum(g, BTTS[sel]) : null;
    case "CS": { const [a, b] = sel.split("-").map(Number); return Number.isInteger(a) && Number.isInteger(b) && a <= MAX && b <= MAX ? g[a][b] : null; }
    case "TT1": case "TT2": {
      if (param === null || !ouOk(sel)) return null;
      const goals = (i: number, j: number) => (market === "TT1" ? i : j);
      return sansRembourse(g, (i, j) => (sel === "Plus" ? goals(i, j) > param : goals(i, j) < param), (i, j) => goals(i, j) === param);
    }
    case "AH": {
      // Même convention que le règlement : sélection « 1 » ou « 2 », param = handicap de l'équipe choisie
      if (param === null || (sel !== "1" && sel !== "2") || (param * 2) % 1 !== 0) return null;
      const adj = (i: number, j: number) => (sel === "1" ? i - j : j - i) + param;
      return sansRembourse(g, (i, j) => adj(i, j) > 0, (i, j) => adj(i, j) === 0);
    }
    case "OE": return sel === "Pair" ? sum(g, (i, j) => (i + j) % 2 === 0) : sel === "Impair" ? sum(g, (i, j) => (i + j) % 2 === 1) : null;
    case "MG": { const r = sel.match(/^(\d+)-(\d+)$/); if (!r) return null; const lo = Number(r[1]), hi = Number(r[2]); return lo <= hi ? sum(g, (i, j) => i + j >= lo && i + j <= hi) : null; }
    case "EH": {
      if (param === null || !Number.isInteger(param) || !R1X2[sel]) return null;
      return sum(g, (i, j) => res(i + param, j) === sel);
    }
    case "WTN": return sel === "1" ? sum(g, (i, j) => i > j && j === 0) : sel === "2" ? sum(g, (i, j) => j > i && i === 0) : null;
    case "OE1": case "OE2": { const v = (i: number, j: number) => (market === "OE1" ? i : j); return sel === "Pair" ? sum(g, (i, j) => v(i, j) % 2 === 0) : sel === "Impair" ? sum(g, (i, j) => v(i, j) % 2 === 1) : null; }
    case "MG1": case "MG2": { const r = sel.match(/^(\d+)-(\d+)$/); if (!r) return null; const lo = Number(r[1]), hi = Number(r[2]); return lo <= hi ? sum(g, (i, j) => { const v = market === "MG1" ? i : j; return v >= lo && v <= hi; }) : null; }
    // Gagne les deux mi-temps ; marque dans les deux mi-temps : produit des deux mi-temps, tirées séparément
    case "WBH": { const h = halves(g); if (!h || (sel !== "1" && sel !== "2")) return null; return sum(h.ht, R1X2[sel]) * sum(h.h2, R1X2[sel]); }
    case "SBH": { const h = halves(g); if (!h || (sel !== "1" && sel !== "2")) return null; const marque = (x: Grid) => sum(x, (i, j) => (sel === "1" ? i : j) >= 1); return marque(h.ht) * marque(h.h2); }
    // Première ou dernière équipe à marquer : part des buts attendus de l'équipe, s'il y a au moins un but
    case "FTS": case "LTS": {
      const l = LAMBDAS.get(g); if (!l || l.lh + l.la <= 0) return null;
      const aucun = Math.exp(-(l.lh + l.la));
      return sel === "Aucun" ? aucun : sel === "1" ? (l.lh / (l.lh + l.la)) * (1 - aucun) : sel === "2" ? (l.la / (l.lh + l.la)) * (1 - aucun) : null;
    }
    case "COMBO": return probCombo(g, sel);
    // Gagne au moins une mi-temps : 1 − (ne gagne pas la 1re) × (ne gagne pas la 2e), les deux mi-temps étant tirées séparément
    case "WEH": { const h = halves(g); if (!h || (sel !== "1" && sel !== "2")) return null; return 1 - (1 - sum(h.ht, R1X2[sel])) * (1 - sum(h.h2, R1X2[sel])); }
    // But dans les deux mi-temps : aucune des deux ne finit 0-0
    case "BH": { const h = halves(g); if (!h || !BTTS[sel]) return null; const oui = (1 - h.ht[0][0]) * (1 - h.h2[0][0]); return sel === "Oui" ? oui : 1 - oui; }
    case "HTFT": {
      const [a, b] = sel.split("/"); const h = halves(g);
      if (!h || !R1X2[a] || !R1X2[b]) return null;
      const M2 = 7; let p = 0; // au-delà de 7 buts par équipe et par mi-temps : négligeable
      for (let i = 0; i <= M2; i++) for (let j = 0; j <= M2; j++) {
        if (res(i, j) !== a) continue;
        for (let k = 0; k <= M2; k++) for (let l = 0; l <= M2; l++) if (res(i + k, j + l) === b) p += h.ht[i][j] * h.h2[k][l];
      }
      return p;
    }
    case "HMG": {
      const h = halves(g); if (!h || !R1X2[sel]) return null;
      const tot = (x: Grid) => { const t = new Array(2 * MAX + 1).fill(0); for (let i = 0; i <= MAX; i++) for (let j = 0; j <= MAX; j++) t[i + j] += x[i][j]; return t as number[]; };
      const t1 = tot(h.ht), t2 = tot(h.h2); let p = 0;
      for (let x = 0; x < t1.length; x++) for (let y = 0; y < t2.length; y++) if (res(x, y) === sel) p += t1[x] * t2[y];
      return p;
    }
    case "DC_OU": case "1X2_OU": {
      const [a, b] = sel.split("|"); const r: Rule | undefined = (market === "DC_OU" ? RDC : R1X2)[a];
      return r !== undefined && param !== null && ouOk(b) ? sansRembourse(g, (i, j) => r(i, j) && ou(b, param)(i, j), (i, j) => r(i, j) && i + j === param) : null;
    }
    case "DC_BTTS": case "1X2_BTTS": {
      const [a, b] = sel.split("|"); const r: Rule | undefined = (market === "DC_BTTS" ? RDC : R1X2)[a];
      return r !== undefined && BTTS[b] ? sum(g, (i, j) => r(i, j) && BTTS[b](i, j)) : null;
    }
    case "OU_BTTS": {
      const [a, b] = sel.split("|");
      return param !== null && ouOk(a) && BTTS[b] ? sansRembourse(g, (i, j) => ou(a, param)(i, j) && BTTS[b](i, j), (i, j) => i + j === param && BTTS[b](i, j)) : null;
    }
  }
  return null;
}

/**
 * Combiné sur un même match : probabilité que toutes les conditions soient gagnées, comptée score par score
 * (les conditions ne sont pas indépendantes : « victoire » et « plus de 2,5 buts » vont souvent ensemble).
 * null dès qu'une condition ne se règle pas sur le score (corners, buteur…).
 */
function probCombo(g: Grid, sel: string): number | null {
  const js = jambesDe(sel); if (!js) return null;
  const etat = (s: Score) => { const rs = js.map((j) => issue(j.market, j.param, j.sel, s)); return rs.includes("perdu") ? "perdu" : rs.includes(null) ? null : rs.every((r) => r === "gagne") ? "gagne" : "rembourse"; };
  let w = 0, l = 0, miTemps = false;
  boucle: for (let i = 0; i <= MAX; i++) for (let j = 0; j <= MAX; j++) {
    const e = etat({ h: i, a: j, hth: null, hta: null });
    if (e === null) { miTemps = true; break boucle; }
    if (e === "gagne") w += g[i][j]; else if (e === "perdu") l += g[i][j];
  }
  if (!miTemps) return w + l > 0 ? w / (w + l) : null;
  const h = halves(g); if (!h) return null;
  const M2 = 7; w = 0; l = 0;
  for (let i = 0; i <= M2; i++) for (let j = 0; j <= M2; j++) for (let k = 0; k <= M2; k++) for (let m = 0; m <= M2; m++) {
    const e = etat({ h: i + k, a: j + m, hth: i, hta: j });
    if (e === null) return null;
    const p = h.ht[i][j] * h.h2[k][m];
    if (e === "gagne") w += p; else if (e === "perdu") l += p;
  }
  return w + l > 0 ? w / (w + l) : null;
}

function bisect(f: (x: number) => number, lo: number, hi: number) { for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; } return (lo + hi) / 2; }

/** Buts attendus (domicile, extérieur) déduits des cotes : total calé sur +2,5, partage calé sur 1 contre 2. */
export function lambdasFromOdds(o: { c1?: number | null; cN?: number | null; c2?: number | null; plus25?: number | null; moins25?: number | null }, methode: MethodeMarge = METHODE_MARGE): { lh: number; la: number; approx: boolean } | null {
  if (!o.c1 || !o.cN || !o.c2) return null;
  const hasOU = !!o.plus25 && !!o.moins25;
  const pOver = hasOU ? sansMarge([o.plus25!, o.moins25!], methode)[0] : 0.5;
  const total = bisect((t) => (1 - Math.exp(-t) * (1 + t + (t * t) / 2)) - pOver, 0.3, 8);
  const [p1, , p2] = sansMarge([o.c1, o.cN, o.c2], methode);
  const target = p1 / (p1 + p2); // part du « 1 » hors nul
  const share = bisect((s) => { const g = makeGrid(total * s, total * (1 - s)); const a = sum(g, R1X2["1"]), b = sum(g, R1X2["2"]); return a / (a + b) - target; }, 0.03, 0.97);
  return { lh: total * share, la: total * (1 - share), approx: !hasOU };
}
