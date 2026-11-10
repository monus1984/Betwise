/**
 * Compétitions de sélections nationales via The Odds API (football-data.org gratuit ne les couvre pas).
 * - Calendrier : /events, gratuit.
 * - Résultats : /scores, 2 crédits par appel ; appelé seulement s'il y a un match terminé à récupérer.
 * Les équipes nationales sont partagées entre compétitions (code_externe nat:<nom anglais>).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import type { OddsApiClient } from "./client";

type Db = SupabaseClient<Database, "betwise">;

export const INTERNATIONAL: Record<string, { key: string; nom: string; pays: string; saison: string }> = {
  UNL: { key: "soccer_uefa_nations_league", nom: "Ligue des nations UEFA", pays: "Europe", saison: "2026-2027" },
};

export const NATION_FR: Record<string, string> = {
  Albania: "Albanie", Andorra: "Andorre", Armenia: "Arménie", Austria: "Autriche", Azerbaijan: "Azerbaïdjan", Belarus: "Biélorussie", Belgium: "Belgique",
  "Bosnia and Herzegovina": "Bosnie-Herzégovine", "Bosnia & Herzegovina": "Bosnie-Herzégovine", Bulgaria: "Bulgarie", Croatia: "Croatie", Cyprus: "Chypre",
  "Czech Republic": "Tchéquie", Czechia: "Tchéquie", Denmark: "Danemark", England: "Angleterre", Estonia: "Estonie", "Faroe Islands": "Îles Féroé",
  Finland: "Finlande", France: "France", Georgia: "Géorgie", Germany: "Allemagne", Gibraltar: "Gibraltar", Greece: "Grèce", Hungary: "Hongrie",
  Iceland: "Islande", Israel: "Israël", Italy: "Italie", Kazakhstan: "Kazakhstan", Kosovo: "Kosovo", Latvia: "Lettonie", Liechtenstein: "Liechtenstein",
  Lithuania: "Lituanie", Luxembourg: "Luxembourg", Malta: "Malte", Moldova: "Moldavie", Montenegro: "Monténégro", Netherlands: "Pays-Bas",
  "North Macedonia": "Macédoine du Nord", "Northern Ireland": "Irlande du Nord", Norway: "Norvège", Poland: "Pologne", Portugal: "Portugal",
  "Republic of Ireland": "Irlande", Ireland: "Irlande", Romania: "Roumanie", Russia: "Russie", "San Marino": "Saint-Marin", Scotland: "Écosse",
  Serbia: "Serbie", Slovakia: "Slovaquie", Slovenia: "Slovénie", Spain: "Espagne", Sweden: "Suède", Switzerland: "Suisse", Turkey: "Turquie",
  Türkiye: "Turquie", Ukraine: "Ukraine", Wales: "Pays de Galles",
  // Afrique, pour les compétitions à venir
  "Ivory Coast": "Côte d'Ivoire", "Cote d'Ivoire": "Côte d'Ivoire", Senegal: "Sénégal", Morocco: "Maroc", Algeria: "Algérie", Tunisia: "Tunisie", Egypt: "Égypte",
  Cameroon: "Cameroun", Nigeria: "Nigeria", Ghana: "Ghana", Mali: "Mali", "Burkina Faso": "Burkina Faso", Guinea: "Guinée", "South Africa": "Afrique du Sud",
};

type Ev = { id: string; commence_time: string; home_team: string; away_team: string };
type Score = Ev & { completed: boolean; scores: { name: string; score: string }[] | null };

async function ensureCompetition(db: Db, code: string) {
  const c = INTERNATIONAL[code];
  const { data, error } = await db.from("competitions")
    .upsert({ code_externe: code, nom: c.nom, pays: c.pays, saison: c.saison, couverte_auto: true }, { onConflict: "code_externe" })
    .select("id").single();
  if (error) throw error;
  return data.id;
}

/** Calendrier des 14 prochains jours (et matchs en cours) → teams + matches. Gratuit. */
export async function syncInternationalFixtures(db: Db, api: OddsApiClient, code: string) {
  const c = INTERNATIONAL[code];
  const events = await api.events(c.key);
  if (!events.length) return 0;
  const compId = await ensureCompetition(db, code);
  const horizon = Date.now() + 14 * 86400000;
  const evs = (events as Ev[]).filter((e) => Date.parse(e.commence_time) <= horizon);

  const names = [...new Set(evs.flatMap((e) => [e.home_team, e.away_team]))];
  const { data: teams, error: te } = await db.from("teams").upsert(names.map((n) => ({
    code_externe: `nat:${n}`, nom: NATION_FR[n] ?? n, alias: NATION_FR[n] && NATION_FR[n] !== n ? [n] : [], competition_id: null,
  })), { onConflict: "code_externe" }).select("id, code_externe");
  if (te) throw te;
  const tid = new Map(teams.map((t) => [t.code_externe!, t.id]));

  const rows = evs.map((e) => ({
    code_externe: `toa:${e.id}`, competition_id: compId,
    home_team_id: tid.get(`nat:${e.home_team}`)!, away_team_id: tid.get(`nat:${e.away_team}`)!,
    kickoff_at: e.commence_time, updated_at: new Date().toISOString(),
  }));
  // ne pas écraser le statut/score d'un match déjà réglé : upsert sur les seules colonnes de calendrier
  const { error } = await db.from("matches").upsert(rows, { onConflict: "code_externe" });
  if (error) throw error;
  return rows.length;
}

/** Résultats : un appel /scores seulement si un match de la compétition doit être terminé et n'a pas de score. */
export async function syncInternationalScores(db: Db, api: OddsApiClient, code: string) {
  const { data: comp } = await db.from("competitions").select("id").eq("code_externe", code).maybeSingle();
  if (!comp) return { called: false, updated: 0 };
  const now = Date.now();
  const { data: pending } = await db.from("matches").select("id, code_externe, kickoff_at")
    .eq("competition_id", comp.id).neq("statut", "termine").neq("statut", "annule")
    .lte("kickoff_at", new Date(now - 115 * 60000).toISOString())     // coup d'envoi il y a 1 h 55 au moins
    .gte("kickoff_at", new Date(now - 3 * 86400000 + 3600000).toISOString()); // /scores remonte 3 jours au plus
  if (!pending?.length) return { called: false, updated: 0 };

  const scores = (await api.scores(INTERNATIONAL[code].key, 3)) as Score[];
  let updated = 0;
  for (const s of scores) {
    if (!s.completed || !s.scores) continue;
    const m = pending.find((p) => p.code_externe === `toa:${s.id}`);
    if (!m) continue;
    const h = s.scores.find((x) => x.name === s.home_team)?.score, a = s.scores.find((x) => x.name === s.away_team)?.score;
    if (h === undefined || a === undefined) continue;
    const { error } = await db.from("matches").update({
      statut: "termine", score_home: Number(h), score_away: Number(a), source_resultat: "the-odds-api", result_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", m.id);
    if (error) throw error;
    updated++;
  }
  return { called: true, updated };
}
