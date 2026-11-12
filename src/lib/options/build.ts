import { MARGE_SUPPOSEE } from "../coach/categories";

/** Une option de pari sur un match à venir, avec sa probabilité (cotes de référence d'abord, modèle sinon). */
export type Option = {
  matchId: string; kickoff: string; home: string; away: string; comp: string;
  market: string; param: number | null; sel: string; label: string; famille: "resultat" | "buts" | "combo";
  p: number; cote: number | null; source: "marche" | "modele";
};
/** Cote qu'on peut espérer chez un bookmaker : la cote de référence si elle existe, sinon la cote juste moins une marge moyenne. */
export const coteEstimee = (o: Pick<Option, "p" | "cote">) => o.cote ?? Math.max(1.01, 1 / o.p / (1 + MARGE_SUPPOSEE));

export type Combo = { legs: Option[]; p: number; coteJuste: number; cote: number; atteint: boolean };

/**
 * Combinés qui visent une cote, une sélection par match (pas de corrélation cachée entre deux sélections d'un même match).
 * Combiner des sélections indépendantes ne change pas la probabilité de gagner à cote égale : elle reste ≈ 1 / cote.
 * Ce qui change, c'est la marge du bookmaker, prélevée à chaque sélection. D'où la règle : le moins de sélections possible,
 * donc dans chaque match l'option la plus cotée qui reste dans la fourchette choisie.
 * Jusqu'à `n` combinés, sans match en commun.
 */
export function buildCombos(options: Option[], cible: number, n = 3, maxLegs = 10): Combo[] {
  const byMatch = new Map<string, Option[]>();
  for (const o of options) byMatch.set(o.matchId, [...(byMatch.get(o.matchId) ?? []), o]);
  const used = new Set<string>();
  const out: Combo[] = [];
  for (let k = 0; k < n; k++) {
    const legs: Option[] = [];
    let cote = 1;
    const taken = new Set<string>();
    while (cote < cible && legs.length < maxLegs) {
      const pool = [...byMatch.entries()].filter(([id]) => !used.has(id) && !taken.has(id)).flatMap(([, os]) => os);
      if (!pool.length) break;
      // Peut-on finir avec une seule sélection ? Alors la plus sûre qui suffit (au plus près de la cible).
      const finish = pool.filter((o) => cote * coteEstimee(o) >= cible).sort((a, b) => coteEstimee(a) - coteEstimee(b) || b.p - a.p)[0];
      // Sinon la plus cotée, à égalité celle qui a une vraie cote de référence
      const next = finish ?? pool.sort((a, b) => coteEstimee(b) - coteEstimee(a) || Number(!!b.cote) - Number(!!a.cote))[0];
      legs.push(next); taken.add(next.matchId); cote *= coteEstimee(next);
    }
    if (!legs.length) break;
    for (const id of taken) used.add(id);
    const p = legs.reduce((x, o) => x * o.p, 1);
    out.push({ legs: legs.sort((a, b) => a.kickoff.localeCompare(b.kickoff)), p, coteJuste: 1 / p, cote, atteint: cote >= cible });
    if (cote < cible) break; // plus assez de matchs pour un combiné de plus
  }
  return out;
}

/** Sélections d'un match dans la fourchette : les plus probables d'abord, une par marché pour éviter les doublons. */
export function singlesOf(options: Option[], parMatch = 3): Option[] {
  const byMatch = new Map<string, Option[]>();
  for (const o of [...options].sort((a, b) => b.p - a.p)) {
    const l = byMatch.get(o.matchId) ?? [];
    if (l.length < parMatch && !l.some((x) => x.market === o.market)) l.push(o);
    byMatch.set(o.matchId, l);
  }
  return [...byMatch.values()].flat().sort((a, b) => b.p - a.p);
}

/** Lien de saisie préremplie (pari ou test) : match~marché~ligne~sélection~cote, séparés par des virgules. */
export function legsParam(legs: Pick<Option, "matchId" | "market" | "param" | "sel" | "p" | "cote">[]): string {
  return legs.map((o) => [o.matchId, o.market, o.param ?? "", o.sel, coteEstimee(o).toFixed(2)].join("~")).join(",");
}
export function parseLegs(s: string | undefined): { match: string; market: string; param: string; sel: string; cote: string }[] {
  if (!s) return [];
  return s.split(",").slice(0, 20).map((x) => x.split("~")).filter((x) => x.length === 5 && /^[0-9a-f-]{36}$/.test(x[0]))
    .map(([match, market, param, sel, cote]) => ({ match, market, param, sel, cote }));
}
