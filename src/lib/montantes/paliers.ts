/**
 * Cohérence entre le niveau choisi pour une montante et la cote qu'elle exige à chaque palier (audit du 22/11, P1-7 :
 * « Équilibré » affiché, cote de 1,78 demandée). Bornes : Prudent 1,10–1,29, Équilibré 1,30–1,54, Audacieux 1,55–3,00.
 */
import { categorieFromOdds, type Categorie } from "../coach/categories";

const BANDE: Record<Categorie, [number, number]> = { sur: [1.1, 1.29], audacieux: [1.3, 1.54], risque: [1.55, 3] };
export const PALIERS_MAX = 10;

export function coteParPalier(mise: number, objectif: number, paliers: number): number | null {
  return mise > 0 && objectif > mise && paliers >= 1 ? Math.pow(objectif / mise, 1 / paliers) : null;
}

/** Le plus petit nombre de paliers qui ramène la cote par palier dans le niveau choisi, ou null si impossible en 10. */
export function paliersPourNiveau(mise: number, objectif: number, niveau: Categorie): number | null {
  if (!(mise > 0 && objectif > mise)) return null;
  const [, haut] = BANDE[niveau];
  for (let n = 1; n <= PALIERS_MAX; n++) {
    const c = Math.pow(objectif / mise, 1 / n);
    if (c <= haut) return c >= BANDE[niveau][0] ? n : null;
  }
  return null;
}

/** Niveau réel d'une cote par palier, pour le comparer à celui choisi. */
export const niveauDeCote = (c: number): Categorie | null => categorieFromOdds(c);
