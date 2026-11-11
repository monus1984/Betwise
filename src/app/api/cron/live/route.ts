import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiFootball } from "@/lib/api-football/client";
import { applyFixtures } from "@/lib/api-football/sync";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * Direct : appelée chaque minute par pg_cron (Supabase) tant qu'un match suivi est en cours.
 * 1 requête pour tous les matchs en direct, +1 pour les matchs qui viennent de se terminer.
 */
async function run(req: Request) {
  const secret = process.env.LIVE_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  if (!process.env.API_FOOTBALL_KEY) return NextResponse.json({ error: "API_FOOTBALL_KEY absente de Vercel" }, { status: 503 });

  const db = createAdminClient();
  const api = new ApiFootball(process.env.API_FOOTBALL_KEY);
  const live = await api.live();
  const a = await applyFixtures(db, live);

  // Matchs suivis qui devraient être en cours mais ne sont plus dans le direct : terminés (ou pas encore commencés)
  const liveIds = new Set(live.map((f) => f.fixture.id));
  const { data: due } = await db.from("matches").select("af_fixture_id")
    .not("af_fixture_id", "is", null).in("statut", ["programme", "en_cours"])
    .gte("kickoff_at", new Date(Date.now() - 170 * 60000).toISOString()).lte("kickoff_at", new Date(Date.now() - 100 * 60000).toISOString());
  const missing = (due ?? []).map((m) => m.af_fixture_id!).filter((id) => !liveIds.has(id));
  const stale = (await db.from("matches").select("af_fixture_id").eq("statut", "en_cours").not("af_fixture_id", "is", null)).data?.map((m) => m.af_fixture_id!).filter((id) => !liveIds.has(id)) ?? [];
  const ids = [...new Set([...missing, ...stale])];
  const b = ids.length ? await applyFixtures(db, await api.byIds(ids)) : { updated: 0, finished: 0 };

  let settled: unknown = null;
  if (a.finished + b.finished > 0) { const r = await db.rpc("settle_pending"); settled = r.error ? r.error.message : r.data; }
  return NextResponse.json({ ok: true, en_direct_monde: live.length, mis_a_jour: a.updated + b.updated, termines: a.finished + b.finished, reglement: settled, requetes: api.calls });
}
export const POST = run;
export const GET = run;
