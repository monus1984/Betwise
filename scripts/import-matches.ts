/**
 * Import quotidien des matchs (phase 0).
 * Usage : npm run import:matches            → compétitions V1
 *         npm run import:matches -- PL CL    → codes explicites
 * Variables : FOOTBALL_DATA_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *             ODDS_API_KEY (facultative : compétitions de sélections nationales)
 */
import "dotenv/config";
import { createAdminClient } from "../src/lib/supabase/admin";
import { COMPETITIONS_V1, FootballDataClient } from "../src/lib/football-data/client";
import { syncCompetition } from "../src/lib/football-data/sync";
import { OddsApiClient } from "../src/lib/odds-api/client";
import { INTERNATIONAL, syncInternationalFixtures, syncInternationalScores } from "../src/lib/odds-api/international";

async function main() {
  const codes = process.argv.slice(2).length ? process.argv.slice(2) : [...COMPETITIONS_V1];
  const db = createAdminClient();
  const fd = new FootballDataClient(process.env.FOOTBALL_DATA_TOKEN ?? "");

  let total = 0;
  const failures: string[] = [];
  for (const code of codes) {
    try {
      const n = await syncCompetition(db, fd, code, 2, 14);
      total += n;
      console.log(`[${code}] ${n} matchs synchronisés`);
    } catch (e) {
      failures.push(code);
      console.error(`[${code}] échec :`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`Total : ${total} matchs, ${failures.length} échec(s)${failures.length ? ` (${failures.join(", ")})` : ""}`);

  // Sélections nationales (The Odds API) : calendrier gratuit, résultats seulement quand un match doit être fini
  if (process.env.ODDS_API_KEY && !process.argv.slice(2).length) {
    const api = new OddsApiClient(process.env.ODDS_API_KEY);
    for (const code of Object.keys(INTERNATIONAL)) {
      try {
        const n = await syncInternationalFixtures(db, api, code);
        const r = await syncInternationalScores(db, api, code);
        console.log(`[${code}] ${n} matchs au calendrier · résultats : ${r.called ? `${r.updated} mis à jour` : "rien à récupérer"}`);
      } catch (e) {
        console.error(`[${code}] échec :`, e instanceof Error ? e.message : e);
      }
    }
    console.log(`Quota The Odds API : ${api.used ?? "?"} utilisés, ${api.remaining ?? "?"} restants ce mois.`);
  }

  // Règlement automatique de tout ce qui attend un score désormais connu
  const { data: settled, error: settleErr } = await db.rpc("settle_pending");
  if (settleErr) console.error("Règlement :", settleErr.message);
  else {
    const r = Array.isArray(settled) ? settled[0] : settled;
    console.log(`Règlement : ${r?.matchs ?? 0} match(s), ${r?.selections_reglees ?? 0} sélection(s), ${r?.pronos_regles ?? 0} prono(s), ${r?.paris_finalises ?? 0} pari(s) finalisé(s)`);
  }
  if (failures.length === codes.length) process.exit(1);
}

main();
