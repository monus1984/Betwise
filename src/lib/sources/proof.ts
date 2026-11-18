/**
 * Note d'une source. Tous ses pronos non annulés comptent, qu'ils aient été saisis avant ou après le match : c'est
 * l'abonné qui charge ce que publient ses sources, l'appli ne fait pas la police à sa place. Le nombre de pronos saisis
 * avant le coup d'envoi reste affiché comme une information, jamais comme une condition.
 * (Les champs gardent leur nom d'origine, « prouves… », et couvrent désormais tous les pronos.)
 */
export const SEUIL = { classement: 3, tendance: 10, provisoire: 30, etabli: 100 };

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
export const NIVEAU: Record<Niveau, string> = { non_etabli: "À suivre", debut: "Premiers pronos", tendance: "Tendance", provisoire: "Confirmé", etabli: "Établi" };
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

/** Classement : les sources qui ont au moins 3 pronos réglés, par rendement puis par réussite. Les autres sont « à suivre ». */
export function classer<T extends { proof: Proof }>(sources: T[]): { classees: T[]; nonEtablies: T[] } {
  const ok = (s: T) => s.proof.prouvesRegles >= SEUIL.classement;
  const classees = sources.filter(ok).sort((a, b) => {
    const ra = rendement(a.proof), rb = rendement(b.proof);
    if (ra !== null && rb !== null && ra !== rb) return rb - ra;
    if ((ra === null) !== (rb === null)) return ra === null ? 1 : -1;
    return (reussite(b.proof) ?? 0) - (reussite(a.proof) ?? 0) || b.proof.prouvesRegles - a.proof.prouvesRegles;
  });
  const nonEtablies = sources.filter((s) => !ok(s)).sort((a, b) => b.proof.prouves - a.proof.prouves);
  return { classees, nonEtablies };
}

/** Second indicateur, à part : les seuls pronos chargés avant le coup d'envoi. Une information en plus, pas une condition. */
export function preMatch(p: Proof): { charges: number; regles: number; gagnes: number } {
  return { charges: p.prouves - p.apresCoup, regles: p.prouvesRegles - p.apresCoupRegles, gagnes: p.prouvesGagnes - p.apresCoupGagnes };
}
