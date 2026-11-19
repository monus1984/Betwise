/**
 * Analyse d'une source (19/11) : ses chiffres sur plusieurs critères (compétition, marché, risque) et ses forces et
 * faiblesses. Une force ou une faiblesse demande au moins MIN résultats réglés sur ce critère, et un écart net avec
 * la réussite générale de la source : sinon on ne dit rien.
 */
import { MARCHE_FR } from "@/lib/markets-fr";

export type Axe = "competition" | "marche" | "risque";
export type LigneAxe = { axe: Axe; valeur: string; nb: number; gagnes: number; rendement: number | null };
export type Point = LigneAxe & { taux: number; libelle: string };
export const MIN = 3;
export const ECART = 0.1;

const RISQUE_FR: Record<string, string> = { prudent: "Cotes basses", moyen: "Cotes moyennes", risque: "Cotes hautes", sur: "Prudent", audacieux: "Équilibré" };
export const AXE_FR: Record<Axe, string> = { competition: "Compétition", marche: "Marché", risque: "Niveau de cote" };

export function libelle(l: Pick<LigneAxe, "axe" | "valeur">, comps: Record<string, string> = {}): string {
  if (l.axe === "marche") return MARCHE_FR[l.valeur] ?? l.valeur;
  if (l.axe === "risque") return RISQUE_FR[l.valeur] ?? l.valeur;
  return comps[l.valeur] ?? l.valeur;
}

export function forcesEtFaiblesses(lignes: LigneAxe[], tauxGeneral: number | null, comps: Record<string, string> = {}, max = 2): { forces: Point[]; faiblesses: Point[] } {
  const pts: Point[] = lignes.filter((l) => l.nb >= MIN).map((l) => ({ ...l, taux: l.gagnes / l.nb, libelle: libelle(l, comps) }));
  if (tauxGeneral === null) return { forces: [], faiblesses: [] };
  const forces = pts.filter((p) => p.taux >= tauxGeneral + ECART).sort((a, b) => b.taux - a.taux || b.nb - a.nb).slice(0, max);
  const faiblesses = pts.filter((p) => p.taux <= tauxGeneral - ECART).sort((a, b) => a.taux - b.taux || b.nb - a.nb).slice(0, max);
  return { forces, faiblesses };
}
