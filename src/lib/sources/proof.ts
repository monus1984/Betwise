/**
 * Note d'une source. Tous ses pronos non annulés comptent, qu'ils aient été saisis avant ou après le match : c'est
 * l'abonné qui charge ce que publient ses sources, l'appli ne fait pas la police à sa place. Le nombre de pronos saisis
 * avant le coup d'envoi reste affiché comme une information, jamais comme une condition.
 * (Les champs gardent leur nom d'origine, « prouves… », et couvrent désormais tous les pronos.)
 */
// Seuils relevés le 22/11 (audit P1-8) : à 30 pronos autour de 1,70, la marge d'erreur du rendement est de ± 30 points.
export const SEUIL = { classement: 30, tendance: 10, provisoire: 30, etabli: 100 };

export type Proof = {
  prouves: number; prouvesRegles: number; prouvesGagnes: number; avecCote: number; unites: number; attendu: number | null;
  apresCoup: number; apresCoupRegles: number; apresCoupGagnes: number;
};
export type Niveau = "non_etabli" | "debut" | "tendance" | "provisoire" | "etabli";
type Brut = Partial<Record<"prouves" | "prouves_regles" | "prouves_gagnes" | "prouves_avec_cote" | "prouves_unites" | "attendu" | "apres_coup" | "apres_coup_regles" | "apres_coup_gagnes", number | string | null>>;

export const VIDE: Proof = { prouves: 0, prouvesRegles: 0, prouvesGagnes: 0, avecCote: 0, unites: 0, attendu: null, apresCoup: 0, apresCoupRegles: 0, apresCoupGagnes: 0 };
export function lire(r: Brut | null | undefined): Proof {
  if (!r) return VIDE;
  const n = (v: unknown) => Number(v ?? 0);
  return { prouves: n(r.prouves), prouvesRegles: n(r.prouves_regles), prouvesGagnes: n(r.prouves_gagnes), avecCote: n(r.prouves_avec_cote), unites: n(r.prouves_unites),
    attendu: r.attendu === null || r.attendu === undefined ? null : Number(r.attendu), apresCoup: n(r.apres_coup), apresCoupRegles: n(r.apres_coup_regles), apresCoupGagnes: n(r.apres_coup_gagnes) };
}

// « non_etabli » : aucun prono réglé. Dès le premier, les chiffres s'affichent, avec leur volume.
export const niveau = (p: Proof): Niveau => (p.prouvesRegles >= SEUIL.etabli ? "etabli" : p.prouvesRegles >= SEUIL.provisoire ? "provisoire" : p.prouvesRegles >= SEUIL.tendance ? "tendance" : p.prouvesRegles >= 1 ? "debut" : "non_etabli");
export const NIVEAU: Record<Niveau, string> = { non_etabli: "À suivre", debut: "Premiers pronos", tendance: "Tendance", provisoire: "Provisoire", etabli: "Confirmé" };
export const reussite = (p: Proof) => (p.prouvesRegles ? p.prouvesGagnes / p.prouvesRegles : null);
/** Gain moyen par prono, à mise fixe d'une unité. Calculé sur les seuls pronos prouvés dont la cote est connue. */
export const rendement = (p: Proof) => (p.avecCote ? p.unites / p.avecCote : null);

/** Ce qu'il manque pour avoir des chiffres, dit comme une invitation. */
export function raison(p: Proof): string {
  if (p.prouves === 0) return "Aucun prono chargé pour l’instant : ajoute ceux qu’elle publie pour voir ce qu’elle vaut.";
  if (p.prouvesRegles === 0) return `${p.prouves} prono${p.prouves > 1 ? "s" : ""} en attente de résultat.`;
  return "";
}
/** Une ligne lisible : « 19 justes sur 24 ». */
export function resume(p: Proof): string {
  if (p.prouvesRegles === 0) return p.prouves ? "en attente" : "à suivre";
  return `${p.prouvesGagnes} juste${p.prouvesGagnes > 1 ? "s" : ""} sur ${p.prouvesRegles}`;
}

/**
 * Borne basse du rendement (intervalle à 90 %, approximation normale) : ce qu'on peut dire sans trop parier sur la chance.
 * Écart-type d'un prono à mise fixe ≈ cote moyenne des pronos gagnés × √(p(1−p)).
 */
export function borneBasse(p: Proof): number | null {
  const r = rendement(p);
  if (r === null || p.avecCote < 2) return null;
  const n = p.avecCote, g = Math.min(p.prouvesGagnes, n);
  const taux = g / n;
  const coteMoy = g > 0 ? (p.unites + n) / g : 2;
  return r - 1.645 * coteMoy * Math.sqrt((taux * (1 - taux)) / n);
}

/** Classement : les sources qui ont au moins 30 pronos réglés, par borne basse du rendement (22/11), puis réussite. */
export function classer<T extends { proof: Proof }>(sources: T[]): { classees: T[]; nonEtablies: T[] } {
  const ok = (s: T) => s.proof.prouvesRegles >= SEUIL.classement;
  const classees = sources.filter(ok).sort((a, b) => {
    const ra = borneBasse(a.proof), rb = borneBasse(b.proof);
    if (ra !== null && rb !== null && ra !== rb) return rb - ra;
    if ((ra === null) !== (rb === null)) return ra === null ? 1 : -1;
    return (reussite(b.proof) ?? 0) - (reussite(a.proof) ?? 0) || b.proof.prouvesRegles - a.proof.prouvesRegles;
  });
  const nonEtablies = sources.filter((s) => !ok(s)).sort((a, b) => b.proof.prouves - a.proof.prouves);
  return { classees, nonEtablies };
}
