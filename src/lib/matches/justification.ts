/**
 * Justification propre à chaque match (19/11) : la forme récente des deux équipes et leurs dernières confrontations,
 * tirées des matchs terminés en base, toutes compétitions suivies confondues. Aucune ligne sans données : un match
 * dont les équipes n'ont pas d'historique suivi n'a pas de justification, et on ne l'invente pas.
 */
import type { createClient } from "@/lib/supabase/server";
import { enjeux } from "./enjeux";
import { latestStandings, type StandingRow } from "./standings";

type Db = Awaited<ReturnType<typeof createClient>>;
export type Joue = { at: string; h: string; a: string; sh: number; sa: number };
/** enjeu : la phrase d'enjeu de classement la plus parlante (voir enjeux.ts), absente sans classement. */
export type Pourquoi = { forme: string | null; face: string | null; buts: string | null; enjeu?: string | null };
export const NB_FORME = 5;

const pl = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const dec = (x: number) => x.toFixed(1).replace(".", ",");
const mois = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { month: "short", year: "numeric", timeZone: "Africa/Abidjan" });

/** Victoires, nuls, défaites et buts sur les derniers matchs d'une équipe (du plus récent au plus ancien). */
export function bilan(team: string, passes: Joue[], n = NB_FORME) {
  const l = passes.filter((p) => p.h === team || p.a === team).slice(0, n);
  let v = 0, nu = 0, d = 0, buts = 0;
  for (const p of l) {
    const pour = p.h === team ? p.sh : p.sa, contre = p.h === team ? p.sa : p.sh;
    buts += p.sh + p.sa;
    if (pour > contre) v++; else if (pour === contre) nu++; else d++;
  }
  return { n: l.length, v, nu, d, butsParMatch: l.length ? buts / l.length : null };
}

export function pourquoi(m: { homeId: string; awayId: string; home: string; away: string }, passes: Joue[]): Pourquoi {
  const bh = bilan(m.homeId, passes), ba = bilan(m.awayId, passes);
  const dit = (nom: string, b: ReturnType<typeof bilan>) => `${nom} ${b.v}V ${b.nu}N ${b.d}D`;
  const forme = bh.n >= 3 && ba.n >= 3 ? `Forme sur les ${Math.min(bh.n, ba.n)} derniers : ${dit(m.home, bh)}, ${dit(m.away, ba)}` : null;
  const faces = passes.filter((p) => (p.h === m.homeId && p.a === m.awayId) || (p.h === m.awayId && p.a === m.homeId)).slice(0, 5);
  let face: string | null = null;
  if (faces.length === 1) {
    const p = faces[0], nh = p.h === m.homeId ? m.home : m.away, na = p.h === m.homeId ? m.away : m.home;
    face = `Dernière confrontation : ${nh} ${p.sh}–${p.sa} ${na} (${mois(p.at)})`;
  } else if (faces.length > 1) {
    const vh = faces.filter((p) => (p.h === m.homeId ? p.sh > p.sa : p.sa > p.sh)).length;
    const va = faces.filter((p) => (p.h === m.awayId ? p.sh > p.sa : p.sa > p.sh)).length;
    const nu = faces.length - vh - va;
    face = `Face-à-face, ${faces.length} derniers : ${pl(vh, "victoire")} ${m.home}, ${pl(va, "victoire")} ${m.away}${nu ? `, ${pl(nu, "nul")}` : ""}`;
  }
  const buts = bh.butsParMatch !== null && ba.butsParMatch !== null && bh.n >= 3 && ba.n >= 3
    ? `${dec((bh.butsParMatch + ba.butsParMatch) / 2)} buts par match en moyenne dans leurs derniers matchs` : null;
  return { forme, face, buts };
}

/** Charge la justification de plusieurs matchs en trois requêtes. Clé : l'identifiant API des équipes, commun à
 * l'historique importé (af_history, cinq grands championnats) et aux matchs récents en base. */
export async function loadPourquoi(db: Db, matchIds: string[]): Promise<Map<string, Pourquoi>> {
  const out = new Map<string, Pourquoi>();
  if (!matchIds.length) return out;
  const { data: ms } = await db.from("matches").select("id, kickoff_at, af_home_id, af_away_id, home_team_id, away_team_id, competition:competitions(code_externe), home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom)").in("id", matchIds);
  const rows = ((ms ?? []) as unknown as { id: string; kickoff_at: string; af_home_id: number | null; af_away_id: number | null; home_team_id: string; away_team_id: string; competition: { code_externe: string | null } | { code_externe: string | null }[] | null; home: { nom: string } | { nom: string }[] | null; away: { nom: string } | { nom: string }[] | null }[])
    .filter((r) => r.af_home_id && r.af_away_id);
  const teams = [...new Set(rows.flatMap((r) => [r.af_home_id as number, r.af_away_id as number]))];
  if (!teams.length) return out;
  const liste = teams.join(",");
  const depuis = new Date(Date.now() - 730 * 86400000).toISOString();
  const codeDe = (r: (typeof rows)[number]) => (Array.isArray(r.competition) ? r.competition[0]?.code_externe : r.competition?.code_externe) ?? null;
  const comps = [...new Set(rows.map(codeDe).filter((c): c is string => !!c))];
  const [{ data: hist }, { data: recents }, { data: st }] = await Promise.all([
    // Par paquets de 10 équipes (≈ 80 matchs chacune sur deux ans) : la base rend au plus 1 000 lignes par requête
    Promise.all(Array.from({ length: Math.ceil(teams.length / 10) }, (_, i) => teams.slice(i * 10, i * 10 + 10).join(",")).map((l) =>
      db.from("af_history").select("fixture_id, played_at, home_id, away_id, home_goals, away_goals").gte("played_at", depuis)
        .or(`home_id.in.(${l}),away_id.in.(${l})`).order("played_at", { ascending: false }).limit(1000),
    )).then((rs) => ({ data: [...new Map(rs.flatMap((r) => r.data ?? []).map((x) => [x.fixture_id, x])).values()].sort((a, b) => Date.parse(b.played_at) - Date.parse(a.played_at)) })),
    db.from("matches").select("af_fixture_id, kickoff_at, af_home_id, af_away_id, score_home, score_away").eq("statut", "termine").gte("kickoff_at", depuis)
      .or(`af_home_id.in.(${liste}),af_away_id.in.(${liste})`).order("kickoff_at", { ascending: false }).limit(2000),
    comps.length ? db.from("standings").select("*").in("comp_code", comps).limit(3000) : Promise.resolve({ data: [] as StandingRow[] }),
  ]);
  const tables = new Map<string, StandingRow[]>();
  for (const c of comps) tables.set(c, latestStandings(((st ?? []) as StandingRow[]).filter((x) => x.comp_code === c)));
  const vus = new Set<number>();
  const passes: Joue[] = [];
  for (const p of hist ?? []) {
    if (p.home_goals === null || p.away_goals === null) continue;
    vus.add(p.fixture_id); passes.push({ at: p.played_at, h: String(p.home_id), a: String(p.away_id), sh: p.home_goals, sa: p.away_goals });
  }
  for (const p of recents ?? []) {
    if (p.score_home === null || p.score_away === null || !p.af_home_id || !p.af_away_id || (p.af_fixture_id && vus.has(p.af_fixture_id))) continue;
    passes.push({ at: p.kickoff_at, h: String(p.af_home_id), a: String(p.af_away_id), sh: p.score_home, sa: p.score_away });
  }
  passes.sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
  const nom = (x: { nom: string } | { nom: string }[] | null) => (Array.isArray(x) ? x[0]?.nom : x?.nom) ?? "";
  for (const r of rows) {
    const t = Date.parse(r.kickoff_at);
    const avant = passes.filter((p) => Date.parse(p.at) < t);
    const pq = pourquoi({ homeId: String(r.af_home_id), awayId: String(r.af_away_id), home: nom(r.home), away: nom(r.away) }, avant);
    const table = tables.get(codeDe(r) ?? "") ?? [];
    const en = table.length ? enjeux({ home: nom(r.home), away: nom(r.away), comp: codeDe(r) ?? "", homeRow: table.find((x) => x.team_id === r.home_team_id) ?? null, awayRow: table.find((x) => x.team_id === r.away_team_id) ?? null, table }) : [];
    // la phrase la plus parlante : un conditionnel (« en cas de victoire ») ou une zone, avant la simple position
    const enjeu = en.find((l) => /victoire|pourrait/.test(l)) ?? en[0] ?? null;
    out.set(r.id, { ...pq, enjeu });
  }
  return out;
}
