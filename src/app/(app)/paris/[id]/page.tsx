import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { loadSourceOptions } from "@/lib/sources/options";
import { loadSignals } from "@/lib/probs/signals";
import { analyzeTicket } from "@/lib/probs/ticket";
import { TicketAnalysisCard } from "./ticket-analysis";
import { Cashout, CorrectResult, NotPlayed } from "./not-played";
import { ConfirmResult } from "../confirm-result";
import { BetEditor, type EditableBet } from "./editor";
import { reglableA } from "@/lib/bets/reglement";

export const dynamic = "force-dynamic";

type Named = { nom: string } | { nom: string }[] | null;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function BetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("bets")
    .select("id, type, mise, cote_totale, statut, gain_net, placed_at, created_at, bookmaker, detail_complet, nb_selections, source_import, virtuel, resultat_propose, gain_propose, cashout, bet_selections(id, match_id, match_libre, market_code, market_param, selection, cote, resultat, risque_calcule, origin_source_id, match:matches(id, kickoff_at, statut, score_home, score_away, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(code_externe)))")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const sources = await loadSourceOptions(supabase, user!.id);
  const { data: markets } = await supabase.from("markets").select("code, libelle_fr, a_parametre").order("code");
  const { data: versions } = await supabase.from("bet_versions").select("changes, changed_at, selection_id").eq("bet_id", id).order("changed_at", { ascending: false }).limit(30);

  type Raw = typeof data & { bet_selections: { match: { id: string; kickoff_at: string; statut: string; score_home: number | null; score_away: number | null; home: Named; away: Named; competition: { code_externe: string | null } | { code_externe: string | null }[] | null } | null }[] };
  const b = data as unknown as Raw;
  const bet: EditableBet = {
    id: b.id, type: b.type, mise: Number(b.mise), cote_totale: Number(b.cote_totale ?? 0), statut: b.statut, placed_at: b.placed_at,
    bookmaker: b.bookmaker, detail_complet: b.detail_complet, nb_selections: b.nb_selections,
    selections: b.bet_selections.map((s) => {
      const m = one(s.match);
      return {
        id: s.id, market_code: s.market_code, market_param: s.market_param, selection: s.selection, cote: Number(s.cote), resultat: s.resultat,
        origin_source_id: s.origin_source_id, match_libre: s.match_libre,
        match: m ? { id: m.id, kickoff_at: m.kickoff_at, statut: m.statut, home: one(m.home)?.nom ?? "", away: one(m.away)?.nom ?? "", competition: one(m.competition)?.code_externe ?? "", score: m.score_home !== null ? `${m.score_home}–${m.score_away}` : null } : null,
      };
    }),
  };

  const signals = await loadSignals(supabase, bet.selections.map((x) => x.match?.id).filter((x): x is string => !!x));
  const analysis = bet.detail_complet ? analyzeTicket(bet.selections.map((x) => ({ match_id: x.match?.id ?? null, market_code: x.market_code, market_param: x.market_param, selection: x.selection, cote: x.cote, home: x.match?.home, away: x.match?.away, libre: x.match_libre })), signals, bet.cote_totale) : null;

  return (
    <>
      <Link href="/paris" className="mb-3 inline-block text-sm text-slate-600">‹ Mes paris</Link>
      {b.virtuel && <p className="mb-3 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-xs text-ink-soft">🧪 <b>Test sans mise</b> : suivi et réglé comme un pari, sans effet sur ta bankroll.</p>}
      <PageHeader title={b.virtuel ? "Détail du test" : "Détail du pari"} subtitle={`${b.type === "combine" ? "Combiné" : "Simple"} · ${b.statut === "en_cours" ? "en cours" : "réglé"} · saisi le ${new Date(b.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", timeZone: "Africa/Abidjan" })}`} />
      {analysis && <TicketAnalysisCard a={analysis} />}
      {b.statut === "en_cours" && <ConfirmResult apres={reglableA(bet.selections.map((x) => ({ kickoff_at: x.match?.kickoff_at ?? null, statut: x.match?.statut ?? null })))?.toISOString() ?? null} betId={b.id} propose={b.resultat_propose && b.resultat_propose !== "en_attente" ? b.resultat_propose : null} gainPropose={b.gain_propose === null ? null : Number(b.gain_propose)} mise={Number(b.mise)} />}
      <BetEditor bet={bet} sources={sources} markets={markets ?? []} />
      {b.statut === "en_cours" && !b.virtuel && <Cashout betId={b.id} mise={Number(b.mise)} />}
      {b.cashout !== null && b.cashout !== undefined && <p className="mt-4 rounded-xl border border-info/30 bg-info-soft p-3 text-sm text-info-ink">Réglé par cashout : {Math.round(Number(b.cashout)).toLocaleString("fr-FR")} F encaissés. Les lignes dont le match n’était pas terminé restent « en attente ».</p>}
      {b.cashout === null && (b.statut === "gagne" || b.statut === "perdu" || b.statut === "rembourse") && <CorrectResult betId={b.id} statut={b.statut} test={b.virtuel} />}
      {!b.virtuel && b.statut !== "annule" && <NotPlayed betId={b.id} />}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">Historique des modifications</h2>
        {(versions ?? []).length === 0 ? (
          <p className="text-xs text-slate-500">Aucune modification depuis la saisie.</p>
        ) : (
          <ul className="space-y-1 text-xs text-slate-600">
            {(versions ?? []).map((v, i) => (
              <li key={i} className="rounded-lg border border-slate-200 bg-surface px-3 py-2">
                <span className="text-slate-400">{new Date(v.changed_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })}</span>
                {" · "}
                {Object.entries(v.changes as Record<string, unknown>).filter(([, c]) => c !== null && typeof c === "object" && "apres" in (c as object)).map(([k, c]) => `${label(k)} : ${fmt((c as { avant: unknown }).avant, k, sources)} → ${fmt((c as { apres: unknown }).apres, k, sources)}`).join(" ; ")}
                {typeof (v.changes as Record<string, unknown>).motif === "string" ? ` (${(v.changes as Record<string, string>).motif})` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function label(k: string) {
  return ({ origin_source_id: "origine", cote: "cote", match_id: "match", match_libre: "match", marche: "marché", mise: "mise", bookmaker: "bookmaker", placed_at: "date du ticket", resultat: "résultat de la ligne", statut: "résultat du pari" } as Record<string, string>)[k] ?? k;
}
function fmt(v: unknown, k: string, sources: { id: string; nom: string }[]) {
  if (v === null || v === undefined) return "—";
  if (k === "origin_source_id") return sources.find((s) => s.id === v)?.nom ?? "autre source";
  if (k === "match_id") return typeof v === "string" ? "match identifié" : "—";
  if (k === "resultat" || k === "statut") return ({ en_attente: "en attente", en_cours: "en cours", gagne: "gagné", perdu: "perdu", rembourse: "remboursé", annule: "annulé" } as Record<string, string>)[String(v)] ?? String(v);
  if (k === "placed_at") return new Date(String(v)).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
  return String(v);
}
