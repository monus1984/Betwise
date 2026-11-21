/**
 * Cotes de référence européennes (The Odds API, plan gratuit) → betwise.odds_observations.
 * Un passage par jour : 2 crédits par compétition ayant des matchs à J+14 (un appel vide ne coûte rien).
 * Variables : ODDS_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import "dotenv/config";
import { createAdminClient } from "../src/lib/supabase/admin";
import { COMPETITIONS_V1 } from "../src/lib/football-data/client";
import { OddsApiClient } from "../src/lib/odds-api/client";
import { syncBetclicFr, syncReferenceOdds } from "../src/lib/odds-api/sync";

/** Compétitions où Betclic France est relevé (1 crédit chacune par passage). */
const BETCLIC_CODES = ["PL", "FL1", "BL1", "PD", "SA", "CL"];
/** En dessous de ce quota restant, on garde les crédits pour les cotes de référence. */
const RESERVE_REFERENCE = 100;

async function main() {
  const codes = process.argv.slice(2).length ? process.argv.slice(2) : [...COMPETITIONS_V1, "UNL"];
  const db = createAdminClient();
  const api = new OddsApiClient(process.env.ODDS_API_KEY ?? "");

  const sports = await api.sports();
  let total = 0;
  for (const code of codes) {
    const key = OddsApiClient.resolveSportKey(sports, code);
    if (!key) { console.log(`[${code}] aucun marché ouvert sur The Odds API en ce moment, ignoré`); continue; }
    try {
      const r = await syncReferenceOdds(db, api, code, key, 14);
      total += r.rows;
      console.log(`[${code} → ${key}] ${r.events} événements, ${r.matched} rapprochés, ${r.rows} cotes insérées`);
    } catch (e) {
      console.error(`[${code}] échec :`, e instanceof Error ? e.message : e);
    }
  }
  // Betclic France, base de l'estimation Betclic Côte d'Ivoire : seulement s'il reste de la marge sur le quota.
  for (const code of codes.filter((c) => BETCLIC_CODES.includes(c))) {
    if (api.remaining !== null && api.remaining < RESERVE_REFERENCE) { console.log(`Betclic FR ignoré : ${api.remaining} crédits restants, réservés aux cotes de référence`); break; }
    const key = OddsApiClient.resolveSportKey(sports, code);
    if (!key) continue;
    try {
      const r = await syncBetclicFr(db, api, code, key, 14);
      total += r.rows;
      console.log(`[${code} Betclic FR] ${r.events} événements, ${r.matched} rapprochés, ${r.rows} cotes insérées`);
    } catch (e) {
      console.error(`[${code} Betclic FR] échec :`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`Total : ${total} cotes. Quota The Odds API : ${api.used ?? "?"} utilisés, ${api.remaining ?? "?"} restants ce mois.`);
}

main();
