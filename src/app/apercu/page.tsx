import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge, Button, Card, Chip, Empty, Field, Input, Notice, fcfa, type Etat } from "@/components/ui";
import { LineChart } from "@/components/line-chart";
import { TabBar } from "@/components/tab-bar";
import { ThemeChoice } from "@/components/theme-choice";

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
      <PageHeader title="Planche de contrôle" subtitle="Données fictives, réservées au développement." />
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
