"use client";

import { useState, useTransition } from "react";
import { deleteBet } from "@/lib/bets/actions";
import { ConfirmResult } from "./confirm-result";
import Link from "next/link";
import { RISK_CLASS, RISK_LABEL, fcfa } from "@/components/ui";
import { pickLabel } from "@/lib/probs/signals";
import { OriginPicker, type SourceOpt } from "./origin-picker";
import { reglableA } from "@/lib/bets/reglement";

type Named = { nom: string } | { nom: string }[] | null;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export type BetRow = {
  id: string;
  type: "simple" | "combine";
  mise: number;
  cote_totale: number | null;
  statut: "en_cours" | "gagne" | "perdu" | "rembourse" | "annule";
  gain_net: number | null;
  placed_at: string;
  settled_at: string | null;
  created_at: string;
  bookmaker: string | null;
  detail_complet: boolean;
  resultat_propose?: "gagne" | "perdu" | "rembourse" | "en_attente" | null;
  gain_propose?: number | null;
  bet_selections: {
    id: string;
    match_libre: string | null;
    market_code: string;
    market_param: number | null;
    selection: string;
    cote: number;
    resultat: string;
    risque_calcule: "prudent" | "moyen" | "risque" | null;
    origin_source_id: string;
    origin: Named;
    match: { kickoff_at: string; statut?: string; home: Named; away: Named } | { kickoff_at: string; statut?: string; home: Named; away: Named }[] | null;
  }[];
};

const STATUT: Record<BetRow["statut"], { label: string; cls: string }> = {
  en_cours: { label: "En cours", cls: "bg-slate-100 text-slate-700" },
  gagne: { label: "Gagné", cls: "bg-gain-soft text-gain-ink" },
  perdu: { label: "Perdu", cls: "bg-loss-soft text-loss-ink" },
  rembourse: { label: "Remboursé", cls: "bg-draw-soft text-draw-ink" },
  annule: { label: "Annulé", cls: "bg-slate-100 text-slate-500" },
};

export function BetCard({ bet, sources }: { bet: BetRow; sources: SourceOpt[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const st = STATUT[bet.statut];
  const propose = bet.resultat_propose && bet.resultat_propose !== "en_attente" ? bet.resultat_propose : null;
  const aConfirmer = bet.statut === "en_cours" && !!propose;
  const recent = bet.statut !== "annule"; // suppression possible à tout moment depuis le 25/11 (avant : 24 h)

  return (
    <li className="rounded-xl border border-slate-200 bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {bet.type === "combine" ? `Combiné × ${Number(bet.cote_totale).toFixed(2).replace(".", ",")}` : `Simple × ${Number(bet.cote_totale).toFixed(2).replace(".", ",")}`} · {fmt(bet.placed_at)}{bet.bookmaker ? ` · ${bet.bookmaker}` : ""}
          </p>
          <p className="text-base font-semibold">
            Mise {fcfa(Number(bet.mise))}
            {bet.statut !== "en_cours" && bet.gain_net !== null && (
              <span className={`ml-2 ${Number(bet.gain_net) >= 0 ? "text-gain-ink" : "text-loss-ink"}`}>
                {Number(bet.gain_net) >= 0 ? "+" : ""}{fcfa(Number(bet.gain_net))}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${aConfirmer ? "bg-draw-soft text-draw-ink" : st.cls}`}>{aConfirmer ? "À confirmer" : st.label}</span>
          <Link href={`/paris/${bet.id}`} className="text-[11px] font-medium text-brand">Analyser · modifier ›</Link>
        </div>
      </div>

      <ul className="space-y-2">
        {bet.bet_selections.map((s) => {
          const m = one(s.match);
          const label = m ? `${one(m.home)?.nom ?? ""} – ${one(m.away)?.nom ?? ""}` : s.match_libre ?? "Match non identifié";
          return (
            <li key={s.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.resultat === "gagne" ? <span className="text-gain-ink">✓ </span> : s.resultat === "perdu" ? <span className="text-loss-ink">✗ </span> : s.resultat === "rembourse" ? <span className="text-draw-ink">↩ </span> : null}{label}</p>
                <div className="text-xs text-slate-500">
                  {pickLabel(s.market_code, s.market_param === null ? null : Number(s.market_param), s.selection, m ? one(m.home)?.nom ?? "Équipe 1" : "Équipe 1", m ? one(m.away)?.nom ?? "Équipe 2" : "Équipe 2")} · cote {Number(s.cote).toFixed(2)}{bet.statut === "en_cours" && s.resultat === "en_attente" && (s.market_code === "LIBRE" || !m) ? <> · <Link href={`/paris/${bet.id}`} className="font-medium text-draw-ink underline">à régler à la main</Link></> : null} · <OriginPicker selectionId={s.id} current={s.origin_source_id} currentName={one(s.origin)?.nom ?? "—"} sources={sources} />
                </div>
              </div>
              {s.risque_calcule && (
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${RISK_CLASS[s.risque_calcule]}`}>{RISK_LABEL[s.risque_calcule]}</span>
              )}
            </li>
          );
        })}
      </ul>

      {bet.statut === "en_cours" && <ConfirmResult apres={reglableA(bet.bet_selections.map((s) => ({ kickoff_at: one(s.match)?.kickoff_at ?? null, statut: one(s.match)?.statut ?? null })))?.toISOString() ?? null} betId={bet.id} propose={propose} gainPropose={bet.gain_propose ?? null} mise={Number(bet.mise)} />}
      {!bet.detail_complet && <p className="mt-2 text-[11px] text-draw-ink">Détail des sélections non lu (ticket replié) : compte dans la bankroll, pas dans la notation des sources.</p>}
      {recent && (
        <div className="mt-2 text-right">
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)} className="text-[11px] text-ink-muted underline">Supprimer</button>
          ) : (
            <span className="text-[11px] text-slate-600">
              Supprimer ce pari et ses mouvements ?{" "}
              <button disabled={pending} onClick={() => start(async () => { const r = await deleteBet(bet.id); if (!r.ok) setErr(r.error); })} className="font-medium text-loss-ink underline">Oui</button>
              {" · "}
              <button onClick={() => setConfirmDel(false)} className="underline">Non</button>
            </span>
          )}
        </div>
      )}
      {err && <p className="mt-2 text-xs text-loss-ink">{err}</p>}
    </li>
  );
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", timeZone: "Africa/Abidjan" });
