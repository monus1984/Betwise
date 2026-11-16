import { APP_NAME } from "@/lib/app-name";
/**
 * Contrôle de vraisemblance d'une ligne de ticket : la cote lue et la chance estimée par BETWISE doivent raconter
 * la même histoire. Une cote de 1,03 dit « presque certain » ; si BETWISE estime ce choix à 20 %, le plus probable
 * n'est pas une affaire en or, c'est un marché mal lu (total d'une équipe pris pour le total du match, par exemple).
 * On ne corrige rien : on signale, et la ligne attend que l'utilisateur la vérifie sur son ticket.
 *
 * Seuils volontairement larges, pour ne pas alerter sur un simple désaccord de quelques points :
 * il faut à la fois 20 points d'écart entre les deux probabilités et un rapport hors de [0,70 ; 1,45].
 */
export type Alerte = { sens: "cote_trop_basse" | "cote_trop_haute"; p: number; implicite: number; message: string };

const pc = (x: number) => `${Math.round(x * 100)} %`;
const fr = (x: number) => x.toFixed(2).replace(".", ",");

export function vraisemblance(p: number | null | undefined, cote: number | null | undefined): Alerte | null {
  if (!p || !cote || !(cote > 1) || !(p > 0 && p < 1)) return null;
  const implicite = 1 / cote, ratio = p * cote;
  if (Math.abs(p - implicite) < 0.2) return null;
  if (ratio < 0.7) return { sens: "cote_trop_basse", p, implicite, message: `La cote lue (${fr(cote)}) annonce environ ${pc(implicite)} de chances, alors que ${APP_NAME} estime ce choix à ${pc(p)}. Le marché ou le choix a peut-être été mal lu : vérifie cette ligne sur ton ticket.` };
  if (ratio > 1.45) return { sens: "cote_trop_haute", p, implicite, message: `La cote lue (${fr(cote)}) est très généreuse pour un choix que ${APP_NAME} estime à ${pc(p)}. C’est peut-être un autre marché (un joueur, une mi-temps, une seule équipe) : vérifie cette ligne sur ton ticket.` };
  return null;
}
