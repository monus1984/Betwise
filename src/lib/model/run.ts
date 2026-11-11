import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { fetchSeason, LEAGUE_CODES, previousSeason, seasonCode } from "./history";
import { fitRatings, predict, riskLevel, type HistMatch } from "./poisson";
import { AF_LINKED } from "../api-football/sync";

type Db = SupabaseClient<Database, "betwise">;
export { MODEL_VERSION } from "./version";
import { MODEL_VERSION } from "./version";
const REF = "ref:eu-median";

/** 1) Historique : saison en cours + deux précédentes, upsert idempotent. */
export async function importHistory(db: Db, comp: string) {
  const ligue = LEAGUE_CODES[comp];
  if (!ligue) return 0;
  const cur = seasonCode();
  let n = 0;
  for (const s of [previousSeason(previousSeason(cur)), previousSeason(cur), cur]) {
    const rows = await fetchSeason(ligue, s);
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from("match_history").upsert(rows.slice(i, i + 500), { onConflict: "ligue,played_on,home_nom,away_nom" });
      if (error) throw error;
    }
    n += rows.length;
  }
  return n;
}

/** Réglages retenus sur backtest (1 954 matchs, oct. 2025 → nov. 2026) : voir poisson.ts. */
export const MODEL_OPTS = { xgWeight: 0.7, stretch: 1.25, halfLifeDays: 365, priorMatches: 6 };

/** 2) Estimations pour les matchs des 14 prochains jours + 3) prono « Modèle BETWISE ». Historique : af_history (résultats + xG). */
export async function estimateCompetition(db: Db, comp: string, modelSourceId: string) {
  const league = AF_LINKED[comp]?.league;
  if (!league || !LEAGUE_CODES[comp]) return { matches: 0, estimates: 0, pronos: 0, unmatched: [] as string[] };

  type H = { played_on: string; home_nom: string; away_nom: string; home_goals: number; away_goals: number; hid: string; aid: string; xh: number | null; xa: number | null };
  const since = new Date(Date.now() - 800 * 86400000).toISOString();
  const hist: H[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("af_history").select("played_at, home_id, home_nom, away_id, away_nom, home_goals, away_goals, xg_home, xg_away").eq("league", league).gte("played_at", since).order("played_at").range(from, from + 999);
    if (error) throw error;
    hist.push(...(data ?? []).map((r) => ({ played_on: r.played_at.slice(0, 10), home_nom: r.home_nom, away_nom: r.away_nom, home_goals: r.home_goals, away_goals: r.away_goals, hid: String(r.home_id), aid: String(r.away_id), xh: r.xg_home === null ? null : Number(r.xg_home), xa: r.xg_away === null ? null : Number(r.xg_away) })));
    if (!data || data.length < 1000) break;
  }
  if (hist.length < 100) return { matches: 0, estimates: 0, pronos: 0, unmatched: [`historique insuffisant (${hist.length} matchs)`] };

  const ratings = fitRatings(hist.map<HistMatch>((h) => ({ date: new Date(h.played_on), home: h.hid, away: h.aid, hg: h.home_goals, ag: h.away_goals, xh: h.xh, xa: h.xa })), new Date(), MODEL_OPTS);

  const { data: c } = await db.from("competitions").select("id").eq("code_externe", comp).maybeSingle();
  if (!c) return { matches: 0, estimates: 0, pronos: 0, unmatched: [] };
  const { data: matches } = await db.from("matches")
    .select("id, kickoff_at, af_home_id, af_away_id")
    .eq("competition_id", c.id).eq("statut", "programme")
    .gte("kickoff_at", new Date().toISOString()).lte("kickoff_at", new Date(Date.now() + 14 * 86400000).toISOString());

  const unmatched: string[] = [];
  let estimates = 0, pronos = 0;
  for (const m of matches ?? []) {
    const hn = m.af_home_id ? String(m.af_home_id) : null, an = m.af_away_id ? String(m.af_away_id) : null;
    const p = hn && an ? predict(ratings, hn, an) : null;
    if (!hn || !an || !p) { unmatched.push(`match ${m.id}`); continue; }
    const hs = ratings.teams.get(hn)!, as = ratings.teams.get(an)!;

    const { data: odds } = await db.from("odds_observations").select("market_code, market_param, selection, cote, observed_at")
      .eq("match_id", m.id).eq("bookmaker", REF).order("observed_at", { ascending: false }).limit(20);
    const refOdd = (code: string, sel: string) => {
      const o = (odds ?? []).find((x) => x.market_code === code && x.selection === sel);
      return o ? Number(o.cote) : null;
    };

    // Forme (5 derniers matchs) et face-à-face (5 dernières confrontations), depuis l'historique
    const played = (n: string) => hist.filter((h) => h.hid === n || h.aid === n).slice(-5).reverse().map((h) => {
      const home = h.hid === n, gf = home ? h.home_goals : h.away_goals, ga = home ? h.away_goals : h.home_goals;
      return { date: h.played_on, adv: home ? h.away_nom : h.home_nom, lieu: home ? "D" : "E", score: `${gf}-${ga}`, r: gf > ga ? "V" : gf === ga ? "N" : "D", xg: h.xh !== null && h.xa !== null ? `${(home ? h.xh : h.xa).toFixed(1)}-${(home ? h.xa : h.xh).toFixed(1)}` : null };
    });
    const h2h = hist.filter((h) => (h.hid === hn && h.aid === an) || (h.hid === an && h.aid === hn)).slice(-5).reverse()
      .map((h) => ({ date: h.played_on, dom: h.hid === hn ? "home" : "away", score: `${h.home_goals}-${h.away_goals}` }));

    const base = {
      forme_dom: played(hn), forme_ext: played(an), h2h,
      lambda_dom: round(p.lambdaHome, 2), lambda_ext: round(p.lambdaAway, 2), score_probable: p.topScore,
      attaque_dom: round(hs.att, 2), defense_dom: round(hs.def, 2), attaque_ext: round(as.att, 2), defense_ext: round(as.def, 2),
      matchs_historique_dom: Math.round(hs.n), matchs_historique_ext: Math.round(as.n),
    };
    const rows = [
      { market_code: "1X2", market_param: null as number | null, selection: "1", probabilite: p.p1, cote_reference: refOdd("1X2", "1") },
      { market_code: "1X2", market_param: null, selection: "N", probabilite: p.pN, cote_reference: refOdd("1X2", "N") },
      { market_code: "1X2", market_param: null, selection: "2", probabilite: p.p2, cote_reference: refOdd("1X2", "2") },
      { market_code: "OU", market_param: 2.5, selection: "Plus", probabilite: p.pPlus25, cote_reference: refOdd("OU", "Plus") },
      { market_code: "OU", market_param: 2.5, selection: "Moins", probabilite: p.pMoins25, cote_reference: refOdd("OU", "Moins") },
      { market_code: "BTTS", market_param: null, selection: "Oui", probabilite: p.pBttsOui, cote_reference: null },
      { market_code: "BTTS", market_param: null, selection: "Non", probabilite: p.pBttsNon, cote_reference: null },
    ].map((r) => ({
      match_id: m.id, ...r, probabilite: round(r.probabilite, 4), niveau_risque: riskLevel(r.probabilite),
      justification: { ...base, ecart_marche: r.cote_reference ? round(r.probabilite * r.cote_reference - 1, 4) : null },
      model_version: MODEL_VERSION, updated_at: new Date().toISOString(),
    }));

    // upsert manuel : l'index unique porte sur coalesce(market_param, 0), que PostgREST ne sait pas cibler
    for (const r of rows) {
      let q = db.from("model_estimates").select("id").eq("match_id", m.id).eq("market_code", r.market_code).eq("selection", r.selection).eq("model_version", MODEL_VERSION);
      q = r.market_param === null ? q.is("market_param", null) : q.eq("market_param", r.market_param);
      const { data: ex } = await q.maybeSingle();
      const { error } = ex ? await db.from("model_estimates").update(r).eq("id", ex.id) : await db.from("model_estimates").insert(r);
      if (error) throw error;
      estimates++;
    }

    // Prono « Modèle BETWISE » : l'issue la plus probable de chaque marché (1X2, +/− 2,5), une seule fois par match,
    // enregistrée au plus tard la veille → statut « vérifié ». Pas une recommandation : c'est ce qui permet de noter le modèle.
    const hoursToKick = (Date.parse(m.kickoff_at) - Date.now()) / 3600000;
    if (hoursToKick > 48 || hoursToKick < 1) continue;
    for (const market of ["1X2", "OU"]) {
      const { data: already } = await db.from("predictions").select("id").eq("source_id", modelSourceId).eq("match_id", m.id).eq("market_code", market).neq("statut", "annule").limit(1);
      if (already?.length) continue;
      const pick = rows.filter((r) => r.market_code === market).sort((a, b) => b.probabilite - a.probabilite)[0];
      const { data: pr, error } = await db.from("predictions").insert({
        source_id: modelSourceId, match_id: m.id, market_code: market, market_param: pick.market_param, selection: pick.selection,
        cote_annoncee: pick.cote_reference, probabilite_annoncee: pick.probabilite, published_at: new Date().toISOString(),
      }).select("id").single();
      if (error) { if (!/duplicate/i.test(error.message)) throw error; continue; }
      let q = db.from("model_estimates").update({ prediction_id: pr.id }).eq("match_id", m.id).eq("market_code", market).eq("selection", pick.selection).eq("model_version", MODEL_VERSION);
      q = pick.market_param === null ? q.is("market_param", null) : q.eq("market_param", pick.market_param);
      await q;
      pronos++;
    }
  }
  return { matches: matches?.length ?? 0, estimates, pronos, unmatched: [...new Set(unmatched)] };
}

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;
