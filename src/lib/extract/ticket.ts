/**
 * Extraction d'un ticket de pari (capture ou texte) → structure validée + rapprochement avec le référentiel.
 * Le LLM lit ; le code vérifie (schéma, produit des cotes, rapprochement des matchs, déduction 1/N/2).
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { getLlm, type LlmImage } from "../llm/provider";
import { teamSimilarity } from "../odds-api/client";

type Db = SupabaseClient<Database, "betwise">;

// ---------- Ce que le modèle doit renvoyer ----------
const rawSelection = z.object({
  home_team: z.string().nullable(),
  away_team: z.string().nullable(),
  competition: z.string().nullable(),
  kickoff: z.string().nullable(),              // "08/11 14:00" tel qu'affiché
  market_text: z.string(),                     // libellé brut du marché, ex. "Double chance & nombre de buts"
  pick_text: z.string(),                       // libellé brut de la sélection, ex. "Liverpool / Nul & + de 1,5"
  odds: z.number().nullable(),
  score: z.string().nullable(),                // "1 - 3" si affiché
  outcome: z.enum(["won", "lost", "void", "pending", "unknown"]),
  confidence: z.number().min(0).max(1),
});
const rawTicket = z.object({
  bookmaker: z.string().nullable(),
  ticket_type: z.enum(["single", "combo", "unknown"]),
  nb_selections_declared: z.number().int().nullable(),
  selections: z.array(rawSelection),
  total_odds: z.number().nullable(),
  stake: z.number().nullable(),
  currency: z.string().nullable(),
  payout: z.number().nullable(),
  status: z.enum(["won", "lost", "void", "pending", "unknown"]),
  placed_at: z.string().nullable(),            // "08/11/2026 13:38" tel qu'affiché
  coupon_code: z.string().nullable(),
  is_collapsed: z.boolean(),                   // ticket replié : résumé sans le détail des lignes
  notes: z.string().nullable(),
});
export type RawTicket = z.infer<typeof rawTicket>;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["bookmaker", "ticket_type", "nb_selections_declared", "selections", "total_odds", "stake", "currency", "payout", "status", "placed_at", "coupon_code", "is_collapsed", "notes"],
  properties: {
    bookmaker: { type: ["string", "null"], description: "Nom du bookmaker (Betclic, 1xBet, Premier Bet…) ou null" },
    ticket_type: { type: "string", enum: ["single", "combo", "unknown"] },
    nb_selections_declared: { type: ["integer", "null"], description: "Nombre de sélections annoncé par le ticket, ex. 'Combiné (3)' → 3" },
    selections: {
      type: "array",
      description: "Une entrée par sélection visible en détail. Vide si le ticket est replié.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["home_team", "away_team", "competition", "kickoff", "market_text", "pick_text", "odds", "score", "outcome", "confidence"],
        properties: {
          home_team: { type: ["string", "null"], description: "Équipe à domicile telle qu'affichée (à gauche du score)" },
          away_team: { type: ["string", "null"], description: "Équipe à l'extérieur telle qu'affichée (à droite du score)" },
          competition: { type: ["string", "null"] },
          kickoff: { type: ["string", "null"], description: "Date/heure du match telle qu'affichée" },
          market_text: { type: "string", description: "Libellé brut du marché, copié tel quel" },
          pick_text: { type: "string", description: "Libellé brut de la sélection, copié tel quel (ex. 'Liverpool / Nul & + de 1,5')" },
          odds: { type: ["number", "null"], description: "Cote de cette sélection, nombre décimal" },
          score: { type: ["string", "null"], description: "Score final affiché, ex. '1 - 3', sinon null" },
          outcome: { type: "string", enum: ["won", "lost", "void", "pending", "unknown"], description: "won si le nom de la sélection est en vert / coche, lost si en rouge / croix" },
          confidence: { type: "number", description: "Confiance globale sur cette ligne entre 0 et 1" },
        },
      },
    },
    total_odds: { type: ["number", "null"] },
    stake: { type: ["number", "null"], description: "Mise en nombre, sans espace ni devise" },
    currency: { type: ["string", "null"] },
    payout: { type: ["number", "null"], description: "Gains affichés" },
    status: { type: "string", enum: ["won", "lost", "void", "pending", "unknown"] },
    placed_at: { type: ["string", "null"], description: "Horodatage du ticket tel qu'affiché, souvent en bas" },
    coupon_code: { type: ["string", "null"], description: "Code du coupon s'il est visible" },
    is_collapsed: { type: "boolean", description: "true si le ticket ne montre pas le détail des sélections" },
    notes: { type: ["string", "null"], description: "Toute ambiguïté rencontrée, en une phrase" },
  },
} as const;

/** Plusieurs tickets possibles dans un même envoi (vidéo d'écran, liste « Mes paris », captures mélangées). */
const SCHEMA_MULTI = {
  type: "object",
  additionalProperties: false,
  required: ["tickets"],
  properties: { tickets: { type: "array", description: "Un élément par ticket distinct, dans l'ordre d'apparition", items: SCHEMA } },
} as const;
const rawMulti = z.object({ tickets: z.array(rawTicket).min(1) });

const SYSTEM = `Tu lis des tickets de paris sportifs (captures d'écran ou texte) d'applications de bookmakers utilisées en Côte d'Ivoire : Betclic, 1xBet, Premier Bet, Betway, etc.
Tu copies ce qui est affiché, tu n'inventes rien et tu ne calcules rien. Si une information n'est pas visible, renvoie null.
Conventions : l'équipe à gauche du score est à domicile, celle à droite à l'extérieur. Un nom de sélection en vert avec une coche signifie gagnée, en rouge avec une croix perdue. Les cotes utilisent la virgule décimale en français : "1,47" vaut 1.47. Les montants "5 000 F" valent 5000.
Pour un combiné, une ligne par sélection, dans l'ordre affiché. Si le ticket est replié (pas de détail des lignes), selections est vide et is_collapsed vaut true.
Plusieurs tickets peuvent apparaître : chacun a son en-tête (type, nombre de sélections) et son pied (mise, cote totale, gains, horodatage). Ne fusionne jamais deux tickets : un élément de tickets par ticket distinct. Une sélection n'appartient qu'à un ticket.`;

// ---------- Normalisation marché / sélection ----------
export type NormalizedSelection = {
  market_code: string;
  market_param: number | null;
  selection: string;
  label_pick: string;
  ok: boolean;          // false = non reconnu, à corriger à la main
};

/** Déduit code marché + sélection normalisée à partir des libellés bruts et des noms d'équipes. */
export function normalizePick(marketText: string, pickText: string, home: string | null, away: string | null): NormalizedSelection {
  const m = marketText.toLowerCase();
  const p = pickText.toLowerCase().replace(/\s+/g, " ").trim();
  const side = (name: string): "1" | "2" | null => {
    if (!name) return null;
    const sh = home ? teamSimilarity(name, home) : 0;
    const sa = away ? teamSimilarity(name, away) : 0;
    if (sh === 0 && sa === 0) return null;
    return sh >= sa ? "1" : "2";
  };
  const isDraw = (s: string) => /^(nul|draw|x|match nul)$/.test(s.trim());
  const ouLine = (s: string) => {
    const r = s.match(/([+\-]|plus|moins|over|under)\s*(?:de\s*)?(\d+[.,]?\d*)/i);
    if (!r) return null;
    const dir = /^(\+|plus|over)$/i.test(r[1]) ? "Plus" : "Moins";
    return { dir, line: Number(r[2].replace(",", ".")) };
  };

  // Marchés combinés : "Double chance & nombre de buts", "Résultat & nombre de buts"
  if (m.includes("&") || m.includes(" et ")) {
    const [left, right] = p.split(/\s*&\s*/);
    const ou = ouLine(right ?? "");
    if (m.includes("double chance") && ou) {
      const dc = parseDoubleChance(left, side, isDraw);
      if (dc) return { market_code: "DC_OU", market_param: ou.line, selection: `${dc}|${ou.dir}`, label_pick: pickText, ok: true };
    }
    if ((m.includes("résultat") || m.includes("resultat")) && ou) {
      const r = isDraw(left) ? "N" : side(left);
      if (r) return { market_code: "1X2_OU", market_param: ou.line, selection: `${r}|${ou.dir}`, label_pick: pickText, ok: true };
    }
    return { market_code: "1X2", market_param: null, selection: pickText, label_pick: pickText, ok: false };
  }

  if (m.includes("double chance")) {
    const dc = parseDoubleChance(p, side, isDraw);
    return dc ? { market_code: "DC", market_param: null, selection: dc, label_pick: pickText, ok: true } : { market_code: "DC", market_param: null, selection: pickText, label_pick: pickText, ok: false };
  }
  if (m.includes("nombre total de buts") || m.includes("plus/moins") || m.includes("total") || m.includes("buts")) {
    const ou = ouLine(p);
    if (ou) return { market_code: "OU", market_param: ou.line, selection: ou.dir, label_pick: pickText, ok: true };
  }
  if (m.includes("les deux équipes marquent") || m.includes("btts")) {
    return { market_code: "BTTS", market_param: null, selection: /^(oui|yes)$/.test(p) ? "Oui" : /^(non|no)$/.test(p) ? "Non" : pickText, label_pick: pickText, ok: /^(oui|yes|non|no)$/.test(p) };
  }
  if (m.includes("score exact")) {
    return { market_code: "CS", market_param: null, selection: p.replace(/\s/g, ""), label_pick: pickText, ok: /^\d+-\d+$/.test(p.replace(/\s/g, "")) };
  }
  if (m.includes("remboursé si nul") || m.includes("draw no bet")) {
    const r = side(p);
    return { market_code: "DNB", market_param: null, selection: r ?? pickText, label_pick: pickText, ok: !!r };
  }
  if (m.includes("handicap")) {
    const r = p.match(/^(.*?)\s*\(?([+\-]\d+[.,]?\d*)\)?$/);
    const s = r ? side(r[1]) : null;
    if (r && s) return { market_code: "AH", market_param: Number(r[2].replace(",", ".")), selection: s, label_pick: pickText, ok: true };
    return { market_code: "AH", market_param: null, selection: pickText, label_pick: pickText, ok: false };
  }
  // Par défaut : résultat du match
  const r = isDraw(p) ? "N" : side(p);
  return { market_code: "1X2", market_param: null, selection: r ?? pickText, label_pick: pickText, ok: !!r };
}

function parseDoubleChance(text: string, side: (n: string) => "1" | "2" | null, isDraw: (s: string) => boolean): string | null {
  const parts = text.split(/\s*(?:\/|ou)\s*/).map((x) => x.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  const codes = parts.map((x) => (isDraw(x) ? "N" : side(x)));
  if (codes.includes(null)) return null;
  const set = new Set(codes as string[]);
  if (set.has("1") && set.has("N")) return "1N";
  if (set.has("1") && set.has("2")) return "12";
  if (set.has("N") && set.has("2")) return "N2";
  return null;
}

// ---------- Rapprochement avec le référentiel ----------
export type MatchedSelection = NormalizedSelection & {
  home_team: string | null;
  away_team: string | null;
  odds: number | null;
  outcome: "won" | "lost" | "void" | "pending" | "unknown";
  score: string | null;
  confidence: number;
  match: { id: string; home: string; away: string; kickoff_at: string; competition: string; score: string | null } | null;
  score_consistent: boolean | null;   // null si pas de score en base
};

export type ExtractedTicket = {
  raw: RawTicket;
  selections: MatchedSelection[];
  checks: { odds_product_ok: boolean | null; count_ok: boolean | null };
  placed_at_iso: string | null;
  usage: { tokensIn: number; tokensOut: number; model: string };
};

export async function extractTickets(db: Db, input: { images?: LlmImage[]; text?: string }): Promise<ExtractedTicket[]> {
  const llm = getLlm();
  const n = input.images?.length ?? 0;
  const user = n
    ? (n > 1
        ? `Ces ${n} images se suivent dans l'ordre (captures successives, morceaux d'une capture longue ou images d'une vidéo d'écran qui défile), avec des chevauchements : une sélection visible deux fois à une jonction ne compte qu'une fois. Elles peuvent contenir un ou plusieurs tickets. Remplis un élément de tickets par ticket distinct, en copiant les libellés tels quels.`
        : "Lis le ou les tickets de pari de cette image et remplis un élément de tickets par ticket. Copie les libellés tels quels.")
    : `Lis le ou les tickets de pari partagés en texte et remplis un élément de tickets par ticket. Copie les libellés tels quels.\n\n${input.text ?? ""}`;
  const res = await llm.extract({ system: SYSTEM, user, images: input.images, schema: SCHEMA_MULTI as unknown as Record<string, unknown>, maxTokens: 8192 });
  const raws = rawMulti.parse(res.json).tickets.slice(0, 6);

  // Fenêtre de recherche des matchs : ±10 jours autour d'aujourd'hui (les tickets importés sont récents)
  const from = new Date(Date.now() - 10 * 86400000).toISOString();
  const to = new Date(Date.now() + 10 * 86400000).toISOString();
  const { data: pool } = await db
    .from("matches")
    .select("id, kickoff_at, score_home, score_away, home:teams!matches_home_team_id_fkey(nom, alias), away:teams!matches_away_team_id_fkey(nom, alias), competition:competitions(code_externe)")
    .gte("kickoff_at", from).lte("kickoff_at", to).limit(600);
  type M = { id: string; kickoff_at: string; score_home: number | null; score_away: number | null; home: { nom: string; alias: string[] } | null; away: { nom: string; alias: string[] } | null; competition: { code_externe: string | null } | null };
  const matches = ((pool ?? []) as unknown as M[]).filter((x) => x.home && x.away);

  return raws.map((raw, k) => {
    const selections: MatchedSelection[] = raw.selections.map((s) => {
      const norm = normalizePick(s.market_text, s.pick_text, s.home_team, s.away_team);
      const best = bestMatch(s.home_team, s.away_team, matches);
      const scoreDb = best && best.score_home !== null ? `${best.score_home}-${best.score_away}` : null;
      const scoreTicket = s.score ? s.score.replace(/\s/g, "") : null;
      return {
        ...norm,
        home_team: s.home_team, away_team: s.away_team, odds: s.odds, outcome: s.outcome, score: s.score, confidence: s.confidence,
        match: best ? { id: best.id, home: best.home!.nom, away: best.away!.nom, kickoff_at: best.kickoff_at, competition: best.competition?.code_externe ?? "", score: scoreDb } : null,
        score_consistent: scoreDb && scoreTicket ? scoreDb === scoreTicket : null,
      };
    });
    const odds = selections.map((s) => s.odds).filter((o): o is number => !!o && o > 1);
    const product = odds.length ? odds.reduce((a, b) => a * b, 1) : null;
    const checks = {
      odds_product_ok: product && raw.total_odds ? Math.abs(product - raw.total_odds) <= 0.02 * Math.max(1, raw.total_odds / 10) : null,
      count_ok: raw.nb_selections_declared !== null && !raw.is_collapsed ? raw.selections.length === raw.nb_selections_declared : null,
    };
    // Coût de l'appel compté une fois, sur le premier ticket
    return { raw, selections, checks, placed_at_iso: parseFrDate(raw.placed_at), usage: { tokensIn: k ? 0 : res.tokensIn, tokensOut: k ? 0 : res.tokensOut, model: res.model } };
  });
}

function bestMatch(home: string | null, away: string | null, pool: { id: string; kickoff_at: string; score_home: number | null; score_away: number | null; home: { nom: string; alias: string[] } | null; away: { nom: string; alias: string[] } | null; competition: { code_externe: string | null } | null }[]) {
  if (!home || !away) return null;
  let best: { m: (typeof pool)[number]; score: number } | null = null;
  for (const m of pool) {
    const sh = Math.max(teamSimilarity(home, m.home!.nom), ...m.home!.alias.map((a) => teamSimilarity(home, a)));
    const sa = Math.max(teamSimilarity(away, m.away!.nom), ...m.away!.alias.map((a) => teamSimilarity(away, a)));
    const score = (sh + sa) / 2;
    if (score >= 0.5 && (!best || score > best.score)) best = { m, score };
  }
  return best?.m ?? null;
}

/** "08/11/2026 13:38" → ISO (heure d'Abidjan = UTC). */
export function parseFrDate(s: string | null): string | null {
  if (!s) return null;
  const r = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!r) return null;
  const d = new Date(Date.UTC(Number(r[3]), Number(r[2]) - 1, Number(r[1]), Number(r[4]), Number(r[5])));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Lien de partage 1xBet : xbet://open/coupon?id=H9KSJ → référence du coupon, sans contenu. */
export function parseCouponLink(s: string): { bookmaker: string; code: string; url: string } | null {
  const m = s.match(/xbet:\/\/open\/coupon\?id=([A-Za-z0-9]+)/i);
  if (m) return { bookmaker: "1xBet", code: m[1].toUpperCase(), url: m[0] };
  return null;
}
