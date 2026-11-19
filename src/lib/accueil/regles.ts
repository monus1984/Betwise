/**
 * Règles de l'accueil, sans accès à la base : testables seules.
 * Décisions du 19/11 (docs/design/accueil/04-arbitrage.md) : D10, D12, D13.
 */
import { MARCHE_FR } from "@/lib/markets-fr";

export type Couverture = "marche_modele" | "marche" | "modele" | "aucune";
export type Expression = "positive" | "prudente" | "neutre";

/** D'où vient la probabilité affichée. */
export function couverture(s: { source: "marche" | "modele"; model: unknown | null } | null | undefined): Couverture {
  if (!s) return "aucune";
  if (s.source === "marche") return s.model ? "marche_modele" : "marche";
  return "modele";
}

export const COUVERTURE_FR: Record<Couverture, string> = {
  marche_modele: "Marché et modèle",
  marche: "Marché seul",
  modele: "Modèle seul, sans cote",
  aucune: "Pas d’analyse",
};

/**
 * Expression de Betster (D13) : positive à 60 % ou plus avec une cote relevée il y a moins de 48 h ; prudente sous 60 %
 * ou sans cote (modèle seul) ; neutre sans donnée. Jamais déduite de l'accord entre le marché et le modèle (D12).
 */
export function expression(o: { p: number | null; couverture: Couverture; coteFraiche: boolean }): Expression {
  if (o.p === null || o.couverture === "aucune") return "neutre";
  if (o.couverture === "modele" || !o.coteFraiche) return "prudente";
  return o.p >= 0.6 ? "positive" : "prudente";
}

/** Avis de Betster (D10) : le premier coup du jour Audacieux, sinon le premier Sûr ; rien sinon. */
export function avisDuJour<T extends { categorie: string; statut: string }>(picks: T[]): T | null {
  const avenir = picks.filter((p) => p.statut === "programme");
  return avenir.find((p) => p.categorie === "audacieux") ?? avenir.find((p) => p.categorie === "sur") ?? null;
}

/** Le marché d'une sélection, nommé au-dessus d'elle (revue du 19/11, P0) : « Résultat » ou « Autre marché : … ». */
export function libelleMarche(code: string): string {
  if (code === "1X2") return "Résultat";
  if (code === "DC") return "Double chance";
  const nom = MARCHE_FR[code] ?? "autre pari";
  return `Autre marché : ${nom.charAt(0).toLowerCase()}${nom.slice(1)}`;
}

/** « il y a 2 h », « il y a 25 min », « hier » : âge d'un relevé de cote. */
export function ilYA(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (min < 60) return `il y a ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `il y a ${h} h` : h < 48 ? "hier" : `il y a ${Math.round(h / 24)} jours`;
}

/** Un prono publié avant le coup d'envoi (heure vérifiable) ; null si l'heure de publication manque. */
export function publieAvant(publie: string | null, kickoff: string): boolean | null {
  return publie ? Date.parse(publie) < Date.parse(kickoff) : null;
}
