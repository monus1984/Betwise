import type { createClient } from "@/lib/supabase/server";
import { MODEL_VERSION } from "../model/version";
import { lambdasFromOdds, makeGrid, probOf, type Grid } from "./grid";

type Db = Awaited<ReturnType<typeof createClient>>;
/**
 * La probabilité affichée vient des cotes de référence dès qu'elles existent : sur 1 954 matchs passés, elles
 * sont plus justes que le modèle, et le modèle ne les améliore pas. Le modèle sert de second avis, et de
 * source principale seulement quand il n'y a pas de cote.
 */
export type Signal = {
  source: "modele" | "marche"; lh: number; la: number; grid: Grid; approx: boolean;
  market: { lh: number; la: number; grid: Grid } | null;
  model: { lh: number; la: number; grid: Grid } | null;
  /** Cote de référence d'une sélection, si elle existe. */
  refOdd: (market: string, param: number | null, sel: string) => number | null;
  /** Probabilité tirée directement des cotes de référence pour les marchés cotés (1X2, plus/moins 2,5). */
  direct: (market: string, param: number | null, sel: string) => number | null;
};
/** pModele : second avis du modèle sur la même sélection, quand il couvre le match et que p vient des cotes. */
export type Pick = { market: string; param: number | null; sel: string; p: number; cote: number | null; pModele: number | null };

const DRAW_BOOST = 0.1; // même correction que le modèle (poisson.ts)
const CANDIDATES: [string, number | null, string][] = [
  ["1X2", null, "1"], ["1X2", null, "N"], ["1X2", null, "2"], ["DC", null, "1N"], ["DC", null, "N2"],
  ["OU", 1.5, "Plus"], ["OU", 2.5, "Plus"], ["OU", 2.5, "Moins"], ["OU", 3.5, "Moins"], ["BTTS", null, "Oui"], ["BTTS", null, "Non"],
];

/** Signaux (buts attendus + cotes) pour une liste de matchs, en deux requêtes. */
export async function loadSignals(db: Db, ids: string[]): Promise<Map<string, Signal>> {
  const out = new Map<string, Signal>();
  if (!ids.length) return out;
  const [{ data: est }, { data: odds }] = await Promise.all([
    db.from("model_estimates").select("match_id, justification").eq("market_code", "1X2").eq("selection", "1").eq("model_version", MODEL_VERSION).in("match_id", ids),
    db.from("odds_observations").select("match_id, market_code, market_param, selection, cote, observed_at").eq("bookmaker", "ref:eu-median").in("match_id", ids).order("observed_at", { ascending: false }).limit(4000),
  ]);
  for (const id of ids) {
    const mine = (odds ?? []).filter((o) => o.match_id === id);
    const refOdd = (market: string, param: number | null, sel: string) => {
      const o = mine.find((x) => x.market_code === market && x.selection === sel && (x.market_param === null ? param === null : Number(x.market_param) === param));
      return o ? Number(o.cote) : null;
    };
    // Probabilité directe des marchés cotés (victoire, plus/moins 2,5) : cotes de référence, marge retirée proportionnellement
    const direct = (market: string, param: number | null, sel: string): number | null => {
      const group = market === "1X2" ? (["1", "N", "2"] as const).map((k) => refOdd("1X2", null, k)) : market === "OU" && param === 2.5 ? (["Plus", "Moins"] as const).map((k) => refOdd("OU", 2.5, k)) : null;
      if (!group || group.some((c) => !c)) return null;
      const inv = group.map((c) => 1 / c!), tot = inv.reduce((a, b) => a + b, 0);
      const idx = market === "1X2" ? ["1", "N", "2"].indexOf(sel) : ["Plus", "Moins"].indexOf(sel);
      return idx < 0 ? null : inv[idx] / tot;
    };
    const ml = lambdasFromOdds({ c1: refOdd("1X2", null, "1"), cN: refOdd("1X2", null, "N"), c2: refOdd("1X2", null, "2"), plus25: refOdd("OU", 2.5, "Plus"), moins25: refOdd("OU", 2.5, "Moins") });
    const market = ml ? { lh: ml.lh, la: ml.la, grid: makeGrid(ml.lh, ml.la) } : null;
    const j = est?.find((e) => e.match_id === id)?.justification as { lambda_dom?: number; lambda_ext?: number } | null | undefined;
    const model = j?.lambda_dom && j?.lambda_ext ? { lh: j.lambda_dom, la: j.lambda_ext, grid: makeGrid(j.lambda_dom, j.lambda_ext, DRAW_BOOST) } : null;
    if (ml && market) out.set(id, { source: "marche", lh: ml.lh, la: ml.la, grid: market.grid, approx: ml.approx, market, model, refOdd, direct });
    else if (model) out.set(id, { source: "modele", lh: model.lh, la: model.la, grid: model.grid, approx: false, market: null, model, refOdd, direct: () => null });
  }
  return out;
}

/** Probabilité d'une sélection quelconque, cohérente avec les pastilles (cote directe d'abord, grille ensuite). */
export function probOfSignal(s: Signal, market: string, param: number | null, sel: string): number | null {
  return (s.source === "marche" ? s.direct(market, param, sel) : null) ?? probOf(s.grid, market, param, sel);
}

/** Toutes les sélections calculables d'un match : simples, buts par équipe, handicaps, combos même match. */
const PO = ["Plus", "Moins"], ON = ["Oui", "Non"];
export const ALL_CANDIDATES: [string, number | null, string][] = [
  ...["1", "N", "2"].map((x) => ["1X2", null, x] as [string, null, string]),
  ...["1N", "N2", "12"].map((x) => ["DC", null, x] as [string, null, string]),
  ["DNB", null, "1"], ["DNB", null, "2"],
  ...[0.5, 1.5, 2.5, 3.5, 4.5].flatMap((l) => PO.map((x) => ["OU", l, x] as [string, number, string])),
  ["BTTS", null, "Oui"], ["BTTS", null, "Non"],
  ...["TT1", "TT2"].flatMap((m) => [0.5, 1.5, 2.5].flatMap((l) => PO.map((x) => [m, l, x] as [string, number, string]))),
  ...["1", "2"].flatMap((x) => [-1.5, 1.5].map((l) => ["AH", l, x] as [string, number, string])),
  ...["1N", "N2", "12"].flatMap((a) => [1.5, 2.5, 3.5].flatMap((l) => PO.map((b) => ["DC_OU", l, `${a}|${b}`] as [string, number, string]))),
  ...["1", "2"].flatMap((a) => [1.5, 2.5, 3.5].flatMap((l) => PO.map((b) => ["1X2_OU", l, `${a}|${b}`] as [string, number, string]))),
  ...["1N", "N2", "12"].flatMap((a) => ON.map((b) => ["DC_BTTS", null, `${a}|${b}`] as [string, null, string])),
  ...["1", "N", "2"].flatMap((a) => ON.map((b) => ["1X2_BTTS", null, `${a}|${b}`] as [string, null, string])),
  ...[1.5, 2.5, 3.5].flatMap((l) => PO.flatMap((a) => ON.map((b) => ["OU_BTTS", l, `${a}|${b}`] as [string, number, string]))),
];

/** Sélections candidates d'un match, de la plus probable à la moins probable. « all » : la liste exhaustive. */
export function picksOf(s: Signal, liste: "base" | "all" = "base"): Pick[] {
  return (liste === "all" ? ALL_CANDIDATES : CANDIDATES).flatMap(([market, param, sel]) => {
    const p = (s.source === "marche" ? s.direct(market, param, sel) : null) ?? probOf(s.grid, market, param, sel);
    if (p === null) return [];
    const cote = s.refOdd(market, param, sel);
    return [{ market, param, sel, p, cote, pModele: s.source === "marche" && s.model ? probOf(s.model.grid, market, param, sel) : null }];
  }).sort((a, b) => b.p - a.p);
}

/** L'issue mise en avant sur une ligne de match : la plus probable sans être une évidence (≤ 90 %). */
export function bestPick(s: Signal): Pick {
  const all = picksOf(s);
  return all.find((p) => p.p <= 0.9) ?? all[all.length - 1];
}

export function pickLabel(market: string, param: number | null, sel: string, home: string, away: string): string {
  const line = param !== null ? String(Math.abs(param)).replace(".", ",") : "";
  const buts = (x: string) => `${x === "Plus" ? "plus" : "moins"} de ${line} but${param !== null && Math.abs(param) < 1 ? "" : "s"}`;
  const btts = (x: string) => (x === "Oui" ? "les deux marquent" : "une équipe ne marque pas");
  switch (market) {
    case "1X2": return sel === "1" ? home : sel === "2" ? away : "Match nul";
    case "DC": return sel === "1N" ? `${home} ou nul` : sel === "N2" ? `${away} ou nul` : "Pas de nul";
    case "DNB": return `${sel === "1" ? home : away} (remboursé si nul)`;
    case "OU": { const b = buts(sel); return b[0].toUpperCase() + b.slice(1); }
    case "BTTS": return sel === "Oui" ? "Les deux marquent" : "Une équipe ne marque pas";
    case "CS": return `Score exact ${sel}`;
    case "TT1": case "TT2": return `${market === "TT1" ? home : away} : ${buts(sel)}`;
    case "AH": {
      const team = sel === "1" ? home : away;
      if (param === -1.5) return `${team} gagne par 2 buts ou plus`;
      if (param === 1.5) return `${team} ne perd pas par 2 buts ou plus`;
      return `${team} handicap ${param !== null && param > 0 ? "+" : ""}${String(param).replace(".", ",")}`;
    }
    case "DC_OU": case "1X2_OU": { const [a, b] = sel.split("|"); return `${pickLabel(market === "DC_OU" ? "DC" : "1X2", null, a, home, away)} et ${buts(b)}`; }
    case "DC_BTTS": case "1X2_BTTS": { const [a, b] = sel.split("|"); return `${pickLabel(market === "DC_BTTS" ? "DC" : "1X2", null, a, home, away)} et ${btts(b)}`; }
    case "OU_BTTS": { const [a, b] = sel.split("|"); const x = buts(a); return `${x[0].toUpperCase() + x.slice(1)} et ${btts(b)}`; }
  }
  return `${market} ${sel}`;
}

/** Famille d'un marché, pour filtrer les options. */
export function familleOf(market: string): "resultat" | "buts" | "combo" {
  if (["DC_OU", "1X2_OU", "DC_BTTS", "1X2_BTTS", "OU_BTTS"].includes(market)) return "combo";
  if (["OU", "BTTS", "TT1", "TT2"].includes(market)) return "buts";
  return "resultat";
}
