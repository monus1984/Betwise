"use client";

import { useEffect, useRef, useState } from "react";
import { Field, Input } from "@/components/ui";
import { COMP_SHORT } from "@/components/match-ui";

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
  MG: ["0-0", "1-1", "2-2", "3-3", "4-4", "5-99", "0-1", "1-2", "1-3", "2-3", "2-4", "3-4", "3-5", "4-6"],
  EH: ["1", "N", "2"],
  WTN: ["1", "2"],
  HT_CS: [],
  CORN: ["Plus", "Moins"], CORN1: ["Plus", "Moins"], CORN2: ["Plus", "Moins"], CORN_1X2: ["1", "N", "2"],
  CARD: ["Plus", "Moins"], CARD1: ["Plus", "Moins"], CARD2: ["Plus", "Moins"], RED: ["Oui", "Non"],
  SHOT: ["Plus", "Moins"], SOT: ["Plus", "Moins"], SOT1: ["Plus", "Moins"], SOT2: ["Plus", "Moins"],
  BUT: [], BUT1: [],
  ET: ["Oui", "Non"], PEN: ["Oui", "Non"], QUALIF: ["1", "2"],
  H2_BTTS: ["Oui", "Non"], H2_DC: ["1N", "12", "N2"],
  HT_TT1: ["Plus", "Moins"], HT_TT2: ["Plus", "Moins"], H2_TT1: ["Plus", "Moins"], H2_TT2: ["Plus", "Moins"],
  WEH: ["1", "2"], BH: ["Oui", "Non"], PK: ["Oui", "Non"], PKB: ["Oui", "Non"], DBL: ["Oui", "Non"],
  LIBRE: [],
  // Ajoutés le 19/11
  HT_AH: ["1", "2"], H2_AH: ["1", "2"], HT_DNB: ["1", "2"], H2_DNB: ["1", "2"], HT_OE: ["Pair", "Impair"], H2_OE: ["Pair", "Impair"], H2_CS: [],
  OE1: ["Pair", "Impair"], OE2: ["Pair", "Impair"], MG1: ["0-0", "1-1", "2-2", "3-99", "0-1", "1-2", "2-3"], MG2: ["0-0", "1-1", "2-2", "3-99", "0-1", "1-2", "2-3"],
  WBH: ["1", "2"], SBH: ["1", "2"], FTS: ["1", "Aucun", "2"], LTS: ["1", "Aucun", "2"], GB: ["Oui", "Non"], OG: ["Oui", "Non"], PKM: ["Oui", "Non"],
  BUTL: [], BUT2: [], BUT3: [], PCARD: [], CARD_1X2: ["1", "N", "2"], RED1: ["Oui", "Non"], RED2: ["Oui", "Non"],
  SHOT1: ["Plus", "Moins"], SHOT2: ["Plus", "Moins"], CORN_AH: ["1", "2"], CORN_OE: ["Pair", "Impair"], CORN_DC: ["1N", "12", "N2"],
  FOUL: ["Plus", "Moins"], FOUL1: ["Plus", "Moins"], FOUL2: ["Plus", "Moins"], OFF: ["Plus", "Moins"], OFF1: ["Plus", "Moins"], OFF2: ["Plus", "Moins"],
  COMBO: [], PSHOT: [], PSOT: [], PAST: [],
};
/** Marchés « plus / moins » d'une ligne : la sélection s'affiche avec la ligne. */
export const LINE_MARKETS = ["OU", "TT1", "TT2", "HT_OU", "H2_OU", "HT_TT1", "HT_TT2", "H2_TT1", "H2_TT2", "CORN", "CORN1", "CORN2", "CARD", "CARD1", "CARD2", "SHOT", "SOT", "SOT1", "SOT2", "SHOT1", "SHOT2", "FOUL", "FOUL1", "FOUL2", "OFF", "OFF1", "OFF2"];
const DEFAULT_LINE: Record<string, string> = { TT1: "0.5", TT2: "0.5", HT_OU: "0.5", H2_OU: "0.5", HT_TT1: "0.5", HT_TT2: "0.5", H2_TT1: "0.5", H2_TT2: "0.5", AH: "-1.5", EH: "-1", CORN: "9.5", CORN1: "4.5", CORN2: "4.5", CARD: "3.5", CARD1: "1.5", CARD2: "1.5", SHOT: "24.5", SOT: "8.5", SOT1: "4.5", SOT2: "3.5",
  HT_AH: "-1", H2_AH: "-1", CORN_AH: "-1.5", GB: "15", SHOT1: "12.5", SHOT2: "10.5", FOUL: "24.5", FOUL1: "12.5", FOUL2: "12.5", OFF: "3.5", OFF1: "1.5", OFF2: "1.5", PSHOT: "1.5", PSOT: "0.5", PAST: "0.5" };
/** Texte d'aide pour les marchés à saisie libre. */
export const freePlaceholder = (market: string) => (market === "LIBRE" ? "Le pari comme sur le ticket, ex. Mbappé buteur ou passeur" : ["BUT", "BUT1", "BUTL", "BUT2", "BUT3", "PCARD"].includes(market) ? "Nom du joueur, ex. Mbappé"
  : market === "COMBO" ? "Conditions séparées par &, ex. DC:1N & OU@2.5:Plus" : market === "HT_CS" || market === "H2_CS" ? "ex. 1-0" : "ex. 2-1");

/** Marchés combinés d'un même match : sélection « A|B ». */
export const COMBO_PARTS: Record<string, [string[], string[]]> = {
  DC_OU: [["1N", "12", "N2"], ["Plus", "Moins"]],
  "1X2_OU": [["1", "N", "2"], ["Plus", "Moins"]],
  DC_BTTS: [["1N", "12", "N2"], ["Oui", "Non"]],
  "1X2_BTTS": [["1", "N", "2"], ["Oui", "Non"]],
  OU_BTTS: [["Plus", "Moins"], ["Oui", "Non"]],
};
/** Ligne par défaut à la sélection d'un marché. */
export const defaultParam = (market: string) => DEFAULT_LINE[market] ?? (market.includes("OU") ? "2.5" : "");
export const paramLabel = (market: string) => (market === "AH" || market.endsWith("_AH") ? "Handicap" : market === "GB" ? "Minute" : market === "PAST" ? "Ligne (passes décisives)" : market === "PSHOT" || market === "PSOT" ? "Ligne (tirs du joueur)" : market === "EH" ? "Handicap (équipe à domicile)" : /^(CORN|CARD|SHOT|SOT|FOUL|OFF)/.test(market) ? "Ligne" : /TT[12]$/.test(market) ? "Ligne (buts de l’équipe)" : market === "HT_OU" || market === "H2_OU" ? "Ligne (buts de la mi-temps)" : "Ligne (buts)");

export const toNum = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

export function labelSel(market: string, s: string, m: MatchHit | null) {
  const team = (x: string) => (x === "1" ? (m ? short(m.home) : "Dom.") : x === "2" ? (m ? short(m.away) : "Ext.") : "Nul");
  if (market === "HTFT") { const [a, b] = s.split("/"); return `${team(a)} / ${team(b)}`; }
  if (market === "HMG") return s === "1" ? "1re mi-temps" : s === "2" ? "2e mi-temps" : "Autant";
  if (market === "MG" || market === "MG1" || market === "MG2") { const [a, b] = s.split("-"); return a === b ? `${a} exactement` : Number(b) >= 9 ? `${a} ou plus` : a === "0" ? `${b} au plus` : `${a} à ${b} buts`; }
  if ((market === "FTS" || market === "LTS") && s === "Aucun") return "Aucun but";
  if (["1X2", "DNB", "AH", "HT_1X2", "H2_1X2", "EH", "WTN", "QUALIF", "CORN_1X2", "WEH", "HT_AH", "H2_AH", "HT_DNB", "H2_DNB", "WBH", "SBH", "CORN_AH", "CARD_1X2", "FTS", "LTS"].includes(market)) {
    if (s === "1") return m ? short(m.home) : "Domicile";
    if (s === "2") return m ? short(m.away) : "Extérieur";
    return "Nul";
  }
  if (market === "DC" || market === "HT_DC" || market === "H2_DC" || market === "CORN_DC") return { "1N": "Dom. ou nul", "12": "Dom. ou ext.", N2: "Nul ou ext." }[s] ?? s;
  if (s === "Plus" || s === "Moins") return s === "Plus" ? "Plus de" : "Moins de";
  // « Oui / Non » ne veut dire « les deux marquent » que sur ces marchés : ailleurs (penalty, tirs au but, carton rouge…) on écrit Oui ou Non
  if (s === "Oui" || s === "Non") return /BTTS$/.test(market) ? (s === "Oui" ? "Les deux marquent" : "Pas les deux") : s;
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
        <div className="flex items-center justify-between rounded-lg border border-inverse bg-slate-50 px-3 py-2.5">
          <div className="text-sm">
            <p className="font-medium">{m.home} – {m.away}</p>
            <p className="text-xs text-slate-500">{COMP_SHORT[m.competition] ?? m.competition} · {fmtDate(m.kickoff_at)}</p>
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
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-surface shadow-lg">
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                  onClick={() => { onChange({ match: h, query: `${h.home} – ${h.away}` }); setOpen(false); }}
                >
                  <span>{h.home} – {h.away}</span>
                  <span className="ml-2 shrink-0 text-xs text-slate-500">{COMP_SHORT[h.competition] ?? h.competition} · {fmtDate(h.kickoff_at)}</span>
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
