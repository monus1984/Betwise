/**
 * Ce que le Coach doit signaler avant de proposer : il avertit en une ligne, chiffres à l'appui, puis il propose.
 * Exception (23/11, revue ChatGPT, Grok et Claude, validée par Mounir) : budget de la semaine atteint. Le Coach ne
 * propose plus de pari de lui-même, et le serveur bloque ses outils de propositions, sauf si l'abonné lui demande
 * explicitement un pari. La décision reste à l'abonné ; le Coach ne la prend plus à sa place.
 */
import type { EtatBudget } from "./budget";

export const SERIE_A_SIGNALER = 3;

// « Me refaire », « rattraper mes pertes », « tout miser »… : on répond par la chance réelle de passer, pas par un refus.
const SE_REFAIRE = /\b(?:me|se|te)\s+refaire\b|\bme\s+refais\b|rattrap|r[ée]cup[ée]r(?:er|e)?\s+(?:ma|mes|la|les|ce que)|regagner|remonter\s+(?:la pente|mes pertes)|effacer\s+(?:ma|mes)\s+pertes?|tout\s+(?:miser|mettre|jouer)|all[\s-]?in|doubler\s+(?:ma|la)\s+mise|martingale|quitte\s+ou\s+double/i;

export type Alerte = { active: boolean; raisons: string[]; consigne: string | null; bloquerPropositions: boolean };

/** Demande explicite d'un pari : « propose-moi », « donne un pari », « un combiné », « quoi jouer »… */
const DEMANDE_PARI = /\b(?:propose|proposes|propos[eé]|donne|donnes|conseille|sugg[eè]re|trouve)[- ]?(?:moi|nous)?\b.*\b(?:pari|paris|match|matchs|option|options|combin[eé]|coup|s[eé]lection|cote)s?\b|\b(?:quoi|que|qu'est-ce que je peux|sur quoi)\s+(?:jouer|parier|miser)\b|\b(?:un|des|mon|un autre)\s+(?:pari|combin)|\bcoups? du jour\b|\boptions? du jour\b/i;
export const demandeExplicite = (message: string) => DEMANDE_PARI.test(message);

/** Outils qui proposent des paris : bloqués côté serveur quand le budget est atteint, sauf demande explicite. */
export const OUTILS_PROPOSITION = new Set(["coups_du_jour", "options_du_jour", "combine_cible"]);
export const MESSAGE_BLOQUE = { bloque: true, raison: "Budget de la semaine atteint : aucune proposition de pari tant que l'utilisateur ne le demande pas explicitement. Propose plutôt de faire le point (bilan_paris, mon_budget)." };

export function alerteCoach(message: string, etat: { serie: number; budget: EtatBudget | null }): Alerte {
  const raisons: string[] = [];
  if (SE_REFAIRE.test(message)) raisons.push("Pour rattraper une perte d’un coup il faut une cote haute, donc moins de chances de passer.");
  if (etat.serie >= SERIE_A_SIGNALER) raisons.push(`Tu sors de ${etat.serie} paris perdus de suite.`);
  if (etat.budget?.motif) raisons.push(etat.budget.motif);
  if (!raisons.length) return { active: false, raisons, consigne: null, bloquerPropositions: false };
  if (etat.budget?.statut === "atteint" && !demandeExplicite(message)) return {
    active: true, raisons, bloquerPropositions: true,
    consigne: `BUDGET DE LA SEMAINE ATTEINT. Dans cette réponse, ne propose AUCUN pari, aucune sélection, aucun combiné. Dis-le en une ligne au début, chiffres à l'appui : ${raisons.join(" ")}
Réponds ensuite à sa question sans proposition de pari, ou propose de faire le point sur la semaine. Termine par une phrase simple : s'il veut quand même une proposition, il peut te la demander. Sans morale.`,
  };
  return {
    active: true, raisons, bloquerPropositions: false,
    consigne: `À SIGNALER dans cette réponse, en UNE ligne au début, sans morale et sans dire « ne parie pas » : ${raisons.join(" ")}
Ensuite tu proposes quand même, comme d'habitude : les sélections demandées avec, pour chacune, sa chance de passer ET son risque de perte en pourcentage ; pour un combiné, la chance réelle de passer du combiné. Termine par une alternative moins risquée (un point fort de l'utilisateur ou d'une de ses sources). Le risque lui appartient : tu informes, il décide.`,
  };
}
