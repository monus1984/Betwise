"use client";

import { useState, useTransition } from "react";
import { arreterMontante, rattacherPalier } from "@/lib/montantes/actions";

export function Rattacher({ montanteId, betId }: { montanteId: string; betId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="flex shrink-0 flex-col items-end">
      <button disabled={pending} onClick={() => start(async () => { const r = await rattacherPalier(montanteId, betId); if (!r.ok) setErr(r.error); })} className="rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-bold text-on-fill disabled:opacity-50">{pending ? "…" : "Rattacher"}</button>
      {err && <span className="mt-1 max-w-[180px] text-right text-[11px] text-loss">{err}</span>}
    </span>
  );
}

export function Arreter({ id }: { id: string }) {
  const [sure, setSure] = useState(false);
  const [pending, start] = useTransition();
  if (!sure) return <button onClick={() => setSure(true)} className="w-full rounded-xl border border-line py-2.5 text-[13px] font-medium text-ink-soft">Arrêter la montante</button>;
  return (
    <div className="flex gap-2">
      <button onClick={() => setSure(false)} className="flex-1 rounded-xl border border-line py-2.5 text-[13px] text-ink-soft">Continuer</button>
      <button disabled={pending} onClick={() => start(async () => { await arreterMontante(id); })} className="flex-1 rounded-xl bg-inverse py-2.5 text-[13px] font-semibold text-on-inverse">Confirmer l’arrêt</button>
    </div>
  );
}
