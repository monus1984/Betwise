"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBet, removeSelection, reopenBet } from "@/lib/bets/actions";

/** Gérer un pari (25/11) : rouvrir un pari réglé pour le corriger, ou le supprimer, à tout moment, après confirmation. */
export function GererPari({ betId, regle, test, montante }: { betId: string; regle: boolean; test: boolean; montante: boolean }) {
  const [mode, setMode] = useState<"rien" | "rouvrir" | "supprimer">("rien");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (f: () => Promise<{ ok: boolean; error?: string }>, apres: () => void) => start(async () => { setErr(null); const r = await f(); if (!r.ok) setErr(r.error ?? "Action impossible."); else apres(); });
  return (
    <section className="mt-5 rounded-xl border border-line bg-surface p-4" aria-label="Gérer ce pari">
      <h2 className="text-sm font-semibold">Gérer ce {test ? "test" : "pari"}</h2>
      {mode === "rien" && (
        <div className="mt-2 flex gap-2">
          {regle && <button onClick={() => setMode("rouvrir")} className="flex-1 rounded-xl border border-line py-2.5 text-[13px] font-medium text-ink-soft">Rouvrir pour corriger</button>}
          <button onClick={() => setMode("supprimer")} className="flex-1 rounded-xl border border-line py-2.5 text-[13px] font-medium text-loss">Supprimer</button>
        </div>
      )}
      {mode === "rouvrir" && (
        <div className="mt-2 space-y-2">
          <p className="text-[13px] leading-snug">Le pari repasse « en cours » : {test ? "" : "son gain ou son remboursement est retiré de ta bankroll (la mise reste), "}tu peux corriger la mise, les cotes et les lignes, puis il sera réglé de nouveau.</p>
          <div className="flex gap-2">
            <button onClick={() => setMode("rien")} className="flex-1 rounded-xl border border-line py-2.5 text-[13px] text-ink-soft">Annuler</button>
            <button disabled={pending} onClick={() => go(() => reopenBet(betId), () => { setMode("rien"); router.refresh(); })} className="flex-1 rounded-xl bg-inverse py-2.5 text-[13px] font-semibold text-on-inverse disabled:opacity-50">{pending ? "…" : "Rouvrir"}</button>
          </div>
        </div>
      )}
      {mode === "supprimer" && (
        <div className="mt-2 space-y-2">
          <p className="text-[13px] leading-snug">Supprimer ce {test ? "test" : "pari"} ? {test ? "" : "Ses mouvements de bankroll (mise, gain) partent avec lui. "}{montante ? "Il sera retiré de sa montante. " : ""}La suppression est définitive.</p>
          <div className="flex gap-2">
            <button onClick={() => setMode("rien")} className="flex-1 rounded-xl border border-line py-2.5 text-[13px] text-ink-soft">Garder</button>
            <button disabled={pending} onClick={() => go(() => deleteBet(betId), () => router.push("/paris"))} className="flex-1 rounded-xl bg-loss py-2.5 text-[13px] font-semibold text-on-fill disabled:opacity-50">{pending ? "…" : "Supprimer"}</button>
          </div>
        </div>
      )}
      {err && <p className="mt-2 text-[12px] text-loss">{err}</p>}
    </section>
  );
}

/** Retirer une ligne d'un combiné en cours (la cote totale est recalculée). */
export function RetirerLigne({ selectionId }: { selectionId: string }) {
  const [sure, setSure] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!sure) return <button type="button" onClick={() => setSure(true)} className="text-[12px] text-loss underline">Retirer cette ligne</button>;
  return (
    <span className="text-[12px]">
      Retirer cette ligne du combiné ?{" "}
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await removeSelection(selectionId); if (!r.ok) setErr(r.error); else router.refresh(); })} className="font-semibold text-loss underline">Oui</button>
      {" · "}<button type="button" onClick={() => setSure(false)} className="underline">Non</button>
      {err && <span className="block text-loss">{err}</span>}
    </span>
  );
}
