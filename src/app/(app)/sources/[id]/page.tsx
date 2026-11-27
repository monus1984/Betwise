import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { labelType, MARCHE_FR } from "../source-ui";
import { COMPETITIONS } from "@/lib/competitions";
import { NIVEAU, lire, niveau, raison, rendement, reussite } from "@/lib/sources/proof";
import { FollowButton, PredictionRow, SourceLink } from "./client";
import { GererSource } from "./gerer-source";
import { linkOf } from "@/lib/sources/link";
import { CumulChart, type CumulPoint } from "./cumul-chart";
import { bilanMoi, type BilanMoi, type Ligne, type SelMoi } from "@/lib/sources/moi";
import { SEUIL } from "@/lib/sources/proof";
import { createAdminClient } from "@/lib/supabase/admin";
import { estIA } from "@/lib/sources/consensus";
import { pickLabel } from "@/lib/probs/signals";

export const dynamic = "force-dynamic";

type Named = { nom: string } | { nom: string }[] | null;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function SourcePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ existante?: string; ajout?: string; doublon?: string; p?: string; m?: string }> }) {
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

  const { data: marches } = await supabase.from("markets").select("code, libelle_fr, a_parametre").order("code");
  const { data: preds } = await supabase
    .from("predictions")
    .select("id, match_libre, market_code, market_param, selection, cote_annoncee, risque_annonce, risque_calcule, statut, resultat, logged_at, published_at, submitted_by, match:matches(id, kickoff_at, score_home, score_away, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom))")
    .eq("source_id", id)
    // Rubrique Score exact (23/11) : à part de l'historique principal
    .filter("market_code", sp.m === "cs" ? "eq" : "neq", "CS")
    .order("logged_at", { ascending: false })
    .limit(60);

  const isSystem = s.type === "modele_betwise" || s.type === "perso";
  const gerable = !isSystem && s.created_by === user!.id;
  const [{ count: nbPronos }, { data: autresSrc }] = gerable ? await Promise.all([
    supabase.from("predictions").select("id", { count: "exact", head: true }).eq("source_id", id),
    supabase.from("sources").select("id, nom").eq("created_by", user!.id).not("type", "in", "(perso,modele_betwise)").neq("id", id).order("nom"),
  ]) : [{ count: 0 }, { data: [] as { id: string; nom: string }[] }];

  // Tipster IA (23/11) : ses tickets réels, simples et combinés, dans sa bankroll ; visibles par tous les testeurs depuis le 26/11
  let tickets: Ticket[] | null = null;
  if (estIA(s.nom)) {
    const court = s.nom.replace(/ · tipster IA$/, "");
    const { data } = await createAdminClient().from("bets").select("id, type, statut, mise, gain_net, cote_totale, placed_at, bet_selections(market_code, market_param, selection, cote, resultat, match:matches(kickoff_at, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom)))")
      .like("raw_text", `[tipster IA ${court}]%`).neq("statut", "annule").order("placed_at", { ascending: false }).limit(300);
    tickets = (data ?? []) as unknown as Ticket[];
  }

  // « Moi » (23/11) : mes propres choix notés comme une source, à partir de mes paris réels
  let moi: { b: BilanMoi; mieux: number; classees: number } | null = null;
  if (s.type === "perso" && s.created_by === user!.id) {
    const [{ data: sels }, { data: tous }] = await Promise.all([
      supabase.from("bet_selections").select("resultat, cote, market_code, bet:bets!inner(type, placed_at, virtuel, statut)").eq("origin_source_id", id).eq("bet.virtuel", false).neq("bet.statut", "annule").limit(5000),
      supabase.from("source_proof").select("*"),
    ]);
    type R = { resultat: string | null; cote: number; market_code: string; bet: { type: string; placed_at: string } | { type: string; placed_at: string }[] | null };
    const lignes: SelMoi[] = ((sels ?? []) as unknown as R[]).map((x) => { const b = one(x.bet); return { resultat: x.resultat, cote: Number(x.cote), market: x.market_code, placedAt: b?.placed_at ?? "", combine: b?.type === "combine" }; });
    const b = bilanMoi(lignes);
    const autres = (tous ?? []).filter((t) => t.source_id !== id).map((t) => lire(t)).filter((p) => p.prouvesRegles >= SEUIL.classement && rendement(p) !== null);
    moi = { b, classees: autres.length, mieux: b.rendement === null ? 0 : autres.filter((p) => rendement(p)! > b.rendement!).length };
  }

  return (
    <>
      <Link href="/sources" className="mb-3 inline-block text-sm text-slate-600">‹ Sources</Link>
      <PageHeader
        title={s.nom}
        subtitle={`${labelType(s.type)}${s.identifiant_externe ? ` · ${s.identifiant_externe}` : ""}${s.visibilite === "partagee" && !isSystem ? " · partagée" : ""}`}
        action={!isSystem ? <FollowButton sourceId={id} following={!!f} /> : undefined}
      />
      {!isSystem && <Link href={`/import?source=${id}`} className="mt-3 flex items-center justify-center rounded-xl border border-line bg-surface py-2.5 text-[13px] font-medium">Charger un ticket de cette source</Link>}
      {!isSystem && <SourceLink sourceId={id} type={s.type} url={linkOf(s)} saved={!!s.lien} canEdit={s.created_by === user!.id || (s.visibilite === "partagee" && !s.lien)} />}
      {gerable && <GererSource id={id} nom={s.nom} type={s.type} visibilite={s.visibilite as "privee" | "partagee"} pronos={nbPronos ?? 0} autres={(autresSrc ?? []).filter((x) => !estIA(x.nom))} />}
      {sp.existante && <p className="mb-4 rounded-lg border border-info/30 bg-info-soft p-3 text-sm text-info-ink">Cette source existait déjà en partagé : tu la suis maintenant, son historique est commun.</p>}
      {sp.ajout && !sp.doublon && <p className="mb-4 rounded-lg border border-gain/30 bg-gain-soft p-3 text-sm text-gain-ink">Prono enregistré.</p>}
      {sp.doublon && <p className="mb-4 rounded-lg border border-draw/40 bg-draw-soft p-3 text-sm text-draw-ink">Ce prono existait déjà pour cette source (même match, marché et sélection le même jour) : rien n’a été ajouté.</p>}

      {moi && <MoiTipster {...moi} />}
      {tickets && <TicketsIA tickets={tickets} />}
      {!moi && (<>
      <section className="rounded-2xl bg-pitch p-5 text-white">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-medium text-white/70">Ses pronos</p>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{NIVEAU[nv]}</span>
        </div>
        {/* Fiche en 5 secondes (conseil d'IA, 23/11) : le rendement d'abord, avec le volume ; rien sous 5 résultats */}
        {nv !== "non_etabli" && proof.prouvesRegles >= 5 && rdt !== null && <p className={`mt-1 text-4xl font-bold tabular-nums ${rdt >= 0 ? "text-band-gain" : "text-band-loss"}`}>{rdt >= 0 ? "+" : "−"}{Math.abs(rdt * 100).toFixed(0)} %<span className="ml-2 align-middle text-[12px] font-medium text-white/70">de rendement à mise égale</span></p>}
        <p className={`mt-1 tabular-nums ${proof.prouvesRegles >= 5 && rdt !== null ? "text-base font-semibold" : "text-3xl font-bold"}`}>{nv === "non_etabli" ? (proof.prouves ? "En attente" : "À suivre") : `${proof.prouvesGagnes} juste${proof.prouvesGagnes > 1 ? "s" : ""} sur ${proof.prouvesRegles}${proof.prouvesRegles < 5 ? " : trop tôt pour juger" : ""}`}</p>
        {nv === "non_etabli" ? (
          <p className="mt-1 text-[13px] leading-snug text-white/75">{raison(proof)}</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-[11px] text-white/60">Réussite</p><p className="font-semibold tabular-nums">{reu === null ? "—" : `${Math.round(reu * 100)} %`}</p></div>
            <div><p className="text-[11px] text-white/60">Attendu</p><p className="font-semibold tabular-nums">{proof.attendu === null ? "—" : `${Math.round(proof.attendu * 100)} %`}</p></div>
            <div><p className="text-[11px] text-white/60">Avant le match</p><p className="font-semibold tabular-nums">{proof.prouves ? `${Math.round(((proof.prouves - proof.apresCoup) / proof.prouves) * 100)} %` : "—"}</p></div>
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

      </>)}

      {s.type !== "modele_betwise" && !moi && (
        <Link href={`/sources/${id}/prono`} className="mt-4 block rounded-lg bg-inverse py-3 text-center text-base font-medium text-on-inverse">+ Enregistrer un prono de cette source</Link>
      )}

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{sp.m === "cs" ? "Scores exacts" : "Historique des pronos"}</h2>
          <nav className="flex gap-1.5" aria-label="Rubriques des pronos">
            <Link href={`/sources/${id}`} scroll={false} aria-current={sp.m !== "cs" ? "page" : undefined} className={`rounded-full px-3 py-1 text-xs ${sp.m !== "cs" ? "bg-inverse text-on-inverse" : "border border-line bg-surface text-ink-soft"}`}>Pronos</Link>
            <Link href={`/sources/${id}?m=cs`} scroll={false} aria-current={sp.m === "cs" ? "page" : undefined} className={`rounded-full px-3 py-1 text-xs ${sp.m === "cs" ? "bg-inverse text-on-inverse" : "border border-line bg-surface text-ink-soft"}`}>Score exact{proof.csRegles ? ` · ${proof.csGagnes} sur ${proof.csRegles}` : ""}</Link>
          </nav>
        </div>
        {sp.m === "cs" && <p className="mb-2 text-[11px] leading-snug text-ink-muted">Les scores exacts réussissent rarement : ils sont comptés à part et n’entrent pas dans le rendement affiché en haut.{proof.csRegles ? ` Ici : ${proof.csGagnes} juste${(proof.csGagnes ?? 0) > 1 ? "s" : ""} sur ${proof.csRegles}, ${(proof.csUnites ?? 0) >= 0 ? "+" : "−"}${Math.abs(proof.csUnites ?? 0).toFixed(1).replace(".", ",")} unité${Math.abs(proof.csUnites ?? 0) >= 2 ? "s" : ""} à mise égale.` : ""}</p>}
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
                    risque: p.risque_calcule as "prudent" | "moyen" | "risque" | null,
                    statut: p.statut,
                    resultat: p.resultat,
                    loggedAt: p.logged_at,
                    mine: p.submitted_by === user!.id,
                    home: m ? one(m.home)?.nom ?? null : null, away: m ? one(m.away)?.nom ?? null : null,
                  }}
                  markets={marches ?? []}
                />
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

type Ticket = { id: string; type: string; statut: string; mise: number; gain_net: number | null; cote_totale: number | null; placed_at: string;
  bet_selections: { market_code: string; market_param: number | null; selection: string; cote: number; resultat: string | null; match: { kickoff_at: string | null; home: { nom: string } | null; away: { nom: string } | null } | null }[] };
const BANKROLL_DEPART = 100_000;
const fcfa = (x: number) => `${Math.round(x).toLocaleString("fr-FR")} F`;
const RES: Record<string, string> = { gagne: "Gagné", perdu: "Perdu", rembourse: "Remboursé", en_cours: "En cours", cashout: "Cash-out" };

/** Les tickets d'un tipster IA : simples et combinés, et sa bankroll virtuelle (départ 100 000 F). */
function TicketsIA({ tickets }: { tickets: Ticket[] }) {
  const regles = tickets.filter((t) => t.statut !== "en_cours" && t.gain_net !== null);
  const net = regles.reduce((x, t) => x + Number(t.gain_net), 0);
  const enJeu = tickets.filter((t) => t.statut === "en_cours").reduce((x, t) => x + Number(t.mise), 0);
  const mises = regles.reduce((x, t) => x + Number(t.mise), 0);
  const combines = tickets.filter((t) => t.type === "combine");
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold">Ses tickets</h2>
      <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
        <div><p className="text-[11px] text-ink-muted">Bankroll</p><p className="font-semibold tabular-nums">{fcfa(BANKROLL_DEPART + net)}</p></div>
        <div><p className="text-[11px] text-ink-muted">En jeu</p><p className="font-semibold tabular-nums">{fcfa(enJeu)}</p></div>
        <div><p className="text-[11px] text-ink-muted">Rendement</p><p className={`font-semibold tabular-nums ${!mises ? "" : net >= 0 ? "text-gain" : "text-loss"}`}>{mises ? `${net >= 0 ? "+" : "−"}${Math.abs((net / mises) * 100).toFixed(0)} %` : "—"}</p></div>
      </div>
      <p className="mt-1.5 text-[11px] text-ink-muted">{tickets.length} ticket{tickets.length > 1 ? "s" : ""}, dont {combines.length} combiné{combines.length > 1 ? "s" : ""} ; {regles.length} réglé{regles.length > 1 ? "s" : ""}. Départ : {fcfa(BANKROLL_DEPART)} virtuels. Visible par toi seul.</p>
      <ul className="mt-3 divide-y divide-line">
        {tickets.slice(0, 40).map((t) => (
          <li key={t.id} className="py-2">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium">{t.type === "combine" ? `Combiné de ${t.bet_selections.length}` : "Simple"} · cote {Number(t.cote_totale ?? 0).toFixed(2).replace(".", ",")} · {fcfa(Number(t.mise))}</span>
              <span className={`shrink-0 text-[12px] ${t.statut === "gagne" ? "text-gain" : t.statut === "perdu" ? "text-loss" : "text-ink-muted"}`}>{RES[t.statut] ?? t.statut}{t.gain_net !== null && t.statut !== "en_cours" ? ` (${Number(t.gain_net) >= 0 ? "+" : "−"}${fcfa(Math.abs(Number(t.gain_net)))})` : ""}</span>
            </div>
            <ul className="mt-0.5 space-y-0.5">
              {t.bet_selections.map((x, i) => {
                const h = x.match?.home?.nom ?? "?", a = x.match?.away?.nom ?? "?";
                // Équipes bien visibles et heure du match (27/11)
                const k = x.match?.kickoff_at ? new Date(x.match.kickoff_at).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }) : null;
                return (
                  <li key={i} className="pt-1">
                    <p className="text-[14px] font-semibold leading-snug">{h} – {a}{k && <span className="ml-1.5 whitespace-nowrap text-[12px] font-normal text-ink-muted">{k}</span>}</p>
                    <p className="text-[12.5px] text-ink-soft">{pickLabel(x.market_code, x.market_param === null ? null : Number(x.market_param), x.selection, h, a)} @ {Number(x.cote).toFixed(2).replace(".", ",")}{x.resultat && x.resultat !== "en_attente" ? ` · ${RES[x.resultat] ?? x.resultat}` : ""}</p>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-ink-muted">{new Date(t.placed_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);
const rdtTxt = (x: number | null) => (x === null ? "—" : `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(0)} %`);

/** Mon tableau de bord de tipster : mes choix, notés comme ceux d'une source (mise fixe d'une unité par sélection). */
function MoiTipster({ b, mieux, classees }: { b: BilanMoi; mieux: number; classees: number }) {
  if (!b.regles) return (
    <section className="rounded-2xl border border-line bg-surface p-5 text-sm text-ink-soft">
      Aucun de tes choix n’est encore réglé. Quand tu indiques « Moi » comme origine d’une sélection, elle est notée ici comme le prono d’une source.
    </section>
  );
  const Tab = ({ titre, l, nom }: { titre: string; l: Ligne[]; nom?: (k: string) => string }) => (
    <section className="mt-3 rounded-xl border border-line bg-surface p-4">
      <h2 className="mb-2 text-sm font-semibold">{titre}</h2>
      <table className="w-full text-[13px]">
        <thead><tr className="text-left text-[11px] text-ink-muted"><th className="py-1 font-medium"></th><th className="py-1 text-right font-medium">Justes</th><th className="py-1 text-right font-medium">Réussite</th><th className="py-1 text-right font-medium">Attendu</th><th className="py-1 text-right font-medium">Rendement</th></tr></thead>
        <tbody className="divide-y divide-line">
          {l.map((x) => (
            <tr key={x.cle}>
              <td className="py-1.5">{nom ? nom(x.cle) : x.cle}</td>
              <td className="py-1.5 text-right tabular-nums">{x.justes} sur {x.regles}</td>
              <td className="py-1.5 text-right tabular-nums">{pct(x.reussite)}</td>
              <td className="py-1.5 text-right tabular-nums text-ink-muted">{pct(x.attendu)}</td>
              <td className={`py-1.5 text-right tabular-nums ${x.regles < 5 || x.rendement === null ? "text-ink-muted" : x.rendement >= 0 ? "text-gain" : "text-loss"}`}>{x.regles < 5 ? "trop peu" : rdtTxt(x.rendement)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
  const ecart = b.reussite !== null && b.attendu !== null ? b.reussite - b.attendu : null;
  return (
    <>
      <section className="rounded-2xl bg-pitch p-5 text-white">
        <p className="text-xs font-medium text-white/70">Mes choix de tipster</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{b.justes} juste{b.justes > 1 ? "s" : ""} sur {b.regles}</p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div><p className="text-[11px] text-white/60">Réussite</p><p className="font-semibold tabular-nums">{pct(b.reussite)}</p></div>
          <div><p className="text-[11px] text-white/60">Attendu</p><p className="font-semibold tabular-nums">{pct(b.attendu)}</p></div>
          <div><p className="text-[11px] text-white/60">Rendement</p><p className={`font-semibold tabular-nums ${b.rendement === null ? "" : b.rendement >= 0 ? "text-band-gain" : "text-band-loss"}`}>{rdtTxt(b.rendement)}</p></div>
        </div>
        <p className="mt-3 text-[12px] leading-snug text-white/80">
          {ecart === null ? "" : Math.abs(ecart) < 0.02 ? "Tu fais à peu près ce que les cotes annonçaient. " : ecart > 0 ? `Tu fais ${Math.round(ecart * 100)} points de mieux que ce que les cotes annonçaient. ` : `Tu fais ${Math.round(-ecart * 100)} points de moins que ce que les cotes annonçaient. `}
          {classees > 0 && b.regles >= SEUIL.classement ? (mieux === 0 ? `Aucune de tes ${classees} sources classées ne fait mieux en rendement.` : `${mieux} de tes ${classees} sources classées font mieux en rendement.`) : b.regles < SEUIL.classement ? `Encore ${SEUIL.classement - b.regles} choix réglés pour te comparer aux sources classées.` : ""}
        </p>
        <p className="mt-2 text-[11px] text-white/60">Chaque sélection que tu as choisie toi-même compte comme un prono à mise égale, en simple comme dans un combiné : la même règle que pour tes sources. Paris réels seulement.{b.enCours ? ` ${b.enCours} en cours.` : ""}</p>
      </section>
      <Tab titre="Simples ou dans un combiné" l={[b.simples, b.dansCombines, b.trenteJours].filter((l) => l.regles > 0)} nom={(k) => (k === "simples" ? "En simple" : k === "combinés" ? "Dans un combiné" : "Ces 30 derniers jours")} />
      {b.parNiveau.length > 0 && <Tab titre="Par niveau de cote" l={b.parNiveau} />}
      {b.parMarche.length > 0 && <Tab titre="Par marché" l={b.parMarche} nom={(k) => MARCHE_FR[k] ?? k} />}
      <Link href="/bilan" className="mt-3 block rounded-xl border border-brand/40 py-2.5 text-center text-sm font-medium text-brand">Mon bilan en argent (mises et gains)</Link>
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
