/**
 * Audit lot 1 (21/11, branche audit-lot1, lecture seule) : The Odds API sert-il les cotes Betclic, pour quelles
 * compétitions, et lesquelles ? 2 compétitions × 2 régions × 1 marché = 4 crédits. N'écrit rien en base.
 */
const KEY = (process.env.ODDS_API_KEY ?? "").trim();
const BASE = "https://api.the-odds-api.com/v4";
async function main() {
  const sp = await fetch(`${BASE}/sports?apiKey=${KEY}`);
  console.log(`Crédits : utilisés ${sp.headers.get("x-requests-used")} · restants ${sp.headers.get("x-requests-remaining")}`);
  const sports = (await sp.json()) as any[];
  console.log(`Compétitions de football disponibles : ${sports.filter((s) => s.group === "Soccer").length}`);
  console.log(sports.filter((s) => s.group === "Soccer").map((s) => s.key).join(", "));
  for (const sport of ["soccer_epl", "soccer_france_ligue_one"]) {
    const r = await fetch(`${BASE}/sports/${sport}/odds?apiKey=${KEY}&regions=eu,fr&markets=h2h&oddsFormat=decimal`);
    const ev = (await r.json()) as any[];
    const books = new Map<string, number>();
    for (const e of ev) for (const b of e.bookmakers ?? []) books.set(`${b.key} (${b.title})`, (books.get(`${b.key} (${b.title})`) ?? 0) + 1);
    console.log(`\n## ${sport} : ${ev.length} matchs · crédits restants ${r.headers.get("x-requests-remaining")}`);
    console.log([...books.entries()].sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k}: ${n}`).join(" | "));
    const e = ev.find((x) => (x.bookmakers ?? []).some((b: any) => /betclic/i.test(b.key)));
    if (e) {
      console.log(`Exemple ${e.home_team} – ${e.away_team} (${e.commence_time})`);
      for (const b of e.bookmakers.filter((b: any) => /betclic|1xbet|pinnacle/i.test(b.key))) {
        console.log(`  ${b.title} : ${b.markets[0].outcomes.map((o: any) => `${o.name} ${o.price}`).join(" / ")} (mis à jour ${b.last_update})`);
      }
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
