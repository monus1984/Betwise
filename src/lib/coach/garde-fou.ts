/**
 * Garde-fou du Coach. Dans ces situations, il ne compose ni pari ni combiné : les fonctions qui en proposent lui sont
 * retirées pour la réponse, ce n'est donc pas une simple consigne. Chaque blocage a une raison chiffrée, dite à l'utilisateur.
 */
import type { EtatBudget } from "./budget";

export const SERIE_BLOQUANTE = 3;
export const FONCTIONS_DE_PARI = ["coups_du_jour", "options_du_jour", "combine_cible", "simuler_objectif", "fixer_objectif", "mon_objectif"];

// « Me refaire », « rattraper mes pertes », « tout miser »… : la demande elle-même est le signal.
const SE_REFAIRE = /\b(?:me|se|te)\s+refaire\b|\bme\s+refais\b|rattrap|r[ée]cup[ée]r(?:er|e)?\s+(?:ma|mes|la|les|ce que)|regagner|remonter\s+(?:la pente|mes pertes)|effacer\s+(?:ma|mes)\s+pertes?|tout\s+(?:miser|mettre|jouer)|all[\s-]?in|doubler\s+(?:ma|la)\s+mise|martingale|quitte\s+ou\s+double/i;

export type Garde = { bloque: boolean; raisons: string[]; consigne: string | null };

export function gardeFou(message: string, etat: { serie: number; budget: EtatBudget | null }): Garde {
  const raisons: string[] = [];
  if (SE_REFAIRE.test(message)) raisons.push("Tu demandes un pari pour rattraper une perte : c’est la situation où l’on mise le plus mal.");
  if (etat.serie >= SERIE_BLOQUANTE) raisons.push(`Tu viens de perdre ${etat.serie} paris d’affilée.`);
  if (etat.budget?.statut === "atteint" && etat.budget.motif) raisons.push(etat.budget.motif);
  if (!raisons.length) return { bloque: false, raisons, consigne: null };
  return {
    bloque: true, raisons,
    consigne: `GARDE-FOU ACTIF pour cette réponse. Raisons : ${raisons.join(" ")}
Tu ne proposes aucun pari, aucune sélection, aucun combiné, aucune mise, même si on insiste. Les fonctions qui en composent sont désactivées.
Réponds en 3 lignes au plus, sans morale : 1) dis que tu ne proposes pas de pari maintenant et cite la raison ci-dessus telle quelle ; 2) propose une seule alternative utile : regarder le bilan (bilan_paris), tester un choix sans miser, ou reprendre demain ; 3) rien d'autre.`,
  };
}
