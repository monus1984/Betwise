import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { FootballDataClient, type FdMatch } from "./client";

type Db = SupabaseClient<Database, "betwise">;
type MatchStatus = Database["betwise"]["Enums"]["match_status"];

/** Alias français courants pour le rapprochement des saisies libres. */
const FR_ALIASES: Record<string, string[]> = {
  "Manchester City FC": ["Man City", "City"],
  "Manchester United FC": ["Man United", "Man U", "MU"],
  "Paris Saint-Germain FC": ["PSG", "Paris"],
  "Olympique de Marseille": ["OM", "Marseille"],
  "Olympique Lyonnais": ["OL", "Lyon"],
  "FC Barcelona": ["Barça", "Barcelone", "Barcelona"],
  "Real Madrid CF": ["Real", "Real Madrid"],
  "Club Atlético de Madrid": ["Atlético", "Atletico Madrid"],
  "FC Bayern München": ["Bayern", "Bayern Munich"],
  "Borussia Dortmund": ["Dortmund", "BVB"],
  "FC Internazionale Milano": ["Inter", "Inter Milan"],
  "AC Milan": ["Milan", "Milan AC"],
  "Juventus FC": ["Juve", "Juventus"],
  "Tottenham Hotspur FC": ["Tottenham", "Spurs"],
  "Arsenal FC": ["Arsenal"],
  "Chelsea FC": ["Chelsea"],
  "Liverpool FC": ["Liverpool"],
  // Noms français ≠ noms officiels
  "1. FC Köln": ["Cologne", "Köln", "FC Cologne"],
  "Bayer 04 Leverkusen": ["Leverkusen", "Bayer Leverkusen"],
  "Borussia Mönchengladbach": ["Mönchengladbach", "Gladbach", "M'gladbach"],
  "Eintracht Frankfurt": ["Francfort", "Eintracht Francfort"],
  "1. FSV Mainz 05": ["Mayence", "Mainz"],
  "SC Freiburg": ["Fribourg", "Freiburg"],
  "VfB Stuttgart": ["Stuttgart"],
  "FC St. Pauli": ["St. Pauli", "Sankt Pauli"],
  "SSC Napoli": ["Naples", "Napoli"],
  "Genoa CFC": ["Gênes", "Genoa"],
  "Torino FC": ["Turin", "Torino"],
  "Como 1907": ["Côme", "Como"],
  "Hellas Verona FC": ["Vérone", "Verona", "Hellas Vérone"],
  "AS Roma": ["Roma", "AS Rome", "Rome"],
  "SS Lazio": ["Lazio", "Lazio Rome"],
  "ACF Fiorentina": ["Fiorentina", "Florence"],
  "Sevilla FC": ["Séville", "Sevilla", "FC Séville"],
  "Real Betis Balompié": ["Betis", "Real Betis", "Betis Séville"],
  "Athletic Club": ["Athletic Bilbao", "Bilbao"],
  "Real Sociedad de Fútbol": ["Real Sociedad", "Real Sociedad Saint-Sébastien"],
  "RC Celta de Vigo": ["Celta Vigo", "Celta"],
  "Deportivo Alavés": ["Alavés", "Alaves"],
  "Villarreal CF": ["Villarreal"],
  "Valencia CF": ["Valence", "Valencia"],
  "RCD Espanyol de Barcelona": ["Espanyol", "Espanyol Barcelone"],
  "RCD Mallorca": ["Majorque", "Mallorca"],
  "Elche CF": ["Elche"],
  "Getafe CF": ["Getafe"],
  "Girona FC": ["Gérone", "Girona"],
  "Levante UD": ["Levante"],
  "CA Osasuna": ["Osasuna"],
  "Rayo Vallecano de Madrid": ["Rayo Vallecano", "Rayo"],
  "Real Oviedo": ["Oviedo"],
  "Manchester United FC": ["Man United", "Manchester Utd", "Man Utd", "MU"],
  "Wolverhampton Wanderers FC": ["Wolves", "Wolverhampton"],
  "Newcastle United FC": ["Newcastle"],
  "West Ham United FC": ["West Ham"],
  "Nottingham Forest FC": ["Nottingham", "Forest"],
  "Brighton & Hove Albion FC": ["Brighton"],
  "AFC Bournemouth": ["Bournemouth"],
  "Leeds United FC": ["Leeds"],
  "Sunderland AFC": ["Sunderland"],
  "Ipswich Town FC": ["Ipswich"],
  "Crystal Palace FC": ["Crystal Palace", "Palace"],
  "Everton FC": ["Everton"],
  "Fulham FC": ["Fulham"],
  "Brentford FC": ["Brentford"],
  "Aston Villa FC": ["Aston Villa", "Villa"],
  "Burnley FC": ["Burnley"],
  "Stade Rennais FC 1901": ["Rennes", "Stade Rennais"],
  "Racing Club de Lens": ["Lens", "RC Lens"],
  "Lille OSC": ["Lille", "LOSC"],
  "OGC Nice": ["Nice"],
  "AS Monaco FC": ["Monaco"],
  "RC Strasbourg Alsace": ["Strasbourg"],
  "Stade Brestois 29": ["Brest"],
  "FC Nantes": ["Nantes"],
  "Toulouse FC": ["Toulouse"],
  "AJ Auxerre": ["Auxerre"],
  "Le Havre AC": ["Le Havre"],
  "Angers SCO": ["Angers"],
  "FC Lorient": ["Lorient"],
  "FC Metz": ["Metz"],
  "Paris FC": ["Paris FC"],
};

export function mapStatus(s: FdMatch["status"]): MatchStatus {
  switch (s) {
    case "FINISHED":
    case "AWARDED":
      return "termine";
    case "IN_PLAY":
    case "PAUSED":
      return "en_cours";
    case "POSTPONED":
    case "SUSPENDED":
      return "reporte";
    case "CANCELLED":
      return "annule";
    default:
      return "programme";
  }
}

export function seasonLabel(start: string, end: string) {
  const a = start.slice(0, 4), b = end.slice(2, 4);
  return a === end.slice(0, 4) ? a : `${a}-${b}`;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Synchronise une compétition : fenêtre [aujourd'hui − backDays ; aujourd'hui + aheadDays].
 * Idempotent : upsert sur code_externe. Retourne le nombre de matchs traités.
 */
export async function syncCompetition(db: Db, fd: FootballDataClient, code: string, backDays = 2, aheadDays = 7) {
  const comp = await fd.competition(code);
  const saison = seasonLabel(comp.currentSeason.startDate, comp.currentSeason.endDate);

  const { data: compRow, error: compErr } = await db
    .from("competitions")
    .upsert(
      { code_externe: comp.code, nom: comp.name, pays: comp.area.name, saison, couverte_auto: true },
      { onConflict: "code_externe" },
    )
    .select("id")
    .single();
  if (compErr) throw compErr;

  const from = new Date(); from.setUTCDate(from.getUTCDate() - backDays);
  const to = new Date(); to.setUTCDate(to.getUTCDate() + aheadDays);
  const { matches } = await fd.matches(code, iso(from), iso(to));
  if (matches.length === 0) return 0;

  // Équipes
  const teams = new Map<number, FdMatch["homeTeam"]>();
  for (const m of matches) { teams.set(m.homeTeam.id, m.homeTeam); teams.set(m.awayTeam.id, m.awayTeam); }
  const teamRows = [...teams.values()].map((t) => ({
    code_externe: `fd:${t.id}`,
    nom: t.name,
    alias: [t.shortName, t.tla, ...(FR_ALIASES[t.name] ?? [])].filter((x): x is string => !!x),
    competition_id: compRow.id,
  }));
  const { data: savedTeams, error: teamErr } = await db
    .from("teams")
    .upsert(teamRows, { onConflict: "code_externe" })
    .select("id, code_externe");
  if (teamErr) throw teamErr;
  const teamId = new Map(savedTeams.map((t) => [t.code_externe!, t.id]));

  // Matchs
  const now = new Date().toISOString();
  const matchRows = matches.map((m) => {
    const statut = mapStatus(m.status);
    return {
      code_externe: `fd:${m.id}`,
      competition_id: compRow.id,
      home_team_id: teamId.get(`fd:${m.homeTeam.id}`)!,
      away_team_id: teamId.get(`fd:${m.awayTeam.id}`)!,
      kickoff_at: m.utcDate,
      statut,
      score_home: statut === "termine" ? m.score.fullTime.home : null,
      score_away: statut === "termine" ? m.score.fullTime.away : null,
      source_resultat: statut === "termine" ? "football-data.org" : null,
      result_at: statut === "termine" ? now : null,
      updated_at: now,
    };
  });
  const { error: matchErr } = await db.from("matches").upsert(matchRows, { onConflict: "code_externe" });
  if (matchErr) throw matchErr;
  return matchRows.length;
}
