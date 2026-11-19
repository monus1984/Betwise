/**
 * Deux façons de retirer la marge du bookmaker d'un jeu de cotes (1, N, 2 ou plus / moins).
 * - proportionnelle : chaque issue perd la même part ; c'est ce que fait l'application aujourd'hui.
 * - puissance : la marge pèse davantage sur les issues peu probables (les bookmakers margent plus les outsiders).
 */
export function proportionnelle(cotes: number[]): number[] {
  const inv = cotes.map((c) => 1 / c), tot = inv.reduce((a, b) => a + b, 0);
  return inv.map((x) => x / tot);
}

export function puissance(cotes: number[]): number[] {
  const inv = cotes.map((c) => 1 / c);
  if (inv.reduce((a, b) => a + b, 0) <= 1) return proportionnelle(cotes); // pas de marge à retirer
  let lo = 1, hi = 5;
  for (let i = 0; i < 60; i++) { const k = (lo + hi) / 2; if (inv.reduce((s, x) => s + Math.pow(x, k), 0) > 1) lo = k; else hi = k; }
  const k = (lo + hi) / 2, p = inv.map((x) => Math.pow(x, k)), tot = p.reduce((a, b) => a + b, 0);
  return p.map((x) => x / tot);
}
