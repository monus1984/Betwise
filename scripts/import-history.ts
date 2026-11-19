/**
 * Réimporte l'historique des cinq championnats (football-data.co.uk) : résultats, cotes de clôture, score à la pause.
 * Même fonction que le passage quotidien du modèle (upsert idempotent) ; utile seul quand une colonne est ajoutée.
 * Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import "dotenv/config";
import { createAdminClient } from "../src/lib/supabase/admin";
import { LEAGUE_CODES } from "../src/lib/model/history";
import { importHistory } from "../src/lib/model/run";

async function main() {
  const db = createAdminClient();
  for (const comp of Object.keys(LEAGUE_CODES)) console.log(`[${comp}] ${await importHistory(db, comp)} matchs`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
