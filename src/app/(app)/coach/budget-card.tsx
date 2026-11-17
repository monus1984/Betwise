import { Card, fcfa } from "@/components/ui";
import { setBudget } from "@/lib/coach/actions";
import type { EtatBudget } from "@/lib/coach/budget";

/** Budget de la semaine : deux jauges (misé, perdu) et le formulaire pour le fixer. Aucun objectif de gain. */
export function BudgetCard({ budget, etat, soldeTotal }: { budget: { miseSemaine: number; perteMaxSemaine: number } | null; etat: EtatBudget | null; soldeTotal: number }) {
  const conseil = soldeTotal > 0 ? Math.max(500, Math.round((soldeTotal * 0.25) / 500) * 500) : null;
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Mon budget de la semaine</h2>
        {etat && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${etat.statut === "atteint" ? "bg-loss-soft text-loss-ink" : etat.statut === "proche" ? "bg-draw-soft text-draw-ink" : "bg-gain-soft text-gain-ink"}`}>{etat.statut === "atteint" ? "Atteint" : etat.statut === "proche" ? "Proche de la limite" : "Dans le budget"}</span>}
      </div>
      {budget && etat ? (
        <div className="mt-3 space-y-3">
          <Jauge mot="Misé depuis lundi" v={etat.mises} max={budget.miseSemaine} part={etat.partMises} />
          <Jauge mot="Perdu depuis lundi" v={etat.perte} max={budget.perteMaxSemaine} part={etat.partPerte} perte />
          {etat.motif && <p className={`rounded-lg p-2 text-[12px] leading-snug ${etat.statut === "atteint" ? "bg-loss-soft text-loss-ink" : "bg-draw-soft text-draw-ink"}`}>{etat.motif}</p>}
        </div>
      ) : (
        <p className="mt-1 text-[13px] leading-snug text-ink-muted">Fixe ce que tu t’autorises à miser et à perdre par semaine. Le Coach te prévient quand tu t’en approches ; la décision reste la tienne.</p>
      )}
      <details className="mt-3" open={!budget}>
        <summary className="cursor-pointer text-xs font-medium text-brand">{budget ? "Modifier mon budget" : "Fixer mon budget"}</summary>
        <form action={setBudget} className="mt-2 grid grid-cols-2 gap-2">
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-soft">Mises par semaine</span>
            <input name="mise" inputMode="numeric" required defaultValue={budget?.miseSemaine ?? ""} placeholder={conseil ? String(conseil) : "F CFA"} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base" /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-soft">Perte maximale</span>
            <input name="perte" inputMode="numeric" required defaultValue={budget?.perteMaxSemaine ?? ""} placeholder={conseil ? String(Math.round(conseil / 2)) : "F CFA"} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base" /></label>
          <button className="col-span-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-on-fill">Enregistrer</button>
        </form>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">La perte maximale ne peut pas dépasser le budget de mise. {conseil ? `Repère : un quart de ta bankroll en mises, soit environ ${fcfa(conseil)}, et la moitié de ce montant en perte.` : ""} La semaine va du lundi au dimanche.</p>
      </details>
    </Card>
  );
}

function Jauge({ mot, v, max, part, perte }: { mot: string; v: number; max: number; part: number; perte?: boolean }) {
  const p = Math.min(1, Math.max(0, part));
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]"><span className="text-ink-soft">{mot}</span><span className="tabular-nums"><b>{fcfa(v)}</b> <span className="text-ink-muted">sur {fcfa(max)}</span></span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={mot}>
        <div className={`h-2 rounded-full ${part >= 1 ? "bg-loss" : part >= 0.8 ? "bg-draw" : perte ? "bg-ink-muted" : "bg-brand"}`} style={{ width: `${Math.max(p * 100, v > 0 ? 3 : 0)}%` }} />
      </div>
    </div>
  );
}
