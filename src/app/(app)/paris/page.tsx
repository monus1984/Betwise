import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { BetCard, type BetRow } from "./bet-card";

export const dynamic = "force-dynamic";

export default async function ParisPage({ searchParams }: { searchParams: Promise<{ ajout?: string; f?: string }> }) {
  const sp = await searchParams;
  const filter = sp.f === "regles" ? "regles" : "en_cours";
  const supabase = await createClient();

  let q = supabase
    .from("bets")
    .select("id, type, mise, cote_totale, statut, gain_net, placed_at, settled_at, bet_selections(id, match_libre, market_code, market_param, selection, cote, resultat, risque_calcule, origin:sources!bet_selections_origin_source_id_fkey(nom), match:matches(kickoff_at, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom)))")
    .order("placed_at", { ascending: false })
    .limit(50);
  q = filter === "en_cours" ? q.eq("statut", "en_cours") : q.neq("statut", "en_cours");
  const { data, error } = await q;
  const bets = (data ?? []) as unknown as BetRow[];

  return (
    <>
      <PageHeader title="Mes paris" subtitle={filter === "en_cours" ? "En attente de résultat." : "Réglés."} />
      {sp.ajout && <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Pari enregistré.</p>}

      <div className="mb-4 flex gap-2">
        <Tab href="/paris" active={filter === "en_cours"}>En cours</Tab>
        <Tab href="/paris?f=regles" active={filter === "regles"}>Réglés</Tab>
      </div>

      {error && <p className="text-sm text-red-700">{error.message}</p>}
      {bets.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
          {filter === "en_cours" ? "Aucun pari en cours. Le bouton + en bas permet d’en ajouter un." : "Aucun pari réglé pour l’instant."}
        </div>
      )}
      <ul className="space-y-3">
        {bets.map((b) => <BetCard key={b.id} bet={b} />)}
      </ul>
    </>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`rounded-full px-3.5 py-1.5 text-sm ${active ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-300"}`}>
      {children}
    </Link>
  );
}
