import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getVapid, sendPending } from "@/lib/push/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sub = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(5).max(100) }) });

/** GET : clé publique du push. POST : abonne ce téléphone (ou envoie un test). DELETE : le désabonne. */
export async function GET() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  try { return NextResponse.json({ publicKey: (await getVapid(createAdminClient())).publicKey }); }
  catch { return NextResponse.json({ error: "Notifications indisponibles pour l’instant." }, { status: 503 }); }
}

export async function POST(req: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const body = await req.json().catch(() => null) as { subscription?: unknown; test?: boolean } | null;
  const admin = createAdminClient();

  if (body?.subscription) {
    const p = sub.safeParse(body.subscription);
    if (!p.success) return NextResponse.json({ error: "Abonnement invalide." }, { status: 400 });
    // un téléphone = un abonnement ; s'il change de compte, il suit le dernier connecté
    const { error } = await admin.from("push_subscriptions").upsert({ user_id: user.id, endpoint: p.data.endpoint, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth, user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null }, { onConflict: "endpoint" });
    if (error) return NextResponse.json({ error: "Abonnement impossible." }, { status: 500 });
    await admin.from("notification_prefs").upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  }
  if (body?.test) {
    await admin.from("notifications").insert({ user_id: user.id, type: "test", cle: `test:${Date.now()}`, titre: "🔔 BETWISE", corps: "Les notifications fonctionnent sur ce téléphone.", url: "/" });
    const r = await sendPending(admin, user.id);
    if (!r.envois) return NextResponse.json({ error: "Aucun téléphone abonné n’a reçu le test. Réactive les notifications." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const body = await req.json().catch(() => null) as { endpoint?: string } | null;
  if (body?.endpoint) await db.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
  return NextResponse.json({ ok: true });
}
