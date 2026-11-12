import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { loadSourceOptions } from "@/lib/sources/options";
import { BetCard, type BetRow } from "./bet-card";

export const dynamic = "force-dynamic";

export default async function ParisPage({ searchParams }: { searchParams: Promise<{ ajout?: string; f?: string; vue?: string }> }) {
  const sp = await searchParams;
  const tests = sp.vue === "tests";
  const filter = sp.f === "regles" ? "regles" : "en_cours";
  const supabase = await createClient();

  let q = supabase
    .from("bets")
    .select("id, type, mise, cote_totale, statut, gain_net, placed_at, settled_at, created_at, bookmaker, detail_complet, bet_selections(id, match_libre, market_code, market_param, selection, cote, resultat, risque_calcule, origin_source_id, origin:sources!bet_selections_origin_source_id_fkey(nom), match:matches(kickoff_at, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom)))")
    .order("placed_at", { ascending: false })
    .eq("virtuel", tests)
    .limit(tests ? 200 : 50);
  if (!tests) q = filter === "en_cours" ? q.eq("statut", "en_cours") : q.neq("statut", "en_cours");
  else q = q.neq("statut", "annule");
  const { data, error } = await q;
  const bets = (data ?? []) as unknown as BetRow[];
  const { data: { user } } = await supabase.auth.getUser();
  const sources = await loadSourceOptions(supabase, user!.id);

  return (
    <>
      <PageHeader title="Mes paris" subtitle={tests ? "Choix testés sans miser : ta bankroll n’a pas bougé." : filter === "en_cours" ? "En attente de résultat." : "Réglés."} />
      {sp.ajout && <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{tests ? "Test enregistré." : "Pari enregistré."}</p>}

      <div className="mb-4 flex gap-2">
        <Tab href="/paris" active={!tests && filter === "en_cours"}>En cours</Tab>
        <Tab href="/paris?f=regles" active={!tests && filter === "regles"}>Réglés</Tab>
        <Tab href="/paris?vue=tests" active={tests}>🧪 Tests</Tab>
      </div>

      {tests && <TestsSummary bets={bets} />}

      {error && <p className="text-sm text-red-700">{error.message}</p>}
      {bets.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
          {tests ? <>Aucun test pour l’instant. Depuis <Link href="/options" className="text-brand underline">Options du jour</Link>, une fiche match ou un import de coupon, choisis « Tester sans miser ».</> : filter === "en_cours" ? "Aucun pari en cours. Le bouton + en bas permet d’en ajouter un." : "Aucun pari réglé pour l’instant."}
        </div>
      )}
      <ul className="space-y-3">
        {bets.map((b) => <BetCard key={b.id} bet={b} sources={sources} />)}
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

/** Bilan des tests : réussite par ticket et par sélection, rendement sur les mises fictives, par origine. */
function TestsSummary({ bets }: { bets: BetRow[] }) {
  const done = bets.filter((b) => b.statut !== "en_cours");
  if (!done.length) return <p className="mb-4 text-xs text-ink-muted">{bets.length} test{bets.length > 1 ? "s" : ""} en attente de résultat. Le bilan apparaît dès le premier réglé.</p>;
  const gagnes = done.filter((b) => b.statut === "gagne").length;
  const mises = done.reduce((x, b) => x + Number(b.mise), 0), net = done.reduce((x, b) => x + Number(b.gain_net ?? 0), 0);
  const byOrigin = new Map<string, { n: number; ok: number }>();
  for (const b of done) for (const s of b.bet_selections) {
    if (s.resultat !== "gagne" && s.resultat !== "perdu") continue;
    const k = (Array.isArray(s.origin) ? s.origin[0]?.nom : s.origin?.nom) ?? "—";
    const e = byOrigin.get(k) ?? { n: 0, ok: 0 }; e.n++; if (s.resultat === "gagne") e.ok++; byOrigin.set(k, e);
  }
  return (
    <section className="mb-4 rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><p className="text-lg font-bold tabular-nums">{done.length}</p><p className="text-[11px] text-ink-muted">réglés</p></div>
        <div><p className="text-lg font-bold tabular-nums">{Math.round((100 * gagnes) / done.length)} %</p><p className="text-[11px] text-ink-muted">tickets gagnés</p></div>
        <div><p className={`text-lg font-bold tabular-nums ${net >= 0 ? "text-gain" : "text-loss"}`}>{net >= 0 ? "+" : ""}{Math.round((100 * net) / mises)} %</p><p className="text-[11px] text-ink-muted">rendement</p></div>
      </div>
      {byOrigin.size > 0 && (
        <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs">
          {[...byOrigin].sort((a, b) => b[1].n - a[1].n).map(([nom, e]) => (
            <li key={nom} className="flex justify-between"><span className="truncate">{nom}</span><span className="tabular-nums text-ink-muted">{e.ok}/{e.n} sélections justes · <b className="text-ink">{Math.round((100 * e.ok) / e.n)} %</b></span></li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-ink-muted">Rendement calculé sur les mises fictives. Sur peu de tests, le hasard pèse lourd : attends une trentaine de résultats avant de conclure.</p>
    </section>
  );
}
