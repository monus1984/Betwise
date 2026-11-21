/** Voix du Coach : préparation du texte à lire et choix de la voix du téléphone. */
/** Texte prêt à être lu : sans mise en forme, chiffres et unités dits naturellement. */
/**
 * Prépare un texte pour une voix française (21/11) : la voix lit mal les noms d'équipe étrangers, les sigles de club,
 * « 19 h 30 » et certains noms de bookmakers. On ne change que la lecture, jamais le texte affiché.
 */
const NOMS: [RegExp, string][] = [
  [/\bM[üu]nchen\b/g, "Munich"], [/\bK[öo]ln\b/g, "Cologne"], [/\bM[öo]nchengladbach\b/g, "Mönchengladbach"],
  [/\bBayer 04 Leverkusen\b/g, "Leverkusen"], [/\bTSG 1899 Hoffenheim\b/g, "Hoffenheim"], [/\bInternazionale\b/g, "Inter"],
  [/\bEspanyol de Barcelona\b/g, "Espanyol"], [/\bWolverhampton Wanderers\b/g, "Wolverhampton"], [/\bBrighton & Hove Albion\b/g, "Brighton"],
  [/\bParis Saint-Germain\b/g, "Paris Saint-Germain"], [/\b1xBet\b/gi, "One X Bet"], [/\b22Bet\b/gi, "22 Bet"],
];
export function prononcer(text: string) {
  let t = text;
  for (const [re, par] of NOMS) t = t.replace(re, par);
  return t
    .replace(/\b1\.\s?(?=FC\b)/g, "")                                                     // « 1. FC Köln »
    .replace(/\b(FC|AFC|CF|SC|AC|SSC|SV|RCD|RC|UD|VfB|VfL|TSG|SpVgg)\b\.?\s?(?=[A-ZÀ-Ý])/g, "")  // sigles devant un nom
    .replace(/(?<=[a-zà-ÿ])\s(FC|AFC|CF|SC|AC)\b/g, "")                                   // sigles après un nom
    .replace(/\b(\d{1,2})\s?h\s?(\d{2})\b/g, "$1 heures $2").replace(/\b(\d{1,2})\s?h\b/g, "$1 heures")
    .replace(/ü/g, "u").replace(/ö/g, "eu").replace(/ä/g, "è").replace(/ß/g, "ss")
    .replace(/\s{2,}/g, " ");
}

export function spoken(text: string) {
  return prononcer(text).replace(/\*\*/g, "").replace(/^\s*[-•*]\s+/gm, "").replace(/^#+\s*/gm, "")
    .replace(/(\d)[\u202f\u00a0 ](\d{3})\b/g, "$1$2").replace(/\bF CFA\b|\bFCFA\b/g, "francs").replace(/(\d)\s?F\b/g, "$1 francs")
    .replace(/(\d),(\d)/g, "$1 virgule $2").replace(/\s?%/g, " pour cent").replace(/–|—/g, ", ").replace(/\n+/g, ". ").replace(/\s+/g, " ").trim();
}
/**
 * Meilleure voix française du téléphone : masculine de préférence (Betster est un homme), et de qualité « améliorée » quand elle est installée.
 * Les voix disponibles dépendent de l'appareil ; on ne peut qu'en choisir une, pas en changer le timbre.
 */
const FEMMES = /am[ée]lie|audrey|marie|aur[ée]lie|virginie|c[ée]line|l[ée]a|julie|hortense|denise|[ée]lo[ïi]se|vivienne|brigitte|sylvie|charlotte|chantal|female|femme/i;
const HOMMES = /thomas|daniel|nicolas|paul|henri|claude|jacques|r[ée]my|antoine|mathieu|male\b|homme/i;
export function pickVoice(voices: { name: string; lang: string; localService?: boolean }[]) {
  let best: { v: (typeof voices)[number]; sc: number } | null = null;
  for (const v of voices) {
    const lang = (v.lang || "").toLowerCase().replace("_", "-");
    if (!lang.startsWith("fr")) continue;
    let sc = lang === "fr-fr" ? 3 : 1;
    if (HOMMES.test(v.name)) sc += 6;
    if (FEMMES.test(v.name)) sc -= 6;
    if (/enhanced|premium|natural|neural|am[ée]lior|siri/i.test(v.name)) sc += 4;
    if (/compact|espeak/i.test(v.name)) sc -= 3;
    if (!best || sc > best.sc) best = { v, sc };
  }
  return best?.v ?? null;
}
