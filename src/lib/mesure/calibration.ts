/**
 * Mesure de la justesse des probabilités : « quand l'application annonce 70 %, cela arrive-t-il 70 fois sur 100 ? »
 * Fonctions pures, partagées par le script de mesure et ses tests.
 */

/** Une sélection réglée : la probabilité annoncée avant le match, et ce qui s'est passé (1 = gagnée, 0 = perdue). */
export type Obs = { p: number; y: 0 | 1 };

export type Resume = {
  n: number;
  /** Probabilité moyenne annoncée. */
  pMoy: number;
  /** Fréquence observée, avec son intervalle à 95 % (Wilson) : sur peu de matchs, il est large. */
  freq: number; ic: [number, number];
  /** Score de Brier : moyenne des écarts au carré (0 = parfait). */
  brier: number;
  /** Brier d'une prévision constante égale à la fréquence observée : le niveau à battre. */
  brierRef: number;
  /** Gain sur cette référence : > 0, les probabilités apprennent quelque chose ; ≤ 0, elles ne font pas mieux qu'une moyenne. */
  gain: number;
  logLoss: number;
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const EPS = 1e-6;

/** Intervalle de Wilson à 95 % d'une fréquence observée sur n essais. */
export function wilson(f: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 1];
  const d = 1 + (z * z) / n, c = f + (z * z) / (2 * n), e = z * Math.sqrt((f * (1 - f)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - e) / d), Math.min(1, (c + e) / d)];
}

export function resume(obs: Obs[]): Resume | null {
  const n = obs.length;
  if (!n) return null;
  const pMoy = mean(obs.map((o) => o.p)), freq = mean(obs.map((o) => o.y));
  const brier = mean(obs.map((o) => (o.p - o.y) ** 2)), brierRef = freq * (1 - freq);
  const logLoss = -mean(obs.map((o) => Math.log(Math.min(1 - EPS, Math.max(EPS, o.y ? o.p : 1 - o.p)))));
  return { n, pMoy, freq, ic: wilson(freq, n), brier, brierRef, gain: brierRef > 0 ? 1 - brier / brierRef : 0, logLoss };
}

export type Tranche = { de: number; a: number; n: number; pMoy: number; freq: number; ic: [number, number] };
export const BORNES = [0, 0.3, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

/** Sélections rangées par probabilité annoncée : pour chaque tranche, ce qui était annoncé et ce qui est arrivé. */
export function tranches(obs: Obs[], bornes = BORNES): Tranche[] {
  const out: Tranche[] = [];
  for (let i = 0; i < bornes.length - 1; i++) {
    const de = bornes[i], a = bornes[i + 1], dernier = i === bornes.length - 2;
    const xs = obs.filter((o) => o.p >= de && (dernier ? o.p <= a : o.p < a));
    if (!xs.length) continue;
    const freq = mean(xs.map((o) => o.y));
    out.push({ de, a, n: xs.length, pMoy: mean(xs.map((o) => o.p)), freq, ic: wilson(freq, xs.length) });
  }
  return out;
}

/** Écart moyen de calibration (points de probabilité), pondéré par la taille des tranches. */
export function ecartCalibration(obs: Obs[], bornes = BORNES): number {
  if (!obs.length) return 0;
  return tranches(obs, bornes).reduce((s, t) => s + (t.n / obs.length) * Math.abs(t.freq - t.pMoy), 0);
}

/** Log-loss d'un pari à trois issues (1, N, 2) : −moyenne du logarithme de la probabilité donnée à l'issue survenue. */
export function logLoss3(rows: { p: [number, number, number]; k: 0 | 1 | 2 }[]): number | null {
  if (!rows.length) return null;
  return -mean(rows.map((r) => Math.log(Math.max(EPS, r.p[r.k]))));
}

/** Rendement à mise fixe : gain moyen par unité misée sur des paris de cote donnée. */
export function rendement(paris: { cote: number; y: 0 | 1 }[]): number | null {
  if (!paris.length) return null;
  return mean(paris.map((b) => (b.y ? b.cote - 1 : -1)));
}

export const pct = (x: number, d = 0) => `${(x * 100).toFixed(d).replace(".", ",")} %`;
