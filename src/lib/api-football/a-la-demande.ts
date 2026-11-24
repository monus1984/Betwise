/**
 * Match introuvable dans BETWISE (23/11, Mounir : « ce que j'attends, c'est le matching pour retrouver le match et les cotes »).
 * Quand un prono nomme une équipe d'un championnat que BETWISE ne suit pas (Ligue des champions d'Asie, Arabie saoudite,
 * Égypte…), on cherche l'équipe chez API-Football, on prend son match le plus proche de la date du prono, on l'ajoute à la
 * base avec ses cotes (1xBet et médiane des bookmakers), puis le rapprochement habituel le retrouve.
 * Coût : 2 à 4 requêtes par équipe introuvable, dans le quota de l'abonnement.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { teamSimilarity } from "../odds-api/client";
import { BOOKMAKERS_AF, cotesBookmaker, referenceMediane } from "./bookmakers";
import type { AfFixture, ApiFootball } from "./client";
import { mapStatus } from "./sync";

type Db = SupabaseClient<Database, "betwise">;

/** Nom tel qu'API-Football accepte de le chercher : lettres et espaces, sans accents. */
export function nomCherchable(nom: string): string {
  return nom.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, " ").replace(/\b(fc|sc|cf|afc|club|sfc|if|fk|ud|ac|acf|as|ss|cd|sd|sk|ff)\b/gi, " ").replace(/\s+/g, " ").trim();
}

/** Le match d'une équipe le plus proche de la date de référence (4 jours au plus), contre l'adversaire nommé s'il l'est. */
export function choisirMatch(fx: AfFixture[], equipe: number, refIso: string, adversaire?: string | null): AfFixture | null {
  const ref = Date.parse(refIso);
  const proches = fx.filter((f) => (f.teams.home.id === equipe || f.teams.away.id === equipe) && Math.abs(Date.parse(f.fixture.date) - ref) < 4 * 86_400_000);
  const bons = adversaire ? proches.filter((f) => teamSimilarity(adversaire, f.teams.home.id === equipe ? f.teams.away.name : f.teams.home.name) >= 0.5) : proches;
  return (bons.length ? bons : adversaire ? [] : proches).sort((a, b) => Math.abs(Date.parse(a.fixture.date) - ref) - Math.abs(Date.parse(b.fixture.date) - ref))[0] ?? null;
}

async function chercherEquipe(api: ApiFootball, nom: string) {
  // Équipes nationales acceptées (listes « Sénégal – Victoire », 24/11) ; une équipe féminine ne doit jamais
  // être confondue avec l'équipe masculine du même club (ni l'inverse).
  const femme = /\bwomen\b|\bféminin/i.test(nom) || /\sW$/.test(nom.trim());
  const estFemme = (n: string) => /\bwomen\b|\sW$/i.test(n.trim());
  const essais = [nomCherchable(nom.replace(/\bwomen\b|\bféminines?\b/gi, " ").replace(/\s+/g, " ").trim())];
  const long = essais[0].split(" ").filter((m) => m.length >= 4).sort((a, b) => b.length - a.length)[0];
  if (long && long !== essais[0]) essais.push(long);
  for (const q of essais) {
    if (q.length < 3) continue;
    const l = (await api.searchTeams(q)).filter((t) => estFemme(t.name) === femme);
    const best = l.map((t) => ({ t, s: teamSimilarity(nom, t.name) || teamSimilarity(essais[0], t.name) }))
      .sort((a, b) => b.s - a.s || Number(a.t.national) - Number(b.t.national))[0];
    if (best && best.s >= 0.5) return best.t;
  }
  return null;
}

/** Ajoute le match (compétition, équipes, match, cotes) ; renvoie son identifiant BETWISE. */
async function ajouterMatch(db: Db, api: ApiFootball, f: AfFixture): Promise<string> {
  const lg = f.league;
  const { data: comp, error: ce } = await db.from("competitions")
    .upsert({ code_externe: `af-l:${lg.id}`, nom: lg.name ?? "Autre compétition", pays: lg.country ?? null, saison: String(lg.season), couverte_auto: false }, { onConflict: "code_externe" }).select("id").single();
  if (ce) throw ce;
  // Équipe déjà connue par un autre match (identifiants API-Football rattachés) : on la reprend
  const tid = new Map<number, string>();
  const ids = [f.teams.home.id, f.teams.away.id];
  const [{ data: hs }, { data: as }] = await Promise.all([
    db.from("matches").select("af_home_id, home_team_id").in("af_home_id", ids).limit(10),
    db.from("matches").select("af_away_id, away_team_id").in("af_away_id", ids).limit(10),
  ]);
  for (const h of hs ?? []) if (h.af_home_id) tid.set(h.af_home_id, h.home_team_id);
  for (const a of as ?? []) if (a.af_away_id) tid.set(a.af_away_id, a.away_team_id);
  const aCreer = [f.teams.home, f.teams.away].filter((t) => !tid.has(t.id)).map((t) => ({ code_externe: `af:${t.id}`, nom: t.name, alias: [] as string[], competition_id: comp.id }));
  if (aCreer.length) {
    const { data: teams, error: te } = await db.from("teams").upsert(aCreer, { onConflict: "code_externe" }).select("id, code_externe");
    if (te) throw te;
    for (const t of teams) tid.set(Number(t.code_externe!.slice(3)), t.id);
  }
  const statut = mapStatus(f.fixture.status.short), done = statut === "termine", now = new Date().toISOString();
  const { data: m, error } = await db.from("matches").upsert({
    code_externe: `af:${f.fixture.id}`, af_fixture_id: f.fixture.id, af_home_id: f.teams.home.id, af_away_id: f.teams.away.id, competition_id: comp.id,
    home_team_id: tid.get(f.teams.home.id)!, away_team_id: tid.get(f.teams.away.id)!, kickoff_at: f.fixture.date, statut,
    score_home: done ? f.score.fulltime.home ?? f.goals.home : null, score_away: done ? f.score.fulltime.away ?? f.goals.away : null,
    ht_home: f.score.halftime?.home ?? null, ht_away: f.score.halftime?.away ?? null,
    source_resultat: done ? "api-football" : null, result_at: done ? now : null, updated_at: now,
  }, { onConflict: "code_externe" }).select("id").single();
  if (error) throw error;
  // Cotes du match : 1xBet si proposé, et la médiane des bookmakers comme référence
  if (statut === "programme") {
    const o = await api.oddsFixture(f.fixture.id).catch(() => null);
    if (o?.update) {
      const rows = cotesBookmaker(o, 11);
      if (rows.length) await db.rpc("replace_bookmaker_odds", { p_bookmaker: BOOKMAKERS_AF[11], p_source: "api-football", p_matches: [{ match_id: m.id, releve_at: o.update, rows }] } as never);
      const refs = referenceMediane(o, 11).map((r) => ({ ...r, match_id: m.id, bookmaker: "ref:eu-median", origine: "api" as const, observed_at: o.update! }));
      if (refs.length) await db.from("odds_observations").insert(refs as never);
    }
  }
  return m.id;
}

/**
 * Cherche et ajoute les matchs d'équipes introuvables. `demandes` : une équipe nommée (et son adversaire s'il est connu),
 * avec la date de référence du prono. Au plus `max` équipes par import, pour tenir le quota.
 */
export async function completerMatchs(db: Db, api: ApiFootball, demandes: { equipe: string; adversaire?: string | null; ref: string }[], max = 8, delaiMs = 18_000): Promise<{ ajoutes: number; requetes: number }> {
  const avant = api.calls;
  const uniques = new Map<string, (typeof demandes)[number]>();
  for (const d of demandes) { const k = nomCherchable(d.equipe).toLowerCase(); if (k && !uniques.has(k) && uniques.size < max) uniques.set(k, d); }
  // En parallèle, et jamais plus de 18 s : l'import entier doit tenir dans le temps imparti au serveur
  const une = async (d: (typeof demandes)[number]): Promise<number> => {
    try {
      const t = await chercherEquipe(api, d.equipe);
      if (!t) return 0;
      const passe = Date.parse(d.ref) < Date.now() - 3 * 3600_000;
      const f = choisirMatch(await api.teamFixtures(t.id, passe ? "last" : "next", 3), t.id, d.ref, d.adversaire);
      if (!f) return 0;
      await ajouterMatch(db, api, f);
      return 1;
    } catch { return 0; } // une équipe qui échoue n'arrête pas l'import
  };
  const toutes = Promise.all([...uniques.values()].map(une)).then((l) => l.reduce((a, b) => a + b, 0));
  const ajoutes = await Promise.race([toutes, new Promise<number>((r) => setTimeout(() => r(0), delaiMs))]);
  return { ajoutes, requetes: api.calls - avant };
}
