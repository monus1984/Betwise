/**
 * Ce que le Coach doit signaler avant de proposer. Il ne refuse jamais et ne retire rien : il avertit en une ligne,
 * chiffres à l'appui, puis il propose. La décision et le risque appartiennent à l'abonné.
 */
import type { EtatBudget } from "./budget";

export const SERIE_A_SIGNALER = 3;

// « Me refaire », « rattraper mes pertes », « tout miser »… : on répond par la chance réelle de passer, pas par un refus.
const SE_REFAIRE = /\b(?:me|se|te)\s+refaire\b|\bme\s+refais\b|rattrap|r[ée]cup[ée]r(?:er|e)?\s+(?:ma|mes|la|les|ce que)|regagner|remonter\s+(?:la pente|mes pertes)|effacer\s+(?:ma|mes)\s+pertes?|tout\s+(?:miser|mettre|jouer)|all[\s-]?in|doubler\s+(?:ma|la)\s+mise|martingale|quitte\s+ou\s+double/i;

export type Alerte = { active: boolean; raisons: string[]; consigne: string | null };

export function alerteCoach(message: string, etat: { serie: number; budget: EtatBudget | null }): Alerte {
  const raisons: string[] = [];
  if (SE_REFAIRE.test(message)) raisons.push("Pour rattraper une perte d’un coup il faut une cote haute, donc moins de chances de passer.");
  if (etat.serie >= SERIE_A_SIGNALER) raisons.push(`Tu sors de ${etat.serie} paris perdus de suite.`);
  if (etat.budget?.motif) raisons.push(etat.budget.motif);
  if (!raisons.length) return { active: false, raisons, consigne: null };
  return {
    active: true, raisons,
    consigne: `À SIGNALER dans cette réponse, en UNE ligne au début, sans morale et sans dire « ne parie pas » : ${raisons.join(" ")}
Ensuite tu proposes quand même, comme d'habitude : les sélections demandées avec, pour chacune, sa chance de passer ET son risque de perte en pourcentage ; pour un combiné, la chance réelle de passer du combiné. Termine par une alternative moins risquée (un point fort de l'utilisateur ou d'une de ses sources). Le risque lui appartient : tu informes, il décide.`,
  };
}
