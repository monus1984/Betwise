/**
 * Cotes d'un bookmaker précis, telles qu'API-Football les relève (1xBet = bookmaker 11).
 * Le fournisseur n'a pas Betclic à son catalogue. Les libellés et formats de valeurs ci-dessous sont ceux
 * renvoyés le 19/11/2026 pour la Premier League (scripts/probe-bookmakers.ts) : pas de devinette sur un format non vu.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ApiFootball, AfOdds } from "./client";

type Db = SupabaseClient<Database, "betwise">;
export const BOOKMAKERS_AF: Record<number, string> = { 11: "1xBet" };
export type CoteBook = { m: string; p: number | null; s: string; c: number };

const R3: Record<string, string> = { Home: "1", Draw: "N", Away: "2" };
const DC: Record<string, string> = { "Home/Draw": "1N", "Home/Away": "12", "Draw/Away": "N2" };
const ON: Record<string, string> = { Yes: "Oui", No: "Non" };
const PI: Record<string, string> = { Odd: "Impair", Even: "Pair" };
const SIMPLE: Record<string, [string, Record<string, string>]> = {
  "Match Winner": ["1X2", R3], "First Half Winner": ["HT_1X2", R3], "Second Half Winner": ["H2_1X2", R3],
  "Double Chance": ["DC", DC], "Double Chance - First Half": ["HT_DC", DC], "Double Chance - Second Half": ["H2_DC", DC],
  "Both Teams Score": ["BTTS", ON], "Both Teams Score - First Half": ["HT_BTTS", ON], "Both Teams To Score - Second Half": ["H2_BTTS", ON],
  "Highest Scoring Half": ["HMG", { "1st Half": "1", "2nd Half": "2", Draw: "N" }],
  "Odd/Even": ["OE", PI], "Odd/Even - First Half": ["HT_OE", PI], "Odd/Even - Second Half": ["H2_OE", PI], "Home Odd/Even": ["OE1", PI], "Away Odd/Even": ["OE2", PI],
  "Corners 1x2": ["CORN_1X2", R3], "Corners. Double Chance": ["CORN_DC", DC], "Corners. Odd/Even": ["CORN_OE", PI],
};
/**
 * Marchés « plus / moins » : code BETWISE, ligne la plus haute gardée, et lignes entières acceptées ou non.
 * Une ligne entière (« plus de 2 ») rembourse à l'égalité, ce que le règlement sait faire ; les quarts de but (2,25 ; 2,75)
 * paient ou perdent à moitié : pas repris.
 */
const LIGNES: Record<string, [string, number, boolean]> = {
  "Goals Over/Under": ["OU", 6.5, true], "Goals Over/Under First Half": ["HT_OU", 3.5, true], "Goals Over/Under - Second Half": ["H2_OU", 3.5, true],
  "Total - Home": ["TT1", 4.5, true], "Total - Away": ["TT2", 4.5, true],
  "Home Team Total Goals(1st Half)": ["HT_TT1", 2.5, false], "Away Team Total Goals(1st Half)": ["HT_TT2", 2.5, false],
  "Home Team Total Goals(2nd Half)": ["H2_TT1", 2.5, false], "Away Team Total Goals(2nd Half)": ["H2_TT2", 2.5, false],
  "Corners Over Under": ["CORN", 15.5, false], "Home Corners Over/Under": ["CORN1", 9.5, false], "Away Corners Over/Under": ["CORN2", 9.5, false],
  "Cards Over/Under": ["CARD", 8.5, false],
};
const SCORES: Record<string, [string, number]> = { "Exact Score": ["CS", 4], "Correct Score - First Half": ["HT_CS", 2], "Correct Score - Second Half": ["H2_CS", 2] };
/** Handicaps : préfixe du marché, valeurs absolues gardées (0 = remboursé si nul, sauf pour les corners où 0 reste un handicap). */
const HANDICAPS: Record<string, { ah: string; dnb: string | null; lignes: number[] }> = {
  "Asian Handicap": { ah: "AH", dnb: "DNB", lignes: [1, 1.5, 2, 2.5] }, // ±0,5 = résultat ou double chance
  "Asian Handicap First Half": { ah: "HT_AH", dnb: "HT_DNB", lignes: [1, 1.5, 2] },
  "Asian Handicap (2nd Half)": { ah: "H2_AH", dnb: "H2_DNB", lignes: [1, 1.5, 2] },
  "Corners Asian Handicap": { ah: "CORN_AH", dnb: null, lignes: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5] },
};

/** Un libellé du fournisseur → marché, ligne et sélection BETWISE ; null si le marché n'est pas repris. */
export function mapAfBet(bet: string, value: string): { market: string; param: number | null; sel: string } | null {
  const v = String(value).trim();
  const simple = SIMPLE[bet];
  if (simple) return simple[1][v] ? { market: simple[0], param: null, sel: simple[1][v] } : null;
  const ligne = LIGNES[bet];
  if (ligne) {
    const r = v.match(/^(Over|Under) (\d+(?:\.\d+)?)$/);
    if (!r) return null;
    const l = Number(r[2]), demi = (l * 2) % 2 === 1;
    return (demi || (ligne[2] && Number.isInteger(l) && l >= 1)) && l <= ligne[1] ? { market: ligne[0], param: l, sel: r[1] === "Over" ? "Plus" : "Moins" } : null;
  }
  if (bet === "HT/FT Double") {
    const [a, b] = v.split("/");
    return R3[a] && R3[b] ? { market: "HTFT", param: null, sel: `${R3[a]}/${R3[b]}` } : null;
  }
  const score = SCORES[bet];
  if (score) {
    const r = v.match(/^(\d+):(\d+)$/);
    return r && Number(r[1]) <= score[1] && Number(r[2]) <= score[1] ? { market: score[0], param: null, sel: `${Number(r[1])}-${Number(r[2])}` } : null;
  }
  const hc = HANDICAPS[bet];
  if (hc) {
    // « Home -1 » et « Away -1 » sont les deux côtés de la même ligne, écrite du point de vue de l'équipe à domicile :
    // « Away -1 » est donc l'extérieur avec +1. BETWISE écrit le handicap du point de vue de l'équipe choisie.
    const r = v.match(/^(Home|Away) ([+-]?\d+(?:\.\d+)?)$/);
    if (!r) return null;
    const h = Number(r[2]), sel = r[1] === "Home" ? "1" : "2";
    if (h === 0 && hc.dnb) return { market: hc.dnb, param: null, sel };
    if (!hc.lignes.includes(Math.abs(h))) return null; // quarts de but non repris
    return { market: hc.ah, param: sel === "1" ? h : h === 0 ? 0 : -h, sel };
  }
  return null;
}

/**
 * Valeurs plafond du relevé : 11,60 est le haut de l'échelle des marchés « plus / moins » et handicap (le « 0-0 » et
 * le « moins de 0,5 but » y sont collés sur presque tous les matchs, quel que soit le match), 100 celui des scores exacts.
 * Le vrai prix est au-dessus : ce n'est pas une cote à afficher.
 */
const PLAFONDS = [11.6];
const estUnPrix = (c: number) => Number.isFinite(c) && c >= 1.02 && c < 100 && !PLAFONDS.includes(c);

/** Les cotes reprises d'un bookmaker pour un match. Une cote de 1,00, plafonnée ou hors bornes n'est pas un prix : écartée. */
export function cotesBookmaker(o: AfOdds, bookmakerId: number): CoteBook[] {
  const b = o.bookmakers.find((x) => x.id === bookmakerId);
  if (!b) return [];
  const vus = new Set<string>(), out: CoteBook[] = [];
  for (const bet of b.bets) for (const v of bet.values) {
    const k = mapAfBet(bet.name, String(v.value));
    const c = Number(v.odd);
    if (!k || !estUnPrix(c)) continue;
    const cle = `${k.market}|${k.param}|${k.sel}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push({ m: k.market, p: k.param, s: k.sel, c });
  }
  return out;
}

/**
 * Relevé des cotes d'un bookmaker pour les matchs à venir d'une compétition (horizon en heures).
 * Aucune requête si la compétition n'a pas de match dans l'horizon. Le relevé d'un match remplace le précédent.
 */
const mediane = (xs: number[]) => { const t = [...xs].sort((a, b) => a - b), m = t.length >> 1; return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2; };
/** Bookmakers différents qu'il faut au moins pour publier une médiane. */
export const MIN_BOOKMAKERS_REF = 4;
/**
 * Cote de référence (médiane des bookmakers, hors celui qu'on compare) : 1X2 et plus/moins 2,5, relevée dans la même
 * réponse que la cote 1xBet, donc au même moment (22/11 : le tipster écartait les cotes de référence du matin).
 */
export function referenceMediane(o: AfOdds, exclu: number): { market_code: string; market_param: number | null; selection: string; cote: number }[] {
  const acc: Record<string, number[]> = { "1": [], N: [], "2": [], Plus: [], Moins: [] };
  for (const b of o.bookmakers) {
    if (b.id === exclu) continue;
    for (const bet of b.bets) {
      if (bet.name === "Match Winner") for (const v of bet.values) { const k = R3[String(v.value)]; const c = Number(v.odd); if (k && c > 1) acc[k].push(c); }
      if (bet.name === "Goals Over/Under") for (const v of bet.values) { const c = Number(v.odd); if (!(c > 1)) continue; if (v.value === "Over 2.5") acc.Plus.push(c); if (v.value === "Under 2.5") acc.Moins.push(c); }
    }
  }
  const out: { market_code: string; market_param: number | null; selection: string; cote: number }[] = [];
  // un marché n'est publié que si toutes ses issues ont assez de bookmakers
  if (["1", "N", "2"].every((k) => acc[k].length >= MIN_BOOKMAKERS_REF)) for (const k of ["1", "N", "2"]) out.push({ market_code: "1X2", market_param: null, selection: k, cote: Math.round(mediane(acc[k]) * 1000) / 1000 });
  if (acc.Plus.length >= MIN_BOOKMAKERS_REF && acc.Moins.length >= MIN_BOOKMAKERS_REF) for (const k of ["Plus", "Moins"]) out.push({ market_code: "OU", market_param: 2.5, selection: k, cote: Math.round(mediane(acc[k]) * 1000) / 1000 });
  return out;
}

export async function syncBookmakerOdds(db: Db, api: ApiFootball, code: string, c: { league: number; season: number }, horizonHeures: number, bookmakerId = 11) {
  const { data: comp } = await db.from("competitions").select("id").eq("code_externe", code).maybeSingle();
  if (!comp) return { matches: 0, rows: 0, requetes: 0 };
  const { data: ms } = await db.from("matches").select("id, af_fixture_id").eq("competition_id", comp.id).eq("statut", "programme")
    .gte("kickoff_at", new Date().toISOString()).lte("kickoff_at", new Date(Date.now() + horizonHeures * 3600000).toISOString()).not("af_fixture_id", "is", null);
  if (!ms?.length) return { matches: 0, rows: 0, requetes: 0 };
  const parFixture = new Map(ms.map((m) => [m.af_fixture_id!, m.id]));
  const avant = api.calls;
  // Tous les bookmakers dans la même réponse (même nombre de pages : la pagination porte sur les matchs)
  const odds = await api.odds(c.league, c.season, 12);
  const payload = odds.flatMap((o) => {
    const id = parFixture.get(o.fixture.id), rows = cotesBookmaker(o, bookmakerId);
    return id && rows.length && o.update ? [{ match_id: id, releve_at: o.update, rows }] : [];
  });
  const refs = odds.flatMap((o) => {
    const id = parFixture.get(o.fixture.id);
    return id && o.update ? referenceMediane(o, bookmakerId).map((r) => ({ ...r, match_id: id, bookmaker: "ref:eu-median", origine: "api" as const, observed_at: o.update! })) : [];
  });
  if (refs.length) { const { error } = await db.from("odds_observations").insert(refs as never); if (error) throw error; }
  if (!payload.length) return { matches: 0, rows: 0, refs: refs.length, requetes: api.calls - avant };
  const { data, error } = await db.rpc("replace_bookmaker_odds", { p_bookmaker: BOOKMAKERS_AF[bookmakerId], p_source: "api-football", p_matches: payload });
  if (error) throw error;
  return { matches: payload.length, rows: Number(data ?? 0), refs: refs.length, requetes: api.calls - avant };
}
