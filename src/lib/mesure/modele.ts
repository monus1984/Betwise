/**
 * Rejeu pas à pas du modèle maison : chaque semaine, les forces des équipes sont recalculées avec les seuls matchs
 * joués AVANT cette semaine, puis les matchs de la semaine sont prédits. Aucune information du futur n'entre dans une prévision.
 */
import { fitRatings, predict, type HistMatch } from "../model/poisson";

export type MatchHist = { ligue: string; date: Date; home: string; away: string; hg: number; ag: number; xh: number | null; xa: number | null };
export type Prevision = { ligue: string; date: Date; home: string; away: string; hg: number; ag: number; p: [number, number, number]; pPlus25: number; pBtts: number };

const SEMAINE = 7 * 86400000;

export function rejouerModele(matchs: MatchHist[], opts: Parameters<typeof fitRatings>[2], o: { minEntrainement?: number; fenetreJours?: number } = {}): Prevision[] {
  const min = o.minEntrainement ?? 200, fenetre = (o.fenetreJours ?? 800) * 86400000;
  const out: Prevision[] = [];
  for (const ligue of [...new Set(matchs.map((m) => m.ligue))]) {
    const ms = matchs.filter((m) => m.ligue === ligue).sort((a, b) => a.date.getTime() - b.date.getTime());
    const semaines = [...new Set(ms.map((m) => Math.floor(m.date.getTime() / SEMAINE)))];
    for (const s of semaines) {
      const debut = s * SEMAINE;
      const train = ms.filter((m) => m.date.getTime() < debut && m.date.getTime() >= debut - fenetre);
      if (train.length < min) continue;
      const r = fitRatings(train.map<HistMatch>((m) => ({ date: m.date, home: m.home, away: m.away, hg: m.hg, ag: m.ag, xh: m.xh, xa: m.xa })), new Date(debut), opts);
      for (const m of ms.filter((x) => Math.floor(x.date.getTime() / SEMAINE) === s)) {
        const p = predict(r, m.home, m.away);
        if (p) out.push({ ligue, date: m.date, home: m.home, away: m.away, hg: m.hg, ag: m.ag, p: [p.p1, p.pN, p.p2], pPlus25: p.pPlus25, pBtts: p.pBttsOui });
      }
    }
  }
  return out;
}
