/**
 * API-Football : calendrier et scores des compétitions africaines et des amicaux, règlement automatique.
 * Avec --cotes : ajoute les cotes de référence (une fois par jour suffit).
 * Variables : API_FOOTBALL_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import "dotenv/config";
import { createAdminClient } from "../src/lib/supabase/admin";
import { ApiFootball } from "../src/lib/api-football/client";
import { AF_COMPETITIONS, AF_LINKED, fillDetails, linkAfFixtures, syncAfCompetition, syncAfOdds } from "../src/lib/api-football/sync";

async function main() {
  if (!process.env.API_FOOTBALL_KEY) { console.error("API_FOOTBALL_KEY manquant"); process.exit(1); }
  const db = createAdminClient();
  const api = new ApiFootball(process.env.API_FOOTBALL_KEY);
  const withOdds = process.argv.includes("--cotes");
  let failures = 0;
  for (const code of Object.keys(AF_COMPETITIONS)) {
    try {
      const r = await syncAfCompetition(db, api, code);
      let line = `[${code}] ${r.matches} matchs (${r.finished} terminés)`;
      if (withOdds) { const o = await syncAfOdds(db, api, code); line += ` · cotes : ${o.matches} matchs, ${o.rows} lignes`; }
      console.log(line);
    } catch (e) { failures++; console.error(`[${code}] échec :`, e instanceof Error ? e.message : e); }
  }
  // Rattachement des matchs venus d'autres sources (championnats, Ligue des nations) pour le direct
  for (const code of Object.keys(AF_LINKED)) {
    try { const r = await linkAfFixtures(db, api, code); if (r.linked || r.pending) console.log(`[${code}] direct : ${r.linked} rattachés, ${r.pending} sans correspondance`); }
    catch (e) { console.error(`[${code}] rattachement :`, e instanceof Error ? e.message : e); }
  }
  // Détail des matchs terminés (corners, cartons, tirs, buteurs, issue), par lots de 20
  try { let n = 0; for (let i = 0; i < 5; i++) { const r = await fillDetails(db, api); n += r.filled; if (r.filled < 20) break; } if (n) console.log(`Détail complété : ${n} match(s)`); }
  catch (e) { console.error("Détail des matchs :", e instanceof Error ? e.message : e); }
  const { data: settled, error } = await db.rpc("settle_pending");
  if (error) console.error("Règlement :", error.message);
  else { const r = Array.isArray(settled) ? settled[0] : settled; console.log(`Règlement : ${r?.matchs ?? 0} match(s), ${r?.selections_reglees ?? 0} sélection(s), ${r?.pronos_regles ?? 0} prono(s), ${r?.paris_finalises ?? 0} pari(s) finalisé(s)`); }
  console.log(`Requêtes : ${api.calls} · restant aujourd'hui : ${api.remaining ?? "?"}`);
  if (failures === Object.keys(AF_COMPETITIONS).length) process.exit(1);
}
main();
