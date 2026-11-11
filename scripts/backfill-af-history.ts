/**
 * Historique API-Football des 5 championnats : résultats + xG + tirs, par lots de 20 matchs.
 * Idempotent : ne redemande que les matchs absents ou sans statistiques vérifiées.
 * Usage : tsx scripts/backfill-af-history.ts [saisons…]   (défaut : 2024 2025 2026)
 */
import "dotenv/config";
import { createAdminClient } from "../src/lib/supabase/admin";
import { ApiFootball, type AfFixture } from "../src/lib/api-football/client";

const LEAGUES = [39, 140, 135, 78, 61];
const stat = (f: AfFixture, teamId: number, type: string) => {
  const v = f.statistics?.find((s) => s.team.id === teamId)?.statistics.find((x) => x.type === type)?.value;
  return v === null || v === undefined || v === "" ? null : Number(v);
};

async function main() {
  const db = createAdminClient();
  const api = new ApiFootball(process.env.API_FOOTBALL_KEY ?? "");
  const seasons = process.argv.slice(2).map(Number).filter(Boolean);
  for (const season of seasons.length ? seasons : [2024, 2025, 2026]) for (const league of LEAGUES) {
    const all = await api.season(league, season);
    const done = new Set<number>();
    for (let from = 0; ; from += 1000) {
      const { data } = await db.from("af_history").select("fixture_id").eq("league", league).eq("season", season).eq("stats_checked", true).range(from, from + 999);
      (data ?? []).forEach((r) => done.add(r.fixture_id));
      if (!data || data.length < 1000) break;
    }
    const todo = all.filter((f) => !done.has(f.fixture.id));
    let withXg = 0;
    for (let i = 0; i < todo.length; i += 20) {
      const batch = await api.byIds(todo.slice(i, i + 20).map((f) => f.fixture.id));
      const rows = batch.map((f) => {
        const h = f.teams.home.id, a = f.teams.away.id;
        const xh = stat(f, h, "expected_goals"), xa = stat(f, a, "expected_goals");
        if (xh !== null && xa !== null) withXg++;
        return {
          fixture_id: f.fixture.id, league, season, played_at: f.fixture.date, home_id: h, home_nom: f.teams.home.name, away_id: a, away_nom: f.teams.away.name,
          home_goals: f.score.fulltime.home ?? f.goals.home ?? 0, away_goals: f.score.fulltime.away ?? f.goals.away ?? 0,
          xg_home: xh, xg_away: xa, shots_home: stat(f, h, "Total Shots"), shots_away: stat(f, a, "Total Shots"), sot_home: stat(f, h, "Shots on Goal"), sot_away: stat(f, a, "Shots on Goal"),
          stats_checked: true,
        };
      });
      const { error } = await db.from("af_history").upsert(rows, { onConflict: "fixture_id" });
      if (error) throw error;
      await new Promise((r) => setTimeout(r, 250)); // reste sous la limite par minute
    }
    console.log(`[${league} ${season}] ${all.length} matchs terminés · ${todo.length} chargés · xG présents sur ${withXg}/${todo.length}`);
  }
  console.log(`Requêtes : ${api.calls} · restant aujourd'hui : ${api.remaining ?? "?"}`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
