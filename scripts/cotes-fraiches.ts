/**
 * Cotes fraîches juste avant un passage du tipster virtuel : cote 1xBet et cote de référence (médiane des autres
 * bookmakers) des matchs des prochaines heures, relevées dans la même réponse d'API-Football.
 * Aucune requête pour une compétition sans match dans l'horizon. Variables : API_FOOTBALL_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import "dotenv/config";
import { createAdminClient } from "../src/lib/supabase/admin";
import { ApiFootball } from "../src/lib/api-football/client";
import { AF_COMPETITIONS, AF_LINKED } from "../src/lib/api-football/sync";
import { syncBookmakerOdds } from "../src/lib/api-football/bookmakers";

import { horizonHeures } from "../src/lib/tipsters-ia/horizon";

const HORIZON_HEURES = horizonHeures(); // le même horizon que les tipsters IA (journée entière le matin)

async function main() {
  if (!process.env.API_FOOTBALL_KEY) { console.error("API_FOOTBALL_KEY manquant"); process.exit(1); }
  const db = createAdminClient();
  const api = new ApiFootball(process.env.API_FOOTBALL_KEY);
  let matchs = 0, lignes = 0, refs = 0, requetes = 0;
  for (const [code, c] of Object.entries({ ...AF_COMPETITIONS, ...AF_LINKED })) {
    try { const r = await syncBookmakerOdds(db, api, code, c, HORIZON_HEURES); matchs += r.matches; lignes += r.rows; refs += r.refs ?? 0; requetes += r.requetes; }
    catch (e) { console.error(`[${code}] cotes :`, e instanceof Error ? e.message : e); }
  }
  console.log(`Cotes fraîches : ${matchs} match(s), ${lignes} cote(s) 1xBet, ${refs} cote(s) de référence, ${requetes} requête(s)`);
}

main();
