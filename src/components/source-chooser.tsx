"use client";

import { useEffect, useState, useTransition } from "react";
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
const CLE_RECENTES = "betwise.sourcesRecentes";

export function SourceChooser({ sources, value, onChange, onCreated, size = "md" }: {
  sources: SourceOpt[]; value: string | null; onChange: (id: string) => void; onCreated?: (s: SourceOpt) => void; size?: "sm" | "md";
}) {
  const [adding, setAdding] = useState(false);
  const [nom, setNom] = useState("");
  const [type, setType] = useState("tipster");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const chip = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  // 27/11 : « Moi » + les 4 sources utilisées le plus récemment en boutons ; toutes les autres dans une liste déroulante
  const [recentes, setRecentes] = useState<string[]>([]);
  useEffect(() => { try { setRecentes(JSON.parse(localStorage.getItem(CLE_RECENTES) ?? "[]")); } catch { /* ignore */ } }, []);
  const choisir = (id: string) => {
    onChange(id);
    const l = [id, ...recentes.filter((x) => x !== id)].slice(0, 12);
    setRecentes(l);
    try { localStorage.setItem(CLE_RECENTES, JSON.stringify(l)); } catch { /* ignore */ }
  };
  const moi = sources.find((x) => x.type === "perso");
  const recents = recentes.map((id) => sources.find((x) => x.id === id)).filter((x): x is SourceOpt => !!x && x.type !== "perso").slice(0, 4);
  const choisie = value ? sources.find((x) => x.id === value) : null;
  const boutons = [moi, ...recents, choisie && choisie !== moi && !recents.includes(choisie) ? choisie : null].filter((x): x is SourceOpt => !!x);
  const reste = sources.filter((x) => !boutons.includes(x));

  function create() {
    setErr(null);
    start(async () => {
      const r = await quickCreateSource({ nom, type });
      if (!r.ok) { setErr(r.error); return; }
      onCreated?.(r.source);
      choisir(r.source.id);
      setAdding(false); setNom("");
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {boutons.map((s) => (
          <button key={s.id} type="button" onClick={() => choisir(s.id)}
            className={`inline-flex items-center gap-1 rounded-full border transition ${chip} ${value === s.id ? "border-inverse bg-inverse text-on-inverse" : "border-line bg-surface text-ink-soft active:bg-surface-2"}`}>
            <span aria-hidden className="text-[0.9em]">{TYPE_ICON[s.type ?? ""] ?? "•"}</span>{s.nom}
          </button>
        ))}
        {reste.length > 0 && (
          <select value="" onChange={(e) => e.target.value && choisir(e.target.value)} aria-label="Autres sources"
            className={`rounded-full border border-line bg-surface text-ink-soft ${chip}`}>
            <option value="">Autres sources ({reste.length})…</option>
            {reste.map((x) => <option key={x.id} value={x.id}>{TYPE_ICON[x.type ?? ""] ?? "•"} {x.nom}</option>)}
          </select>
        )}
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={`rounded-full border border-dashed border-brand/60 text-brand ${chip}`}>+ Nouvelle source</button>
        )}
      </div>
      {adding && (
        <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3">
          <input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du tipster, de la page ou du canal"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-inverse" />
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((t) => (
              <button key={t.v} type="button" onClick={() => setType(t.v)} className={`rounded-full border px-2.5 py-1 text-xs ${type === t.v ? "border-inverse bg-inverse text-on-inverse" : "border-line bg-surface text-ink-soft"}`}>{TYPE_ICON[t.v]} {t.label}</button>
            ))}
          </div>
          {err && <p className="text-xs text-loss">{err}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={pending || nom.trim().length < 2} onClick={create} className="flex-1 rounded-lg bg-inverse py-2 text-sm font-medium text-on-inverse disabled:opacity-40">{pending ? "Ajout…" : "Ajouter et choisir"}</button>
            <button type="button" onClick={() => { setAdding(false); setErr(null); }} className="rounded-lg px-3 py-2 text-sm text-ink-muted">Annuler</button>
          </div>
          <p className="text-[11px] text-ink-muted">Elle sera suivie et notée automatiquement. Si elle existe déjà sous ce nom, c’est elle qui est reprise.</p>
        </div>
      )}
    </div>
  );
}
