/**
 * Compétitions servies par API-Football : calendrier, scores (90 minutes) et cotes de référence.
 * Les sélections nationales partagent les fiches déjà créées (code nat:<nom anglais>) ;
 * les clubs ont un code af:<id>. Les compétitions déjà couvertes par football-data.org
 * (5 championnats, Ligue des champions) n'y figurent pas, pour ne pas créer de doublons.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { NATION_FR } from "../odds-api/international";
import type { AfFixture, ApiFootball } from "./client";

type Db = SupabaseClient<Database, "betwise">;
type Status = Database["betwise"]["Enums"]["match_status"];

export const AF_COMPETITIONS: Record<string, { league: number; season: number; nom: string; pays: string; saison: string; nations: boolean }> = {
  CANQ: { league: 36, season: 2027, nom: "Éliminatoires CAN 2027", pays: "Afrique", saison: "2026-2027", nations: true },
  AMI: { league: 10, season: 2026, nom: "Matchs amicaux internationaux", pays: "Monde", saison: "2026", nations: true },
  CAFCL: { league: 12, season: 2026, nom: "Ligue des champions CAF", pays: "Afrique", saison: "2026-2027", nations: false },
  CAFCC: { league: 20, season: 2026, nom: "Coupe de la confédération CAF", pays: "Afrique", saison: "2026-2027", nations: false },
  CIV1: { league: 386, season: 2026, nom: "Ligue 1 Côte d'Ivoire", pays: "Côte d'Ivoire", saison: "2026-2027", nations: false },
};

// Noms API-Football → noms déjà utilisés pour les sélections (The Odds API)
const NATION_CANON: Record<string, string> = {
  "Türkiye": "Turkey", "Czechia": "Czech Republic", "Rep. Of Ireland": "Republic of Ireland", "Ireland": "Republic of Ireland",
  "Bosnia": "Bosnia & Herzegovina", "Bosnia and Herzegovina": "Bosnia & Herzegovina", "FYR Macedonia": "North Macedonia", "Macedonia": "North Macedonia",
  "Cote d'Ivoire": "Ivory Coast", "Côte d'Ivoire": "Ivory Coast", "USA": "United States", "Korea Republic": "South Korea", "Cape Verde Islands": "Cape Verde",
};
const NATION_FR_EXTRA: Record<string, string> = {
  "Cape Verde": "Cap-Vert", "DR Congo": "RD Congo", "Congo DR": "RD Congo", Congo: "Congo", Gabon: "Gabon", Togo: "Togo", Benin: "Bénin", Niger: "Niger", Chad: "Tchad",
  Mauritania: "Mauritanie", Gambia: "Gambie", "Guinea-Bissau": "Guinée-Bissau", "Sierra Leone": "Sierra Leone", Liberia: "Liberia", "Equatorial Guinea": "Guinée équatoriale",
  Angola: "Angola", Zambia: "Zambie", Zimbabwe: "Zimbabwe", Mozambique: "Mozambique", Madagascar: "Madagascar", Comoros: "Comores", Uganda: "Ouganda", Kenya: "Kenya",
  Tanzania: "Tanzanie", Ethiopia: "Éthiopie", Sudan: "Soudan", "South Sudan": "Soudan du Sud", Libya: "Libye", Rwanda: "Rwanda", Burundi: "Burundi", Namibia: "Namibie",
  Botswana: "Botswana", Malawi: "Malawi", Lesotho: "Lesotho", Eswatini: "Eswatini", "Central African Republic": "Centrafrique", Mauritius: "Maurice",
  Brazil: "Brésil", Argentina: "Argentine", "United States": "États-Unis", Mexico: "Mexique", Japan: "Japon", "South Korea": "Corée du Sud", "Saudi Arabia": "Arabie saoudite",
  Qatar: "Qatar", Iran: "Iran", Australia: "Australie", Canada: "Canada", Colombia: "Colombie", Uruguay: "Uruguay", Chile: "Chili", Peru: "Pérou", Ecuador: "Équateur",
  Paraguay: "Paraguay", China: "Chine", India: "Inde", "New Zealand": "Nouvelle-Zélande", Jordan: "Jordanie", Iraq: "Irak", "United Arab Emirates": "Émirats arabes unis",
};

function mapStatus(s: string): Status {
  if (["FT", "AET", "PEN"].includes(s)) return "termine";
  if (["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"].includes(s)) return "en_cours";
  if (s === "PST") return "reporte";
  if (["CANC", "ABD", "AWD", "WO"].includes(s)) return "annule";
  return "programme";
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Calendrier J-3 → J+14 et scores d'une compétition. Une requête. */
export async function syncAfCompetition(db: Db, api: ApiFootball, code: string) {
  const c = AF_COMPETITIONS[code];
  const fx = await api.fixtures(c.league, c.season, iso(new Date(Date.now() - 3 * 86400000)), iso(new Date(Date.now() + 14 * 86400000)));
  if (!fx.length) return { matches: 0, finished: 0 };

  const { data: comp, error: ce } = await db.from("competitions")
    .upsert({ code_externe: code, nom: c.nom, pays: c.pays, saison: c.saison, couverte_auto: true }, { onConflict: "code_externe" }).select("id").single();
  if (ce) throw ce;

  const teamRow = (t: { id: number; name: string }) => {
    if (!c.nations) return { code_externe: `af:${t.id}`, nom: t.name, alias: [] as string[], competition_id: comp.id as string | null };
    const en = NATION_CANON[t.name] ?? t.name;
    const fr = NATION_FR[en] ?? NATION_FR_EXTRA[en];
    return { code_externe: `nat:${en}`, nom: fr ?? en, alias: fr && fr !== en ? [en] : [], competition_id: null as string | null };
  };
  const uniq = new Map<string, ReturnType<typeof teamRow>>();
  for (const f of fx) for (const t of [f.teams.home, f.teams.away]) { const r = teamRow(t); uniq.set(r.code_externe, r); }
  const { data: teams, error: te } = await db.from("teams").upsert([...uniq.values()], { onConflict: "code_externe" }).select("id, code_externe");
  if (te) throw te;
  const tid = new Map(teams.map((t) => [t.code_externe!, t.id]));

  const now = new Date().toISOString();
  const rows = fx.map((f: AfFixture) => {
    const statut = mapStatus(f.fixture.status.short);
    const done = statut === "termine";
    return {
      code_externe: `af:${f.fixture.id}`, competition_id: comp.id,
      home_team_id: tid.get(teamRow(f.teams.home).code_externe)!, away_team_id: tid.get(teamRow(f.teams.away).code_externe)!,
      kickoff_at: f.fixture.date, statut,
      // score à la fin du temps réglementaire : c'est lui qui règle les paris
      score_home: done ? f.score.fulltime.home ?? f.goals.home : statut === "en_cours" ? f.goals.home : null,
      score_away: done ? f.score.fulltime.away ?? f.goals.away : statut === "en_cours" ? f.goals.away : null,
      source_resultat: done ? "api-football" : null, result_at: done ? now : null, updated_at: now,
    };
  });
  const { error } = await db.from("matches").upsert(rows, { onConflict: "code_externe" });
  if (error) throw error;
  return { matches: rows.length, finished: rows.filter((r) => r.statut === "termine").length };
}

const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Cotes de référence (médiane des bookmakers) : 1X2 et plus/moins 2,5 des matchs à venir. */
export async function syncAfOdds(db: Db, api: ApiFootball, code: string) {
  const c = AF_COMPETITIONS[code];
  const { data: comp } = await db.from("competitions").select("id").eq("code_externe", code).maybeSingle();
  if (!comp) return { rows: 0, matches: 0 };
  const { data: ms } = await db.from("matches").select("id, code_externe").eq("competition_id", comp.id).eq("statut", "programme").gte("kickoff_at", new Date().toISOString());
  if (!ms?.length) return { rows: 0, matches: 0 };
  const byCode = new Map(ms.map((m) => [m.code_externe!, m.id]));
  const odds = await api.odds(c.league, c.season);
  const observedAt = new Date().toISOString();
  const rows: Database["betwise"]["Tables"]["odds_observations"]["Insert"][] = [];
  let matched = 0;
  for (const o of odds) {
    const id = byCode.get(`af:${o.fixture.id}`);
    if (!id) continue;
    matched++;
    const acc: Record<string, number[]> = { "1": [], N: [], "2": [], Plus: [], Moins: [] };
    for (const b of o.bookmakers) for (const bet of b.bets) {
      if (bet.name === "Match Winner") for (const v of bet.values) { const k = v.value === "Home" ? "1" : v.value === "Draw" ? "N" : v.value === "Away" ? "2" : null; if (k) acc[k].push(Number(v.odd)); }
      if (bet.name === "Goals Over/Under") for (const v of bet.values) { if (v.value === "Over 2.5") acc.Plus.push(Number(v.odd)); if (v.value === "Under 2.5") acc.Moins.push(Number(v.odd)); }
    }
    for (const sel of ["1", "N", "2"]) { const m = median(acc[sel]); if (m) rows.push({ match_id: id, market_code: "1X2", selection: sel, cote: Math.round(m * 1000) / 1000, bookmaker: "ref:eu-median", origine: "api", observed_at: observedAt }); }
    for (const sel of ["Plus", "Moins"]) { const m = median(acc[sel]); if (m) rows.push({ match_id: id, market_code: "OU", market_param: 2.5, selection: sel, cote: Math.round(m * 1000) / 1000, bookmaker: "ref:eu-median", origine: "api", observed_at: observedAt }); }
  }
  if (rows.length) { const { error } = await db.from("odds_observations").insert(rows); if (error) throw error; }
  return { rows: rows.length, matches: matched };
}
