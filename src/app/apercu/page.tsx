import { notFound } from "next/navigation";
import { Badge, Button, Card, Chip, Empty, Field, Input, Notice, fcfa, type Etat } from "@/components/ui";
import { LineChart } from "@/components/line-chart";
import { TabBar } from "@/components/tab-bar";
import { ThemeChoice } from "@/components/theme-choice";
import { Sparkline } from "@/components/sparkline";
import { Mark } from "@/components/icons";
import { MatchSources } from "@/app/(app)/matchs/[id]/sources-tab";
import { VIDE } from "@/lib/sources/proof";
import { BudgetCard } from "@/app/(app)/coach/budget-card";
import { etatBudget } from "@/lib/coach/budget";

/**
 * Planche des composants communs, pour contrôler les deux thèmes sans compte.
 * DONNÉES FICTIVES : rien ici ne vient de la base. La page n'existe pas en production.
 */
export default function Apercu() {
  if (process.env.NODE_ENV === "production") notFound();
  const etats: Etat[] = ["gagne", "perdu", "rembourse", "en_cours", "a_confirmer", "test", "estimation"];
  const pts = [1200, -800, 2400, 1900, 3100, 2200, 4600].map((y, i, a) => ({ at: `2026-01-0${i + 1}`, y, delta: i ? y - a[i - 1] : y, libelle: `Pari fictif ${i + 1}` }));
  return (
    <div className="mx-auto max-w-xl px-4 pb-44 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <p className="mb-3 rounded-lg bg-surface-2 px-3 py-1.5 text-center text-[11px] text-ink-muted">Planche de contrôle · données fictives, réservées au développement</p>
      <header className="mb-4 flex items-center justify-between gap-3"><span className="flex items-center gap-2"><Mark className="h-7 w-7" /><span className="text-lg font-bold tracking-tight">APPLI</span></span></header>
      <h1 className="text-2xl font-bold leading-tight tracking-tight">Bonjour Testeur</h1>
      <p className="mb-3 text-[13px] text-ink-muted">Ton aperçu du jour</p>
      <div className="card-hero rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[13px] font-medium text-ink-soft">Ta bankroll</p><p className="mt-0.5 text-[34px] font-bold leading-none tabular-nums">{fcfa(123456)}</p></div>
          <div className="flex flex-col items-end gap-1"><Sparkline values={[0, 1200, -800, 2400, 1900, 3100, 2200, 4600]} className="h-11 w-28" label="Tendance" /><span className="rounded-full bg-gain-soft px-2 py-0.5 text-[11px] font-semibold text-gain-ink">+4 600 F · 7 j</span></div>
        </div>
        <p className="mt-2 text-[11px] text-ink-muted">Compte A 100 000 F · Compte B 23 456 F</p>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {[["En jeu", "6 000 F", "2 paris en cours"], ["Rendement", "+9 %", "+4 118 F net"], ["Paris gagnés", "4 sur 17", "24 % · attendu 18 %"]].map(([a, b, c]) => <div key={a} className="tile p-3"><p className="text-[11px] text-ink-muted">{a}</p><p className="mt-0.5 text-lg font-bold leading-tight tabular-nums">{b}</p><p className="text-[10px] text-ink-muted">{c}</p></div>)}
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-draw/50 bg-draw-soft p-3">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-draw"><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4.5" /><path d="M12 17.3v.2" /></svg>
        <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold uppercase tracking-wide text-draw">Point de vigilance</span><span className="block text-sm font-semibold leading-snug text-draw-ink">Un pari en cours engage 14 % de ta bankroll</span><span className="mt-0.5 block text-[12px] leading-snug text-draw-ink">Règle : pas plus de 10 % sur un seul pari.</span></span>
        <span aria-hidden className="text-draw">›</span>
      </div>
      <h2 className="mt-5 text-base font-bold">Que veux-tu faire ?</h2>
      <div className="mb-6 mt-2 grid grid-cols-2 gap-2">
        {["Scanner un ticket", "Analyser un match"].map((t) => <div key={t} className="tile tile-action flex flex-col items-center gap-2 px-3 py-4 text-center text-sm font-medium"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden className="text-brand"><circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" /></svg>{t}</div>)}
      </div>
      <h2 className="mb-2 text-base font-bold">Coach (fictif)</h2>
      <BudgetCard soldeTotal={30000} budget={{ miseSemaine: 8000, perteMaxSemaine: 4000 }} etat={etatBudget({ miseSemaine: 8000, perteMaxSemaine: 4000 }, [{ mise: 3500, statut: "perdu", gain_net: -3500, placed_at: new Date().toISOString(), settled_at: new Date().toISOString() }, { mise: 2000, statut: "en_cours", gain_net: null, placed_at: new Date().toISOString(), settled_at: null }])} />
      <div className="mb-6 mt-3 rounded-2xl rounded-bl-sm border border-line bg-surface px-3.5 py-3 text-sm">
        <p>Je ne propose pas de pari maintenant : tu demandes un pari pour rattraper une perte, c’est la situation où l’on mise le plus mal. Regarde plutôt ton bilan de la semaine.</p>
        <p className="mt-2 rounded-lg bg-draw-soft px-2.5 py-1.5 text-[12px] font-medium text-draw-ink">Garde-fou actif : le Coach ne propose pas de pari dans cette réponse.</p>
        <div className="tile tile-action mt-2 flex items-center gap-3 px-3 py-2.5"><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">Bilan détaillé</span><span className="block truncate text-[11px] text-ink-muted">Réussite et rendement par type, marché, bookmaker</span></span><span aria-hidden className="text-brand">›</span></div>
      </div>
      <h2 className="mb-2 text-base font-bold">Fiche match, onglet Sources (fictif)</h2>
      <div className="mb-6"><MatchSources home="Équipe A" away="Équipe B" joue={false}
        pronos={[{ id: "1", sourceId: "a", source: "Source A", market: "1X2", param: null, sel: "1", cote: 1.8, prouve: true, resultat: "en_attente" }, { id: "2", sourceId: "b", source: "Source B", market: "DC", param: null, sel: "N2", cote: 1.5, prouve: false, resultat: "en_attente" }, { id: "3", sourceId: "a", source: "Source A", market: "OU", param: 2.5, sel: "Plus", cote: null, prouve: true, resultat: "en_attente" }]}
        proofs={{ a: { ...VIDE, prouves: 24, prouvesRegles: 24, prouvesGagnes: 19 }, b: { ...VIDE, apresCoup: 27 } }} /></div>
      <h2 className="mb-2 text-base font-bold">Sources (fictif)</h2>
      <section className="rounded-2xl bg-pitch p-5 text-white">
        <div className="flex items-baseline justify-between gap-3"><p className="text-xs font-medium text-white/70">Pronos prouvés</p><span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">Tendance</span></div>
        <p className="mt-1 text-3xl font-bold tabular-nums">19 justes sur 24</p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div><p className="text-[11px] text-white/60">Réussite</p><p className="font-semibold">79 %</p></div>
          <div><p className="text-[11px] text-white/60">Attendu à ces cotes</p><p className="font-semibold">76 %</p></div>
          <div><p className="text-[11px] text-white/60">Rendement</p><p className="font-semibold text-band-gain">+4 %</p></div>
        </div>
      </section>
      <p className="mt-2 rounded-xl border border-draw/40 bg-draw-soft p-3 text-[13px] leading-snug text-draw-ink"><b>27 pronos saisis après le coup d’envoi</b> (24 justes sur 27). Ils restent dans l’historique mais ne comptent pas dans la note.</p>
      <ol className="mb-6 mt-3 space-y-2">
        {[["1", "Source A", "+6 %", "35"], ["2", "Source B", "+4 %", "24"]].map(([r, n, x, v]) => (
          <li key={r} className="tile flex items-center gap-3 p-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${r === "1" ? "bg-draw text-on-fill" : "bg-surface-2 text-ink-soft"}`}>{r}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{n}</span><span className="block text-[11px] text-ink-muted">Canal Telegram · {v} pronos prouvés · Tendance</span><span className="mt-0.5 block text-[12px] text-ink-soft">Réussite 79 % · attendu à ces cotes 76 %</span></span>
            <span className="shrink-0 text-right"><span className="block text-base font-bold tabular-nums text-gain">{x}</span><span className="block text-[10px] text-ink-muted">rendement · {v} cotes</span></span>
          </li>
        ))}
      </ol>
      <div className="space-y-4">
        <Card><ThemeChoice /></Card>
        <Card>
          <p className="text-xs text-ink-muted">Solde (fictif)</p>
          <p className="text-3xl font-bold tabular-nums">{fcfa(123456)}</p>
          <p className="mt-1 text-sm"><span className="font-semibold text-gain">+{fcfa(4600)}</span> <span className="text-ink-muted">gains moins pertes</span> · <span className="font-semibold text-loss">−{fcfa(800)}</span></p>
          <div className="mt-3"><LineChart points={pts} unit="F" empty="" /></div>
        </Card>
        <Card className="space-y-3">
          <div className="flex flex-wrap gap-1.5">{etats.map((e) => <Badge key={e} etat={e} />)}</div>
          <div className="flex gap-2 overflow-x-auto"><Chip active>7 jours</Chip><Chip>30 jours</Chip><Chip>Tout</Chip></div>
          <Field label="Mise" hint="En F CFA"><Input defaultValue="1 000" inputMode="numeric" /></Field>
          <Button>Enregistrer</Button>
          <Button variant="ghost">Annuler</Button>
          <Button variant="danger">Retirer</Button>
          <p className="text-sm">Un <a className="font-medium text-brand underline" href="#">lien</a> dans une phrase, du texte <span className="text-ink-soft">secondaire</span> et <span className="text-ink-muted">discret</span>.</p>
        </Card>
        <Notice>Cote illisible sur cette ligne : corrige-la avant d’enregistrer.</Notice>
        <Notice kind="info">Estimation tirée des cotes de référence.</Notice>
        <div className="rounded-xl border border-draw/40 bg-draw-soft p-3 text-sm text-draw-ink">Résultat à confirmer, ticket en main.</div>
        <div className="rounded-xl border border-gain/30 bg-gain-soft p-3 text-sm text-gain-ink">Pari gagné.</div>
        <Card className="divide-y divide-line !p-0">
          {["Équipe A – Équipe B", "Équipe C – Équipe D"].map((m, i) => (
            <div key={m} className="flex items-center justify-between px-4 py-3"><div><p className="text-sm font-medium">{m}</p><p className="text-xs text-ink-muted">Plus de 1,5 but · cote 1,45</p></div><span className={`text-sm font-semibold tabular-nums ${i ? "text-loss" : "text-gain"}`}>{i ? "−1 000 F" : "+450 F"}</span></div>
          ))}
        </Card>
        <div aria-busy="true" className="space-y-2"><div className="skeleton h-5 w-40" /><div className="skeleton h-16 w-full" /></div>
        <Empty titre="Aucun pari sur cette période" action={<Button className="!w-auto px-6">Ajouter un pari</Button>}>Change de période, ou enregistre ton premier pari.</Empty>
      </div>
      <TabBar />
    </div>
  );
}
