import { probOf } from "./grid";
import { pickLabel, type Signal } from "./signals";

export type TicketSel = { match_id: string | null; market_code: string; market_param: number | null; selection: string; cote: number; home?: string; away?: string; libre?: string | null };
export type TicketLine = { label: string; match: string; cote: number; p: number; origine: "modele" | "marche" | "estime"; valeur: number };
export type TicketAnalysis = {
  lignes: TicketLine[]; pTicket: number; coteJuste: number; coteObtenue: number; esperance: number;
  maillonFaible: TicketLine | null; memeMatch: boolean; partEstimee: number;
};

const MARGE_SUPPOSEE = 0.05; // quand ni modèle ni cotes de référence : on retire 5 % de marge à la cote jouée

/**
 * Les probabilités viennent des cotes de référence (marge retirée) quand elles existent, du modèle sinon.
 * Le rendement attendu compare donc la cote obtenue chez le bookmaker au prix juste du marché.
 */
/** Probabilité réelle d'un ticket : produit des sélections (supposées indépendantes), cote juste, espérance. */
export function analyzeTicket(sels: TicketSel[], signals: Map<string, Signal>, coteTotale: number): TicketAnalysis | null {
  if (!sels.length) return null;
  const lignes = sels.map<TicketLine>((s) => {
    const sg = s.match_id ? signals.get(s.match_id) : undefined;
    const p0 = sg ? probOf(sg.grid, s.market_code, s.market_param !== null ? Number(s.market_param) : null, s.selection) : null;
    const p = p0 ?? Math.min(0.97, 1 / s.cote / (1 + MARGE_SUPPOSEE));
    const home = s.home ?? "Domicile", away = s.away ?? "Extérieur";
    return {
      label: pickLabel(s.market_code, s.market_param !== null ? Number(s.market_param) : null, s.selection, home, away),
      match: s.home && s.away ? `${s.home} – ${s.away}` : s.libre ?? "match non identifié",
      cote: s.cote, p, origine: p0 !== null && sg ? sg.source : "estime", valeur: p * s.cote - 1,
    };
  });
  const pTicket = lignes.reduce((a, l) => a * l.p, 1);
  const ids = sels.map((s) => s.match_id).filter(Boolean);
  return {
    lignes, pTicket, coteJuste: 1 / pTicket, coteObtenue: coteTotale, esperance: pTicket * coteTotale - 1,
    maillonFaible: lignes.length > 1 ? [...lignes].sort((a, b) => a.p - b.p)[0] : null,
    memeMatch: new Set(ids).size < ids.length,
    partEstimee: lignes.filter((l) => l.origine === "estime").length / lignes.length,
  };
}
