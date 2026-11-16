import { APP_NAME } from "@/lib/app-name";
import Link from "next/link";
import { Sparkline } from "@/components/sparkline";
import { fcfa } from "@/components/ui";
import { loadDashboard } from "@/lib/stats/dashboard";
import { vigilance, type Alerte } from "@/lib/stats/vigilance";
import { etatBudget } from "@/lib/coach/budget";
import { lire as lireProof, resume } from "@/lib/sources/proof";
import { comptes as calculer, type Mouvement } from "@/lib/bankroll/comptes";
import { createClient } from "@/lib/supabase/server";
import { Mark } from "@/components/icons";
import { InstallButton } from "@/components/install-button";

export const dynamic = "force-dynamic";

const pct = (x: number | null, signed = false) => (x === null ? "—" : `${signed && x > 0 ? "+" : ""}${Math.round(x * 100)} %`);
const tone = (x: number | null) => (x === null ? "" : x > 0 ? "text-gain" : x < 0 ? "text-loss" : "");
const signedF = (x: number) => `${x > 0 ? "+" : ""}${fcfa(x)}`;
const pl = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const JOUR = 86400000;

/**
 * Accueil : où j'en suis (solde par compte, bénéfice, en jeu) ; les points de vigilance, déclenchés par des règles
 * fixes ; ce qui attend une action de ma part ; les gestes courants. Le bilan détaillé et les réglages ont chacun leur page.
 */
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Profil (créé au besoin : couvre un compte Kehiwa qui ouvre BETWISE pour la première fois)
  const { data: profile } = await supabase.rpc("ensure_profile");

  const [{ data: summary }, d, { data: follows }, { data: k }, { data: enCours }, { data: pend }, { data: journal }, { data: recents }, { count: nonLues }, { data: bud }] = await Promise.all([
    supabase.from("my_bankroll_summary").select("*").maybeSingle(),
    loadDashboard(supabase, null),
    supabase.from("source_follows").select("source_id, source:sources(id, nom, type)").eq("user_id", user!.id),
    supabase.from("bankrolls").select("verifie_at").eq("active", true).maybeSingle(),
    supabase.from("bets").select("id, resultat_propose, mise, bookmaker").eq("statut", "en_cours").eq("virtuel", false).limit(500),
    // Sélections encore en attente sur un pari en cours : sert à repérer ceux que BETWISE ne réglera pas seul
    supabase.from("bet_selections").select("bet_id, match_id, bets!inner(statut, placed_at, virtuel), match:matches(statut, result_at)").eq("resultat", "en_attente").eq("bets.statut", "en_cours").limit(500),
    supabase.from("my_bankroll_journal").select("type, montant, bet_id, bookmaker").limit(3000),
    supabase.from("bets").select("mise, statut, gain_net, placed_at, settled_at, nb_selections").eq("virtuel", false).neq("statut", "annule").order("placed_at", { ascending: false }).limit(40),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("lu_at", null),
    supabase.from("budgets").select("mise_semaine, perte_max_semaine").maybeSingle(),
  ]);

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
  const parCompte = calculer((journal ?? []).filter((t) => t.type && t.montant !== null) as unknown as Mouvement[], (enCours ?? []).map((b) => ({ mise: Number(b.mise), bookmaker: b.bookmaker }))).comptes;
  const budget = bud ? etatBudget({ miseSemaine: Number(bud.mise_semaine), perteMaxSemaine: Number(bud.perte_max_semaine) }, (recents ?? []).map((b) => ({ mise: Number(b.mise), statut: b.statut, gain_net: b.gain_net === null ? null : Number(b.gain_net), placed_at: b.placed_at, settled_at: b.settled_at }))) : null;
  const alerteBudget: Alerte[] = budget?.motif ? [{ cle: "budget", poids: 9, titre: budget.statut === "atteint" ? "Ton budget de la semaine est atteint" : "Tu approches de ton budget de la semaine", regle: `${budget.motif} Règle : celle que tu as fixée toi-même.` }] : [];
  const alertes = [...alerteBudget, ...vigilance((recents ?? []).map((b) => ({ mise: Number(b.mise), statut: b.statut, placed_at: b.placed_at, settled_at: b.settled_at, nb_selections: b.nb_selections })), solde)].slice(0, 2);
  const sept = d.courbe.filter((x) => Date.now() - Date.parse(x.at) <= 7 * JOUR).reduce((t, x) => t + x.net, 0);
  const cloche = Math.min(nonLues ?? 0, 99);

  const ids = (follows ?? []).map((f) => f.source_id);
  const { data: trends } = ids.length ? await supabase.from("source_proof").select("*").in("source_id", ids) : { data: [] };
  const sources = (follows ?? []).map((f) => {
    const s = Array.isArray(f.source) ? f.source[0] : f.source, t = trends?.find((x) => x.source_id === f.source_id);
    const proof = lireProof(t);
    return { id: f.source_id, nom: s?.nom ?? "?", type: s?.type ?? "", regles: proof.prouvesRegles, note: resume(proof) };
  }).filter((s) => s.type !== "perso").sort((a, b) => b.regles - a.regles);
  const maj = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

  return (
    <>
      {/* En-tête : le nom, la cloche, les réglages. Pas de bandeau : l'écran commence par le solde. */}
      <header className="mb-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2"><Mark className="h-7 w-7" /><span className="text-lg font-bold tracking-tight">{APP_NAME}</span></span>
        <span className="flex items-center gap-1">
          <Link href="/notifications" aria-label={cloche ? `Notifications, ${nonLues} non lues` : "Notifications"} className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-soft active:bg-surface-2">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            {cloche > 0 && <span className="absolute right-0 top-0.5 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-[18px] text-on-fill">{(nonLues ?? 0) > 99 ? "99+" : cloche}</span>}
          </Link>
          <Link href="/reglages" aria-label="Réglages" className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft active:bg-surface-2">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
          </Link>
        </span>
      </header>
      <h1 className="text-2xl font-bold leading-tight tracking-tight">Bonjour {profile?.pseudo ?? ""}</h1>
      <p className="mb-3 text-[13px] text-ink-muted">Ton aperçu du jour</p>

      {/* 1. Où j'en suis */}
      <Link href="/bankroll" className="card-hero block rounded-2xl p-4 active:opacity-90">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink-soft">Ta bankroll</p>
            <p className="mt-0.5 text-[34px] font-bold leading-none tabular-nums">{fcfa(solde)}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Sparkline values={[0, ...d.courbe.map((x) => x.cumul)].slice(-30)} className="h-11 w-28" label="Tendance des gains moins pertes" />
            {d.courbe.length > 0 && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${sept > 0 ? "bg-gain-soft text-gain-ink" : sept < 0 ? "bg-loss-soft text-loss-ink" : "bg-surface-2 text-ink-soft"}`}>{signedF(sept)} · 7 j</span>}
          </div>
        </div>
        <p className="mt-2 flex items-baseline justify-between gap-3 text-[11px] text-ink-muted">
          <span className="min-w-0 truncate">{parCompte.length > 1 ? parCompte.map((c) => `${c.nom} ${fcfa(c.solde)}`).join(" · ") : "Solde disponible"}</span>
          <span className="shrink-0">Calculé à {maj}</span>
        </p>
      </Link>

      <dl className="mt-2 grid grid-cols-3 gap-2">
        <Link href="/paris" className="tile p-3 active:bg-surface-2">
          <dt className="text-[11px] text-ink-muted">En jeu</dt>
          <dd className="mt-0.5 text-lg font-bold leading-tight tabular-nums">{fcfa(exposition)}</dd>
          <dd className="text-[10px] text-ink-muted">{d.enCours > 0 ? `${pl(d.enCours, "pari")} en cours` : "aucun pari"}</dd>
        </Link>
        <Link href="/bilan" className="tile p-3 active:bg-surface-2">
          <dt className="text-[11px] text-ink-muted">Rendement</dt>
          <dd className={`mt-0.5 text-lg font-bold leading-tight tabular-nums ${tone(d.rendement)}`}>{pct(d.rendement, true)}</dd>
          <dd className="text-[10px] text-ink-muted">{signedF(net)} net</dd>
        </Link>
        <Link href="/bilan" className="tile p-3 active:bg-surface-2">
          <dt className="text-[11px] text-ink-muted">Paris gagnés</dt>
          <dd className="mt-0.5 text-lg font-bold leading-tight tabular-nums">{d.regles ? `${d.gagnes} sur ${d.gagnes + d.perdus}` : "—"}</dd>
          <dd className="text-[10px] text-ink-muted">{d.regles ? `${pct(d.reussite)} · attendu ${pct(d.attendu)}` : "aucun réglé"}</dd>
        </Link>
      </dl>
      {d.regles > 0 && d.regles < 30 && <p className="mt-1.5 px-1 text-[10px] text-ink-muted">Sur {pl(d.regles, "pari")} réglé{d.regles > 1 ? "s" : ""}, ces chiffres donnent une tendance, pas une preuve. {joursSansComparaison === null ? "Solde jamais comparé à un bookmaker." : `Solde comparé au bookmaker il y a ${joursSansComparaison === 0 ? "moins d’un jour" : pl(joursSansComparaison, "jour")}.`}</p>}

      {/* Points de vigilance : des règles fixes, jamais un avis */}
      {alertes.length > 0 && (
        <section className="mt-3 space-y-2" aria-label="Points de vigilance">
          {alertes.map((a) => (
            <Link key={a.cle} href={a.cle === "budget" ? "/coach?v=outils" : a.cle === "serie" || a.cle === "combines" ? "/bilan" : "/paris"} className="flex items-center gap-3 rounded-2xl border border-draw/50 bg-draw-soft p-3 active:opacity-90">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-draw"><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4.5" /><path d="M12 17.3v.2" /></svg>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-draw">Point de vigilance</span>
                <span className="block text-sm font-semibold leading-snug text-draw-ink">{a.titre}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-draw-ink">{a.regle}</span>
              </span>
              <span aria-hidden className="text-draw">›</span>
            </Link>
          ))}
        </section>
      )}

      {/* 2. Ce qui attend une action */}
      {!rienAFaire && (
        <>
          <h2 className="mt-5 text-base font-bold">À faire</h2>
          <ul className="mt-2 space-y-2">
            {aConfirmer > 0 && <Todo href="/paris" fort titre={`${pl(aConfirmer, "résultat")} à confirmer`} texte={`Les matchs sont joués. ${APP_NAME} propose un résultat : rien n’entre dans ta bankroll avant ton accord.`} />}
            {aRegler > 0 && <Todo href="/paris" titre={`${pl(aRegler, "pari")} à régler à la main`} texte={`Match non suivi ou statistiques non publiées : ${APP_NAME} ne peut pas proposer de résultat.`} />}
            {aComparer && <Todo href="/bankroll?v=comptes" titre="Comparer ton solde à celui du bookmaker" texte={joursSansComparaison === null ? "Jamais fait. C’est le contrôle qui attrape un pari oublié ou mal réglé." : `Dernière comparaison il y a ${pl(joursSansComparaison, "jour")}.`} />}
          </ul>
        </>
      )}

      {/* 3. Les gestes courants */}
      <h2 className="mt-5 text-base font-bold">Que veux-tu faire ?</h2>
      <section className="mt-2 grid grid-cols-2 gap-2">
        <Action href="/import" icon={<><path d="M4 8V6a2 2 0 0 1 2-2h2" /><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M20 16v2a2 2 0 0 1-2 2h-2" /><path d="M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M8 9.5h8M8 12h8M8 14.5h5" /></>}>Scanner un ticket</Action>
        <Action href="/matchs" icon={<><circle cx="12" cy="12" r="9" /><path d="m12 7.5 4 2.9-1.5 4.7h-5L8 10.4l4-2.9Z" /><path d="M12 3v4.5M3.6 9.3 8 10.4M5.9 18.3l3.6-3.2M18.1 18.3l-3.6-3.2M20.4 9.3 16 10.4" /></>}>Analyser un match</Action>
        <Action href="/sources" icon={<><circle cx="9" cy="8" r="3.2" /><path d="M3 19a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.2a4.6 4.6 0 0 1 5 4.6" /></>}>Comparer mes sources</Action>
        <Action href="/coach" icon={<><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /><path d="M9 11.5h.01M12 11.5h.01M15 11.5h.01" /></>}>Parler au coach</Action>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between gap-2"><h2 className="text-sm font-semibold">Mes sources suivies <span className="font-normal text-ink-muted">· pronos prouvés</span></h2><Link href="/sources" className="text-xs font-medium text-brand">Toutes ›</Link></div>
        {sources.length === 0 ? <p className="mt-2 text-sm text-ink-muted">Aucune pour l’instant. <Link href="/sources" className="text-brand underline">Ajoute un tipster, une page ou un canal</Link> pour le noter sur ses vrais résultats.</p> : (
          <ul className="mt-2 divide-y divide-line">
            {sources.slice(0, 4).map((s) => (
              <li key={s.id}><Link href={`/sources/${s.id}`} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 truncate font-medium">{s.nom}</span><span className="shrink-0 tabular-nums text-ink-muted">{s.note}</span></Link></li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-3"><InstallButton /></div>
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
function Action({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className="tile tile-action flex flex-col items-center gap-2 px-3 py-4 text-center text-sm font-medium">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-brand">{icon}</svg>
      {children}
    </Link>
  );
}
