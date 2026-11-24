/**
 * Test du rapprochement sur de vrais pronos (24/11) : on part des lignes lues (sans l'IA de lecture) et on regarde,
 * ligne par ligne, si BETWISE retrouve le match et une cote. Aucune écriture, sauf les matchs qu'API-Football ajoute.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createAdminClient } from "../src/lib/supabase/admin";
import { rapprocherTickets, type RawTicket } from "../src/lib/extract/ticket";

async function main() {
  const raws = JSON.parse(readFileSync(process.argv[2] ?? "scripts/fixtures/rapprochement-24-11.json", "utf8")) as RawTicket[];
  const out = await rapprocherTickets(createAdminClient() as never, raws, { tokensIn: 0, tokensOut: 0, model: "test" });
  let n = 0, avecMatch = 0, avecCote = 0, reconnu = 0;
  for (const t of out) for (const [i, x] of t.selections.entries()) {
    const r = t.raw.selections[i];
    n++; if (x.match) avecMatch++; if (x.odds) avecCote++; if (x.ok) reconnu++;
    console.log(`${(r.home_team ?? r.team_only ?? "?").padEnd(14)} ${(r.away_team ?? "").padEnd(12)} « ${r.pick_text} » → ${x.match ? `${x.match.home} – ${x.match.away}` : "MATCH NON TROUVÉ"} | ${x.ok ? `${x.market_code} ${x.market_param ?? ""} ${x.selection}` : "pari non reconnu"} | cote ${x.odds ?? "AUCUNE"} (${x.odds_source ?? "-"})`);
  }
  console.log(`\n${n} lignes : ${avecMatch} matchs retrouvés, ${reconnu} paris reconnus, ${avecCote} cotes attribuées`);
}
main().catch((e) => { console.error(e instanceof Error ? e.stack : JSON.stringify(e)); process.exit(1); });
