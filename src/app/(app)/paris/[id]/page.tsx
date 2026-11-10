import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { BetEditor, type EditableBet } from "./editor";

export const dynamic = "force-dynamic";

type Named = { nom: string } | { nom: string }[] | null;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function BetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("bets")
    .select("id, type, mise, cote_totale, statut, gain_net, placed_at, created_at, bookmaker, detail_complet, nb_selections, source_import, bet_selections(id, match_id, match_libre, market_code, market_param, selection, cote, resultat, risque_calcule, origin_source_id, match:matches(id, kickoff_at, statut, score_home, score_away, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(code_externe)))")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const { data: srcs } = await supabase.from("sources").select("id, nom, type").neq("type", "modele_betwise").order("created_at");
  const mine = (srcs ?? []).find((x) => x.type === "perso");
  const sources = [...(mine ? [mine] : []), ...(srcs ?? []).filter((x) => x.type !== "perso")].map((x) => ({ id: x.id, nom: x.nom }));
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

  return (
    <>
      <Link href="/paris" className="mb-3 inline-block text-sm text-slate-600">‹ Mes paris</Link>
      <PageHeader title="Modifier le pari" subtitle={`${b.type === "combine" ? "Combiné" : "Simple"} · ${b.statut === "en_cours" ? "en cours" : "réglé"} · saisi le ${new Date(b.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", timeZone: "Africa/Abidjan" })}`} />
      <BetEditor bet={bet} sources={sources} markets={markets ?? []} />

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">Historique des modifications</h2>
        {(versions ?? []).length === 0 ? (
          <p className="text-xs text-slate-500">Aucune modification depuis la saisie.</p>
        ) : (
          <ul className="space-y-1 text-xs text-slate-600">
            {(versions ?? []).map((v, i) => (
              <li key={i} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="text-slate-400">{new Date(v.changed_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })}</span>
                {" · "}
                {Object.entries(v.changes as Record<string, { avant: unknown; apres: unknown }>).map(([k, c]) => `${label(k)} : ${fmt(c.avant, k, sources)} → ${fmt(c.apres, k, sources)}`).join(" ; ")}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function label(k: string) {
  return ({ origin_source_id: "origine", cote: "cote", match_id: "match", match_libre: "match", marche: "marché", mise: "mise", bookmaker: "bookmaker", placed_at: "date du ticket" } as Record<string, string>)[k] ?? k;
}
function fmt(v: unknown, k: string, sources: { id: string; nom: string }[]) {
  if (v === null || v === undefined) return "—";
  if (k === "origin_source_id") return sources.find((s) => s.id === v)?.nom ?? "autre source";
  if (k === "match_id") return typeof v === "string" ? "match identifié" : "—";
  if (k === "placed_at") return new Date(String(v)).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
  return String(v);
}
