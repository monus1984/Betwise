/**
 * Modèle BETWISE : historique football-data.co.uk → forces Poisson → estimations des matchs à J+8
 * → prono « Modèle BETWISE » à J-2 (issue la plus probable, cote de référence du moment).
 * Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import "dotenv/config";
import { createAdminClient } from "../src/lib/supabase/admin";
import { LEAGUE_CODES } from "../src/lib/model/history";
import { estimateCompetition, importHistory } from "../src/lib/model/run";

async function main() {
  const db = createAdminClient();
  const skipHistory = process.argv.includes("--sans-historique");
  const { data: src } = await db.from("sources").select("id").eq("type", "modele_betwise").limit(1).maybeSingle();
  if (!src) throw new Error("Source « Modèle BETWISE » introuvable");

  for (const comp of Object.keys(LEAGUE_CODES)) {
    try {
      const h = skipHistory ? 0 : await importHistory(db, comp);
      const r = await estimateCompetition(db, comp, src.id);
      console.log(`[${comp}] historique ${h} lignes · ${r.matches} matchs à venir · ${r.estimates} estimations · ${r.pronos} pronos${r.unmatched.length ? ` · non rapprochés : ${r.unmatched.join(", ")}` : ""}`);
    } catch (e) {
      console.error(`[${comp}] échec :`, e instanceof Error ? e.message : e);
      process.exitCode = 1;
    }
  }
}

main();
