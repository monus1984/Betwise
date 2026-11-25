"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { arreterMontante, detacherPalier, rattacherPalier, reprendreMontante, supprimerMontante } from "@/lib/montantes/actions";
import { NouvelleMontante, type EditionMontante } from "../nouvelle";

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

/** Modifier ou supprimer : la suppression détache les paris (ils restent dans Mes paris), après confirmation. */
export function ModifierSupprimer({ edition }: { edition: EditionMontante }) {
  const [mode, setMode] = useState<"rien" | "modifier" | "supprimer">("rien");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (mode === "modifier") return <NouvelleMontante ouverte edition={edition} onFin={() => setMode("rien")} />;
  if (mode === "supprimer") return (
    <div className="tile space-y-2 p-3">
      <p className="text-[13px] leading-snug">Supprimer « {edition.nom} » ? {edition.joues ? `Ses ${edition.joues} pari${edition.joues > 1 ? "s" : ""} rest${edition.joues > 1 ? "ent" : "e"} dans Mes paris et ta bankroll, sans la montante.` : "Aucun pari n’y est rattaché."} La suppression est définitive.</p>
      <div className="flex gap-2">
        <button onClick={() => setMode("rien")} className="flex-1 rounded-xl border border-line py-2.5 text-[13px] text-ink-soft">Garder</button>
        <button disabled={pending} onClick={() => start(async () => { const r = await supprimerMontante(edition.id); if (!r.ok) setErr(r.error); else router.push("/montantes"); })} className="flex-1 rounded-xl bg-loss py-2.5 text-[13px] font-semibold text-on-fill disabled:opacity-50">{pending ? "…" : "Supprimer"}</button>
      </div>
      {err && <p className="text-[12px] text-loss">{err}</p>}
    </div>
  );
  return (
    <div className="flex gap-2">
      <button onClick={() => setMode("modifier")} className="flex-1 rounded-xl border border-line py-2.5 text-[13px] font-medium text-ink-soft">Modifier</button>
      <button onClick={() => setMode("supprimer")} className="flex-1 rounded-xl border border-line py-2.5 text-[13px] font-medium text-loss">Supprimer</button>
    </div>
  );
}

/** Détacher le dernier palier (25/11) : le pari reste dans « Mes paris », la montante revient au palier d'avant. */
export function Detacher({ montanteId, betId }: { montanteId: string; betId: string }) {
  const [sure, setSure] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!sure) return <button onClick={() => setSure(true)} className="pb-2 text-[12px] text-ink-muted underline">Détacher ce palier</button>;
  return (
    <div className="pb-2.5 text-[12.5px]">
      <p>Détacher ce palier ? Le pari reste dans tes paris ; la montante revient au palier d’avant.</p>
      <div className="mt-1.5 flex gap-2">
        <button onClick={() => setSure(false)} className="flex-1 rounded-lg border border-line py-2 text-xs text-ink-soft">Garder</button>
        <button disabled={pending} onClick={() => start(async () => { const r = await detacherPalier(montanteId, betId); if (!r.ok) setErr(r.error); else { setSure(false); router.refresh(); } })} className="flex-1 rounded-lg bg-inverse py-2 text-xs font-semibold text-on-inverse disabled:opacity-50">{pending ? "…" : "Détacher"}</button>
      </div>
      {err && <p className="mt-1 text-loss">{err}</p>}
    </div>
  );
}

export function Reprendre({ id }: { id: string }) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div>
      <button disabled={pending} onClick={() => start(async () => { const r = await reprendreMontante(id); if (!r.ok) setErr(r.error); else router.refresh(); })} className="w-full rounded-xl bg-brand py-3 text-[14px] font-bold text-on-fill disabled:opacity-50">{pending ? "…" : "Reprendre la montante"}</button>
      {err && <p className="mt-1 text-[12px] text-loss">{err}</p>}
    </div>
  );
}
