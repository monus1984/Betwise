/**
 * Rattache au référentiel les sélections saisies en « match libre » (match pas encore en base au moment du pari).
 * Sans match rattaché, une sélection n'est jamais réglée toute seule. Règle volontairement stricte : les deux équipes
 * doivent être reconnues, et le match doit se jouer dans les 8 jours qui suivent le pari. Dans le doute, on ne touche à rien.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { teamSimilarity } from "../odds-api/client";
import { canon } from "../extract/ticket";

type Db = SupabaseClient<Database, "betwise">;
export type PoolMatch = { id: string; kickoff_at: string; home: { nom: string; alias: string[] } | null; away: { nom: string; alias: string[] } | null };

export function splitMatchLibre(s: string): [string, string] | null {
  const parts = s.split(/\s+[–—-]\s+|\s+vs\.?\s+|\s+contre\s+/i).map((x) => x.trim()).filter(Boolean);
  return parts.length === 2 ? [parts[0], parts[1]] : null;
}

/** Le match du référentiel qui correspond à un libellé libre, ou null s'il n'y en a pas un seul évident. */
export function findMatch(libre: string, refIso: string, pool: PoolMatch[]): PoolMatch | null {
  const teams = splitMatchLibre(libre);
  if (!teams) return null;
  const [h, a] = teams.map(canon);
  const ref = Date.parse(refIso);
  const sim = (name: string, t: { nom: string; alias: string[] }) => Math.max(teamSimilarity(name, t.nom), ...t.alias.map((x) => teamSimilarity(name, x)));
  const hits = pool.filter((m) => {
    if (!m.home || !m.away) return false;
    const dt = (Date.parse(m.kickoff_at) - ref) / 3600000;
    return dt >= -6 && dt <= 192 && sim(h, m.home) >= 0.99 && sim(a, m.away) >= 0.99;
  }).sort((x, y) => Date.parse(x.kickoff_at) - Date.parse(y.kickoff_at));
  return hits[0] ?? null;
}

export async function relinkFreeMatches(db: Db): Promise<{ relies: number }> {
  const { data: sels } = await db.from("bet_selections").select("id, match_libre, bet:bets(placed_at, statut)")
    .is("match_id", null).not("match_libre", "is", null).eq("resultat", "en_attente").limit(60);
  const { data: preds } = await db.from("predictions").select("id, match_libre, published_at, logged_at")
    .is("match_id", null).not("match_libre", "is", null).eq("resultat", "en_attente").neq("statut", "annule").limit(60);
  type S = { id: string; match_libre: string | null; bet: { placed_at: string; statut: string } | { placed_at: string; statut: string }[] | null };
  const todo = [
    ...((sels ?? []) as unknown as S[]).map((s) => { const b = Array.isArray(s.bet) ? s.bet[0] : s.bet; return b && b.statut !== "annule" ? { table: "bet_selections" as const, id: s.id, libre: s.match_libre!, ref: b.placed_at } : null; }),
    ...(preds ?? []).map((p) => ({ table: "predictions" as const, id: p.id, libre: p.match_libre!, ref: p.published_at ?? p.logged_at })),
  ].filter((x): x is NonNullable<typeof x> => !!x && Date.now() - Date.parse(x.ref) < 15 * 86400000);
  if (!todo.length) return { relies: 0 };

  const from = new Date(Math.min(...todo.map((t) => Date.parse(t.ref))) - 6 * 3600000).toISOString();
  const { data: pool } = await db.from("matches")
    .select("id, kickoff_at, home:teams!matches_home_team_id_fkey(nom, alias), away:teams!matches_away_team_id_fkey(nom, alias)")
    .gte("kickoff_at", from).lte("kickoff_at", new Date(Date.now() + 8 * 86400000).toISOString()).limit(1500);
  let relies = 0;
  for (const t of todo) {
    const m = findMatch(t.libre, t.ref, (pool ?? []) as unknown as PoolMatch[]);
    if (!m) continue;
    const { error } = await db.from(t.table).update({ match_id: m.id }).eq("id", t.id).is("match_id", null);
    if (!error) relies++; // un prono identique déjà rattaché au même match : on laisse l'autre tel quel
  }
  return { relies };
}
