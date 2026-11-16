import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { fcfa } from "@/components/ui";
import { loadDashboard } from "@/lib/stats/dashboard";
import { createClient } from "@/lib/supabase/server";
import { IconCamera, IconChat, IconCompass, IconTile, IconWallet } from "@/components/icons";
import { InstallButton } from "@/components/install-button";

export const dynamic = "force-dynamic";

const pct = (x: number | null, signed = false) => (x === null ? "—" : `${signed && x > 0 ? "+" : ""}${Math.round(x * 100)} %`);
const tone = (x: number | null) => (x === null ? "" : x > 0 ? "text-gain" : x < 0 ? "text-loss" : "");
const signedF = (x: number) => `${x > 0 ? "+" : ""}${fcfa(x)}`;
const pl = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const JOUR = 86400000;

/**
 * Accueil en trois étages : où j'en suis (solde, bénéfice, en jeu) ; ce qui attend une action de ma part ;
 * les gestes courants. Le bilan détaillé et les réglages ont chacun leur page.
 */
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Profil (créé au besoin : couvre un compte Kehiwa qui ouvre BETWISE pour la première fois)
  const { data: profile } = await supabase.rpc("ensure_profile");

  const [{ data: summary }, d, { data: follows }, { data: k }, { data: enCours }, { data: pend }] = await Promise.all([
    supabase.from("my_bankroll_summary").select("*").maybeSingle(),
    loadDashboard(supabase, null),
    supabase.from("source_follows").select("source_id, source:sources(id, nom, type)").eq("user_id", user!.id),
    supabase.from("bankrolls").select("verifie_at").eq("active", true).maybeSingle(),
    supabase.from("bets").select("id, resultat_propose").eq("statut", "en_cours").eq("virtuel", false).limit(500),
    // Sélections encore en attente sur un pari en cours : sert à repérer ceux que BETWISE ne réglera pas seul
    supabase.from("bet_selections").select("bet_id, match_id, bets!inner(statut, placed_at, virtuel), match:matches(statut, result_at)").eq("resultat", "en_attente").eq("bets.statut", "en_cours").limit(500),
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

  const ids = (follows ?? []).map((f) => f.source_id);
  const { data: trends } = ids.length ? await supabase.from("source_trend").select("source_id, nb_gagnes, nb_regles").in("source_id", ids) : { data: [] };
  const sources = (follows ?? []).map((f) => {
    const s = Array.isArray(f.source) ? f.source[0] : f.source, t = trends?.find((x) => x.source_id === f.source_id);
    const regles = Number(t?.nb_regles ?? 0), gagnes = Number(t?.nb_gagnes ?? 0);
    return { id: f.source_id, nom: s?.nom ?? "?", type: s?.type ?? "", regles, gagnes };
  }).filter((s) => s.type !== "perso").sort((a, b) => b.regles - a.regles);
  const maj = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

  return (
    <>
      <PageHeader title={`Salut ${profile?.pseudo ?? ""}`} subtitle="Où tu en es, et ce qui t’attend." tall photo
        action={<Link href="/reglages" aria-label="Réglages">Réglages</Link>} />

      {/* 1. Où j'en suis */}
      <section className="relative z-10 -mt-9 rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex items-center gap-3">
          <IconTile tone="terrain"><IconWallet /></IconTile>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-muted">Solde</p>
            <p className="font-display text-4xl font-bold leading-none tabular-nums">{fcfa(solde)}</p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
          <div>
            <dt className="text-[11px] text-ink-muted">Gains moins pertes</dt>
            <dd className={`text-lg font-bold tabular-nums ${tone(net)}`}>{signedF(net)}</dd>
            <dd className="text-[10px] text-ink-muted">sur {pl(Number(summary?.nb_regles ?? 0), "pari")} réglé{Number(summary?.nb_regles ?? 0) > 1 ? "s" : ""}, hors dépôts</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-muted">En jeu</dt>
            <dd className="text-lg font-bold tabular-nums">{fcfa(exposition)}</dd>
            <dd className="text-[10px] text-ink-muted">{d.enCours > 0 ? <Link href="/paris" className="underline">{pl(d.enCours, "pari")} en cours</Link> : "aucun pari en cours"}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[10px] text-ink-muted">Chiffres calculés à {maj} d’après tes paris enregistrés. {joursSansComparaison === null ? "Jamais comparé au solde de ton bookmaker." : `Comparé au bookmaker il y a ${joursSansComparaison === 0 ? "moins d’un jour" : pl(joursSansComparaison, "jour")}.`}</p>
      </section>

      {/* 2. Ce qui attend une action */}
      <h2 className="mt-5 text-base font-bold">À faire</h2>
      {rienAFaire ? (
        <p className="mt-2 rounded-xl border border-line bg-white p-3 text-sm text-ink-muted">Rien à faire pour l’instant. Les résultats à confirmer apparaîtront ici à la fin des matchs.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {aConfirmer > 0 && <Todo href="/paris" fort titre={`${pl(aConfirmer, "résultat")} à confirmer`} texte="Les matchs sont joués. BETWISE propose un résultat : rien n’entre dans ta bankroll avant ton accord." />}
          {aRegler > 0 && <Todo href="/paris" titre={`${pl(aRegler, "pari")} à régler à la main`} texte="Match non suivi ou statistiques non publiées : BETWISE ne peut pas proposer de résultat." />}
          {aComparer && <Todo href="/reglages#solde" titre="Comparer ton solde à celui du bookmaker" texte={joursSansComparaison === null ? "Jamais fait. C’est le contrôle qui attrape un pari oublié ou mal réglé." : `Dernière comparaison il y a ${pl(joursSansComparaison, "jour")}.`} />}
        </ul>
      )}

      {/* 3. Les gestes courants */}
      <h2 className="mt-5 text-base font-bold">Actions rapides</h2>
      <section className="mt-2 grid grid-cols-2 gap-2">
        <Action href="/import" tone="info" icon={<IconCamera width={18} height={18} />}>Importer un ticket</Action>
        <Action href="/matchs" tone="terrain" icon={<IconCompass width={18} height={18} />}>Analyser un match</Action>
        <Action href="/sources" tone="conseil" icon={<IconChat width={18} height={18} />}>Comparer mes sources</Action>
        <Action href={`/coach?v=discussion&q=${encodeURIComponent("Fais-moi un point sur ma bankroll et mes mises récentes.")}`} tone="conseil" icon={<IconWallet width={18} height={18} />}>Point bankroll</Action>
      </section>

      {/* Repères : deux chiffres et les sources, le détail est ailleurs */}
      <section className="mt-5 rounded-xl border border-line bg-white p-4 shadow-card">
        <div className="flex items-baseline justify-between gap-2"><h2 className="text-sm font-semibold">Mes paris réels</h2><Link href="/bilan" className="text-xs font-medium text-brand">Bilan détaillé ›</Link></div>
        {d.regles === 0 ? <p className="mt-2 text-sm text-ink-muted">Aucun pari réglé pour l’instant.</p> : (
          <>
            <dl className="mt-2 grid grid-cols-2 gap-3">
              <div><dt className="text-[11px] text-ink-muted">Rendement</dt><dd className={`text-lg font-bold tabular-nums ${tone(d.rendement)}`}>{pct(d.rendement, true)}</dd><dd className="text-[10px] text-ink-muted">gain net / mises</dd></div>
              <div><dt className="text-[11px] text-ink-muted">Paris gagnés</dt><dd className="text-lg font-bold tabular-nums">{d.gagnes} sur {d.gagnes + d.perdus}</dd><dd className="text-[10px] text-ink-muted">{pct(d.reussite)} ; attendu à ces cotes : {pct(d.attendu)}</dd></div>
            </dl>
            {d.regles < 30 && <p className="mt-2 text-[11px] text-ink-muted">Sur {pl(d.regles, "pari")} seulement, ces chiffres donnent une tendance, pas une preuve.</p>}
          </>
        )}
      </section>

      <section className="mt-3 rounded-xl border border-line bg-white p-4 shadow-card">
        <div className="flex items-baseline justify-between gap-2"><h2 className="text-sm font-semibold">Mes sources suivies</h2><Link href="/sources" className="text-xs font-medium text-brand">Toutes ›</Link></div>
        {sources.length === 0 ? <p className="mt-2 text-sm text-ink-muted">Aucune pour l’instant. <Link href="/sources" className="text-brand underline">Ajoute un tipster, une page ou un canal</Link> pour le noter sur ses vrais résultats.</p> : (
          <ul className="mt-2 divide-y divide-line">
            {sources.slice(0, 4).map((s) => (
              <li key={s.id}><Link href={`/sources/${s.id}`} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 truncate font-medium">{s.nom}</span><span className="shrink-0 tabular-nums text-ink-muted">{s.regles ? `${s.gagnes} juste${s.gagnes > 1 ? "s" : ""} sur ${s.regles}` : "pas encore de prono réglé"}</span></Link></li>
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
      <Link href={href} className={`flex items-center gap-3 rounded-xl border p-3 active:opacity-80 ${fort ? "border-amber-300 bg-amber-50" : "border-line bg-white"}`}>
        <span className="min-w-0 flex-1"><b className="block text-sm">{titre}</b><span className="block text-[12px] leading-snug text-ink-muted">{texte}</span></span>
        <span className="text-brand">›</span>
      </Link>
    </li>
  );
}
function Action({ href, tone, icon, children }: { href: string; tone: "info" | "terrain" | "conseil"; icon: React.ReactNode; children: React.ReactNode }) {
  return <Link href={href} className="flex items-center gap-2.5 rounded-2xl border border-line bg-white p-3 text-sm font-medium shadow-card active:bg-surface-2"><IconTile size="sm" tone={tone}>{icon}</IconTile>{children}</Link>;
}
