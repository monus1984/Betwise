/**
 * Budget de la semaine : ce que l'utilisateur s'autorise à miser et à perdre du lundi au dimanche.
 * Il remplace l'objectif de gain : on ne vise plus une somme à atteindre, on borne ce qu'on engage.
 */
export type Budget = { miseSemaine: number; perteMaxSemaine: number };
export type PariB = { mise: number; statut: string; gain_net: number | null; placed_at: string; settled_at: string | null };
export type EtatBudget = {
  debut: string; mises: number; perte: number; partMises: number; partPerte: number;
  resteMises: number; restePerte: number; statut: "libre" | "proche" | "atteint"; motif: string | null;
};
export const PROCHE = 0.8;

/** Lundi 00:00 UTC (Abidjan est à l'heure UTC toute l'année). */
export function debutSemaine(now: Date = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

export function etatBudget(b: Budget, paris: PariB[], now: Date = new Date()): EtatBudget {
  const t0 = debutSemaine(now).getTime();
  const mises = paris.filter((p) => p.statut !== "annule" && Date.parse(p.placed_at) >= t0).reduce((s, p) => s + Number(p.mise), 0);
  // Perte de la semaine : résultat net des paris réglés depuis lundi, s'il est négatif. Un gain ne « rouvre » pas de budget de mise.
  const net = paris.filter((p) => p.settled_at && Date.parse(p.settled_at) >= t0 && ["gagne", "perdu", "rembourse"].includes(p.statut)).reduce((s, p) => s + Number(p.gain_net ?? 0), 0);
  const perte = Math.max(0, -net);
  const partMises = mises / b.miseSemaine, partPerte = perte / b.perteMaxSemaine;
  const f = (x: number) => `${Math.round(x).toLocaleString("fr-FR")} F`;
  const statut = partMises >= 1 || partPerte >= 1 ? "atteint" : partMises >= PROCHE || partPerte >= PROCHE ? "proche" : "libre";
  const motif = partPerte >= 1 ? `Perte de la semaine : ${f(perte)}, pour une limite de ${f(b.perteMaxSemaine)}.`
    : partMises >= 1 ? `Mises de la semaine : ${f(mises)}, pour un budget de ${f(b.miseSemaine)}.`
    : partPerte >= PROCHE ? `Tu as perdu ${f(perte)} cette semaine : il reste ${f(b.perteMaxSemaine - perte)} avant ta limite.`
    : partMises >= PROCHE ? `Tu as misé ${f(mises)} cette semaine : il reste ${f(b.miseSemaine - mises)} de budget.` : null;
  return { debut: new Date(t0).toISOString(), mises, perte, partMises, partPerte, resteMises: Math.max(0, b.miseSemaine - mises), restePerte: Math.max(0, b.perteMaxSemaine - perte), statut, motif };
}
