/**
 * Diagnostic (24/11) : rejoue le rapprochement (match + cote) sur les dernières lectures d'import enregistrées,
 * sans relire les images. Sortie : rapports/diag-rapprochement.json, une ligne par sélection.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { createAdminClient } from "../src/lib/supabase/admin";
import { rapprocherTickets, type RawTicket } from "../src/lib/extract/ticket";

async function main() {
  const db = createAdminClient();
  const { data } = await db.from("uploads").select("id, created_at, json_extrait").eq("user_id", process.env.UID!)
    .gte("created_at", new Date(Date.now() - Number(process.env.JOURS ?? 2) * 86400000).toISOString()).order("created_at", { ascending: false }).limit(25);
  const lignes: Record<string, unknown>[] = [];
  for (const u of data ?? []) {
    const raw = u.json_extrait as unknown as RawTicket;
    if (!raw?.selections?.length) continue;
    const [t] = await rapprocherTickets(db as never, [raw], { tokensIn: 0, tokensOut: 0, model: "rejeu" }, Date.parse(u.created_at));
    t.selections.forEach((s, i) => {
      const r = raw.selections[i] as Record<string, unknown>;
      lignes.push({ upload: u.id.slice(0, 8), quand: u.created_at.slice(5, 16), kind: raw.kind, source: (raw.source as { name?: string } | null)?.name ?? null,
        lu: `${r.home_team ?? ""} | ${r.away_team ?? ""} | team_only=${r.team_only ?? ""} | ${r.market_text ?? ""} | ${r.pick_text ?? ""} | score=${r.score ?? ""}`,
        match: s.match ? `${s.match.home} – ${s.match.away} (${s.match.kickoff_at.slice(5, 16)})` : null,
        marche: s.ok ? `${s.market_code} ${s.market_param ?? ""} ${s.selection}` : `NON : ${s.reason ?? ""}`.slice(0, 120),
        cote: s.odds, origine: s.odds_source });
    });
  }
  mkdirSync("rapports", { recursive: true });
  writeFileSync("rapports/diag-rapprochement.json", JSON.stringify(lignes, null, 1));
  const n = lignes.length, sm = lignes.filter((l) => !l.match).length, sc = lignes.filter((l) => l.match && !l.cote).length;
  console.log(`${n} sélections : ${sm} sans match, ${sc} avec match mais sans cote`);
}
main().catch((e) => { console.error(e instanceof Error ? e.stack : JSON.stringify(e)); process.exit(1); });
