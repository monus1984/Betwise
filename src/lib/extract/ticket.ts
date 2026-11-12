/**
 * Extraction d'un ticket de pari (capture ou texte) → structure validée + rapprochement avec le référentiel.
 * Le LLM lit ; le code vérifie (schéma, produit des cotes, rapprochement des matchs, déduction 1/N/2).
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { getLlm, type LlmImage } from "../llm/provider";
import { teamSimilarity } from "../odds-api/client";
import { loadSignals, probOfSignal } from "../probs/signals";
import { coteEstimee } from "../options/build";

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
  team_only: z.string().nullable().optional(), // prono de tipster qui ne nomme qu'une équipe : « RD Congo – Victoire »
  score: z.string().nullable(),                // "1 - 3" si affiché
  outcome: z.enum(["won", "lost", "void", "pending", "unknown"]),
  confidence: z.number().min(0).max(1),
});
const rawTicket = z.object({
  kind: z.enum(["ticket", "pronos"]).optional(), // ticket de bookmaker, ou pronos publiés par un tipster
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
  source: z.object({                           // qui a publié ou partagé ce ticket, si c'est visible
    name: z.string().nullable(),
    platform: z.enum(["telegram", "whatsapp", "facebook", "instagram", "tiktok", "autre"]).nullable(),
    evidence: z.string().nullable(),
    published_at: z.string().nullable(),
  }).nullable().optional(),
});
export type RawTicket = z.infer<typeof rawTicket>;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "bookmaker", "ticket_type", "nb_selections_declared", "selections", "total_odds", "stake", "currency", "payout", "status", "placed_at", "coupon_code", "is_collapsed", "notes", "source"],
  properties: {
    kind: { type: "string", enum: ["ticket", "pronos"], description: "ticket : ticket ou coupon d'une application de bookmaker. pronos : pronostics publiés par un tipster (message Telegram/WhatsApp, post, vidéo), même présentés en liste ou avec une cote totale." },
    bookmaker: { type: ["string", "null"], description: "Nom du bookmaker (Betclic, 1xBet, Premier Bet…) ou null" },
    ticket_type: { type: "string", enum: ["single", "combo", "unknown"] },
    nb_selections_declared: { type: ["integer", "null"], description: "Nombre de sélections annoncé par le ticket, ex. 'Combiné (3)' → 3" },
    selections: {
      type: "array",
      description: "Une entrée par sélection visible en détail. Vide si le ticket est replié.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["home_team", "away_team", "team_only", "competition", "kickoff", "market_text", "pick_text", "odds", "score", "outcome", "confidence"],
        properties: {
          home_team: { type: ["string", "null"], description: "Équipe à domicile telle qu'affichée (à gauche du score)" },
          team_only: { type: ["string", "null"], description: "Si la ligne ne nomme qu'une seule équipe (ex. « RD Congo – Victoire »), son nom ; home_team et away_team sont alors null" },
          away_team: { type: ["string", "null"], description: "Équipe à l'extérieur telle qu'affichée (à droite du score)" },
          competition: { type: ["string", "null"] },
          kickoff: { type: ["string", "null"], description: "Date/heure du match telle qu'affichée" },
          market_text: { type: "string", description: "Libellé brut du marché, copié tel quel" },
          pick_text: { type: "string", description: "Libellé brut de la sélection, copié tel quel (ex. 'Liverpool / Nul & + de 1,5', 'Victoire', 'Italie ou nul', 'Les 2 marquent'). Chaîne vide si le choix n'est pas écrit à l'image (prono dit à l'oral, par exemple)." },
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
    source: {
      type: ["object", "null"],
      description: "Qui a publié ou partagé ce ticket, si c'est visible. null si l'image montre seulement l'application du bookmaker, sans auteur.",
      additionalProperties: false,
      required: ["name", "platform", "evidence", "published_at"],
      properties: {
        name: { type: ["string", "null"], description: "Nom du canal, de la page, du groupe ou du compte tel qu'affiché : en-tête d'une conversation Telegram ou WhatsApp, nom de page Facebook, pseudo Instagram ou TikTok, filigrane ou signature sur l'image. Jamais le nom du bookmaker ni celui de l'application." },
        platform: { type: ["string", "null"], enum: ["telegram", "whatsapp", "facebook", "instagram", "tiktok", "autre", null] },
        evidence: { type: ["string", "null"], description: "Où le nom apparaît, en quelques mots (ex. « en-tête du canal Telegram », « filigrane en bas du coupon »)" },
        published_at: { type: ["string", "null"], description: "Date et heure de publication du message ou du post, telles qu'affichées" },
      },
    },
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
Pronos de tipsters (kind = pronos) : messages Telegram ou WhatsApp, posts, vidéos TikTok, Instagram ou Facebook.
- Un ✅ après une option veut dire « oui, je joue cette option » : « Espagne ✅ » = victoire de l'Espagne, « BTTS ✅ » = les deux marquent, oui. Un ❌ veut dire « non » (« BTTS ❌ » = non). Recopie ces emojis dans pick_text. Ce ne sont jamais des résultats : outcome vaut unknown, sauf si le message dit explicitement « gagné » ou « perdu » pour la ligne. 🔥 💚 🎯 sont de la décoration.
- Une liste de pronos sans cote totale ni mise est une liste de paris séparés : ticket_type single. S'il y a une cote totale (« CÔTE TOTALE : 10,16 »), c'est un combiné.
- Les drapeaux affichés identifient les pays : utilise-les pour nommer les équipes quand le texte est caché ou coupé.
- Une fiche de match affichée sans choix écrit (le tipster parle) donne une sélection avec home_team, away_team, kickoff et pick_text vide.
Si le ticket est montré dans une conversation ou une publication (Telegram, WhatsApp, Facebook, Instagram, TikTok), relève dans source le nom du canal, de la page ou du groupe, et l'heure de publication ; un filigrane ou une signature sur l'image compte aussi. Ne déduis pas : seulement ce qui est écrit.
Plusieurs tickets peuvent apparaître : chacun a son en-tête (type, nombre de sélections) et son pied (mise, cote totale, gains, horodatage). Ne fusionne jamais deux tickets : un élément de tickets par ticket distinct. Une sélection n'appartient qu'à un ticket.`;

// ---------- Normalisation marché / sélection ----------
export type NormalizedSelection = {
  market_code: string;
  market_param: number | null;
  selection: string;
  label_pick: string;
  ok: boolean;          // false = non reconnu, à corriger à la main
  reason?: string;      // pourquoi ce n'est pas compris, quand on le sait
};

/** Déduit code marché + sélection normalisée à partir des libellés bruts et des noms d'équipes. */
export function normalizePick(marketText: string, pickText: string, home: string | null, away: string | null, team?: string | null): NormalizedSelection {
  const m = marketText.toLowerCase();
  // ✅ = « oui, cette option » ; ❌ = « non ». Les autres emojis sont de la décoration.
  const oui = /[✅✔☑]/u.test(pickText) || /[✅✔☑]/u.test(marketText), non = /[❌✖🚫]/u.test(pickText);
  const p = pickText.toLowerCase().replace(/[\p{Extended_Pictographic}\uFE0F]/gu, " ").replace(/\s+/g, " ").trim().replace(/^[–—-]\s*|\s*[–—-]$/g, "").trim();
  if (!p && oui && team) { const sd = (home && teamSimilarity(team, home) >= (away ? teamSimilarity(team, away) : 0)) ? "1" : "2"; if (home || away) return { market_code: "1X2", market_param: null, selection: sd, label_pick: `${team} gagne`, ok: true }; }
  if (!p) return { market_code: "1X2", market_param: null, selection: "", label_pick: "Choix non visible", ok: false, reason: "Le choix n'est pas écrit (prono dit à l'oral ?) : choisis-le." };
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

  // Pronos de tipsters, libellés courts (avec l'équipe nommée seule ou dans le texte)
  const all = `${m} ${p}`;
  const teamSide = team ? side(team) : null;
  const who = (x: string): "1" | "N" | "2" | null => { const y = x.replace(/\b(victoire|gagne|vainqueur)\b/g, "").trim(); return isDraw(y) ? "N" : y ? side(y) : null; };
  // Mi-temps / fin de match : « Italie / Nul », « 1/2 »
  if (/mi[- ]?temps\s*[\/-]\s*fin|\b(ht|mt)\s*\/\s*ft\b/.test(all)) {
    const parts = p.replace(/.*(fin de match|ft)\s*:?/i, "").split(/\s*\/\s*/).map((x) => x.trim()).filter(Boolean);
    const code = (x: string) => (/^[12]$/.test(x) ? (x as "1" | "2") : /^[xn]$/.test(x) ? "N" : who(x));
    const [x1, x2] = parts.length === 2 ? parts.map(code) : [null, null];
    return x1 && x2 ? { market_code: "HTFT", market_param: null, selection: `${x1}/${x2}`, label_pick: pickText, ok: true } : { market_code: "HTFT", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Mi-temps / fin de match : choisis les deux résultats." };
  }
  // Marchés d'une mi-temps : « Ghana – 1ère mi-temps », « +0,5 but en 1ère mi-temps », « Nul à la mi-temps », « 2e mi-temps : Italie »
  if (/mi[- ]?temps|\b(mt|ht)\b/.test(all)) {
    const h2 = /\b(2e|2ème|2eme|2nde|seconde|deuxième)\b/.test(all);
    const pre = h2 ? "H2_" : "HT_";
    const q = p.replace(/(1(ère|ere|re)|première|premiere|2(e|ème|eme|nde)|seconde|deuxième)?\s*mi[- ]?temps|\b(mt|ht)\b|\b(à la|a la|en|de la|résultat)\b/g, " ").replace(/[:–—-]/g, " ").replace(/\s+/g, " ").trim();
    const o = ouLine(p);
    if (o && (/\b(buts?|over|under)\b/.test(p) || /^(\+|plus|moins)/.test(q))) return { market_code: `${pre}OU`, market_param: o.line, selection: o.dir, label_pick: pickText, ok: true };
    if (!h2 && /(2|deux) (équipes )?marquent|btts/.test(q)) return { market_code: "HT_BTTS", market_param: null, selection: non || /\bnon\b/.test(q) ? "Non" : "Oui", label_pick: pickText, ok: true };
    if (!h2 && /\sou\s|\//.test(q)) { const dc = parseDoubleChance(q, side, isDraw); if (dc) return { market_code: "HT_DC", market_param: null, selection: dc, label_pick: pickText, ok: true }; }
    const r = who(q) ?? (!q.replace(/victoire|gagne|vainqueur/g, "").trim() ? teamSide : null);
    if (r) return { market_code: `${pre}1X2`, market_param: null, selection: r, label_pick: pickText, ok: true };
    return { market_code: `${pre}1X2`, market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Pari de mi-temps : choisis le marché et le choix." };
  }
  if (/\bimpair\b|\bodd\b/.test(all)) return { market_code: "OE", market_param: null, selection: "Impair", label_pick: pickText, ok: true };
  if (/\bpair\b|\beven\b/.test(all)) return { market_code: "OE", market_param: null, selection: "Pair", label_pick: pickText, ok: true };
  if (/sans encaisser|win to nil/.test(all)) { const r = teamSide ?? side(p.replace(/gagne|sans encaisser( de but)?|win to nil/g, "").trim()); return { market_code: "WTN", market_param: null, selection: r ?? pickText, label_pick: pickText, ok: !!r }; }
  { const r = p.match(/^(?:entre\s*)?(\d)\s*(?:-|à|a|et)\s*(\d)\s*buts?$/); if (r && Number(r[1]) <= Number(r[2])) return { market_code: "MG", market_param: null, selection: `${r[1]}-${r[2]}`, label_pick: pickText, ok: true }; }
  if (m.includes("handicap") && /europ|3 issues|1x2|3 way/.test(m)) {
    const r = p.match(/^(.*?)\s*\(?([+\-]\d+)\)?$/); const w = r ? who(r[1]) : null;
    if (r && w) return { market_code: "EH", market_param: w === "2" ? -Number(r[2]) : Number(r[2]), selection: w, label_pick: pickText, ok: true };
  }
  if (/(les )?(2|deux) (équipes )?marquent|btts/.test(all)) return { market_code: "BTTS", market_param: null, selection: non || /(ne )?marquent pas|\bnon\b|\bno\b/.test(p) ? "Non" : "Oui", label_pick: pickText, ok: true };
  if (!m.includes("handicap") && !all.includes("&") && (/\b(buts?|goals?|over|under)\b/.test(p) || /^(\+|-|plus|moins)/.test(p))) { const o = ouLine(p); if (o) return { market_code: "OU", market_param: o.line, selection: o.dir, label_pick: pickText, ok: true }; }
  if (teamSide && /^(victoire|gagne|vainqueur|win|1|2)$/.test(p.replace(/[^a-zà-ü0-9 ]/g, "").trim())) return { market_code: "1X2", market_param: null, selection: teamSide, label_pick: `${team} gagne`, ok: true };
  if (teamSide && /ou nul|ou match nul|double chance/.test(p) && !p.includes("&")) return { market_code: "DC", market_param: null, selection: teamSide === "1" ? "1N" : "N2", label_pick: `${team} ou nul`, ok: true };
  if (/\s(ou|or)\s|\//.test(p) && !p.includes("&") && !m.includes("&")) { const dc = parseDoubleChance(p, side, isDraw); if (dc) return { market_code: "DC", market_param: null, selection: dc, label_pick: pickText, ok: true }; }

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
  const t = text.trim();
  // Codes courts affichés par certaines apps : 1X, X2, 12, 1N, N2
  const code = t.toUpperCase().replace(/\s/g, "");
  if (code === "1X" || code === "1N") return "1N";
  if (code === "X2" || code === "N2") return "N2";
  if (code === "12") return "12";
  // « ou » comme mot entier seulement : « Cameroun ou Namibie », « Toulouse / Nul »
  const parts = t.split(/\s*\/\s*|\s+ou\s+|\s+or\s+/i).map((x) => x.trim()).filter(Boolean);
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
  odds_source: "ticket" | "reference" | "estimee" | null;
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

  const out = raws.map((raw, k) => {
    const pronos = raw.kind === "pronos";
    const ref = parseFrDate(raw.placed_at) ?? parseFrDate(raw.source?.published_at ?? null) ?? new Date().toISOString();
    const selections: MatchedSelection[] = raw.selections.map((s) => {
      const best = s.team_only && !(s.home_team && s.away_team) ? bestMatchOne(s.team_only, matches, ref) : bestMatch(s.home_team, s.away_team, matches);
      const h = best ? best.home!.nom : s.home_team, a = best ? best.away!.nom : s.away_team;
      const norm = normalizePick(s.market_text, s.pick_text, h, a, s.team_only ?? null);
      const scoreDb = best && best.score_home !== null ? `${best.score_home}-${best.score_away}` : null;
      const scoreTicket = s.score ? s.score.replace(/\s/g, "") : null;
      return {
        ...norm,
        home_team: s.home_team ?? (s.team_only && !best ? s.team_only : null), away_team: s.away_team, odds: s.odds, odds_source: s.odds ? "ticket" as const : null,
        outcome: pronos ? "unknown" as const : s.outcome, score: s.score, confidence: s.confidence,
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
    return { raw, selections, checks, placed_at_iso: parseFrDate(raw.placed_at) ?? parseFrDate(raw.source?.published_at ?? null), usage: { tokensIn: k ? 0 : res.tokensIn, tokensOut: k ? 0 : res.tokensOut, model: res.model } };
  });

  // Pronos sans cote : cote de référence quand elle existe, sinon cote estimée à partir des probabilités (marquée comme telle)
  const ids = [...new Set(out.flatMap((t) => t.selections.filter((x) => x.match && !x.odds && x.ok).map((x) => x.match!.id)))];
  if (ids.length) {
    const signals = await loadSignals(db as never, ids);
    for (const t of out) for (const x of t.selections) {
      if (!x.match || x.odds || !x.ok) continue;
      const sg = signals.get(x.match.id); if (!sg) continue;
      const refOdd = sg.refOdd(x.market_code, x.market_param, x.selection);
      const p = probOfSignal(sg, x.market_code, x.market_param, x.selection);
      if (refOdd) { x.odds = refOdd; x.odds_source = "reference"; }
      else if (p) { x.odds = Math.round(coteEstimee({ p, cote: null }) * 100) / 100; x.odds_source = "estimee"; }
    }
  }
  return out;
}

/** Match d'une équipe nommée seule (pronos de tipster) : le plus proche de la date de publication, à venir de préférence. */
function bestMatchOne(team: string, pool: Parameters<typeof bestMatch>[2], refIso: string) {
  const ref = Date.parse(refIso);
  let best: { m: (typeof pool)[number]; score: number } | null = null;
  for (const m of pool) {
    const sh = Math.max(teamSimilarity(team, m.home!.nom), ...m.home!.alias.map((x) => teamSimilarity(team, x)));
    const sa = Math.max(teamSimilarity(team, m.away!.nom), ...m.away!.alias.map((x) => teamSimilarity(team, x)));
    const sim = Math.max(sh, sa);
    if (sim < 0.8) continue;
    const dt = (Date.parse(m.kickoff_at) - ref) / 3600000; // heures après la publication
    if (dt < -3 || dt > 96) continue;
    const score = sim - Math.max(0, dt) / 200;
    if (!best || score > best.score) best = { m, score };
  }
  return best?.m ?? null;
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

