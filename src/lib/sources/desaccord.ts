/**
 * Désaccords entre sources sur un même match : deux pronos qui ne peuvent pas être justes tous les deux.
 * On ne signale que les contradictions certaines (même marché, issues qui s'excluent), jamais une simple nuance.
 */
export type PronoM = { source: string; market: string; param: number | null; sel: string };
export type Desaccord = { a: PronoM; b: PronoM };

const EXCLUSIFS = new Set(["1X2", "OU", "BTTS", "DNB", "OE", "TT1", "TT2", "HT_1X2", "HT_OU"]);
const issues = (p: PronoM): Set<string> | null =>
  p.market === "1X2" ? new Set([p.sel.toUpperCase()]) : p.market === "DC" ? new Set(p.sel.toUpperCase().replace("X", "N").split("")) : null;

export function contredit(a: PronoM, b: PronoM): boolean {
  if (a.source === b.source) return false;
  if (a.market === b.market && (a.param ?? null) === (b.param ?? null))
    return EXCLUSIFS.has(a.market) && a.sel.trim().toLowerCase() !== b.sel.trim().toLowerCase();
  // Résultat contre double chance (ou deux doubles chances) : contradiction seulement si aucune issue n'est commune
  const ia = issues(a), ib = issues(b);
  if (ia && ib && a.market !== b.market) return ![...ia].some((x) => ib.has(x));
  return false;
}

export function desaccords(pronos: PronoM[]): Desaccord[] {
  const out: Desaccord[] = [];
  for (let i = 0; i < pronos.length; i++) for (let j = i + 1; j < pronos.length; j++) if (contredit(pronos[i], pronos[j])) out.push({ a: pronos[i], b: pronos[j] });
  return out;
}
