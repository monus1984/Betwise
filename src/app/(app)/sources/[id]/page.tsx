import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RISK_CLASS, RISK_LABEL } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { evalStatus, labelType } from "../source-ui";
import { FollowButton, PredictionRow } from "./client";

export const dynamic = "force-dynamic";

type Named = { nom: string } | { nom: string }[] | null;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function SourcePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ existante?: string; ajout?: string; doublon?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: s } = await supabase.from("sources").select("*").eq("id", id).maybeSingle();
  if (!s) notFound();
  const { data: t } = await supabase.from("source_trend").select("*").eq("source_id", id).maybeSingle();
  const { data: f } = await supabase.from("source_follows").select("source_id").eq("source_id", id).eq("user_id", user!.id).maybeSingle();

  const { data: preds } = await supabase
    .from("predictions")
    .select("id, match_libre, market_code, market_param, selection, cote_annoncee, risque_annonce, risque_calcule, statut, resultat, logged_at, published_at, submitted_by, match:matches(id, kickoff_at, score_home, score_away, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom))")
    .eq("source_id", id)
    .order("logged_at", { ascending: false })
    .limit(60);

  const n = (v: unknown) => Number(v ?? 0);
  const declares = n(t?.nb_declares), regles = n(t?.nb_regles), gagnes = n(t?.nb_gagnes);
  const avecCote = n(t?.nb_avec_cote), unites = Number(t?.unites_nettes ?? 0);
  const isSystem = s.type === "modele_betwise" || s.type === "perso";

  return (
    <>
      <Link href="/sources" className="mb-3 inline-block text-sm text-slate-600">‹ Sources</Link>
      <PageHeader
        title={s.nom}
        subtitle={`${labelType(s.type)}${s.identifiant_externe ? ` · ${s.identifiant_externe}` : ""}${s.visibilite === "partagee" && !isSystem ? " · partagée" : ""}`}
        action={!isSystem ? <FollowButton sourceId={id} following={!!f} /> : undefined}
      />
      {sp.existante && <p className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">Cette source existait déjà en partagé : tu la suis maintenant, son historique est commun.</p>}
      {sp.ajout && !sp.doublon && <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Prono enregistré.</p>}
      {sp.doublon && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Ce prono existait déjà pour cette source (même match, marché et sélection le même jour) : rien n’a été ajouté.</p>}

      <section className="rounded-2xl bg-slate-900 p-5 text-white">
        <div className="flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-wide text-slate-300">Tendance</p>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{evalStatus(declares)} · {declares} prono{declares > 1 ? "s" : ""}</span>
        </div>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {regles ? `${gagnes} gagné${gagnes > 1 ? "s" : ""} sur ${regles}` : "—"}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div><p className="text-[11px] uppercase tracking-wide text-slate-400">Réussite</p><p className="font-semibold">{regles ? `${Math.round((100 * gagnes) / regles)} %` : "—"}</p></div>
          <div><p className="text-[11px] uppercase tracking-wide text-slate-400">Rendement</p><p className={`font-semibold ${unites >= 0 ? "text-emerald-300" : "text-red-300"}`}>{avecCote ? `${unites >= 0 ? "+" : ""}${unites.toFixed(1)} u / ${avecCote}` : "—"}</p></div>
          <div><p className="text-[11px] uppercase tracking-wide text-slate-400">Vérifiés</p><p className="font-semibold">{n(t?.nb_verifies)}/{declares}</p></div>
        </div>
        {declares > 0 && declares < 30 && <p className="mt-3 text-[11px] text-slate-400">Moins de 30 pronos : une tendance, pas un jugement. Le compte est affiché pour que tu juges toi-même.</p>}
      </section>

      <section className="mt-4 grid grid-cols-3 gap-2">
        {(["prudent", "moyen", "risque"] as const).map((k) => {
          const r = n(t?.[`${k}_regles` as keyof typeof t]), g = n(t?.[`${k}_gagnes` as keyof typeof t]);
          return (
            <div key={k} className={`rounded-xl border p-3 text-center ${RISK_CLASS[k]}`}>
              <p className="text-[11px] font-medium uppercase tracking-wide">{RISK_LABEL[k]}</p>
              <p className="text-lg font-semibold tabular-nums">{r ? `${g}/${r}` : "—"}</p>
              <p className="text-[11px] opacity-80">{r ? `${Math.round((100 * g) / r)} %` : "aucun réglé"}</p>
            </div>
          );
        })}
      </section>

      {s.type !== "modele_betwise" && (
        <Link href={`/sources/${id}/prono`} className="mt-4 block rounded-lg bg-slate-900 py-3 text-center text-base font-medium text-white">+ Enregistrer un prono de cette source</Link>
      )}

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold">Historique des pronos</h2>
        {(preds ?? []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-600">Aucun prono enregistré. Rien ne s’efface jamais ici : chaque prono garde son résultat.</p>
        ) : (
          <ul className="space-y-2">
            {(preds ?? []).map((p) => {
              const m = one(p.match as unknown as { id: string; kickoff_at: string; score_home: number | null; score_away: number | null; home: Named; away: Named } | null);
              return (
                <PredictionRow
                  key={p.id}
                  sourceId={id}
                  p={{
                    id: p.id,
                    label: m ? `${one(m.home)?.nom ?? ""} – ${one(m.away)?.nom ?? ""}` : p.match_libre ?? "Match non identifié",
                    matchId: m?.id ?? null,
                    kickoff: m?.kickoff_at ?? null,
                    score: m && m.score_home !== null ? `${m.score_home}–${m.score_away}` : null,
                    market: p.market_code,
                    param: p.market_param,
                    selection: p.selection,
                    cote: p.cote_annoncee,
                    risque: (p.risque_annonce ?? p.risque_calcule) as "prudent" | "moyen" | "risque" | null,
                    statut: p.statut,
                    resultat: p.resultat,
                    loggedAt: p.logged_at,
                    mine: p.submitted_by === user!.id,
                  }}
                />
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
