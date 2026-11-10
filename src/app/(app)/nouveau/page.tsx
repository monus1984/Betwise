import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { loadSourceOptions } from "@/lib/sources/options";
import { NewBetForm } from "./new-bet-form";

export const dynamic = "force-dynamic";

type Prefill = { match?: string; market?: string; param?: string; sel?: string; cote?: string; origin?: string; prediction?: string };

export default async function NouveauPage({ searchParams }: { searchParams: Promise<Prefill> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const ordered = await loadSourceOptions(supabase, user!.id);
  const mine = ordered.find((s) => s.type === "perso");

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
      <PageHeader title="Nouveau pari" subtitle="Trois champs, et l’origine de ton choix." action={<a href="/import" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium">Importer un ticket</a>} />
      <NewBetForm sources={ordered} markets={markets ?? []} defaultOrigin={mine?.id ?? null} prefill={{ match: prefillMatch, market: sp.market, param: sp.param, sel: sp.sel, cote: sp.cote, origin: sp.origin, prediction: sp.prediction }} />
    </>
  );
}
