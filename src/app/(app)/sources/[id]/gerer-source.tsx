"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSource, updateSource } from "@/lib/sources/actions";

const TYPES: [string, string][] = [["tipster", "Pronostiqueur"], ["page_facebook", "Page Facebook"], ["compte_instagram", "Compte Instagram"], ["canal_telegram", "Canal Telegram"], ["site", "Site de prédictions"]];

/** Renommer, changer le type ou la visibilité d'une source qu'on a créée, ou la supprimer (25/11). */
export function GererSource({ id, nom, type, visibilite, pronos }: { id: string; nom: string; type: string; visibilite: "privee" | "partagee"; pronos: number }) {
  const [mode, setMode] = useState<"rien" | "modifier" | "supprimer">("rien");
  const [n, setN] = useState(nom), [t, setT] = useState(type), [v, setV] = useState(visibilite);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <section className="mt-5 rounded-xl border border-line bg-surface p-4" aria-label="Gérer cette source">
      <h2 className="text-sm font-semibold">Gérer cette source</h2>
      {mode === "rien" && (
        <div className="mt-2 flex gap-2">
          <button onClick={() => setMode("modifier")} className="flex-1 rounded-xl border border-line py-2.5 text-[13px] font-medium text-ink-soft">Modifier</button>
          <button onClick={() => setMode("supprimer")} className="flex-1 rounded-xl border border-line py-2.5 text-[13px] font-medium text-loss">Supprimer</button>
        </div>
      )}
      {mode === "modifier" && (
        <div className="mt-2 space-y-2.5">
          <label className="block text-[12px] text-ink-muted">Nom<input value={n} onChange={(e) => setN(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[15px] text-ink" /></label>
          <label className="block text-[12px] text-ink-muted">Type<select value={t} onChange={(e) => setT(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[15px] text-ink">{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <fieldset className="text-[13px]"><legend className="text-[12px] text-ink-muted">Visibilité</legend>
            <label className="mr-4"><input type="radio" checked={v === "privee"} onChange={() => setV("privee")} /> Privée (toi seul)</label>
            <label><input type="radio" checked={v === "partagee"} onChange={() => setV("partagee")} /> Partagée</label>
          </fieldset>
          <div className="flex gap-2">
            <button onClick={() => setMode("rien")} className="flex-1 rounded-xl border border-line py-2.5 text-[13px] text-ink-soft">Annuler</button>
            <button disabled={pending || n.trim().length < 2} onClick={() => start(async () => { setErr(null); const r = await updateSource({ id, nom: n, type: t, visibilite: v }); if (!r.ok) setErr(r.error); else { setMode("rien"); router.refresh(); } })} className="flex-1 rounded-xl bg-brand py-2.5 text-[13px] font-semibold text-on-fill disabled:opacity-50">{pending ? "…" : "Enregistrer"}</button>
          </div>
        </div>
      )}
      {mode === "supprimer" && (
        <div className="mt-2 space-y-2">
          <p className="text-[13px] leading-snug">Supprimer « {nom} »{pronos ? ` et ses ${pronos} prono${pronos > 1 ? "s" : ""}` : ""} ? Tes paris restent, sans cette origine. La suppression est définitive.</p>
          <div className="flex gap-2">
            <button onClick={() => setMode("rien")} className="flex-1 rounded-xl border border-line py-2.5 text-[13px] text-ink-soft">Garder</button>
            <button disabled={pending} onClick={() => start(async () => { setErr(null); const r = await deleteSource(id); if (!r.ok) setErr(r.error); else router.push("/sources?f=suivies"); })} className="flex-1 rounded-xl bg-loss py-2.5 text-[13px] font-semibold text-on-fill disabled:opacity-50">{pending ? "…" : "Supprimer"}</button>
          </div>
        </div>
      )}
      {err && <p className="mt-2 text-[12px] text-loss">{err}</p>}
    </section>
  );
}
