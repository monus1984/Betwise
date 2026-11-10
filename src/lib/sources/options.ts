import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;
export type SourceOption = { id: string; nom: string; type: string };

/**
 * Sources proposées comme origine d'un choix : « Moi », puis les origines récentes, les sources suivies,
 * les autres sources visibles, et le Modèle BETWISE en dernier.
 */
export async function loadSourceOptions(db: Db, userId: string): Promise<SourceOption[]> {
  const [{ data: all }, { data: follows }, { data: recent }] = await Promise.all([
    db.from("sources").select("id, nom, type").order("created_at"),
    db.from("source_follows").select("source_id").eq("user_id", userId),
    db.from("bet_selections").select("origin_source_id, bets!inner(user_id, placed_at)").eq("bets.user_id", userId).order("bets(placed_at)", { ascending: false }).limit(40),
  ]);
  const list = all ?? [];
  const mine = list.filter((s) => s.type === "perso");
  const model = list.filter((s) => s.type === "modele_betwise");
  const rest = list.filter((s) => s.type !== "perso" && s.type !== "modele_betwise");
  const rank = new Map<string, number>();
  (recent ?? []).forEach((r, i) => { if (!rank.has(r.origin_source_id)) rank.set(r.origin_source_id, i); });
  const followed = new Set((follows ?? []).map((f) => f.source_id));
  rest.sort((a, b) => (rank.get(a.id) ?? 1e3 + (followed.has(a.id) ? 0 : 1e3)) - (rank.get(b.id) ?? 1e3 + (followed.has(b.id) ? 0 : 1e3)) || a.nom.localeCompare(b.nom, "fr"));
  return [...mine, ...rest, ...model];
}
