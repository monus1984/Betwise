"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MarketOptions } from "@/components/market-options";
import { MatchPicker, defaultParam, toNum, type MatchHit } from "@/components/match-picker";
import { SelectionField } from "@/components/selection-field";
import { Field, Input } from "@/components/ui";
import { deletePrediction, updatePrediction } from "@/lib/sources/actions";

export type MarcheOpt = { code: string; libelle_fr: string; a_parametre: boolean };
type Prono = { id: string; matchId: string | null; home: string | null; away: string | null; kickoff: string | null; label: string; market: string; param: number | null; selection: string; cote: number | null };

/** Corriger ou supprimer un prono qu'on a chargé (25/11) : match, pari, cote ; il sera réglé de nouveau. */
export function GererProno({ p, markets }: { p: Prono; markets: MarcheOpt[] }) {
  const [mode, setMode] = useState<"rien" | "modifier" | "supprimer">("rien");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const [query, setQuery] = useState(p.home && p.away ? `${p.home} – ${p.away}` : p.label);
  const [match, setMatch] = useState<MatchHit | null>(p.matchId && p.home && p.away ? { id: p.matchId, kickoff_at: p.kickoff ?? "", statut: "", home: p.home, away: p.away, competition: "" } : null);
  const [market, setMarket] = useState(p.market);
  const [param, setParam] = useState(p.param !== null ? String(p.param) : "");
  const [sel, setSel] = useState(p.selection);
  const [cote, setCote] = useState(p.cote ? String(p.cote) : "");
  const hasParam = markets.find((m) => m.code === market)?.a_parametre;

  if (mode === "rien") return (
    <div className="flex gap-2">
      <button onClick={() => setMode("modifier")} className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-soft">Modifier</button>
      <button onClick={() => setMode("supprimer")} className="rounded-lg border border-line px-3 py-1.5 text-xs text-loss">Supprimer</button>
    </div>
  );
  if (mode === "supprimer") return (
    <div className="mt-1 w-full space-y-2">
      <p className="text-[12.5px] leading-snug">Supprimer ce prono ? Il ne comptera plus dans le bilan de la source. La suppression est définitive.</p>
      <div className="flex gap-2">
        <button onClick={() => setMode("rien")} className="flex-1 rounded-lg border border-line py-2 text-xs text-ink-soft">Garder</button>
        <button disabled={pending} onClick={() => start(async () => { const r = await deletePrediction(p.id); if (!r.ok) setErr(r.error); else router.refresh(); })} className="flex-1 rounded-lg bg-loss py-2 text-xs font-semibold text-on-fill disabled:opacity-50">{pending ? "…" : "Supprimer"}</button>
      </div>
      {err && <p className="text-[12px] text-loss">{err}</p>}
    </div>
  );
  return (
    <div className="mt-1 w-full space-y-3 rounded-lg border border-line p-3">
      <MatchPicker line={{ query, match }} onChange={(x) => { if (x.query !== undefined) setQuery(x.query); if (x.match !== undefined) setMatch(x.match); }} hint="Retrouve le match pour que le prono soit réglé." />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Marché">
          <select value={market} onChange={(e) => { setMarket(e.target.value); setSel(""); setParam(defaultParam(e.target.value)); }} className="w-full rounded-lg border border-line bg-surface px-3 py-3 text-base">
            <MarketOptions markets={markets} />
          </select>
        </Field>
        {hasParam && <Field label="Ligne / handicap"><Input inputMode="decimal" value={param} onChange={(e) => setParam(e.target.value)} /></Field>}
      </div>
      <Field label="Sélection"><SelectionField market={market} param={param} value={sel} match={match} onChange={setSel} /></Field>
      <Field label="Cote annoncée (facultatif)"><Input inputMode="decimal" value={cote} onChange={(e) => setCote(e.target.value)} className="max-w-[7rem]" /></Field>
      <div className="flex gap-2">
        <button onClick={() => setMode("rien")} className="flex-1 rounded-lg border border-line py-2 text-xs text-ink-soft">Annuler</button>
        <button disabled={pending || !sel.trim()} onClick={() => start(async () => {
          setErr(null);
          const r = await updatePrediction({ id: p.id, matchId: match?.id ?? null, market, param: hasParam ? toNum(param) ?? null : null, sel: sel.trim(), cote: cote.trim() ? toNum(cote) ?? null : null });
          if (!r.ok) setErr(r.error); else { setMode("rien"); router.refresh(); }
        })} className="flex-1 rounded-lg bg-brand py-2 text-xs font-semibold text-on-fill disabled:opacity-50">{pending ? "…" : "Enregistrer"}</button>
      </div>
      {err && <p className="text-[12px] text-loss">{err}</p>}
    </div>
  );
}
