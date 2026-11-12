/**
 * Fonctions du Coach. Chacune lit les données de l'utilisateur avec SES droits (RLS) et
 * renvoie des chiffres déjà calculés : le modèle de langage ne fait qu'expliquer.
 * Confidentialité : aucun nom, e-mail ni montant en devise. Mises en « unités »
 * (1 unité = mise médiane de l'utilisateur), bankroll en pourcentages.
 */
import type { createClient } from "../supabase/server";
import type { ChatTool } from "../llm/provider";
import { loadSignals, pickLabel, picksOf } from "../probs/signals";
import { analyzeTicket } from "../probs/ticket";
import { loadGoal } from "./goal";
import { evaluatePlan, misesDuJour } from "./plan";
import { loadToday } from "./today";
import { setObjectif } from "./actions";
import { CAT_LABEL, categorieOf } from "./categories";

type Db = Awaited<ReturnType<typeof createClient>>;
type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const r2 = (x: number) => Math.round(x * 100) / 100;
const pct = (x: number) => Math.round(x * 1000) / 10;
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const PERIODE = { type: "string", enum: ["7j", "30j", "90j", "tout"], description: "Fenêtre d'analyse sur la date du pari. Par défaut 30j." };
function since(p: unknown) {
  const d = p === "7j" ? 7 : p === "90j" ? 90 : p === "tout" ? null : 30;
  return d ? new Date(Date.now() - d * 86400000).toISOString() : null;
}

export const COACH_TOOLS: ChatTool[] = [
  { name: "mon_objectif", description: "Objectif actif de l'utilisateur (bankroll de départ, cible, échéance), sa progression, sa chance d'atteindre la cible à temps, le risque de chute, l'objectif raisonnable et les mises conseillées du jour par catégorie (Sûr, Audacieux, Risqué) avec le budget risque.", input_schema: { type: "object", properties: {} } },
  { name: "simuler_objectif", description: "Simule un objectif sans l'enregistrer, à partir du solde actuel : chance d'atteindre la cible dans le délai, risque de chute, mise nécessaire, et objectif raisonnable.", input_schema: { type: "object", properties: { cible: { type: "number", description: "Montant visé en F CFA" }, jours: { type: "number", description: "Délai en jours" } }, required: ["cible", "jours"] } },
  { name: "fixer_objectif", description: "Enregistre l'objectif (remplace l'actuel). À n'appeler que si l'utilisateur a clairement validé le montant et le délai.", input_schema: { type: "object", properties: { cible: { type: "number" }, jours: { type: "number" } }, required: ["cible", "jours"] } },
  { name: "coups_du_jour", description: "Les coups du jour BETWISE classés Sûr / Audacieux / Risqué (probabilité, cote, mise conseillée, gain possible), et les choix de l'utilisateur et de ses sources sur les matchs du jour, confrontés aux probabilités BETWISE et classés dans les mêmes catégories. À utiliser pour « quoi jouer aujourd'hui », « mes paris du jour », « que penses-tu du prono de X ».", input_schema: { type: "object", properties: {} } },
  { name: "selections_probables", description: "Les sélections les plus probables d'une journée, tous marchés confondus (victoire, double chance, plus/moins de buts, les deux marquent), au-dessus d'un seuil de probabilité. Donne pour chacune la probabilité (tirée des cotes du marché, sinon du modèle), la cote de référence ou la cote juste, et l'avis du modèle quand il existe. Donne aussi la probabilité d'un combiné des premières. À utiliser pour « les meilleurs paris du jour », « des paris fiables à 85 % », « quoi jouer demain ».", input_schema: { type: "object", properties: { jour: { type: "string", description: "« aujourdhui », « demain » ou une date AAAA-MM-JJ. Par défaut aujourdhui." }, seuil_pct: { type: "number", description: "Probabilité minimale en %, entre 50 et 95. Par défaut 80." }, max: { type: "number", description: "Nombre maximal de sélections, par défaut 8." } } } },
  { name: "bilan_paris", description: "Bilan des paris réglés de l'utilisateur sur une période : nombre, réussite, rendement (ROI), résultat en unités, cote moyenne, et détail selon un regroupement.", input_schema: { type: "object", properties: { periode: PERIODE, regroupement: { type: "string", enum: ["aucun", "type", "nb_selections", "risque", "bookmaker", "marche"], description: "Découpage du bilan. type = simple/combiné." } } } },
  { name: "bilan_par_origine", description: "Réussite des sélections selon leur origine (choix perso, tipster, page, modèle BETWISE…), comparée à la probabilité implicite des cotes jouées. Indique aussi combien de combinés ont été perdus à cause d'une seule sélection.", input_schema: { type: "object", properties: { periode: PERIODE } } },
  { name: "etat_bankroll", description: "État de la bankroll en pourcentages : évolution depuis le capital initial, exposition sur les paris en cours, séries, comportement de mise après une perte, respect des limites que l'utilisateur s'est fixées.", input_schema: { type: "object", properties: {} } },
  { name: "paris_en_cours", description: "Paris non réglés : sélections, matchs, cotes, probabilité implicite, et probabilité du modèle BETWISE quand elle existe (espérance estimée du ticket).", input_schema: { type: "object", properties: {} } },
  { name: "sources_suivies", description: "Sources de pronostics suivies par l'utilisateur avec leurs indicateurs (réussite, rendement, intervalle de confiance, statut d'évaluation).", input_schema: { type: "object", properties: {} } },
  { name: "detail_source", description: "Indicateurs détaillés d'une source par son nom (recherche approximative) : 4 périodes, détail par marché, compétition et niveau de risque.", input_schema: { type: "object", properties: { nom: { type: "string" } }, required: ["nom"] } },
  { name: "analyse_match", description: "Matchs à venir (10 jours) d'une équipe : probabilités du modèle BETWISE, cotes de référence européennes, nombre de pronos enregistrés par les sources suivies.", input_schema: { type: "object", properties: { equipe: { type: "string", description: "Nom ou partie du nom, ex. « Arsenal », « Real »." } }, required: ["equipe"] } },
];

type BetRow = {
  id: string; type: "simple" | "combine"; mise: number; cote_totale: number | null; statut: string; gain_net: number | null; placed_at: string; bookmaker: string | null;
  bet_selections: { market_code: string; market_param: number | null; selection: string; cote: number; resultat: string; risque_calcule: string | null; match_id: string | null; match_libre: string | null;
    origin: One<{ nom: string; type: string }>; match: One<{ kickoff_at: string; statut: string; home: One<{ nom: string }>; away: One<{ nom: string }>; competition: One<{ code_externe: string | null }> }> }[];
};
const BET_SELECT = "id, type, mise, cote_totale, statut, gain_net, placed_at, bookmaker, bet_selections(market_code, market_param, selection, cote, resultat, risque_calcule, match_id, match_libre, origin:sources!bet_selections_origin_source_id_fkey(nom, type), match:matches(kickoff_at, statut, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(code_externe)))";

const originName = (o: { nom: string; type: string } | null) => (!o ? "non renseignée" : o.type === "perso" ? "choix personnel" : o.type === "modele_betwise" ? "Modèle BETWISE" : o.nom);
const matchName = (s: BetRow["bet_selections"][number]) => { const m = one(s.match); return m ? `${one(m.home)?.nom} – ${one(m.away)?.nom}` : s.match_libre ?? "match non identifié"; };
const riskOf = (c: number) => (c < 1.5 ? "prudent" : c <= 2.2 ? "moyen" : "risqué");

async function allBets(db: Db, from: string | null) {
  let q = db.from("bets").select(BET_SELECT).order("placed_at", { ascending: true }).limit(2000);
  if (from) q = q.gte("placed_at", from);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BetRow[];
}
async function unit(db: Db) {
  const { data } = await db.from("bets").select("mise").neq("statut", "annule").limit(2000);
  return median((data ?? []).map((b) => Number(b.mise))) || 1;
}

function summarize(bets: BetRow[], u: number) {
  const settled = bets.filter((b) => ["gagne", "perdu", "rembourse"].includes(b.statut));
  const decided = settled.filter((b) => b.statut !== "rembourse");
  const mises = decided.reduce((s, b) => s + Number(b.mise), 0);
  const net = settled.reduce((s, b) => s + Number(b.gain_net ?? 0), 0);
  const won = decided.filter((b) => b.statut === "gagne").length;
  const odds = decided.map((b) => Number(b.cote_totale)).filter((c) => c > 1);
  return {
    paris_regles: settled.length, gagnes: won, perdus: decided.length - won, rembourses: settled.length - decided.length,
    taux_reussite_pct: decided.length ? pct(won / decided.length) : null,
    rendement_pct: mises ? pct(net / mises) : null,
    resultat_unites: r2(net / u),
    cote_moyenne: odds.length ? r2(odds.reduce((a, b) => a + b, 0) / odds.length) : null,
    reussite_attendue_a_ces_cotes_pct: odds.length ? pct(odds.reduce((a, c) => a + 1 / c, 0) / odds.length) : null,
    mise_moyenne_unites: decided.length ? r2(mises / decided.length / u) : null,
    echantillon: settled.length < 30 ? "trop petit pour conclure (moins de 30 paris)" : settled.length < 100 ? "indicatif" : "solide",
  };
}

export async function runCoachTool(db: Db, name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "mon_objectif":
    case "simuler_objectif":
    case "fixer_objectif":
    case "coups_du_jour": {
      const { data: s } = await db.from("my_bankroll_summary").select("solde").maybeSingle();
      const solde = Number(s?.solde ?? 0);
      const r0 = (x: number) => Math.round(x);
      const plan = (p: ReturnType<typeof evaluatePlan>) => ({
        croissance_requise_pct: pct(p.croissanceRequise), jours: p.jours,
        plan_pour_la_cible: { chance_pct: pct(p.objectif.pAtteindre), risque_chute_pct: pct(p.objectif.pChute), mise_par_pari_pct_bankroll: pct(p.objectif.mise), repartition: p.objectif.mix },
        plan_prudent: { chance_pct: pct(p.prudent.pAtteindre), risque_chute_pct: pct(p.prudent.pChute) },
        objectif_raisonnable: p.raisonnable ? { cible: p.raisonnable.cible, chance_pct: pct(p.raisonnable.plan.pAtteindre), risque_chute_pct: pct(p.raisonnable.plan.pChute), mise_pct: pct(p.raisonnable.plan.mise) } : "aucune cible au-dessus du solde n'atteint 50 % de chances avec moins de 20 % de risque",
        note: "« chute » = bankroll sous la moitié du départ ; marge bookmaker comptée",
      });
      if (name === "simuler_objectif") {
        if (solde <= 0) return { erreur: "pas de bankroll enregistrée : il faut un dépôt d'abord" };
        const cible = Number(input.cible), jours = Math.min(180, Math.max(1, Number(input.jours)));
        if (!(cible > solde)) return { erreur: `la cible doit dépasser le solde (${r0(solde)} F)` };
        return { solde: r0(solde), cible, ...plan(evaluatePlan({ bankroll: solde, depart: solde, cible, jours, parisParJour: 2 })) };
      }
      if (name === "fixer_objectif") {
        const r = await setObjectif({ cible: Number(input.cible), jours: Number(input.jours) });
        return r.ok ? { enregistre: true } : { erreur: r.error };
      }
      const { data: { user } } = await db.auth.getUser();
      const goal = await loadGoal(db, solde);
      const mises = goal ? goal.mises : solde > 0 ? misesDuJour(solde, solde) : null;
      if (name === "mon_objectif") {
        if (!goal) return { objectif: null, solde: r0(solde), mises_conseillees_F: mises, note: "aucun objectif : proposer d'en fixer un (montant + délai)" };
        return {
          solde: r0(solde), depart: goal.depart, cible: goal.cible, echeance: goal.echeance, jours_restants: goal.joursRestants,
          progression_pct: pct(goal.progression), temps_ecoule_pct: pct(goal.tempsEcoule), statut: goal.statut,
          ...(goal.plan ? plan(goal.plan) : {}),
          mises_conseillees_F: { sur: goal.mises.sur, audacieux: goal.mises.audacieux, risque: goal.mises.risque }, budget_risque_F: goal.mises.budgetRisque,
          regle_budget_risque: "Risqué uniquement avec 30 % des gains réalisés depuis le début de l'objectif",
        };
      }
      const t = await loadToday(db, user!.id);
      return {
        mises_conseillees_F: mises ? { sur: mises.sur, audacieux: mises.audacieux, risque: mises.risque } : "pas de bankroll enregistrée",
        coups_du_jour: t.picks.map((p) => ({ categorie: CAT_LABEL[p.categorie], selection: p.selection, match: p.match, heure: p.kickoff, probabilite_pct: pct(p.p), cote_reference: p.cote, cote_juste: r2(p.coteJuste), avis_modele_pct: p.pModele === null ? null : pct(p.pModele), soutenu_par: p.soutiens })),
        choix_utilisateur_et_sources: t.theirs.map((x) => ({ qui: x.qui, selection: x.selection, match: x.match, cote: x.cote, probabilite_betwise_pct: x.p === null ? null : pct(x.p), categorie: x.categorie ? CAT_LABEL[x.categorie] : null, verdict: x.verdict, aussi_coup_du_jour: x.aussiBetwise })),
        rien_de_solide: t.picks.length === 0,
      };
    }

    case "selections_probables": {
      const TZ = "Africa/Abidjan";
      const key = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
      const j = String(input.jour ?? "aujourdhui").toLowerCase();
      let day = /^\d{4}-\d{2}-\d{2}$/.test(j) ? j : key(new Date(Date.now() + (j.startsWith("dem") ? 86400000 : 0)));
      const seuil = Math.min(95, Math.max(50, Number(input.seuil_pct) || 80)) / 100;
      const max = Math.min(15, Math.max(1, Number(input.max) || 8));
      const { data: ms } = await db.from("matches")
        .select("id, kickoff_at, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(nom)")
        .eq("statut", "programme").gte("kickoff_at", new Date().toISOString()).lte("kickoff_at", new Date(Date.now() + 15 * 86400000).toISOString()).order("kickoff_at").limit(400);
      const all = ms ?? [];
      let rows = all.filter((m) => key(m.kickoff_at) === day);
      let note: string | null = null;
      if (!rows.length && all.length) { day = key(all[0].kickoff_at); rows = all.filter((m) => key(m.kickoff_at) === day); note = `aucun match le jour demandé ; prochaine journée avec des matchs : ${day}`; }
      const signals = await loadSignals(db, rows.map((m) => m.id));
      const sels = rows.flatMap((m) => {
        const sg = signals.get(m.id); if (!sg) return [];
        const h = one(m.home as One<{ nom: string }>)?.nom ?? "", a = one(m.away as One<{ nom: string }>)?.nom ?? "";
        const seen = new Set<string>();
        return picksOf(sg).filter((p) => p.p >= seuil && p.p <= 0.95 && !seen.has(p.market) && seen.add(p.market)).slice(0, 2).map((p) => ({
          match: `${h} – ${a}`, competition: one(m.competition as One<{ nom: string }>)?.nom, coup_envoi: m.kickoff_at,
          selection: pickLabel(p.market, p.param, p.sel, h, a), probabilite_pct: pct(p.p), categorie: (() => { const c = categorieOf(p.p); return c ? CAT_LABEL[c] : null; })(),
          cote_reference: p.cote, cote_juste: r2(1 / p.p), origine: sg.source === "modele" ? "modèle BETWISE (pas de cote disponible)" : "cotes du marché, marge retirée",
          avis_du_modele_pct: p.pModele !== null ? pct(p.pModele) : null, _p: p.p,
        }));
      }).sort((x, y) => y._p - x._p).slice(0, max);
      const comb = (n: number) => sels.length >= n ? pct(sels.slice(0, n).reduce((a, s) => a * s._p, 1)) : null;
      return {
        jour: day, seuil_pct: seuil * 100, matchs_ce_jour: rows.length, matchs_avec_chiffres: signals.size, note,
        selections: sels.map(({ _p, ...s }) => s),
        combine_des_3_premieres_pct: comb(3), combine_des_5_premieres_pct: comb(5),
        rappels: [
          "la probabilité vient des cotes du marché quand elles existent : c'est la meilleure estimation disponible",
          "une sélection n'est une bonne affaire que si le bookmaker de l'utilisateur propose PLUS que cote_juste ; à cote_juste ou moins, elle perd de l'argent sur la durée",
          "avis_du_modele_pct est un second avis : sur 1 954 matchs passés le modèle a été moins juste que le marché, et parier sur ses désaccords avec le marché aurait perdu 15 %",
        ],
      };
    }

    case "bilan_paris": {
      const [bets, u] = await Promise.all([allBets(db, since(input.periode)), unit(db)]);
      const g = (input.regroupement as string) ?? "aucun";
      const out: Record<string, unknown> = { periode: input.periode ?? "30j", unite: "1 unité = mise médiane de l'utilisateur", global: summarize(bets, u), en_cours: bets.filter((b) => b.statut === "en_cours").length };
      if (g !== "aucun") {
        const key = (b: BetRow) => g === "type" ? b.type
          : g === "nb_selections" ? (b.bet_selections.length <= 1 ? "1" : b.bet_selections.length <= 3 ? "2-3" : b.bet_selections.length <= 6 ? "4-6" : "7+")
          : g === "risque" ? riskOf(Number(b.cote_totale ?? 0))
          : g === "bookmaker" ? (b.bookmaker ?? "non renseigné")
          : [...new Set(b.bet_selections.map((s) => s.market_code))].join("+") || "inconnu";
        const groups = new Map<string, BetRow[]>();
        for (const b of bets) groups.set(key(b), [...(groups.get(key(b)) ?? []), b]);
        out.detail = Object.fromEntries([...groups].map(([k, v]) => [k, summarize(v, u)]));
      }
      return out;
    }

    case "bilan_par_origine": {
      const bets = await allBets(db, since(input.periode));
      const by = new Map<string, { n: number; w: number; implied: number; odds: number }>();
      let lostByOne = 0, combosLost = 0;
      for (const b of bets) {
        for (const s of b.bet_selections) {
          if (s.resultat !== "gagne" && s.resultat !== "perdu") continue;
          const k = originName(one(s.origin));
          const e = by.get(k) ?? { n: 0, w: 0, implied: 0, odds: 0 };
          e.n++; if (s.resultat === "gagne") e.w++; e.implied += 1 / Number(s.cote); e.odds += Number(s.cote);
          by.set(k, e);
        }
        if (b.type === "combine" && b.statut === "perdu") {
          combosLost++;
          if (b.bet_selections.filter((s) => s.resultat === "perdu").length === 1) lostByOne++;
        }
      }
      return {
        periode: input.periode ?? "30j",
        par_origine: Object.fromEntries([...by].map(([k, e]) => [k, {
          selections_reglees: e.n, gagnees: e.w, reussite_pct: pct(e.w / e.n), reussite_implicite_des_cotes_pct: pct(e.implied / e.n), cote_moyenne: r2(e.odds / e.n),
          lecture: e.n < 20 ? "trop peu de sélections pour conclure" : e.w / e.n > e.implied / e.n ? "au-dessus de ce que les cotes laissaient attendre" : "en dessous de ce que les cotes laissaient attendre",
        }])),
        combines_perdus: combosLost, combines_perdus_a_une_selection_pres: lostByOne,
      };
    }

    case "etat_bankroll": {
      const [{ data: sum }, { data: br }, { data: lim }, bets, u] = await Promise.all([
        db.from("my_bankroll_summary").select("solde, exposition, resultat_net").maybeSingle(),
        db.from("bankrolls").select("capital_initial").eq("active", true).maybeSingle(),
        db.from("user_limits").select("mise_max, perte_max_jour, perte_max_semaine, nb_paris_max_jour").order("valid_from", { ascending: false }).limit(1).maybeSingle(),
        allBets(db, null), unit(db),
      ]);
      const cap = Number(br?.capital_initial ?? 0), solde = Number(sum?.solde ?? 0), expo = Number(sum?.exposition ?? 0);
      const done = bets.filter((b) => b.statut === "gagne" || b.statut === "perdu");
      let streak = 0, streakType = "", worst = 0, cur = 0;
      for (const b of done) { if (b.statut === "perdu") { cur++; worst = Math.max(worst, cur); } else cur = 0; }
      for (let i = done.length - 1; i >= 0; i--) { if (!streakType) streakType = done[i].statut; if (done[i].statut !== streakType) break; streak++; }
      // mise après une perte vs après un gain : signal de « course aux pertes »
      const afterLoss: number[] = [], afterWin: number[] = [];
      for (let i = 1; i < bets.length; i++) {
        const prev = bets.slice(0, i).reverse().find((b) => (b.statut === "gagne" || b.statut === "perdu") && Date.parse(b.placed_at) < Date.parse(bets[i].placed_at));
        if (!prev) continue;
        (prev.statut === "perdu" ? afterLoss : afterWin).push(Number(bets[i].mise));
      }
      const today = new Date().toISOString().slice(0, 10);
      const todayBets = bets.filter((b) => b.placed_at.slice(0, 10) === today);
      const maxBet = bets.length ? Math.max(...bets.map((b) => Number(b.mise))) : 0;
      return {
        capital_initial_renseigne: cap > 0,
        evolution_depuis_capital_initial_pct: cap > 0 ? pct((solde - cap) / cap) : null,
        exposition_en_pct_du_solde: solde > 0 ? pct(expo / solde) : null,
        solde_positif: solde > 0,
        paris_en_cours: bets.filter((b) => b.statut === "en_cours").length,
        serie_actuelle: streak ? `${streak} ${streakType === "gagne" ? "gagné(s)" : "perdu(s)"} d'affilée` : "aucune",
        pire_serie_de_paris_perdus: worst,
        mise_moyenne_apres_une_perte_unites: afterLoss.length ? r2(afterLoss.reduce((a, b) => a + b, 0) / afterLoss.length / u) : null,
        mise_moyenne_apres_un_gain_unites: afterWin.length ? r2(afterWin.reduce((a, b) => a + b, 0) / afterWin.length / u) : null,
        plus_grosse_mise_unites: r2(maxBet / u),
        plus_grosse_mise_en_pct_du_solde: solde > 0 ? pct(maxBet / solde) : null,
        limites: lim ? {
          mise_max_unites: lim.mise_max ? r2(Number(lim.mise_max) / u) : null,
          depassements_mise_max: lim.mise_max ? bets.filter((b) => Number(b.mise) > Number(lim.mise_max)).length : null,
          nb_paris_max_jour: lim.nb_paris_max_jour, paris_aujourdhui: todayBets.length,
        } : "aucune limite fixée",
      };
    }

    case "paris_en_cours": {
      const { data, error } = await db.from("bets").select(BET_SELECT).eq("statut", "en_cours").order("placed_at", { ascending: false }).limit(30);
      if (error) throw new Error(error.message);
      const bets = (data ?? []) as unknown as BetRow[];
      const u = await unit(db);
      const ids = [...new Set(bets.flatMap((b) => b.bet_selections.map((s) => s.match_id)).filter(Boolean))] as string[];
      const signals = await loadSignals(db, ids);
      return bets.map((b) => {
        const an = analyzeTicket(b.bet_selections.map((s) => { const m = one(s.match); return { match_id: s.match_id, market_code: s.market_code, market_param: s.market_param, selection: s.selection, cote: Number(s.cote), home: one(m?.home ?? null)?.nom, away: one(m?.away ?? null)?.nom, libre: s.match_libre }; }), signals, Number(b.cote_totale));
        return {
          type: b.type, mise_unites: r2(Number(b.mise) / u), cote_obtenue: Number(b.cote_totale), place_le: b.placed_at,
          selections: b.bet_selections.map((s, i) => ({
            match: matchName(s), coup_envoi: one(s.match)?.kickoff_at ?? null, selection: an?.lignes[i].label, cote: Number(s.cote),
            probabilite_pct: an ? pct(an.lignes[i].p) : null, origine_probabilite: an ? { modele: "modèle BETWISE", marche: "cotes du marché", estime: "estimée (match non couvert)" }[an.lignes[i].origine] : null,
            origine_du_choix: originName(one(s.origin)), resultat: s.resultat,
          })),
          chances_de_passer_pct: an ? pct(an.pTicket) : null, cote_juste: an ? r2(an.coteJuste) : null, rendement_attendu_pct: an ? pct(an.esperance) : null,
          maillon_faible: an?.maillonFaible ? `${an.maillonFaible.label} (${an.maillonFaible.match})` : null,
          note: an?.memeMatch ? "des sélections portent sur le même match : indépendance approximative" : "probabilité du ticket = produit des sélections, supposées indépendantes",
        };
      });
    }

    case "sources_suivies": {
      const { data: f } = await db.from("source_follows").select("source_id, source:sources(nom, type)");
      const ids = (f ?? []).map((x) => x.source_id);
      if (!ids.length) return { sources: [], note: "aucune source suivie" };
      const [{ data: met }, { data: tr }] = await Promise.all([
        db.from("source_metrics").select("source_id, nb_declares, nb_verifies, nb_regles, taux_reussite, rendement, ic_bas, ic_haut, pire_serie, statut_eval").eq("periode", "total").in("source_id", ids),
        db.from("source_trend").select("source_id, nb_declares, nb_gagnes, nb_regles, dernier_prono").in("source_id", ids),
      ]);
      return (f ?? []).map((x) => {
        const s = one(x.source as One<{ nom: string; type: string }>); const m = met?.find((y) => y.source_id === x.source_id); const t = tr?.find((y) => y.source_id === x.source_id);
        return {
          nom: originName(s), type: s?.type, pronos_declares: t?.nb_declares ?? 0, pronos_regles: t?.nb_regles ?? 0, gagnes: t?.nb_gagnes ?? 0,
          verifies_avant_match: m?.nb_verifies ?? null, taux_reussite_pct: m?.taux_reussite !== null && m?.taux_reussite !== undefined ? pct(Number(m.taux_reussite)) : null,
          rendement_pct: m?.rendement !== null && m?.rendement !== undefined ? pct(Number(m.rendement)) : null,
          intervalle_confiance_90_pct: m?.ic_bas !== null && m?.ic_bas !== undefined ? [pct(Number(m.ic_bas)), pct(Number(m.ic_haut))] : null,
          pire_serie_unites: m?.pire_serie ?? null, statut_evaluation: m?.statut_eval ?? "tendance", dernier_prono: t?.dernier_prono ?? null,
        };
      });
    }

    case "detail_source": {
      const nom = String(input.nom ?? "").trim();
      const { data: srcs } = await db.from("sources").select("id, nom, type").ilike("nom", `%${nom}%`).neq("type", "perso").limit(5);
      if (!srcs?.length) return { trouve: false, note: `aucune source accessible ne correspond à « ${nom} »` };
      const s = srcs[0];
      const [{ data: met }, { data: axes }] = await Promise.all([
        db.from("source_metrics").select("periode, nb_declares, nb_verifies, nb_regles, taux_reussite, rendement, ic_bas, ic_haut, pire_serie, statut_eval").eq("source_id", s.id),
        db.from("source_metrics_by_axis").select("axe, valeur, nb_declares, nb_gagnes, rendement").eq("source_id", s.id).eq("periode", "total"),
      ]);
      return {
        nom: originName(s), autres_correspondances: srcs.slice(1).map((x) => x.nom),
        periodes: Object.fromEntries((met ?? []).map((m) => [m.periode, { declares: m.nb_declares, verifies: m.nb_verifies, regles: m.nb_regles, reussite_pct: m.taux_reussite !== null ? pct(Number(m.taux_reussite)) : null, rendement_pct: m.rendement !== null ? pct(Number(m.rendement)) : null, ic90_pct: m.ic_bas !== null ? [pct(Number(m.ic_bas)), pct(Number(m.ic_haut))] : null, pire_serie_unites: m.pire_serie, statut: m.statut_eval }])),
        detail_total: (axes ?? []).map((a) => ({ axe: a.axe, valeur: a.valeur, pronos: a.nb_declares, gagnes: a.nb_gagnes, rendement_pct: a.rendement !== null ? pct(Number(a.rendement)) : null })),
        note: "indicateurs recalculés chaque nuit ; IC absent sous 5 pronos réglés avec cote",
      };
    }

    case "analyse_match": {
      const q = String(input.equipe ?? "").trim();
      const { data: teams } = await db.from("teams").select("id, nom").ilike("nom", `%${q}%`).limit(5);
      if (!teams?.length) return { trouve: false, note: `aucune équipe ne correspond à « ${q} » dans les compétitions couvertes` };
      const ids = teams.map((t) => t.id);
      const { data: ms } = await db.from("matches")
        .select("id, kickoff_at, statut, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(nom)")
        .or(`home_team_id.in.(${ids.join(",")}),away_team_id.in.(${ids.join(",")})`)
        .gte("kickoff_at", new Date().toISOString()).lte("kickoff_at", new Date(Date.now() + 10 * 86400000).toISOString()).order("kickoff_at").limit(4);
      if (!ms?.length) return { trouve: true, equipes: teams.map((t) => t.nom), matchs: [], note: "aucun match programmé dans les 10 prochains jours" };
      const mids = ms.map((m) => m.id);
      const [{ data: est }, { data: odds }, { data: follows }] = await Promise.all([
        db.from("model_estimates").select("match_id, market_code, selection, probabilite, cote_reference, justification").in("match_id", mids),
        db.from("odds_observations").select("match_id, market_code, selection, cote, observed_at").in("match_id", mids).eq("bookmaker", "ref:eu-median").order("observed_at", { ascending: false }),
        db.from("source_follows").select("source_id"),
      ]);
      const fids = (follows ?? []).map((f) => f.source_id);
      const { data: preds } = fids.length ? await db.from("predictions").select("match_id, market_code, selection, source:sources(nom, type)").in("match_id", mids).in("source_id", fids).neq("statut", "annule") : { data: [] };
      return ms.map((m) => {
        const e = (est ?? []).filter((x) => x.match_id === m.id);
        const j = (e[0]?.justification ?? null) as { lambda_dom?: number; lambda_ext?: number; score_probable?: string } | null;
        const ref = (code: string, sel: string) => (odds ?? []).find((o) => o.match_id === m.id && o.market_code === code && o.selection === sel)?.cote ?? null;
        return {
          match: `${one(m.home as One<{ nom: string }>)?.nom} – ${one(m.away as One<{ nom: string }>)?.nom}`, competition: one(m.competition as One<{ nom: string }>)?.nom, coup_envoi: m.kickoff_at,
          modele: e.length ? {
            probabilites_pct: Object.fromEntries(e.map((x) => [`${x.market_code} ${x.selection}`, pct(Number(x.probabilite))])),
            buts_attendus: j ? [j.lambda_dom, j.lambda_ext] : null, score_le_plus_probable: j?.score_probable ?? null,
            precision: "modèle Poisson sur les buts uniquement ; un peu moins précis que les cotes du marché sur le passé",
          } : "pas d'estimation (match hors des 5 championnats ou trop lointain)",
          cotes_reference: { "1": ref("1X2", "1"), N: ref("1X2", "N"), "2": ref("1X2", "2"), "+2,5": ref("OU", "Plus"), "-2,5": ref("OU", "Moins") },
          pronos_des_sources_suivies: (preds ?? []).filter((p) => p.match_id === m.id).map((p) => `${originName(one(p.source as One<{ nom: string; type: string }>))} : ${p.market_code} ${p.selection}`),
        };
      });
    }
  }
  throw new Error(`fonction inconnue : ${name}`);
}
