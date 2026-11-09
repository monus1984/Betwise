import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { NewBetForm } from "./new-bet-form";

export const dynamic = "force-dynamic";

type Prefill = { match?: string; market?: string; param?: string; sel?: string; cote?: string };

export default async function NouveauPage({ searchParams }: { searchParams: Promise<Prefill> }) {
  const sp = await searchParams;
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

  // Préremplissage depuis une fiche match
  let prefillMatch: { id: string; kickoff_at: string; statut: string; home: string; away: string; competition: string } | null = null;
  if (sp.match) {
    const { data: pm } = await supabase
      .from("matches")
      .select("id, kickoff_at, statut, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(code_externe)")
      .eq("id", sp.match)
      .maybeSingle();
    if (pm) {
      const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
      const x = pm as unknown as { id: string; kickoff_at: string; statut: string; home: { nom: string } | { nom: string }[] | null; away: { nom: string } | { nom: string }[] | null; competition: { code_externe: string | null } | { code_externe: string | null }[] | null };
      prefillMatch = { id: x.id, kickoff_at: x.kickoff_at, statut: x.statut, home: one(x.home)?.nom ?? "", away: one(x.away)?.nom ?? "", competition: one(x.competition)?.code_externe ?? "" };
    }
  }

  return (
    <>
      <PageHeader title="Nouveau pari" subtitle="Trois champs, et l’origine de ton choix." />
      <NewBetForm sources={ordered} markets={markets ?? []} defaultOrigin={mine?.id ?? null} prefill={{ match: prefillMatch, market: sp.market, param: sp.param, sel: sp.sel, cote: sp.cote }} />
    </>
  );
}
