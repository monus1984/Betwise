/**
 * Points de vigilance de l'Accueil. Des règles fixes, écrites ici, jamais un avis :
 * chaque alerte cite la règle qui l'a déclenchée et les chiffres qui la justifient.
 */
export type PariV = { mise: number; statut: string; placed_at: string; settled_at: string | null; nb_selections: number | null };
export type Alerte = { cle: "mise" | "exposition" | "serie" | "apres_perte" | "combines"; poids: number; titre: string; regle: string };

export const SEUILS = { mise: 0.10, exposition: 0.25, serie: 3, hausse: 1.5, fenetreH: 24, combine: 6, combinesSur10: 5 };
const pc = (x: number) => `${Math.round(x * 100)} %`;
const f = (x: number) => `${Math.round(x).toLocaleString("fr-FR")} F`;

export function vigilance(paris: PariV[], solde: number): Alerte[] {
  const out: Alerte[] = [];
  const enCours = paris.filter((p) => p.statut === "en_cours");
  const enJeu = enCours.reduce((s, p) => s + Number(p.mise), 0);
  const capital = solde + enJeu; // le solde ne contient déjà plus les mises en jeu
  if (capital > 0) {
    const max = enCours.reduce((m, p) => Math.max(m, Number(p.mise)), 0);
    if (max / capital > SEUILS.mise)
      out.push({ cle: "mise", poids: max / capital / SEUILS.mise, titre: `Un pari en cours engage ${pc(max / capital)} de ta bankroll`, regle: `Mise de ${f(max)} pour ${f(capital)} de bankroll. Règle : pas plus de ${pc(SEUILS.mise)} sur un seul pari.` });
    if (enJeu / capital > SEUILS.exposition)
      out.push({ cle: "exposition", poids: enJeu / capital / SEUILS.exposition, titre: `${pc(enJeu / capital)} de ta bankroll est en jeu en même temps`, regle: `${f(enJeu)} engagés sur ${enCours.length} pari${enCours.length > 1 ? "s" : ""}. Règle : pas plus de ${pc(SEUILS.exposition)} en jeu à la fois.` });
  }
  const regles = paris.filter((p) => (p.statut === "gagne" || p.statut === "perdu") && p.settled_at).sort((a, b) => Date.parse(b.settled_at!) - Date.parse(a.settled_at!));
  let serie = 0;
  for (const p of regles) { if (p.statut === "perdu") serie++; else break; }
  if (serie >= SEUILS.serie)
    out.push({ cle: "serie", poids: 1 + serie / 10, titre: `${serie} paris perdus d’affilée`, regle: `Règle : à partir de ${SEUILS.serie} pertes de suite, garde ta mise habituelle ou fais une pause. Une série ne dit rien du pari suivant.` });

  // Mise augmentée juste après une perte : le signe classique de la course après ses pertes.
  const parDate = [...paris].sort((a, b) => Date.parse(b.placed_at) - Date.parse(a.placed_at));
  const dernier = parDate[0];
  if (dernier) {
    const avant = regles.find((p) => p.statut === "perdu" && Date.parse(p.settled_at!) <= Date.parse(dernier.placed_at) && Date.parse(dernier.placed_at) - Date.parse(p.settled_at!) <= SEUILS.fenetreH * 3600000);
    const derniereIssue = regles.find((p) => Date.parse(p.settled_at!) <= Date.parse(dernier.placed_at));
    if (avant && derniereIssue === avant && Number(dernier.mise) >= SEUILS.hausse * Number(avant.mise))
      out.push({ cle: "apres_perte", poids: 1.5, titre: "Ta dernière mise a augmenté juste après une perte", regle: `${f(Number(dernier.mise))} misés après une perte de ${f(Number(avant.mise))}, moins de ${SEUILS.fenetreH} h plus tard. Règle : la mise ne monte pas pour rattraper une perte.` });
  }
  const dix = parDate.slice(0, 10), longs = dix.filter((p) => (p.nb_selections ?? 1) >= SEUILS.combine).length;
  if (dix.length >= 6 && longs >= SEUILS.combinesSur10)
    out.push({ cle: "combines", poids: 0.9, titre: `${longs} de tes ${dix.length} derniers paris sont des combinés de ${SEUILS.combine} sélections ou plus`, regle: "Règle : un combiné long se perd sur une seule ligne. Six lignes à 80 % de chances chacune passent ensemble environ une fois sur quatre." });
  return out.sort((a, b) => b.poids - a.poids);
}
