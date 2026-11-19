import { APP_NAME } from "@/lib/app-name";
import Link from "next/link";
import { Sparkline } from "@/components/sparkline";
import { fcfa } from "@/components/ui";
import { loadDashboard } from "@/lib/stats/dashboard";
import { vigilance, type Alerte } from "@/lib/stats/vigilance";
import { etatBudget } from "@/lib/coach/budget";
import { createClient } from "@/lib/supabase/server";
import { Mark } from "@/components/icons";
import { InstallButton } from "@/components/install-button";
import { loadAccueil } from "@/lib/accueil/load";
import { AvisBetster, Bienvenue, CarteMatchUI, IconeScan, ImportCarte, JourCreux, TipstersDuJour } from "@/components/accueil";
import { BoutonMasque, Montant } from "@/components/montant";
import { LiveRefresh } from "@/components/live-refresh";

export const dynamic = "force-dynamic";

const pct = (x: number | null, signed = false) => (x === null ? "—" : `${signed && x > 0 ? "+" : ""}${Math.round(x * 100)} %`);
const tone = (x: number | null) => (x === null ? "" : x > 0 ? "text-gain" : x < 0 ? "text-loss" : "");
const signedF = (x: number) => `${x > 0 ? "+" : ""}${fcfa(x)}`;
const pl = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const JOUR = 86400000;

/**
 * Accueil (maquettes validées le 19/11, docs/design/accueil/) : la prédiction d'abord. L'avis de Betster et les matchs
 * du jour, puis le Coach (bankroll, budget, vigilance), l'import, ce que disent les tipsters suivis, ce qui attend une action.
 */
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Profil (créé au besoin : couvre un compte Kehiwa qui ouvre BETWISE pour la première fois)
  const { data: profile } = await supabase.rpc("ensure_profile");

  const [{ data: summary }, d, { data: follows }, { data: k }, { data: enCours }, { data: pend }, { data: recents }, { count: nonLues }, { data: bud }] = await Promise.all([
    supabase.from("my_bankroll_summary").select("*").maybeSingle(),
    loadDashboard(supabase, null),
    supabase.from("source_follows").select("source_id, source:sources(id, nom, type)").eq("user_id", user!.id),
    supabase.from("bankrolls").select("verifie_at").eq("active", true).maybeSingle(),
    supabase.from("bets").select("id, resultat_propose, mise, bookmaker").eq("statut", "en_cours").eq("virtuel", false).limit(500),
    // Sélections encore en attente sur un pari en cours : sert à repérer ceux que BETWISE ne réglera pas seul
    supabase.from("bet_selections").select("bet_id, match_id, bets!inner(statut, placed_at, virtuel), match:matches(statut, result_at)").eq("resultat", "en_attente").eq("bets.statut", "en_cours").limit(500),
    supabase.from("bets").select("mise, statut, gain_net, placed_at, settled_at, nb_selections").eq("virtuel", false).neq("statut", "annule").order("placed_at", { ascending: false }).limit(40),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("lu_at", null),
    supabase.from("budgets").select("mise_semaine, perte_max_semaine").maybeSingle(),
  ]);
  const acc = await loadAccueil(supabase, user!.id);

  const proposes = new Set((enCours ?? []).filter((b) => b.resultat_propose && b.resultat_propose !== "en_attente").map((b) => b.id));
  type Pend = { bet_id: string; match_id: string | null; bets: { placed_at: string } | { placed_at: string }[]; match: { statut: string; result_at: string | null } | { statut: string; result_at: string | null }[] | null };
  const aRegler = new Set(((pend ?? []) as unknown as Pend[]).filter((x) => {
    if (proposes.has(x.bet_id)) return false;
    const b = Array.isArray(x.bets) ? x.bets[0] : x.bets, mt = Array.isArray(x.match) ? x.match[0] : x.match;
    if (!x.match_id) return Date.now() - Date.parse(b.placed_at) > JOUR;
    return mt?.statut === "termine" && !!mt.result_at && Date.now() - Date.parse(mt.result_at) > 3 * 3600000;
  }).map((x) => x.bet_id)).size;
  const aConfirmer = proposes.size;

  const solde = Number(summary?.solde ?? 0), exposition = Number(summary?.exposition ?? 0), net = Number(summary?.resultat_net ?? 0);
  const nbReels = Number(summary?.nb_regles ?? 0) + (enCours?.length ?? 0);
  const joursSansComparaison = k?.verifie_at ? Math.floor((Date.now() - Date.parse(k.verifie_at)) / JOUR) : null;
  const aComparer = nbReels > 0 && (joursSansComparaison === null || joursSansComparaison >= 7);
  const rienAFaire = !aConfirmer && !aRegler && !aComparer;
  const budget = bud ? etatBudget({ miseSemaine: Number(bud.mise_semaine), perteMaxSemaine: Number(bud.perte_max_semaine) }, (recents ?? []).map((b) => ({ mise: Number(b.mise), statut: b.statut, gain_net: b.gain_net === null ? null : Number(b.gain_net), placed_at: b.placed_at, settled_at: b.settled_at }))) : null;
  const alerteBudget: Alerte[] = budget?.motif ? [{ cle: "budget", poids: 9, titre: budget.statut === "atteint" ? "Ton budget de la semaine est atteint" : "Tu approches de ton budget de la semaine", regle: `${budget.motif} Règle : celle que tu as fixée toi-même.` }] : [];
  const alertes = [...alerteBudget, ...vigilance((recents ?? []).map((b) => ({ mise: Number(b.mise), statut: b.statut, placed_at: b.placed_at, settled_at: b.settled_at, nb_selections: b.nb_selections })), solde)].slice(0, 2);
  const sept = d.courbe.filter((x) => Date.now() - Date.parse(x.at) <= 7 * JOUR).reduce((t, x) => t + x.net, 0);
  const cloche = Math.min(nonLues ?? 0, 99);


  const nouveau = nbReels === 0 && (follows ?? []).length === 0;
  const cartes = acc.cartes.slice(0, 6);
  const directs = acc.cartes.filter((c) => c.statut === "en_cours").length;

  return (
    <>
      <LiveRefresh active={acc.cartes.some((c) => c.statut === "en_cours" || (c.statut === "programme" && Math.abs(Date.parse(c.kickoff) - Date.now()) < 15 * 60000))} />
      {/* En-tête : le nom, l'import, la cloche, les réglages */}
      <header className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2"><Mark className="h-7 w-7" /><span className="min-w-0"><span className="block text-lg font-bold leading-tight tracking-tight">{APP_NAME}</span><span className="block text-[11px] capitalize text-ink-muted">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Abidjan" })}</span></span></span>
        <span className="flex items-center gap-0.5">
          <Link href="/import" aria-label="Importer un ticket" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft active:bg-surface-2"><IconeScan /></Link>
          <Link href="/notifications" aria-label={cloche ? `Notifications, ${nonLues} non lues` : "Notifications"} className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink-soft active:bg-surface-2">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            {cloche > 0 && <span className="absolute right-0.5 top-1 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-[18px] text-on-fill">{(nonLues ?? 0) > 99 ? "99+" : cloche}</span>}
          </Link>
          <Link href="/reglages" aria-label="Réglages" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft active:bg-surface-2">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
          </Link>
        </span>
      </header>
      <h1 className="sr-only">Bonjour {profile?.pseudo ?? ""}</h1>

      {/* 1. L'avis de Betster, ou ce qui vient quand rien n'est analysé aujourd'hui */}
      {acc.avis ? <AvisBetster a={acc.avis} /> : <JourCreux repli={acc.repli} />}
      {nouveau && <Bienvenue />}

      {/* 2. Matchs du jour */}
      {cartes.length > 0 && (
        <section aria-label="Matchs du jour" className="mt-6 flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-bold">{directs ? "Ce soir" : "Matchs du jour"}</h2>
            <span className="text-[11.5px] text-ink-muted">{directs ? `${pl(directs, "match")} en direct · ` : ""}{acc.nbAnalyses} analysé{acc.nbAnalyses > 1 ? "s" : ""}{acc.nbSans ? ` · ${acc.nbSans} sans analyse` : ""}</span>
          </div>
          {cartes.map((c) => <CarteMatchUI key={c.id} c={c} />)}
          {acc.cartes.length > cartes.length && <Link href="/matchs" className="flex h-11 items-center justify-center rounded-xl border border-line text-[13.5px] font-semibold">Voir les {acc.cartes.length} matchs du jour</Link>}
        </section>
      )}

      {/* 3. Mon Coach : bankroll, budget, vigilance, conversation */}
      <section aria-label="Mon Coach" className="tile mt-6 flex flex-col gap-3 p-3.5">
        <div className="flex items-center justify-between"><h2 className="text-[17px] font-bold">Mon Coach</h2><BoutonMasque /></div>
        {nouveau ? (
          <p className="text-[13px] leading-snug text-ink-soft">Ta bankroll, ton rendement et tes points de vigilance apparaîtront ici dès ton premier pari importé.</p>
        ) : (
          <>
            <Link href="/bankroll" className="flex items-end justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[12px] text-ink-muted">Ta bankroll</span>
                <Montant texte={fcfa(solde)} className="block text-[28px] font-extrabold leading-tight tabular-nums" />
                {d.courbe.length > 0 && <span className={`block text-[11.5px] font-semibold ${sept > 0 ? "text-gain" : sept < 0 ? "text-loss" : "text-ink-soft"}`}><Montant texte={signedF(sept)} /> sur 7 jours</span>}
              </span>
              <Sparkline values={[0, ...d.courbe.map((x) => x.cumul)].slice(-30)} className="h-10 w-28" label="Tendance des gains moins pertes" />
            </Link>
            <dl className="grid grid-cols-3 gap-2 text-[11px]">
              <div><dt className="text-ink-muted">En jeu</dt><dd className="font-bold"><Montant texte={fcfa(exposition)} /></dd></div>
              <div><dt className="text-ink-muted">Rendement</dt><dd className={`font-bold ${tone(d.rendement)}`}>{pct(d.rendement, true)}</dd></div>
              <div><dt className="text-ink-muted">Paris gagnés</dt><dd className="font-bold">{d.regles ? `${d.gagnes} sur ${d.gagnes + d.perdus}` : "—"}</dd></div>
            </dl>
            {budget && (
              <div className="flex flex-col gap-1.5">
                <p className="flex justify-between text-[12px]"><span className="text-ink-soft">Budget de la semaine</span><span className="font-semibold"><Montant texte={`${fcfa(budget.mises)} sur ${fcfa(Number(bud!.mise_semaine))}`} /></span></p>
                <div className="h-1.5 rounded-full bg-surface-2"><div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.min(100, Math.round(budget.partMises * 100))}%` }} /></div>
              </div>
            )}
            {alertes[0] && (
              <Link href={alertes[0].cle === "budget" ? "/coach?v=outils" : alertes[0].cle === "serie" || alertes[0].cle === "combines" ? "/bilan" : "/paris"} className="flex items-start gap-2 rounded-xl bg-draw-soft p-2.5 text-draw-ink">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-px shrink-0"><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4.5M12 17.3v.2" /></svg>
                <span className="text-[12px] leading-snug"><b>Point de vigilance.</b> {alertes[0].titre}</span>
              </Link>
            )}
          </>
        )}
        <Link href="/coach" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand text-[13.5px] font-bold text-on-fill">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></svg>Parler au coach
        </Link>
      </section>

      {/* 4. Import */}
      <div className="mt-3.5"><ImportCarte /></div>

      {/* 5. Tipsters suivis sur les matchs du jour */}
      <TipstersDuJour t={acc.tipsters} />

      {/* 6. Ce qui attend une action */}
      {!rienAFaire && (
        <>
          <h2 className="mt-6 text-[17px] font-bold">À faire</h2>
          <ul className="mt-2 space-y-2">
            {aConfirmer > 0 && <Todo href="/paris" fort titre={`${pl(aConfirmer, "résultat")} à confirmer`} texte={`Les matchs sont joués. ${APP_NAME} propose un résultat : rien n’entre dans ta bankroll avant ton accord.`} />}
            {aRegler > 0 && <Todo href="/paris" titre={`${pl(aRegler, "pari")} à régler à la main`} texte={`Match non suivi ou statistiques non publiées : ${APP_NAME} ne peut pas proposer de résultat.`} />}
            {aComparer && <Todo href="/bankroll?v=comptes" titre="Comparer ton solde à celui du bookmaker" texte={joursSansComparaison === null ? "Jamais fait. C’est le contrôle qui attrape un pari oublié ou mal réglé." : `Dernière comparaison il y a ${pl(joursSansComparaison, "jour")}.`} />}
          </ul>
        </>
      )}

      <div className="mt-4"><InstallButton /></div>
    </>
  );
}

function Todo({ href, titre, texte, fort }: { href: string; titre: string; texte: string; fort?: boolean }) {
  return (
    <li>
      <Link href={href} className={`flex items-center gap-3 rounded-xl border p-3 active:opacity-80 ${fort ? "border-brand/40 bg-brand-soft" : "border-line bg-surface"}`}>
        <span className="min-w-0 flex-1"><b className="block text-sm">{titre}</b><span className="block text-[12px] leading-snug text-ink-muted">{texte}</span></span>
        <span className="text-brand">›</span>
      </Link>
    </li>
  );
}
