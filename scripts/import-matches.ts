/**
 * Import quotidien des matchs (phase 0).
 * Usage : npm run import:matches            → compétitions V1
 *         npm run import:matches -- PL CL    → codes explicites
 * Variables : FOOTBALL_DATA_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import "dotenv/config";
import { createAdminClient } from "../src/lib/supabase/admin";
import { COMPETITIONS_V1, FootballDataClient } from "../src/lib/football-data/client";
import { syncCompetition } from "../src/lib/football-data/sync";

async function main() {
  const codes = process.argv.slice(2).length ? process.argv.slice(2) : [...COMPETITIONS_V1];
  const db = createAdminClient();
  const fd = new FootballDataClient(process.env.FOOTBALL_DATA_TOKEN ?? "");

  let total = 0;
  const failures: string[] = [];
  for (const code of codes) {
    try {
      const n = await syncCompetition(db, fd, code);
      total += n;
      console.log(`[${code}] ${n} matchs synchronisés`);
    } catch (e) {
      failures.push(code);
      console.error(`[${code}] échec :`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`Total : ${total} matchs, ${failures.length} échec(s)${failures.length ? ` (${failures.join(", ")})` : ""}`);
  if (failures.length === codes.length) process.exit(1);
}

main();
