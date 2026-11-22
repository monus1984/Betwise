"use client";

import { MarketOptions } from "@/components/market-options";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setSelectionResult, updateBet, updateSelection } from "@/lib/bets/actions";
import { pickLabel } from "@/lib/probs/signals";
import { Button, Chip, Field, Input, Notice, RISK_CLASS, RISK_LABEL, riskFromOdds } from "@/components/ui";
import { MatchPicker, defaultParam, toNum, type MatchHit } from "@/components/match-picker";
import { SelectionField } from "@/components/selection-field";
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
      setMsg(r.ok ? { kind: "info", text: "✓ Informations du ticket enregistrées." } : { kind: "error", text: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {locked && (
        <Notice kind="info">Pari réglé : la mise, les cotes et les sélections sont figées pour garder la bankroll juste. Tu peux toujours corriger le match, l’origine de chaque choix, le bookmaker et la date.</Notice>
      )}
      <section className="space-y-3 rounded-xl border border-slate-200 bg-surface p-4">
        <div className="grid grid-cols-2 gap-3">
          {locked ? (
            <div><p className="mb-1 text-sm font-medium text-ink-soft">Mise</p><p className="py-3 text-base font-semibold">{Number(bet.mise).toLocaleString("fr-FR")} F</p></div>
          ) : (
            <Field label="Mise (F CFA)"><Input inputMode="numeric" value={mise} onChange={(e) => setMise(e.target.value)} /></Field>
          )}
          <Field label="Bookmaker">
            <Input value={bookmaker} onChange={(e) => setBookmaker(e.target.value)} placeholder="Betclic, 1xBet…" />
          </Field>
        </div>
        <Field label="Date et heure du ticket">
          <Input type="datetime-local" value={placedAt} onChange={(e) => setPlacedAt(e.target.value)} />
        </Field>
        <Button variant="ghost" onClick={saveHeader} disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer ces informations"}</Button>
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

const RESULT_LABEL: Record<string, { t: string; c: string }> = {
  en_attente: { t: "en attente", c: "bg-surface-2 text-ink-muted" }, gagne: { t: "gagnée", c: "bg-gain-soft text-gain" },
  perdu: { t: "perdue", c: "bg-loss-soft text-loss" }, rembourse: { t: "remboursée", c: "bg-draw-soft text-draw" },
};

function SelectionEditor({ index, s, locked, sources, markets, onDone }: { index: number; s: EditableBet["selections"][number]; locked: boolean; sources: SourceOpt[]; markets: Market[]; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [cote, setCote] = useState(String(s.cote));
  const [market, setMarket] = useState(s.market_code);
  const [param, setParam] = useState(s.market_param !== null ? String(s.market_param) : "");
  const [selection, setSelection] = useState(s.selection);
  const [query, setQuery] = useState(s.match ? `${s.match.home} – ${s.match.away}` : s.match_libre ?? "");
  const [match, setMatch] = useState<MatchHit | null>(s.match ? { id: s.match.id, kickoff_at: s.match.kickoff_at, statut: s.match.statut, home: s.match.home, away: s.match.away, competition: s.match.competition } : null);
  const hasParam = markets.find((m) => m.code === market)?.a_parametre;
  const dirty = (match?.id ?? null) !== (s.match?.id ?? null) || (!match && query.trim() !== (s.match_libre ?? "")) ||
    (!locked && (Number(toNum(cote)) !== Number(s.cote) || market !== s.market_code || selection !== s.selection || (hasParam ? toNum(param) : null) !== (s.market_param !== null ? Number(s.market_param) : null)));

  function save() {
    setErr(null); setSaved(false);
    // Un marché sans choix ne peut pas être réglé : la ligne resterait « en attente » pour toujours.
    if (!locked && !selection.trim()) { setErr("Choisis la sélection (équipe 1 ou 2, Plus ou Moins…) avant d’enregistrer."); return; }
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
      if (!r.ok) setErr(r.error); else { setSaved(true); onDone(); }
    });
  }

  const res = RESULT_LABEL[s.resultat] ?? RESULT_LABEL.en_attente;
  const marketName = markets.find((m) => m.code === s.market_code)?.libelle_fr ?? s.market_code;
  // Lignes que l'application ne règle pas seule : pari gardé tel quel, match non suivi, ou match terminé sans donnée pour trancher
  const libre = s.market_code === "LIBRE";
  const joue = !s.match || s.match.statut === "termine" || s.match.statut === "annule" || s.match.statut === "reporte";
  const aLaMain = !locked && (libre || !s.match || (s.match.statut === "termine" && s.resultat === "en_attente"));
  function regler(r: "gagne" | "perdu" | "rembourse" | "en_attente") {
    setErr(null);
    start(async () => { const out = await setSelectionResult(s.id, r); if (!out.ok) setErr(out.error); else onDone(); });
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sélection {index + 1}</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${res.c}`}>{res.t}</span>
      </div>

      <MatchPicker line={{ query, match }} onChange={(p) => { if (p.query !== undefined) setQuery(p.query); if (p.match !== undefined) setMatch(p.match); }} hint="Retrouve le match pour activer le règlement automatique." />

      {locked ? (
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-surface-2 p-3 text-sm">
          <div><p className="text-[11px] text-ink-muted">Marché</p><p className="font-medium">{marketName}{s.market_param !== null ? ` ${s.market_param}` : ""}</p></div>
          <div><p className="text-[11px] text-ink-muted">Choix</p><p className="font-medium">{pickLabel(s.market_code, s.market_param, s.selection, s.match?.home ?? "Équipe 1", s.match?.away ?? "Équipe 2")}</p></div>
          <div><p className="text-[11px] text-ink-muted">Cote</p><p className="font-medium tabular-nums">{Number(s.cote).toFixed(2).replace(".", ",")}</p></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Marché">
              <select value={market} onChange={(e) => { setMarket(e.target.value); setSelection(""); setParam(defaultParam(e.target.value)); }} className="w-full rounded-lg border border-slate-300 bg-surface px-3 py-3 text-base">
                <MarketOptions markets={markets} />
              </select>
            </Field>
            {hasParam && (
              <Field label="Ligne / handicap"><Input inputMode="decimal" value={param} onChange={(e) => setParam(e.target.value)} /></Field>
            )}
          </div>

          <Field label="Sélection">
            <SelectionField market={market} param={param} value={selection} match={match} onChange={setSelection} />
          </Field>

          <div className="flex items-end gap-3">
            <Field label="Cote"><Input inputMode="decimal" value={cote} onChange={(e) => setCote(e.target.value)} className="max-w-[7rem]" /></Field>
            {toNum(cote) > 1 && <span className={`mb-3 rounded-full border px-2 py-1 text-[11px] ${RISK_CLASS[riskFromOdds(toNum(cote))]}`}>{RISK_LABEL[riskFromOdds(toNum(cote))]}</span>}
          </div>
        </>
      )}

      {aLaMain && (
        <div className="rounded-lg border border-draw/40 bg-draw-soft p-3">
          <p className="text-xs leading-snug text-draw-ink">
            {libre ? "Pari gardé tel quel : l’application ne sait pas le régler seule." : !s.match ? "Match non suivi : cette ligne ne se règle pas seule." : "Match terminé, mais la donnée manque pour trancher cette ligne."}
            {" "}{s.resultat !== "en_attente" ? "Tu l’as réglée à la main." : joue ? "Dis ce qu’elle a donné chez ton bookmaker :" : "Tu pourras la régler ici dès la fin du match."}
          </p>
          {s.resultat === "en_attente" && joue && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button type="button" disabled={pending} onClick={() => regler("gagne")} className="rounded-lg bg-gain py-2 text-sm font-medium text-on-fill disabled:opacity-50">Gagnée</button>
              <button type="button" disabled={pending} onClick={() => regler("perdu")} className="rounded-lg bg-loss py-2 text-sm font-medium text-on-fill disabled:opacity-50">Perdue</button>
              <button type="button" disabled={pending} onClick={() => regler("rembourse")} className="rounded-lg bg-slate-200 py-2 text-sm font-medium text-slate-800 disabled:opacity-50">Remboursée</button>
            </div>
          )}
          {s.resultat !== "en_attente" && <button type="button" disabled={pending} onClick={() => regler("en_attente")} className="mt-1.5 text-xs text-draw-ink underline disabled:opacity-50">Je me suis trompé : remettre en attente</button>}
        </div>
      )}

      <div className="text-xs text-slate-600">Origine : <OriginPicker selectionId={s.id} current={s.origin_source_id} currentName={sources.find((x) => x.id === s.origin_source_id)?.nom ?? "—"} sources={sources} /></div>

      {err && <Notice>{err}</Notice>}
      {(dirty || pending) && <Button variant="ghost" onClick={save} disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer cette sélection"}</Button>}
      {saved && !dirty && !pending && <p className="text-xs text-gain">✓ Sélection enregistrée.</p>}
    </section>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
