/**
 * Cotes de référence européennes (The Odds API, plan gratuit) → betwise.odds_observations.
 * Un passage par jour suffit : 2 crédits par compétition, ~360 / mois pour 6 compétitions.
 * Variables : ODDS_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import "dotenv/config";
import { createAdminClient } from "../src/lib/supabase/admin";
import { COMPETITIONS_V1 } from "../src/lib/football-data/client";
import { OddsApiClient } from "../src/lib/odds-api/client";
import { syncReferenceOdds } from "../src/lib/odds-api/sync";

async function main() {
  const codes = process.argv.slice(2).length ? process.argv.slice(2) : [...COMPETITIONS_V1];
  const db = createAdminClient();
  const api = new OddsApiClient(process.env.ODDS_API_KEY ?? "");

  const sports = await api.sports();
  let total = 0;
  for (const code of codes) {
    const key = OddsApiClient.resolveSportKey(sports, code);
    if (!key) { console.log(`[${code}] aucun marché ouvert sur The Odds API en ce moment, ignoré`); continue; }
    try {
      const r = await syncReferenceOdds(db, api, code, key);
      total += r.rows;
      console.log(`[${code} → ${key}] ${r.events} événements, ${r.matched} rapprochés, ${r.rows} cotes insérées`);
    } catch (e) {
      console.error(`[${code}] échec :`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`Total : ${total} cotes. Quota The Odds API : ${api.used ?? "?"} utilisés, ${api.remaining ?? "?"} restants ce mois.`);
}

main();
