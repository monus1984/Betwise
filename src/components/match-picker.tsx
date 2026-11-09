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
  CS: [],
};

export const toNum = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

export function labelSel(market: string, s: string, m: MatchHit | null) {
  if (market === "1X2" || market === "DNB" || market === "AH") {
    if (s === "1") return m ? short(m.home) : "Domicile";
    if (s === "2") return m ? short(m.away) : "Extérieur";
    return "Nul";
  }
  if (market === "DC") return { "1N": "Dom. ou nul", "12": "Dom. ou ext.", N2: "Nul ou ext." }[s] ?? s;
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
