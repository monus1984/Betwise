/**
 * Historique des résultats depuis football-data.co.uk (CSV publics, usage libre cité sur le site).
 * Un fichier par ligue et par saison ; colonnes utilisées : Date, HomeTeam, AwayTeam, FTHG, FTAG,
 * AvgH/AvgD/AvgA et Avg>2.5/Avg<2.5 (moyennes marché ; anciennes saisons : BbAvH…).
 */

export const LEAGUE_CODES: Record<string, string> = { PL: "E0", PD: "SP1", SA: "I1", BL1: "D1", FL1: "F1" };

export type HistoryRow = {
  ligue: string; saison: string; played_on: string; home_nom: string; away_nom: string;
  home_goals: number; away_goals: number;
  cote_1: number | null; cote_n: number | null; cote_2: number | null; cote_plus25: number | null; cote_moins25: number | null;
};

/** Saison au format football-data.co.uk (2526 pour 2025-26). La saison bascule en juillet. */
export function seasonCode(d = new Date()) {
  const y = d.getUTCFullYear() % 100, start = d.getUTCMonth() >= 6 ? y : y - 1;
  return `${String(start).padStart(2, "0")}${String(start + 1).padStart(2, "0")}`;
}
export function previousSeason(code: string) {
  const a = Number(code.slice(0, 2)) - 1;
  return `${String(a).padStart(2, "0")}${String(a + 1).padStart(2, "0")}`;
}

export function parseCsv(text: string, ligue: string, saison: string): HistoryRow[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const head = lines[0].split(",");
  const ix = (...names: string[]) => names.map((n) => head.indexOf(n)).find((i) => i >= 0) ?? -1;
  const iDate = ix("Date"), iH = ix("HomeTeam"), iA = ix("AwayTeam"), iHG = ix("FTHG"), iAG = ix("FTAG");
  const i1 = ix("AvgH", "BbAvH"), iN = ix("AvgD", "BbAvD"), i2 = ix("AvgA", "BbAvA");
  const iO = ix("Avg>2.5", "BbAv>2.5"), iU = ix("Avg<2.5", "BbAv<2.5");
  const num = (v: string | undefined) => { const n = Number(v); return v && Number.isFinite(n) && n > 1 ? n : null; };
  const out: HistoryRow[] = [];
  for (const l of lines.slice(1)) {
    const c = l.split(",");
    const hg = Number(c[iHG]), ag = Number(c[iAG]);
    if (!c[iH] || !c[iA] || c[iHG] === "" || !Number.isFinite(hg) || !Number.isFinite(ag)) continue;
    const [dd, mm, yy] = (c[iDate] ?? "").split("/");
    if (!dd || !mm || !yy) continue;
    const year = yy.length === 2 ? `20${yy}` : yy;
    out.push({
      ligue, saison, played_on: `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`,
      home_nom: c[iH].trim(), away_nom: c[iA].trim(), home_goals: hg, away_goals: ag,
      cote_1: num(c[i1]), cote_n: num(c[iN]), cote_2: num(c[i2]), cote_plus25: num(c[iO]), cote_moins25: num(c[iU]),
    });
  }
  return out;
}

export async function fetchSeason(ligue: string, saison: string) {
  const url = `https://www.football-data.co.uk/mmz4281/${saison}/${ligue}.csv`;
  const r = await fetch(url, { headers: { "User-Agent": "BETWISE prototype (usage non commercial)" } });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return parseCsv(await r.text(), ligue, saison);
}
