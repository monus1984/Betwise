/**
 * Audit lot 1, suite (21/11) : Betclic France et Pinnacle sur les matchs de championnat du week-end, pour comparer
 * avec les captures de Betclic Côte d'Ivoire envoyées par Mounir. 1 crédit par compétition. Lecture seule.
 */
const KEY = (process.env.ODDS_API_KEY ?? "").trim();
const BASE = "https://api.the-odds-api.com/v4";
async function main() {
  for (const sport of ["soccer_epl", "soccer_france_ligue_one", "soccer_spain_la_liga", "soccer_italy_serie_a", "soccer_germany_bundesliga"]) {
    const r = await fetch(`${BASE}/sports/${sport}/odds?apiKey=${KEY}&bookmakers=betclic_fr,pinnacle&markets=h2h&oddsFormat=decimal`);
    const ev = (await r.json()) as any[];
    console.log(`## ${sport} · crédits restants ${r.headers.get("x-requests-remaining")}`);
    for (const e of ev) {
      const p = (k: string) => { const b = (e.bookmakers ?? []).find((x: any) => x.key === k); if (!b) return "—"; const o = b.markets[0].outcomes; const g = (n: string) => o.find((x: any) => x.name === n)?.price; return `${g(e.home_team)}/${g("Draw")}/${g(e.away_team)}@${b.last_update.slice(11, 16)}`; };
      console.log(`ODDS|${e.commence_time.slice(0, 16)}|${e.home_team}|${e.away_team}|${p("betclic_fr")}|${p("pinnacle")}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
