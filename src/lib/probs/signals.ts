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
    const ml = lambdasFromOdds({ c1: refOdd("1X2", null, "1"), cN: refOdd("1X2", null, "N"), c2: refOdd("1X2", null, "2"), plus25: refOdd("OU", 2.5, "Plus"), moins25: refOdd("OU", 2.5, "Moins") });
    const market = ml ? { lh: ml.lh, la: ml.la, grid: makeGrid(ml.lh, ml.la) } : null;
    const j = est?.find((e) => e.match_id === id)?.justification as { lambda_dom?: number; lambda_ext?: number } | null | undefined;
    const model = j?.lambda_dom && j?.lambda_ext ? { lh: j.lambda_dom, la: j.lambda_ext, grid: makeGrid(j.lambda_dom, j.lambda_ext, DRAW_BOOST) } : null;
    if (ml && market) out.set(id, { source: "marche", lh: ml.lh, la: ml.la, grid: market.grid, approx: ml.approx, market, model, refOdd });
    else if (model) out.set(id, { source: "modele", lh: model.lh, la: model.la, grid: model.grid, approx: false, market: null, model, refOdd });
  }
  return out;
}

/** Sélections candidates d'un match, de la plus probable à la moins probable. */
export function picksOf(s: Signal): Pick[] {
  return CANDIDATES.map(([market, param, sel]) => {
    const p = probOf(s.grid, market, param, sel)!;
    const cote = s.refOdd(market, param, sel);
    return { market, param, sel, p, cote, pModele: s.source === "marche" && s.model ? probOf(s.model.grid, market, param, sel) : null };
  }).sort((a, b) => b.p - a.p);
}

/** L'issue mise en avant sur une ligne de match : la plus probable sans être une évidence (≤ 90 %). */
export function bestPick(s: Signal): Pick {
  const all = picksOf(s);
  return all.find((p) => p.p <= 0.9) ?? all[all.length - 1];
}

export function pickLabel(market: string, param: number | null, sel: string, home: string, away: string): string {
  const line = param !== null ? String(param).replace(".", ",") : "";
  switch (market) {
    case "1X2": return sel === "1" ? home : sel === "2" ? away : "Match nul";
    case "DC": return sel === "1N" ? `${home} ou nul` : sel === "N2" ? `${away} ou nul` : "Pas de nul";
    case "DNB": return `${sel === "1" ? home : away} (remboursé si nul)`;
    case "OU": return `${sel === "Plus" ? "Plus" : "Moins"} de ${line} buts`;
    case "BTTS": return sel === "Oui" ? "Les deux marquent" : "Une équipe ne marque pas";
    case "CS": return `Score exact ${sel}`;
    case "DC_OU": case "1X2_OU": { const [a, b] = sel.split("|"); return `${pickLabel(market === "DC_OU" ? "DC" : "1X2", null, a, home, away)} + ${b === "Plus" ? "plus" : "moins"} de ${line}`; }
  }
  return `${market} ${sel}`;
}
