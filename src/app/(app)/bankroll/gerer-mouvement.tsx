"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBankrollTx, updateBankrollTx } from "@/lib/bets/actions";

/** Corriger ou supprimer un dépôt ou un retrait saisi à la main (25/11). Les mises et gains se corrigent depuis le pari. */
export function GererMouvement({ id, montant, note }: { id: string; montant: number; note: string | null }) {
  const [mode, setMode] = useState<"rien" | "modifier" | "supprimer">("rien");
  const [m, setM] = useState(String(Math.abs(montant)));
  const [n, setN] = useState(note ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const fin = (r: { ok: boolean; error?: string }) => { if (!r.ok) setErr(r.error ?? "Action impossible."); else { setMode("rien"); router.refresh(); } };
  if (mode === "rien") return <button onClick={() => setMode("modifier")} aria-label="Modifier ce mouvement" className="shrink-0 rounded-md px-1.5 py-1 text-[12px] text-ink-muted underline">Modifier</button>;
  return (
    <div className="basis-full space-y-2 pt-2">
      {mode === "modifier" ? (
        <>
          <div className="flex gap-2">
            <input inputMode="decimal" value={m} onChange={(e) => setM(e.target.value)} aria-label="Montant" className="w-28 rounded-lg border border-line bg-surface px-2 py-2 text-[15px] tabular-nums" />
            <input value={n} onChange={(e) => setN(e.target.value)} placeholder="Note (facultatif)" aria-label="Note" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-2 text-[15px]" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setMode("supprimer")} className="rounded-lg border border-line px-3 py-2 text-xs text-loss">Supprimer</button>
            <button onClick={() => setMode("rien")} className="flex-1 rounded-lg border border-line py-2 text-xs text-ink-soft">Annuler</button>
            <button disabled={pending || !(Number(m.replace(",", ".")) > 0)} onClick={() => start(async () => fin(await updateBankrollTx(id, Number(m.replace(",", ".")), n.trim())))} className="flex-1 rounded-lg bg-brand py-2 text-xs font-semibold text-on-fill disabled:opacity-50">{pending ? "…" : "Enregistrer"}</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[12.5px]">Supprimer ce mouvement ? Ton solde sera recalculé sans lui. La suppression est définitive.</p>
          <div className="flex gap-2">
            <button onClick={() => setMode("rien")} className="flex-1 rounded-lg border border-line py-2 text-xs text-ink-soft">Garder</button>
            <button disabled={pending} onClick={() => start(async () => fin(await deleteBankrollTx(id)))} className="flex-1 rounded-lg bg-loss py-2 text-xs font-semibold text-on-fill disabled:opacity-50">{pending ? "…" : "Supprimer"}</button>
          </div>
        </>
      )}
      {err && <p className="text-[12px] text-loss">{err}</p>}
    </div>
  );
}
