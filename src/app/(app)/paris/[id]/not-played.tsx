"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { convertBetToTest } from "@/lib/bets/actions";

/** Ticket importé (d'un groupe, d'un tipster) mais jamais joué : le passer en test rétablit la bankroll. */
export function NotPlayed({ betId }: { betId: string }) {
  const [ask, setAsk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <section className="mt-6 rounded-xl border border-line bg-white p-3">
      <h2 className="text-sm font-semibold">Tu n’as pas joué ce pari ?</h2>
      <p className="mt-1 text-xs text-ink-muted">Passe-le en test : il reste suivi et réglé automatiquement, la source continue d’être notée, et ta bankroll est rétablie comme s’il n’avait jamais été misé.</p>
      {!ask ? (
        <button type="button" onClick={() => setAsk(true)} className="mt-2 rounded-lg border border-brand/40 px-3 py-2 text-sm font-medium text-brand">Je ne l’ai pas joué</button>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button type="button" disabled={pending} onClick={() => start(async () => { const r = await convertBetToTest(betId); if (r.ok) router.refresh(); else setErr(r.error); })} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Conversion…" : "Confirmer : passer en test"}</button>
          <button type="button" onClick={() => { setAsk(false); setErr(null); }} className="text-sm text-ink-muted">Annuler</button>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
    </section>
  );
}
