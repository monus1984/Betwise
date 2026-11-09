"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { placeBet } from "@/lib/bets/actions";
import { Button, Chip, Field, Input, Notice, RISK_CLASS, RISK_LABEL, fcfa, riskFromOdds } from "@/components/ui";

type Source = { id: string; nom: string; type: string };
type Market = { code: string; libelle_fr: string; a_parametre: boolean };
type MatchHit = { id: string; kickoff_at: string; statut: string; home: string; away: string; competition: string };

type Line = {
  key: number;
  query: string;
  match: MatchHit | null;
  market: string;
  param: string;
  selection: string;
  cote: string;
  origin: string | null;
};

const SELECTIONS: Record<string, string[]> = {
  "1X2": ["1", "N", "2"],
  DC: ["1N", "12", "N2"],
  DNB: ["1", "2"],
  OU: ["Plus", "Moins"],
  BTTS: ["Oui", "Non"],
  AH: ["1", "2"],
  CS: [],
};

const toNum = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

type Prefill = { match: MatchHit | null; market?: string; param?: string; sel?: string; cote?: string };

export function NewBetForm({ sources, markets, defaultOrigin, prefill }: { sources: Source[]; markets: Market[]; defaultOrigin: string | null; prefill?: Prefill }) {
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

          <MatchPicker line={l} onChange={(patch) => update(l.key, patch)} />

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
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {sources.map((s) => (
                <Chip key={s.id} active={l.origin === s.id} onClick={() => update(l.key, { origin: s.id })}>{s.nom}</Chip>
              ))}
            </div>
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
  return { key, query: "", match: null, market: "1X2", param: "", selection: "", cote: "", origin };
}

function ready(lines: Line[], mise: number) {
  return mise > 0 && lines.every((l) => (l.match || l.query.trim().length >= 2) && l.selection.trim() && toNum(l.cote) > 1 && l.origin);
}

function labelSel(market: string, s: string, m: MatchHit | null) {
  if (market === "1X2" || market === "DNB" || market === "AH") {
    if (s === "1") return m ? short(m.home) : "Domicile";
    if (s === "2") return m ? short(m.away) : "Extérieur";
    return "Nul";
  }
  if (market === "DC") return { "1N": "Dom. ou nul", "12": "Dom. ou ext.", N2: "Nul ou ext." }[s] ?? s;
  return s;
}
const short = (n: string) => n.replace(/\s?(FC|CF|SC|AC|AS|US|SV|RB|SSC|Calcio|Club de Fútbol|Football Club)\b\.?/g, "").trim().slice(0, 16);

function MatchPicker({ line, onChange }: { line: Line; onChange: (p: Partial<Line>) => void }) {
  const [hits, setHits] = useState<MatchHit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (line.match || line.query.trim().length < 2) { setHits([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/matches/search?q=${encodeURIComponent(line.query.trim())}`);
      const j = await r.json();
      setHits(j.matches ?? []);
      setOpen(true);
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [line.query, line.match]);

  if (line.match) {
    const m = line.match;
    return (
      <Field label="Match">
        <div className="flex items-center justify-between rounded-lg border border-slate-900 bg-slate-50 px-3 py-2.5">
          <div className="text-sm">
            <p className="font-medium">{m.home} – {m.away}</p>
            <p className="text-xs text-slate-500">{m.competition} · {fmtDate(m.kickoff_at)}</p>
          </div>
          <button type="button" className="text-xs text-slate-600 underline" onClick={() => onChange({ match: null, query: "" })}>Changer</button>
        </div>
      </Field>
    );
  }

  return (
    <Field label="Match" hint="Tape un nom d’équipe. Si le match n’est pas trouvé, le texte sera gardé tel quel.">
      <div className="relative">
        <Input value={line.query} onChange={(e) => onChange({ query: e.target.value })} onFocus={() => setOpen(true)} placeholder="ex. PSG, Real, Arsenal…" autoComplete="off" />
        {open && hits.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                  onClick={() => { onChange({ match: h, query: `${h.home} – ${h.away}` }); setOpen(false); }}
                >
                  <span>{h.home} – {h.away}</span>
                  <span className="ml-2 shrink-0 text-xs text-slate-500">{h.competition} · {fmtDate(h.kickoff_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
}
