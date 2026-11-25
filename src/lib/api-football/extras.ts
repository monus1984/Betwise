/**
 * Compositions, absents et statistiques d'un match, récupérés à la demande et gardés en base.
 * Règles de fraîcheur : absents toutes les 6 h avant le match ; compositions à partir d'1 h avant le coup
 * d'envoi (toutes les 5 min jusqu'à ce qu'elles sortent) ; statistiques une fois le match terminé.
 */
import { createAdminClient } from "../supabase/admin";
import { cleanKey } from "./client";
import type { Json } from "../supabase/database.types";

const BASE = "https://v3.football.api-sports.io";
export type Lineup = { equipe: string; schema: string | null; entraineur: string | null; titulaires: { nom: string; numero: number | null; poste: string | null }[]; remplacants: string[] };
export type Absent = { equipe: string; joueur: string; motif: string | null; type: string | null };
export type TeamStats = { equipe: string; xg: number | null; tirs: number | null; cadres: number | null; possession: string | null; corners: number | null; jaunes: number | null; rouges: number | null };
export type Extras = { lineups: Lineup[] | null; injuries: Absent[] | null; stats: TeamStats[] | null; disponible: boolean };

async function af<T>(path: string): Promise<T[]> {
  const r = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": cleanKey(process.env.API_FOOTBALL_KEY!) }, cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return ((await r.json()) as { response: T[] }).response ?? [];
}
type JoueurAf = { player: { name: string; number: number | null; pos: string | null } };
type LineupAf = { team: { name: string }; formation: string | null; coach: { name: string | null } | null; startXI: JoueurAf[]; substitutes: JoueurAf[] };
const versLineup = (x: LineupAf): Lineup => ({ equipe: x.team.name, schema: x.formation, entraineur: x.coach?.name ?? null, titulaires: (x.startXI ?? []).map((p) => ({ nom: p.player.name, numero: p.player.number, poste: p.player.pos })), remplacants: (x.substitutes ?? []).map((p) => p.player.name) });

/**
 * Compositions chargées d'avance (25/11) : pour les matchs qui commencent dans l'heure et n'en ont pas encore,
 * 20 matchs par requête (/fixtures?ids=…). Avant, elles n'arrivaient que si quelqu'un ouvrait la fiche à temps.
 */
export async function chargerCompos(now = new Date()): Promise<{ matchs: number; trouves: number; requetes: number }> {
  if (!process.env.API_FOOTBALL_KEY) return { matchs: 0, trouves: 0, requetes: 0 };
  const db = createAdminClient();
  const { data: ms } = await db.from("matches").select("id, af_fixture_id").not("af_fixture_id", "is", null).in("statut", ["programme", "en_cours"])
    .gte("kickoff_at", new Date(now.getTime() - 20 * 60000).toISOString()).lte("kickoff_at", new Date(now.getTime() + 70 * 60000).toISOString()).limit(400);
  const ids = (ms ?? []).map((x) => x.id);
  const { data: deja } = ids.length ? await db.from("match_extras").select("match_id, lineups").in("match_id", ids) : { data: [] };
  const ont = new Set((deja ?? []).filter((x) => Array.isArray(x.lineups) && x.lineups.length > 0).map((x) => x.match_id));
  const aFaire = (ms ?? []).filter((x) => !ont.has(x.id));
  const parFid = new Map(aFaire.map((x) => [Number(x.af_fixture_id), x.id]));
  let trouves = 0, requetes = 0;
  const fids = [...parFid.keys()];
  for (let i = 0; i < fids.length && requetes < 15; i += 20) {
    requetes++;
    try {
      const r = await af<{ fixture: { id: number }; lineups?: LineupAf[] }>(`/fixtures?ids=${fids.slice(i, i + 20).join("-")}`);
      const lignes = r.filter((f) => f.lineups?.length).map((f) => ({ match_id: parFid.get(f.fixture.id)!, lineups: f.lineups!.map(versLineup) as unknown as Json, lineups_at: new Date().toISOString() })).filter((x) => x.match_id);
      if (lignes.length) { await db.from("match_extras").upsert(lignes); trouves += lignes.length; }
    } catch (e) { console.error("compos", e instanceof Error ? e.message : e); }
  }
  return { matchs: aFaire.length, trouves, requetes };
}

const age = (iso: string | null) => (iso ? (Date.now() - Date.parse(iso)) / 60000 : Infinity);

export async function getExtras(m: { id: string; af_fixture_id: number | null; kickoff_at: string; statut: string }): Promise<Extras> {
  const db = createAdminClient();
  const { data: row } = await db.from("match_extras").select("*").eq("match_id", m.id).maybeSingle();
  const out: Extras = { lineups: (row?.lineups as Lineup[] | null) ?? null, injuries: (row?.injuries as Absent[] | null) ?? null, stats: (row?.stats as TeamStats[] | null) ?? null, disponible: !!m.af_fixture_id && !!process.env.API_FOOTBALL_KEY };
  if (!out.disponible) return out;
  const fid = m.af_fixture_id!;
  const minsToKick = (Date.parse(m.kickoff_at) - Date.now()) / 60000;
  const patch: Record<string, Json | string> = {};

  try {
    // Absents : utiles dans les 7 jours avant le match
    if (m.statut === "programme" && minsToKick < 7 * 1440 && age(row?.injuries_at ?? null) > 360) {
      type R = { player: { name: string; type: string | null; reason: string | null }; team: { name: string } };
      out.injuries = (await af<R>(`/injuries?fixture=${fid}`)).map((x) => ({ equipe: x.team.name, joueur: x.player.name, motif: x.player.reason, type: x.player.type }));
      patch.injuries = out.injuries as unknown as Json; patch.injuries_at = new Date().toISOString();
    }
    // Compositions : publiées environ une heure avant le coup d'envoi
    if (!out.lineups?.length && minsToKick < 75 && m.statut !== "annule" && age(row?.lineups_at ?? null) > 5) {
      out.lineups = (await af<LineupAf>(`/fixtures/lineups?fixture=${fid}`)).map(versLineup);
      patch.lineups = out.lineups as unknown as Json; patch.lineups_at = new Date().toISOString();
    }
    // Statistiques : pendant le match (toutes les 3 min) puis une dernière fois après la fin
    const finalStats = m.statut === "termine" && row?.stats_at && Date.parse(row.stats_at) > Date.parse(m.kickoff_at) + 150 * 60000;
    if ((m.statut === "en_cours" && age(row?.stats_at ?? null) > 3) || (m.statut === "termine" && !finalStats && age(row?.stats_at ?? null) > 30)) {
      type R = { team: { name: string }; statistics: { type: string; value: number | string | null }[] };
      const s = await af<R>(`/fixtures/statistics?fixture=${fid}`);
      const g = (x: R, k: string) => x.statistics.find((y) => y.type === k)?.value ?? null;
      const num = (v: number | string | null) => (v === null ? null : Number(v));
      out.stats = s.map((x) => ({ equipe: x.team.name, xg: num(g(x, "expected_goals")), tirs: num(g(x, "Total Shots")), cadres: num(g(x, "Shots on Goal")), possession: (g(x, "Ball Possession") as string | null) ?? null, corners: num(g(x, "Corner Kicks")), jaunes: num(g(x, "Yellow Cards")), rouges: num(g(x, "Red Cards")) }));
      patch.stats = out.stats as unknown as Json; patch.stats_at = new Date().toISOString();
    }
    if (Object.keys(patch).length) await db.from("match_extras").upsert({ match_id: m.id, ...patch });
  } catch (e) {
    console.error("extras", m.id, e instanceof Error ? e.message : e);
  }
  return out;
}

/** Une confrontation directe, gardée sous une forme compacte (identifiants API-Football des deux équipes). */
export type Confrontation = { date: string; h: number; a: number; sh: number; sa: number };

/**
 * Confrontations directes des deux équipes sur plusieurs saisons (23/11) : une requête API-Football par match,
 * gardée en base et rafraîchie au plus une fois par jour, seulement dans les 7 jours avant le match.
 */
export async function getConfrontations(m: { id: string; af_home_id: number | null; af_away_id: number | null; kickoff_at: string; statut: string }): Promise<Confrontation[] | null> {
  const db = createAdminClient();
  const { data: row } = await db.from("match_extras").select("h2h, h2h_at").eq("match_id", m.id).maybeSingle();
  const garde = (row?.h2h as Confrontation[] | null) ?? null;
  const minsToKick = (Date.parse(m.kickoff_at) - Date.now()) / 60000;
  if (!m.af_home_id || !m.af_away_id || !process.env.API_FOOTBALL_KEY || m.statut !== "programme" || minsToKick > 7 * 1440 || age(row?.h2h_at ?? null) < 1440) return garde;
  try {
    type R = { fixture: { date: string; status: { short: string } }; teams: { home: { id: number }; away: { id: number } }; goals: { home: number | null; away: number | null } };
    const l = await af<R>(`/fixtures/headtohead?h2h=${m.af_home_id}-${m.af_away_id}&last=10`);
    const h2h: Confrontation[] = l.filter((x) => ["FT", "AET", "PEN"].includes(x.fixture.status.short) && x.goals.home !== null && x.goals.away !== null)
      .map((x) => ({ date: x.fixture.date, h: x.teams.home.id, a: x.teams.away.id, sh: x.goals.home!, sa: x.goals.away! }))
      .sort((x, y) => Date.parse(y.date) - Date.parse(x.date));
    await db.from("match_extras").upsert({ match_id: m.id, h2h: h2h as unknown as Json, h2h_at: new Date().toISOString() }, { onConflict: "match_id" });
    return h2h;
  } catch { return garde; }
}
