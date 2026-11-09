import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Santé de l'app + ping quotidien de la base (évite la mise en pause Supabase gratuit). */
export async function GET() {
  try {
    const db = createAdminClient();
    const { count, error } = await db.from("matches").select("id", { count: "exact", head: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, matches: count ?? 0, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
