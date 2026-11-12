/**
 * Coups du jour : chaque matin, trois sélections par catégorie (Sûr, Audacieux, Risqué) sur les matchs des
 * prochaines 24 h, uniquement là où une vraie cote de référence existe. Un match ne sert qu'une fois.
 * Les sélections sont enregistrées comme pronos de la source « Coups du jour BETWISE » : leur bilan est public.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { loadSignals, picksOf } from "../probs/signals";
import { categorieOf, type Categorie } from "./categories";

type Db = SupabaseClient<Database, "betwise">;
export const PICKS_SOURCE = "Coups du jour BETWISE";
const RISK: Record<Categorie, Database["betwise"]["Enums"]["risk_category"]> = { sur: "prudent", audacieux: "moyen", risque: "risque" };
export const jourAbidjan = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Abidjan" });

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
  const signals = await loadSignals(db as never, (ms ?? []).map((m) => m.id));
  const compOf = new Map((ms ?? []).map((m) => [m.id, (Array.isArray(m.competition) ? m.competition[0] : m.competition)?.code_externe ?? ""]));

  type Cand = { match_id: string; market: string; param: number | null; sel: string; p: number; cote: number | null; pModele: number | null; cat: Categorie; score: number };
  const cands: Cand[] = [];
  for (const [match_id, sg] of signals) {
    if (sg.source !== "marche") continue; // jamais sans cote de référence
    for (const pk of picksOf(sg)) {
      const cat = categorieOf(pk.p);
      if (!cat || cat === "hors") continue;
      // l'avis du modèle départage : accord = bonus, fort désaccord = pénalité
      const accord = pk.pModele === null ? 0 : pk.pModele >= pk.p - 0.03 ? 0.03 : pk.pModele < pk.p - 0.1 ? -0.06 : 0;
      // une cote de référence vérifiable vaut mieux qu'une probabilité calculée ; les amicaux sont moins fiables
      const bonus = (pk.cote ? 0.03 : 0) - (compOf.get(match_id) === "AMI" ? 0.03 : 0);
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
    }
    const { error } = await db.from("daily_picks").insert({
      jour, match_id: c.match_id, market_code: c.market, market_param: c.param, selection: c.sel, categorie: c.cat, rang: c.rang,
      probabilite: Math.round(c.p * 10000) / 10000, cote_ref: c.cote, cote_juste: coteJuste, p_modele: c.pModele === null ? null : Math.round(c.pModele * 10000) / 10000, prediction_id: predictionId,
    });
    if (error && !/duplicate/i.test(error.message)) throw error;
  }
  return { jour, deja: false, picks: chosen.length, parCategorie: Object.fromEntries((["sur", "audacieux", "risque"] as const).map((k) => [k, chosen.filter((c) => c.cat === k).length])) };
}
