import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiFootball } from "@/lib/api-football/client";
import { applyFixtures, fillDetails } from "@/lib/api-football/sync";
import { sendPending } from "@/lib/push/server";
import { relinkFreeMatches } from "@/lib/bets/relink";

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
  let live;
  try { live = await api.live(); }
  catch (e) {
    const k = process.env.API_FOOTBALL_KEY;
    // diagnostic sans dévoiler la clé : longueur et forme seulement
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 160) : "erreur", cle: { longueur: k.length, longueur_nettoyee: k.trim().replace(/^["']|["']$/g, "").length, hexadecimale: /^[0-9a-f]+$/i.test(k.trim().replace(/^["']|["']$/g, "")) } }, { status: 502 });
  }
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

  // Détail des matchs terminés (corners, cartons, buteurs…) : règle les paris qui en dépendent
  let details = 0;
  try { details = (await fillDetails(db, api)).filled; } catch { /* réessayé à la minute suivante */ }

  // Paris saisis en « match libre » : rattachés dès que le match existe dans le référentiel, pour être réglés comme les autres
  let relies = 0;
  try { relies = (await relinkFreeMatches(db)).relies; } catch { /* réessayé à la minute suivante */ }

  let settled: unknown = null;
  if (a.finished + b.finished + details + relies > 0) { const r = await db.rpc("settle_pending"); settled = r.error ? r.error.message : r.data; }
  // Notifications du direct (but, mi-temps, fin) : envoyées tout de suite, sans attendre la minute suivante
  let notifs = 0;
  try { notifs = (await sendPending(db)).envois; } catch { /* la file sera reprise par tick_notify */ }
  return NextResponse.json({ ok: true, notifications: notifs, en_direct_monde: live.length, mis_a_jour: a.updated + b.updated, termines: a.finished + b.finished, details_completes: details, matchs_rattaches: relies, reglement: settled, requetes: api.calls });
}
export const POST = run;
export const GET = run;
