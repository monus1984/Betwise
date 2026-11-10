"use client";

import { useState, useTransition } from "react";
import { quickCreateSource } from "@/lib/sources/actions";

export type SourceOpt = { id: string; nom: string; type?: string };

const TYPES: { v: string; label: string }[] = [
  { v: "tipster", label: "Tipster" },
  { v: "canal_telegram", label: "Telegram" },
  { v: "page_facebook", label: "Facebook" },
  { v: "compte_instagram", label: "Instagram" },
  { v: "site", label: "Site" },
];
const TYPE_ICON: Record<string, string> = { perso: "👤", tipster: "🎯", canal_telegram: "✈️", page_facebook: "📘", compte_instagram: "📷", site: "🌐", modele_betwise: "📊" };

/**
 * Choix de l'origine d'une sélection, avec création d'une source sur place.
 * onCreated permet au parent de partager la nouvelle source entre plusieurs lignes.
 */
export function SourceChooser({ sources, value, onChange, onCreated, size = "md" }: {
  sources: SourceOpt[]; value: string | null; onChange: (id: string) => void; onCreated?: (s: SourceOpt) => void; size?: "sm" | "md";
}) {
  const [adding, setAdding] = useState(false);
  const [nom, setNom] = useState("");
  const [type, setType] = useState("tipster");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const chip = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";

  function create() {
    setErr(null);
    start(async () => {
      const r = await quickCreateSource({ nom, type });
      if (!r.ok) { setErr(r.error); return; }
      onCreated?.(r.source);
      onChange(r.source.id);
      setAdding(false); setNom("");
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <button key={s.id} type="button" onClick={() => onChange(s.id)}
            className={`inline-flex items-center gap-1 rounded-full border transition ${chip} ${value === s.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft active:bg-surface-2"}`}>
            <span aria-hidden className="text-[0.9em]">{TYPE_ICON[s.type ?? ""] ?? "•"}</span>{s.nom}
          </button>
        ))}
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={`rounded-full border border-dashed border-brand/60 text-brand ${chip}`}>+ Nouvelle source</button>
        )}
      </div>
      {adding && (
        <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3">
          <input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du tipster, de la page ou du canal"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }}
            className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base outline-none focus:border-ink" />
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((t) => (
              <button key={t.v} type="button" onClick={() => setType(t.v)} className={`rounded-full border px-2.5 py-1 text-xs ${type === t.v ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft"}`}>{TYPE_ICON[t.v]} {t.label}</button>
            ))}
          </div>
          {err && <p className="text-xs text-loss">{err}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={pending || nom.trim().length < 2} onClick={create} className="flex-1 rounded-lg bg-ink py-2 text-sm font-medium text-white disabled:opacity-40">{pending ? "Ajout…" : "Ajouter et choisir"}</button>
            <button type="button" onClick={() => { setAdding(false); setErr(null); }} className="rounded-lg px-3 py-2 text-sm text-ink-muted">Annuler</button>
          </div>
          <p className="text-[11px] text-ink-muted">Elle sera suivie et notée automatiquement. Si elle existe déjà sous ce nom, c’est elle qui est reprise.</p>
        </div>
      )}
    </div>
  );
}
