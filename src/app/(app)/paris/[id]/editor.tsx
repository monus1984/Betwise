"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateBet, updateSelection } from "@/lib/bets/actions";
import { Button, Chip, Field, Input, Notice, RISK_CLASS, RISK_LABEL, riskFromOdds } from "@/components/ui";
import { MatchPicker, SELECTIONS, labelSel, toNum, type MatchHit } from "@/components/match-picker";
import { OriginPicker, type SourceOpt } from "../origin-picker";

export type EditableBet = {
  id: string; type: "simple" | "combine"; mise: number; cote_totale: number; statut: string; placed_at: string;
  bookmaker: string | null; detail_complet: boolean; nb_selections: number | null;
  selections: {
    id: string; market_code: string; market_param: number | null; selection: string; cote: number; resultat: string;
    origin_source_id: string; match_libre: string | null;
    match: { id: string; kickoff_at: string; statut: string; home: string; away: string; competition: string; score: string | null } | null;
  }[];
};
type Market = { code: string; libelle_fr: string; a_parametre: boolean };

export function BetEditor({ bet, sources, markets }: { bet: EditableBet; sources: SourceOpt[]; markets: Market[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [mise, setMise] = useState(String(bet.mise));
  const [bookmaker, setBookmaker] = useState(bet.bookmaker ?? "");
  const [placedAt, setPlacedAt] = useState(toLocalInput(bet.placed_at));
  const locked = bet.statut !== "en_cours";

  function saveHeader() {
    setMsg(null);
    start(async () => {
      const r = await updateBet({ betId: bet.id, mise: locked ? undefined : toNum(mise), bookmaker, placedAt: placedAt ? new Date(placedAt).toISOString() : undefined });
      setMsg(r.ok ? { kind: "info", text: "Enregistré." } : { kind: "error", text: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mise (F CFA)" hint={locked ? "Pari réglé : la mise ne se modifie plus." : undefined}>
            <Input inputMode="numeric" value={mise} onChange={(e) => setMise(e.target.value)} disabled={locked} />
          </Field>
          <Field label="Bookmaker">
            <Input value={bookmaker} onChange={(e) => setBookmaker(e.target.value)} placeholder="Betclic, 1xBet…" />
          </Field>
        </div>
        <Field label="Date et heure du ticket">
          <Input type="datetime-local" value={placedAt} onChange={(e) => setPlacedAt(e.target.value)} />
        </Field>
        <Button variant="ghost" onClick={saveHeader} disabled={pending}>Enregistrer ces informations</Button>
      </section>

      {!bet.detail_complet && (
        <Notice kind="info">Ticket importé replié : {bet.nb_selections ?? "?"} sélections non détaillées. Réimporte-le déplié pour ajouter le détail (bientôt), ou laisse-le en résumé.</Notice>
      )}

      {bet.selections.map((s, i) => (
        <SelectionEditor key={s.id} index={i} s={s} locked={locked} sources={sources} markets={markets} onDone={() => router.refresh()} />
      ))}

      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </div>
  );
}

function SelectionEditor({ index, s, locked, sources, markets, onDone }: { index: number; s: EditableBet["selections"][number]; locked: boolean; sources: SourceOpt[]; markets: Market[]; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [cote, setCote] = useState(String(s.cote));
  const [market, setMarket] = useState(s.market_code);
  const [param, setParam] = useState(s.market_param !== null ? String(s.market_param) : "");
  const [selection, setSelection] = useState(s.selection);
  const [query, setQuery] = useState(s.match ? `${s.match.home} – ${s.match.away}` : s.match_libre ?? "");
  const [match, setMatch] = useState<MatchHit | null>(s.match ? { id: s.match.id, kickoff_at: s.match.kickoff_at, statut: s.match.statut, home: s.match.home, away: s.match.away, competition: s.match.competition } : null);
  const hasParam = markets.find((m) => m.code === market)?.a_parametre;
  const combined = market === "DC_OU" || market === "1X2_OU";

  function save() {
    setErr(null);
    start(async () => {
      const r = await updateSelection({
        selectionId: s.id,
        cote: locked ? undefined : toNum(cote),
        matchId: match?.id ?? null,
        matchLibre: match ? null : query.trim() || null,
        clearMatch: !match && !!s.match,
        marketCode: locked ? undefined : market,
        marketParam: locked ? undefined : hasParam ? toNum(param) : null,
        selection: locked ? undefined : selection.trim(),
      });
      if (!r.ok) setErr(r.error); else onDone();
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sélection {index + 1}</p>
        <span className="text-[11px] text-slate-500">{s.resultat === "en_attente" ? "en attente" : s.resultat}</span>
      </div>

      <MatchPicker line={{ query, match }} onChange={(p) => { if (p.query !== undefined) setQuery(p.query); if (p.match !== undefined) setMatch(p.match); }} hint="Retrouve le match pour activer le règlement automatique." />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Marché">
          <select value={market} disabled={locked} onChange={(e) => { setMarket(e.target.value); setSelection(""); setParam(e.target.value.includes("OU") ? "2.5" : ""); }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base disabled:opacity-60">
            {markets.map((m) => <option key={m.code} value={m.code}>{m.libelle_fr}</option>)}
          </select>
        </Field>
        {hasParam && (
          <Field label="Ligne / handicap"><Input inputMode="decimal" value={param} disabled={locked} onChange={(e) => setParam(e.target.value)} /></Field>
        )}
      </div>

      <Field label="Sélection" hint={combined ? "Format : double chance ou résultat, barre verticale, Plus ou Moins (ex. N2|Plus)." : undefined}>
        {!combined && SELECTIONS[market]?.length ? (
          <div className="flex flex-wrap gap-2">
            {SELECTIONS[market].map((v) => <Chip key={v} active={selection === v} disabled={locked} onClick={() => setSelection(v)}>{labelSel(market, v, match)}</Chip>)}
          </div>
        ) : (
          <Input value={selection} disabled={locked} onChange={(e) => setSelection(e.target.value)} />
        )}
      </Field>

      <div className="flex items-end gap-3">
        <Field label="Cote"><Input inputMode="decimal" value={cote} disabled={locked} onChange={(e) => setCote(e.target.value)} className="max-w-[7rem]" /></Field>
        {toNum(cote) > 1 && <span className={`mb-3 rounded-full border px-2 py-1 text-[11px] ${RISK_CLASS[riskFromOdds(toNum(cote))]}`}>{RISK_LABEL[riskFromOdds(toNum(cote))]}</span>}
      </div>

      <p className="text-xs text-slate-600">Origine : <OriginPicker selectionId={s.id} current={s.origin_source_id} currentName={sources.find((x) => x.id === s.origin_source_id)?.nom ?? "—"} sources={sources} /></p>

      {err && <Notice>{err}</Notice>}
      <Button variant="ghost" onClick={save} disabled={pending}>Enregistrer cette sélection</Button>
    </section>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
