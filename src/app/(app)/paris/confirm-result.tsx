"use client";
import { APP_NAME } from "@/lib/app-name";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { settleBet } from "@/lib/bets/actions";
import { fcfa } from "@/components/ui";

type Res = "gagne" | "perdu" | "rembourse";
const MOT: Record<Res, string> = { gagne: "gagné", perdu: "perdu", rembourse: "remboursé" };

/**
 * Règlement d'un pari en cours.
 * Pari réel dont les matchs sont joués : BETWISE propose un résultat, l'utilisateur le confirme ticket en main —
 * rien n'entre dans la bankroll avant. Sans proposition (match non suivi, ticket replié) : règlement à la main.
 */
export function ConfirmResult({ betId, propose, gainPropose, mise, apres = null }: { betId: string; propose: Res | null; gainPropose: number | null; mise: number; apres?: string | null }) {
  const [autre, setAutre] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const regler = (r: Res) => { setErr(null); start(async () => { const res = await settleBet(betId, r); if (res.ok) router.refresh(); else setErr(res.error); }); };
  const bouton = (r: Res, cls: string) => (
    <button key={r} type="button" disabled={pending} onClick={() => regler(r)} className={`rounded-lg py-2 text-sm font-medium disabled:opacity-50 ${cls}`}>{MOT[r][0].toUpperCase() + MOT[r].slice(1)}</button>
  );
  const TROIS = [bouton("gagne", "bg-gain text-on-fill"), bouton("perdu", "bg-loss text-on-fill"), bouton("rembourse", "bg-slate-200 text-slate-800")];

  // Avant la fin des matchs : pas de bouton de règlement (22/11) ; le résultat sera proposé tout seul
  if (!propose && apres && Date.parse(apres) > Date.now()) {
    return <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-ink-soft">En attente des matchs. Le résultat sera proposé automatiquement après le dernier, vers {new Date(apres).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })}.</p>;
  }
  if (!propose) {
    return (
      <div className="mt-4">
        <p className="mb-1.5 text-[11px] text-ink-muted">Pas encore de résultat proposé. Tu peux régler ce pari toi-même, d’après ton bookmaker :</p>
        <div className="grid grid-cols-3 gap-2">{TROIS}</div>
        {err && <p className="mt-2 text-xs text-loss-ink">{err}</p>}
      </div>
    );
  }
  const effet = propose === "gagne" && gainPropose !== null ? `+${fcfa(mise + gainPropose)} crédités` : propose === "rembourse" ? `${fcfa(mise)} rendus` : "la mise reste perdue";
  return (
    <div className="mt-4 rounded-xl border border-draw/40 bg-draw-soft p-3">
      <p className="text-sm font-semibold text-draw-ink">{APP_NAME} propose : {MOT[propose]}</p>
      <p className="mt-0.5 text-xs text-draw-ink">Vérifie sur ton bookmaker avant de confirmer. Rien n’est encore écrit dans ta bankroll ({effet} si tu confirmes).</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending} onClick={() => regler(propose)} className="rounded-lg bg-inverse px-3 py-2 text-sm font-semibold text-on-inverse disabled:opacity-50">{pending ? "Enregistrement…" : `Oui, c’est ${MOT[propose]}`}</button>
        {!autre && <button type="button" onClick={() => setAutre(true)} className="text-sm text-draw-ink underline">Non, ce n’est pas ça</button>}
      </div>
      {autre && (
        <div className="mt-2">
          <p className="mb-1.5 text-[11px] text-draw-ink">Quel est le vrai résultat ?</p>
          <div className="grid grid-cols-2 gap-2">{(["gagne", "perdu", "rembourse"] as Res[]).filter((r) => r !== propose).map((r) => bouton(r, r === "gagne" ? "bg-gain text-on-fill" : r === "perdu" ? "bg-loss text-on-fill" : "bg-slate-200 text-slate-800"))}</div>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-loss-ink">{err}</p>}
    </div>
  );
}
