/**
 * Découverte API-Football (offre payante) : identifiants et saison en cours des compétitions visées,
 * et richesse réelle des données sur deux matchs témoins. ≈ 25 requêtes.
 */
import "dotenv/config";
const BASE = "https://v3.football.api-sports.io";
const KEY = process.env.API_FOOTBALL_KEY ?? "";
let calls = 0;
async function get<T = any>(path: string): Promise<{ response: T[]; errors: unknown; results: number }> {
  calls++;
  const r = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": KEY } });
  return (await r.json()) as never;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const all = await get(`/leagues?current=true`);
  const ls = all.response ?? [];
  const countries = new Set(ls.map((l: any) => l.country?.name));
  console.log(`## ${ls.length} compétitions en cours dans ${countries.size} pays · Afrique de l'Ouest : ${["Ivory-Coast", "Senegal", "Ghana", "Nigeria", "Mali", "Burkina-Faso", "Cameroon", "Morocco", "Algeria", "Tunisia", "Egypt", "South-Africa"].filter((c) => countries.has(c)).join(", ")}`);
  const want = ls.filter((l: any) => (l.country?.name === "World" && /africa|caf |caf$|nations|friendl|world cup|champions league|europa|conference|euro|olympi|club world/i.test(l.league.name)) || l.country?.name === "Ivory-Coast" || [39, 140, 135, 78, 61].includes(l.league.id));
  for (const l of want) {
    const s = (l.seasons ?? []).find((x: any) => x.current) ?? {};
    const c = s.coverage ?? {};
    console.log(`${l.league.id} | ${l.league.name} | ${l.country?.name} | saison ${s.year} (${s.start}→${s.end}) | évén.${c.fixtures?.events ? "✓" : "✗"} compos${c.fixtures?.lineups ? "✓" : "✗"} stats${c.fixtures?.statistics_fixtures ? "✓" : "✗"} cotes${c.odds ? "✓" : "✗"} préd.${c.predictions ? "✓" : "✗"} bless.${c.injuries ? "✓" : "✗"}`);
  }

  console.log("\n## Match à venir témoin (Ligue des nations)");
  const up = await get(`/fixtures?league=5&season=2026&from=${iso(new Date())}&to=${iso(new Date(Date.now() + 3 * 86400000))}`);
  const f = up.response?.[0];
  if (f) {
    console.log(`${f.fixture.id} ${f.teams.home.name} – ${f.teams.away.name} ${f.fixture.date} statut ${f.fixture.status.short}`);
    const od = await get(`/odds?fixture=${f.fixture.id}`);
    const bk = od.response?.[0]?.bookmakers ?? [];
    console.log(`cotes : ${bk.length} bookmakers (${bk.slice(0, 8).map((b: any) => b.name).join(", ")}) · marchés chez le premier : ${(bk[0]?.bets ?? []).length} (${(bk[0]?.bets ?? []).slice(0, 10).map((b: any) => b.name).join(", ")})`);
    const pr = await get(`/predictions?fixture=${f.fixture.id}`);
    const p = pr.response?.[0];
    console.log(`prédiction : ${p ? `${JSON.stringify(p.predictions?.percent)} · conseil « ${p.predictions?.advice} » · forme ${p.teams?.home?.league?.form ?? "?"} / ${p.teams?.away?.league?.form ?? "?"} · h2h ${p.h2h?.length ?? 0}` : "aucune"}`);
    const inj = await get(`/injuries?fixture=${f.fixture.id}`);
    console.log(`blessures/absents : ${inj.results ?? 0}`);
  } else console.log("aucun match trouvé", JSON.stringify(up.errors));

  console.log("\n## Match terminé témoin (Premier League, dernier week-end)");
  const past = await get(`/fixtures?league=39&season=2026&from=${iso(new Date(Date.now() - 6 * 86400000))}&to=${iso(new Date())}&status=FT`);
  const g = past.response?.[0];
  if (g) {
    console.log(`${g.fixture.id} ${g.teams.home.name} ${g.goals.home}–${g.goals.away} ${g.teams.away.name}`);
    const st = await get(`/fixtures/statistics?fixture=${g.fixture.id}`);
    console.log(`stats : ${(st.response?.[0]?.statistics ?? []).map((x: any) => `${x.type}=${x.value}`).join(" ; ")}`);
    const lu = await get(`/fixtures/lineups?fixture=${g.fixture.id}`);
    console.log(`compositions : ${lu.results ?? 0} équipes · ${lu.response?.[0]?.formation ?? "?"} · ${(lu.response?.[0]?.startXI ?? []).length} titulaires`);
    const ev = await get(`/fixtures/events?fixture=${g.fixture.id}`);
    console.log(`événements : ${ev.results ?? 0}`);
  } else console.log("aucun match trouvé", JSON.stringify(past.errors));

  const live = await get(`/fixtures?live=all`);
  console.log(`\n## Direct : ${live.results ?? 0} matchs en cours dans le monde en ce moment`);
  const st = await get(`/status`);
  console.log(`Requêtes de ce script : ${calls} · compteur du jour : ${(st.response as any)?.requests?.current ?? "?"}/${(st.response as any)?.requests?.limit_day ?? "?"}`);
}
main();
