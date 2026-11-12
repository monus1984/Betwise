import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { LineChart } from "@/components/line-chart";
import { fcfa } from "@/components/ui";
import { signOut } from "@/lib/auth/actions";
import { bankrollMove } from "@/lib/bets/actions";
import { loadDashboard, type Group } from "@/lib/stats/dashboard";
import { createClient } from "@/lib/supabase/server";
import { loadGoal } from "@/lib/coach/goal";
import { jourAbidjan } from "@/lib/coach/daily";
import { IconCamera, IconChat, IconCompass, IconTile, IconWallet } from "@/components/icons";
import { InstallButton } from "@/components/install-button";
import { NotificationsCard } from "@/components/notifications-card";

export const dynamic = "force-dynamic";

const PERIODS = [{ k: "7j", t: "7 jours", d: 7 }, { k: "30j", t: "30 jours", d: 30 }, { k: "90j", t: "90 jours", d: 90 }, { k: "tout", t: "Tout", d: 0 }] as const;
const pct = (x: number | null, signed = false) => (x === null ? "—" : `${signed && x > 0 ? "+" : ""}${Math.round(x * 100)} %`);
const tone = (x: number | null) => (x === null ? "" : x > 0 ? "text-gain" : x < 0 ? "text-loss" : "");
const STATUT: Record<string, string> = { atteint: "atteint", en_avance: "en avance", dans_les_temps: "dans les temps", en_retard: "en retard", echu: "délai dépassé" };
const signedF = (x: number) => `${x > 0 ? "+" : ""}${fcfa(x)}`;

export default async function Home({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  const period = PERIODS.find((x) => x.k === sp.p) ?? PERIODS[1];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Profil (créé au besoin : couvre un compte Kehiwa qui ouvre BETWISE pour la première fois)
  const { data: profile } = await supabase.rpc("ensure_profile");

  const [{ data: summary }, d, { data: follows }] = await Promise.all([
    supabase.from("my_bankroll_summary").select("*").maybeSingle(),
    loadDashboard(supabase, period.d ? new Date(Date.now() - period.d * 86400000).toISOString() : null),
    supabase.from("source_follows").select("source_id, source:sources(id, nom, type)").eq("user_id", user!.id),
  ]);
  const solde = Number(summary?.solde ?? 0), exposition = Number(summary?.exposition ?? 0);
  const [goal, { count: nbCoups }, { data: np }] = await Promise.all([loadGoal(supabase, solde), supabase.from("daily_picks").select("id", { count: "exact", head: true }).eq("jour", jourAbidjan()), supabase.from("notification_prefs").select("resultats, coup_envoi, coups_du_jour, sources").maybeSingle()]);
  const ids = (follows ?? []).map((f) => f.source_id);
  const [{ data: trends }, { data: metrics }] = ids.length
    ? await Promise.all([
        supabase.from("source_trend").select("source_id, nb_declares, nb_gagnes, nb_regles").in("source_id", ids),
        supabase.from("source_metrics").select("source_id, rendement, ic_bas, ic_haut, statut_eval").eq("periode", "total").in("source_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const sources = (follows ?? []).map((f) => {
    const s = Array.isArray(f.source) ? f.source[0] : f.source;
    const t = trends?.find((x) => x.source_id === f.source_id), m = metrics?.find((x) => x.source_id === f.source_id);
    const regles = Number(t?.nb_regles ?? 0), gagnes = Number(t?.nb_gagnes ?? 0);
    return { id: f.source_id, nom: s?.nom ?? "?", declares: Number(t?.nb_declares ?? 0), regles, gagnes, reussite: regles ? gagnes / regles : null, rendement: m?.rendement !== null && m?.rendement !== undefined ? Number(m.rendement) : null, etabli: m?.ic_bas !== null && m?.ic_bas !== undefined ? (Number(m.ic_bas) > 0 ? "positif" : Number(m.ic_haut) < 0 ? "négatif" : "non établi") : null };
  }).sort((a, b) => b.regles - a.regles);
  const petit = d.regles < 30;

  return (
    <>
      <PageHeader title={`Salut ${profile?.pseudo ?? ""}`} subtitle="Ton tableau de bord." tall photo
        action={<form action={signOut}><button className="text-xs text-ink-muted underline">Déconnexion</button></form>} />

      <section className="relative z-10 -mt-9 rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex items-center gap-3">
          <IconTile tone="terrain"><IconWallet /></IconTile>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-muted">Solde</p>
            <p className="font-display text-4xl font-bold leading-none tabular-nums">{fcfa(solde)}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-muted">{d.enCours > 0 ? <>{fcfa(exposition)} en jeu sur <Link href="/paris" className="font-medium text-brand underline">{d.enCours} pari{d.enCours > 1 ? "s" : ""} en cours</Link></> : "Aucun pari en cours"}</p>
      </section>

      <div className="mt-3"><InstallButton /></div>

      <Link href="/coach" className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-card active:bg-surface-2">
        <IconTile tone="conseil"><IconCompass /></IconTile>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Coach</span>
          <span className="block truncate text-[11px] text-ink-muted">
            {goal ? `Objectif ${fcfa(goal.cible)} · ${STATUT[goal.statut] ?? goal.statut}` : "Pas encore d’objectif"} · {nbCoups ? `${nbCoups} coup${nbCoups > 1 ? "s" : ""} du jour` : "pas de coup du jour"}
          </span>
        </span>
        <span className="text-brand">›</span>
      </Link>

      <h2 className="mt-6 text-base font-bold">Ton bilan</h2>
      <nav className="mt-2 flex gap-1.5" aria-label="Période">
        {PERIODS.map((x) => <Link key={x.k} href={`/?p=${x.k}`} scroll={false} className={`rounded-full border px-3 py-1 text-xs ${period.k === x.k ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft"}`}>{x.t}</Link>)}
      </nav>

      {d.regles === 0 ? (
        <section className="mt-3 rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-ink-muted">
          Aucun pari réglé sur cette période. <Link href="/nouveau" className="text-brand underline">Saisis un pari</Link> ou <Link href="/import" className="text-brand underline">importe un ticket</Link> : le tableau se remplit tout seul après les matchs.
        </section>
      ) : (
        <>
          <section className="mt-3 grid grid-cols-3 gap-2">
            <Kpi label="Résultat net" value={signedF(d.net)} cls={tone(d.net)} />
            <Kpi label="Rendement" value={pct(d.rendement, true)} cls={tone(d.rendement)} sub="gain net / mises" />
            <Kpi label="Réussite" value={pct(d.reussite)} sub={`${d.gagnes} sur ${d.gagnes + d.perdus}`} />
            <Kpi label="Attendu à ces cotes" value={pct(d.attendu)} sub="réussite implicite" />
            <Kpi label="Cote moyenne" value={d.coteMoy ? d.coteMoy.toFixed(2).replace(".", ",") : "—"} />
            <Kpi label="Mise moyenne" value={d.miseMoy ? fcfa(d.miseMoy) : "—"} />
          </section>
          {petit && <p className="mt-2 text-[11px] text-ink-muted">Seulement {d.regles} pari{d.regles > 1 ? "s" : ""} réglé{d.regles > 1 ? "s" : ""} : ces chiffres donnent une tendance, pas une preuve. Il en faut une trentaine pour commencer à conclure.</p>}

          <Card title="Résultat cumulé" note="F CFA, pari après pari">
            <LineChart unit="F" empty="La courbe apparaît à partir de deux paris réglés." points={d.courbe.map((c) => ({ at: c.at, y: c.cumul, delta: c.net, libelle: c.libelle }))} />
          </Card>

          <Card title="D’où viennent tes choix" note="par sélection réglée">
            {d.parOrigine.length === 0 ? <p className="text-sm text-ink-muted">Aucune sélection réglée.</p> : (
              <ul className="space-y-3">
                {d.parOrigine.map((o) => (
                  <li key={o.id}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      {o.type && o.type !== "perso" ? <Link href={`/sources/${o.id}`} className="truncate font-medium text-brand">{o.nom}</Link> : <span className="truncate font-medium">{o.nom}</span>}
                      <span className="shrink-0 tabular-nums"><b>{pct(o.reussite)}</b> <span className="text-xs text-ink-muted">{o.gagnees}/{o.selections} · cote {o.coteMoy.toFixed(2).replace(".", ",")}</span></span>
                    </div>
                    <div className="relative mt-1 h-2 rounded-full bg-surface-2">
                      <div className={`h-2 rounded-full ${o.reussite >= o.attendu ? "bg-gain" : "bg-loss"}`} style={{ width: `${o.reussite * 100}%` }} />
                      <div className="absolute -top-1 h-4 w-0.5 rounded bg-ink" style={{ left: `calc(${o.attendu * 100}% - 1px)` }} title="Réussite attendue à ces cotes" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-ink-muted">Trait noir : la réussite que les cotes jouées laissaient attendre. Barre verte : cette origine a fait mieux ; rouge : moins bien. Touche un nom pour voir sa fiche.</p>
          </Card>

          <Breakdown title="Simples ou combinés" rows={d.parType} />
          <Breakdown title="Par niveau de risque" note="selon la cote du ticket" rows={d.parRisque} />
          {d.parMarche.length > 0 && <Breakdown title="Par type de pari" note="paris simples" rows={d.parMarche} />}
          {d.parBookmaker.length > 1 && <Breakdown title="Par bookmaker" rows={d.parBookmaker} />}

          <Card title="Discipline">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Fact k="Série en cours" v={d.discipline.serie} />
              <Fact k="Pire série de pertes" v={d.discipline.pireSerie ? `${d.discipline.pireSerie} pari${d.discipline.pireSerie > 1 ? "s" : ""}` : "—"} />
              <Fact k="Mise moyenne après une perte" v={d.discipline.miseApresPerte ? fcfa(d.discipline.miseApresPerte) : "—"} />
              <Fact k="Mise moyenne après un gain" v={d.discipline.miseApresGain ? fcfa(d.discipline.miseApresGain) : "—"} />
              <Fact k="Combinés perdus" v={String(d.discipline.combinesPerdus)} />
              <Fact k="…à une sélection près" v={String(d.discipline.combinesAUnePres)} />
            </dl>
            {d.discipline.miseApresPerte && d.discipline.miseApresGain && d.discipline.miseApresPerte > d.discipline.miseApresGain * 1.25 && (
              <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">Tu mises {Math.round((d.discipline.miseApresPerte / d.discipline.miseApresGain - 1) * 100)} % de plus après une perte qu’après un gain. C’est le réflexe de vouloir se refaire : une mise fixe protège mieux ta bankroll.</p>
            )}
          </Card>
        </>
      )}

      <Card title="Tes sources suivies" note={sources.length ? "depuis le début" : undefined}>
        {sources.length === 0 ? <p className="text-sm text-ink-muted">Tu ne suis encore aucune source. <Link href="/sources" className="text-brand underline">Ajoute un tipster, une page ou un canal</Link> pour le noter sur ses vrais résultats.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] text-ink-muted"><th className="pb-1 font-medium">Source</th><th className="pb-1 text-right font-medium">Pronos</th><th className="pb-1 text-right font-medium">Réussite</th><th className="pb-1 text-right font-medium">Rendement</th></tr></thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="py-2"><Link href={`/sources/${s.id}`} className="font-medium text-brand">{s.nom}</Link>{s.etabli && <span className="block text-[10px] text-ink-muted">{s.etabli}</span>}</td>
                  <td className="py-2 text-right tabular-nums">{s.regles}<span className="text-xs text-ink-muted">/{s.declares}</span></td>
                  <td className="py-2 text-right tabular-nums">{pct(s.reussite)}</td>
                  <td className={`py-2 text-right tabular-nums ${tone(s.rendement)}`}>{pct(s.rendement, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <details className="mt-3 rounded-xl border border-line bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold">Alimenter ou retirer la bankroll</summary>
        <form action={bankrollMove} className="mt-3 flex gap-2">
          <select name="type" className="rounded-lg border border-line bg-white px-2 py-2 text-sm">
            <option value="depot">Dépôt</option>
            <option value="retrait">Retrait</option>
          </select>
          <input name="montant" inputMode="numeric" placeholder="Montant F CFA" className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-base" required />
          <button className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">OK</button>
        </form>
        <p className="mt-2 text-xs text-ink-muted">Le solde part de 0 : enregistre ton capital de départ comme premier dépôt.</p>
      </details>

      <NotificationsCard prefs={{ resultats: np?.resultats ?? true, coup_envoi: np?.coup_envoi ?? true, coups_du_jour: np?.coups_du_jour ?? true, sources: np?.sources ?? true }} />

      <section className="mt-3 grid grid-cols-2 gap-2">
        <Link href="/coach?v=discussion" className="flex items-center gap-2.5 rounded-2xl border border-line bg-white p-3 text-sm font-medium shadow-card active:bg-surface-2"><IconTile size="sm" tone="conseil"><IconChat width={18} height={18} /></IconTile>Demander au Coach</Link>
        <Link href="/import" className="flex items-center gap-2.5 rounded-2xl border border-line bg-white p-3 text-sm font-medium shadow-card active:bg-surface-2"><IconTile size="sm" tone="info"><IconCamera width={18} height={18} /></IconTile>Importer un ticket</Link>
      </section>

      <p className="mt-6 text-center text-xs text-ink-muted">Connecté : {user?.email}</p>
    </>
  );
}

function Kpi({ label, value, sub, cls = "" }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-2.5 shadow-card">
      <p className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-0.5 text-[15px] font-bold tabular-nums ${cls}`}>{value}</p>
      {sub && <p className="text-[10px] text-ink-muted">{sub}</p>}
    </div>
  );
}
function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="mb-3 flex items-baseline justify-between gap-2"><h2 className="text-sm font-semibold">{title}</h2>{note && <span className="text-[11px] text-ink-muted">{note}</span>}</div>
      {children}
    </section>
  );
}
function Fact({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-[11px] text-ink-muted">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>;
}
function Breakdown({ title, note, rows }: { title: string; note?: string; rows: Group[] }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => Math.abs(r.net)), 1);
  return (
    <Card title={title} note={note}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.cle}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate">{r.cle} <span className="text-xs text-ink-muted">· {r.gagnes}/{r.paris}</span></span>
              <span className={`shrink-0 font-semibold tabular-nums ${tone(r.net)}`}>{signedF(r.net)} <span className="text-xs font-normal">({pct(r.rendement, true)})</span></span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className={`h-1.5 rounded-full ${r.net >= 0 ? "bg-gain" : "bg-loss"}`} style={{ width: `${(Math.abs(r.net) / max) * 100}%` }} /></div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
