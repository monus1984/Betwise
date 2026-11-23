/**
 * « Moi » comme tipster (23/11, Mounir) : mes propres choix, notés comme une source.
 * Chaque sélection que j'ai choisie moi-même (origine « Moi ») compte comme un prono à mise fixe d'une unité,
 * qu'elle soit jouée en simple ou dans un combiné : c'est la même règle que pour les sources, donc comparable.
 * Paris réels seulement (les tests virtuels n'y entrent pas), comme « Mon bilan ».
 */
import { riskFromOdds, RISK_LABEL } from "@/components/ui";

export type SelMoi = { resultat: string | null; cote: number; market: string; placedAt: string; combine: boolean };
export type Ligne = { cle: string; regles: number; justes: number; reussite: number | null; attendu: number | null; rendement: number | null };
export type BilanMoi = Ligne & { parNiveau: Ligne[]; parMarche: Ligne[]; simples: Ligne; dansCombines: Ligne; trenteJours: Ligne; enCours: number };

function ligne(cle: string, l: SelMoi[]): Ligne {
  const r = l.filter((s) => s.resultat === "gagne" || s.resultat === "perdu");
  const justes = r.filter((s) => s.resultat === "gagne").length;
  const avecCote = r.filter((s) => s.cote > 1);
  return {
    cle, regles: r.length, justes,
    reussite: r.length ? justes / r.length : null,
    // « Attendu » : la réussite que les cotes laissaient prévoir (1/cote, marge du bookmaker comprise)
    attendu: avecCote.length ? avecCote.reduce((x, s) => x + 1 / s.cote, 0) / avecCote.length : null,
    // Rendement à mise égale : +(cote − 1) si juste, −1 sinon, en moyenne
    rendement: avecCote.length ? avecCote.reduce((x, s) => x + (s.resultat === "gagne" ? s.cote - 1 : -1), 0) / avecCote.length : null,
  };
}

export function bilanMoi(sels: SelMoi[], now = Date.now()): BilanMoi {
  const niveaux = (["prudent", "moyen", "risque"] as const).map((n) => ligne(RISK_LABEL[n], sels.filter((s) => riskFromOdds(s.cote) === n))).filter((l) => l.regles > 0);
  const marches = new Map<string, SelMoi[]>();
  for (const s of sels) marches.set(s.market, [...(marches.get(s.market) ?? []), s]);
  return {
    ...ligne("total", sels),
    parNiveau: niveaux,
    parMarche: [...marches].map(([k, l]) => ligne(k, l)).filter((l) => l.regles > 0).sort((a, b) => b.regles - a.regles).slice(0, 6),
    simples: ligne("simples", sels.filter((s) => !s.combine)),
    dansCombines: ligne("combinés", sels.filter((s) => s.combine)),
    trenteJours: ligne("30 jours", sels.filter((s) => now - Date.parse(s.placedAt) < 30 * 86_400_000)),
    enCours: sels.filter((s) => s.resultat === null || s.resultat === "en_attente").length,
  };
}
