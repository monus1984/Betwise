import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { labelType, MARCHE_FR } from "../source-ui";
import { COMPETITIONS } from "@/lib/competitions";
import { NIVEAU, lire, niveau, raison, rendement, reussite } from "@/lib/sources/proof";
import { FollowButton, PredictionRow, SourceLink } from "./client";
import { linkOf } from "@/lib/sources/link";
import { CumulChart, type CumulPoint } from "./cumul-chart";

export const dynamic = "force-dynamic";

type Named = { nom: string } | { nom: string }[] | null;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function SourcePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ existante?: string; ajout?: string; doublon?: string; p?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: s } = await supabase.from("sources").select("*").eq("id", id).maybeSingle();
  if (!s) notFound();
  const [{ data: pf }, { data: parMarche }] = await Promise.all([
    supabase.from("source_proof").select("*").eq("source_id", id).maybeSingle(),
    supabase.from("source_proof_by_market").select("*").eq("source_id", id),
  ]);
  const proof = lire(pf), nv = niveau(proof), reu = reussite(proof), rdt = rendement(proof);
  const { data: f } = await supabase.from("source_follows").select("source_id").eq("source_id", id).eq("user_id", user!.id).maybeSingle();
  const periode = (["30j", "90j", "180j", "total"] as const).includes(sp.p as never) ? (sp.p as "30j" | "90j" | "180j" | "total") : "total";
  const since = periode === "total" ? null : new Date(Date.now() - Number(periode.replace("j", "")) * 86400000).toISOString();
  const { data: met } = await supabase.from("source_metrics").select("*").eq("source_id", id).eq("periode", periode).maybeSingle();
  const { data: axes } = await supabase.from("source_metrics_by_axis").select("*").eq("source_id", id).eq("periode", periode);
  const { data: cumul } = await supabase.rpc("source_cumulative", { p_source_id: id, p_since: since });
  const points = ((cumul ?? []) as unknown as CumulPoint[]);

  const { data: preds } = await supabase
    .from("predictions")
    .select("id, match_libre, market_code, market_param, selection, cote_annoncee, risque_annonce, risque_calcule, statut, resultat, logged_at, published_at, submitted_by, match:matches(id, kickoff_at, score_home, score_away, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom))")
    .eq("source_id", id)
    .order("logged_at", { ascending: false })
    .limit(60);

  const isSystem = s.type === "modele_betwise" || s.type === "perso";

  return (
    <>
      <Link href="/sources" className="mb-3 inline-block text-sm text-slate-600">‹ Sources</Link>
      <PageHeader
        title={s.nom}
        subtitle={`${labelType(s.type)}${s.identifiant_externe ? ` · ${s.identifiant_externe}` : ""}${s.visibilite === "partagee" && !isSystem ? " · partagée" : ""}`}
        action={!isSystem ? <FollowButton sourceId={id} following={!!f} /> : undefined}
      />
      {!isSystem && <SourceLink sourceId={id} type={s.type} url={linkOf(s)} saved={!!s.lien} canEdit={s.created_by === user!.id || (s.visibilite === "partagee" && !s.lien)} />}
      {sp.existante && <p className="mb-4 rounded-lg border border-info/30 bg-info-soft p-3 text-sm text-info-ink">Cette source existait déjà en partagé : tu la suis maintenant, son historique est commun.</p>}
      {sp.ajout && !sp.doublon && <p className="mb-4 rounded-lg border border-gain/30 bg-gain-soft p-3 text-sm text-gain-ink">Prono enregistré.</p>}
      {sp.doublon && <p className="mb-4 rounded-lg border border-draw/40 bg-draw-soft p-3 text-sm text-draw-ink">Ce prono existait déjà pour cette source (même match, marché et sélection le même jour) : rien n’a été ajouté.</p>}

      <section className="rounded-2xl bg-pitch p-5 text-white">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-medium text-white/70">Ses pronos</p>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{NIVEAU[nv]}</span>
        </div>
        <p className="mt-1 text-3xl font-bold tabular-nums">{nv === "non_etabli" ? (proof.prouves ? "En attente" : "À suivre") : `${proof.prouvesGagnes} juste${proof.prouvesGagnes > 1 ? "s" : ""} sur ${proof.prouvesRegles}`}</p>
        {nv === "non_etabli" ? (
          <p className="mt-1 text-[13px] leading-snug text-white/75">{raison(proof)}</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-[11px] text-white/60">Réussite</p><p className="font-semibold tabular-nums">{reu === null ? "—" : `${Math.round(reu * 100)} %`}</p></div>
            <div><p className="text-[11px] text-white/60">Attendu</p><p className="font-semibold tabular-nums">{proof.attendu === null ? "—" : `${Math.round(proof.attendu * 100)} %`}</p></div>
            <div><p className="text-[11px] text-white/60">Rendement</p><p className={`font-semibold tabular-nums ${rdt === null ? "" : rdt >= 0 ? "text-band-gain" : "text-band-loss"}`}>{rdt === null ? "—" : `${rdt >= 0 ? "+" : "−"}${Math.abs(rdt * 100).toFixed(0).replace(".", ",")} %`}</p></div>
          </div>
        )}
        {nv !== "non_etabli" && proof.attendu !== null && <p className="mt-3 text-[11px] text-white/60">« Attendu » : la réussite que ces cotes laissent prévoir. Au-dessus, la source fait mieux que le marché.</p>}
        {proof.prouves > 0 && <p className="mt-1 text-[11px] text-white/60">{proof.prouves - proof.apresCoup} prono{proof.prouves - proof.apresCoup > 1 ? "s" : ""} sur {proof.prouves} chargé{proof.prouves > 1 ? "s" : ""} avant le coup d’envoi. Tous comptent.</p>}
      </section>

      <div className="mt-4 flex gap-2">
        {(["30j", "90j", "180j", "total"] as const).map((k) => (
          <Link key={k} href={`/sources/${id}?p=${k}`} className={`rounded-full px-3 py-1 text-xs ${periode === k ? "bg-inverse text-on-inverse" : "border border-slate-300 bg-surface text-slate-700"}`}>{k === "total" ? "Depuis le début" : k.replace("j", " jours")}</Link>
        ))}
      </div>

      <section className="mt-3 rounded-xl border border-slate-200 bg-surface p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Rendement cumulé</h2>
          <span className="text-[11px] text-slate-500">mise fixe de 1 unité par prono</span>
        </div>
        <CumulChart points={points} />
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Rendement moyen</p>
            <p className="font-semibold tabular-nums">{met?.rendement !== null && met?.rendement !== undefined ? `${Number(met.rendement) >= 0 ? "+" : ""}${(Number(met.rendement) * 100).toFixed(1).replace(".", ",")} %` : "—"}</p>
            {met?.ic_bas !== null && met?.ic_bas !== undefined && (
              <p className={`text-[11px] ${Number(met.ic_bas) > 0 ? "text-gain-ink" : Number(met.ic_haut) < 0 ? "text-loss-ink" : "text-slate-500"}`}>
                {Number(met.ic_bas) > 0 ? "établi positif" : Number(met.ic_haut) < 0 ? "établi négatif" : "non établi"} · 90 % entre {(Number(met.ic_bas) * 100).toFixed(0).replace(".", ",")} et {(Number(met.ic_haut) * 100).toFixed(0).replace(".", ",")} %
              </p>
            )}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Pire série</p>
            <p className="font-semibold tabular-nums">{met?.pire_serie !== null && met?.pire_serie !== undefined && Number(met.nb_regles) > 0 ? `−${Number(met.pire_serie).toFixed(1).replace(".", ",")} u` : "—"}</p>
            <p className="text-[11px] text-slate-500">plus forte baisse</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Seuil de rentabilité</p>
            <p className="font-semibold tabular-nums">{points.length ? `${Math.round(100 / avgOdds(points))} %` : "—"}</p>
            <p className="text-[11px] text-slate-500">réussite à atteindre à cette cote moyenne</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">Calculé chaque nuit sur les pronos réglés avec cote, période choisie ci-dessus. « Non établi » : l’intervalle de confiance contient zéro, l’échantillon ne permet pas de conclure.</p>
      </section>

      {(axes ?? []).some((a) => a.axe === "competition") && (
        <section className="mt-3 rounded-xl border border-slate-200 bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">Par compétition et par marché</h2>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-500"><th className="py-1 font-medium"></th><th className="py-1 text-right font-medium">Pronos</th><th className="py-1 text-right font-medium">Gagnés</th><th className="py-1 text-right font-medium">Rendement</th></tr></thead>
            {(["competition", "marche"] as const).map((axe) => {
              const lignes = (axes ?? []).filter((a) => a.axe === axe && Number(a.nb_declares) > 0).sort((a, b) => Number(b.nb_declares) - Number(a.nb_declares));
              if (!lignes.length) return null;
              return (
                <tbody key={axe}>
                  <tr><th colSpan={4} className="pb-1 pt-3 text-left text-[11px] font-semibold text-ink-muted">{axe === "competition" ? "Par compétition" : "Par marché"}</th></tr>
                  {lignes.map((a) => (
                    <tr key={`${a.axe}-${a.valeur}`} className="border-t border-slate-100">
                      <td className="py-1">{axe === "competition" ? compLabel(a.valeur) : MARCHE_FR[a.valeur] ?? a.valeur}</td>
                      <td className="py-1 text-right tabular-nums">{Number(a.nb_declares)}</td>
                      <td className="py-1 text-right tabular-nums">{Number(a.nb_gagnes)}</td>
                      {/* Pas de rendement sous 5 pronos, comme le tableau « Par marché » ci-dessous */}
                      <td className={`py-1 text-right tabular-nums ${a.rendement === null || Number(a.nb_declares) < 5 ? "text-slate-400" : Number(a.rendement) >= 0 ? "text-gain-ink" : "text-loss-ink"}`}>{a.rendement === null || Number(a.nb_declares) < 5 ? "—" : `${Number(a.rendement) >= 0 ? "+" : ""}${(Number(a.rendement) * 100).toFixed(0).replace(".", ",")} %`}</td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </section>
      )}

      {(parMarche ?? []).some((m) => Number(m.regles) > 0) && (
        <section className="mt-3 rounded-xl border border-line bg-surface p-4">
          <div className="mb-2 flex items-baseline justify-between"><h2 className="text-sm font-semibold">Par marché</h2><span className="text-[11px] text-ink-muted">tous ses pronos réglés</span></div>
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-[11px] text-ink-muted"><th className="py-1 font-medium">Marché</th><th className="py-1 text-right font-medium">Justes</th><th className="py-1 text-right font-medium">Rendement</th></tr></thead>
            <tbody className="divide-y divide-line">
              {(parMarche ?? []).filter((m) => Number(m.regles) > 0).sort((a, b) => Number(b.regles) - Number(a.regles)).map((m) => {
                const r = Number(m.avec_cote) ? Number(m.unites) / Number(m.avec_cote) : null;
                return (
                  <tr key={m.market_code}>
                    <td className="py-1.5">{MARCHE_FR[m.market_code ?? ""] ?? m.market_code}</td>
                    <td className="py-1.5 text-right tabular-nums">{Number(m.gagnes)} sur {Number(m.regles)}</td>
                    <td className={`py-1.5 text-right tabular-nums ${r === null || Number(m.regles) < 5 ? "text-ink-muted" : r >= 0 ? "text-gain" : "text-loss"}`}>{r === null ? "—" : Number(m.regles) < 5 ? "trop peu" : `${r >= 0 ? "+" : "−"}${Math.abs(r * 100).toFixed(0).replace(".", ",")} %`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-ink-muted">Sous 5 pronos sur un marché, le rendement n’est pas affiché : il ne voudrait rien dire.</p>
        </section>
      )}

      {s.type !== "modele_betwise" && (
        <Link href={`/sources/${id}/prono`} className="mt-4 block rounded-lg bg-inverse py-3 text-center text-base font-medium text-on-inverse">+ Enregistrer un prono de cette source</Link>
      )}

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold">Historique des pronos</h2>
        {(preds ?? []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-surface p-5 text-center text-sm text-slate-600">Aucun prono enregistré. Rien ne s’efface jamais ici : chaque prono garde son résultat.</p>
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

function avgOdds(points: CumulPoint[]) {
  const odds = points.filter((p) => p.resultat !== "rembourse").map((p) => (p.resultat === "gagne" ? Number(p.gain) + 1 : null)).filter((x): x is number => x !== null);
  // les cotes des pronos perdus ne sont pas dans la série ; approximation par les cotes gagnantes si rien d'autre
  return odds.length ? odds.reduce((a, b) => a + b, 0) / odds.length : 1.8;
}
function compLabel(code: string) {
  return code === "autre" ? "Hors référentiel" : COMPETITIONS[code] ? `${COMPETITIONS[code].drapeau} ${COMPETITIONS[code].court}` : code;
}
