/** Briques visuelles des matchs : écusson à initiales, cases 1/N/2, drapeaux de compétition. */

const PALETTE = ["#1e3a8a", "#7c2d12", "#14532d", "#581c87", "#7f1d1d", "#134e4a", "#713f12", "#312e81", "#831843", "#0c4a6e"];
const STOP = new Set(["fc", "afc", "cf", "ac", "as", "ss", "ssc", "sc", "sv", "rc", "rcd", "cd", "ud", "club", "de", "real", "calcio", "1.", "of"]);

export function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()) && !/^\d{4}$/.test(w));
  if (!words.length) return name.slice(0, 2).toUpperCase();
  return (words.length === 1 ? words[0].slice(0, 3) : words[0][0] + words[1][0]).toUpperCase();
}
export function shortName(name: string) {
  return name.replace(/\b(FC|AFC|CF|SC|AC|SSC|SV|RCD|RC|CA|UD|Calcio|de Fútbol|Balompié|de Barcelona)\b\.?/g, "").replace(/\b(19|20)\d{2}\b/g, "").replace(/\s{2,}/g, " ").trim();
}
function hash(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

export function TeamBadge({ name, size = 22 }: { name: string; size?: number }) {
  const bg = PALETTE[hash(name) % PALETTE.length];
  const txt = initials(name);
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * (txt.length > 2 ? 0.34 : 0.4) }}>{txt}</span>
  );
}

export const COMP_FLAG: Record<string, string> = { PL: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", PD: "🇪🇸", SA: "🇮🇹", BL1: "🇩🇪", FL1: "🇫🇷", CL: "⭐", UNL: "🇪🇺" };
export const COMP_SHORT: Record<string, string> = { PL: "Premier League", PD: "Liga", SA: "Serie A", BL1: "Bundesliga", FL1: "Ligue 1", CL: "Ligue des champions", UNL: "Ligue des nations" };
export const COMP_ORDER = ["UNL", "CL", "PL", "PD", "SA", "BL1", "FL1"];

export type Probs = { p1: number; pN: number; p2: number; source: "modele" | "marche" };

/** Trois cases 1 / N / 2 ; la plus probable est mise en avant. */
export function ProbCells({ probs, compact = true }: { probs: Probs | null; compact?: boolean }) {
  if (!probs) return <span className="w-[118px] text-right text-[11px] text-ink-muted">pas encore de cote</span>;
  const vals = [probs.p1, probs.pN, probs.p2];
  const max = Math.max(...vals);
  return (
    <span className="flex shrink-0 gap-1" title={probs.source === "modele" ? "Probabilités du modèle BETWISE" : "Probabilités tirées des cotes de référence"}>
      {(["1", "N", "2"] as const).map((k, i) => {
        const top = vals[i] === max;
        return (
          <span key={k} className={`flex ${compact ? "h-9 w-[38px]" : "h-12 w-16"} flex-col items-center justify-center rounded-md border text-center leading-none ${top ? (probs.source === "modele" ? "border-brand bg-brand text-white" : "border-ink bg-ink text-white") : "border-line bg-white text-ink-soft"}`}>
            <span className={`text-[9px] ${top ? "text-white/75" : "text-ink-muted"}`}>{k}</span>
            <span className={`${compact ? "text-[12px]" : "text-sm"} mt-0.5 font-semibold tabular-nums`}>{Math.round(vals[i] * 100)}</span>
          </span>
        );
      })}
    </span>
  );
}

export function confidenceLabel(p: number) {
  return p >= 0.65 ? { t: "très probable", c: "text-gain" } : p >= 0.5 ? { t: "probable", c: "text-gain" } : p >= 0.4 ? { t: "incertain", c: "text-draw" } : { t: "très ouvert", c: "text-loss" };
}

/** Probabilités du marché sans la marge du bookmaker. */
export function marketProbs(c1?: number | null, cN?: number | null, c2?: number | null): Probs | null {
  if (!c1 || !cN || !c2) return null;
  const a = 1 / c1, b = 1 / cN, c = 1 / c2, s = a + b + c;
  return { p1: a / s, pN: b / s, p2: c / s, source: "marche" };
}
