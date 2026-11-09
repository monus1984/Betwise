"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logPrediction } from "@/lib/sources/actions";
import { Button, Chip, Field, Input, Notice, RISK_CLASS, RISK_LABEL, riskFromOdds } from "@/components/ui";
import { MatchPicker, SELECTIONS, labelSel, toNum, type MatchHit } from "@/components/match-picker";

type Market = { code: string; libelle_fr: string; a_parametre: boolean };

export function NewPredictionForm({ sourceId, markets }: { sourceId: string; markets: Market[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [match, setMatch] = useState<MatchHit | null>(null);
  const [market, setMarket] = useState("1X2");
  const [param, setParam] = useState("");
  const [selection, setSelection] = useState("");
  const [cote, setCote] = useState("");
  const [risque, setRisque] = useState<"prudent" | "moyen" | "risque" | null>(null);
  const [publishedAt, setPublishedAt] = useState("");

  const hasParam = markets.find((m) => m.code === market)?.a_parametre;
  const ready = (match || query.trim().length >= 2) && selection.trim() && (!cote || toNum(cote) > 1);
  const willBeVerified = match ? Date.parse(match.kickoff_at) > Date.now() : false;

  function submit() {
    setError(null);
    start(async () => {
      const res = await logPrediction({
        source_id: sourceId,
        match_id: match?.id ?? null,
        match_libre: match ? null : query.trim() || null,
        market_code: market as never,
        market_param: hasParam ? toNum(param) : null,
        selection: selection.trim(),
        cote_annoncee: cote ? toNum(cote) : null,
        risque_annonce: risque,
        published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
      });
      if (!res.ok) { setError(res.error); return; }
      router.push(`/sources/${sourceId}?ajout=1${res.created ? "" : "&doublon=1"}`);
    });
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <MatchPicker line={{ query, match }} onChange={(p) => { if (p.query !== undefined) setQuery(p.query); if (p.match !== undefined) setMatch(p.match); }} />
        <p className={`text-xs ${willBeVerified ? "text-emerald-700" : "text-slate-500"}`}>
          {match
            ? willBeVerified
              ? "Match à venir : ce prono sera marqué Vérifié (enregistré avant le coup d’envoi)."
              : "Match déjà joué : ce prono sera marqué Déclaré et ne pèsera pas dans la fiabilité."
            : "Sans match identifié, le prono sera Déclaré. Choisis un match dans la liste pour qu’il soit Vérifié."}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Marché">
            <select value={market} onChange={(e) => { setMarket(e.target.value); setSelection(""); setParam(e.target.value === "OU" ? "2.5" : ""); }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base">
              {markets.map((m) => <option key={m.code} value={m.code}>{m.libelle_fr}</option>)}
            </select>
          </Field>
          {hasParam && (
            <Field label={market === "OU" ? "Ligne (buts)" : "Handicap"}>
              <Input inputMode="decimal" value={param} onChange={(e) => setParam(e.target.value)} placeholder={market === "OU" ? "2.5" : "-1"} />
            </Field>
          )}
        </div>

        <Field label="Sélection annoncée">
          {SELECTIONS[market]?.length ? (
            <div className="flex flex-wrap gap-2">
              {SELECTIONS[market].map((s) => <Chip key={s} active={selection === s} onClick={() => setSelection(s)}>{labelSel(market, s, match)}</Chip>)}
            </div>
          ) : (
            <Input value={selection} onChange={(e) => setSelection(e.target.value)} placeholder="ex. 2-1" />
          )}
        </Field>

        <Field label="Cote annoncée (facultatif)" hint="Sans cote, le prono compte dans la tendance mais pas dans le rendement.">
          <div className="flex items-center gap-3">
            <Input inputMode="decimal" value={cote} onChange={(e) => setCote(e.target.value)} placeholder="1.85" className="max-w-[9rem]" />
            {toNum(cote) > 1 && <span className={`rounded-full border px-2.5 py-1 text-xs ${RISK_CLASS[riskFromOdds(toNum(cote))]}`}>{RISK_LABEL[riskFromOdds(toNum(cote))]} (d’après la cote)</span>}
          </div>
        </Field>

        <Field label="Niveau de risque annoncé par la source (facultatif)" hint="« Pari sûr », « coup de poker »… Si la source le dit, on le garde tel quel et on le compare à la cote.">
          <div className="flex gap-2">
            {(["prudent", "moyen", "risque"] as const).map((k) => (
              <Chip key={k} active={risque === k} onClick={() => setRisque(risque === k ? null : k)}>{RISK_LABEL[k]}</Chip>
            ))}
          </div>
        </Field>

        <Field label="Date de publication par la source (facultatif)" hint="Indice seulement : c’est l’heure d’enregistrement ici qui fait foi.">
          <Input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
        </Field>
      </section>

      {error && <Notice>{error}</Notice>}
      <Button onClick={submit} disabled={pending || !ready}>{pending ? "Enregistrement…" : "Enregistrer le prono"}</Button>
    </div>
  );
}
