/**
 * Sonde : compétitions de sélections nationales couvertes par The Odds API, et leurs prochains matchs.
 * /sports et /sports/{key}/events ne consomment pas de crédit.
 */
import "dotenv/config";
const KEY = process.env.ODDS_API_KEY ?? "";
const BASE = "https://api.the-odds-api.com/v4";

async function get(path: string) {
  const r = await fetch(`${BASE}${path}${path.includes("?") ? "&" : "?"}apiKey=${KEY}`);
  return { status: r.status, used: r.headers.get("x-requests-used"), last: r.headers.get("x-requests-last"), json: await r.json() };
}

async function main() {
  const s = await get("/sports?all=true");
  const soccer = (s.json as { key: string; title: string; description: string; active: boolean; has_outrights: boolean }[]).filter((x) => x.key.startsWith("soccer"));
  const intl = soccer.filter((x) => /nations|world_cup|wc_|qualif|friendl|africa|caf|afcon|euro|copa_america|asian|concacaf|gold_cup|international/i.test(`${x.key} ${x.title} ${x.description}`));
  console.log(`Football : ${soccer.length} compétitions, dont ${soccer.filter((x) => x.active).length} actives. Coût /sports : ${s.last} crédit(s).`);
  console.log("Compétitions internationales / sélections :");
  for (const x of intl) console.log(`  ${x.active ? "ACTIVE " : "inactive"} ${x.key} — ${x.title} (${x.description})${x.has_outrights ? " [vainqueur final seulement]" : ""}`);
  for (const x of intl.filter((y) => y.active && !y.has_outrights)) {
    const e = await get(`/sports/${x.key}/events`);
    const ev = e.json as { commence_time: string; home_team: string; away_team: string }[];
    console.log(`\n[${x.key}] ${Array.isArray(ev) ? ev.length : 0} matchs à venir (coût ${e.last} crédit)`);
    if (Array.isArray(ev)) for (const m of ev.slice(0, 12)) console.log(`  ${m.commence_time.slice(0, 16).replace("T", " ")} UTC  ${m.home_team} – ${m.away_team}`);
  }
  // Scores : quelle profondeur, quel coût
  const firstActive = intl.find((y) => y.active && !y.has_outrights);
  if (firstActive) {
    const sc = await get(`/sports/${firstActive.key}/scores?daysFrom=3`);
    console.log(`\nScores ${firstActive.key} (3 derniers jours) : ${Array.isArray(sc.json) ? (sc.json as unknown[]).length : JSON.stringify(sc.json).slice(0, 200)} entrées, coût ${sc.last} crédit(s)`);
  }
  console.log(`\nCrédits utilisés ce mois : ${s.used}`);
}
main();
