"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Suivre ou ne plus suivre un match (étoile) : il apparaît dans « Suivis » et envoie les notifications du direct. */
export async function toggleFollowMatch(matchId: string, follow: boolean) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false as const };
  const { error } = follow
    ? await db.from("match_follows").upsert({ user_id: user.id, match_id: matchId }, { onConflict: "user_id,match_id", ignoreDuplicates: true })
    : await db.from("match_follows").delete().eq("user_id", user.id).eq("match_id", matchId);
  revalidatePath("/matchs");
  return { ok: !error };
}

/** Suivre ou ne plus suivre une équipe : tous ses matchs apparaissent dans « Suivis » et envoient le direct. */
export async function toggleFollowTeam(teamId: string, follow: boolean) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false as const };
  const { error } = follow
    ? await db.from("team_follows").upsert({ user_id: user.id, team_id: teamId }, { onConflict: "user_id,team_id", ignoreDuplicates: true })
    : await db.from("team_follows").delete().eq("user_id", user.id).eq("team_id", teamId);
  revalidatePath("/matchs");
  return { ok: !error };
}
