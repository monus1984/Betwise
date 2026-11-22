/**
 * Tipster à règles fixes (témoin sans IA) : à chaque passage, regarde les matchs des 8 prochaines heures, choisit selon
 * src/lib/tipster-virtuel/strategie.ts, et enregistre chaque choix deux fois :
 *  - un prono dans la source privée de l'administrateur « Claude · tipster virtuel » (bilan par marché et par risque) ;
 *  - un pari test sur le compte d'audit (bankroll virtuelle de 100 000 FCFA, sans mouvement d'argent).
 * Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BETWISE_ADMIN_ID. Option --essai : rien n'est écrit.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { createAdminClient } from "../src/lib/supabase/admin";
import { loadSignals, picksOf, ALL_CANDIDATES, releveFrais } from "../src/lib/probs/signals";
import { jourAbidjan } from "../src/lib/coach/daily";
import { compteAudit, sessionAudit, clientAudit, AUDIT_PSEUDO } from "../src/lib/tipster-virtuel/compte";
import { TIPSTER_NOM, ANCIEN_NOM, BANKROLL_DEPART, bilan, choisir, mise, raison, relevesComparables, type Candidat, type DejaJoue } from "../src/lib/tipster-virtuel/strategie";
import { familleOf } from "../src/lib/probs/signals";

const ESSAI = process.argv.includes("--essai");
const ADMIN_ID = process.env.BETWISE_ADMIN_ID;
const RISK = { sur: "prudent", audacieux: "moyen", risque: "risque" } as const;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

async function main() {
  if (!ADMIN_ID) throw new Error("BETWISE_ADMIN_ID manquant");
  const db = createAdminClient();
  const jour = jourAbidjan();

  // 1. Compte d'audit, sa session et son profil
  const auditId = await compteAudit();
  const session = await sessionAudit();
  const moi = clientAudit(session);
  await moi.rpc("ensure_profile", { p_pseudo: AUDIT_PSEUDO });
  const { data: perso } = await moi.from("sources").select("id").eq("type", "perso").eq("created_by", auditId).maybeSingle();
  if (!perso) throw new Error("source perso du compte d'audit introuvable");

  // 2. Source privée de l'administrateur, suivie par lui
  // Renommage (22/11) : ce robot n'est pas Claude qui décide, c'est un jeu de règles fixes
  if (!ESSAI) await db.from("sources").update({ nom: TIPSTER_NOM }).eq("nom", ANCIEN_NOM).eq("created_by", ADMIN_ID);
  let { data: src } = await db.from("sources").select("id").eq("nom", TIPSTER_NOM).eq("created_by", ADMIN_ID).maybeSingle();
  if (!src && !ESSAI) {
    ({ data: src } = await db.from("sources").insert({
      type: "tipster", nom: TIPSTER_NOM, visibilite: "privee", created_by: ADMIN_ID,
      description: `Tipster à règles fixes (témoin sans IA). Paris simples sur cote 1xBet, seulement quand le prix dépasse la valeur juste. Bankroll virtuelle de départ : ${BANKROLL_DEPART.toLocaleString("fr-FR")} FCFA.`,
    }).select("id").single());
    await db.from("source_follows").upsert({ user_id: ADMIN_ID, source_id: src!.id });
  }

  // 3. Ce qui a déjà été joué aujourd'hui (jour d'Abidjan) et l'état de la bankroll
  const { data: paris } = await moi.from("bets").select("id, mise, gain_net, statut, placed_at, bet_selections(match_id, market_code)").eq("virtuel", true).order("placed_at");
  const etat = bilan(paris ?? []);
  const deja: DejaJoue = { matchs: new Set(), parProfil: { sur: 0, audacieux: 0, risque: 0 }, parFamille: {}, total: 0 };
  if (src) {
    const { data: pr } = await db.from("predictions").select("match_id, market_code, risque_annonce, logged_at").eq("source_id", src.id).neq("statut", "annule").gte("logged_at", new Date(Date.now() - 36 * 3600000).toISOString());
    for (const p of pr ?? []) {
      if (p.match_id) deja.matchs.add(p.match_id);
      if (jourAbidjan(new Date(p.logged_at)) !== jour) continue;
      const cat = p.risque_annonce === "prudent" ? "sur" : p.risque_annonce === "moyen" ? "audacieux" : "risque";
      deja.parProfil[cat]++; deja.parFamille[familleOf(p.market_code)] = (deja.parFamille[familleOf(p.market_code)] ?? 0) + 1; deja.total++;
    }
  }

  // 4. Candidats : matchs qui commencent dans 20 min à 8 h, cote 1xBet fraîche
  const { data: ms } = await db.from("matches").select("id, kickoff_at, competition:competitions(code_externe), home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom)")
    .eq("statut", "programme").gte("kickoff_at", new Date(Date.now() + 20 * 60000).toISOString()).lte("kickoff_at", new Date(Date.now() + 8 * 3600000).toISOString()).limit(300);
  const info = new Map((ms ?? []).map((m) => [m.id, { kickoff: m.kickoff_at, comp: one(m.competition)?.code_externe ?? null, nom: `${one(m.home)?.nom ?? "?"} – ${one(m.away)?.nom ?? "?"}` }]));
  const signals = await loadSignals(db as never, [...info.keys()], { bookmakers: true });
  // Heure du dernier relevé des cotes de référence, par match : les deux prix comparés doivent être contemporains
  const refAt = new Map<string, string>();
  const ids = [...info.keys()];
  for (let i = 0; i < ids.length; i += 20) {
    const { data } = await db.from("odds_observations").select("match_id, observed_at").eq("bookmaker", "ref:eu-median").in("match_id", ids.slice(i, i + 20)).order("observed_at", { ascending: false }).limit(1000);
    for (const r of data ?? []) if (r.match_id && r.observed_at && !refAt.has(r.match_id)) refAt.set(r.match_id, r.observed_at);
  }
  const cands: Candidat[] = [];
  let sansCote = 0, relevesEloignes = 0;
  for (const [matchId, sg] of signals) {
    if (sg.source !== "marche") continue;
    const m = info.get(matchId)!;
    for (const pk of picksOf(sg, "all")) {
      if (!pk.book || !releveFrais(pk.book.releveAt, m.kickoff)) { sansCote++; continue; }
      const cd: Candidat = { matchId, kickoff: m.kickoff, comp: m.comp, market: pk.market, param: pk.param, sel: pk.sel, p: pk.p, pModele: pk.pModele, cote: pk.book.cote, coteRef: pk.cote, coteAt: pk.book.releveAt, refAt: refAt.get(matchId) ?? null };
      if (!relevesComparables(cd)) relevesEloignes++;
      cands.push(cd);
    }
  }
  const choix = choisir(cands, deja);

  // 5. Enregistrement
  const faits: Record<string, unknown>[] = [];
  let bankroll = etat.bankroll - etat.enJeu;
  for (const e of choix) {
    const m = mise(etat.bankroll, e.kelly);
    if (m > bankroll) break; // jamais plus que ce qui reste
    const ligne = { match: info.get(e.matchId)?.nom, comp: e.comp, kickoff: e.kickoff, market: e.market, param: e.param, sel: e.sel, cote: e.cote, p: Math.round(e.p * 1000) / 1000, pModele: e.pModele === null ? null : Math.round(e.pModele * 1000) / 1000, valeur: Math.round(e.valeur * 1000) / 1000, profil: e.profil, mise: m, coteRelevee: e.coteAt, referenceRelevee: e.refAt, raison: raison(e) };
    faits.push(ligne);
    if (ESSAI) continue;
    const { error: e1 } = await db.from("predictions").insert({
      source_id: src!.id, match_id: e.matchId, market_code: e.market, market_param: e.param, selection: e.sel, cote_annoncee: e.cote,
      probabilite_annoncee: Math.round(e.pJuste * 10000) / 10000, risque_annonce: RISK[e.profil], published_at: new Date().toISOString(), submitted_by: auditId,
      dedupe_key: `claude|${e.matchId}|${e.market}|${e.param ?? ""}|${e.sel}`,
    });
    if (e1 && !/duplicate/i.test(e1.message)) throw e1;
    if (e1) continue; // déjà joué lors d'un passage précédent
    const { error: e2 } = await moi.rpc("place_bet", {
      p_mise: m, p_virtuel: true, p_source_import: "manuel", p_raw_text: `[tipster virtuel] ${ligne.raison}`,
      p_selections: [{ match_id: e.matchId, market_code: e.market, market_param: e.param, selection: e.sel, cote: e.cote, origin_source_id: perso.id }],
      p_summary: { bookmaker: "1xBet" },
    } as never);
    if (e2) throw e2;
    bankroll -= m;
  }

  // 6. Bilan dans la description de la source et rapport du passage
  const apres = bilan((await moi.from("bets").select("mise, gain_net, statut").eq("virtuel", true)).data ?? []);
  const fr = (x: number) => Math.round(x).toLocaleString("fr-FR");
  const resume = `Tipster à règles fixes (témoin sans IA). Paris simples sur cote 1xBet, seulement quand le prix dépasse la valeur juste. Bankroll virtuelle : ${fr(apres.bankroll)} FCFA (départ ${fr(BANKROLL_DEPART)}), ${apres.regles} paris réglés dont ${apres.gagnes} gagnés${apres.roi === null ? "" : `, rendement ${(apres.roi * 100).toFixed(1).replace(".", ",")} %`}, ${fr(apres.enJeu)} FCFA en jeu. Mis à jour le ${new Date().toLocaleString("fr-FR", { timeZone: "Africa/Abidjan" })}.`;
  if (src && !ESSAI) await db.from("sources").update({ description: resume }).eq("id", src.id);
  const rapport = { quand: new Date().toISOString(), essai: ESSAI, jour, matchs: info.size, avecCotes: signals.size, candidats: cands.length, selectionsSansCote1xBet: sansCote, relevesTropEloignes: relevesEloignes, dejaAujourdhui: deja.total, choix: faits, bilan: apres, resume, candidatsVus: ALL_CANDIDATES.length };
  mkdirSync("rapports/tipster-virtuel", { recursive: true });
  writeFileSync(`rapports/tipster-virtuel/${new Date().toISOString().slice(0, 16).replace(":", "h")}.json`, JSON.stringify(rapport, null, 2));
  console.log(JSON.stringify({ ...rapport, choix: faits.length }, null, 2));
}

main().catch((e) => { console.error(e instanceof Error ? e.message : JSON.stringify(e)); process.exit(1); });
