"use client";

import { useEffect, useRef, useState } from "react";
import { Field, Input } from "@/components/ui";

export type MatchHit = { id: string; kickoff_at: string; statut: string; home: string; away: string; competition: string };

export const SELECTIONS: Record<string, string[]> = {
  "1X2": ["1", "N", "2"],
  DC: ["1N", "12", "N2"],
  DNB: ["1", "2"],
  OU: ["Plus", "Moins"],
  BTTS: ["Oui", "Non"],
  AH: ["1", "2"],
  TT1: ["Plus", "Moins"],
  TT2: ["Plus", "Moins"],
  CS: [],
  HT_1X2: ["1", "N", "2"], HT_DC: ["1N", "12", "N2"], HT_OU: ["Plus", "Moins"], HT_BTTS: ["Oui", "Non"],
  H2_1X2: ["1", "N", "2"], H2_OU: ["Plus", "Moins"],
  HTFT: ["1/1", "1/N", "1/2", "N/1", "N/N", "N/2", "2/1", "2/N", "2/2"],
  HMG: ["1", "N", "2"],
  OE: ["Pair", "Impair"],
  MG: ["0-1", "1-2", "1-3", "2-3", "2-4", "3-4", "3-5", "4-6"],
  EH: ["1", "N", "2"],
  WTN: ["1", "2"],
};

/** Marchés combinés d'un même match : sélection « A|B ». */
export const COMBO_PARTS: Record<string, [string[], string[]]> = {
  DC_OU: [["1N", "12", "N2"], ["Plus", "Moins"]],
  "1X2_OU": [["1", "N", "2"], ["Plus", "Moins"]],
  DC_BTTS: [["1N", "12", "N2"], ["Oui", "Non"]],
  "1X2_BTTS": [["1", "N", "2"], ["Oui", "Non"]],
  OU_BTTS: [["Plus", "Moins"], ["Oui", "Non"]],
};
/** Ligne par défaut à la sélection d'un marché. */
export const defaultParam = (market: string) => (["TT1", "TT2", "HT_OU", "H2_OU"].includes(market) ? "0.5" : market.includes("OU") ? "2.5" : market === "AH" ? "-1.5" : market === "EH" ? "-1" : "");
export const paramLabel = (market: string) => (market === "AH" ? "Handicap" : market === "EH" ? "Handicap (équipe à domicile)" : market === "TT1" || market === "TT2" ? "Ligne (buts de l’équipe)" : market === "HT_OU" || market === "H2_OU" ? "Ligne (buts de la mi-temps)" : "Ligne (buts)");

export const toNum = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

export function labelSel(market: string, s: string, m: MatchHit | null) {
  const team = (x: string) => (x === "1" ? (m ? short(m.home) : "Dom.") : x === "2" ? (m ? short(m.away) : "Ext.") : "Nul");
  if (market === "HTFT") { const [a, b] = s.split("/"); return `${team(a)} / ${team(b)}`; }
  if (market === "HMG") return s === "1" ? "1re mi-temps" : s === "2" ? "2e mi-temps" : "Autant";
  if (market === "MG") { const [a, b] = s.split("-"); return a === "0" ? `${b} au plus` : `${a} à ${b} buts`; }
  if (["1X2", "DNB", "AH", "HT_1X2", "H2_1X2", "EH", "WTN"].includes(market)) {
    if (s === "1") return m ? short(m.home) : "Domicile";
    if (s === "2") return m ? short(m.away) : "Extérieur";
    return "Nul";
  }
  if (market === "DC" || market === "HT_DC") return { "1N": "Dom. ou nul", "12": "Dom. ou ext.", N2: "Nul ou ext." }[s] ?? s;
  if (s === "Plus" || s === "Moins") return s === "Plus" ? "Plus de" : "Moins de";
  if (s === "Oui" || s === "Non") return s === "Oui" ? "Les deux marquent" : "Pas les deux";
  return s;
}
export const short = (n: string) => n.replace(/\s?(FC|CF|SC|AC|AS|US|SV|RB|SSC|Calcio|Club de Fútbol|Football Club)\b\.?/g, "").trim().slice(0, 16);

type PickerLine = { query: string; match: MatchHit | null };

/** Sélecteur de match : autocomplétion sur les équipes (nom et alias), texte libre accepté. */
export function MatchPicker({ line, onChange, hint }: { line: PickerLine; onChange: (p: Partial<PickerLine>) => void; hint?: string }) {
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
    <Field label="Match" hint={hint ?? "Tape un nom d’équipe. Si le match n’est pas trouvé, le texte sera gardé tel quel."}>
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

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
}
