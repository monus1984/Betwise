/**
 * Tipster ChatGPT : décision quotidienne par l'API OpenAI, sur les données BETWISE uniquement.
 * Aucun pari réel. L'API est appelée uniquement si OPENAI_API_KEY et OPENAI_TIPSTER_MODEL sont configurés.
 * --essai : appelle le modèle et produit un rapport, mais n'écrit rien dans Supabase (l'appel API reste facturé).
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { createAdminClient } from "../src/lib/supabase/admin";
import { loadSignals, picksOf, ALL_CANDIDATES, releveFrais } from "../src/lib/probs/signals";
import { jourAbidjan } from "../src/lib/coach/daily";
import { profilDe } from "../src/lib/coach/categories";
import {
  compteRobot, sessionRobot, clientAudit,
  CHATGPT_TIPSTER_EMAIL, CHATGPT_TIPSTER_PSEUDO,
} from "../src/lib/tipster-virtuel/compte";
import {
  BANKROLL_DEPART, bilan, choisir, mise, raison, relevesComparables,
  type Candidat, type DejaJoue,
} from "../src/lib/tipster-virtuel/strategie";
import { familleOf } from "../src/lib/probs/signals";

const ESSAI = process.argv.includes("--essai");
const ADMIN_ID = process.env.BETWISE_ADMIN_ID;
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_TIPSTER_MODEL;
const TIPSTER_NOM = "ChatGPT · tipster virtuel";
const MAX_CANDIDATS = 120;
const RISK = { sur: "prudent", audacieux: "moyen", risque: "risque" } as const;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

type CandidateApi = Candidat & {
  candidateId: string; match: string; bookmaker: string; edgeMarche: number;
};
type ModelPick = { candidate_id: string; probability: number; rationale: string };
type ModelResult = { picks: ModelPick[]; abstention_reason: string };

const schema = {
  type: "object",
  properties: {
    picks: {
      type: "array", maxItems: 6,
      items: {
        type: "object",
        properties: {
          candidate_id: { type: "string" },
          probability: { type: "number", minimum: 0.01, maximum: 0.99 },
          rationale: { type: "string" },
        },
        required: ["candidate_id", "probability", "rationale"],
        additionalProperties: false,
      },
    },
    abstention_reason: { type: "string" },
  },
  required: ["picks", "abstention_reason"],
  additionalProperties: false,
};

async function decide(candidates: CandidateApi[]): Promise<ModelResult> {
  if (!API_KEY) throw new Error("OPENAI_API_KEY absent : ajoute le secret GitHub pour activer les décisions ChatGPT.");
  if (!MODEL) throw new Error("OPENAI_TIPSTER_MODEL absent : indique le modèle API autorisé dans les variables GitHub.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      store: false,
      max_output_tokens: 2500,
      instructions: [
        "Tu es le profil autonome ChatGPT de BETWISE, évalué dans un benchmark de pronostics virtuels.",
        "Tu n'as accès qu'au dossier fourni. N'utilise aucune recherche web, aucune connaissance de résultats futurs et n'invente aucune donnée.",
        "Choisis uniquement parmi les candidate_id fournis. Tu peux t'abstenir de tout pari.",
        "Privilégie la qualité de l'estimation, pas le nombre de choix. La cote 1xBet et la probabilité de marché sont des références, pas des garanties.",
        "Pour chaque choix, fournis une probabilité personnelle raisonnable (0.01 à 0.99) et une justification factuelle courte à partir du dossier.",
        "Ne choisis pas de match commencé, de cote périmée, ni de cote supérieure à 3.20. Le validateur du serveur appliquera les règles finales et les plafonds.",
        "Réponds exclusivement selon le schéma JSON imposé.",
      ].join("\n"),
      input: JSON.stringify({ generated_at: new Date().toISOString(), candidates }),
      text: { format: { type: "json_schema", name: "betwise_chatgpt_picks", strict: true, schema } },
    }),
  });
  const body = await response.json() as { output_text?: string; error?: { message?: string }; status?: string };
  if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${body.error?.message ?? "erreur sans détail"}`);
  if (!body.output_text) throw new Error("Réponse OpenAI sans output_text exploitable.");
  const parsed = JSON.parse(body.output_text) as ModelResult;
  if (!Array.isArray(parsed.picks) || parsed.picks.length > 6 || typeof parsed.abstention_reason !== "string") {
    throw new Error("Format de décision ChatGPT invalide.");
  }
  return parsed;
}

async function main() {
  if (!ADMIN_ID) throw new Error("BETWISE_ADMIN_ID manquant");
  if (!API_KEY || !MODEL) {
    console.log("SKIP: OPENAI_API_KEY ou OPENAI_TIPSTER_MODEL absent. Aucun appel API, aucune écriture.");
    return;
  }
  const db = createAdminClient();
  const jour = jourAbidjan();
  const robotId = await compteRobot(CHATGPT_TIPSTER_EMAIL, CHATGPT_TIPSTER_PSEUDO);
  const session = await sessionRobot(CHATGPT_TIPSTER_EMAIL);
  const moi = clientAudit(session);
  await moi.rpc("ensure_profile", { p_pseudo: CHATGPT_TIPSTER_PSEUDO });
  const { data: perso } = await moi.from("sources").select("id").eq("type", "perso").eq("created_by", robotId).maybeSingle();
  if (!perso) throw new Error("Source personnelle du compte ChatGPT introuvable.");

  let { data: src } = await db.from("sources").select("id").eq("nom", TIPSTER_NOM).eq("created_by", ADMIN_ID).maybeSingle();
  if (!src && !ESSAI) {
    ({ data: src } = await db.from("sources").insert({
      type: "tipster", nom: TIPSTER_NOM, visibilite: "privee", created_by: ADMIN_ID,
      description: `Profil ChatGPT autonome, décisions par API sur le dossier BETWISE verrouillé. Bankroll virtuelle initiale : ${BANKROLL_DEPART.toLocaleString("fr-FR")} FCFA.`,
    }).select("id").single());
    await db.from("source_follows").upsert({ user_id: ADMIN_ID, source_id: src!.id });
  }

  const { data: bets } = await moi.from("bets").select("mise, gain_net, statut, virtuel").eq("virtuel", true);
  const etat = bilan(bets ?? []);
  const deja: DejaJoue = { matchs: new Set(), parProfil: { sur: 0, audacieux: 0, risque: 0 }, parFamille: {}, total: 0 };
  if (src) {
    const { data: predictions } = await db.from("predictions").select("match_id, market_code, risque_annonce, logged_at")
      .eq("source_id", src.id).neq("statut", "annule").gte("logged_at", new Date(Date.now() - 36 * 3600000).toISOString());
    for (const p of predictions ?? []) {
      if (p.match_id) deja.matchs.add(p.match_id);
      if (jourAbidjan(new Date(p.logged_at)) !== jour) continue;
      const cat = p.risque_annonce === "prudent" ? "sur" : p.risque_annonce === "moyen" ? "audacieux" : "risque";
      deja.parProfil[cat]++; deja.parFamille[familleOf(p.market_code)] = (deja.parFamille[familleOf(p.market_code)] ?? 0) + 1; deja.total++;
    }
  }

  const { data: ms } = await db.from("matches").select("id, kickoff_at, competition:competitions(code_externe), home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom)")
    .eq("statut", "programme").gte("kickoff_at", new Date(Date.now() + 20 * 60000).toISOString()).lte("kickoff_at", new Date(Date.now() + 8 * 3600000).toISOString()).limit(250);
  const info = new Map((ms ?? []).map((m) => [m.id, {
    kickoff: m.kickoff_at, comp: one(m.competition)?.code_externe ?? null,
    nom: `${one(m.home)?.nom ?? "?"} – ${one(m.away)?.nom ?? "?"}`,
  }]));
  const signals = await loadSignals(db as never, [...info.keys()], { bookmakers: true });
  const refAt = new Map<string, string>();
  const ids = [...info.keys()];
  for (let i = 0; i < ids.length; i += 20) {
    const { data } = await db.from("odds_observations").select("match_id, observed_at").eq("bookmaker", "ref:eu-median")
      .in("match_id", ids.slice(i, i + 20)).order("observed_at", { ascending: false }).limit(1000);
    for (const row of data ?? []) if (row.match_id && row.observed_at && !refAt.has(row.match_id)) refAt.set(row.match_id, row.observed_at);
  }

  const raw: Omit<CandidateApi, "candidateId">[] = [];
  let sansCote = 0, relevesEloignes = 0;
  for (const [matchId, signal] of signals) {
    if (signal.source !== "marche") continue;
    const m = info.get(matchId)!;
    for (const pk of picksOf(signal, "all")) {
      if (!pk.book || !pk.book.bookmaker.toLowerCase().replace(/\s/g, "").includes("1xbet") || !releveFrais(pk.book.releveAt, m.kickoff)) {
        sansCote++; continue;
      }
      const candidate: Candidat = {
        matchId, kickoff: m.kickoff, comp: m.comp, market: pk.market, param: pk.param, sel: pk.sel,
        p: pk.p, pModele: null, cote: pk.book.cote, coteRef: pk.cote,
        coteAt: pk.book.releveAt, refAt: refAt.get(matchId) ?? null,
      };
      if (!relevesComparables(candidate) || candidate.cote > 3.2 || candidate.cote <= 1 || !profilDe(candidate.p, candidate.cote)) {
        relevesEloignes++; continue;
      }
      raw.push({
        ...candidate, match: m.nom, bookmaker: pk.book.bookmaker,
        edgeMarche: candidate.p * candidate.cote - 1,
      });
    }
  }

  // Dossier borné et reproductible : classement mécanique par écart marché, puis match/market/selection.
  const ranked = raw.sort((a, b) => b.edgeMarche - a.edgeMarche || a.matchId.localeCompare(b.matchId) || a.market.localeCompare(b.market) || a.sel.localeCompare(b.sel)).slice(0, MAX_CANDIDATS);
  const candidates: CandidateApi[] = ranked.map((c, i) => ({ ...c, candidateId: `C${String(i + 1).padStart(3, "0")}` }));
  const decision = candidates.length ? await decide(candidates) : { picks: [], abstention_reason: "Aucun candidat avec cote 1xBet fraîche et relevé de référence comparable." };
  const byId = new Map(candidates.map((c) => [c.candidateId, c]));
  const modelPicks: { candidate: CandidateApi; probability: number; rationale: string }[] = [];
  const seen = new Set<string>();
  for (const pick of decision.picks) {
    const c = byId.get(pick.candidate_id);
    if (!c || seen.has(pick.candidate_id) || !Number.isFinite(pick.probability) || pick.probability < 0.01 || pick.probability > 0.99) continue;
    seen.add(pick.candidate_id);
    modelPicks.push({ candidate: c, probability: pick.probability, rationale: pick.rationale.slice(0, 600) });
  }
  const withModel: Candidat[] = modelPicks.map(({ candidate, probability }) => ({ ...candidate, pModele: probability }));
  const choices = choisir(withModel, deja);
  const pickByKey = new Map(modelPicks.map((p) => [`${p.candidate.matchId}| ${p.candidate.market}|${p.candidate.param ?? ""}|${p.candidate.sel}`, p]));
  const faits: Record<string, unknown>[] = [];
  let bankroll = etat.bankroll - etat.enJeu;
  for (const e of choices) {
    const key = `${e.matchId}| ${e.market}|${e.param ?? ""}|${e.sel}`;
    const modelPick = pickByKey.get(key);
    if (!modelPick) continue;
    const m = mise(etat.bankroll, e.kelly);
    if (m > bankroll) break;
    const ligne = {
      match: modelPick.candidate.match, comp: e.comp, kickoff: e.kickoff, market: e.market, param: e.param,
      sel: e.sel, cote: e.cote, probaMarche: e.p, probaChatGPT: modelPick.probability,
      valeur: Math.round(e.valeur * 1000) / 1000, profil: e.profil, mise: m,
      coteRelevee: e.coteAt, referenceRelevee: e.refAt, raison: modelPick.rationale,
    };
    faits.push(ligne);
    if (ESSAI) continue;
    const { error: e1 } = await db.from("predictions").insert({
      source_id: src!.id, match_id: e.matchId, market_code: e.market, market_param: e.param, selection: e.sel,
      cote_annoncee: e.cote, probabilite_annoncee: Math.round(e.pJuste * 10000) / 10000,
      risque_annonce: RISK[e.profil], published_at: new Date().toISOString(), submitted_by: robotId,
      dedupe_key: `chatgpt|${e.matchId}|${e.market}|${e.param ?? ""}|${e.sel}`,
    });
    if (e1 && !/duplicate/i.test(e1.message)) throw e1;
    if (e1) continue;
    const { error: e2 } = await moi.rpc("place_bet", {
      p_mise: m, p_virtuel: true, p_source_import: "manuel",
      p_raw_text: `[tipster ChatGPT] ${modelPick.rationale}. ${raison(e)}`,
      p_selections: [{ match_id: e.matchId, market_code: e.market, market_param: e.param, selection: e.sel, cote: e.cote, origin_source_id: perso.id }],
      p_summary: { bookmaker: "1xBet" },
    } as never);
    if (e2) throw e2;
    bankroll -= m;
  }

  const apres = bilan((await moi.from("bets").select("mise, gain_net, statut").eq("virtuel", true)).data ?? []);
  const fr = (x: number) => Math.round(x).toLocaleString("fr-FR");
  const resume = `Profil ChatGPT par API. Bankroll virtuelle : ${fr(apres.bankroll)} FCFA (départ ${fr(BANKROLL_DEPART)}), ${apres.regles} paris réglés dont ${apres.gagnes} gagnés${apres.roi === null ? "" : `, rendement ${(apres.roi * 100).toFixed(1).replace(".", ",")} %`}, ${fr(apres.enJeu)} FCFA en jeu. Mis à jour le ${new Date().toLocaleString("fr-FR", { timeZone: "Africa/Abidjan" })}.`;
  if (src && !ESSAI) await db.from("sources").update({ description: resume }).eq("id", src.id);
  const report = {
    quand: new Date().toISOString(), essai: ESSAI, profil: "ChatGPT", model: MODEL, promptVersion: "chatgpt-tipster-v1",
    jour, matchs: info.size, candidatsBruts: raw.length, candidatsTransmis: candidates.length,
    selectionsSansCote1xBet: sansCote, candidatsRelevesNonComparables: relevesEloignes,
    choixDuModele: modelPicks, abstention: decision.abstention_reason, choixEnregistres: faits,
    bilan: apres, resume, totalCandidatesDisponibles: ALL_CANDIDATES.length,
  };
  mkdirSync("rapports/tipster-chatgpt", { recursive: true });
  writeFileSync(`rapports/tipster-chatgpt/${new Date().toISOString().slice(0, 16).replace(":", "h")}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, choixEnregistres: faits.length }, null, 2));
}

main().catch((e) => { console.error(e instanceof Error ? e.message : JSON.stringify(e)); process.exit(1); });
