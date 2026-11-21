/**
 * Tableau de bord du Coach (19/11) : la synthèse de l'abonné en un écran.
 * Où en est sa bankroll, ce qui attend une action, son budget, ses habitudes (discipline), ses points forts.
 * Tous les chiffres viennent de ses paris réels (les tests sont à part). Montants masquables.
 */
import Link from "next/link";
import { CoachNav } from "@/components/coach-nav";
import { PageHeader } from "@/components/page-header";
import { Sparkline } from "@/components/sparkline";
import { fcfa } from "@/components/ui";
import { BoutonMasque, Montant } from "@/components/montant";
import { loadDashboard } from "@/lib/stats/dashboard";
import { vigilance } from "@/lib/stats/vigilance";
import { etatBudget } from "@/lib/coach/budget";
import { loadForces } from "@/lib/coach/today";
import type { createClient } from "@/lib/supabase/server";
import { BudgetCard } from "./budget-card";

type Db = Awaited<ReturnType<typeof createClient>>;
const pct = (x: number | null, signe = false) => (x === null ? "—" : `${signe && x > 0 ? "+" : ""}${Math.round(x * 100)} %`);
const signe = (x: number) => `${x > 0 ? "+" : ""}${fcfa(x)}`;
const JOUR = 86400000;

export async function TableauDeBord({ db, userId }: { db: Db; userId: string }) {
  const [{ data: summary }, d, { data: enCours }, { data: recents }, { data: bud }, fortes] = await Promise.all([
    db.from("my_bankroll_summary").select("*").maybeSingle(),
    loadDashboard(db, null),
    db.from("bets").select("id, resultat_propose").eq("statut", "en_cours").eq("virtuel", false).limit(500),
    db.from("bets").select("mise, statut, gain_net, placed_at, settled_at, nb_selections").eq("virtuel", false).neq("statut", "annule").order("placed_at", { ascending: false }).limit(60),
    db.from("budgets").select("mise_semaine, perte_max_semaine").maybeSingle(),
    loadForces(db, userId),
  ]);
  const solde = Number(summary?.solde ?? 0), exposition = Number(summary?.exposition ?? 0);
  const paris = (recents ?? []).map((b) => ({ mise: Number(b.mise), statut: b.statut, gain_net: b.gain_net === null ? null : Number(b.gain_net), placed_at: b.placed_at, settled_at: b.settled_at, nb_selections: b.nb_selections }));
  const budget = bud ? { miseSemaine: Number(bud.mise_semaine), perteMaxSemaine: Number(bud.perte_max_semaine) } : null;
  const etat = budget ? etatBudget(budget, paris) : null;
  const alertes = vigilance(paris, solde);
  const aConfirmer = (enCours ?? []).filter((b) => b.resultat_propose && b.resultat_propose !== "en_attente").length;
  const sept = d.courbe.filter((x) => Date.now() - Date.parse(x.at) <= 7 * JOUR).reduce((t, x) => t + x.net, 0);
  const vide = d.regles === 0 && d.enCours === 0;
  const dis = d.discipline;

  return (
    <>
      <PageHeader aide="coach" title="Coach" subtitle="Ta situation en un coup d’œil. Pour une question, touche Betster en bas de l’écran." />
      <CoachNav current="tableau" />

      {vide ? (
        <section className="tile p-4">
          <h2 className="text-[17px] font-bold">Ton tableau de bord se remplit avec tes paris</h2>
          <p className="mt-1 text-[13px] leading-snug text-ink-soft">Importe un ticket ou saisis un pari : ta bankroll, ton rendement, tes habitudes et tes points forts apparaîtront ici.</p>
          <Link href="/paris/ajouter" className="mt-3 flex h-11 items-center justify-center rounded-xl bg-brand text-[13.5px] font-bold text-on-fill">Ajouter un pari</Link>
        </section>
      ) : (
        <>
          {/* 1. Bankroll */}
          <section aria-label="Bankroll" className="card-hero rounded-[22px] p-4">
            <div className="flex items-start justify-between gap-3">
              <Link href="/bankroll" className="min-w-0">
                <span className="block text-[12px] text-ink-soft">Ta bankroll</span>
                <Montant texte={fcfa(solde)} className="block text-[32px] font-extrabold leading-tight tabular-nums" />
                <span className={`block text-[12px] font-semibold ${sept > 0 ? "text-gain" : sept < 0 ? "text-loss" : "text-ink-soft"}`}><Montant texte={signe(sept)} /> sur 7 jours</span>
              </Link>
              <div className="flex flex-col items-end gap-1"><BoutonMasque /><Sparkline values={[0, ...d.courbe.map((x) => x.cumul)].slice(-30)} className="h-10 w-28" label="Tendance des gains moins pertes" /></div>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <div><dt className="text-ink-soft">En jeu</dt><dd className="text-[15px] font-bold"><Montant texte={fcfa(exposition)} /></dd></div>
              <div><dt className="text-ink-soft">Rendement</dt><dd className={`text-[15px] font-bold ${d.rendement !== null && d.rendement < 0 ? "text-loss" : "text-gain"}`}>{pct(d.rendement, true)}</dd></div>
              <div><dt className="text-ink-soft">Gagnés</dt><dd className="text-[15px] font-bold">{d.regles ? `${d.gagnes} sur ${d.gagnes + d.perdus}` : "—"}</dd></div>
            </dl>
            {d.attendu !== null && d.reussite !== null && <p className="mt-2 text-[11px] text-ink-soft">Réussite {pct(d.reussite)} pour {pct(d.attendu)} attendus d’après tes cotes{d.regles < 30 ? ` · sur ${d.regles} paris, c’est une tendance, pas une preuve` : ""}.</p>}
          </section>

          {/* 2. Ce qui attend une action */}
          <section aria-label="À faire" className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/paris" className="tile p-3 active:bg-surface-2"><span className="block text-[11.5px] text-ink-muted">Paris en cours</span><span className="block text-[20px] font-extrabold">{d.enCours}</span></Link>
            <Link href="/paris" className={`tile p-3 active:bg-surface-2 ${aConfirmer ? "border-brand/50 bg-brand-soft" : ""}`}><span className="block text-[11.5px] text-ink-muted">Résultats à confirmer</span><span className="block text-[20px] font-extrabold">{aConfirmer}</span></Link>
          </section>

          {/* 3. Vigilance : des règles fixes, jamais un avis */}
          {alertes.length > 0 && (
            <section aria-label="Points de vigilance" className="mt-4 space-y-2">
              {alertes.slice(0, 3).map((a) => (
                <div key={a.cle} className="flex items-start gap-2.5 rounded-2xl bg-draw-soft p-3 text-draw-ink">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0"><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4.5M12 17.3v.2" /></svg>
                  <span className="min-w-0"><b className="block text-[13px]">{a.titre}</b><span className="block text-[12px] leading-snug">{a.regle}</span></span>
                </div>
              ))}
            </section>
          )}

          {/* 4. Habitudes */}
          <section aria-label="Tes habitudes" className="tile mt-4 p-3.5">
            <h2 className="text-[15px] font-bold">Tes habitudes</h2>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2.5 text-[12px]">
              <div><dt className="text-ink-muted">Série en cours</dt><dd className="font-semibold">{dis.serie}</dd></div>
              <div><dt className="text-ink-muted">Pire série de pertes</dt><dd className="font-semibold">{dis.pireSerie}</dd></div>
              <div><dt className="text-ink-muted">Mise moyenne après une perte</dt><dd className="font-semibold">{dis.miseApresPerte === null ? "—" : <Montant texte={fcfa(Math.round(dis.miseApresPerte))} />}</dd></div>
              <div><dt className="text-ink-muted">… après un gain</dt><dd className="font-semibold">{dis.miseApresGain === null ? "—" : <Montant texte={fcfa(Math.round(dis.miseApresGain))} />}</dd></div>
              <div><dt className="text-ink-muted">Combinés perdus</dt><dd className="font-semibold">{dis.combinesPerdus}</dd></div>
              <div><dt className="text-ink-muted">… dont à une sélection près</dt><dd className="font-semibold">{dis.combinesAUnePres}</dd></div>
            </dl>
            {d.parType.length > 0 && (
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {d.parType.map((g) => <li key={g.cle} className="flex items-center justify-between py-2 text-[12.5px]"><span>{g.cle}</span><span className="text-ink-soft">{g.paris} · réussite {pct(g.reussite)} · rendement <b className={g.rendement !== null && g.rendement < 0 ? "text-loss" : "text-gain"}>{pct(g.rendement, true)}</b></span></li>)}
              </ul>
            )}
            <Link href="/bilan" className="mt-2 block text-[12px] font-semibold text-brand">Bilan détaillé ›</Link>
          </section>

          {/* 5. Points forts */}
          {fortes.moi.length > 0 && (
            <section aria-label="Tes points forts" className="tile mt-4 p-3.5">
              <h2 className="text-[15px] font-bold">Là où tu réussis le mieux</h2>
              <ul className="mt-2 space-y-1.5">
                {fortes.moi.map((f) => <li key={f.cle} className="flex items-center justify-between gap-3 text-[13px]"><span className="min-w-0 truncate">{f.libelle}</span><span className="shrink-0 font-semibold tabular-nums">{f.gagnes} sur {f.regles}</span></li>)}
              </ul>
              <p className="mt-2 text-[11px] text-ink-muted">Sur tes propres choix réglés, à partir de 3 résultats.</p>
            </section>
          )}
        </>
      )}

      {/* 6. Budget */}
      <div className="mt-4"><BudgetCard budget={budget} etat={etat} soldeTotal={solde + exposition} /></div>
    </>
  );
}
