"use client";

import { COMBO_PARTS, LINE_MARKETS, SELECTIONS, freePlaceholder, labelSel, type MatchHit } from "@/components/match-picker";
import { Chip, Input } from "@/components/ui";
import { MARKETS_STAT_JOUEUR } from "@/lib/bets/markets";

/** Choix de la sélection pour n'importe quel marché, y compris les combos d'un même match (« A|B »). */
export function SelectionField({ market, param, value, match, onChange }: { market: string; param: string; value: string; match: MatchHit | null; onChange: (v: string) => void }) {
  const combo = COMBO_PARTS[market];
  if (combo) {
    const [a, b] = value.split("|");
    const first = market === "OU_BTTS" ? "OU" : market.startsWith("DC") ? "DC" : "1X2";
    const second = market.endsWith("BTTS") ? "BTTS" : "OU";
    const lab = (m: string, v: string) => (m === "OU" ? `${v === "Plus" ? "+" : "−"} de ${param || "2.5"} buts` : labelSel(m, v, match));
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">{combo[0].map((o) => <Chip key={o} active={a === o} onClick={() => onChange(`${o}|${b ?? combo[1][0]}`)}>{lab(first, o)}</Chip>)}</div>
        <div className="flex flex-wrap gap-2">{combo[1].map((o) => <Chip key={o} active={b === o} onClick={() => onChange(`${a ?? combo[0][0]}|${o}`)}>{lab(second, o)}</Chip>)}</div>
      </div>
    );
  }
  if (MARKETS_STAT_JOUEUR.includes(market)) {
    // « Plus|Harry Kane » : le sens et le joueur
    const i = value.indexOf("|"), dir = i >= 0 ? value.slice(0, i) : "", nom = i >= 0 ? value.slice(i + 1) : value;
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">{["Plus", "Moins"].map((o) => <Chip key={o} active={dir === o} onClick={() => onChange(`${o}|${nom}`)}>{`${o} de ${param || "?"}`}</Chip>)}</div>
        <Input value={nom} onChange={(e) => onChange(`${dir || "Plus"}|${e.target.value}`)} placeholder="Nom du joueur, ex. Harry Kane" />
      </div>
    );
  }
  if (SELECTIONS[market]?.length) {
    return (
      <div className="flex flex-wrap gap-2">
        {SELECTIONS[market].map((s) => <Chip key={s} active={value === s} onClick={() => onChange(s)}>{LINE_MARKETS.includes(market) ? `${labelSel(market, s, match)} ${param || "?"}` : labelSel(market, s, match)}</Chip>)}
      </div>
    );
  }
  return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={freePlaceholder(market)} />;
}
