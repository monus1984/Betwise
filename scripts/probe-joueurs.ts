/**
 * Sonde : statistiques par joueur d'API-Football sur des matchs terminés. N'écrit rien.
 * Compare /fixtures?ids=… (déjà appelé par l'import) et /fixtures/players?fixture=… (une requête par match).
 * Variable : API_FOOTBALL_KEY
 */
import "dotenv/config";
import { cleanKey } from "../src/lib/api-football/client";

const IDS = [1528984, 1528983, 1528982, 1528961];
async function get(path: string) {
  const r = await fetch(`https://v3.football.api-sports.io${path}`, { headers: { "x-apisports-key": cleanKey(process.env.API_FOOTBALL_KEY ?? "") } });
  return { quota: r.headers.get("x-ratelimit-requests-remaining"), j: (await r.json()) as { response: any[]; errors: unknown } };
}
async function main() {
  const a = await get(`/fixtures?ids=${IDS.join("-")}`);
  for (const f of a.j.response) {
    console.log(`## fixtures?ids ${f.fixture.id} ${f.teams.home.name}-${f.teams.away.name} : clés ${Object.keys(f).join(",")}`);
    const pl = f.players as any[] | undefined;
    console.log(`   players : ${pl ? pl.map((t) => `${t.team.name} ${t.players.length}`).join(" / ") : "absent"} ; lineups : ${(f.lineups ?? []).length}`);
  }
  const b = await get(`/fixtures/players?fixture=${IDS[0]}`);
  console.log(`\n## fixtures/players ${IDS[0]} : erreurs ${JSON.stringify(b.j.errors)} ; équipes ${b.j.response.length}`);
  for (const t of b.j.response) {
    console.log(`### ${t.team.name} : ${t.players.length} joueurs`);
    for (const p of t.players) {
      const s = p.statistics[0];
      console.log(`${p.player.name} | id ${p.player.id} | min ${s.games.minutes} | rempl ${s.games.substitute} | tirs ${s.shots.total} | cadrés ${s.shots.on} | buts ${s.goals.total} | passes déc ${s.goals.assists} | jaunes ${s.cards.yellow} | rouges ${s.cards.red} | fautes ${s.fouls.committed}`);
    }
  }
  const s0 = b.j.response[0]?.players[0]?.statistics[0];
  console.log(`\nclés d'une fiche : ${s0 ? Object.keys(s0).join(",") : "?"}`);
  console.log(`quota restant : ${b.quota}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
