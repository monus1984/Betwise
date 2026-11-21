/**
 * Écussons d'équipe : images des fournisseurs de données déjà utilisés (API-Football, football-data.org), chargées par
 * le téléphone depuis leur CDN. Aucun écusson n'est stocké ni redessiné ; sans image, l'initiale de l'équipe reste.
 */
export function logoEquipe(e: { af?: number | null; code?: string | null }): string | null {
  if (e.af) return `https://media.api-sports.io/football/teams/${e.af}.png`;
  if (e.code?.startsWith("af:")) return `https://media.api-sports.io/football/teams/${e.code.slice(3)}.png`;
  if (e.code?.startsWith("fd:")) return `https://crests.football-data.org/${e.code.slice(3)}.png`;
  return null;
}
