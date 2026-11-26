import type { createClient } from "@/lib/supabase/server";
import { MODEL_VERSION } from "../model/version";
import { lambdasFromOdds, makeGrid, probOf, type Grid } from "./grid";
import { METHODE_MARGE, sansMarge, type MethodeMarge } from "./marge";
import { jambesDe } from "../bets/combo";

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
  /** Cote réelle d'un bookmaker (1xBet) pour une sélection ; null si elle n'a pas été chargée ou n'existe pas. */
  bookOdd: (market: string, param: number | null, sel: string) => CoteReelle | null;
  /** Toutes les cotes de bookmaker chargées pour ce match (corners, cartons, scores exacts compris). */
  bookAll: CoteBookmaker[];
};
/** Cote réelle d'un bookmaker, avec l'heure du relevé chez le fournisseur. */
export type CoteReelle = { cote: number; bookmaker: string; releveAt: string };
export type CoteBookmaker = CoteReelle & { market: string; param: number | null; sel: string };
/**
 * cote : cote de référence (médiane des bookmakers européens), quand elle existe. book : cote réelle d'un bookmaker.
 * pModele : second avis du modèle sur la même sélection, quand il couvre le match et que p vient des cotes.
 */
export type Pick = { market: string; param: number | null; sel: string; p: number; cote: number | null; book: CoteReelle | null; pModele: number | null };

/** La cote à afficher pour une sélection et son origine : bookmaker d'abord, médiane ensuite, sinon rien (estimation). */
export function coteAffichee(p: { cote: number | null; book: CoteReelle | null }): { cote: number; origine: "bookmaker" | "mediane"; bookmaker: string | null } | null {
  if (p.book) return { cote: p.book.cote, origine: "bookmaker", bookmaker: p.book.bookmaker };
  return p.cote ? { cote: p.cote, origine: "mediane", bookmaker: null } : null;
}

const DRAW_BOOST = 0.1; // même correction que le modèle (poisson.ts)
const CANDIDATES: [string, number | null, string][] = [
  ["1X2", null, "1"], ["1X2", null, "N"], ["1X2", null, "2"], ["DC", null, "1N"], ["DC", null, "N2"],
  ["OU", 1.5, "Plus"], ["OU", 2.5, "Plus"], ["OU", 2.5, "Moins"], ["OU", 3.5, "Moins"], ["BTTS", null, "Oui"], ["BTTS", null, "Non"],
];

/** Les cinq cotes de référence d'un match : victoire, nul, défaite, plus et moins de 2,5 buts. */
export type Cotes5 = { c1: number | null; cN: number | null; c2: number | null; plus25: number | null; moins25: number | null };

/** Probabilité directe des marchés cotés (victoire, plus/moins 2,5) : cotes de référence, marge retirée (voir marge.ts). */
export function probaDirecte(c: Cotes5, market: string, param: number | null, sel: string, methode: MethodeMarge = METHODE_MARGE): number | null {
  const group = market === "1X2" ? [c.c1, c.cN, c.c2] : market === "OU" && param === 2.5 ? [c.plus25, c.moins25] : null;
  if (!group || group.some((x) => !x)) return null;
  const idx = market === "1X2" ? ["1", "N", "2"].indexOf(sel) : ["Plus", "Moins"].indexOf(sel);
  return idx < 0 ? null : sansMarge(group as number[], methode)[idx];
}

/**
 * Ce que l'application affiche pour un match dont elle a les cotes de référence : probabilité directe pour le résultat
 * et le plus/moins 2,5 ; grille de scores (buts attendus déduits de ces cotes) pour tous les autres marchés.
 * Fonction pure : la fiche match et la mesure des probabilités (scripts/mesure-probabilites.ts) passent par elle.
 */
export function probasMarche(c: Cotes5, methode: MethodeMarge = METHODE_MARGE): { lh: number; la: number; approx: boolean; grid: Grid; p: (market: string, param: number | null, sel: string) => number | null } | null {
  const ml = lambdasFromOdds(c, methode);
  if (!ml) return null;
  const grid = makeGrid(ml.lh, ml.la);
  return { ...ml, grid, p: (market, param, sel) => probaDirecte(c, market, param, sel, methode) ?? probOf(grid, market, param, sel) };
}

/**
 * Un relevé de bookmaker n'est repris que s'il a moins de 48 heures (par rapport à maintenant, ou au coup d'envoi une fois
 * le match commencé). Le fournisseur ne rafraîchit pas les matchs lointains : un relevé de dix jours n'est plus une cote.
 */
export const RELEVE_MAX_HEURES = 48;
export function releveFrais(releveAt: string, kickoffAt: string | null, now = Date.now()): boolean {
  const ref = kickoffAt ? Math.min(now, Date.parse(kickoffAt)) : now;
  return ref - Date.parse(releveAt) <= RELEVE_MAX_HEURES * 3600000;
}

/** Cotes de bookmaker des matchs demandés. Jusqu’à 300 lignes par match et 1 000 par requête : trois matchs à la fois. */
async function loadBookOdds(db: Db, ids: string[]): Promise<Map<string, CoteBookmaker[]>> {
  const out = new Map<string, CoteBookmaker[]>();
  const lots: string[][] = [];
  for (let i = 0; i < ids.length; i += 3) lots.push(ids.slice(i, i + 3));
  const [{ data: ms }, ...res] = await Promise.all([
    db.from("matches").select("id, kickoff_at").in("id", ids),
    ...lots.map((lot) => db.from("bookmaker_odds").select("match_id, bookmaker, market_code, market_param, selection, cote, releve_at").in("match_id", lot).limit(1000)),
  ]);
  const kickoff = new Map((ms ?? []).map((m) => [m.id, m.kickoff_at]));
  for (const { data } of res) for (const o of data ?? []) {
    if (!releveFrais(o.releve_at, kickoff.get(o.match_id) ?? null)) continue;
    const l = out.get(o.match_id) ?? [];
    l.push({ market: o.market_code, param: o.market_param === null ? null : Number(o.market_param), sel: o.selection, cote: Number(o.cote), bookmaker: o.bookmaker, releveAt: o.releve_at });
    out.set(o.match_id, l);
  }
  return out;
}

/**
 * Signaux (buts attendus + cotes) pour une liste de matchs, en deux requêtes.
 * bookmakers : charge aussi les cotes réelles par bookmaker (fiche match, détail d'un pari) ; inutile pour les listes.
 */
export async function loadSignals(db: Db, ids: string[], opts: { bookmakers?: boolean } = {}): Promise<Map<string, Signal>> {
  const out = new Map<string, Signal>();
  if (!ids.length) return out;
  const [{ data: est }, { data: odds }, books] = await Promise.all([
    db.from("model_estimates").select("match_id, justification").eq("market_code", "1X2").eq("selection", "1").eq("model_version", MODEL_VERSION).in("match_id", ids),
    // Par paquets de 25 matchs : ~30 lignes de cotes par match et par relevé, et la base ne rend pas plus de 1 000 lignes
    // par requête ; en un seul appel, les matchs au-delà du 30e perdaient leurs cotes (« analyse indisponible »).
    Promise.all(Array.from({ length: Math.ceil(ids.length / 25) }, (_, i) => ids.slice(i * 25, i * 25 + 25)).map((lot) =>
      db.from("odds_observations").select("match_id, market_code, market_param, selection, cote, observed_at").eq("bookmaker", "ref:eu-median").in("match_id", lot).order("observed_at", { ascending: false }).limit(1000),
    )).then((rs) => ({ data: rs.flatMap((r) => r.data ?? []) })),
    opts.bookmakers ? loadBookOdds(db, [...new Set(ids)]) : Promise.resolve(new Map<string, CoteBookmaker[]>()),
  ]);
  const parMatch = new Map<string, NonNullable<typeof odds>>();
  for (const o of odds ?? []) { if (!o.match_id) continue; const l = parMatch.get(o.match_id); if (l) l.push(o); else parMatch.set(o.match_id, [o]); }
  for (const id of ids) {
    const bookAll = books.get(id) ?? [];
    const bookOdd = (market: string, param: number | null, sel: string): CoteReelle | null => {
      const o = bookAll.find((x) => x.market === market && x.sel === sel && x.param === param);
      return o ? { cote: o.cote, bookmaker: o.bookmaker, releveAt: o.releveAt } : null;
    };
    const mine = parMatch.get(id) ?? [];
    const refOdd = (market: string, param: number | null, sel: string) => {
      const o = mine.find((x) => x.market_code === market && x.selection === sel && (x.market_param === null ? param === null : Number(x.market_param) === param));
      return o ? Number(o.cote) : null;
    };
    const cotes: Cotes5 = { c1: refOdd("1X2", null, "1"), cN: refOdd("1X2", null, "N"), c2: refOdd("1X2", null, "2"), plus25: refOdd("OU", 2.5, "Plus"), moins25: refOdd("OU", 2.5, "Moins") };
    const direct = (market: string, param: number | null, sel: string) => probaDirecte(cotes, market, param, sel);
    const ml = probasMarche(cotes);
    const market = ml ? { lh: ml.lh, la: ml.la, grid: ml.grid } : null;
    const j = est?.find((e) => e.match_id === id)?.justification as { lambda_dom?: number; lambda_ext?: number } | null | undefined;
    const model = j?.lambda_dom && j?.lambda_ext ? { lh: j.lambda_dom, la: j.lambda_ext, grid: makeGrid(j.lambda_dom, j.lambda_ext, DRAW_BOOST) } : null;
    if (ml && market) out.set(id, { source: "marche", lh: ml.lh, la: ml.la, grid: market.grid, approx: ml.approx, market, model, refOdd, direct, bookOdd, bookAll });
    else if (model) out.set(id, { source: "modele", lh: model.lh, la: model.la, grid: model.grid, approx: false, market: null, model, refOdd, direct: () => null, bookOdd, bookAll });
  }
  return out;
}

/** Probabilité d'une sélection quelconque, cohérente avec les pastilles (cote directe d'abord, grille ensuite). */
export function probOfSignal(s: Signal, market: string, param: number | null, sel: string): number | null {
  return (s.source === "marche" ? s.direct(market, param, sel) : null) ?? probOf(s.grid, market, param, sel);
}

/** Toutes les sélections calculables d'un match : simples, buts par équipe, handicaps, combos même match. */
const PO = ["Plus", "Moins"], ON = ["Oui", "Non"], R3 = ["1", "N", "2"];
export const MG_RANGES = ["0-1", "1-2", "1-3", "2-3", "2-4", "3-4", "3-5", "4-6"];
/** Nombre exact de buts : dans le match, puis pour une équipe (« 5-99 » et « 3-99 » : ce nombre ou plus). */
export const NB_EXACT = ["0-0", "1-1", "2-2", "3-3", "4-4", "5-99"];
export const NB_EQUIPE = ["0-0", "1-1", "2-2", "3-99"];
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
  ...[1.5, 2.5, 3.5].flatMap((l) => PO.flatMap((a) => ON.map((b) => ["OU_BTTS", l, `${a}|${b}`] as [string, number, string]))),  // Mi-temps
  ...R3.map((x) => ["HT_1X2", null, x] as [string, null, string]),
  ...["1N", "N2", "12"].map((x) => ["HT_DC", null, x] as [string, null, string]),
  ...[0.5, 1.5].flatMap((l) => PO.map((x) => ["HT_OU", l, x] as [string, number, string])),
  ["HT_BTTS", null, "Oui"], ["HT_BTTS", null, "Non"],
  ...R3.map((x) => ["H2_1X2", null, x] as [string, null, string]),
  ...[0.5, 1.5].flatMap((l) => PO.map((x) => ["H2_OU", l, x] as [string, number, string])),
  ...R3.flatMap((a) => R3.map((b) => ["HTFT", null, `${a}/${b}`] as [string, null, string])),
  ...R3.map((x) => ["HMG", null, x] as [string, null, string]),
  // Autres
  ["OE", null, "Pair"], ["OE", null, "Impair"],
  ...MG_RANGES.map((x) => ["MG", null, x] as [string, null, string]),
  ...[-2, -1, 1, 2].flatMap((l) => R3.map((x) => ["EH", l, x] as [string, number, string])),
  ["WTN", null, "1"], ["WTN", null, "2"],
  // Mi-temps (suite)
  ...["1N", "N2", "12"].map((x) => ["H2_DC", null, x] as [string, null, string]),
  ["H2_BTTS", null, "Oui"], ["H2_BTTS", null, "Non"],
  ...["HT_TT1", "HT_TT2", "H2_TT1", "H2_TT2"].flatMap((m) => [0.5, 1.5].flatMap((l) => PO.map((x) => [m, l, x] as [string, number, string]))),
  ...["HT_DNB", "H2_DNB", "WEH", "WBH", "SBH"].flatMap((m) => ["1", "2"].map((x) => [m, null, x] as [string, null, string])),
  ...["HT_OE", "H2_OE"].flatMap((m) => ["Pair", "Impair"].map((x) => [m, null, x] as [string, null, string])),
  ["BH", null, "Oui"], ["BH", null, "Non"],
  // Buts (suite) : nombre exact, buts d'une équipe, première équipe à marquer
  ...NB_EXACT.map((x) => ["MG", null, x] as [string, null, string]),
  ...["MG1", "MG2"].flatMap((m) => NB_EQUIPE.map((x) => [m, null, x] as [string, null, string])),
  ...["OE1", "OE2"].flatMap((m) => ["Pair", "Impair"].map((x) => [m, null, x] as [string, null, string])),
  ["FTS", null, "1"], ["FTS", null, "Aucun"], ["FTS", null, "2"],
];

/** Sélections candidates d'un match, de la plus probable à la moins probable. « all » : la liste exhaustive. */
/** Probabilité et cotes d'un pari donné sur un match (n'importe quel marché calculable), ou null (24/11). */
export function pariDe(s: Signal, market: string, param: number | null, sel: string): Pick | null {
  const p = (s.source === "marche" ? s.direct(market, param, sel) : null) ?? probOf(s.grid, market, param, sel);
  if (p === null) return null;
  return { market, param, sel, p, cote: s.refOdd(market, param, sel), book: s.bookOdd(market, param, sel), pModele: s.source === "marche" && s.model ? probOf(s.model.grid, market, param, sel) : null };
}

export function picksOf(s: Signal, liste: "base" | "all" = "base"): Pick[] {
  return (liste === "all" ? ALL_CANDIDATES : CANDIDATES).flatMap(([market, param, sel]) => {
    const p = (s.source === "marche" ? s.direct(market, param, sel) : null) ?? probOf(s.grid, market, param, sel);
    if (p === null) return [];
    const cote = s.refOdd(market, param, sel);
    return [{ market, param, sel, p, cote, book: s.bookOdd(market, param, sel), pModele: s.source === "marche" && s.model ? probOf(s.model.grid, market, param, sel) : null }];
  }).sort((a, b) => b.p - a.p);
}

/** L'issue mise en avant sur une ligne de match : la plus probable sans être une évidence (≤ 90 %). */
export function bestPick(s: Signal): Pick {
  const all = picksOf(s);
  return all.find((p) => p.p <= 0.9) ?? all[all.length - 1];
}

const STAT_NOM: Record<string, string> = { CORN: "corners", CARD: "cartons", SHOT: "tirs", SOT: "tirs cadrés", FOUL: "fautes", OFF: "hors-jeu" };
/** « 2-2 » → 2 buts exactement ; « 0-1 » → 1 but au plus ; « 3-99 » → 3 buts ou plus ; sinon une tranche. */
function tranche(sel: string): string {
  const [a, b] = sel.split("-"), pl = (n: string) => `${n} but${n === "0" || n === "1" ? "" : "s"}`;
  if (a === b) return a === "0" ? "aucun but" : `${pl(a)} exactement`;
  if (a === "0") return `${pl(b)} au plus`;
  if (Number(b) >= 9) return `${pl(a)} ou plus`;
  return `entre ${a} et ${b} buts`;
}
const maj = (x: string) => x[0].toUpperCase() + x.slice(1);
export function pickLabel(market: string, param: number | null, sel: string, home: string, away: string): string {
  const line = param !== null ? String(Math.abs(param)).replace(".", ",") : "";
  const buts = (x: string) => `${x === "Plus" ? "plus" : "moins"} de ${line} but${param !== null && Math.abs(param) < 1 ? "" : "s"}`;
  const btts = (x: string) => (x === "Oui" ? "les deux marquent" : "une équipe ne marque pas");
  if (market.startsWith("HT_")) return `Mi-temps : ${pickLabel(market.slice(3), param, sel, home, away)}`;
  if (market.startsWith("H2_")) return `2e mi-temps : ${pickLabel(market.slice(3), param, sel, home, away)}`;
  const team = sel === "1" ? home : away, signe = param !== null && param > 0 ? "+" : "";
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
    case "CORN": case "CARD": case "SHOT": case "SOT": case "FOUL": case "OFF": return `${sel === "Plus" ? "Plus" : "Moins"} de ${line} ${STAT_NOM[market]}`;
    case "CORN1": case "CORN2": case "CARD1": case "CARD2": case "SOT1": case "SOT2": case "SHOT1": case "SHOT2": case "FOUL1": case "FOUL2": case "OFF1": case "OFF2": return `${market.endsWith("1") ? home : away} : ${sel === "Plus" ? "plus" : "moins"} de ${line} ${STAT_NOM[market.slice(0, -1)]}`;
    case "CORN_1X2": return sel === "N" ? "Autant de corners" : `${sel === "1" ? home : away} a le plus de corners`;
    case "RED": return sel === "Oui" ? "Au moins un carton rouge" : "Pas de carton rouge";
    case "BUT": return `${sel} marque`;
    case "BUT1": return /^aucun/i.test(sel) ? "Aucun buteur" : `${sel} marque le premier but`;
    case "ET": return sel === "Oui" ? "Il y a prolongation" : "Pas de prolongation";
    case "PEN": return sel === "Oui" ? "Il y a tirs au but" : "Pas de tirs au but";
    case "PK": return sel === "Oui" ? "Un penalty est sifflé" : "Aucun penalty sifflé";
    case "PKB": return sel === "Oui" ? "Un but sur penalty" : "Aucun but sur penalty";
    case "DBL": return sel === "Oui" ? "Un joueur marque un doublé" : "Aucun joueur ne marque un doublé";
    case "WEH": return `${sel === "1" ? home : away} gagne au moins une mi-temps`;
    case "BH": return sel === "Oui" ? "But dans les deux mi-temps" : "Une mi-temps sans but";
    case "LIBRE": return sel;
    case "QUALIF": return `${sel === "1" ? home : away} se qualifie`;
    case "WBH": return `${team} gagne les deux mi-temps`;
    case "SBH": return `${team} marque dans les deux mi-temps`;
    case "OE1": case "OE2": return `${market === "OE1" ? home : away} : nombre de buts ${sel === "Pair" ? "pair" : "impair"}`;
    case "MG1": case "MG2": return `${market === "MG1" ? home : away} : ${tranche(sel)}`;
    case "FTS": return /^aucun/i.test(sel) ? "Aucun but dans le match" : `${team} marque en premier`;
    case "LTS": return /^aucun/i.test(sel) ? "Aucun but dans le match" : `${team} marque en dernier`;
    case "GB": return sel === "Oui" ? `Un but avant la ${line}e minute` : `Pas de but avant la ${line}e minute`;
    case "OG": return sel === "Oui" ? "Un but contre son camp" : "Pas de but contre son camp";
    case "PKM": return sel === "Oui" ? "Un penalty manqué" : "Pas de penalty manqué";
    case "BUTL": return /^aucun/i.test(sel) ? "Aucun buteur" : `${sel} marque le dernier but`;
    case "BUT2": return `${sel} marque 2 buts ou plus`;
    case "BUT3": return `${sel} marque 3 buts ou plus`;
    case "PCARD": return `${sel} reçoit un carton`;
    case "PSHOT": case "PSOT": case "PAST": {
      const i = sel.indexOf("|"), dir = sel.slice(0, i), nom = sel.slice(i + 1), quoi = market === "PSHOT" ? "tir" : market === "PSOT" ? "tir cadré" : "passe décisive";
      const n = Number(param ?? 0), mot = `${quoi}${n >= 1 ? "s" : ""}`.replace("tir cadrés", "tirs cadrés").replace("passe décisives", "passes décisives");
      return n === 0.5 && dir === "Plus" ? `${nom} : au moins 1 ${quoi}` : `${nom} : ${dir === "Plus" ? "plus" : "moins"} de ${line} ${mot}`;
    }
    case "CARD_1X2": return sel === "N" ? "Autant de cartons" : `${team} a le plus de cartons`;
    case "RED1": case "RED2": return `${market === "RED1" ? home : away} : ${sel === "Oui" ? "au moins un carton rouge" : "pas de carton rouge"}`;
    case "CORN_AH": return `${team} : corners, handicap ${signe}${String(param).replace(".", ",")}`;
    case "CORN_OE": return `Nombre de corners ${sel === "Pair" ? "pair" : "impair"}`;
    case "CORN_DC": return sel === "12" ? "Pas le même nombre de corners" : `${sel === "1N" ? home : away} a autant ou plus de corners`;
    case "COMBO": { const js = jambesDe(sel); return js ? js.map((j, i) => { const t = pickLabel(j.market, j.param, j.sel, home, away); return i === 0 ? t : t[0].toLowerCase() + t.slice(1); }).join(" + ") : sel; }
    case "HTFT": { const [a, b] = sel.split("/"); const n = (x: string) => (x === "1" ? home : x === "2" ? away : "nul"); return `Mi-temps ${n(a)} / fin ${n(b)}`; }
    case "HMG": return sel === "1" ? "Plus de buts en 1re mi-temps" : sel === "2" ? "Plus de buts en 2e mi-temps" : "Autant de buts dans les deux mi-temps";
    case "OE": return `Nombre de buts ${sel === "Pair" ? "pair" : "impair"}`;
    case "MG": return maj(tranche(sel));
    case "EH": {
      // Handicap européen (3 issues), handicap donné pour l'équipe à domicile : dit en clair ce qu'il faut pour gagner
      const h = param ?? 0, pl = (n: number) => `${n} but${n > 1 ? "s" : ""}`;
      const gagne = (team: string, k: number) => (k >= 1 ? `${team} gagne par ${pl(k + 1)} ou plus` : k === -1 ? `${team} ne perd pas` : `${team} ne perd pas par ${pl(-k)} ou plus`);
      const txt = sel === "1" ? gagne(home, -h) : sel === "2" ? gagne(away, h) : `${h < 0 ? home : away} gagne par ${pl(Math.abs(h))} exactement`;
      return `${txt} (handicap ${h > 0 ? "+" : ""}${h})`;
    }
    case "WTN": return /\|non$/i.test(sel) ? `${sel.startsWith("1") ? home : away} ne gagne pas sans encaisser` : `${sel === "1" ? home : away} gagne sans encaisser`;
    case "OU_BTTS": { const [a, b] = sel.split("|"); const x = buts(a); return `${x[0].toUpperCase() + x.slice(1)} et ${btts(b)}`; }
  }
  return `${market} ${sel}`;
}

/** Famille d'un marché, pour filtrer les options. */
export function familleOf(market: string): "resultat" | "buts" | "combo" | "mitemps" {
  if (market.startsWith("HT_") || market.startsWith("H2_") || ["HTFT", "HMG", "WEH", "BH", "WBH", "SBH"].includes(market)) return "mitemps";
  if (["DC_OU", "1X2_OU", "DC_BTTS", "1X2_BTTS", "OU_BTTS", "COMBO"].includes(market)) return "combo";
  if (["OU", "BTTS", "TT1", "TT2", "OE", "MG", "OE1", "OE2", "MG1", "MG2", "FTS", "LTS"].includes(market)) return "buts";
  return "resultat";
}
