/**
 * Tipsters IA : à chaque passage, chaque tipster actif reçoit le même dossier (matchs des 10 prochaines heures, cotes
 * 1xBet relevées), l'analyse avec ses outils, et décide seul de ses paris et de ses mises. Le serveur valide puis
 * enregistre chaque pari deux fois : un prono dans la source privée de l'administrateur, un pari test sur le compte
 * robot du tipster (bankroll virtuelle, sans argent réel). Un tipster en échec n'empêche pas les autres de passer.
 * Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BETWISE_ADMIN_ID, API_FOOTBALL_KEY, et les clés des
 * profils (voir src/lib/tipsters-ia/profils.ts). Options : --essai (rien n'est écrit), --carnet (réécriture du carnet).
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createAdminClient } from "../src/lib/supabase/admin";
import { jourAbidjan } from "../src/lib/coach/daily";
import { categorieFromOdds, CAT_LABEL } from "../src/lib/coach/categories";
import { compteRobot, sessionRobot, clientAudit } from "../src/lib/tipster-virtuel/compte";
import { construireDossier, executerOutil, OUTILS, type Dossier } from "../src/lib/tipsters-ia/dossier";
import { lancerAgent } from "../src/lib/tipsters-ia/agent";
import { profilsActifs, PROMPT_VERSION, SYSTEME, type ProfilComplet } from "../src/lib/tipsters-ia/profils";
import { GARDE_FOUS, cleSel, valider } from "../src/lib/tipsters-ia/validation";
import { horizonHeures } from "../src/lib/tipsters-ia/horizon";

const ESSAI = process.argv.includes("--essai");
const FORCER_CARNET = process.argv.includes("--carnet");
const FORCER_PASSAGE = process.argv.includes("--forcer");
/** Carnet rendu entre guillemets avec des caractères codés (Grok, 23/11) : on le décode ; et on le garde court. */
function nettoyerCarnet(t: string): string {
  let x = t.trim();
  if (x.startsWith('"') && x.endsWith('"')) try { const y = JSON.parse(x); if (typeof y === "string") x = y.trim(); } catch { /* laissé tel quel */ }
  return x.length > 4000 ? `${x.slice(0, 4000).replace(/\s+\S*$/, "")}\n[carnet coupé : 4 000 caractères au plus]` : x;
}
const ADMIN_ID = process.env.BETWISE_ADMIN_ID;
const CARNETS = process.env.CARNETS_DIR || "carnets";
const RISK = { sur: "prudent", audacieux: "moyen", risque: "risque" } as const;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const fr = (x: number) => Math.round(x).toLocaleString("fr-FR");
const db = createAdminClient();

type Bet = { id: string; mise: number; gain_net: number | null; statut: string; placed_at: string; raw_text: string | null; cote_totale: number | null;
  bet_selections: { match_id: string | null; market_code: string; market_param: number | null; selection: string; cote: number; resultat: string; match: { home: { nom: string } | null; away: { nom: string } | null } | null }[] };

function lireCarnet(id: string): { texte: string; jour: string | null; version: string | null } {
  const f = `${CARNETS}/${id}.md`;
  if (!existsSync(f)) return { texte: "", jour: null, version: null };
  const t = readFileSync(f, "utf8"), m = t.match(/^<!-- jour: (\d{4}-\d{2}-\d{2})(?: version: ([\w-]+))? -->/);
  return { texte: t.replace(/^<!--.*?-->\n?/, ""), jour: m?.[1] ?? null, version: m?.[2] ?? null };
}

async function passage(p: ProfilComplet, d: Dossier, empreinte: string) {
  const jour = jourAbidjan();
  const robotId = await compteRobot(p.email, p.pseudo);
  const moi = clientAudit(await sessionRobot(p.email));
  await moi.rpc("ensure_profile", { p_pseudo: p.pseudo });
  const { data: perso } = await moi.from("sources").select("id").eq("type", "perso").eq("created_by", robotId).maybeSingle();
  if (!perso) throw new Error("source perso du compte robot introuvable");
  let { data: src } = await db.from("sources").select("id").eq("nom", p.source).eq("created_by", ADMIN_ID!).maybeSingle();
  if (!src && !ESSAI) {
    ({ data: src } = await db.from("sources").insert({ type: "tipster", nom: p.source, visibilite: "privee", created_by: ADMIN_ID!,
      description: `Tipster IA (${p.nom}) : analyse chaque jour les matchs et choisit seul ses paris et ses mises. Bankroll virtuelle de départ : ${fr(GARDE_FOUS.bankrollDepart)} FCFA.` }).select("id").single());
    await db.from("source_follows").upsert({ user_id: ADMIN_ID!, source_id: src!.id });
  }

  // État de la bankroll et historique du tipster
  const { data: bruts } = await moi.from("bets").select("id, mise, gain_net, statut, placed_at, raw_text, cote_totale, bet_selections(match_id, market_code, market_param, selection, cote, resultat, match:matches(home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom)))")
    .eq("virtuel", true).order("placed_at", { ascending: false }).limit(500);
  const paris = (bruts ?? []) as unknown as Bet[];
  const regles = paris.filter((b) => b.statut !== "en_cours" && b.statut !== "annule" && b.gain_net !== null);
  const net = regles.reduce((s, b) => s + Number(b.gain_net), 0);
  const bankroll = GARDE_FOUS.bankrollDepart + net;
  const enJeu = paris.filter((b) => b.statut === "en_cours").reduce((s, b) => s + Number(b.mise), 0);
  const duJour = paris.filter((b) => jourAbidjan(new Date(b.placed_at)) === jour);
  // Un simple par match : seuls les simples bloquent un match (un combiné peut reprendre un match joué en simple)
  const matchsJoues = new Set([...duJour, ...paris.filter((b) => b.statut === "en_cours")].filter((b) => b.bet_selections.length === 1).flatMap((b) => b.bet_selections.map((s) => s.match_id).filter(Boolean) as string[]));

  const historique = async () => {
    const parGroupe = (cle: (b: Bet) => string) => {
      const m = new Map<string, { paris: number; gagnes: number; mises: number; net: number }>();
      for (const b of regles) { const k = cle(b), g = m.get(k) ?? { paris: 0, gagnes: 0, mises: 0, net: 0 }; g.paris++; if (b.statut === "gagne") g.gagnes++; g.mises += Number(b.mise); g.net += Number(b.gain_net); m.set(k, g); }
      return Object.fromEntries([...m].map(([k, g]) => [k, { paris: g.paris, gagnes: g.gagnes, rendement_pct: g.mises ? Math.round((g.net / g.mises) * 1000) / 10 : null }]));
    };
    const niveau = (b: Bet) => { const c = categorieFromOdds(Number(b.cote_totale ?? 0)); return c ? CAT_LABEL[c] : "sous 1,10"; };
    return {
      bankroll_fcfa: Math.round(bankroll), depart_fcfa: GARDE_FOUS.bankrollDepart, en_jeu_fcfa: Math.round(enJeu), disponible_fcfa: Math.round(bankroll - enJeu),
      paris_aujourdhui: duJour.length, limite_par_jour: GARDE_FOUS.parJour,
      regles: regles.length, gagnes: regles.filter((b) => b.statut === "gagne").length,
      par_niveau: parGroupe(niveau), par_marche: parGroupe((b) => b.bet_selections[0]?.market_code ?? "?"),
      derniers: paris.slice(0, 40).map((b) => { const s = b.bet_selections[0]; return {
        quand: b.placed_at.slice(0, 16), match: s?.match ? `${s.match.home?.nom} – ${s.match.away?.nom}` : null, pari: s ? `${s.market_code}${s.market_param !== null ? ` ${s.market_param}` : ""} ${s.selection}` : null,
        cote: Number(b.cote_totale), mise: Number(b.mise), statut: b.statut, gain_net: b.gain_net === null ? null : Number(b.gain_net), raison: (b.raw_text ?? "").replace(/^\[tipster IA[^\]]*\]\s*/, "").slice(0, 300) }; }),
    };
  };

  const carnet = lireCarnet(p.id);
  // Nouvelle consigne (version) : le carnet est réécrit au passage suivant
  const ecrireCarnet = FORCER_CARNET || carnet.jour !== jour || carnet.version !== PROMPT_VERSION;
  // Passages de l'après-midi (23/11, Mounir et consensus du conseil d'IA : ne pas épuiser le crédit) : le matin voit
  // toute la journée ; l'après-midi, un tipster déjà passé aujourd'hui (carnet du jour écrit) n'est pas appelé.
  // Celui dont le passage du matin a échoué rattrape, avec moins de tours.
  const apresMidi = new Date().getUTCHours() >= 12;
  if (apresMidi && !ecrireCarnet && !FORCER_PASSAGE) {
    return { profil: p.id, nom: p.nom, modele: p.modele, promptVersion: PROMPT_VERSION, essai: ESSAI, dossier: empreinte, saute: `déjà passé aujourd'hui (${duJour.length} pari(s)) : pas d'appel (économie)`, tours: 0, jetons: null, retenus: [], combinesRetenus: [], rejets: [], enregistres: [] };
  }
  const profil = apresMidi ? { ...p, maxTours: Math.min(p.maxTours ?? 14, 6) } : p;
  const consigne = [
    `Passage du ${new Date().toLocaleString("fr-FR", { timeZone: "Africa/Abidjan", dateStyle: "full", timeStyle: "short" })} (heure d'Abidjan).`,
    `Bankroll : ${fr(bankroll)} FCFA (départ ${fr(GARDE_FOUS.bankrollDepart)}), ${fr(enJeu)} FCFA en jeu, ${duJour.length} pari(s) déjà joué(s) aujourd'hui sur ${GARDE_FOUS.parJour} au plus.`,
    `${d.matchs.length} match(s) dans ce passage.`,
    carnet.texte ? `Ton carnet actuel :\n---\n${carnet.texte.trim()}\n---` : "Tu n'as pas encore de carnet : c'est ton premier passage. Pose tes premières règles.",
    ecrireCarnet ? "Ce passage est le premier de la journée : regarde d'abord ton historique (mon_historique), puis réécris ton carnet en entier dans le champ carnet de ta décision." : "Tu peux compléter ton carnet si tu as appris quelque chose, sinon laisse le champ carnet vide.",
    duJour.length ? `Tu as déjà joué ${duJour.length} pari(s) aujourd'hui.` : "",
    carnet.version !== PROMPT_VERSION && carnet.texte ? "La consigne a changé : on ne te demande pas de battre la cote, il n'y a plus ni quota par niveau ni nombre minimum de paris, et tu peux proposer des combinés de 2 ou 3 sélections (cote totale jusqu'à 3). Si ton carnet contient un seuil de valeur (cote × probabilité), une répartition imposée entre niveaux ou un nombre de paris à atteindre, retire-le en le réécrivant." : "",
    apresMidi ? "Passage de l'après-midi : va à l'essentiel (compositions publiées, nouvelles absences, matchs du soir)." : "Passage du matin : tu vois tous les matchs de la journée.",
    "Analyse, choisis, puis rends ta décision avec l'outil decision.",
  ].filter(Boolean).join("\n\n");

  const debut = Date.now();
  const r = d.matchs.length || ecrireCarnet
    ? await lancerAgent(profil, SYSTEME, consigne, OUTILS, (nom, entree) => executerOutil(db as never, d, nom, entree, historique))
    : { decision: { paris: [], abstention: "aucun match avec cote 1xBet dans ce passage" }, modele: p.modele, tours: 0, traces: [], jetons: { entree: 0, sortie: 0, cacheLu: 0, cacheEcrit: 0 } };
  const simplesJoues = new Set([...duJour, ...paris.filter((b) => b.statut === "en_cours")].filter((b) => b.bet_selections.length === 1)
    .flatMap((b) => b.bet_selections.map((x) => cleSel({ matchId: x.match_id ?? "", market: x.market_code, param: x.market_param === null ? null : Number(x.market_param), sel: x.selection }))));
  const { retenus, rejets, combinesRetenus } = valider(r.decision?.paris ?? [], d.options, { bankroll, enJeu, parisDuJour: duJour.length, matchsJoues, simplesJoues }, Date.now(), r.decision?.combines ?? []);

  const enregistres: string[] = [];
  if (!ESSAI) for (const x of retenus) {
    const cat = categorieFromOdds(x.cote);
    const { error: e1 } = await db.from("predictions").insert({
      source_id: src!.id, match_id: x.matchId, market_code: x.market, market_param: x.param, selection: x.sel, cote_annoncee: x.cote,
      probabilite_annoncee: x.probabilite, risque_annonce: cat ? RISK[cat] : null, published_at: new Date().toISOString(), submitted_by: robotId,
      dedupe_key: `${p.id}|${x.matchId}|${x.market}|${x.param ?? ""}|${x.sel}`,
    });
    if (e1 && !/duplicate/i.test(e1.message)) throw e1;
    if (e1) continue;
    const { error: e2 } = await moi.rpc("place_bet", {
      p_mise: x.mise, p_virtuel: true, p_source_import: "manuel", p_raw_text: `[tipster IA ${p.nom}] ${x.raison}`,
      p_selections: [{ match_id: x.matchId, market_code: x.market, market_param: x.param, selection: x.sel, cote: x.cote, origin_source_id: perso.id }],
      p_summary: { bookmaker: "1xBet" },
    } as never);
    if (e2) throw e2;
    enregistres.push(x.id);
  }
  // Combinés : un ticket à plusieurs sélections dans la bankroll du robot (pas de « prédiction » de source : celles-ci restent des simples)
  if (!ESSAI) for (const c of combinesRetenus) {
    const { error } = await moi.rpc("place_bet", {
      p_mise: c.mise, p_virtuel: true, p_source_import: "manuel", p_raw_text: `[tipster IA ${p.nom}] Combiné : ${c.raison}`,
      p_selections: c.selections.map((x) => ({ match_id: x.matchId, market_code: x.market, market_param: x.param, selection: x.sel, cote: x.cote, origin_source_id: perso.id })),
      p_summary: { bookmaker: "1xBet", type: "combine" },
    } as never);
    if (error) throw error;
    enregistres.push(`combiné ${c.selections.map((x) => x.id).join("+")}`);
  }
  if (!ESSAI && r.decision?.carnet && r.decision.carnet.trim().length > 30) {
    mkdirSync(CARNETS, { recursive: true });
    writeFileSync(`${CARNETS}/${p.id}.md`, `<!-- jour: ${jour} version: ${PROMPT_VERSION} -->\n${nettoyerCarnet(r.decision.carnet)}\n`);
  }
  const apresNet = net, resume = `Tipster IA (${p.nom}, ${r.modele}). Bankroll virtuelle : ${fr(GARDE_FOUS.bankrollDepart + apresNet)} FCFA (départ ${fr(GARDE_FOUS.bankrollDepart)}), ${regles.length} paris réglés dont ${regles.filter((b) => b.statut === "gagne").length} gagnés. Mis à jour le ${new Date().toLocaleString("fr-FR", { timeZone: "Africa/Abidjan" })}.`;
  if (src && !ESSAI) await db.from("sources").update({ description: resume }).eq("id", src.id);

  return {
    profil: p.id, nom: p.nom, modele: r.modele, promptVersion: PROMPT_VERSION, essai: ESSAI, dossier: empreinte, duree_s: Math.round((Date.now() - debut) / 1000),
    tours: r.tours, outils: r.traces, jetons: r.jetons, erreur: r.erreur ?? null,
    bankroll, enJeu, propositions: r.decision?.paris ?? [], abstention: r.decision?.abstention ?? null, carnetReecrit: !!r.decision?.carnet,
    retenus: retenus.map((x) => ({ id: x.id, pari: x.label, cote: x.cote, mise: x.mise, probabilite: x.probabilite, raison: x.raison })),
    combinesRetenus: combinesRetenus.map((c) => ({ selections: c.selections.map((x) => `${x.id} ${x.label} @${x.cote}`), cote: c.cote, mise: c.mise, probabilite: c.probabilite, raison: c.raison })), rejets, enregistres,
  };
}

async function main() {
  if (!ADMIN_ID) throw new Error("BETWISE_ADMIN_ID manquant");
  const profils = profilsActifs();
  // Diagnostic sans valeur : seulement la présence des clés et variables
  const oui = (k: string) => (process.env[k] ? "oui" : "non");
  console.log(`Configuration : ANTHROPIC_API_KEY ${oui("ANTHROPIC_API_KEY")}, OPENROUTER_API_KEY ${oui("OPENROUTER_API_KEY")}, OPENROUTER_TIPSTER_MODELS ${oui("OPENROUTER_TIPSTER_MODELS")}, OPENAI_API_KEY ${oui("OPENAI_API_KEY")}, GEMINI_API_KEY ${oui("GEMINI_API_KEY")}.`);
  if (!profils.length) { console.log("Aucun tipster IA actif : aucune clé configurée. Aucun appel, aucune écriture."); return; }
  const d = await construireDossier(db as never, horizonHeures());
  const empreinte = createHash("sha256").update(JSON.stringify([...d.options.values()].map((o) => [o.id, o.matchId, o.market, o.param, o.sel, o.cote, o.releveAt]))).digest("hex").slice(0, 16);
  console.log(`Dossier ${empreinte} : ${d.matchs.length} match(s), ${d.options.size} option(s) 1xBet. Tipsters actifs : ${profils.map((p) => `${p.nom} (${p.modele})`).join(", ")}.`);
  const res = await Promise.allSettled(profils.map((p) => passage(p, d, empreinte)));
  const stamp = new Date().toISOString().slice(0, 16).replace(":", "h");
  mkdirSync("rapports/tipsters-ia", { recursive: true });
  let echecs = 0;
  res.forEach((x, i) => {
    const p = profils[i];
    const rapport = x.status === "fulfilled" ? x.value : { profil: p.id, nom: p.nom, essai: ESSAI, dossier: empreinte, erreur: x.reason instanceof Error ? x.reason.message : String(x.reason) };
    if (x.status === "rejected") echecs++;
    writeFileSync(`rapports/tipsters-ia/${stamp}-${p.id}.json`, JSON.stringify(rapport, null, 2));
    const r = rapport as { retenus?: unknown[]; combinesRetenus?: unknown[]; rejets?: unknown[]; jetons?: unknown; tours?: number; erreur?: string | null; abstention?: string | null; saute?: string };
    console.log(`[${p.nom}] ${r.erreur ? `ERREUR : ${r.erreur}` : r.saute ? `sauté — ${r.saute}` : `${r.retenus?.length ?? 0} simple(s) et ${r.combinesRetenus?.length ?? 0} combiné(s) retenu(s), ${r.rejets?.length ?? 0} rejeté(s), ${r.tours} tour(s), jetons ${JSON.stringify(r.jetons)}${r.abstention ? ` — ${r.abstention.slice(0, 200)}` : ""}`}`);
  });
  if (echecs === profils.length) process.exit(1);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
