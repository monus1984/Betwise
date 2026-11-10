"use client";

import { useState, useTransition } from "react";
import { setSelectionOrigin } from "@/lib/bets/actions";

export type SourceOpt = { id: string; nom: string };

/** Origine d'une sélection, modifiable en un tap : affiche le nom, ouvre une rangée de puces. */
export function OriginPicker({ selectionId, current, currentName, sources }: { selectionId: string; current: string; currentName: string; sources: SourceOpt[] }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const name = sources.find((s) => s.id === value)?.nom ?? currentName;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-slate-700 underline decoration-dotted underline-offset-2" title="Changer l’origine">
        {name}{pending ? "…" : ""}
      </button>
    );
  }
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      {sources.map((s) => (
        <button
          key={s.id}
          type="button"
          disabled={pending}
          onClick={() => {
            setValue(s.id); setOpen(false); setErr(null);
            start(async () => { const r = await setSelectionOrigin(selectionId, s.id); if (!r.ok) { setErr(r.error); setValue(current); } });
          }}
          className={`rounded-full border px-2 py-0.5 text-[11px] ${s.id === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}
        >
          {s.nom}
        </button>
      ))}
      <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-slate-500">annuler</button>
      {err && <span className="text-[11px] text-red-700">{err}</span>}
    </span>
  );
}
