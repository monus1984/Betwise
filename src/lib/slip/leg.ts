import { coteEstimee } from "../options/build";
import { pickLabel } from "../probs/signals";
import type { Leg } from "./store";

/** Sélection prête pour le coupon : cote de référence si elle existe, sinon cote estimée (cote juste moins 5 %). */
export function legFrom(o: { matchId: string; home: string; away: string; kickoff: string; comp: string; market: string; param: number | null; sel: string; p: number | null; cote: number | null; label?: string }): Leg {
  const cote = o.cote ?? (o.p ? coteEstimee({ p: o.p, cote: null }) : 1.01);
  return {
    matchId: o.matchId, home: o.home, away: o.away, kickoff: o.kickoff, comp: o.comp,
    market: o.market, param: o.param, sel: o.sel, label: o.label ?? pickLabel(o.market, o.param, o.sel, o.home, o.away),
    cote: Math.round(cote * 100) / 100, estimee: !o.cote, p: o.p,
  };
}
