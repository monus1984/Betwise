/** Voix du Coach : préparation du texte à lire et choix de la voix du téléphone. */
/** Texte prêt à être lu : sans mise en forme, chiffres et unités dits naturellement. */
const NOMS: [RegExp, string][] = [
  [/\bM[üu]nchen\b/g, "Munich"], [/\bK[öo]ln\b/g, "Cologne"], [/\bBayer 04 Leverkusen\b/g, "Leverkusen"], [/\bTSG 1899 Hoffenheim\b/g, "Hoffenheim"],
  [/\bInternazionale\b/g, "Inter"], [/\bBologna\b/g, "Bologne"], [/\bNapoli\b/g, "Naples"], [/\bFiorentina\b/g, "Fiorentina"], [/\bSevilla\b/g, "Séville"],
  [/\bEspanyol de Barcelona\b/g, "Espanyol"], [/\bWolverhampton Wanderers\b/g, "Wolverhampton"], [/\bBrighton & Hove Albion\b/g, "Brighton"],
  [/\b1xBet\b/gi, "One X Bet"], [/\b22Bet\b/gi, "22 Bet"],
];
const pl = (n: string, mot: string, motPl = mot + "s") => `${n} ${Number(n) > 1 ? motPl : mot}`;
/**
 * Lecture à voix haute (21/11) : la voix lit mal les noms d'équipe étrangers, les sigles de club, les années dans les noms,
 * « 19 h 30 », « 2e », la forme « 1V 1N 3D » et certains noms de bookmakers. Seule la lecture change, jamais l'affichage.
 */
export function prononcer(text: string) {
  let t = text;
  for (const [re, par] of NOMS) t = t.replace(re, par);
  return t
    .replace(/\b(\d+)V (\d+)N (\d+)D\b/g, (_, v, n, d) => `${pl(v, "victoire")}, ${pl(n, "nul")}, ${pl(d, "défaite")}`)
    .replace(/\b1\.\s?(?=FC\b)/g, "")
    .replace(/\b(FC|AFC|CF|SC|AC|CA|SSC|SV|RCD|RC|UD|CD|VfB|VfL|TSG|SpVgg|OGC|AS|AJ)\b\.?\s?(?=[A-ZÀ-Ý])/g, "")
    .replace(/(?<=[A-Za-zÀ-ÿ])\s(FC|AFC|CF|SC|AC|Calcio|CFC)\b/g, "")
    .replace(/(?<=[A-Za-zÀ-ÿ])\s(18|19|20)\d{2}\b/g, "")
    .replace(/\b1(re|ère)\b/g, "première").replace(/\b1er\b/g, "premier")
    .replace(/\b(\d+)e\b/g, (_, n) => ({ "2": "deuxième", "3": "troisième", "4": "quatrième", "5": "cinquième" } as Record<string, string>)[n] ?? `${n}ième`)
    .replace(/\b(\d{1,2})\s?h\s?(\d{2})\b/g, "$1 heures $2").replace(/\b1\s?h\b/g, "1 heure").replace(/\b(\d{1,2})\s?h\b/g, "$1 heures")
    .replace(/á/g, "a").replace(/[íì]/g, "i").replace(/[óò]/g, "o").replace(/ú/g, "u").replace(/ñ/g, "gn")
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
