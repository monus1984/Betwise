"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setSelectionOrigin } from "@/lib/bets/actions";
import { SourceChooser, type SourceOpt } from "@/components/source-chooser";

export type { SourceOpt };

/** Origine d'une sélection : le nom s'affiche, un tap ouvre le choix (avec création d'une source). */
export function OriginPicker({ selectionId, current, currentName, sources }: { selectionId: string; current: string; currentName: string; sources: SourceOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current);
  const [list, setList] = useState(sources);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const name = list.find((s) => s.id === value)?.nom ?? currentName;

  function choose(id: string) {
    const before = value;
    setValue(id); setOpen(false); setErr(null);
    if (id === before) return;
    start(async () => {
      const r = await setSelectionOrigin(selectionId, id);
      if (!r.ok) { setErr(r.error); setValue(before); setState("error"); return; }
      setState("saved");
      router.refresh();
      setTimeout(() => setState("idle"), 2500);
    });
  }

  return (
    <span className="inline">
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand" title="Changer l’origine">
        {name}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
      </button>
      {pending && <span className="ml-1 text-ink-muted">enregistrement…</span>}
      {state === "saved" && !pending && <span className="ml-1 text-gain">✓ enregistré</span>}
      {err && <span className="ml-1 text-loss">{err}</span>}
      {open && (
        <span className="mt-2 block rounded-xl border border-line bg-white p-2.5 shadow-card">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">Ce choix vient de…</span>
          <SourceChooser size="sm" sources={list} value={value} onChange={choose} onCreated={(s) => setList((l) => [...l, s])} />
        </span>
      )}
    </span>
  );
}
