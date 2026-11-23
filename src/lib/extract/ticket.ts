import { APP_NAME } from "@/lib/app-name";
/**
 * Extraction d'un ticket de pari (capture ou texte) → structure validée + rapprochement avec le référentiel.
 * Le LLM lit ; le code vérifie (schéma, produit des cotes, rapprochement des matchs, déduction 1/N/2).
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { getLlm, type LlmImage } from "../llm/provider";
import { normalizeTeam, teamSimilarity } from "../odds-api/client";
import { loadSignals, probOfSignal } from "../probs/signals";
import { coteEstimee } from "../options/build";
import { selectionCombo } from "../bets/combo";
import { ApiFootball } from "../api-football/client";
import { completerMatchs } from "../api-football/a-la-demande";
import { createAdminClient } from "../supabase/admin";

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
1xBet : chaque sélection tient sur une seule ligne sous le match (« Handicap 2 (-1) », « Total Plus de (1.5) », « Total Individuel 2 Plus de (0.5) », « Les deux équipes vont marquer - Oui », « V2 », « 12 ») : recopie cette ligne entière dans pick_text, sans la traduire ni la raccourcir. L'horodatage du ticket (placed_at) est la date écrite en haut après « à partir de » (« 17.11.2026 (13:12) ») ; les dates à droite de chaque match sont des coups d'envoi (kickoff).
Betclic, paris sur un joueur : la ligne en gras est le choix (« Bruno Fernandes », « E. Haaland / R. Højlund »), la ligne en dessous le marché (« Joueur ou son remplaçant décisif (tps rég.) », « Double chance buteur (remplaçants inclus - t. rég) ») : pick_text reçoit le choix, market_text le marché, recopiés en entier.
Ne saute aucune ligne d'un ticket, même si le marché t'est inconnu : recopie-la telle quelle, elle sera gardée et réglée à la main.
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
- Texte dicté à la voix (il commence par « [dictée] ») : une ou plusieurs phrases parlées qui décrivent des paris (« ajoute en pari test la victoire de Lens contre Lyon en Ligue 1 à deux dix »). kind = pronos, une sélection par pari décrit : home_team et away_team si les deux équipes sont dites (« X contre Y », « X face à Y », « X–Y »), sinon team_only ; pick_text = le pari en mots courts (« victoire Lens », « plus de 2,5 buts », « les deux marquent »). Les nombres dits en lettres se lisent en chiffres (« deux dix », « deux virgule dix » = 2.10 ; « un cinquante » = 1.50) ; la cote n'est remplie que si elle est dite, jamais devinée. Le championnat dit va dans competition. « Pari test », « tester », « sans miser » ne sont pas des choix : ignore-les.
- Tableau de pronostics de scores (titre « Predictions », « pronos du jour », « Today's Football Predictions », mention « scores are illustrative ») : chaque ligne « équipe A score équipe B » est un prono de score exact sur un match à venir, pas un résultat. home_team, away_team, pick_text = le score recopié (« 2 - 2 »), score = null, outcome = unknown, kind = pronos, ticket_type single.
- « Gagne au moins une partie » ou « une période » veut dire « gagne au moins une mi-temps » ; « Va marquer » après une équipe veut dire « cette équipe marque au moins un but » : recopie la ligne telle quelle.
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
/** Tournures anglaises courantes chez les tipsters, ramenées au français que le reste du parseur comprend. */
export function anglais(x: string): string {
  return x
    .replace(/\b(1st|first) half\b|\bhalf[- ]?time\b/g, "1ère mi-temps")
    .replace(/\b(2nd|second) half\b/g, "2e mi-temps")
    .replace(/\bboth teams to score\b/g, "btts")
    .replace(/\bdouble chance\b/g, "double chance")
    .replace(/\s+/g, " ").trim();
}

export function normalizePick(marketText: string, pickText: string, home: string | null, away: string | null, team?: string | null, alias?: { home?: string[]; away?: string[] }): NormalizedSelection {
  // 1xBet et beaucoup de tipsters écrivent tout le pari sur une seule ligne : le modèle la recopie alors dans les deux champs.
  // Un libellé de marché identique au choix n'apprend rien : il est traité comme absent.
  const plat = (x: string) => x.toLowerCase().replace(/[\p{Extended_Pictographic}\uFE0F]/gu, " ").replace(/\s+/g, " ").trim();
  const mOrig = anglais(marketText.toLowerCase());
  const m = plat(marketText) === plat(pickText) ? "" : mOrig;
  // ✅ = « oui, cette option » ; ❌ = « non ». Les autres emojis sont de la décoration.
  const oui = /[✅✔☑]/u.test(pickText) || /[✅✔☑]/u.test(marketText), non = /[❌✖🚫]/u.test(pickText);
  const p = anglais(pickText.toLowerCase().replace(/[\p{Extended_Pictographic}\uFE0F]/gu, " ").replace(/\s+/g, " ").trim().replace(/^[–—-](?!\s*(?:de\b|\d))\s*|\s*[–—-]$/g, "").trim());
  // Un score seul (« 2 - 2 ») publié comme prono : score exact (tableaux « Predictions » de pages Facebook, 23/11)
  { const cs = p.match(/^(\d{1,2})\s*[-–:]\s*(\d{1,2})$/);
    if (cs && (!m || /score|correct|exact|prediction|prono/.test(m)) && !/mi[- ]?temps|half|\bht\b|\b2e\b|1(?:ère|re)/.test(m)) return { market_code: "CS", market_param: null, selection: `${cs[1]}-${cs[2]}`, label_pick: `Score exact ${cs[1]}-${cs[2]}`, ok: true }; }
  // « Arsenal ou les deux marquent », « Away or GG » : gagne si l'un OU l'autre arrive. Aucun marché suivi ne le règle ;
  // le lire comme « les deux marquent » le ferait perdre à tort. Gardé tel quel, à confirmer.
  if (/\b(ou|or)\b/.test(p) && /\bgg\b|btts|(les )?(2|deux) (équipes )?marquent/.test(p) && !/&|\bet\b/.test(p))
    return { market_code: "LIBRE", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "« Résultat ou les deux marquent » : pari « l’un ou l’autre », pas suivi automatiquement. Gardé tel quel, à confirmer et régler à la main." };
  // Options de paiement anticipé (« 1up », « 2up » : payé dès que l'équipe mène d'un ou deux buts) : le pari de base est lu,
  // mais le paiement anticipé n'est pas suivi ; l'utilisateur confirme.
  { const up = p.match(/^(.*?)\s*\(?\b([12])\s*up\)?$/);
    if (up) {
      const base = up[1].trim() ? normalizePick(marketText.replace(/\(?\b[12]\s*up\b\)?/i, ""), pickText.replace(/\(?\b[12]\s*up\b\)?/i, "").trim(), home, away, team, alias) : null;
      return { ...(base && base.ok ? base : { market_code: "LIBRE", market_param: null, selection: pickText }), label_pick: pickText, ok: false,
        reason: `Option « ${up[2]}up » (payé dès que l’équipe mène de ${up[2]} but${up[2] === "2" ? "s" : ""}) : ${base?.ok ? "lu comme le pari de base, sans le paiement anticipé" : "pari de base non reconnu"}. Vérifie si le bookmaker a payé plus tôt.` };
    } }
  if (/\bexcl\.?\s*\d/.test(p)) return { market_code: "LIBRE", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Mention « excl. » (but exclu) : règle propre au bookmaker, pas suivie. Gardé tel quel, à confirmer." };
  // Écritures anglaises de tipsters, côté désigné par home / away / 1 / 2
  { const cote = (x: string): "1" | "2" | null => (/^(home|1|domicile)$/.test(x) ? "1" : /^(away|2|extérieur|exterieur)$/.test(x) ? "2" : null);
    const ok = (market_code: string, market_param: number | null, selection: string): NormalizedSelection => ({ market_code, market_param, selection, label_pick: pickText, ok: true });
    // « Home over 1.5 », « Away team under 0.5 » : buts de l'équipe
    let e = p.match(/^(home|away)(?: team)?\s+(over|under|plus de|moins de)\s*(\d+(?:[.,]\d+)?)(?: goals?)?$/);
    if (e) return ok(`TT${cote(e[1])}`, Number(e[3].replace(",", ".")), /over|plus/.test(e[2]) ? "Plus" : "Moins");
    // « Home -1 », « Away +1.5 » : handicap asiatique
    e = p.match(/^(home|away)\s*([+\-]\s*\d+(?:[.,]\d+)?)$/);
    if (e) { const v = Number(e[2].replace(/\s/g, "").replace(",", ".")); if ((v * 4) % 1 === 0) return ok("AH", v, cote(e[1])!); }
    // « Draw no bet 1 », « DNB away »
    e = p.match(/^(?:draw no bet|dnb|rembours[ée]e? si nul)\s*[:\-–]?\s*(home|away|1|2)$/) ?? p.match(/^(home|away|1|2)\s*(?:draw no bet|dnb)$/);
    if (e) return ok("DNB", null, cote(e[1])!);
    // « Win either half 1 », « 1 to win both halves », « Win to nil 2 »
    e = p.match(/^(?:win either half|to win either half)\s*(home|away|1|2)$/) ?? p.match(/^(home|away|1|2)\s*(?:to )?win either half$/);
    if (e) return ok("WEH", null, cote(e[1])!);
    e = p.match(/^(?:win both halves|to win both halves)\s*(home|away|1|2)$/) ?? p.match(/^(home|away|1|2)\s*(?:to )?win both halves$/);
    if (e) return ok("WBH", null, cote(e[1])!);
    e = p.match(/^(?:win to nil)\s*(home|away|1|2)$/) ?? p.match(/^(home|away|1|2)\s*(?:to )?win to nil$/);
    if (e) return ok("WTN", null, cote(e[1])!);
    // « Clean sheet home » : l'adversaire ne marque pas ; « Home team to score » : au moins un but
    e = p.match(/^clean sheet\s*(home|away|1|2)$/) ?? p.match(/^(home|away|1|2)(?: team)? clean sheet$/);
    if (e) return ok(`TT${cote(e[1]) === "1" ? "2" : "1"}`, 0.5, "Moins");
    e = p.match(/^(home|away)(?: team)? to score$/);
    if (e) return ok(`TT${cote(e[1])}`, 0.5, "Plus");
    // « Exact score 2-1 », « Correct score 1:1 »
    e = p.match(/^(?:exact score|correct score|score exact|cs)\s*:?\s*(\d+)\s*[-:]\s*(\d+)$/);
    if (e && !/mi[- ]?temps|\b(ht|mt)\b/.test(m)) return ok("CS", null, `${e[1]}-${e[2]}`);
    // « 1 HT », « X HT », « HT 2 », « Mi-temps | 1 » : résultat à la mi-temps
    e = p.match(/^([12xn])\s+(?:ht|mt|à la mi-temps|1ère mi-temps)$/) ?? p.match(/^(?:ht|mt)\s+([12xn])$/) ?? (/^(?:mi[- ]?temps|1(?:ère|ere|re) mi[- ]?temps|half[- ]?time|résultat à la mi[- ]?temps)$/.test(m.trim()) ? p.match(/^([12xn])$/) : null);
    if (e) return ok("HT_1X2", null, /[xn]/.test(e[1]) ? "N" : e[1]);
    // « Mbappé anytime », « Haaland to score », « anytime scorer : Kane »
    e = p.match(/^(.+?)\s+(?:anytime(?: scorer| goalscorer)?|to score(?: anytime)?)$/) ?? p.match(/^anytime (?:scorer|goalscorer)\s*:?\s*(.+)$/);
    if (e && !cote(e[1].trim())) {
      const x = e[1].trim(), simH = home ? teamSimilarity(x, home) : 0, simA = away ? teamSimilarity(x, away) : 0;
      if (Math.max(simH, simA) >= 0.5) return ok(`TT${simH >= simA ? "1" : "2"}`, 0.5, "Plus"); // une équipe « to score » : au moins un but
      const n = nomJoueur(x).replace(/(^|[\s'’-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()); if (n.length >= 3) return ok("BUT", null, n);
    }
  }
  if (!p && oui && team) { const sd = (home && Math.max(teamSimilarity(team, home), ...(alias?.home ?? []).map((x) => teamSimilarity(team, x))) >= (away ? Math.max(teamSimilarity(team, away), ...(alias?.away ?? []).map((x) => teamSimilarity(team, x))) : 0)) ? "1" : "2"; if (home || away) return { market_code: "1X2", market_param: null, selection: sd, label_pick: `${team} gagne`, ok: true }; }
  if (!p) return { market_code: "1X2", market_param: null, selection: "", label_pick: "Choix non visible", ok: false, reason: "Le choix n'est pas écrit (prono dit à l'oral ?) : choisis-le." };
  // 1xBet : « Handicap 2 (-1) » = handicap asiatique sur l'équipe 2. Sur une ligne entière, un écart exactement égal
  // au handicap rembourse la sélection (vérifié sur ticket : Bénin -1, victoire 0-1, cote retirée du combiné).
  {
    const h = `${m} ${p}`.match(/handicap\s*([12])\s*\(?\s*([+\-−]?\s*\d+(?:[.,]\d+)?)\s*\)?/);
    if (h && !/europ|3 issues|3 way|corner/.test(`${m} ${p}`)) {
      // « Handicap 1 (-1) 1ère mi-temps » : le même handicap, sur une seule mi-temps ; un handicap de 0 = remboursé si nul
      const t = `${m} ${p}`, pre = /mi[- ]?temps|\b(mt|ht)\b/.test(t) ? (/\b(2e|2ème|2eme|2nde|seconde|deuxième)\b/.test(t) ? "H2_" : "HT_") : "";
      const v = Number(h[2].replace(/\s/g, "").replace("−", "-").replace(",", "."));
      if (pre && v === 0) return { market_code: `${pre}DNB`, market_param: null, selection: h[1], label_pick: pickText, ok: true };
      return { market_code: `${pre}AH`, market_param: v, selection: h[1], label_pick: pickText, ok: true };
    }
  }
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
    const r = s.match(/([+\-]|plus|moins|over|under)\s*(?:de\s*)?\(?\s*(\d+[.,]?\d*)/i);
    if (!r) return null;
    const dir = /^(\+|plus|over)$/i.test(r[1]) ? "Plus" : "Moins";
    const line = Number(r[2].replace(",", "."));
    // Écriture de tipster « +2 » : au moins 2, soit plus de 1,5. Sur un ticket de bookmaker (marché nommé), la ligne reste telle quelle.
    return { dir, line: r[1] === "+" && !m.trim() && Number.isInteger(line) && line >= 1 ? line - 0.5 : line };
  };

  // Pronos de tipsters, libellés courts (avec l'équipe nommée seule ou dans le texte)
  const all = `${m} ${p}`;
  const teamSide = team ? side(team) : null;
  // Pair ou impair : le choix d'abord (le nom du marché contient souvent les deux mots, « Total pair/impair »)
  const parite = (): "Pair" | "Impair" | null => { for (const t of [p, all]) { if (/\bimpair\b|\bodd\b/.test(t)) return "Impair"; if (/\bpair\b|\beven\b/.test(t)) return "Pair"; } return null; };
  // Plusieurs conditions écrites à la suite (« Victoire & +1,5 buts & +8,5 corners ») : un combiné libre si chacune est comprise
  const essaiCombo = (): NormalizedSelection | null => {
    const ps = pickText.split(/\s+&\s+|\s+\+\s+(?!\d)|\s+et\s+(?=plus|moins|\+|-|les deux|btts|over|under)/i).map((x) => x.trim()).filter(Boolean);
    return ps.length >= 2 ? comboLibre(ps.map((x) => normalizePick("", x, home, away, team, alias)), pickText) : null;
  };
  // Betclic MyCombi et codes de tipsters : plusieurs paris du même match sur une ligne, « marché A / marché B » et « choix A / choix B ».
  // Lus comme un seul marché, ils devenaient le dernier seulement (« + de 2,5 / Oui » enregistré comme « les deux marquent »).
  if (!/&/.test(marketText + pickText) && !/mi[- ]?temps\s*\/\s*fin|\b(ht|mt)\s*\/\s*ft\b/i.test(marketText + " " + pickText) && !parseDoubleChance(p, side, isDraw)) {
    const ps = pickText.split(/\s+\/\s+/), ms = m.trim() ? marketText.split(/\s+\/\s+/) : ps.map(() => "");
    if (ps.length >= 2 && ms.length === ps.length) {
      const parts = ps.map((x, i) => normalizePick(ms[i], x, home, away, team, alias));
      const combo = parts.length === 2 ? combiner(parts[0], parts[1], pickText) : null;
      return combo ?? comboLibre(parts, pickText) ?? { market_code: "1X2", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Plusieurs paris du même match réunis sur une ligne : gardés tels quels, à régler à la main." };
    }
  }
  // « Remboursé si nul » : un nul rend la mise, ce n'est pas une victoire sèche
  if (/rembours[ée]e?s? si (?:match )?nul|draw no bet|\bdnb\b/.test(all)) {
    const r = side(p.replace(/\(?\s*rembours[ée]e?s? si (?:match )?nul\s*\)?|draw no bet|\bdnb\b|[:–—-]/g, " ").replace(/\s+/g, " ").trim()) ?? teamSide;
    return { market_code: "DNB", market_param: null, selection: r ?? pickText, label_pick: pickText, ok: !!r, ...(r ? {} : { reason: "Remboursé si nul : équipe non reconnue." }) };
  }
  // 1xBet, paris composés : « Equipe 1 ne va pas perdre et Total > (1.5) - Oui », « V1 et Total < (3.5) - Oui »
  { const c = (m.trim() ? `${m.trim()} - ${p}` : p).match(/^(.*?)\s+et\s+total\s*([<>])\s*\(?\s*(\d+(?:[.,]\d+)?)\s*\)?\s*(?:[-–—:]\s*(oui|non))?$/);
    if (c) {
      const g = c[1].trim(), dir = c[2] === ">" ? "Plus" : "Moins", line = Number(c[3].replace(",", "."));
      const np = g.match(/^[ée]quipe\s*([12]) ne va pas perdre$/), v = g.match(/^(?:v|victoire\s*)([12])$/) ?? g.match(/^[ée]quipe\s*([12]) (?:va gagner|gagne)$/);
      const out = (market_code: string, selection: string): NormalizedSelection => ({ market_code, market_param: line, selection, label_pick: pickText, ok: true });
      if (c[4] !== "non") {
        if (np) return out("DC_OU", `${np[1] === "1" ? "1N" : "N2"}|${dir}`);
        if (v) return out("1X2_OU", `${v[1]}|${dir}`);
        if (/^(x|nul|match nul)$/.test(g)) return out("1X2_OU", `N|${dir}`);
        if (/(2|deux) équipes (vont marquer|marquent)/.test(g)) return out("OU_BTTS", `${dir}|Oui`);
      }
      return { market_code: "1X2", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Pari composé de 1xBet pas reconnu : gardé tel quel, à régler à la main." };
    } }
  // Codes courts des tipsters, écrits entre les deux équipes ou après le match : V1, V2, 1X, 2X, 12, GG, NG
  if (!team && (!m.trim() || /résultat|resultat|1x2|double chance|vainqueur|prono/.test(m)) && !/mi[- ]?temps|&|corner|carton|card/.test(m)) {
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
  const stat = /corner/.test(all) ? "CORN" : /tirs? cadr|shots? on (goal|target)/.test(all) ? "SOT" : /carton|\bcards?\b|jaune/.test(all) ? "CARD" : /\btirs?\b(?! au but)|\bshots?\b/.test(all) ? "SHOT" : /\bfautes?\b|\bfouls?\b/.test(all) ? "FOUL" : /hors[- ]?jeu|offsides?/.test(all) ? "OFF" : null;
  // « Rice reçoit un carton », « Joueur averti : Declan Rice » : un joueur nommé, pas un total de cartons
  if ((stat === "CARD" || (!stat && /averti|\bbooked\b/.test(all))) && /re[çc]oit|prend(?:ra)? un carton|averti|\bbooked\b|carton pour/.test(all) && !ouLine(p) && !mention() && !/[ée]quipe|match/.test(p)) {
    const name = nomJoueur(pickText);
    if (name.length >= 3) return { market_code: "PCARD", market_param: null, selection: name, label_pick: pickText, ok: true };
  }
  if (stat) {
    // « Turquie 1BUT+ 3 CORNERS » : l'équipe marque au moins 1 but ET obtient au moins 3 corners (lecture confirmée le 19/11)
    { const bc = all.match(/(\d+)\s*buts?\s*\+\s*(\d+)\s*corners?/);
      if (bc && stat === "CORN") {
        const nm = p.match(/^(.*?)\s*\d+\s*buts?\s*\+/); const sd = teamSide ?? (nm && nm[1].trim() ? side(nm[1].trim()) : null);
        if (sd) { const c = comboLibre([
          { market_code: `TT${sd}`, market_param: Number(bc[1]) - 0.5, selection: "Plus", label_pick: pickText, ok: true },
          { market_code: `CORN${sd}`, market_param: Number(bc[2]) - 0.5, selection: "Plus", label_pick: pickText, ok: true },
        ], pickText); if (c) return c; }
      } }
    if (/\d\s*buts?\b|\bbuts?\s*\+|\bmarque/.test(all)) { const c = essaiCombo(); if (c) return c; }
    if (/\d\s*buts?\b|\bbuts?\s*\+|\bmarque/.test(all)) return { market_code: stat, market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Pari qui mêle buts et statistiques (corners, cartons) : pas encore suivi. La ligne est gardée telle quelle, à régler à la main." };
    const o = ouLine(p), t = mention();
    // Statistique d'un joueur (« Mbappé : plus de 1,5 tir cadré ») : BETWISE ne suit que les totaux du match ou d'une équipe.
    // La lire comme un total du match la ferait gagner presque à coup sûr : on la signale au lieu de la régler de travers.
    const joueur = /joueur|player/.test(all) || (!!o && !t && ((stat === "SOT" && o.line <= 3.5) || (stat === "SHOT" && o.line <= 6.5)));
    if (joueur) {
      // Tirs ou tirs cadrés d'un joueur nommé : réglés sur la feuille des joueurs (depuis le 19/11)
      const nom = nomStat(pickText);
      if (o && nom.length >= 3 && (stat === "SOT" || stat === "SHOT")) return { market_code: stat === "SOT" ? "PSOT" : "PSHOT", market_param: o.line, selection: `${o.dir}|${nom}`, label_pick: pickText, ok: true };
      return { market_code: stat, market_param: o?.line ?? null, selection: pickText, label_pick: pickText, ok: false, reason: `Statistique d’un joueur : ${nom.length >= 3 ? "ligne" : "nom du joueur"} non reconnu${nom.length >= 3 ? "e" : ""}. La ligne est gardée telle quelle, à régler à la main.` };
    }
    if (stat === "CARD" && /rouge|red/.test(all) && !o) return { market_code: t ? `RED${t}` : "RED", market_param: null, selection: yesNo, label_pick: pickText, ok: true };
    if (stat === "CARD" && /le plus|plus de cartons que|most/.test(all) && !o) { const r = isDraw(p) || /égalité|autant/.test(p) ? "N" : t; if (r) return { market_code: "CARD_1X2", market_param: null, selection: r, label_pick: pickText, ok: true }; }
    if (stat === "CORN" && /handicap/.test(all)) {
      const hc = p.match(/([+\-–]\s*\d+(?:[.,]\d+)?)/), eq = all.match(/handicap\s*([12])\b/), sd = eq ? (eq[1] as "1" | "2") : t;
      const v = hc ? Number(hc[1].replace(/\s/g, "").replace("–", "-").replace(",", ".")) : null;
      return sd && v !== null && (v * 2) % 1 === 0 ? { market_code: "CORN_AH", market_param: v, selection: sd, label_pick: pickText, ok: true }
        : { market_code: "CORN_AH", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Handicap sur les corners : équipe ou ligne non reconnue. La ligne est gardée telle quelle, à régler à la main." };
    }
    // « Corners 1X2 : 1 », « Cartons – vainqueur : X » : l'équipe qui en a le plus
    { const fin = (p.split(/[:|]/).pop() ?? "").trim();
      if ((stat === "CORN" || stat === "CARD") && /1x2|résultat|resultat|vainqueur|winner/.test(all) && /^(1|2|x|n|nul|draw)$/.test(fin)) return { market_code: `${stat}_1X2`, market_param: null, selection: /^(x|n|nul|draw)$/.test(fin) ? "N" : fin, label_pick: pickText, ok: true }; }
    if (stat === "CORN" && parite()) return { market_code: "CORN_OE", market_param: null, selection: parite()!, label_pick: pickText, ok: true };
    if (o) return { market_code: t ? `${stat}${t}` : stat, market_param: o.line, selection: o.dir, label_pick: pickText, ok: true };
    if (stat === "CORN" && /le plus|plus de corners|most/.test(all)) { const r = isDraw(p) || /égalité|autant/.test(p) ? "N" : t; if (r) return { market_code: "CORN_1X2", market_param: null, selection: r, label_pick: pickText, ok: true }; }
    return { market_code: stat, market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Pari sur les statistiques : précise la ligne (ex. plus de 9,5)." };
  }
  // Penalty dans le match : ni la séance de tirs au but, ni « les deux équipes marquent »
  if (/p[ée]nalt/.test(all) && !/tirs? au but|shoot/.test(all)) {
    const ko = (reason: string): NormalizedSelection => ({ market_code: "PK", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason });
    const uneDes = /une des|l[’']une des|au moins une/.test(all);
    if (!uneDes && /(les|des) (2|deux) équipes marquent|chaque équipe|chacune/.test(all)) return ko("Penalty marqué par chacune des deux équipes : pari pas suivi, gardé tel quel et réglé à la main.");
    if (/manqu|rat[ée]|arr[êe]t/.test(all)) return { market_code: "PKM", market_param: null, selection: yesNo, label_pick: pickText, ok: true };
    if (!uneDes && mention()) return ko("Penalty d’une équipe précise : pari pas suivi, gardé tel quel et réglé à la main.");
    if (/marqu|transform|réussi|inscrit|but sur/.test(all)) return { market_code: "PKB", market_param: null, selection: yesNo, label_pick: pickText, ok: true };
    if (/accord|siffl|dans le match|y aura|aura[- ]t[- ]il|obtenu/.test(all) || /^p[ée]nalty\s*[-–—:]?\s*(oui|non|yes|no)?$/.test(all.trim()) || /^(oui|non|yes|no)$/.test(p)) return { market_code: "PK", market_param: null, selection: yesNo, label_pick: pickText, ok: true };
    return ko("Pari sur un penalty : formulation pas reconnue, gardé tel quel et réglé à la main.");
  }
  // But contre son camp dans le match
  if (/contre son camp|\bcsc\b|own goal/.test(all)) return { market_code: "OG", market_param: null, selection: yesNo, label_pick: pickText, ok: true };
  // Triplé d'un joueur nommé
  if (/tripl[ée]|hat[- ]?trick|coup du chapeau/.test(all)) {
    const name = nomJoueur(pickText);
    return name.length >= 3 && !/\b(un|n'importe quel|n’importe quel) joueur\b/.test(all) ? { market_code: "BUT3", market_param: null, selection: name, label_pick: pickText, ok: true }
      : { market_code: "BUT3", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Triplé : indique le nom du joueur. Sans nom, la ligne est gardée telle quelle, à régler à la main." };
  }
  // Doublé : « un joueur » = n'importe quel joueur du match ; sinon le joueur nommé marque 2 buts ou plus
  if (/doublé|\bbrace\b/.test(all)) {
    if (/\b(un|n'importe quel|n’importe quel) joueur\b|any player/.test(all)) return { market_code: "DBL", market_param: null, selection: yesNo, label_pick: pickText, ok: true };
    const name = nomJoueur(pickText);
    return name.length >= 3 ? { market_code: "BUT2", market_param: null, selection: name, label_pick: pickText, ok: true }
      : { market_code: "DBL", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Doublé : indique le nom du joueur. Sans nom, la ligne est gardée telle quelle, à régler à la main." };
  }
  // Première / dernière équipe à marquer : avec une équipe nommée ou « aucun but ». Un joueur nommé reste un pari « buteur ».
  if (/[ée]quipe (?:à|a) marquer|ouvr(?:e|ira) le score|marque(?:ra)? (?:en|le) (?:premier|dernier)(?! but)|(?:premier|dernier) but(?!eur)/.test(all) && !/buteur/.test(all)) {
    const reste = p.replace(/(?:premi[èe]re|derni[èe]re) [ée]quipe (?:à|a) marquer|marque(?:ra)? (?:en|le) (?:premier|dernier)|ouvr(?:e|ira) le score|(?:le )?(?:premier|dernier) but|marque(?:ra)?|[:–—-]/g, " ").replace(/\s+/g, " ").trim();
    const sd = /\baucune?\b|pas de but/.test(p) ? "Aucun" : teamSide ?? (reste ? side(reste) : null);
    if (sd) return { market_code: /derni[èe]re?/.test(all) ? "LTS" : "FTS", market_param: null, selection: sd, label_pick: pickText, ok: true };
  }

  // Passe décisive d'un joueur nommé (sans « ou buteur », sans remplaçant) : réglée sur la feuille des joueurs
  if (/passes? décisives?|passeur|\bassists?\b/.test(all) && !/rempla[çc]ant|buteur|décisif|decisif|double chance/.test(all)) {
    const nom = nomStat(pickText), o = ouLine(p);
    if (nom.length >= 3) return { market_code: "PAST", market_param: o?.line ?? 0.5, selection: `${o ? o.dir : yesNo === "Non" ? "Moins" : "Plus"}|${nom}`, label_pick: pickText, ok: true };
  }
  // Joueur « décisif », passeur, remplaçant compris, deux joueurs au choix : la feuille de match ne suffit pas à trancher
  if (/rempla[çc]ant|décisif|decisif|passeur|passe décisive|double chance buteur/.test(all))
    return { market_code: "BUT", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Pari sur un joueur avec une condition (remplaçant, passeur, deux joueurs au choix) : gardé tel quel, à régler à la main." };
  if (/buteur|marque à tout moment|\bscorer\b|marque(ra)? (un but|le premier|le dernier)/.test(all)) {
    const first = /premier|first|1er/.test(all), last = /dernier|\blast\b/.test(all);
    const name = nomJoueur(pickText);
    return name.length >= 3 ? { market_code: first ? "BUT1" : last ? "BUTL" : "BUT", market_param: null, selection: name, label_pick: pickText, ok: true } : { market_code: "BUT", market_param: null, selection: "", label_pick: pickText, ok: false, reason: "Buteur : indique le nom du joueur." };
  }
  if (/tirs au but|penalty shoot/.test(all)) return { market_code: "PEN", market_param: null, selection: yesNo, label_pick: pickText, ok: true };
  if (/prolongation|extra time/.test(all)) return { market_code: "ET", market_param: null, selection: yesNo, label_pick: pickText, ok: true };
  if (/qualifi|vainqueur final|remporte (le trophée|la coupe)|to qualify/.test(all)) { const r = teamSide ?? who(p.replace(/se qualifie|qualifié|qualification|vainqueur final|:/g, " ").trim()); const r12 = r === "1" || r === "2" ? r : null; return { market_code: "QUALIF", market_param: null, selection: r12 ?? pickText, label_pick: pickText, ok: !!r12 }; }
  if (/score exact/.test(all) && /mi[- ]?temps/.test(all)) { const cs = p.match(/(\d+)\s*[-:]\s*(\d+)/); return { market_code: /\b(2e|2ème|2eme|2nde|seconde|deuxième)\b/.test(all) ? "H2_CS" : "HT_CS", market_param: null, selection: cs ? `${cs[1]}-${cs[2]}` : pickText, label_pick: pickText, ok: !!cs }; }

  // « Gagne les deux mi-temps », « marque dans les deux mi-temps » : une équipe nommée
  // « partie » et « période » sont dits pour « mi-temps » chez beaucoup de tipsters (« gagne au moins une partie », 23/11)
  { const wb = /(?:gagne|remporte|gagner|remporter)(?:ra)? les (?:2|deux) (?:mi[- ]?temps|parties|périodes)|win both halves/.test(all);
    const sb = !wb && /marqu(?:e|era|ent|er) dans (?:les|chaque|chacune des) (?:2 |deux )?(?:mi[- ]?temps|parties|périodes)|score in both halves/.test(all);
    if (wb || sb) {
      const nm = all.match(/^(.*?)\s*(?:va gagner|va remporter|va marquer|gagnera|remportera|marquera|gagne|remporte|marque) (?:les|dans)/);
      const sd = teamSide ?? (nm && nm[1].trim() ? side(nm[1].trim()) : null) ?? (all.match(/[ée]quipe\s*([12])/)?.[1] as "1" | "2" | undefined) ?? null;
      const neg = non || /^(non|no)$/.test(p) || /[-–—:]\s*non$/.test(p);
      const code = wb ? "WBH" : "SBH";
      return sd && !neg ? { market_code: code, market_param: null, selection: sd, label_pick: pickText, ok: true }
        : { market_code: code, market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: neg ? "Pari « non » sur les deux mi-temps : pas suivi, gardé tel quel et réglé à la main." : "Pari sur les deux mi-temps : équipe non reconnue." };
    } }
  // « Gagne au moins une mi-temps » : l'une ou l'autre, pas forcément la première
  if (/(gagne|remporte|gagner|remporter) au moins (1|une) (mi[- ]?temps|partie|période)|win(s)? (either|at least one) half/.test(all)) {
    const nm = all.match(/^(.*?)\s*(?:va gagner|va remporter|gagne|remporte) au moins/);
    const sd = teamSide ?? (nm && nm[1].trim() ? side(nm[1].trim()) : null);
    const neg = non || /^(non|no)$/.test(p) || /[-–—:]\s*non$/.test(p);
    return sd && !neg ? { market_code: "WEH", market_param: null, selection: sd, label_pick: pickText, ok: true }
      : { market_code: "WEH", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: neg ? "« Ne gagne aucune mi-temps » : pari pas suivi, gardé tel quel et réglé à la main." : "Gagne au moins une mi-temps : équipe non reconnue." };
  }
  // But dans chacune des deux mi-temps, sans équipe précise
  if (/buts? (?:marqué )?dans (?:les|chaque|chacune des) (?:2 |deux )?mi[- ]?temps/.test(all)) {
    const neg = non || /^(non|no)$/.test(p) || /[-–—:]\s*non$/.test(p);
    { const sd = mention() ?? (all.match(/[ée]quipe\s*([12])/)?.[1] as "1" | "2" | undefined) ?? null;
      if (sd) return neg ? { market_code: "SBH", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Pari « non » sur les deux mi-temps : pas suivi, gardé tel quel et réglé à la main." } : { market_code: "SBH", market_param: null, selection: sd, label_pick: pickText, ok: true }; }
    return { market_code: "BH", market_param: null, selection: neg ? "Non" : "Oui", label_pick: pickText, ok: true };
  }
  // Mi-temps la plus prolifique
  if (/mi[- ]?temps (?:la plus prolifique|avec le plus de buts)/.test(all)) {
    const s = /égal|egal|autant|nul/.test(p) ? "N" : /\b(2e|2ème|2eme|2nde|seconde|deuxième)\b/.test(p) ? "2" : /\b(1ère|1ere|1re|première|premiere)\b/.test(p) ? "1" : null;
    return { market_code: "HMG", market_param: null, selection: s ?? pickText, label_pick: pickText, ok: !!s, ...(s ? {} : { reason: "Mi-temps la plus prolifique : choisis la mi-temps." }) };
  }
  // Mi-temps / fin de match : « Italie / Nul », « 1/2 »
  if (/mi[- ]?temps\s*[\/-]\s*fin|\b(ht|mt)\s*\/\s*ft\b/.test(all)) {
    let parts = p.replace(/.*(fin de match|ft)\s*:?/i, "").replace(/\s*[-–—]\s*oui$/, "").split(/\s*\/\s*/).map((x) => x.trim()).filter(Boolean);
    if (parts.length !== 2) { const t = (parts[0] ?? "").replace(/\s/g, "").match(/^(v?[12]|x|n)(v?[12]|x|n)$/); if (t) parts = [t[1], t[2]]; }
    const code = (x: string) => (/^v?[12]$/.test(x) ? (x.slice(-1) as "1" | "2") : /^(x|n|vn)$/.test(x) ? "N" : who(x));
    const [x1, x2] = parts.length === 2 ? parts.map(code) : [null, null];
    return x1 && x2 ? { market_code: "HTFT", market_param: null, selection: `${x1}/${x2}`, label_pick: pickText, ok: true } : { market_code: "HTFT", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Mi-temps / fin de match : choisis les deux résultats." };
  }
  // But avant une minute donnée : « But dans les 15 premières minutes », « But avant la 30e minute », « But entre la 1re et la 15e minute »
  { const g = all.match(/buts? (?:marqué )?(?:avant|dans) (?:la |les )?(\d{1,2})\s*(?:e|ère|ere|eme|ème|['’])?\s*(?:premi[èe]res? )?min/) ?? all.match(/buts? (?:marqué )?entre (?:la )?[01](?:re|ère|ere|e)? (?:minute )?et (?:la )?(\d{1,2})/);
    if (g && Number(g[1]) >= 1 && Number(g[1]) <= 90) return { market_code: "GB", market_param: Number(g[1]), selection: non || /\b(non|no|pas de|aucun)\b/.test(p) ? "Non" : "Oui", label_pick: pickText, ok: true }; }
  // Marchés d'une mi-temps : « Ghana – 1ère mi-temps », « +0,5 but en 1ère mi-temps », « Nul à la mi-temps », « 2e mi-temps : Italie »
  if (/mi[- ]?temps|\b(mt|ht)\b/.test(all)) {
    const h2 = /\b(2e|2ème|2eme|2nde|seconde|deuxième)\b/.test(all);
    const pre = h2 ? "H2_" : "HT_";
    const q = p.replace(/(1(ère|ere|re)|première|premiere|2(e|ème|eme|nde)|seconde|deuxième)?\s*mi[- ]?temps|\b(mt|ht)\b|\b(à la|a la|en|de la|résultat)\b/g, " ").replace(/[:–—-]/g, " ").replace(/\s+/g, " ").trim();
    const o = ouLine(p.replace(/total individuel\s*[12]/, " "));
    const ti = all.match(/total individuel\s*([12])/);
    if (parite()) return { market_code: `${pre}OE`, market_param: null, selection: parite()!, label_pick: pickText, ok: true };
    { const hd = all.match(/handicap\s*([12])\s*\(?\s*([+-]?\d+(?:[.,]\d+)?)\s*\)?/); const v = hd ? Number(hd[2].replace(",", ".")) : null;
      if (hd && v !== null && (v * 2) % 1 === 0) return { market_code: v === 0 ? `${pre}DNB` : `${pre}AH`, market_param: v === 0 ? null : v, selection: hd[1], label_pick: pickText, ok: true }; }
    if (/rembours[ée]e? si (?:match )?nul|draw no bet/.test(all)) { const r = who(q.replace(/rembours[ée]e? si (?:match )?nul|[()]/g, " ").replace(/\s+/g, " ").trim()) ?? teamSide; if (r === "1" || r === "2") return { market_code: `${pre}DNB`, market_param: null, selection: r, label_pick: pickText, ok: true }; }
    if (ti && o) return { market_code: `${pre}TT${ti[1]}`, market_param: o.line, selection: o.dir, label_pick: pickText, ok: true };
    if (o && (/\b(buts?|over|under|total)\b/.test(p) || /^(\+|plus|moins)/.test(q))) return { market_code: `${pre}OU`, market_param: o.line, selection: o.dir, label_pick: pickText, ok: true };
    if (/(2|deux) (équipes )?(?:vont marquer|marquent)|btts/.test(all)) return { market_code: `${pre}BTTS`, market_param: null, selection: non || /\bnon\b/.test(q) ? "Non" : "Oui", label_pick: pickText, ok: true };
    if (/\sou\s|\//.test(q)) { const dc = parseDoubleChance(q, side, isDraw); if (dc) return { market_code: `${pre}DC`, market_param: null, selection: dc, label_pick: pickText, ok: true }; }
    const r = who(q) ?? (!q.replace(/victoire|gagne|vainqueur/g, "").trim() ? teamSide : null);
    if (r) return { market_code: `${pre}1X2`, market_param: null, selection: r, label_pick: pickText, ok: true };
    return { market_code: `${pre}1X2`, market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Pari de mi-temps : choisis le marché et le choix." };
  }
  // Nombre exact de buts, dans le match ou pour une équipe : « Nombre exact de buts : 2 », « Sénégal : 2 buts exactement »
  { const ex = all.match(/nombre exact de buts\D*(\d)(?!\d|[.,]\d)/) ?? p.match(/(?:^|\s)(\d)\s*buts?\s*exactement$/) ?? p.match(/exactement\s*(\d)\s*buts?$/);
    // « perd de 1 but exactement », « gagne par 2 buts exactement » parlent de l'écart, pas du nombre de buts
    if (ex && !/perd|gagn|[ée]cart|victoire/.test(all)) { const t = mention(); return { market_code: t ? `MG${t}` : "MG", market_param: null, selection: `${ex[1]}-${ex[1]}`, label_pick: pickText, ok: true }; } }
  // Écart exact : « Sénégal gagne par 1 but exactement », « gagne de 2 buts d'écart » = handicap européen, issue « nul »
  { const ex = p.match(/^(.*?)\s+gagne (?:de|par) (?:exactement )?(\d) buts?(?: exactement| d['’]écart)?$/);
    if (ex && /exactement|d['’]écart/.test(p)) { const sd = side(ex[1]); if (sd) return { market_code: "EH", market_param: sd === "1" ? -Number(ex[2]) : Number(ex[2]), selection: "N", label_pick: pickText, ok: true }; } }
  // 1xBet : « Total Individuel 2 Plus de (0.5) » = buts de l'équipe 2 ; « Total Plus de (1.5) » = buts du match.
  { const ti = all.match(/total individuel\s*([12])\s*(.*)$/); const o = ti ? ouLine(ti[2]) : null;
    if (ti && o) return { market_code: `TT${ti[1]}`, market_param: o.line, selection: o.dir, label_pick: pickText, ok: true };
    const tm = !ti ? all.trim().match(/^total\s+((?:plus|moins|over|under)\b.*)$/) : null; const o2 = tm ? ouLine(tm[1]) : null;
    if (o2) return { market_code: "OU", market_param: o2.line, selection: o2.dir, label_pick: pickText, ok: true }; }
  // « Total équipe 1 », « Team total 2 », « Total buts de l'équipe 1 » dans le nom du marché : buts de cette équipe
  { const te = m.match(/(?:total|buts?)[^0-9]*?(?:[ée]quipe|team)\s*([12])\b|team total\s*([12])\b|(home|away) team total/); const o = te ? ouLine(p) : null;
    if (te && o) return { market_code: `TT${te[1] ?? te[2] ?? (te[3] === "home" ? "1" : "2")}`, market_param: o.line, selection: o.dir, label_pick: pickText, ok: true }; }
  // Total de buts d'une seule équipe : « Total de buts (t. rég) - Sierra Leone » / « - de 1,5 »
  { const mt = m.match(/(?:total|nombre)[^–—-]*buts?[^–—-]*\s[–—-]\s*(.+)$/); const ts = mt ? side(mt[1].trim()) : null; const o = ts ? ouLine(p) : null;
    if (ts && o) return { market_code: `TT${ts}`, market_param: o.line, selection: o.dir, label_pick: pickText, ok: true }; }
  // Écart de buts : « Madagascar ne perd pas ou perd de 1 but exactement » = handicap +1,5 ; « gagne de 2 buts ou plus » = handicap -1,5
  if (/écart de buts|ecart de buts|ne perd pas ou perd|gagne (de|par) \d buts? ou (plus|\+)/.test(all)) {
    const a = p.match(/^(.*?)\s+ne perd pas ou perd (?:de|par) (\d) buts?(?: exactement| ou moins| maximum)?$/), b = p.match(/^(.*?)\s+gagne (?:de|par) (\d) buts? ou (?:plus|\+)$/);
    const sd = a ? side(a[1]) : b ? side(b[1]) : null;
    if (sd && a) return { market_code: "AH", market_param: Number(a[2]) + 0.5, selection: sd, label_pick: pickText, ok: true };
    if (sd && b) return { market_code: "AH", market_param: -(Number(b[2]) - 0.5), selection: sd, label_pick: pickText, ok: true };
    return { market_code: "AH", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Pari sur l’écart de buts : formulation pas reconnue. Choisis le handicap à la main." };
  }
  // Combinés écrits dans le choix : « Angleterre ou Nul & +1.5 buts », « Ghana gagne & +1.5 buts », « double + 1,5 buts »
  {
    const btts = (x: string) => (/(2|deux) (équipes )?(?:vont marquer|marquent)|btts|\bgg\b/.test(x) ? (/pas|\bnon\b/.test(x) ? "Non" : "Oui") : null);
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
  // Pair / impair : du match, ou des buts d'une équipe (« Total individuel 1 », « buts de l'équipe 2 », « buts du Sénégal »)
  { const pi = parite();
    if (pi) { const te = all.match(/individuel\s*([12])|[ée]quipe\s*([12])/); const t = te ? (te[1] ?? te[2]) : /buts? (?:de|du|des|d['’])\s*\S/.test(all) ? mention() : null;
      return { market_code: t ? `OE${t}` : "OE", market_param: null, selection: pi, label_pick: pickText, ok: true }; } }
  if (/sans encaisser|win to nil/.test(all)) { const r = teamSide ?? side(p.replace(/gagne|sans encaisser( de but)?|win to nil/g, "").trim()); return { market_code: "WTN", market_param: null, selection: r ?? pickText, label_pick: pickText, ok: !!r }; }
  { const r = p.match(/^(?:entre\s*)?(\d)\s*(?:-|à|a|et)\s*(\d)\s*buts?$/); if (r && Number(r[1]) <= Number(r[2])) return { market_code: "MG", market_param: null, selection: `${r[1]}-${r[2]}`, label_pick: pickText, ok: true }; }
  if (m.includes("handicap") && /europ|3 issues|1x2|3 way/.test(m)) {
    const r = p.match(/^(.*?)\s*\(?([+\-]\d+)\)?$/); const w = r ? who(r[1]) : null;
    if (r && w) return { market_code: "EH", market_param: w === "2" ? -Number(r[2]) : Number(r[2]), selection: w, label_pick: pickText, ok: true };
  }
  if (/(les )?(2|deux) (équipes )?(?:vont marquer|marquent)|btts/.test(all)) return { market_code: "BTTS", market_param: null, selection: non || /(ne )?marquent pas|pas marquer|\bnon\b|\bno\b/.test(p) ? "Non" : "Oui", label_pick: pickText, ok: true };
  // « Garde sa cage inviolée », « n'encaisse pas » : l'adversaire ne marque pas ; « ne marque pas » : l'équipe elle-même
  { const neg = non || /^(non|no)$/.test(p) || /[-–—:]\s*non$/.test(p);
    if (/cage inviol|clean sheet|n['’]encaisse(?:ra)? pas|ne prend(?:ra)? pas de but|garde sa cage/.test(all) && !/gagne|victoire|\bwin/.test(all)) {
      const sd = teamSide ?? side(p.replace(/garde(?:ra)? sa cage inviolée?|clean sheet|n['’]encaisse(?:ra)? pas(?: de but)?|ne prend(?:ra)? pas de but|[:–—-]|\b(oui|non)\b/g, " ").replace(/\s+/g, " ").trim());
      if (sd) return { market_code: `TT${sd === "1" ? "2" : "1"}`, market_param: 0.5, selection: neg ? "Plus" : "Moins", label_pick: pickText, ok: true };
    }
    const nm = p.match(/^(.*?)\s*(?:ne marque(?:ra)? pas|ne va pas marquer)$/); const s2 = nm ? (nm[1].trim() ? side(nm[1].trim()) : teamSide) : null;
    if (nm && s2 && !/(2|deux)|équipes/.test(p)) return { market_code: `TT${s2}`, market_param: 0.5, selection: "Moins", label_pick: pickText, ok: true }; }
  // « Slovaquie va marquer », « marque » après une équipe nommée seule : au moins un but de cette équipe
  { const vm = p.match(/^(.*?)\s*(?:va marquer|marquera|marque(?: au moins (?:1|un) but)?)$/); const sd = vm ? (vm[1].trim() ? side(vm[1].trim()) : teamSide) : null;
    if (vm && sd && !/(2|deux)|équipes/.test(p)) return { market_code: `TT${sd}`, market_param: 0.5, selection: "Plus", label_pick: pickText, ok: true }; }
  // « Sénégal +1,5 » d'un tipster : buts de l'équipe nommée (au moins 2), pas du match (lecture confirmée le 19/11).
  // « +1,5 BUTS DANS LE MATCH » reste le total du match ; un marché « handicap » nommé reste un handicap.
  if (!/handicap|match|&|\bet\b/.test(all)) {
    const tl = p.match(/^(.*?)\s*\+\s*(\d+(?:[.,]\d+)?)\s*(?:buts?)?$/);
    if (tl) {
      const nom = tl[1].trim();
      const proche = (x: string, t: string | null, al?: string[]) => (t ? Math.max(...[t, ...(al ?? [])].map((y) => teamSimilarity(canon(x), y))) : 0);
      const sd = nom ? (proche(nom, home, alias?.home) >= 0.8 ? "1" : proche(nom, away, alias?.away) >= 0.8 ? "2" : null) : teamSide;
      if (sd) { const v = Number(tl[2].replace(",", ".")); return { market_code: `TT${sd}`, market_param: Number.isInteger(v) ? v - 0.5 : v, selection: "Plus", label_pick: pickText, ok: true }; }
    }
  }
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
  // « La Belgique ne perd pas », « invaincue », « pas de défaite » : double chance (l'équipe ou le nul), pas une victoire
  { const np = p.match(/^(.*?)\s*(?:ne perd(?:ra)? pas|ne perdent pas|ne s['’]incline pas|reste invaincue?|pas de défaite)$/);
    if (np) { const sd = np[1].trim() ? side(np[1].trim()) : teamSide;
      if (sd) return { market_code: "DC", market_param: null, selection: sd === "1" ? "1N" : "N2", label_pick: pickText, ok: true };
      return { market_code: "DC", market_param: null, selection: pickText, label_pick: pickText, ok: false, reason: "Double chance : équipe non reconnue." }; } }
  // Par défaut : résultat du match — seulement si le marché le dit, ou si le choix est juste un nom d'équipe.
  // Un marché inconnu dont le choix contient un nom d'équipe n'est pas une victoire : on le signale au lieu de deviner.
  const r = isDraw(p) ? "N" : side(p);
  const ditResultat = /résultat|resultat|1x2|vainqueur|victoire|gagn|issue du match|match winner|\bwin|prono|sélection|selection/.test(mOrig);
  // Ce qui reste du choix une fois retirés le nom des équipes et les mots de victoire : « Sénégal +1,5 » laisse « +1,5 », donc pas une victoire
  const connus = new Set([home, away, team, ...(alias?.home ?? []), ...(alias?.away ?? [])].filter((x): x is string => !!x).flatMap((x) => [x, canon(x)]).flatMap((x) => normalizeTeam(x).split(" ")));
  const reste = normalizeTeam(p.replace(/[+]/g, " plus ")).split(" ").filter((w) => w && !connus.has(w) && !/^(victoire|gagne|gagnant|vainqueur|wins?|to|nul|draw|x|match)$/.test(w));
  // Marché distinct qui parle de résultat : on tolère deux mots d'écart sur le nom (« Manchester Utd », « Bayern Munich F. »). Sinon, rien ne doit rester.
  const connu = reste.length === 0 || (ditResultat && !!m.trim() && reste.length <= 2);
  if (!r || !connu) { const c = essaiCombo(); if (c) return c; }
  if (r && !connu) return { market_code: "1X2", market_param: null, selection: pickText, label_pick: pickText, ok: false,
    reason: /[+]\s*\d|\d[.,]\d/.test(p) ? "Choix ambigu (buts du match ou de l’équipe ?) : choisis le marché, sinon la ligne est gardée telle quelle." : m.trim() ? `Marché « ${marketText} » pas reconnu : choisis-le à la main, sinon la ligne est gardée telle quelle.` : "Choix pas reconnu : choisis le marché, sinon la ligne est gardée telle quelle." };
  return { market_code: "1X2", market_param: null, selection: r ?? pickText, label_pick: pickText, ok: !!r };
}

/** Deux paris simples du même match réunis en un marché combiné suivi ; null si la paire n'existe pas. */
function combiner(a: NormalizedSelection, b: NormalizedSelection, label: string): NormalizedSelection | null {
  if (!a.ok || !b.ok || a.market_code === b.market_code) return null;
  const by = (code: string) => (a.market_code === code ? a : b.market_code === code ? b : null);
  const ou = by("OU"), bt = by("BTTS"), dc = by("DC"), r = by("1X2");
  const mk = (market_code: string, market_param: number | null, selection: string): NormalizedSelection => ({ market_code, market_param, selection, label_pick: label, ok: true });
  if (ou && bt) return mk("OU_BTTS", ou.market_param, `${ou.selection}|${bt.selection}`);
  if (dc && ou) return mk("DC_OU", ou.market_param, `${dc.selection}|${ou.selection}`);
  if (r && ou) return mk("1X2_OU", ou.market_param, `${r.selection}|${ou.selection}`);
  if (dc && bt) return mk("DC_BTTS", null, `${dc.selection}|${bt.selection}`);
  if (r && bt) return mk("1X2_BTTS", null, `${r.selection}|${bt.selection}`);
  return null;
}

/** Plusieurs paris simples du même match réunis en un combiné libre (marché COMBO) ; null si l'un d'eux n'est pas compris. */
function comboLibre(parts: NormalizedSelection[], label: string): NormalizedSelection | null {
  if (parts.length < 2 || parts.some((x) => !x.ok || !x.selection)) return null;
  // Deux conditions sur le même marché (« Sénégal + nul ») : ce n'est pas un combiné, c'est une autre écriture qu'on ne devine pas
  if (new Set(parts.map((x) => `${x.market_code}@${x.market_param}`)).size !== parts.length) return null;
  const selection = selectionCombo(parts.map((x) => ({ market: x.market_code, param: x.market_param, sel: x.selection })));
  return selection ? { market_code: "COMBO", market_param: null, selection, label_pick: label, ok: true } : null;
}

/** Nom d'un joueur dans un libellé : ce qui reste une fois retirés les mots du pari. */
export function nomJoueur(texte: string): string {
  return texte.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, " ")
    .replace(/(?<![\p{L}\d])(premier|dernier|1er|buteur|joueur|averti|marquera|marque|va marquer|à tout moment|un but|le but|but|un doublé|doublé|un triplé|triplé|hat[- ]?trick|reçoit|recoit|prendra|prend|un carton|carton|jaune|rouge|pour|oui|non|[23] buts? ou plus|au moins [23] buts?|le|un)(?![\p{L}\d])/giu, " ")
    .replace(/[:–—\-()+]/g, " ").replace(/\s+/g, " ").trim();
}

/** Nom du joueur dans un pari sur ses statistiques : « Harry Kane + de 1,5 », « Mbappé : plus de 2,5 tirs cadrés », « Rice fait une passe décisive ». */
export function nomStat(texte: string): string {
  return texte.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, " ")
    .replace(/([+\-]|plus|moins|over|under)\s*(?:de\s*)?\(?\s*\d+(?:[.,]\d+)?\s*\)?/giu, " ")
    .replace(/(?<![\p{L}\d])(au moins|tirs?|cadrés?|cadres?|passes?|décisives?|passeur|assists?|shots?|on target|joueur|du|de|fait|fera|une?|oui|non|opta|nombre)(?![\p{L}\d])/giu, " ")
    .replace(/\d+/g, " ").replace(/[:–—\-()|]/g, " ").replace(/\s+/g, " ").trim();
}

/** Libellé d'origine d'une ligne, tel qu'on le garde quand le pari n'est pas reconnu : « marché : choix », 120 caractères au plus. */
export function libelleBrut(marketText: string, pickText: string): string {
  const net = (x: string) => x.replace(/\s+/g, " ").trim();
  const m = net(marketText), p = net(pickText);
  const t = !m || m.toLowerCase() === p.toLowerCase() ? p : !p ? m : `${m} : ${p}`;
  return (t || "Pari non lu").slice(0, 120);
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
  /** Libellé d'origine de la ligne (marché et choix), gardé tel quel quand le pari n'est pas reconnu. */
  libelle: string;
  home_team: string | null;
  away_team: string | null;
  odds: number | null;
  odds_source: "ticket" | "reference" | "estimee" | null;
  outcome: "won" | "lost" | "void" | "pending" | "unknown";
  score: string | null;
  confidence: number;
  match: { id: string; home: string; away: string; kickoff_at: string; competition: string; score: string | null } | null;
  score_consistent: boolean | null;   // null si pas de score en base
  /** Chance estimée par BETWISE pour ce choix sur ce match, quand elle existe : sert au contrôle de vraisemblance. */
  p_estimee?: number | null;
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

  const construire = async () => {
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
        ...norm, libelle: libelleBrut(s.market_text, s.pick_text),
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
  return out;
  };
  let out = await construire();

  // Équipes introuvables (championnats que BETWISE ne suit pas) : on va chercher leur match chez API-Football,
  // on l'ajoute avec ses cotes, puis on refait le rapprochement (23/11).
  const manquants: { equipe: string; adversaire: string | null; ref: string }[] = [];
  for (const t of out) {
    const ref = parseFrDate(t.raw.placed_at) ?? parsePublished(t.raw.source?.published_at ?? null) ?? new Date().toISOString();
    t.selections.forEach((x, j) => {
      if (x.match) return;
      const s = t.raw.selections[j], equipe = s?.team_only ?? s?.home_team ?? null;
      if (equipe) manquants.push({ equipe, adversaire: s.team_only ? null : s.away_team ?? null, ref });
    });
  }
  if (manquants.length && process.env.API_FOOTBALL_KEY) {
    const api = new ApiFootball(process.env.API_FOOTBALL_KEY);
    const r = await completerMatchs(createAdminClient(), api, manquants).catch(() => ({ ajoutes: 0, requetes: 0 }));
    if (r.ajoutes) out = await construire();
  }

  // Chance estimée de chaque ligne reconnue (contrôle de vraisemblance à l'écran), et pour les pronos sans cote :
  // cote de référence quand elle existe, sinon cote estimée à partir des probabilités (marquée comme telle)
  const ids = [...new Set(out.flatMap((t) => t.selections.filter((x) => x.match && x.ok).map((x) => x.match!.id)))];
  if (ids.length) {
    const signals = await loadSignals(db as never, ids);
    for (const t of out) for (const x of t.selections) {
      if (!x.match || !x.ok) continue;
      const sg = signals.get(x.match.id); if (!sg) continue;
      const p = probOfSignal(sg, x.market_code, x.market_param, x.selection);
      x.p_estimee = p ?? null;
      if (x.odds) continue;
      const refOdd = sg.refOdd(x.market_code, x.market_param, x.selection);
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

/** "08/11/2026 13:38" (Betclic), "17.11.2026 (13:12)" (1xBet), "08/11/2026 à 13h38" → ISO (heure d'Abidjan = UTC). */
export function parseFrDate(s: string | null): string | null {
  if (!s) return null;
  const r = s.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\D{1,4}(\d{1,2})[:h](\d{2})/);
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

