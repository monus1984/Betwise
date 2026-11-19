/**
 * Sonde : quels bookmakers et quels marchés les deux fournisseurs de cotes renvoient réellement.
 * Sert à savoir si les cotes de Betclic et de 1xBet peuvent être affichées sans nouveau fournisseur.
 * N'écrit rien en base, n'affiche aucune clé. ≈ 8 requêtes API-Football, 2 crédits The Odds API.
 */
import "dotenv/config";

const AF = "https://v3.football.api-sports.io";
const ODDS = "https://api.the-odds-api.com/v4";
const cible = /1x ?bet|betclic/i;

async function apiFootball(key: string) {
  const get = async (path: string) => (await (await fetch(`${AF}${path}`, { headers: { "x-apisports-key": key } })).json()) as { response?: any[]; paging?: { total: number }; errors?: unknown };
  const bk = await get("/odds/bookmakers");
  const noms = (bk.response ?? []).map((b: { id: number; name: string }) => `${b.name} (${b.id})`);
  console.log(`## API-Football : ${noms.length} bookmakers au catalogue`);
  console.log(noms.join(", "));
  console.log(`Au catalogue — 1xBet : ${noms.some((n) => /1x ?bet/i.test(n)) ? "oui" : "non"} · Betclic : ${noms.some((n) => /betclic/i.test(n)) ? "oui" : "non"}`);
  const ligues: [string, number, number][] = [["Ligue 1 Côte d'Ivoire", 386, 2026], ["Ligue des champions CAF", 12, 2026], ["Coupe de la confédération CAF", 20, 2026], ["Premier League", 39, 2026], ["Ligue 1 France", 61, 2026], ["Ligue des champions UEFA", 2, 2026]];
  for (const [nom, league, season] of ligues) {
    const r = await get(`/odds?league=${league}&season=${season}&page=1`);
    const fx = r.response ?? [];
    console.log(`\n### ${nom} : ${fx.length} matchs avec cotes sur la page 1 (pages : ${r.paging?.total ?? "?"})${r.errors && Object.keys(r.errors as object).length ? ` · erreurs : ${JSON.stringify(r.errors)}` : ""}`);
    if (!fx.length) continue;
    const compte = new Map<string, number>();
    for (const f of fx) for (const b of f.bookmakers ?? []) compte.set(b.name, (compte.get(b.name) ?? 0) + 1);
    console.log(`Bookmakers (nombre de matchs couverts sur ${fx.length}) : ${[...compte.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(", ")}`);
    console.log(`Relevé (update) du premier match : ${fx[0].update ?? "?"}`);
    for (const b of (fx[0].bookmakers ?? []).filter((x: { name: string }) => cible.test(x.name))) {
      console.log(`${b.name} — ${b.bets.length} marchés : ${b.bets.map((x: { name: string; values: unknown[] }) => `${x.name} [${x.values.length}]`).join(" | ")}`);
      // Format exact des valeurs de chaque marché (12 premières), pour écrire la correspondance avec les codes BETWISE
      if (league === 39) for (const x of b.bets as { name: string; values: { value: string | number; odd: string }[] }[]) {
        console.log(`  · ${x.name} : ${x.values.slice(0, 12).map((v) => `${v.value}=${v.odd}`).join(" ; ")}`);
      }
    }
  }
}

/** Le filtre par bookmaker : combien de pages pour une journée, et l'heure de relevé match par match. */
async function filtre1xbet(key: string) {
  const get = async (path: string) => (await (await fetch(`${AF}${path}`, { headers: { "x-apisports-key": key } })).json()) as { response?: any[]; paging?: { total: number }; errors?: unknown };
  for (const [nom, league] of [["Premier League", 39], ["Liga", 140], ["Amicaux", 10], ["Éliminatoires CAN", 36]] as [string, number][]) {
    const r = await get(`/odds?league=${league}&season=${league === 36 ? 2027 : 2026}&bookmaker=11&page=1`);
    const fx = r.response ?? [];
    console.log(`\n### Filtre bookmaker=11 — ${nom} : ${fx.length} matchs page 1 (pages : ${r.paging?.total ?? "?"})`);
    for (const f of fx.slice(0, 12)) console.log(`  match ${f.fixture?.id} · coup d'envoi ${f.fixture?.date} · relevé ${f.update} · bookmakers ${(f.bookmakers ?? []).map((b: { id: number; name: string; bets: unknown[] }) => `${b.name}#${b.id} (${b.bets.length} marchés)`).join(", ")}`);
  }
}

async function oddsApi(key: string) {
  const r = await fetch(`${ODDS}/sports/soccer_epl/odds?regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso&apiKey=${key}`);
  const ev = (await r.json()) as { home_team: string; away_team: string; commence_time: string; bookmakers: { key: string; title: string; last_update: string; markets: { key: string; outcomes: { name: string; price: number; point?: number }[] }[] }[] }[];
  console.log(`\n## The Odds API (région eu, Premier League) : ${Array.isArray(ev) ? ev.length : 0} matchs · coût ${r.headers.get("x-requests-last")} crédits · utilisés ce mois ${r.headers.get("x-requests-used")} · restants ${r.headers.get("x-requests-remaining")}`);
  if (!Array.isArray(ev) || !ev.length) { console.log(JSON.stringify(ev).slice(0, 300)); return; }
  const compte = new Map<string, { titre: string; h2h: number; totals: number }>();
  for (const e of ev) for (const b of e.bookmakers) {
    const c = compte.get(b.key) ?? { titre: b.title, h2h: 0, totals: 0 };
    if (b.markets.some((m) => m.key === "h2h")) c.h2h++;
    if (b.markets.some((m) => m.key === "totals")) c.totals++;
    compte.set(b.key, c);
  }
  console.log(`Bookmakers (clé : titre, matchs avec 1N2 / avec plus-moins, sur ${ev.length}) :`);
  for (const [k, c] of [...compte.entries()].sort((a, b) => b[1].h2h - a[1].h2h)) console.log(`  ${k} : ${c.titre} — ${c.h2h} / ${c.totals}`);
  const e0 = ev[0];
  for (const b of e0.bookmakers.filter((x) => cible.test(`${x.key} ${x.title}`) || x.key === "onexbet")) {
    console.log(`${e0.home_team} – ${e0.away_team} · ${b.title} (relevé ${b.last_update}) : ${b.markets.map((m) => `${m.key} ${m.outcomes.map((o) => `${o.name}${o.point !== undefined ? ` ${o.point}` : ""}=${o.price}`).join(", ")}`).join(" | ")}`);
  }
}

async function main() {
  const af = process.env.API_FOOTBALL_KEY, od = process.env.ODDS_API_KEY;
  if (!af && !od) { console.error("Aucune clé fournie"); process.exit(1); }
  if (af) { await apiFootball(af.trim()); await filtre1xbet(af.trim()); }
  if (od) await oddsApi(od.trim());
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
