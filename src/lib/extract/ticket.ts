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
  insurance: z.boolean().optional(),             // combiné « Assurance » : mise remboursée si une seule sélection perd
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
  required: ["kind", "bookmaker", "ticket_type", "insurance", "nb_selections_declared", "selections", "total_odds", "stake", "currency", "payout", "status", "placed_at", "coupon_code", "is_collapsed", "notes", "source"],
  properties: {
    kind: { type: "string", enum: ["ticket", "pronos"], description: "ticket : ticket ou coupon d'une application de bookmaker. pronos : pronostics publiés par un tipster (message Telegram/WhatsApp, post, vidéo), même présentés en liste ou avec une cote totale." },
    bookmaker: { type: ["string", "null"], description: "Nom du bookmaker (Betclic, 1xBet, Premier Bet…) ou null" },
    ticket_type: { type: "string", enum: ["single", "combo", "unknown"] },
    insurance: { type: "boolean", description: "true si le ticket porte la mention « Assurance » (combiné assuré Betclic) ou le statut « Assuré »" },
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
Combiné « Assurance » (Betclic) : insurance vaut true ; un ticket au statut « Assuré » a été remboursé (status void), sa cote barrée n'est pas la cote totale : total_odds est la cote d'origine (non barrée… c'est-à-dire la plus haute, ex. 10,03 et non 6,59).
Marchés d'une seule équipe ou à écart : recopie le libellé du marché en entier, équipe comprise (« Total de buts (t. rég) - Sierra Leone », « Écart de buts (t. rég) »), et tout le choix (« Madagascar ne perd pas ou perd de 1 but exactement »).
Pour un combiné, une ligne par sélection, dans l'ordre affiché. Si le ticket est replié (pas de détail des lignes), selections est vide et is_collapsed vaut true.
Pronos de tipsters (kind = pronos) : messages Telegram ou WhatsApp, posts, vidéos TikTok, Instagram ou Facebook.
- Un ✅ après une option veut dire « oui, je joue cette option » : « Espagne ✅ » = victoire de l'Espagne, « BTTS ✅ » = les deux marquent, oui. Un ❌ veut dire « non » (« BTTS ❌ » = non). Recopie ces emojis dans pick_text. Ce ne sont jamais des résultats : outcome vaut unknown, sauf si le message dit explicitement « gagné » ou « perdu » pour la ligne. 🔥 💚 🎯 sont de la décoration.
- Une liste de pronos sans cote totale ni mise est une liste de paris séparés : ticket_type single. S'il y a une cote totale (« CÔTE TOTALE : 10,16 »), c'est un combiné.
- Publications Facebook d'un tipster : chaque publication (son propre en-tête avec le nom de la page et l'heure) est un élément de tickets distinct, même si plusieurs tiennent sur une capture. Une story en tableau « équipe – code – équipe » donne une sélection par ligne : le code écrit entre les deux équipes (V1, V2, 1X, 2X, 12, GG, NG, +2, +1,5…) va dans pick_text, recopié tel quel.
- « COTE 3 », « COUPON COTE 4 », « cote 3 » en tête d'une publication : c'est la cote totale annoncée d'un combiné (total_odds = 3, ticket_type combo). Ce n'est la cote d'aucune ligne : odds reste null pour chaque sélection.
- Ligne qui ne nomme qu'une équipe (« ESPAGNE VICTOIRE », « France → Win », « England — Victoire », « Lettonie+1,5 BUTS DANS LE MATCHS », « Espagne double+1,5 BUTS ») : team_only = l'équipe, pick_text = le reste de la ligne recopié tel quel (« VICTOIRE », « Win », « +1,5 BUTS DANS LE MATCHS », « double+1,5 BUTS »).
- Ligne « Équipe A - Équipe B » suivie du choix sur la même ligne ou la suivante (« 👉Angleterre ou Nul & +1.5 buts », « ➡️RDC gagne & +1.5 buts », « au moins une équipe marque+1,5 BUTS », « 1X », « V1 ») : home_team, away_team, et tout le choix dans pick_text, sans le couper.
- Pari sur un joueur (tirs, tirs cadrés, passes, buteur) : recopie le nom du joueur dans pick_text et garde le mot « joueur » dans market_text s'il est affiché. Ne le transforme jamais en pari sur le match.
- Les mentions d'offres de bookmaker (« 2UP », « boost ») ne sont pas des choix : ignore-les.
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
export function normalizePick(marketText: string, pickText: string, home: string | null, away: string | null, team?: string | null, alias?: { home?: string[]; away?: string[] }): NormalizedSelection {
  const m = marketText.toLowerCase();
  // ✅ = « oui, cette option » ; ❌ = « non ». Les autres emojis sont de la décoration.
  const oui = /[✅✔☑]/u.test(pickText) || /[✅✔☑]/u.test(marketText), non = /[❌✖🚫]/u.test(pickText);
  const p = pickText.toLowerCase().replace(/[\p{Extended_Pictographic}\uFE0F]/gu, " ").replace(/\s+/g, " ").trim().replace(/^[–—-](?!\s*(?:de\b|\d))\s*|\s*[–—-]$/g, "").trim();
  if (!p && oui && team) { const sd = (home && Math.max(teamSimilarity(team, home), ...(alias?.home ?? []).map((x) => teamSimilarity(team, x))) >= (away ? Math.max(teamSimilarity(team, away), ...(alias?.away ?? []).map((x) => teamSimilarity(team, x))) : 0)) ? "1" : "2"; if (home || away) return { market_code: "1X2", market_param: null, selection: sd, label_pick: `${team} gagne`, ok: true }; }
  if (!p) return { market_code: "1X2", market_param: null, selection: "", label_pick: "Choix non visible", ok: false, reason: "Le choix n'est pas écrit (prono dit à l'oral ?) : choisis-le." };
  const side = (name: string): "1" | "2" | null => {
    if (!name) return null;
    const names = [name, ABBR[name.toLowerCase().replace(/[.’']/g, "").trim()]].filter(Boolean) as string[];
    const sim = (t: string | null, al?: string[]) => (t ? Math.max(...[t, ...(al ?? [])].flatMap((x) => names.map((n) => teamSimilarity(n, x)))) : 0);
    const sh = sim(home, alias?.home), sa = sim(away, alias?.away);
    if (sh === 0 && sa === 0) return null;
    return sh >= sa ? "1" : "2";
  };
  const isDraw = (s: string) => /^(nul|draw|x|match nul)$/.test(s.trim());
  const ouLine = (s: string) => {
    const r = s.match(/([+\-]|plus|moins|over|under)\s*(?:de\s*)?(\d+[.,]?\d*)/i);
    if (!r) return null;
    const dir = /^(\+|plus|over)$/i.test(r[1]) ? "Plus" : "Moins";
    const line = Number(r[2].replace(",", "."));
    // Écriture de tipster « +2 » : au moins 2, soit plus de 1,5. Sur un ticket de bookmaker (marché nommé), la ligne reste telle quelle.
    return { dir, line: r[1] === "+" && !m.trim() && Number.isInteger(line) && line >= 1 ? line - 0.5 : line };
  };

  // Pronos de tipsters, libellés courts (avec l'équipe nommée seule ou dans le texte)
  const all = `${m} ${p}`;
  const teamSide = team ? side(team) : null;
  // Codes courts des tipsters, écrits entre les deux équipes ou après le match : V1, V2, 1X, 2X, 12, GG, NG
  if (!team && (!m.trim() || /résultat|resultat|1x2|double chance|vainqueur|prono/.test(m)) && !/mi[- ]?temps|&/.test(m)) {
    const c = p.replace(/[\s.]/g, "");
    const short = (market_code: string, selection: string): NormalizedSelection => ({ market_code, market_param: null, selection, label_pick: pickText, ok: true });
    if (/^(v1|1|victoire1)$/.test(c)) return short("1X2", "1");
    if (/^(v2|2|victoire2)$/.test(c)) return short("1X2", "2");
    if (/^(x|n|vn)$/.test(c)) return short("1X2", "N");
    if (/^(1x|x1|1n|n1)$/.test(c)) return short("DC", "1N");
    if (/^(x2|2x|n2|2n)$/.test(c)) return short("DC", "N2");
    if (/^(12|21)$/.test(c)) return short("DC", "12");
    if (/^(gg|btts)$/.test(c)) return short("BTTS", non ? "Non" : "Oui");
    if (/^(ng|nogoal)$/.test(c)) return short("BTTS", "Non");
  }
  const who = (x: string): "1" | "N" | "2" | null => { const y = x.replace(/\b(victoire|gagne|vainqueur|wins?|to win)\b/g, "").trim(); return isDraw(y) ? "N" : y ? side(y) : null; };
  // Statistiques, buteurs, prolongation, qualification : réglés sur le détail du match
  const mention = (): "1" | "2" | null => teamSide ?? (home && all.includes(home.toLowerCase()) ? "1" : away && all.includes(away.toLowerCase()) ? "2" : null);
  const yesNo = non || /\b(non|no|pas de|aucun)\b/.test(p) ? "Non" : "Oui";
  const stat = /corner/.test(all) ? "CORN" : /tirs? cadr|shots? on (goal|target)/.test(all) ? "SOT" : /carton|\bcards?\b|jaune/.test(all) ? "CARD" : /\btirs?\b(?! au but)|\bshots?\b/.test(all) ? "SHOT" : null;
  if (stat) {
    if (/\d\s*buts?\b|\bbuts?\s*\+|\bmarque/.test(all)) return { market_code: stat, market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Pari qui mêle buts et statistiques (corners, cartons) : pas encore suivi. Retire la ligne ou saisis-la à la main." };
    const o = ouLine(p), t = mention();
    // Statistique d'un joueur (« Mbappé : plus de 1,5 tir cadré ») : BETWISE ne suit que les totaux du match ou d'une équipe.
    // La lire comme un total du match la ferait gagner presque à coup sûr : on la signale au lieu de la régler de travers.
    const joueur = /joueur|player/.test(all) || (!!o && !t && ((stat === "SOT" && o.line <= 3.5) || (stat === "SHOT" && o.line <= 6.5)));
    if (joueur) return { market_code: stat, market_param: o?.line ?? null, selection: pickText, label_pick: pickText, ok: false, reason: "Statistique d’un joueur (tirs, tirs cadrés…) : pas suivie par BETWISE. La ligne est écartée ; règle ce ticket à la main." };
    if (stat === "CARD" && /rouge|red/.test(all) && !o) return { market_code: "RED", market_param: null, selection: yesNo, label_pick: pickText, ok: true };
    if (o) return { market_code: t && stat !== "SHOT" ? `${stat}${t}` : stat, market_param: o.line, selection: o.dir, label_pick: pickText, ok: true };
    if (stat === "CORN" && /le plus|plus de corners|most/.test(all)) { const r = isDraw(p) || /égalité|autant/.test(p) ? "N" : t; if (r) return { market_code: "CORN_1X2", market_param: null, selection: r, label_pick: pickText, ok: true }; }
    return { market_code: stat, market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Pari sur les statistiques : précise la ligne (ex. plus de 9,5)." };
  }
  if (/buteur|marque à tout moment|\bscorer\b|marque(ra)? (un but|le premier)/.test(all)) {
    const first = /premier|first|1er/.test(all);
    const name = pickText.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, " ").replace(/\b(premier|1er|buteur|marque(ra)?( à tout moment| un but| le premier but)?|but|:)\b/gi, " ").replace(/[:–—-]/g, " ").replace(/\s+/g, " ").trim();
    return name.length >= 3 ? { market_code: first ? "BUT1" : "BUT", market_param: null, selection: name, label_pick: pickText, ok: true } : { market_code: "BUT", market_param: null, selection: "", label_pick: pickText, ok: false, reason: "Buteur : indique le nom du joueur." };
  }
  if (/tirs au but|penalty shoot/.test(all)) return { market_code: "PEN", market_param: null, selection: yesNo, label_pick: pickText, ok: true };
  if (/prolongation|extra time/.test(all)) return { market_code: "ET", market_param: null, selection: yesNo, label_pick: pickText, ok: true };
  if (/qualifi|vainqueur final|remporte (le trophée|la coupe)|to qualify/.test(all)) { const r = teamSide ?? who(p.replace(/se qualifie|qualifié|qualification|vainqueur final|:/g, " ").trim()); const r12 = r === "1" || r === "2" ? r : null; return { market_code: "QUALIF", market_param: null, selection: r12 ?? pickText, label_pick: pickText, ok: !!r12 }; }
  if (/score exact/.test(all) && /mi[- ]?temps/.test(all)) { const cs = p.match(/(\d+)\s*[-:]\s*(\d+)/); return { market_code: "HT_CS", market_param: null, selection: cs ? `${cs[1]}-${cs[2]}` : pickText, label_pick: pickText, ok: !!cs }; }

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
  // Total de buts d'une seule équipe : « Total de buts (t. rég) - Sierra Leone » / « - de 1,5 »
  { const mt = m.match(/(?:total|nombre)[^–—-]*buts?[^–—-]*\s[–—-]\s*(.+)$/); const ts = mt ? side(mt[1].trim()) : null; const o = ts ? ouLine(p) : null;
    if (ts && o) return { market_code: `TT${ts}`, market_param: o.line, selection: o.dir, label_pick: pickText, ok: true }; }
  // Écart de buts : « Madagascar ne perd pas ou perd de 1 but exactement » = handicap +1,5 ; « gagne de 2 buts ou plus » = handicap -1,5
  if (/écart de buts|ecart de buts|ne perd pas ou perd|gagne (de|par) \d buts? ou plus/.test(all)) {
    const a = p.match(/^(.*?)\s+ne perd pas ou perd (?:de|par) (\d) buts?(?: exactement| ou moins| maximum)?$/), b = p.match(/^(.*?)\s+gagne (?:de|par) (\d) buts? ou plus$/);
    const sd = a ? side(a[1]) : b ? side(b[1]) : null;
    if (sd && a) return { market_code: "AH", market_param: Number(a[2]) + 0.5, selection: sd, label_pick: pickText, ok: true };
    if (sd && b) return { market_code: "AH", market_param: -(Number(b[2]) - 0.5), selection: sd, label_pick: pickText, ok: true };
    return { market_code: "AH", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Pari sur l’écart de buts : formulation pas reconnue. Choisis le handicap à la main." };
  }
  // Combinés écrits dans le choix : « Angleterre ou Nul & +1.5 buts », « Ghana gagne & +1.5 buts », « double + 1,5 buts »
  {
    const btts = (x: string) => (/(2|deux) (équipes )?marquent|btts|\bgg\b/.test(x) ? (/pas|\bnon\b/.test(x) ? "Non" : "Oui") : null);
    const res = (x: string): { dc: string | null; r: "1" | "N" | "2" | null } => {
      const y = x.replace(/\bdouble chance\b|:/g, " ").trim();
      const dc = parseDoubleChance(y, side, isDraw) ?? (teamSide && /^(double|ou nul|ou match nul)?$/.test(y) && /double|ou nul/.test(x) ? (teamSide === "1" ? "1N" : "N2") : null);
      return { dc, r: dc ? null : who(y) ?? (teamSide && /^(victoire|gagne|vainqueur|wins?)$/.test(y) ? teamSide : null) };
    };
    const parts = /^double( chance)?\s*\+/.test(p) && team ? ["double", p.replace(/^double( chance)?\s*/, "")] : p.split(/\s*&\s*|\s+et\s+(?=[+]|plus|moins|les (?:2|deux)|btts)/);
    if (parts.length === 2) {
      const [a, b] = parts;
      const ou = ouLine(b), bt = btts(b), { dc, r } = res(a);
      if (dc && ou) return { market_code: "DC_OU", market_param: ou.line, selection: `${dc}|${ou.dir}`, label_pick: pickText, ok: true };
      if (r && ou) return { market_code: "1X2_OU", market_param: ou.line, selection: `${r}|${ou.dir}`, label_pick: pickText, ok: true };
      if (dc && bt) return { market_code: "DC_BTTS", market_param: null, selection: `${dc}|${bt}`, label_pick: pickText, ok: true };
      if (r && bt) return { market_code: "1X2_BTTS", market_param: null, selection: `${r}|${bt}`, label_pick: pickText, ok: true };
      const ouA = ouLine(a), btA = btts(a);
      if (ouA && bt) return { market_code: "OU_BTTS", market_param: ouA.line, selection: `${ouA.dir}|${bt}`, label_pick: pickText, ok: true };
      if (btA && ou) return { market_code: "OU_BTTS", market_param: ou.line, selection: `${ou.dir}|${btA}`, label_pick: pickText, ok: true };
    }
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
  if (teamSide && /^(victoire|gagne|vainqueur|wins?|to win|1|2)$/.test(p.replace(/[^a-zà-ü0-9 ]/g, "").trim())) return { market_code: "1X2", market_param: null, selection: teamSide, label_pick: `${team} gagne`, ok: true };
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
  // Par défaut : résultat du match — seulement si le marché le dit, ou si le choix est juste un nom d'équipe.
  // Un marché inconnu dont le choix contient un nom d'équipe n'est pas une victoire : on le signale au lieu de deviner.
  const r = isDraw(p) ? "N" : side(p);
  const connu = !m.trim() || /résultat|resultat|1x2|vainqueur|issue du match|match winner/.test(m) || p.split(" ").length <= 3;
  if (r && !connu) return { market_code: "1X2", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: `Marché « ${marketText} » pas reconnu : choisis-le à la main, sinon la ligne est écartée.` };
  return { market_code: "1X2", market_param: null, selection: r ?? pickText, label_pick: pickText, ok: !!r };
}

/** Sigles et noms longs que les tipsters emploient, ramenés au nom du référentiel. */
const ABBR: Record<string, string> = {
  rdc: "RD Congo", "dr congo": "RD Congo", "congo rdc": "RD Congo", "congo kinshasa": "RD Congo", rca: "Centrafrique", "république centrafricaine": "Centrafrique", "republique centrafricaine": "Centrafrique",
  civ: "Côte d'Ivoire", "cote divoire": "Côte d'Ivoire", "côte divoire": "Côte d'Ivoire", "république tchèque": "Tchéquie", "republique tcheque": "Tchéquie", rsa: "Afrique du Sud", usa: "États-Unis", "pays bas": "Pays-Bas",
};

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
  const res = await llm.extract({ system: SYSTEM, user, images: input.images, schema: SCHEMA_MULTI as unknown as Record<string, unknown>, maxTokens: 12000 });
  const raws = rawMulti.parse(res.json).tickets.slice(0, 12);

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
    const ref = parseFrDate(raw.placed_at) ?? parsePublished(raw.source?.published_at ?? null) ?? new Date().toISOString();
    const selections: MatchedSelection[] = raw.selections.map((s) => {
      const best = s.team_only && !(s.home_team && s.away_team) ? bestMatchOne(s.team_only, matches, ref) : bestMatch(s.home_team, s.away_team, matches);
      const h = best ? best.home!.nom : s.home_team, a = best ? best.away!.nom : s.away_team;
      const norm = normalizePick(s.market_text, s.pick_text, h, a, s.team_only ?? null, best ? { home: best.home!.alias, away: best.away!.alias } : undefined);
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
    return { raw, selections, checks, placed_at_iso: parseFrDate(raw.placed_at) ?? parsePublished(raw.source?.published_at ?? null), usage: { tokensIn: k ? 0 : res.tokensIn, tokensOut: k ? 0 : res.tokensOut, model: res.model } };
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

export const canon = (name: string) => ABBR[name.toLowerCase().replace(/[.’']/g, "").trim()] ?? name;

/** Match d'une équipe nommée seule (pronos de tipster) : le plus proche de la date de publication, à venir de préférence. */
function bestMatchOne(teamRaw: string, pool: Parameters<typeof bestMatch>[2], refIso: string) {
  const team = canon(teamRaw);
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
  home = canon(home); away = canon(away);
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

/** Heure de publication d'un post : date complète, ou âge relatif tel que l'affichent les réseaux (« 13 h », « il y a 15 heures », « 2 j »). */
export function parsePublished(s: string | null, now = Date.now()): string | null {
  const abs = parseFrDate(s);
  if (abs || !s) return abs;
  const r = s.toLowerCase().match(/(\d+)\s*(min|mn|h|heures?|j|jours?|d)\b/);
  if (!r) return null;
  const n = Number(r[1]), ms = /^m/.test(r[2]) ? 60000 : /^h/.test(r[2]) ? 3600000 : 86400000;
  return new Date(now - n * ms).toISOString();
}

/** Lien de partage 1xBet : xbet://open/coupon?id=H9KSJ → référence du coupon, sans contenu. */
export function parseCouponLink(s: string): { bookmaker: string; code: string; url: string } | null {
  const m = s.match(/xbet:\/\/open\/coupon\?id=([A-Za-z0-9]+)/i);
  if (m) return { bookmaker: "1xBet", code: m[1].toUpperCase(), url: m[0] };
  return null;
}

