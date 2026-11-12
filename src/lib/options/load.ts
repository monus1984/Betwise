import type { createClient } from "@/lib/supabase/server";
import { familleOf, loadSignals, pickLabel, picksOf } from "../probs/signals";
import type { Option } from "./build";

type Db = Awaited<ReturnType<typeof createClient>>;
type Named = { nom: string } | { nom: string }[] | null;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const TZ = "Africa/Abidjan"; // UTC+0 toute l'année

export type Periode = "auj" | "demain" | "48h";

/** Toutes les options calculables des matchs pas encore commencés de la période. */
export async function loadOptions(db: Db, periode: Periode): Promise<{ options: Option[]; nbMatchs: number; nbCouverts: number }> {
  const now = Date.now();
  const startDay = Date.parse(new Date(now).toLocaleDateString("en-CA", { timeZone: TZ }) + "T00:00:00Z");
  const [from, to] = periode === "auj" ? [now, startDay + 86400000] : periode === "demain" ? [startDay + 86400000, startDay + 2 * 86400000] : [now, now + 48 * 3600000];
  const { data } = await db.from("matches")
    .select("id, kickoff_at, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(code_externe)")
    .eq("statut", "programme").gte("kickoff_at", new Date(Math.max(from, now)).toISOString()).lt("kickoff_at", new Date(to).toISOString())
    .order("kickoff_at").limit(150);
  const rows = (data ?? []) as unknown as { id: string; kickoff_at: string; home: Named; away: Named; competition: { code_externe: string | null } | { code_externe: string | null }[] | null }[];
  const signals = await loadSignals(db, rows.map((r) => r.id));
  const options: Option[] = [];
  for (const r of rows) {
    const s = signals.get(r.id); if (!s) continue;
    const home = one(r.home)?.nom ?? "", away = one(r.away)?.nom ?? "";
    for (const p of picksOf(s, "all")) {
      options.push({
        matchId: r.id, kickoff: r.kickoff_at, home, away, comp: one(r.competition)?.code_externe ?? "",
        market: p.market, param: p.param, sel: p.sel, label: pickLabel(p.market, p.param, p.sel, home, away), famille: familleOf(p.market),
        p: p.p, cote: p.cote, source: s.source,
      });
    }
  }
  return { options, nbMatchs: rows.length, nbCouverts: signals.size };
}
