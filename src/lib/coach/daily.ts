/**
 * Coups du jour : chaque matin, trois sélections par catégorie (Prudent, Équilibré, Audacieux) sur les matchs des
 * matchs du jour (heure d'Abidjan) qui n'ont pas encore commencé, uniquement là où une vraie cote de référence existe. Un match ne sert qu'une fois.
 * Les sélections sont enregistrées comme pronos de la source « Coups du jour BETWISE » : leur bilan est public.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { loadSignals, picksOf } from "../probs/signals";
import { profilDe, type Categorie } from "./categories";
import { estTop5 } from "../competitions";

type Db = SupabaseClient<Database, "betwise">;
export const PICKS_SOURCE = "Coups du jour BETWISE";
const RISK: Record<Categorie, Database["betwise"]["Enums"]["risk_category"]> = { sur: "prudent", audacieux: "moyen", risque: "risque" };
export const jourAbidjan = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Abidjan" });
/** Un coup du jour appartient au jour de son match (heure d'Abidjan), pas au jour où il a été calculé (22/11). */
export const memeJour = (kickoff: string, jour: string) => jourAbidjan(new Date(kickoff)) === jour;
/**
 * Coups à montrer pour `jour` : ceux rangés à ce jour et ceux rangés la veille dont le match tombe ce jour-là
 * (calculés l'après-midi avant le 22/11). Un match ne sert qu'une fois ; le rangement du jour passe devant.
 */
export function coupsDuJour<T extends { jour: string; kickoff: string | null; match_id: string | null }>(rows: T[], jour: string): T[] {
  const vus = new Set<string>();
  return [...rows].sort((a, b) => Number(a.jour !== jour) - Number(b.jour !== jour))
    .filter((r) => r.kickoff && r.match_id && memeJour(r.kickoff, jour) && !vus.has(r.match_id) && !!vus.add(r.match_id));
}

export async function generateDailyPicks(db: Db, parCategorie = 3, refaire = false) {
  const jour = jourAbidjan();
  if (refaire) {
    // Remplacement avant tout coup d'envoi : les anciens pronos sont annulés (jamais effacés), les lignes du jour retirées
    const { data: old } = await db.from("daily_picks").select("id, prediction_id, match:matches(kickoff_at)").eq("jour", jour);
    const started = (old ?? []).some((o) => { const m = Array.isArray(o.match) ? o.match[0] : o.match; return m && Date.parse(m.kickoff_at) <= Date.now(); });
    if (started) return { jour, deja: true, picks: 0, note: "un match du jour a commencé : remplacement refusé" };
    const ids = (old ?? []).map((o) => o.prediction_id).filter(Boolean) as string[];
    if (ids.length) await db.from("predictions").update({ statut: "annule" }).in("id", ids);
    await db.from("daily_picks").delete().eq("jour", jour);
  }
  const { count } = await db.from("daily_picks").select("id", { count: "exact", head: true }).eq("jour", jour);
  if ((count ?? 0) > 0) return { jour, deja: true, picks: 0 };

  const { data: ms } = await db.from("matches").select("id, kickoff_at, competition:competitions(code_externe)").eq("statut", "programme")
    .gte("kickoff_at", new Date(Date.now() + 20 * 60000).toISOString()).lte("kickoff_at", new Date(Date.now() + 24 * 3600000).toISOString()).limit(300);
  // seulement les matchs de ce jour : ceux du lendemain seront choisis le lendemain matin
  const duJour = (ms ?? []).filter((m) => memeJour(m.kickoff_at, jour));
  const signals = await loadSignals(db as never, duJour.map((m) => m.id));
  const compOf = new Map((ms ?? []).map((m) => [m.id, (Array.isArray(m.competition) ? m.competition[0] : m.competition)?.code_externe ?? ""]));

  type Cand = { match_id: string; market: string; param: number | null; sel: string; p: number; cote: number | null; pModele: number | null; cat: Categorie; score: number };
  const cands: Cand[] = [];
  for (const [match_id, sg] of signals) {
    if (sg.source !== "marche") continue; // jamais sans cote de référence
    for (const pk of picksOf(sg)) {
      const cat = profilDe(pk.p, pk.cote);
      if (!cat) continue;
      // l'avis du modèle départage : accord = bonus, fort désaccord = pénalité
      const accord = pk.pModele === null ? 0 : pk.pModele >= pk.p - 0.03 ? 0.03 : pk.pModele < pk.p - 0.1 ? -0.06 : 0;
      // une cote de référence vérifiable vaut mieux qu'une probabilité calculée ; les amicaux sont moins fiables
      // les 5 grands championnats européens passent devant à probabilité proche (21/11)
      const bonus = (pk.cote ? 0.03 : 0) - (compOf.get(match_id) === "AMI" ? 0.03 : 0) + (estTop5(compOf.get(match_id)) ? 0.05 : 0);
      cands.push({ match_id, market: pk.market, param: pk.param, sel: pk.sel, p: pk.p, cote: pk.cote, pModele: pk.pModele, cat, score: pk.p + accord + bonus });
    }
  }
  const used = new Set<string>();
  const chosen: (Cand & { rang: number })[] = [];
  for (const cat of ["sur", "audacieux", "risque"] as Categorie[]) {
    let rang = 0;
    for (const c of cands.filter((x) => x.cat === cat).sort((a, b) => b.score - a.score)) {
      if (rang >= parCategorie || used.has(c.match_id)) continue;
      used.add(c.match_id); chosen.push({ ...c, rang: ++rang });
    }
  }
  if (!chosen.length) return { jour, deja: false, picks: 0 };

  const { data: src } = await db.from("sources").select("id").eq("nom", PICKS_SOURCE).is("created_by", null).maybeSingle();
  for (const c of chosen) {
    const coteJuste = Math.round((1 / c.p) * 1000) / 1000;
    let predictionId: string | null = null;
    if (src) {
      const { data: pr } = await db.from("predictions").insert({
        source_id: src.id, match_id: c.match_id, market_code: c.market, market_param: c.param, selection: c.sel,
        cote_annoncee: c.cote ?? coteJuste, probabilite_annoncee: Math.round(c.p * 10000) / 10000, risque_annonce: RISK[c.cat], published_at: new Date().toISOString(),
      }).select("id").maybeSingle();
      predictionId = pr?.id ?? null;
      if (!predictionId) {
        // même sélection déjà publiée puis annulée lors d'un remplacement : on la réactive plutôt que d'en créer une autre
        let q = db.from("predictions").select("id").eq("source_id", src.id).eq("match_id", c.match_id).eq("market_code", c.market).eq("selection", c.sel);
        q = c.param === null ? q.is("market_param", null) : q.eq("market_param", c.param);
        const { data: ex } = await q.order("logged_at", { ascending: false }).limit(1).maybeSingle();
        if (ex) { await db.from("predictions").update({ statut: "verifie" }).eq("id", ex.id); predictionId = ex.id; }
      }
    }
    const { error } = await db.from("daily_picks").insert({
      jour, match_id: c.match_id, market_code: c.market, market_param: c.param, selection: c.sel, categorie: c.cat, rang: c.rang,
      probabilite: Math.round(c.p * 10000) / 10000, cote_ref: c.cote, cote_juste: coteJuste, p_modele: c.pModele === null ? null : Math.round(c.pModele * 10000) / 10000, prediction_id: predictionId,
    });
    if (error && !/duplicate/i.test(error.message)) throw error;
  }
  return { jour, deja: false, picks: chosen.length, parCategorie: Object.fromEntries((["sur", "audacieux", "risque"] as const).map((k) => [k, chosen.filter((c) => c.cat === k).length])) };
}
