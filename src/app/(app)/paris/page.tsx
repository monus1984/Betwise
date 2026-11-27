import { LiveRefresh } from "@/components/live-refresh";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ParisNav } from "@/components/coach-nav";
import { createClient } from "@/lib/supabase/server";
import { loadSourceOptions } from "@/lib/sources/options";
import { BetCard, type BetRow } from "./bet-card";
import { bilanTests, type Ligne, type TestBet } from "@/lib/paris/bilan-tests";
import { COMP_SHORT } from "@/components/match-ui";
import { fcfa } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ParisPage({ searchParams }: { searchParams: Promise<{ ajout?: string; f?: string; vue?: string; p?: string }> }) {
  const sp = await searchParams;
  const tests = sp.vue === "tests";
  const filter = sp.f === "regles" ? "regles" : "en_cours";
  const supabase = await createClient();

  let q = supabase
    .from("bets")
    .select("id, type, mise, cote_totale, statut, gain_net, placed_at, settled_at, created_at, bookmaker, detail_complet, resultat_propose, gain_propose, bet_selections(id, match_libre, market_code, market_param, selection, cote, resultat, risque_calcule, origin_source_id, origin:sources!bet_selections_origin_source_id_fkey(nom), match:matches(kickoff_at, statut, score_home, score_away, ht_home, ht_away, minute, details, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(code_externe, nom)))")
    .order("placed_at", { ascending: false })
    .eq("virtuel", tests)
    .limit(tests ? 500 : 50);
  if (!tests) q = filter === "en_cours" ? q.eq("statut", "en_cours") : q.neq("statut", "en_cours");
  else q = q.neq("statut", "annule");
  const { data, error } = await q;
  const bets = (data ?? []) as unknown as BetRow[];
  const { data: { user } } = await supabase.auth.getUser();
  const sources = await loadSourceOptions(supabase, user!.id);

  // Scores en direct (27/11) : la page se met à jour toute seule tant qu'un match d'un pari est en cours
  const direct = bets.some((b) => b.bet_selections.some((x) => { const m = Array.isArray(x.match) ? x.match[0] : x.match; return m?.statut === "en_cours"; }));
  return (
    <>
      <LiveRefresh active={direct} seconds={45} />
      <ParisNav current="paris" />
      <PageHeader ajout aide={tests ? "tests" : "paris"} title="Mes paris" subtitle={tests ? "Choix testés sans miser : ta bankroll n’a pas bougé." : filter === "en_cours" ? "En attente de résultat ou de ta confirmation." : "Réglés."} action={<Link href="/bilan">Bilan</Link>} />
      {sp.ajout && <p className="mb-4 rounded-lg border border-gain/30 bg-gain-soft p-3 text-sm text-gain-ink">{tests ? "Test enregistré." : "Pari enregistré."}</p>}

      <div className="mb-4 flex gap-2">
        <Tab href="/paris" active={!tests && filter === "en_cours"}>En cours</Tab>
        <Tab href="/paris?f=regles" active={!tests && filter === "regles"}>Réglés</Tab>
        <Tab href="/paris?vue=tests" active={tests}>🧪 Paris test</Tab>
      </div>

      {tests && (
        <div className="mb-3 flex gap-2">
          <Link href="/nouveau?test=1" className="flex-1 rounded-xl bg-brand px-3 py-2.5 text-center text-sm font-semibold text-on-fill">+ Tester un choix</Link>
          <Link href="/import?test=1" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-center text-sm font-medium text-ink-soft">Tester un ticket ou le dire</Link>
        </div>
      )}
      {tests && <TestsSummary bets={bets} periode={sp.p === "7" || sp.p === "30" ? sp.p : "tout"} />}

      {error && <p className="text-sm text-loss-ink">{error.message}</p>}
      {bets.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-surface p-6 text-center text-sm text-slate-600">
          {tests ? <>Aucun test pour l’instant. Un test, c’est un pari sans argent réel : la cote du moment est notée, le résultat arrive tout seul, et tu vois si tes choix tiennent. Depuis <Link href="/options" className="text-brand underline">Options du jour</Link>, une fiche match, un import de coupon ou <Link href="/nouveau?test=1" className="text-brand underline">ton propre choix</Link>, choisis « Tester sans miser ».</> : filter === "en_cours" ? "Aucun pari en cours. Le bouton + en haut permet d’en ajouter un." : "Aucun pari réglé pour l’instant."}
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
    <Link href={href} className={`rounded-full px-3.5 py-1.5 text-sm ${active ? "bg-inverse text-on-inverse" : "bg-surface text-slate-700 border border-slate-300"}`}>
      {children}
    </Link>
  );
}

/** Bilan des tests : tickets et sélections à part, bilan virtuel, cote moyenne, par marché, compétition et origine, sur une période. */
function TestsSummary({ bets, periode }: { bets: BetRow[]; periode: "7" | "30" | "tout" }) {
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
  const data: TestBet[] = bets.map((b) => ({
    statut: b.statut, mise: Number(b.mise), gain_net: b.gain_net === null ? null : Number(b.gain_net), cote_totale: b.cote_totale === null ? null : Number(b.cote_totale), placed_at: b.placed_at,
    selections: b.bet_selections.map((s) => {
      const m = one(s.match as never) as { competition?: { code_externe: string | null; nom: string } | { code_externe: string | null; nom: string }[] | null } | null;
      const c = one(m?.competition ?? null);
      return { market: s.market_code, resultat: s.resultat, cote: Number(s.cote), origine: one(s.origin as never as { nom: string } | null)?.nom ?? null, competition: c ? COMP_SHORT[c.code_externe ?? ""] ?? c.nom : null };
    }),
  }));
  const b = bilanTests(data, periode === "tout" ? undefined : new Date(Date.now() - Number(periode) * 86400000));
  const P = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);
  const signe = (x: number) => `${x >= 0 ? "+" : "−"}${fcfa(Math.abs(Math.round(x)))}`;
  const Tableau = ({ titre, lignes }: { titre: string; lignes: Ligne[] }) => lignes.length ? (
    <details className="border-t border-line pt-2">
      <summary className="cursor-pointer text-xs font-semibold text-ink-soft">{titre}</summary>
      <ul className="mt-1.5 space-y-1 text-xs">
        {lignes.slice(0, 8).map((l) => <li key={l.cle} className="flex justify-between gap-2"><span className="truncate">{l.cle}</span><span className="shrink-0 tabular-nums text-ink-muted">{l.justes}/{l.n} · <b className="text-ink">{P(l.taux)}</b></span></li>)}
      </ul>
    </details>
  ) : null;
  return (
    <section className="mb-4 space-y-3 rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex gap-1.5 text-xs">
        {([["7", "7 jours"], ["30", "30 jours"], ["tout", "Tout"]] as const).map(([k, l]) => <Link key={k} href={`/paris?vue=tests${k === "tout" ? "" : `&p=${k}`}`} scroll={false} className={`rounded-full border px-2.5 py-1 ${periode === k ? "border-inverse bg-inverse text-on-inverse" : "border-line text-ink-soft"}`}>{l}</Link>)}
      </div>
      {b.tickets === 0 ? <p className="text-xs text-ink-muted">{b.enCours ? `${b.enCours} test${b.enCours > 1 ? "s" : ""} en attente de résultat. Le bilan apparaît dès le premier réglé.` : "Aucun test réglé sur cette période."}</p> : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-lg font-bold tabular-nums">{P(b.tauxTickets)}</p><p className="text-[11px] leading-tight text-ink-muted">tickets gagnés<br />{b.gagnes}/{b.gagnes + b.perdus}</p></div>
            <div><p className="text-lg font-bold tabular-nums">{P(b.tauxSelections)}</p><p className="text-[11px] leading-tight text-ink-muted">sélections justes<br />{b.selectionsJustes}/{b.selections}</p></div>
            <div><p className={`text-lg font-bold tabular-nums ${b.net >= 0 ? "text-gain" : "text-loss"}`}>{b.rendement === null ? "—" : `${b.net >= 0 ? "+" : ""}${Math.round(b.rendement * 100)} %`}</p><p className="text-[11px] leading-tight text-ink-muted">rendement<br />{signe(b.net)}</p></div>
          </div>
          <p className="text-[11px] text-ink-muted">{b.tickets} ticket{b.tickets > 1 ? "s" : ""} réglé{b.tickets > 1 ? "s" : ""}{b.rembourses ? ` dont ${b.rembourses} remboursé${b.rembourses > 1 ? "s" : ""}` : ""}{b.enCours ? `, ${b.enCours} en cours` : ""}{b.coteMoyenne ? ` · cote moyenne ${b.coteMoyenne.toFixed(2).replace(".", ",")}` : ""} · mises fictives {fcfa(Math.round(b.mises))}.</p>
          <Tableau titre="Par type de marché" lignes={b.parFamille} />
          <Tableau titre="Par compétition" lignes={b.parCompetition} />
          <Tableau titre="Par origine (toi, tes tipsters, le modèle)" lignes={b.parOrigine} />
        </>
      )}
      <p className="text-[11px] text-ink-muted">Calculé sur les tests enregistrés, avec la cote et l’heure du jour de l’enregistrement : rien ne se modifie après coup. Sur peu de tests, le hasard pèse lourd : attends une trentaine de résultats avant de conclure.</p>
    </section>
  );
}
