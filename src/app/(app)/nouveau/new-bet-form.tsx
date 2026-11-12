"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { COMP_FLAG } from "@/components/match-ui";
import { slip, slipHref, useSlip } from "@/lib/slip/store";
import { MatchPicker, defaultParam, paramLabel, toNum, type MatchHit } from "@/components/match-picker";
import { SelectionField } from "@/components/selection-field";
import { placeBet } from "@/lib/bets/actions";
import { SourceChooser } from "@/components/source-chooser";
import { Button, Field, Input, Notice, RISK_CLASS, RISK_LABEL, fcfa, riskFromOdds } from "@/components/ui";

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

export type PrefillLeg = { match: MatchHit; market?: string; param?: string; sel?: string; cote?: string; origin?: string; prediction?: string };

export function NewBetForm({ sources, markets, defaultOrigin, legs, initialTest = false, upcoming = [], fromCoupon = false }: { sources: Source[]; markets: Market[]; defaultOrigin: string | null; legs: PrefillLeg[]; initialTest?: boolean; upcoming?: MatchHit[]; fromCoupon?: boolean }) {
  const coupon = useSlip();
  const [srcList, setSrcList] = useState<{ id: string; nom: string; type?: string }[]>(sources);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState(initialTest);
  const [mise, setMise] = useState(initialTest ? "1000" : "");
  const [lines, setLines] = useState<Line[]>(() => {
    if (!legs.length) return [newLine(0, defaultOrigin)];
    return legs.map((p, i) => {
      const l = newLine(i, p.origin ?? defaultOrigin);
      l.match = p.match; l.query = `${p.match.home} – ${p.match.away}`;
      if (p.market) { l.market = p.market; l.param = p.param ?? defaultParam(p.market); }
      if (p.sel) l.selection = p.sel;
      if (p.cote) l.cote = p.cote;
      if (p.prediction) l.predictionId = p.prediction;
      return l;
    });
  });
  const [, setTick] = useState(0);

  const coteTotale = useMemo(() => lines.reduce((acc, l) => acc * (toNum(l.cote) > 1 ? toNum(l.cote) : 1), 1), [lines]);
  const miseNum = toNum(mise);
  const gainPotentiel = miseNum > 0 && coteTotale > 1 ? miseNum * coteTotale - miseNum : 0;

  function update(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  /** Appui sur un match : pari simple sur ce match. */
  function single(m: MatchHit) {
    setLines((ls) => { const base = newLine(Date.now(), ls[0]?.origin ?? defaultOrigin); base.match = m; base.query = `${m.home} – ${m.away}`; return [base]; });
    setTimeout(() => document.getElementById("bet-lines")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }
  /** « + » : ajoute le match au combiné (remplit la première sélection vide). */
  function addToCombo(m: MatchHit) {
    setLines((ls) => {
      if (ls.some((l) => l.match?.id === m.id)) return ls;
      const empty = ls.find((l) => !l.match && !l.query.trim());
      if (empty) return ls.map((l) => (l.key === empty.key ? { ...l, match: m, query: `${m.home} – ${m.away}` } : l));
      const nl = newLine(Date.now(), ls[ls.length - 1]?.origin ?? defaultOrigin); nl.match = m; nl.query = `${m.home} – ${m.away}`;
      return [...ls, nl];
    });
  }

  function submit() {
    setError(null);
    const payload = {
      virtuel: test,
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
      if (fromCoupon) slip.clear();
      router.push(test ? "/paris?vue=tests&ajout=1" : "/paris?ajout=1");
    });
  }

  const list = <UpcomingList matches={upcoming} chosen={new Set(lines.map((l) => l.match?.id).filter(Boolean) as string[])} onSingle={single} onAdd={addToCombo} defaultOpen={!legs.length} />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 rounded-xl border border-line bg-surface-2 p-1 text-sm font-medium" role="radiogroup" aria-label="Type d’enregistrement">
        <button type="button" role="radio" aria-checked={!test} onClick={() => setTest(false)} className={`rounded-lg py-2 ${!test ? "bg-white shadow-card" : "text-ink-muted"}`}>Parier</button>
        <button type="button" role="radio" aria-checked={test} onClick={() => { setTest(true); if (!mise) setMise("1000"); }} className={`rounded-lg py-2 ${test ? "bg-white shadow-card" : "text-ink-muted"}`}>Tester sans miser</button>
      </div>
      {!legs.length && coupon.length > 0 && (
        <Link href={slipHref(coupon, test)} className="flex items-center justify-between rounded-xl border border-brand/30 bg-brand/5 px-3 py-2.5 text-sm">
          <span>Ton coupon : <b>{coupon.length} sélection{coupon.length > 1 ? "s" : ""}</b>, cote {coupon.reduce((x, l) => x * l.cote, 1).toFixed(2).replace(".", ",")}</span>
          <span className="font-medium text-brand">Charger ›</span>
        </Link>
      )}
      {upcoming.length > 0 && !legs.length && list}
      {test && <Notice kind="info">Mode test : le choix est suivi et réglé comme un pari, mais ta bankroll ne bouge pas. Il compte dans « Mes tests » et dans la fiche de chaque source d’origine, pour mesurer la justesse des choix.</Notice>}
      <div id="bet-lines" className="scroll-mt-4" />
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
                onChange={(e) => update(l.key, { market: e.target.value, selection: "", param: defaultParam(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
              >
                {markets.map((m) => <option key={m.code} value={m.code}>{m.libelle_fr}</option>)}
              </select>
            </Field>
            {markets.find((m) => m.code === l.market)?.a_parametre && (
              <Field label={paramLabel(l.market)}>
                <Input inputMode="decimal" value={l.param} onChange={(e) => update(l.key, { param: e.target.value })} placeholder={defaultParam(l.market) || "2.5"} />
              </Field>
            )}
          </div>

          <Field label="Sélection">
            <SelectionField market={l.market} param={l.param} value={l.selection} match={l.match} onChange={(v) => update(l.key, { selection: v })} />
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

      {upcoming.length > 0 && legs.length > 0 && list}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <Field label={test ? "Mise fictive (F CFA)" : "Mise (F CFA)"} hint={test ? "Sert seulement à calculer le rendement du test." : undefined}>
          <Input inputMode="numeric" value={mise} onChange={(e) => setMise(e.target.value)} placeholder="2 000" />
        </Field>
        <div className="flex gap-1.5">
          {[500, 1000, 2000, 5000, 10000].map((v) => (
            <button key={v} type="button" onClick={() => setMise(String(v))} className={`flex-1 rounded-lg border py-1.5 text-xs tabular-nums ${miseNum === v ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft"}`}>{v.toLocaleString("fr-FR")}</button>
          ))}
        </div>
        <div className="flex justify-between text-sm text-slate-700">
          <span>{lines.length > 1 ? `Combiné × ${coteTotale.toFixed(2)}` : "Pari simple"}</span>
          <span>Gain potentiel : <strong>{gainPotentiel > 0 ? fcfa(gainPotentiel) : "—"}</strong></span>
        </div>
      </section>

      {error && <Notice>{error}</Notice>}
      <Button onClick={submit} disabled={pending || !ready(lines, miseNum)}>{pending ? "Enregistrement…" : test ? "Enregistrer le test" : "Enregistrer le pari"}</Button>
    </div>
  );
}

function newLine(key: number, origin: string | null): Line {
  return { key, query: "", match: null, market: "1X2", param: "", selection: "", cote: "", origin, predictionId: null };
}

function ready(lines: Line[], mise: number) {
  return mise > 0 && lines.every((l) => (l.match || l.query.trim().length >= 2) && l.selection.trim() && toNum(l.cote) > 1 && l.origin);
}


const TZ = "Africa/Abidjan";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

/** Matchs des 48 prochaines heures : appui = pari simple sur le match, « + » = ajout au combiné. */
function UpcomingList({ matches, chosen, onSingle, onAdd, defaultOpen }: { matches: MatchHit[]; chosen: Set<string>; onSingle: (m: MatchHit) => void; onAdd: (m: MatchHit) => void; defaultOpen: boolean }) {
  const days = [...new Set(matches.map((m) => dayKey(m.kickoff_at)))];
  const [day, setDay] = useState(days[0]);
  const [q, setQ] = useState("");
  const today = dayKey(new Date().toISOString());
  const list = matches.filter((m) => dayKey(m.kickoff_at) === day && (!q.trim() || `${m.home} ${m.away}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <details open={defaultOpen} className="group rounded-xl border border-line bg-white shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
        <span>📅 Matchs des 2 prochains jours <span className="font-normal text-ink-muted">({matches.length})</span></span>
        <span className="text-ink-muted group-open:rotate-180">▾</span>
      </summary>
      <div className="border-t border-line px-3 pb-3 pt-2">
        <div className="mb-2 flex items-center gap-1.5">
          {days.map((d) => (
            <button key={d} type="button" onClick={() => setDay(d)} className={`rounded-full border px-3 py-1 text-xs ${day === d ? "border-ink bg-ink text-white" : "border-line text-ink-soft"}`}>
              {d === today ? "Aujourd’hui" : new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", timeZone: "UTC" })}
            </button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer" className="ml-auto w-24 rounded-lg border border-line px-2 py-1 text-xs" />
        </div>
        <p className="mb-1.5 text-[11px] text-ink-muted">Touche un match pour un pari simple, « + » pour l’ajouter au combiné.</p>
        <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-lg border border-line">
          {list.length === 0 && <li className="px-3 py-3 text-center text-xs text-ink-muted">Aucun match.</li>}
          {list.map((m) => {
            const on = chosen.has(m.id);
            return (
              <li key={m.id} className={`flex items-center ${on ? "bg-brand/5" : ""}`}>
                <button type="button" onClick={() => onSingle(m)} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left active:bg-surface-2">
                  <span className="w-10 shrink-0 text-xs tabular-nums text-ink-muted">{new Date(m.kickoff_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ })}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{COMP_FLAG[m.competition] ?? "⚽"} {m.home} – {m.away}</span>
                </button>
                <button type="button" aria-label={on ? "Déjà dans le pari" : "Ajouter au combiné"} onClick={() => onAdd(m)} className={`mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${on ? "border-brand bg-brand text-white" : "border-brand/40 text-brand"}`}>{on ? "✓" : "+"}</button>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
