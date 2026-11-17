/**
 * Points forts : les types de pari sur lesquels l'abonné, ou une de ses sources, réussit le mieux.
 * Sert à toujours avoir quelque chose à proposer : « tu réussis 9 fois sur 10 sur plus de 1,5 but ».
 */
import { MARCHE_FR } from "../markets-fr";

export type Ligne = { market: string; param: number | null; sel: string; resultat: string };
export type Force = { cle: string; libelle: string; gagnes: number; regles: number; taux: number };
export const MIN_FORCE = 3;

/** Les marchés à ligne (plus/moins, les deux marquent) se distinguent par leur choix ; les autres par le marché seul. */
function famille(l: Ligne): { cle: string; libelle: string } {
  const s = l.sel.trim().toLowerCase(), p = l.param === null ? "" : String(Number(l.param)).replace(".", ",");
  if (l.market === "OU" && l.param !== null) return { cle: `OU|${l.param}|${s}`, libelle: `${s.startsWith("plus") ? "Plus" : "Moins"} de ${p} but${Number(l.param) >= 2 ? "s" : ""}` };
  if (l.market === "BTTS") return { cle: `BTTS|${s}`, libelle: s.startsWith("o") ? "Les deux équipes marquent" : "Une équipe ne marque pas" };
  return { cle: l.market, libelle: MARCHE_FR[l.market] ?? l.market };
}

export function forces(lignes: Ligne[], max = 3): Force[] {
  const m = new Map<string, Force>();
  for (const l of lignes) {
    if (l.resultat !== "gagne" && l.resultat !== "perdu") continue;
    const f = famille(l), x = m.get(f.cle) ?? { cle: f.cle, libelle: f.libelle, gagnes: 0, regles: 0, taux: 0 };
    x.regles++; if (l.resultat === "gagne") x.gagnes++;
    m.set(f.cle, x);
  }
  return [...m.values()].filter((f) => f.regles >= MIN_FORCE).map((f) => ({ ...f, taux: f.gagnes / f.regles }))
    .sort((a, b) => b.taux - a.taux || b.regles - a.regles).slice(0, max);
}
export const direForce = (f: Force) => `${f.libelle} : ${f.gagnes} sur ${f.regles} (${Math.round(f.taux * 100)} %)`;
