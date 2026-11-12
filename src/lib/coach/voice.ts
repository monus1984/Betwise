/** Voix du Coach : préparation du texte à lire et choix de la voix du téléphone. */
/** Texte prêt à être lu : sans mise en forme, chiffres et unités dits naturellement. */
export function spoken(text: string) {
  return text.replace(/\*\*/g, "").replace(/^\s*[-•*]\s+/gm, "").replace(/^#+\s*/gm, "")
    .replace(/(\d)[\u202f\u00a0 ](\d{3})\b/g, "$1$2").replace(/\bF CFA\b|\bFCFA\b/g, "francs").replace(/(\d)\s?F\b/g, "$1 francs")
    .replace(/(\d),(\d)/g, "$1 virgule $2").replace(/\s?%/g, " pour cent").replace(/–|—/g, ", ").replace(/\n+/g, ". ").replace(/\s+/g, " ").trim();
}
/**
 * Meilleure voix française du téléphone : féminine de préférence, et de qualité « améliorée » quand elle est installée.
 * Les voix disponibles dépendent de l'appareil ; on ne peut qu'en choisir une, pas en changer le timbre.
 */
const FEMMES = /am[ée]lie|audrey|marie|aur[ée]lie|virginie|c[ée]line|l[ée]a|julie|hortense|denise|[ée]lo[ïi]se|vivienne|brigitte|sylvie|charlotte|chantal|google fran[çc]ais|female|femme/i;
const HOMMES = /thomas|daniel|nicolas|paul|henri|claude|jacques|r[ée]my|antoine|mathieu|male\b|homme/i;
export function pickVoice(voices: { name: string; lang: string; localService?: boolean }[]) {
  let best: { v: (typeof voices)[number]; sc: number } | null = null;
  for (const v of voices) {
    const lang = (v.lang || "").toLowerCase().replace("_", "-");
    if (!lang.startsWith("fr")) continue;
    let sc = lang === "fr-fr" ? 3 : 1;
    if (FEMMES.test(v.name)) sc += 6;
    if (HOMMES.test(v.name)) sc -= 6;
    if (/enhanced|premium|natural|neural|am[ée]lior|siri/i.test(v.name)) sc += 4;
    if (/compact|espeak/i.test(v.name)) sc -= 3;
    if (!best || sc > best.sc) best = { v, sc };
  }
  return best?.v ?? null;
}
