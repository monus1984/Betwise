"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewObjectif, setObjectif, stopObjectif } from "@/lib/coach/actions";
import type { GoalState } from "@/lib/coach/goal";

const F = (x: number) => `${Math.round(x).toLocaleString("fr-FR")} F`;
const P = (x: number) => `${Math.round(x * 100)} %`;
const DELAIS = [7, 14, 30, 60];
const STATUT: Record<GoalState["statut"], { t: string; c: string }> = {
  atteint: { t: "Objectif atteint 🎯", c: "text-gain" }, en_avance: { t: "En avance", c: "text-gain" }, dans_les_temps: { t: "Dans les temps", c: "text-ink-soft" },
  en_retard: { t: "En retard : garde la même mise, ne cherche pas à rattraper", c: "text-draw" }, echu: { t: "Échéance passée", c: "text-ink-muted" },
};

export function ObjectifCard({ goal, solde }: { goal: GoalState | null; solde: number }) {
  const [edit, setEdit] = useState(!goal);
  if (goal && !edit) return <Progress goal={goal} onEdit={() => setEdit(true)} />;
  return <GoalForm solde={solde} onCancel={goal ? () => setEdit(false) : undefined} />;
}

function Progress({ goal: g, onEdit }: { goal: GoalState; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const pct = Math.max(0, Math.min(1, g.progression));
  const s = STATUT[g.statut];
  return (
    <section className="mt-3 rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Objectif : {F(g.cible)}</h2>
        <button onClick={onEdit} className="text-xs text-brand">Modifier</button>
      </div>
      <div className="relative mt-3 h-3 rounded-full bg-surface-2">
        <div className={`h-3 rounded-full ${g.progression >= 0 ? "bg-gain" : "bg-loss"}`} style={{ width: `${Math.max(2, pct * 100)}%` }} />
        <div className="absolute -top-1 h-5 w-0.5 rounded bg-ink" style={{ left: `calc(${g.tempsEcoule * 100}% - 1px)` }} title="Où tu devrais être aujourd'hui" />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-ink-muted"><span>départ {F(g.depart)}</span><span>{F(g.solde)} · {g.joursRestants} j restants</span></div>
      <p className={`mt-2 text-sm font-medium ${s.c}`}>{s.t}</p>
      {g.plan && (
        <p className="mt-1 text-xs text-ink-soft">
          Chance d’y arriver d’ici l’échéance : <b>{P(g.plan.objectif.pAtteindre)}</b> (risque de chute {P(g.plan.objectif.pChute)}).
          {g.plan.objectif.pAtteindre < 0.25 && g.plan.raisonnable && <> Plus réaliste : <b>{F(g.plan.raisonnable.cible)}</b> ({P(g.plan.raisonnable.plan.pAtteindre)}).</>}
        </p>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Mise label="Sûr" v={g.mises.sur} cls="text-gain" />
        <Mise label="Audacieux" v={g.mises.audacieux} cls="text-draw" />
        <Mise label="Risqué" v={g.mises.risque} cls="text-loss" sub={g.mises.risque ? `budget ${F(g.mises.budgetRisque)}` : "pas encore de gains"} />
      </div>
      <p className="mt-2 text-[11px] text-ink-muted">Mise conseillée par pari aujourd’hui. Le Risqué se joue seulement avec 30 % de tes gains, pour ne jamais entamer ta bankroll de départ.</p>
      {(g.statut === "atteint" || g.statut === "echu") && (
        <button disabled={pending} onClick={() => start(async () => { await stopObjectif(); router.refresh(); })} className="mt-3 w-full rounded-lg border border-line py-2 text-sm">Clore et fixer un nouvel objectif</button>
      )}
    </section>
  );
}
function Mise({ label, v, cls, sub }: { label: string; v: number; cls: string; sub?: string }) {
  return <div className="rounded-lg bg-surface-2 p-2"><p className={`text-[11px] font-semibold ${cls}`}>{label}</p><p className="text-sm font-bold tabular-nums">{v ? F(v) : "—"}</p>{sub && <p className="text-[10px] text-ink-muted">{sub}</p>}</div>;
}

type Preview = Awaited<ReturnType<typeof previewObjectif>>;
function GoalForm({ solde, onCancel }: { solde: number; onCancel?: () => void }) {
  const router = useRouter();
  const [cible, setCible] = useState(solde > 0 ? String(Math.round((solde * 1.5) / 1000) * 1000) : "");
  const [jours, setJours] = useState(14);
  const [prev, setPrev] = useState<Preview>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const c = Number(cible.replace(/\s/g, ""));

  useEffect(() => {
    if (!(c > solde) || solde <= 0) { setPrev(null); return; }
    setLoading(true);
    const t = setTimeout(async () => { setPrev(await previewObjectif({ cible: c, jours })); setLoading(false); }, 400);
    return () => clearTimeout(t);
  }, [c, jours, solde]);

  function save(target: number) {
    setErr(null);
    start(async () => { const r = await setObjectif({ cible: target, jours }); if (!r.ok) setErr(r.error); else { onCancel?.(); router.refresh(); } });
  }

  if (solde <= 0) return (
    <section className="mt-3 rounded-xl border border-dashed border-brand/40 bg-brand-soft p-4 text-sm text-brand">
      Commence par enregistrer ta bankroll (un dépôt, en bas de page). Tu pourras ensuite te fixer un objectif : le Coach adaptera ses conseils.
    </section>
  );
  return (
    <section className="mt-3 rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-baseline justify-between"><h2 className="text-sm font-semibold">Ton objectif</h2>{onCancel && <button onClick={onCancel} className="text-xs text-ink-muted">Annuler</button>}</div>
      <p className="mt-1 text-xs text-ink-muted">Bankroll actuelle : {F(solde)}. Combien veux-tu atteindre, et en combien de temps ?</p>
      <div className="mt-3 flex items-center gap-2">
        <input inputMode="numeric" value={cible} onChange={(e) => setCible(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2.5 text-base tabular-nums" placeholder="ex. 50 000" />
        <span className="text-sm text-ink-muted">F</span>
      </div>
      <div className="mt-2 flex gap-1.5">{DELAIS.map((d) => <button key={d} onClick={() => setJours(d)} className={`flex-1 rounded-full border py-1.5 text-xs ${jours === d ? "border-ink bg-ink text-white" : "border-line text-ink-soft"}`}>{d} jours</button>)}</div>

      {loading && <p className="mt-3 text-xs text-ink-muted">Calcul…</p>}
      {!loading && prev && (
        <div className="mt-3 space-y-1.5 rounded-lg bg-surface-2 p-3 text-sm">
          <p>Chance d’atteindre {F(c)} en {jours} j : <b className={prev.objectif.pAtteindre >= 0.4 ? "text-gain" : prev.objectif.pAtteindre >= 0.15 ? "text-draw" : "text-loss"}>{P(prev.objectif.pAtteindre)}</b> · risque de chute <b>{P(prev.objectif.pChute)}</b></p>
          <p className="text-xs text-ink-muted">Il faudrait miser {P(prev.objectif.mise)} de ta bankroll par pari, {prev.objectif.mix}.</p>
          {prev.raisonnable && prev.objectif.pAtteindre < 0.4 && <p>Raisonnable en {jours} j : <b>{F(prev.raisonnable.cible)}</b> ({P(prev.raisonnable.plan.pAtteindre)} de chances, risque {P(prev.raisonnable.plan.pChute)})</p>}
        </div>
      )}
      {err && <p className="mt-2 text-xs text-loss">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button disabled={pending || !(c > solde)} onClick={() => save(c)} className="flex-1 rounded-lg bg-ink py-2.5 text-sm font-medium text-white disabled:opacity-40">Valider {c > solde ? F(c) : ""}</button>
        {prev?.raisonnable && prev.objectif.pAtteindre < 0.4 && <button disabled={pending} onClick={() => save(prev.raisonnable!.cible)} className="flex-1 rounded-lg border border-ink py-2.5 text-sm font-medium">Prendre {F(prev.raisonnable.cible)}</button>}
      </div>
    </section>
  );
}
