"use client";

import { useState, useTransition } from "react";
import { settleBet } from "@/lib/bets/actions";
import { RISK_CLASS, RISK_LABEL, fcfa } from "@/components/ui";

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
  bet_selections: {
    id: string;
    match_libre: string | null;
    market_code: string;
    market_param: number | null;
    selection: string;
    cote: number;
    resultat: string;
    risque_calcule: "prudent" | "moyen" | "risque" | null;
    origin: Named;
    match: { kickoff_at: string; home: Named; away: Named } | { kickoff_at: string; home: Named; away: Named }[] | null;
  }[];
};

const STATUT: Record<BetRow["statut"], { label: string; cls: string }> = {
  en_cours: { label: "En cours", cls: "bg-slate-100 text-slate-700" },
  gagne: { label: "Gagné", cls: "bg-emerald-100 text-emerald-800" },
  perdu: { label: "Perdu", cls: "bg-red-100 text-red-800" },
  rembourse: { label: "Remboursé", cls: "bg-amber-100 text-amber-800" },
  annule: { label: "Annulé", cls: "bg-slate-100 text-slate-500" },
};

export function BetCard({ bet }: { bet: BetRow }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const st = STATUT[bet.statut];

  function settle(r: "gagne" | "perdu" | "rembourse") {
    setErr(null);
    start(async () => {
      const res = await settleBet(bet.id, r);
      if (!res.ok) setErr(res.error);
    });
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {bet.type === "combine" ? `Combiné × ${Number(bet.cote_totale).toFixed(2)}` : `Simple × ${Number(bet.cote_totale).toFixed(2)}`} · {fmt(bet.placed_at)}
          </p>
          <p className="text-base font-semibold">
            Mise {fcfa(Number(bet.mise))}
            {bet.statut !== "en_cours" && bet.gain_net !== null && (
              <span className={`ml-2 ${Number(bet.gain_net) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {Number(bet.gain_net) >= 0 ? "+" : ""}{fcfa(Number(bet.gain_net))}
              </span>
            )}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}>{st.label}</span>
      </div>

      <ul className="space-y-2">
        {bet.bet_selections.map((s) => {
          const m = one(s.match);
          const label = m ? `${one(m.home)?.nom ?? ""} – ${one(m.away)?.nom ?? ""}` : s.match_libre ?? "Match non identifié";
          return (
            <li key={s.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{label}</p>
                <p className="text-xs text-slate-500">
                  {marketLabel(s.market_code, s.market_param, s.selection)} · cote {Number(s.cote).toFixed(2)} · <span className="text-slate-700">{one(s.origin)?.nom ?? "—"}</span>
                </p>
              </div>
              {s.risque_calcule && (
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${RISK_CLASS[s.risque_calcule]}`}>{RISK_LABEL[s.risque_calcule]}</span>
              )}
            </li>
          );
        })}
      </ul>

      {bet.statut === "en_cours" && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button disabled={pending} onClick={() => settle("gagne")} className="rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white disabled:opacity-50">Gagné</button>
          <button disabled={pending} onClick={() => settle("perdu")} className="rounded-lg bg-red-600 py-2 text-sm font-medium text-white disabled:opacity-50">Perdu</button>
          <button disabled={pending} onClick={() => settle("rembourse")} className="rounded-lg bg-slate-200 py-2 text-sm font-medium text-slate-800 disabled:opacity-50">Remboursé</button>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
    </li>
  );
}

function marketLabel(code: string, param: number | null, sel: string) {
  switch (code) {
    case "1X2": return { "1": "Victoire dom.", N: "Nul", "2": "Victoire ext." }[sel] ?? sel;
    case "DC": return `Double chance ${sel}`;
    case "DNB": return `Remb. si nul · ${sel === "1" ? "dom." : "ext."}`;
    case "OU": return `${sel} de ${param ?? ""} buts`;
    case "BTTS": return `Les deux marquent : ${sel}`;
    case "AH": return `Handicap ${param ?? ""} · ${sel === "1" ? "dom." : "ext."}`;
    case "CS": return `Score exact ${sel}`;
    case "DC_OU": { const [dc, ou] = sel.split("|"); return `Double chance ${dc} & ${ou} de ${param ?? ""} buts`; }
    case "1X2_OU": { const [r, ou] = sel.split("|"); return `${({ "1": "Dom.", N: "Nul", "2": "Ext." } as Record<string,string>)[r] ?? r} & ${ou} de ${param ?? ""} buts`; }
    default: return `${code} ${sel}`;
  }
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", timeZone: "Africa/Abidjan" });
