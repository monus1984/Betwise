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
      type P = { player: { name: string; number: number | null; pos: string | null } };
      type R = { team: { name: string }; formation: string | null; coach: { name: string | null } | null; startXI: P[]; substitutes: P[] };
      const l = await af<R>(`/fixtures/lineups?fixture=${fid}`);
      out.lineups = l.map((x) => ({ equipe: x.team.name, schema: x.formation, entraineur: x.coach?.name ?? null, titulaires: (x.startXI ?? []).map((p) => ({ nom: p.player.name, numero: p.player.number, poste: p.player.pos })), remplacants: (x.substitutes ?? []).map((p) => p.player.name) }));
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
