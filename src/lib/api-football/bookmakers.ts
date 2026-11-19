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
const SIMPLE: Record<string, [string, Record<string, string>]> = {
  "Match Winner": ["1X2", R3], "First Half Winner": ["HT_1X2", R3], "Second Half Winner": ["H2_1X2", R3],
  "Double Chance": ["DC", DC], "Double Chance - First Half": ["HT_DC", DC], "Double Chance - Second Half": ["H2_DC", DC],
  "Both Teams Score": ["BTTS", ON], "Both Teams Score - First Half": ["HT_BTTS", ON], "Both Teams To Score - Second Half": ["H2_BTTS", ON],
  "Highest Scoring Half": ["HMG", { "1st Half": "1", "2nd Half": "2", Draw: "N" }],
  "Odd/Even": ["OE", { Odd: "Impair", Even: "Pair" }],
  "Corners 1x2": ["CORN_1X2", R3],
};
/** Marchés « plus / moins » : code BETWISE et ligne la plus haute gardée. Seules les demi-lignes (0,5 ; 1,5…) sont reprises. */
const LIGNES: Record<string, [string, number]> = {
  "Goals Over/Under": ["OU", 6.5], "Goals Over/Under First Half": ["HT_OU", 3.5], "Goals Over/Under - Second Half": ["H2_OU", 3.5],
  "Total - Home": ["TT1", 4.5], "Total - Away": ["TT2", 4.5],
  "Home Team Total Goals(1st Half)": ["HT_TT1", 2.5], "Away Team Total Goals(1st Half)": ["HT_TT2", 2.5],
  "Home Team Total Goals(2nd Half)": ["H2_TT1", 2.5], "Away Team Total Goals(2nd Half)": ["H2_TT2", 2.5],
  "Corners Over Under": ["CORN", 15.5], "Home Corners Over/Under": ["CORN1", 9.5], "Away Corners Over/Under": ["CORN2", 9.5],
  "Cards Over/Under": ["CARD", 8.5],
};
const SCORES: Record<string, [string, number]> = { "Exact Score": ["CS", 4], "Correct Score - First Half": ["HT_CS", 2] };

/** Un libellé du fournisseur → marché, ligne et sélection BETWISE ; null si le marché n'est pas repris. */
export function mapAfBet(bet: string, value: string): { market: string; param: number | null; sel: string } | null {
  const v = String(value).trim();
  const simple = SIMPLE[bet];
  if (simple) return simple[1][v] ? { market: simple[0], param: null, sel: simple[1][v] } : null;
  const ligne = LIGNES[bet];
  if (ligne) {
    const r = v.match(/^(Over|Under) (\d+(?:\.\d+)?)$/);
    if (!r) return null;
    const l = Number(r[2]);
    return (l * 2) % 2 === 1 && l <= ligne[1] ? { market: ligne[0], param: l, sel: r[1] === "Over" ? "Plus" : "Moins" } : null;
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
  if (bet === "Asian Handicap") {
    // « Home -1 » et « Away -1 » sont les deux côtés de la même ligne, écrite du point de vue de l'équipe à domicile :
    // « Away -1 » est donc l'extérieur avec +1. BETWISE écrit le handicap du point de vue de l'équipe choisie.
    const r = v.match(/^(Home|Away) ([+-]?\d+(?:\.\d+)?)$/);
    if (!r) return null;
    const h = Number(r[2]), sel = r[1] === "Home" ? "1" : "2";
    if (h === 0) return { market: "DNB", param: null, sel };
    if (![1, 1.5, 2, 2.5].includes(Math.abs(h))) return null; // ±0,5 = résultat ou double chance ; quarts de but non repris
    return { market: "AH", param: sel === "1" ? h : -h, sel };
  }
  return null;
}

/** Les cotes reprises d'un bookmaker pour un match. Une cote de 1,00 ou hors bornes n'est pas un prix : écartée. */
export function cotesBookmaker(o: AfOdds, bookmakerId: number): CoteBook[] {
  const b = o.bookmakers.find((x) => x.id === bookmakerId);
  if (!b) return [];
  const vus = new Set<string>(), out: CoteBook[] = [];
  for (const bet of b.bets) for (const v of bet.values) {
    const k = mapAfBet(bet.name, String(v.value));
    const c = Number(v.odd);
    if (!k || !Number.isFinite(c) || c < 1.02 || c > 500) continue;
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
export async function syncBookmakerOdds(db: Db, api: ApiFootball, code: string, c: { league: number; season: number }, horizonHeures: number, bookmakerId = 11) {
  const { data: comp } = await db.from("competitions").select("id").eq("code_externe", code).maybeSingle();
  if (!comp) return { matches: 0, rows: 0, requetes: 0 };
  const { data: ms } = await db.from("matches").select("id, af_fixture_id").eq("competition_id", comp.id).eq("statut", "programme")
    .gte("kickoff_at", new Date().toISOString()).lte("kickoff_at", new Date(Date.now() + horizonHeures * 3600000).toISOString()).not("af_fixture_id", "is", null);
  if (!ms?.length) return { matches: 0, rows: 0, requetes: 0 };
  const parFixture = new Map(ms.map((m) => [m.af_fixture_id!, m.id]));
  const avant = api.calls;
  const odds = await api.odds(c.league, c.season, 12, bookmakerId);
  const payload = odds.flatMap((o) => {
    const id = parFixture.get(o.fixture.id), rows = cotesBookmaker(o, bookmakerId);
    return id && rows.length && o.update ? [{ match_id: id, releve_at: o.update, rows }] : [];
  });
  if (!payload.length) return { matches: 0, rows: 0, requetes: api.calls - avant };
  const { data, error } = await db.rpc("replace_bookmaker_odds", { p_bookmaker: BOOKMAKERS_AF[bookmakerId], p_source: "api-football", p_matches: payload });
  if (error) throw error;
  return { matches: payload.length, rows: Number(data ?? 0), requetes: api.calls - avant };
}
