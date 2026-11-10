import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { fetchSeason, LEAGUE_CODES, previousSeason, seasonCode, type HistoryRow } from "./history";
import { fitRatings, predict, riskLevel, type HistMatch } from "./poisson";
import { buildTeamMap } from "./teams";

type Db = SupabaseClient<Database, "betwise">;
export const MODEL_VERSION = "poisson-v1";
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

/** 2) Estimations pour les matchs des 14 prochains jours + 3) prono « Modèle BETWISE ». */
export async function estimateCompetition(db: Db, comp: string, modelSourceId: string) {
  const ligue = LEAGUE_CODES[comp];
  if (!ligue) return { matches: 0, estimates: 0, pronos: 0, unmatched: [] as string[] };

  const since = new Date(Date.now() - 800 * 86400000).toISOString().slice(0, 10);
  const hist: HistoryRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("match_history").select("*").eq("ligue", ligue).gte("played_on", since).order("played_on").range(from, from + 999);
    if (error) throw error;
    hist.push(...(data as HistoryRow[]));
    if (!data || data.length < 1000) break;
  }
  if (hist.length < 100) return { matches: 0, estimates: 0, pronos: 0, unmatched: [`historique insuffisant (${hist.length} matchs)`] };

  const ratings = fitRatings(hist.map<HistMatch>((h) => ({ date: new Date(h.played_on), home: h.home_nom, away: h.away_nom, hg: h.home_goals, ag: h.away_goals })));

  const { data: c } = await db.from("competitions").select("id").eq("code_externe", comp).maybeSingle();
  if (!c) return { matches: 0, estimates: 0, pronos: 0, unmatched: [] };
  // Équipes qui jouent dans cette compétition (et pas teams.competition_id : un club de C1 y est rattaché à la C1)
  const { data: compMatches } = await db.from("matches").select("home_team_id, away_team_id").eq("competition_id", c.id)
    .gte("kickoff_at", new Date(Date.now() - 60 * 86400000).toISOString()).limit(1000);
  const teamIds = [...new Set((compMatches ?? []).flatMap((m) => [m.home_team_id, m.away_team_id]))];
  const { data: teams } = teamIds.length ? await db.from("teams").select("id, nom, alias").in("id", teamIds) : { data: [] as { id: string; nom: string; alias: string[] }[] };
  const histNames = [...ratings.teams.keys()];
  const map = buildTeamMap(histNames, teams ?? []);
  const byTeamId = new Map<string, string>();
  for (const [h, id] of map) if (id) byTeamId.set(id, h);

  const { data: matches } = await db.from("matches")
    .select("id, kickoff_at, home_team_id, away_team_id")
    .eq("competition_id", c.id).eq("statut", "programme")
    .gte("kickoff_at", new Date().toISOString()).lte("kickoff_at", new Date(Date.now() + 14 * 86400000).toISOString());

  const unmatched: string[] = [];
  let estimates = 0, pronos = 0;
  for (const m of matches ?? []) {
    const hn = byTeamId.get(m.home_team_id), an = byTeamId.get(m.away_team_id);
    if (!hn || !an) {
      const miss = [!hn && teams?.find((t) => t.id === m.home_team_id)?.nom, !an && teams?.find((t) => t.id === m.away_team_id)?.nom].filter(Boolean);
      unmatched.push(...(miss.length ? (miss as string[]) : [`match ${m.id}`]));
      continue;
    }
    const p = predict(ratings, hn, an);
    if (!p) continue;
    const hs = ratings.teams.get(hn)!, as = ratings.teams.get(an)!;

    const { data: odds } = await db.from("odds_observations").select("market_code, market_param, selection, cote, observed_at")
      .eq("match_id", m.id).eq("bookmaker", REF).order("observed_at", { ascending: false }).limit(20);
    const refOdd = (code: string, sel: string) => {
      const o = (odds ?? []).find((x) => x.market_code === code && x.selection === sel);
      return o ? Number(o.cote) : null;
    };

    const base = {
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
