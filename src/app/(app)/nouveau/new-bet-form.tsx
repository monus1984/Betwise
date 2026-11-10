"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { MatchPicker, SELECTIONS, labelSel, toNum, type MatchHit } from "@/components/match-picker";
import { placeBet } from "@/lib/bets/actions";
import { SourceChooser } from "@/components/source-chooser";
import { Button, Chip, Field, Input, Notice, RISK_CLASS, RISK_LABEL, fcfa, riskFromOdds } from "@/components/ui";

type Source = { id: string; nom: string; type: string };
type Market = { code: string; libelle_fr: string; a_parametre: boolean };
type Line = {
  key: number;
  query: string;
  match: MatchHit | null;
  market: string;
  param: string;
  selection: string;
  cote: string;
  origin: string | null;
  predictionId: string | null;
};

type Prefill = { match: MatchHit | null; market?: string; param?: string; sel?: string; cote?: string; origin?: string; prediction?: string };

export function NewBetForm({ sources, markets, defaultOrigin, prefill }: { sources: Source[]; markets: Market[]; defaultOrigin: string | null; prefill?: Prefill }) {
  const [srcList, setSrcList] = useState<{ id: string; nom: string; type?: string }[]>(sources);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mise, setMise] = useState("");
  const [lines, setLines] = useState<Line[]>(() => {
    const l = newLine(0, defaultOrigin);
    if (prefill?.match) { l.match = prefill.match; l.query = `${prefill.match.home} – ${prefill.match.away}`; }
    if (prefill?.market) { l.market = prefill.market; l.param = prefill.param ?? (prefill.market === "OU" ? "2.5" : ""); }
    if (prefill?.sel) l.selection = prefill.sel;
    if (prefill?.cote) l.cote = prefill.cote;
    if (prefill?.origin) l.origin = prefill.origin;
    if (prefill?.prediction) l.predictionId = prefill.prediction;
    return [l];
  });
  const [, setTick] = useState(0);

  const coteTotale = useMemo(() => lines.reduce((acc, l) => acc * (toNum(l.cote) > 1 ? toNum(l.cote) : 1), 1), [lines]);
  const miseNum = toNum(mise);
  const gainPotentiel = miseNum > 0 && coteTotale > 1 ? miseNum * coteTotale - miseNum : 0;

  function update(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function submit() {
    setError(null);
    const payload = {
      mise: miseNum,
      selections: lines.map((l) => ({
        match_id: l.match?.id ?? null,
        match_libre: l.match ? null : l.query.trim() || null,
        market_code: l.market as never,
        market_param: markets.find((m) => m.code === l.market)?.a_parametre ? toNum(l.param) : null,
        selection: l.selection.trim(),
        cote: toNum(l.cote),
        origin_source_id: l.origin ?? "",
        prediction_id: l.predictionId,
      })),
    };
    start(async () => {
      const res = await placeBet(payload);
      if (!res.ok) { setError(res.error); return; }
      router.push("/paris?ajout=1");
    });
  }

  return (
    <div className="space-y-5">
      {lines.map((l, i) => (
        <section key={l.key} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          {lines.length > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sélection {i + 1}</p>
              <button type="button" className="text-xs text-red-600" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>Retirer</button>
            </div>
          )}

          <MatchPicker line={{ query: l.query, match: l.match }} onChange={(patch) => update(l.key, patch)} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Marché">
              <select
                value={l.market}
                onChange={(e) => update(l.key, { market: e.target.value, selection: "", param: e.target.value === "OU" ? "2.5" : "" })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
              >
                {markets.map((m) => <option key={m.code} value={m.code}>{m.libelle_fr}</option>)}
              </select>
            </Field>
            {markets.find((m) => m.code === l.market)?.a_parametre && (
              <Field label={l.market === "OU" ? "Ligne (buts)" : "Handicap"}>
                <Input inputMode="decimal" value={l.param} onChange={(e) => update(l.key, { param: e.target.value })} placeholder={l.market === "OU" ? "2.5" : "-1"} />
              </Field>
            )}
          </div>

          <Field label="Sélection">
            {SELECTIONS[l.market]?.length ? (
              <div className="flex flex-wrap gap-2">
                {SELECTIONS[l.market].map((s) => (
                  <Chip key={s} active={l.selection === s} onClick={() => update(l.key, { selection: s })}>{labelSel(l.market, s, l.match)}</Chip>
                ))}
              </div>
            ) : (
              <Input value={l.selection} onChange={(e) => update(l.key, { selection: e.target.value })} placeholder="ex. 2-1" />
            )}
          </Field>

          <Field label="Cote">
            <div className="flex items-center gap-3">
              <Input inputMode="decimal" value={l.cote} onChange={(e) => update(l.key, { cote: e.target.value })} placeholder="1.85" className="max-w-[9rem]" />
              {toNum(l.cote) > 1 && (
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${RISK_CLASS[riskFromOdds(toNum(l.cote))]}`}>
                  {RISK_LABEL[riskFromOdds(toNum(l.cote))]}
                </span>
              )}
            </div>
          </Field>

          <Field label="Origine du choix">
            <SourceChooser sources={srcList} value={l.origin} onChange={(id) => update(l.key, { origin: id })} onCreated={(s) => setSrcList((x) => [...x, s])} />
          </Field>
        </section>
      ))}

      <button
        type="button"
        onClick={() => { setLines((ls) => [...ls, newLine(Date.now(), defaultOrigin)]); setTick((t) => t + 1); }}
        className="w-full rounded-xl border border-dashed border-slate-300 py-3 text-sm text-slate-600"
      >
        + Ajouter une sélection (combiné)
      </button>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <Field label="Mise (F CFA)">
          <Input inputMode="numeric" value={mise} onChange={(e) => setMise(e.target.value)} placeholder="2 000" />
        </Field>
        <div className="flex justify-between text-sm text-slate-700">
          <span>{lines.length > 1 ? `Combiné × ${coteTotale.toFixed(2)}` : "Pari simple"}</span>
          <span>Gain potentiel : <strong>{gainPotentiel > 0 ? fcfa(gainPotentiel) : "—"}</strong></span>
        </div>
      </section>

      {error && <Notice>{error}</Notice>}
      <Button onClick={submit} disabled={pending || !ready(lines, miseNum)}>{pending ? "Enregistrement…" : "Enregistrer le pari"}</Button>
    </div>
  );
}

function newLine(key: number, origin: string | null): Line {
  return { key, query: "", match: null, market: "1X2", param: "", selection: "", cote: "", origin, predictionId: null };
}

function ready(lines: Line[], mise: number) {
  return mise > 0 && lines.every((l) => (l.match || l.query.trim().length >= 2) && l.selection.trim() && toNum(l.cote) > 1 && l.origin);
}

