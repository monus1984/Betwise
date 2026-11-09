import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { OddsApiClient, median, teamSimilarity, type OddsEvent } from "./client";

type Db = SupabaseClient<Database, "betwise">;

const REFERENCE_BOOKMAKER = "ref:eu-median";

/**
 * Synchronise les cotes de référence d'une compétition : pour chaque événement The Odds API,
 * on rapproche un match betwise (équipes + coup d'envoi à ±6 h), puis on insère une observation
 * par sélection (1X2 : 1 / N / 2 ; OU 2.5 : Plus / Moins) avec la médiane des bookmakers européens.
 * Insertion seule : chaque passage ajoute un point d'historique horodaté.
 */
export async function syncReferenceOdds(db: Db, api: OddsApiClient, fdCode: string, sportKey: string, aheadDays = 8) {
  const now = new Date();
  const to = new Date(now.getTime() + aheadDays * 86400000);
  const events = await api.odds(sportKey, now.toISOString().replace(/\.\d{3}Z$/, "Z"), to.toISOString().replace(/\.\d{3}Z$/, "Z"));
  if (events.length === 0) return { events: 0, matched: 0, rows: 0 };

  const { data: comp } = await db.from("competitions").select("id").eq("code_externe", fdCode).maybeSingle();
  if (!comp) return { events: events.length, matched: 0, rows: 0 };

  const { data: matches } = await db
    .from("matches")
    .select("id, kickoff_at, home:teams!matches_home_team_id_fkey(nom, alias), away:teams!matches_away_team_id_fkey(nom, alias)")
    .eq("competition_id", comp.id)
    .gte("kickoff_at", new Date(now.getTime() - 6 * 3600000).toISOString())
    .lte("kickoff_at", new Date(to.getTime() + 6 * 3600000).toISOString());

  type M = { id: string; kickoff_at: string; home: { nom: string; alias: string[] } | null; away: { nom: string; alias: string[] } | null };
  const pool = ((matches ?? []) as unknown as M[]).filter((m) => m.home && m.away);

  const rows: Database["betwise"]["Tables"]["odds_observations"]["Insert"][] = [];
  let matched = 0;
  const observedAt = now.toISOString();

  for (const ev of events) {
    const m = bestMatch(ev, pool);
    if (!m) continue;
    matched++;

    // 1X2
    const h2h = { "1": [] as number[], N: [] as number[], "2": [] as number[] };
    // Plus / Moins 2.5
    const ou = { Plus: [] as number[], Moins: [] as number[] };

    for (const bk of ev.bookmakers) {
      for (const mk of bk.markets) {
        if (mk.key === "h2h") {
          for (const o of mk.outcomes) {
            if (o.name === ev.home_team) h2h["1"].push(o.price);
            else if (o.name === ev.away_team) h2h["2"].push(o.price);
            else if (o.name.toLowerCase() === "draw") h2h.N.push(o.price);
          }
        } else if (mk.key === "totals") {
          for (const o of mk.outcomes) {
            if (o.point !== 2.5) continue;
            if (o.name.toLowerCase() === "over") ou.Plus.push(o.price);
            else if (o.name.toLowerCase() === "under") ou.Moins.push(o.price);
          }
        }
      }
    }

    for (const [sel, vals] of Object.entries(h2h)) {
      const c = median(vals);
      if (c) rows.push({ match_id: m.id, market_code: "1X2", selection: sel, cote: round3(c), bookmaker: REFERENCE_BOOKMAKER, origine: "api", observed_at: observedAt });
    }
    for (const [sel, vals] of Object.entries(ou)) {
      const c = median(vals);
      if (c) rows.push({ match_id: m.id, market_code: "OU", market_param: 2.5, selection: sel, cote: round3(c), bookmaker: REFERENCE_BOOKMAKER, origine: "api", observed_at: observedAt });
    }
  }

  if (rows.length) {
    const { error } = await db.from("odds_observations").insert(rows);
    if (error) throw error;
  }
  return { events: events.length, matched, rows: rows.length };
}

function bestMatch(ev: OddsEvent, pool: { id: string; kickoff_at: string; home: { nom: string; alias: string[] } | null; away: { nom: string; alias: string[] } | null }[]) {
  const t = Date.parse(ev.commence_time);
  let best: { id: string; score: number } | null = null;
  for (const m of pool) {
    if (Math.abs(Date.parse(m.kickoff_at) - t) > 6 * 3600000) continue;
    const sh = Math.max(teamSimilarity(ev.home_team, m.home!.nom), ...m.home!.alias.map((a) => teamSimilarity(ev.home_team, a)));
    const sa = Math.max(teamSimilarity(ev.away_team, m.away!.nom), ...m.away!.alias.map((a) => teamSimilarity(ev.away_team, a)));
    const score = (sh + sa) / 2;
    if (score >= 0.5 && (!best || score > best.score)) best = { id: m.id, score };
  }
  return best;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
