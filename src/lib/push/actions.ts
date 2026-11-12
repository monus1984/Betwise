"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type NotifPrefs = { resultats: boolean; coup_envoi: boolean; coups_du_jour: boolean; sources: boolean };

export async function setNotifPref(key: keyof NotifPrefs, on: boolean) {
  if (!["resultats", "coup_envoi", "coups_du_jour", "sources"].includes(key)) return { ok: false as const };
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false as const };
  const { error } = await db.from("notification_prefs").upsert({ user_id: user.id, updated_at: new Date().toISOString(), ...(key === "resultats" ? { resultats: on } : key === "coup_envoi" ? { coup_envoi: on } : key === "coups_du_jour" ? { coups_du_jour: on } : { sources: on }) }, { onConflict: "user_id" });
  revalidatePath("/");
  return { ok: !error };
}
