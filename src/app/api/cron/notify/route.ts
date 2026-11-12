import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPending } from "@/lib/push/server";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/** Envoi des notifications en attente : appelée par pg_cron (tick_notify) quand la file n'est pas vide. */
async function run(req: Request) {
  const secret = process.env.LIVE_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...(await sendPending(createAdminClient())) }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 200) : "erreur" }, { status: 500 }); }
}
export const POST = run;
export const GET = run;
