import { Suspense } from "react";
import Link from "next/link";
import { linkOf } from "@/lib/sources/link";
import { PageHeader } from "@/components/page-header";
import { Card, Empty } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { NIVEAU, SEUIL, classer, lire, niveau, raison, rendement, resume, reussite, type Proof } from "@/lib/sources/proof";
import { labelType } from "./source-ui";
import { AXE_FR, bilanDe, forcesEtFaiblesses, type Prono } from "@/lib/sources/analyse";
import { COMP_SHORT, shortName } from "@/components/match-ui";
import { consensus, estBetwise, estIA, pointDuJour, regrouper, type Candidat } from "@/lib/sources/consensus";
import { loadSignals, pariDe, pickLabel, releveFrais } from "@/lib/probs/signals";
import { loadRecit } from "@/lib/matches/recit";

export const dynamic = "force-dynamic";

// Refonte du 23/11 (Mounir + conseil d'IA) : « Aujourd'hui » d'abord, puis mes sources ; « À découvrir » replié en bas de mes sources.
const VUES = [["aujourdhui", "Aujourd’hui"], ["suivies", "Mes sources"], ["classement", "Classement"], ["analyse", "Analyse"]] as const;
const pc = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);
const unit = (x: number | null) => (x === null ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(0)} %`);

/** Sources : celles que je suis, leur classement, et celles que d'autres ont partagées. */
export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const sp = await searchParams;
  const vue = VUES.some(([k]) => k === sp.f) ? sp.f! : sp.f === "decouvrir" ? "suivies" : "aujourdhui";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: follows }, { data: sources }, { data: proofs }] = await Promise.all([
    supabase.from("source_follows").select("source_id").eq("user_id", user!.id),
    supabase.from("sources").select("id, nom, type, visibilite, created_by, created_at, lien, identifiant_externe").order("created_at"),
    supabase.from("source_proof").select("*"),
  ]);
  const followed = new Set((follows ?? []).map((f) => f.source_id));
  const proofOf = new Map((proofs ?? []).map((t) => [t.source_id, lire(t)]));
  const all = (sources ?? []).map((s) => ({ ...s, proof: proofOf.get(s.id) ?? lire(null) }));
  const mine = all.filter((s) => s.type === "perso" && s.created_by === user!.id);
  const model = all.filter((s) => s.type === "modele_betwise");
  const others = all.filter((s) => s.type !== "perso" && s.type !== "modele_betwise");
  // Labo IA ouvert à tous les testeurs (26/11, demande de Mounir) ; la Console reste réservée à l'administrateur
  const ia = others.filter((s) => estIA(s.nom));
  const humaines = others.filter((s) => !estIA(s.nom));
  const suivies = [...mine, ...humaines.filter((s) => followed.has(s.id) || s.created_by === user!.id), ...model];
  const aDecouvrir = humaines.filter((s) => s.visibilite === "partagee" && !followed.has(s.id) && s.created_by !== user!.id);
  const { classees, nonEtablies } = classer(all.filter((s) => s.type !== "perso" || s.created_by === user!.id));

  return (
    <>

      <PageHeader ajout aide="sources" title="Sources" subtitle="Les tipsters, pages et canaux qui t’orientent, et ce que valent leurs pronos."
        action={<Link href="/sources/nouvelle">+ Source</Link>} />
      <nav className="mb-4 flex gap-2 overflow-x-auto" aria-label="Vues des sources">
        {VUES.map(([k, mot]) => (
          <Link key={k} href={k === "aujourdhui" ? "/sources" : `/sources?f=${k}`} scroll={false} aria-current={vue === k ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${vue === k ? "border-inverse bg-inverse text-on-inverse" : "border-line bg-surface text-ink-soft"}`}>{mot}</Link>
        ))}
      </nav>

      {vue === "analyse" && <Analyse sources={suivies.filter((x) => x.type !== "modele_betwise")} />}

      {/* Affiché tout de suite, « Aujourd'hui » arrive ensuite (27/11 : la page attendait ~3 s) */}
      {vue === "aujourdhui" && (
        <Suspense fallback={<div className="space-y-3" aria-busy="true" aria-label="Chargement des pronos du jour">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl border border-line bg-surface" />)}</div>}>
          <Aujourdhui sourceIds={[...humaines.filter((x) => followed.has(x.id) || x.created_by === user!.id), ...ia].map((x) => x.id)} proofOf={proofOf} />
        </Suspense>
      )}

      {vue === "suivies" && (
        <div className="space-y-4">
          {mine.map((s) => (
            <Link key={s.id} href={`/sources/${s.id}`} className="tile flex items-center justify-between gap-3 p-4 active:bg-surface-2">
              <span className="min-w-0"><span className="block text-[15px] font-semibold">Moi</span><span className="block text-xs text-ink-muted">Mes propres choix, notés comme ceux d’une source</span></span>
              <span className="shrink-0 text-sm text-brand">Mon bilan ›</span>
            </Link>
          ))}
          {suivies.filter((x) => x.type !== "perso").length === 0
            ? <Empty titre="Aucune source suivie" action={<Link href="/sources/nouvelle" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-on-fill">Ajouter une source</Link>}>Ajoute un pronostiqueur, une page ou un canal que tu suis : ses pronos seront notés sur leurs vrais résultats.</Empty>
            : <ListeSources titre="Sources suivies" liste={suivies.filter((x) => x.type !== "perso")} />}
          {ia.length > 0 && <ListeSources titre="Labo IA" note="Les 5 tipsters IA : visibles par toi seul, hors classement. Leurs tickets et combinés sont sur leur fiche." liste={ia} />}
          {aDecouvrir.length > 0 && (
            <details className="tile p-0" open={sp.f === "decouvrir"}>
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">À découvrir ({aDecouvrir.length})</summary>
              <ListeSources liste={aDecouvrir} nu />
            </details>
          )}
        </div>
      )}

      {vue === "classement" && (
        <div className="space-y-3">
          <p className="px-1 text-[12px] leading-relaxed text-ink-muted">Tes sources classées sur tous leurs pronos réglés, dès {SEUIL.classement} résultats. Plus tu charges de coupons, plus le classement devient juste.</p>
          {classees.length === 0 ? <Empty titre="Le classement se remplit avec tes coupons" action={<Link href="/import" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-on-fill">Charger un coupon</Link>}>Dès qu’une source a {SEUIL.classement} pronos réglés, elle apparaît ici.</Empty> : (
            <ol className="space-y-2">
              {classees.map((s, i) => <Rang key={s.id} rang={i + 1} id={s.id} nom={s.nom} type={labelType(s.type)} proof={s.proof} />)}
            </ol>
          )}
          {classees.length >= 2 && (
            <Link href={`/sources/comparer?a=${classees[0].id}&b=${classees[1].id}`} className="block rounded-xl border border-brand/40 py-2.5 text-center text-sm font-medium text-brand active:bg-brand-soft">Comparer deux sources</Link>
          )}
          {nonEtablies.length > 0 && (
            <Card className="!p-0">
              <h2 className="px-4 pt-3 text-sm font-semibold">À suivre</h2>
              <p className="px-4 text-[11px] text-ink-muted">Encore peu de résultats. Charge leurs coupons pour les voir entrer au classement.</p>
              <ul className="mt-2 divide-y divide-line">
                {nonEtablies.map((s) => (
                  <li key={s.id}><Link href={`/sources/${s.id}`} className="block px-4 py-2.5 active:bg-surface-2">
                    <span className="block text-sm font-medium">{s.nom}</span>
                    <span className="block text-[12px] text-ink-muted">{raison(s.proof) || `${resume(s.proof)}, encore ${SEUIL.classement - s.proof.prouvesRegles} résultat${SEUIL.classement - s.proof.prouvesRegles > 1 ? "s" : ""} pour être classée`}</span>
                  </Link></li>
                ))}
              </ul>
            </Card>
          )}
          <p className="px-1 text-[11px] leading-relaxed text-ink-muted">Rendement : gain moyen par prono à mise égale, sur les pronos dont la cote est connue. Avec peu de pronos, l’ordre peut encore bouger d’une semaine à l’autre.</p>
        </div>
      )}
    </>
  );
}

function Rang({ rang, id, nom, type, proof }: { rang: number; id: string; nom: string; type: string; proof: Proof }) {
  const r = rendement(proof);
  return (
    <li>
      <Link href={`/sources/${id}`} className="tile flex items-center gap-3 p-3 active:bg-surface-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${rang === 1 ? "bg-draw text-on-fill" : "bg-surface-2 text-ink-soft"}`}>{rang}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-snug">{nom}</span>
          <span className="block text-[11px] text-ink-muted">{type} · {proof.prouvesGagnes} sur {proof.prouvesRegles} · {NIVEAU[niveau(proof)]}</span>
          <span className="mt-0.5 block text-[12px] text-ink-soft">Réussite {pc(reussite(proof))}{proof.attendu !== null ? ` · attendu ${pc(proof.attendu)}` : ""}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`block text-base font-bold tabular-nums ${r === null ? "" : r > 0 ? "text-gain" : r < 0 ? "text-loss" : ""}`}>{unit(r)}</span>
          <span className="block text-[10px] text-ink-muted">{r === null ? "sans cote" : `rendement · ${proof.avecCote} cotes`}</span>
        </span>
      </Link>
    </li>
  );
}

/** Analyse des sources suivies sur plusieurs critères (19/11) : volume, réussite face à l'attendu, rendement, pire série,
 * preuve de publication, puis forces et faiblesses par compétition, marché et niveau de cote. */
async function Analyse({ sources }: { sources: { id: string; nom: string; type: string; proof: Proof }[] }) {
  if (!sources.length) return <Empty titre="Aucune source à analyser" action={<Link href="/sources/nouvelle" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-on-fill">Ajouter une source</Link>}>Suis un tipster, une page ou un canal, puis charge ses captures.</Empty>;
  const db = await createClient();
  const ids = sources.map((x) => x.id);
  // Calcul sur les pronos eux-mêmes : les statistiques par critère en base comptent aussi les pronos pas encore réglés
  const [{ data: met }, { data: pr }] = await Promise.all([
    db.from("source_metrics").select("source_id, pire_serie").eq("periode", "total").in("source_id", ids),
    db.from("predictions").select("source_id, market_code, resultat, cote_annoncee, risque_annonce, risque_calcule, match:matches(competition:competitions(code_externe))").in("source_id", ids).neq("statut", "annule").in("resultat", ["gagne", "perdu"]).limit(5000),
  ]);
  const un = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const pronos: Prono[] = ((pr ?? []) as unknown as { source_id: string; market_code: string; resultat: string; cote_annoncee: number | null; risque_annonce: string | null; risque_calcule: string | null; match: { competition: { code_externe: string | null } | { code_externe: string | null }[] | null } | { competition: { code_externe: string | null } | { code_externe: string | null }[] | null }[] | null }[])
    .map((r) => ({ source_id: r.source_id, marche: r.market_code, competition: un(un(r.match)?.competition ?? null)?.code_externe ?? null, risque: r.risque_calcule, resultat: r.resultat, cote: r.cote_annoncee === null ? null : Number(r.cote_annoncee) }));
  const lignes = sources.map((x) => {
    const b = bilanDe(pronos.filter((p) => p.source_id === x.id));
    return { ...x, b, pire: met?.find((r) => r.source_id === x.id)?.pire_serie ?? null, ...forcesEtFaiblesses(b.lignes, b.taux, COMP_SHORT) };
  }).sort((a, b) => b.b.regles - a.b.regles);
  return (
    <div className="space-y-3">
      <p className="px-1 text-[12px] leading-relaxed text-ink-muted">Chaque source sur tous ses pronos réglés. Une force ou une faiblesse demande au moins 3 résultats sur le critère et un écart d’au moins 10 points avec sa réussite générale.</p>
      {lignes.map((x) => (
        <article key={x.id} className="tile p-3.5">
          <Link href={`/sources/${x.id}`} className="flex items-baseline justify-between gap-2"><span className="text-[15px] font-bold">{x.nom}</span><span className="text-[11px] text-ink-muted">{labelType(x.type)} ›</span></Link>
          {!x.b.regles ? <p className="mt-1 text-[12.5px] text-ink-muted">Pas encore de prono réglé.</p> : (
            <>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <div><dt className="text-ink-muted">Réglés</dt><dd className="text-[15px] font-bold">{x.b.regles}</dd></div>
                <div><dt className="text-ink-muted">Réussite</dt><dd className="text-[15px] font-bold">{pc(x.b.taux)}</dd>{x.proof.attendu !== null && <dd className="text-ink-muted">attendu {pc(x.proof.attendu)}</dd>}</div>
                <div><dt className="text-ink-muted">Rendement</dt><dd className={`text-[15px] font-bold ${x.b.rendement === null ? "" : x.b.rendement >= 0 ? "text-gain" : "text-loss"}`}>{unit(x.b.rendement)}</dd></div>
                <div><dt className="text-ink-muted">Pire série</dt><dd className="font-semibold">{x.pire === null ? "—" : `${x.pire} perdus`}</dd></div>
                <div className="col-span-2"><dt className="text-ink-muted">Publiés avant le match</dt><dd className="font-semibold">{x.proof.prouvesRegles} sur {x.proof.prouvesRegles + x.proof.apresCoupRegles}{x.proof.apresCoupRegles ? ` · ${x.proof.apresCoupRegles} ajoutés après coup` : ""}</dd></div>
              </dl>
              {(x.forces.length > 0 || x.faiblesses.length > 0) ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-gain-soft p-2.5 text-gain-ink"><p className="text-[11px] font-bold">Forces</p>{x.forces.length ? x.forces.map((f) => <p key={f.axe + f.valeur} className="mt-1 text-[12px] leading-snug"><b>{f.libelle}</b> <span className="opacity-80">({AXE_FR[f.axe].toLowerCase()})</span> : {f.gagnes} sur {f.nb}</p>) : <p className="mt-1 text-[12px]">Aucune nette pour l’instant</p>}</div>
                  <div className="rounded-xl bg-loss-soft p-2.5 text-loss-ink"><p className="text-[11px] font-bold">Faiblesses</p>{x.faiblesses.length ? x.faiblesses.map((f) => <p key={f.axe + f.valeur} className="mt-1 text-[12px] leading-snug"><b>{f.libelle}</b> <span className="opacity-80">({AXE_FR[f.axe].toLowerCase()})</span> : {f.gagnes} sur {f.nb}</p>) : <p className="mt-1 text-[12px]">Aucune nette pour l’instant</p>}</div>
                </div>
              ) : <p className="mt-2 text-[12px] text-ink-muted">Pas encore assez de résultats par critère pour dégager une force ou une faiblesse.</p>}
            </>
          )}
        </article>
      ))}
    </div>
  );
}

/** Statut d'une source selon son volume de pronos réglés (hors score exact) : jamais de rendement sous 5 résultats. */
function Statut({ proof }: { proof: Proof }) {
  const n = proof.prouvesRegles, r = rendement(proof);
  return (
    <span className="shrink-0 text-right">
      {n >= 5 && r !== null
        ? <span className={`block text-[15px] font-bold tabular-nums ${r > 0 ? "text-gain" : r < 0 ? "text-loss" : ""}`}>{unit(r)}</span>
        : <span className="block text-[13px] font-semibold text-ink-muted">{n ? `${n} réglé${n > 1 ? "s" : ""}` : "—"}</span>}
      <span className="block text-[10px] text-ink-muted">{n >= SEUIL.classement ? `${n} réglés` : n >= 5 ? `provisoire ${n}/${SEUIL.classement}` : n ? "trop tôt pour juger" : "aucun réglé"}</span>
    </span>
  );
}

function ListeSources({ titre, note, liste, nu }: { titre?: string; note?: string; liste: { id: string; nom: string; type: string; visibilite: string; lien: string | null; identifiant_externe: string | null; proof: Proof }[]; nu?: boolean }) {
  return (
    <section className={nu ? "" : "tile !p-0"}>
      {titre && <h2 className="px-4 pt-3 text-sm font-semibold">{titre}</h2>}
      {note && <p className="px-4 text-[11px] text-ink-muted">{note}</p>}
      <ul className="mt-1 divide-y divide-line">
        {liste.map((s) => (
          <li key={s.id} className="flex items-stretch">
            <Link href={`/sources/${s.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 active:bg-surface-2">
              <span className="min-w-0">
                <span className="block text-sm font-medium">{s.nom}</span>
                <span className="block text-xs text-ink-muted">{labelType(s.type)}{s.visibilite === "partagee" && s.type !== "modele_betwise" ? " · partagée" : ""}</span>
              </span>
              <Statut proof={s.proof} />
            </Link>
            {linkOf(s) && (
              <a href={linkOf(s)!} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir la page de ${s.nom}`} className="flex w-11 shrink-0 items-center justify-center border-l border-line text-brand active:bg-surface-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** « Aujourd'hui » : ce que disent mes sources sur les matchs des 36 prochaines heures, match par match, et la conclusion de Betster. */
async function Aujourdhui({ sourceIds, proofOf }: { sourceIds: string[]; proofOf: Map<string | null, Proof> }) {
  const vide = <Empty titre="Rien de prévu par tes sources" action={<Link href="/import" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-on-fill">Charger des pronos</Link>}>Charge les captures de tes tipsters : leurs pronos des prochaines 36 heures apparaîtront ici, regroupés par match.</Empty>;
  if (!sourceIds.length) return vide;
  const db = await createClient();
  const { data } = await db.from("predictions")
    .select("source_id, market_code, market_param, selection, cote_annoncee, source:sources(nom, type), match:matches!inner(id, kickoff_at, statut, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(code_externe))")
    .in("source_id", sourceIds).neq("statut", "annule")
    .gte("match.kickoff_at", new Date(Date.now() - 2 * 3600_000).toISOString()).lte("match.kickoff_at", new Date(Date.now() + 36 * 3600_000).toISOString()).limit(800);
  type R = { source_id: string; market_code: string; market_param: number | null; selection: string; cote_annoncee: number | null; source: { nom: string; type: string } | null; match: { id: string; kickoff_at: string; statut: string; home: { nom: string } | null; away: { nom: string } | null; competition: { code_externe: string | null } | null } };
  const rows = ((data ?? []) as unknown as R[]).filter((r) => r.match.statut !== "termine" && r.source && r.source.type !== "perso" && r.source.type !== "modele_betwise" && !estBetwise(r.source.nom));
  const parMatch = new Map<string, R[]>();
  for (const r of rows) parMatch.set(r.match.id, [...(parMatch.get(r.match.id) ?? []), r]);
  const tous = [...parMatch.values()].sort((a, b) => new Set(b.map((x) => x.source_id)).size - new Set(a.map((x) => x.source_id)).size).slice(0, 15);
  if (!tous.length) return vide;
  const [recits, signaux] = await Promise.all([
    Promise.all(tous.map((l) => loadRecit(db as never, l[0].match.id, true).catch(() => null))),
    loadSignals(db as never, tous.map((l) => l[0].match.id), { bookmakers: true }).catch(() => new Map()),
  ]);
  // Pour chaque match : les pronos avec ce qui les confirme, et la force du match = le plus de voix derrière un même pari
  const fiches = tous.map((l, k) => {
    const m = l[0].match, home = shortName(m.home?.nom ?? "?"), away = shortName(m.away?.nom ?? "?"), rc = recits[k];
    const avis = l.map((r) => ({ sourceId: r.source_id, nom: r.source!.nom.replace(/ · tipster IA$/, " (IA)"), ia: estIA(r.source!.nom), regles: proofOf.get(r.source_id)?.prouvesRegles ?? 0, market: r.market_code, param: r.market_param === null ? null : Number(r.market_param), sel: r.selection, cote: r.cote_annoncee === null ? null : Number(r.cote_annoncee) }));
    const cs = consensus(avis, rc?.verdict ? { market: rc.verdict.market, param: rc.verdict.param, sel: rc.verdict.sel, label: rc.verdict.label } : null);
    const sg = signaux.get(m.id);
    const lignes = regrouper(cs.lignes).map((g) => {
      const pk = sg ? pariDe(sg, g.avis.market, g.avis.param, g.avis.sel) : null;
      const cote = pk?.book && releveFrais(pk.book.releveAt, m.kickoff_at) ? pk.book.cote : pk?.cote ?? g.avis.cote;
      return { ...g, label: libelle(g.avis.market, g.avis.param, g.avis.sel, home, away), p: pk?.p ?? null, cote };
    }).sort((a, b) => b.voix - a.voix || (b.p ?? 0) - (a.p ?? 0));
    // Ce que les sources jouent surtout, quand Betster n'est pas sur ce pari : dit avant sa conclusion
    const tete = lignes[0];
    const conclusion = tete && tete.voix >= 2 && tete.betster !== "avec" ? `Tes sources jouent surtout « ${tete.label} » (${tete.voix} sources). ${cs.conclusion}` : cs.conclusion;
    return { m, home, away, cs, conclusion, lignes, force: lignes[0]?.voix ?? 0, sources: new Set(l.map((x) => x.source_id)).size };
  }).sort((a, b) => b.force - a.force || b.sources - a.sources || Date.parse(a.m.kickoff_at) - Date.parse(b.m.kickoff_at));
  // Le point de Betster : un pari par prono distinct (le même pari de plusieurs sources ne compte qu'une fois)
  const candidats: Candidat[] = fiches.flatMap((f) => f.lignes.map((x) => ({ matchId: f.m.id, match: `${f.home} – ${f.away}`, label: x.label, voix: x.voix, qui: [...x.qui, ...x.compatibles], p: x.p, cote: x.cote })));
  const point = pointDuJour(candidats);
  const pct = (p: number | null) => (p === null ? "" : `${Math.round(p * 100)} %`);
  const co = (c: number | null) => (c ? c.toFixed(2).replace(".", ",") : "—");
  return (
    <div className="space-y-3">
      <p className="px-1 text-[12px] leading-relaxed text-ink-muted">Les pronos de tes sources sur les 36 prochaines heures. « Pour » : les autres sources qui jouent le même pari ou un pari qui l’entraîne. Un accord n’est pas une certitude.</p>
      <section className="rounded-2xl bg-pitch p-4 text-white" aria-label="Le point de Betster">
        <h2 className="text-[15px] font-bold">Le point de Betster</h2>
        {point.simples.length === 0
          ? <p className="mt-1.5 text-[13px] leading-snug text-white/80">Aucun pari n’est encore porté par au moins deux sources. Charge d’autres coupons : dès que deux sources se rejoignent sur un pari, je le retiens ici.</p>
          : <>
            <p className="mt-1 text-[12px] text-white/70">Les paris sur lesquels tes sources se rejoignent le plus, avec la chance calculée par BETWISE.</p>
            <ol className="mt-2.5 space-y-2">
              {point.simples.map((x) => (
                <li key={x.matchId + x.label} className="rounded-xl bg-white/10 p-2.5">
                  <div className="flex items-baseline justify-between gap-2"><span className="text-[14px] font-semibold">{x.label}</span><span className="shrink-0 text-[12px] tabular-nums text-white/80">{pct(x.p)}{x.cote ? ` · ${co(x.cote)}` : ""}</span></div>
                  <p className="mt-0.5 text-[11.5px] text-white/70">{x.match} · {x.voix} sources : {x.qui.slice(0, 4).join(", ")}{x.qui.length > 4 ? "…" : ""}</p>
                </li>
              ))}
            </ol>
            {point.combine && (
              <div className="mt-3 rounded-xl border border-white/25 p-2.5">
                <p className="text-[13px] font-semibold">Combiné retenu · cote {co(point.combine.cote)}</p>
                <ul className="mt-1 text-[12.5px] text-white/85">{point.combine.selections.map((x) => <li key={x.matchId}>{x.label} <span className="text-white/60">({x.match})</span></li>)}</ul>
                <p className="mt-1 text-[11.5px] text-white/70">Chance d’ensemble environ {pct(point.combine.p)}, si les matchs ne dépendent pas l’un de l’autre. Un combiné perd dès qu’une sélection perd.</p>
              </div>
            )}
          </>}
        <p className="mt-2.5 text-[11px] text-white/60">Un accord entre sources n’est pas une certitude. Les tipsters IA comptent ensemble pour une seule voix.</p>
      </section>
      {fiches.map(({ m, home, away, conclusion, lignes }) => {
        return (
          <article key={m.id} className="tile p-3.5">
            <Link href={`/matchs/${m.id}?t=sources`} className="flex items-baseline justify-between gap-2">
              <span className="text-[15px] font-bold">{home} – {away}</span>
              <span className="shrink-0 text-[11px] text-ink-muted">{new Date(m.kickoff_at).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })}{m.competition?.code_externe && COMP_SHORT[m.competition.code_externe] ? ` · ${COMP_SHORT[m.competition.code_externe]}` : ""}</span>
            </Link>
            <ul className="mt-2 divide-y divide-line text-[13px]">
              {lignes.slice(0, 4).map((x) => (
                <li key={x.label} className="py-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 font-medium">{x.label}{x.p !== null ? <span className="ml-1.5 text-[11px] font-normal text-ink-muted">{Math.round(x.p * 100)} %</span> : null}</span>
                    <span className="flex shrink-0 gap-1 text-[11px] font-semibold">
                      <span className={`rounded-full px-2 py-0.5 ${x.voix >= 2 ? "bg-gain-soft text-gain-ink" : "bg-surface-2 text-ink-muted"}`}>{x.voix} source{x.voix > 1 ? "s" : ""}</span>
                      {x.contre.length > 0 && <span className="rounded-full bg-loss-soft px-2 py-0.5 text-loss-ink">{x.contre.length} contre</span>}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{x.qui.slice(0, 3).join(", ")}{x.qui.length > 3 ? ` et ${x.qui.length - 3} autre${x.qui.length - 3 > 1 ? "s" : ""}` : ""}{x.compatibles.length ? ` · aussi par un pari compatible : ${x.compatibles.slice(0, 3).join(", ")}` : ""}{x.betster === "avec" ? " · Betster d’accord" : x.betster === "contre" ? " · Betster pense l’inverse" : ""}</p>
                </li>
              ))}
            </ul>
            {lignes.length > 4 && <p className="text-[11px] text-ink-muted">+ {lignes.length - 4} autre{lignes.length - 4 > 1 ? "s" : ""}</p>}
            <p className="mt-2 rounded-lg bg-surface-2 p-2.5 text-[12.5px] leading-snug"><b>Betster :</b> {conclusion}</p>
            <Link href={`/matchs/${m.id}?t=sources`} className="mt-2 block text-right text-[12px] font-medium text-brand">Tout le détail ›</Link>
          </article>
        );
      })}
    </div>
  );
}

/** Libellé d'un pari pour cette page : « Victoire Real Madrid » plutôt que le seul nom de l'équipe (24/11). */
function libelle(market: string, param: number | null, sel: string, home: string, away: string): string {
  if (market === "1X2" && (sel === "1" || sel === "2")) return `Victoire ${sel === "1" ? home : away}`;
  if (market === "1X2" && sel === "N") return "Match nul";
  return pickLabel(market, param, sel, home, away);
}
