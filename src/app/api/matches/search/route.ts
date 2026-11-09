import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Recherche de matchs pour l'autocomplétion : nom ou alias d'équipe, fenêtre J-2 → J+10.
 * Retourne au plus 8 résultats, les plus proches dans le temps d'abord.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ matches: [] });

  const supabase = await createClient();
  const from = new Date(Date.now() - 2 * 86400000).toISOString();
  const to = new Date(Date.now() + 10 * 86400000).toISOString();

  // Équipes dont le nom ou un alias contient la saisie (insensible à la casse)
  const { data: teams } = await supabase
    .from("teams")
    .select("id")
    .or(`nom.ilike.%${escape(q)}%,alias.cs.{"${escape(q)}"}`)
    .limit(20);

  // L'opérateur cs sur alias est exact ; on complète par un filtre côté serveur sur les alias en ilike
  const { data: teamsByAlias } = await supabase
    .from("teams")
    .select("id, alias")
    .limit(400);
  const needle = q.toLowerCase();
  const aliasIds = (teamsByAlias ?? []).filter((t) => t.alias.some((a) => a.toLowerCase().includes(needle))).map((t) => t.id);
  const ids = Array.from(new Set([...(teams ?? []).map((t) => t.id), ...aliasIds]));
  if (ids.length === 0) return NextResponse.json({ matches: [] });

  const { data } = await supabase
    .from("matches")
    .select("id, kickoff_at, statut, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(code_externe)")
    .or(`home_team_id.in.(${ids.join(",")}),away_team_id.in.(${ids.join(",")})`)
    .gte("kickoff_at", from)
    .lte("kickoff_at", to)
    .order("kickoff_at")
    .limit(8);

  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { nom?: string; code_externe?: string } | null;
  const matches = (data ?? []).map((m) => ({
    id: m.id,
    kickoff_at: m.kickoff_at,
    statut: m.statut,
    home: one(m.home)?.nom ?? "",
    away: one(m.away)?.nom ?? "",
    competition: one(m.competition)?.code_externe ?? "",
  }));
  return NextResponse.json({ matches });
}

function escape(s: string) {
  return s.replace(/[%,()"]/g, "");
}
