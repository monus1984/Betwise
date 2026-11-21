import Link from "next/link";
import { ParisNav } from "@/components/coach-nav";
import { linkOf } from "@/lib/sources/link";
import { PageHeader } from "@/components/page-header";
import { Card, Empty } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { NIVEAU, SEUIL, classer, lire, niveau, raison, rendement, resume, reussite, type Proof } from "@/lib/sources/proof";
import { labelType, ProofBadge } from "./source-ui";
import { AXE_FR, bilanDe, forcesEtFaiblesses, type Prono } from "@/lib/sources/analyse";
import { COMP_SHORT } from "@/components/match-ui";

export const dynamic = "force-dynamic";

const VUES = [["suivies", "Mes sources"], ["analyse", "Analyse"], ["classement", "Classement"], ["decouvrir", "Découvrir"]] as const;
const pc = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);
const unit = (x: number | null) => (x === null ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(0)} %`);

/** Sources : celles que je suis, leur classement, et celles que d'autres ont partagées. */
export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const sp = await searchParams;
  const vue = VUES.some(([k]) => k === sp.f) ? sp.f! : "suivies";
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
  const suivies = [...mine, ...others.filter((s) => followed.has(s.id) || s.created_by === user!.id), ...model];
  const aDecouvrir = others.filter((s) => s.visibilite === "partagee" && !followed.has(s.id) && s.created_by !== user!.id);
  const { classees, nonEtablies } = classer(all.filter((s) => s.type !== "perso" || s.created_by === user!.id));

  return (
    <>
      <ParisNav current="sources" />
      <PageHeader aide="sources" title="Sources" subtitle="Les tipsters, pages et canaux qui t’orientent, et ce que valent leurs pronos."
        action={<Link href="/sources/nouvelle">+ Source</Link>} />
      <nav className="mb-4 flex gap-2 overflow-x-auto" aria-label="Vues des sources">
        {VUES.map(([k, mot]) => (
          <Link key={k} href={k === "suivies" ? "/sources" : `/sources?f=${k}`} scroll={false} aria-current={vue === k ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${vue === k ? "border-inverse bg-inverse text-on-inverse" : "border-line bg-surface text-ink-soft"}`}>{mot}</Link>
        ))}
      </nav>

      {vue === "analyse" && <Analyse sources={suivies.filter((x) => x.type !== "modele_betwise")} />}

      {vue !== "classement" && vue !== "analyse" && (() => {
        const list = vue === "suivies" ? suivies : aDecouvrir;
        if (list.length === 0) return <Empty titre={vue === "suivies" ? "Aucune source suivie" : "Rien à découvrir pour l’instant"} action={vue === "suivies" ? <Link href="/sources/nouvelle" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-on-fill">Ajouter une source</Link> : undefined}>{vue === "suivies" ? "Ajoute un pronostiqueur, une page ou un canal que tu suis : ses pronos seront notés sur leurs vrais résultats." : "Les sources partagées par d’autres testeurs apparaîtront ici."}</Empty>;
        return (
          <Card className="!p-0">
            <ul className="divide-y divide-line">
              {list.map((s) => (
                <li key={s.id} className="flex items-stretch">
                  <Link href={`/sources/${s.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 active:bg-surface-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{s.nom}</span>
                      <span className="block text-xs text-ink-muted">{labelType(s.type)}{s.visibilite === "partagee" && s.type !== "modele_betwise" ? " · partagée" : ""}</span>
                    </span>
                    <ProofBadge proof={s.proof} />
                  </Link>
                  {linkOf(s) && (
                    <a href={linkOf(s)!} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir la page de ${s.nom}`} className="flex w-11 shrink-0 items-center justify-center border-l border-line text-brand active:bg-surface-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        );
      })()}

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
          <span className="block truncate text-sm font-semibold">{nom}</span>
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
    .map((r) => ({ source_id: r.source_id, marche: r.market_code, competition: un(un(r.match)?.competition ?? null)?.code_externe ?? null, risque: r.risque_annonce ?? r.risque_calcule, resultat: r.resultat, cote: r.cote_annoncee === null ? null : Number(r.cote_annoncee) }));
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
