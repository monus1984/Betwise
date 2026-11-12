/**
 * Le jour vu par l'abonné : coups du jour BETWISE, et ses propres choix (paris en cours, pronos de ses sources)
 * confrontés aux probabilités BETWISE et rangés dans les mêmes catégories.
 */
import type { createClient } from "@/lib/supabase/server";
import { loadSignals, pickLabel, probOfSignal } from "../probs/signals";
import { categorieFromOdds, categorieOf, type Categorie } from "./categories";
import { jourAbidjan } from "./daily";

type Db = Awaited<ReturnType<typeof createClient>>;
type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const MATCH = "id, kickoff_at, statut, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(code_externe)";
type M = { id: string; kickoff_at: string; statut: string; home: One<{ nom: string }>; away: One<{ nom: string }>; competition: One<{ code_externe: string | null }> };

export type TodayPick = { id: string; categorie: Categorie; match_id: string; match: string; kickoff: string; comp: string | null; selection: string; p: number; cote: number | null; coteJuste: number; pModele: number | null; soutiens: string[]; statut: string };
export type TheirPick = { qui: string; type: "pari" | "prono"; match_id: string; match: string; kickoff: string; selection: string; cote: number | null; p: number | null; categorie: Categorie | "hors" | null; verdict: string; tone: "good" | "mid" | "bad" | "none"; aussiBetwise: boolean };

const key = (m: string, market: string, param: number | null, sel: string) => `${m}|${market}|${param === null ? "" : Number(param)}|${sel}`;

export async function loadToday(db: Db, userId: string) {
  const jour = jourAbidjan();
  const from = new Date(Date.now() - 3 * 3600000).toISOString(), to = new Date(Date.now() + 30 * 3600000).toISOString();

  const [{ data: picks }, { data: follows }, { data: perso }] = await Promise.all([
    db.from("daily_picks").select(`id, categorie, rang, market_code, market_param, selection, probabilite, cote_ref, cote_juste, p_modele, match:matches(${MATCH})`).eq("jour", jour).order("rang"),
    db.from("source_follows").select("source_id").eq("user_id", userId),
    db.from("sources").select("id").eq("type", "perso").eq("created_by", userId).maybeSingle(),
  ]);
  const srcIds = [...(follows ?? []).map((f) => f.source_id), ...(perso ? [perso.id] : [])];

  const [{ data: preds }, { data: bets }] = await Promise.all([
    srcIds.length ? db.from("predictions").select(`market_code, market_param, selection, cote_annoncee, source:sources(nom, type), match:matches!inner(${MATCH})`).in("source_id", srcIds).neq("statut", "annule").gte("match.kickoff_at", from).lte("match.kickoff_at", to).limit(100) : Promise.resolve({ data: [] as never[] }),
    db.from("bet_selections").select(`market_code, market_param, selection, cote, origin:sources!bet_selections_origin_source_id_fkey(nom, type), bets!inner(user_id, statut, virtuel), match:matches!inner(${MATCH})`).eq("bets.user_id", userId).eq("bets.statut", "en_cours").gte("match.kickoff_at", from).lte("match.kickoff_at", to).limit(100),
  ]);

  type Raw = { market_code: string; market_param: number | null; selection: string; cote: number | null; qui: string; type: "pari" | "prono"; m: M };
  const theirsRaw: Raw[] = [
    ...((bets ?? []) as unknown as { market_code: string; market_param: number | null; selection: string; cote: number; origin: One<{ nom: string; type: string }>; bets: One<{ virtuel: boolean }>; match: One<M> }[]).map((b) => {
      const o = one(b.origin);
      return { market_code: b.market_code, market_param: b.market_param, selection: b.selection, cote: Number(b.cote), qui: `${one(b.bets)?.virtuel ? "Ton test" : "Ton pari"}${o && o.type !== "perso" ? ` (${o.nom})` : ""}`, type: "pari" as const, m: one(b.match)! };
    }),
    ...((preds ?? []) as unknown as { market_code: string; market_param: number | null; selection: string; cote_annoncee: number | null; source: One<{ nom: string; type: string }>; match: One<M> }[])
      .filter((p) => one(p.source)?.nom !== "Coups du jour BETWISE" && one(p.source)?.type !== "modele_betwise")
      .map((p) => ({ market_code: p.market_code, market_param: p.market_param, selection: p.selection, cote: p.cote_annoncee === null ? null : Number(p.cote_annoncee), qui: one(p.source)?.type === "perso" ? "Ton prono" : one(p.source)?.nom ?? "?", type: "prono" as const, m: one(p.match)! })),
  ].filter((r) => r.m);

  type P = { id: string; categorie: Categorie; rang: number; market_code: string; market_param: number | null; selection: string; probabilite: number; cote_ref: number | null; cote_juste: number; p_modele: number | null; match: One<M> };
  const pickRows = (picks ?? []) as unknown as P[];
  const ids = [...new Set([...theirsRaw.map((r) => r.m.id), ...pickRows.map((p) => one(p.match)?.id).filter(Boolean) as string[]])];
  const signals = await loadSignals(db, ids);
  const names = (m: M) => ({ h: one(m.home)?.nom ?? "", a: one(m.away)?.nom ?? "" });

  const betwiseKeys = new Set(pickRows.map((p) => key(one(p.match)!.id, p.market_code, p.market_param, p.selection)));
  const soutiens = new Map<string, string[]>();
  for (const r of theirsRaw) { const k = key(r.m.id, r.market_code, r.market_param, r.selection); soutiens.set(k, [...(soutiens.get(k) ?? []), r.qui]); }

  const todayPicks: TodayPick[] = pickRows.map((p) => {
    const m = one(p.match)!; const { h, a } = names(m);
    return { id: p.id, categorie: p.categorie, match_id: m.id, match: `${h} – ${a}`, kickoff: m.kickoff_at, comp: one(m.competition)?.code_externe ?? null, statut: m.statut,
      selection: pickLabel(p.market_code, p.market_param === null ? null : Number(p.market_param), p.selection, h, a), p: Number(p.probabilite), cote: p.cote_ref === null ? null : Number(p.cote_ref), coteJuste: Number(p.cote_juste), pModele: p.p_modele === null ? null : Number(p.p_modele),
      soutiens: soutiens.get(key(m.id, p.market_code, p.market_param, p.selection)) ?? [] };
  });

  const theirs: TheirPick[] = theirsRaw.map((r) => {
    const { h, a } = names(r.m); const sg = signals.get(r.m.id);
    const p = sg ? probOfSignal(sg, r.market_code, r.market_param === null ? null : Number(r.market_param), r.selection) : null;
    const categorie = p !== null ? categorieOf(p) : r.cote ? categorieFromOdds(r.cote) : null;
    const value = p !== null && r.cote ? p * r.cote - 1 : null;
    const verdict = p === null ? (r.cote ? "pas de cote de référence : classé d’après sa cote" : "pas de données sur ce match")
      : p >= 0.667 ? `BETWISE confirme : ${Math.round(p * 100)} %` : p >= 0.5 ? `BETWISE est partagé : ${Math.round(p * 100)} %` : `BETWISE n’y croit pas : ${Math.round(p * 100)} %`;
    const tone: TheirPick["tone"] = p === null ? "none" : p >= 0.667 ? "good" : p >= 0.5 ? "mid" : "bad";
    return { qui: r.qui, type: r.type, match_id: r.m.id, match: `${h} – ${a}`, kickoff: r.m.kickoff_at, selection: pickLabel(r.market_code, r.market_param === null ? null : Number(r.market_param), r.selection, h, a),
      cote: r.cote, p, categorie, tone, aussiBetwise: betwiseKeys.has(key(r.m.id, r.market_code, r.market_param, r.selection)),
      verdict: value !== null && r.cote ? `${verdict}${value <= -0.08 ? " · cote trop basse" : ""}` : verdict };
  }).sort((x, y) => Date.parse(x.kickoff) - Date.parse(y.kickoff));

  return { jour, picks: todayPicks, theirs };
}
