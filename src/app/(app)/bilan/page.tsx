import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { LineChart } from "@/components/line-chart";
import { fcfa } from "@/components/ui";
import { loadDashboard, type Group } from "@/lib/stats/dashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PERIODS = [{ k: "7j", t: "7 jours", d: 7 }, { k: "30j", t: "30 jours", d: 30 }, { k: "90j", t: "90 jours", d: 90 }, { k: "tout", t: "Tout", d: 0 }] as const;
const pct = (x: number | null, signed = false) => (x === null ? "—" : `${signed && x > 0 ? "+" : ""}${Math.round(x * 100)} %`);
const tone = (x: number | null) => (x === null ? "" : x > 0 ? "text-gain" : x < 0 ? "text-loss" : "");
const signedF = (x: number) => `${x > 0 ? "+" : ""}${fcfa(x)}`;

/** Le bilan détaillé des paris réels réglés : résultat, rendement, d'où viennent les choix, discipline. */
export default async function BilanPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  const period = PERIODS.find((x) => x.k === sp.p) ?? PERIODS[1];
  const supabase = await createClient();
  const d = await loadDashboard(supabase, period.d ? new Date(Date.now() - period.d * 86400000).toISOString() : null);
  const petit = d.regles < 30;

  return (
    <>
      <PageHeader title="Mon bilan" subtitle="Tes paris réels réglés. Les tests n’y entrent pas." action={<Link href="/paris">Mes paris</Link>} />
      <nav className="flex gap-1.5" aria-label="Période">
        {PERIODS.map((x) => <Link key={x.k} href={`/bilan?p=${x.k}`} scroll={false} className={`rounded-full border px-3 py-1 text-xs ${period.k === x.k ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft"}`}>{x.t}</Link>)}
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
