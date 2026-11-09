import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { NewBetForm } from "./new-bet-form";

export const dynamic = "force-dynamic";

export default async function NouveauPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Sources lisibles : « Moi » d'abord, puis les plus récemment utilisées comme origine
  const { data: sources } = await supabase
    .from("sources")
    .select("id, nom, type")
    .neq("type", "modele_betwise")
    .order("created_at");
  const mine = (sources ?? []).find((s) => s.type === "perso");
  const others = (sources ?? []).filter((s) => s.type !== "perso");

  const { data: recent } = await supabase
    .from("bet_selections")
    .select("origin_source_id, bets!inner(user_id, placed_at)")
    .eq("bets.user_id", user!.id)
    .order("bets(placed_at)", { ascending: false })
    .limit(30);
  const recentIds: string[] = [];
  for (const r of recent ?? []) if (!recentIds.includes(r.origin_source_id)) recentIds.push(r.origin_source_id);
  const ordered = [
    ...(mine ? [mine] : []),
    ...recentIds.map((id) => others.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s),
    ...others.filter((s) => !recentIds.includes(s.id)),
  ];

  const { data: markets } = await supabase.from("markets").select("code, libelle_fr, a_parametre").order("code");

  return (
    <>
      <PageHeader title="Nouveau pari" subtitle="Trois champs, et l’origine de ton choix." />
      <NewBetForm sources={ordered} markets={markets ?? []} defaultOrigin={mine?.id ?? null} />
    </>
  );
}
