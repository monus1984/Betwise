import { coteEstimee } from "../options/build";
import { pickLabel } from "../probs/signals";
import type { Leg } from "./store";

/**
 * Sélection prête pour le coupon. La cote, par ordre de préférence : celle d'un bookmaker (1xBet) quand elle a été
 * relevée, sinon la cote de référence (médiane), sinon une cote estimée (cote juste moins 5 %).
 */
export function legFrom(o: { matchId: string; home: string; away: string; kickoff: string; comp: string; market: string; param: number | null; sel: string; p: number | null; cote: number | null; book?: { cote: number; bookmaker: string } | null; label?: string }): Leg {
  const reelle = o.book?.cote ?? o.cote;
  const cote = reelle ?? (o.p ? coteEstimee({ p: o.p, cote: null }) : 1.01);
  return {
    matchId: o.matchId, home: o.home, away: o.away, kickoff: o.kickoff, comp: o.comp,
    market: o.market, param: o.param, sel: o.sel, label: o.label ?? pickLabel(o.market, o.param, o.sel, o.home, o.away),
    cote: Math.round(cote * 100) / 100, estimee: !reelle, p: o.p, book: o.book?.bookmaker ?? null,
  };
}
