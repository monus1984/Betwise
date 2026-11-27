"use client";

import { issue } from "@/lib/mesure/issue";

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
    match: MatchLite | MatchLite[] | null;
  }[];
};

type MatchLite = { kickoff_at: string; statut?: string; home: Named; away: Named; score_home?: number | null; score_away?: number | null; ht_home?: number | null; ht_away?: number | null; minute?: number | null; details?: { evts?: Evt[] } | null };

type Evt = { t: "but" | "pen" | "csc" | "pen_rate" | "jaune" | "rouge"; n: string | null; e: "1" | "2"; m: number };
const JOURS = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
const dateCourte = (iso: string) => { const d = new Date(iso); return `${JOURS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };
const nomCourt = (n: string) => n.replace(/^(?:[A-ZÀ-Ý]\.\s*)+/, (x) => x.replace(/\s+/g, ""));

/** État de la ligne : réglée, ou ce qu'elle donnerait si le match s'arrêtait maintenant (couleur, comme chez Betclic). */
function etatLigne(resultat: string, m: MatchLite | null, market: string, param: number | null, sel: string): "gagne" | "perdu" | "rembourse" | null {
  if (resultat === "gagne" || resultat === "perdu" || resultat === "rembourse") return resultat;
  if (!m || m.score_home == null || m.score_away == null || (m.statut !== "en_cours" && m.statut !== "termine")) return null;
  return issue(market, param, sel, { h: m.score_home, a: m.score_away, hth: m.ht_home ?? null, hta: m.ht_away ?? null });
}

/** Le match sous la ligne (27/11, d'après Betclic) : date, équipes de part et d'autre du score, minute, buteurs. */
function BoiteMatch({ m }: { m: MatchLite }) {
  const enCours = m.statut === "en_cours", fini = m.statut === "termine";
  const sc = m.score_home != null && m.score_away != null && (enCours || fini);
  const buts = (m.details?.evts ?? []).filter((e) => e.t === "but" || e.t === "pen" || e.t === "csc");
  const parCote = (c: "1" | "2") => {
    const l = new Map<string, number[]>();
    for (const e of buts) { const pour = e.t === "csc" ? (e.e === "1" ? "2" : "1") : e.e; if (pour !== c) continue; const n = `${nomCourt(e.n ?? "?")}${e.t === "csc" ? " (csc)" : e.t === "pen" ? " (pen.)" : ""}`; l.set(n, [...(l.get(n) ?? []), e.m]); }
    return [...l.entries()].map(([n, ms]) => `${n} ${ms.map((x) => `${x}′`).join(", ")}`);
  };
  const g = (n: number | null | undefined, o: number | null | undefined) => (sc && n != null && o != null && n < o ? "text-ink-muted" : "text-ink");
  return (
    <div className="mt-2 rounded-xl border border-line bg-canvas px-3 py-2">
      <p className="text-center text-[11.5px] text-ink-muted">{enCours ? <span className="font-semibold text-loss-ink">● En direct{m.minute ? ` · ${m.minute}′` : ""}</span> : dateCourte(m.kickoff_at)}</p>
      <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className={`truncate text-right text-[14px] font-semibold ${g(m.score_home, m.score_away)}`}>{one(m.home)?.nom ?? ""}</span>
        <span className={`rounded-lg px-2.5 py-1 text-[15px] font-bold tabular-nums ${enCours ? "bg-loss text-on-fill" : "bg-surface-2 text-ink"}`}>{sc ? `${m.score_home} - ${m.score_away}` : "–"}</span>
        <span className={`truncate text-[14px] font-semibold ${g(m.score_away, m.score_home)}`}>{one(m.away)?.nom ?? ""}</span>
      </div>
      {buts.length > 0 && (
        <div className="mt-1 grid grid-cols-[1fr_auto_1fr] gap-2 text-[11.5px] text-ink-muted">
          <span className="text-right">{parCote("1").map((x) => <span key={x} className="block">{x}</span>)}</span>
          <span className="w-12" />
          <span>{parCote("2").map((x) => <span key={x} className="block">{x}</span>)}</span>
        </div>
      )}
    </div>
  );
}

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

      <ul className="divide-y divide-line">
        {bet.bet_selections.map((s) => {
          const m = one(s.match);
          const param = s.market_param === null ? null : Number(s.market_param);
          const h = m ? one(m.home)?.nom ?? "Équipe 1" : "Équipe 1", a = m ? one(m.away)?.nom ?? "Équipe 2" : "Équipe 2";
          const etat = etatLigne(s.resultat, m, s.market_code, param, s.selection);
          const definitif = s.resultat !== "en_attente";
          const ton = etat === "gagne" ? "text-gain-ink" : etat === "perdu" ? "text-loss-ink" : etat === "rembourse" ? "text-draw-ink" : "text-ink";
          const dit = etat ? `${definitif ? "" : "pour l'instant : "}${etat === "gagne" ? "passe" : etat === "perdu" ? "ne passe pas" : "remboursé"}` : "en attente";
          return (
            <li key={s.id} className="py-3 first:pt-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-[16px] font-bold leading-snug ${ton}`} aria-label={`${pickLabel(s.market_code, param, s.selection, h, a)}, ${dit}`}>{definitif ? (etat === "gagne" ? "✓ " : etat === "perdu" ? "✗ " : "↩ ") : null}{pickLabel(s.market_code, param, s.selection, h, a)}</p>
                  {!m && <p className="text-[13px] text-ink-soft">{s.match_libre ?? "Match non identifié"}</p>}
                </div>
                <span className="shrink-0 text-[18px] font-bold italic tabular-nums">{Number(s.cote).toFixed(2).replace(".", ",")}</span>
              </div>
              {m && <BoiteMatch m={m} />}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-muted">
                <OriginPicker selectionId={s.id} current={s.origin_source_id} currentName={one(s.origin)?.nom ?? "—"} sources={sources} />
                {bet.statut === "en_cours" && s.resultat === "en_attente" && (s.market_code === "LIBRE" || !m) && <Link href={`/paris/${bet.id}`} className="font-medium text-draw-ink underline">à régler à la main</Link>}
                {s.risque_calcule && <span className={`rounded-full border px-2 py-0.5 text-[10.5px] ${RISK_CLASS[s.risque_calcule]}`}>{RISK_LABEL[s.risque_calcule]}</span>}
              </div>
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
