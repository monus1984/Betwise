import { PageHeader } from "@/components/page-header";
import type { MatchHit } from "@/components/match-picker";
import { parseLegs } from "@/lib/options/build";
import { createClient } from "@/lib/supabase/server";
import { loadSourceOptions } from "@/lib/sources/options";
import { NewBetForm, type PrefillLeg } from "./new-bet-form";

export const dynamic = "force-dynamic";

type SP = { match?: string; market?: string; param?: string; sel?: string; cote?: string; origin?: string; prediction?: string; legs?: string; test?: string };
type Named = { nom: string } | { nom: string }[] | null;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function NouveauPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const ordered = await loadSourceOptions(supabase, user!.id);
  const mine = ordered.find((s) => s.type === "perso");
  const { data: markets } = await supabase.from("markets").select("code, libelle_fr, a_parametre").order("code");

  // Préremplissage : une sélection (fiche match, prono) ou plusieurs (options du jour, combinés)
  const raw = sp.legs ? parseLegs(sp.legs) : sp.match ? [{ match: sp.match, market: sp.market ?? "1X2", param: sp.param ?? "", sel: sp.sel ?? "", cote: sp.cote ?? "" }] : [];
  let legs: PrefillLeg[] = [];
  if (raw.length) {
    const { data } = await supabase.from("matches")
      .select("id, kickoff_at, statut, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(code_externe)")
      .in("id", raw.map((l) => l.match));
    const rows = (data ?? []) as unknown as { id: string; kickoff_at: string; statut: string; home: Named; away: Named; competition: { code_externe: string | null } | { code_externe: string | null }[] | null }[];
    legs = raw.flatMap((l) => {
      const m = rows.find((r) => r.id === l.match); if (!m) return [];
      const match: MatchHit = { id: m.id, kickoff_at: m.kickoff_at, statut: m.statut, home: one(m.home)?.nom ?? "", away: one(m.away)?.nom ?? "", competition: one(m.competition)?.code_externe ?? "" };
      return [{ match, market: l.market, param: l.param, sel: l.sel, cote: l.cote, origin: sp.origin, prediction: raw.length === 1 ? sp.prediction : undefined }];
    });
  }
  const test = sp.test === "1";

  return (
    <>
      <PageHeader title={test ? "Tester un choix" : "Nouveau pari"} subtitle={test ? "Enregistré et suivi comme un pari, sans toucher à ta bankroll." : "Trois champs, et l’origine de ton choix."} action={<a href="/import" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium">Importer un ticket</a>} />
      <NewBetForm sources={ordered} markets={markets ?? []} defaultOrigin={mine?.id ?? null} legs={legs} initialTest={test} />
    </>
  );
}
