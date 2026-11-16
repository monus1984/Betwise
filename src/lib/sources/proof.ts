/**
 * Niveau de preuve d'une source. Seuls les pronos enregistrés avant le coup d'envoi (« prouvés ») entrent dans la note
 * et dans le classement. Un prono saisi après le match reste visible, mais personne ne peut vérifier qu'il n'a pas été
 * choisi parce qu'il était déjà gagné.
 */
export const SEUIL = { classement: 10, provisoire: 30, etabli: 100 };

export type Proof = {
  prouves: number; prouvesRegles: number; prouvesGagnes: number; avecCote: number; unites: number; attendu: number | null;
  apresCoup: number; apresCoupRegles: number; apresCoupGagnes: number;
};
export type Niveau = "non_etabli" | "tendance" | "provisoire" | "etabli";
type Brut = Partial<Record<"prouves" | "prouves_regles" | "prouves_gagnes" | "prouves_avec_cote" | "prouves_unites" | "attendu" | "apres_coup" | "apres_coup_regles" | "apres_coup_gagnes", number | string | null>>;

export const VIDE: Proof = { prouves: 0, prouvesRegles: 0, prouvesGagnes: 0, avecCote: 0, unites: 0, attendu: null, apresCoup: 0, apresCoupRegles: 0, apresCoupGagnes: 0 };
export function lire(r: Brut | null | undefined): Proof {
  if (!r) return VIDE;
  const n = (v: unknown) => Number(v ?? 0);
  return { prouves: n(r.prouves), prouvesRegles: n(r.prouves_regles), prouvesGagnes: n(r.prouves_gagnes), avecCote: n(r.prouves_avec_cote), unites: n(r.prouves_unites),
    attendu: r.attendu === null || r.attendu === undefined ? null : Number(r.attendu), apresCoup: n(r.apres_coup), apresCoupRegles: n(r.apres_coup_regles), apresCoupGagnes: n(r.apres_coup_gagnes) };
}

export const niveau = (p: Proof): Niveau => (p.prouvesRegles >= SEUIL.etabli ? "etabli" : p.prouvesRegles >= SEUIL.provisoire ? "provisoire" : p.prouvesRegles >= SEUIL.classement ? "tendance" : "non_etabli");
export const NIVEAU: Record<Niveau, string> = { non_etabli: "Non établi", tendance: "Tendance", provisoire: "Provisoire", etabli: "Établi" };
export const reussite = (p: Proof) => (p.prouvesRegles ? p.prouvesGagnes / p.prouvesRegles : null);
/** Gain moyen par prono, à mise fixe d'une unité. Calculé sur les seuls pronos prouvés dont la cote est connue. */
export const rendement = (p: Proof) => (p.avecCote ? p.unites / p.avecCote : null);

const pl = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
/** Pourquoi une source n'a pas de note : toujours une raison chiffrée. */
export function raison(p: Proof): string {
  if (p.prouves + p.apresCoup === 0) return "Aucun prono enregistré.";
  if (p.prouves === 0) return p.apresCoup === 1 ? "Son seul prono a été saisi après le coup d’envoi." : `Ses ${p.apresCoup} pronos ont tous été saisis après le coup d’envoi.`;
  if (p.prouvesRegles < SEUIL.classement) { const k = p.prouvesRegles > 1 ? "s" : ""; return `${p.prouvesRegles} prono${k} prouvé${k} réglé${k} sur ${SEUIL.classement} requis.`; }
  return "";
}
/** Une ligne lisible : « 19 justes sur 24 prouvés ». */
export function resume(p: Proof): string {
  if (niveau(p) === "non_etabli") return "Non établi";
  return `${pl(p.prouvesGagnes, "juste")} sur ${p.prouvesRegles} prouvés`;
}

/** Classement : seules les sources notées, par rendement puis par réussite. Les autres sont listées à part, avec leur raison. */
export function classer<T extends { proof: Proof }>(sources: T[]): { classees: T[]; nonEtablies: T[] } {
  const classees = sources.filter((s) => niveau(s.proof) !== "non_etabli").sort((a, b) => {
    const ra = rendement(a.proof), rb = rendement(b.proof);
    if (ra !== null && rb !== null && ra !== rb) return rb - ra;
    if ((ra === null) !== (rb === null)) return ra === null ? 1 : -1;
    return (reussite(b.proof) ?? 0) - (reussite(a.proof) ?? 0) || b.proof.prouvesRegles - a.proof.prouvesRegles;
  });
  const nonEtablies = sources.filter((s) => niveau(s.proof) === "non_etabli").sort((a, b) => b.proof.prouvesRegles - a.proof.prouvesRegles || b.proof.apresCoup - a.proof.apresCoup);
  return { classees, nonEtablies };
}
