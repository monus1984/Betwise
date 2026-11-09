/**
 * Sonde du plan gratuit API-Football : dit en quelques requêtes ce qui est réellement servi.
 * Usage : npm run probe:api-football   (variable API_FOOTBALL_KEY)
 * Coût : 1 + nombre de compétitions sondées (≈ 12 requêtes sur les 100 quotidiennes).
 */
import "dotenv/config";

const BASE = "https://v3.football.api-sports.io";
const KEY = process.env.API_FOOTBALL_KEY ?? "";

// Compétitions internationales et africaines visées (ids API-Football, stables d'une saison à l'autre)
const TARGETS: { id: number; label: string }[] = [
  { id: 1, label: "Coupe du monde" },
  { id: 29, label: "Qualifs CdM — Afrique (CAF)" },
  { id: 32, label: "Qualifs CdM — Europe (UEFA)" },
  { id: 5, label: "Ligue des nations UEFA" },
  { id: 10, label: "Amicaux internationaux" },
  { id: 6, label: "Coupe d'Afrique des nations" },
  { id: 36, label: "Qualifs CAN" },
  { id: 12, label: "Ligue des champions CAF" },
  { id: 20, label: "Coupe de la confédération CAF" },
  { id: 200, label: "Ligue 1 — Côte d'Ivoire" },
  { id: 2, label: "Ligue des champions UEFA" },
  { id: 3, label: "Ligue Europa UEFA" },
];

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": KEY } });
  const remaining = res.headers.get("x-ratelimit-requests-remaining");
  const json = (await res.json()) as { errors?: Record<string, string> | unknown[]; response?: unknown[]; results?: number };
  return { json, remaining };
}

async function main() {
  if (!KEY) { console.error("API_FOOTBALL_KEY manquant"); process.exit(1); }

  const status = await get("/status");
  const sub = (status.json as { response?: { subscription?: { plan: string; end: string }; requests?: { current: number; limit_day: number } } }).response;
  console.log(`Plan : ${sub?.subscription?.plan ?? "?"} · requêtes aujourd'hui : ${sub?.requests?.current ?? "?"}/${sub?.requests?.limit_day ?? "?"}`);

  const year = new Date().getUTCFullYear();
  const seasons = [year, year - 1];
  console.log(`\nSaisons sondées : ${seasons.join(", ")}\n`);
  console.log("| Compétition | Saison | Matchs renvoyés | Prochain match | Verdict |");
  console.log("| --- | --- | --- | --- | --- |");

  for (const t of TARGETS) {
    let verdict = "aucune donnée";
    let line = `| ${t.label} (${t.id}) |`;
    let printed = false;
    for (const season of seasons) {
      const r = await get(`/fixtures?league=${t.id}&season=${season}&next=3`);
      const errs = r.json.errors;
      const hasErr = errs && (Array.isArray(errs) ? errs.length > 0 : Object.keys(errs).length > 0);
      const fixtures = (r.json.response ?? []) as { fixture: { date: string } }[];
      if (hasErr) {
        const msg = Array.isArray(errs) ? JSON.stringify(errs) : Object.values(errs as Record<string, string>).join(" ");
        verdict = msg.toLowerCase().includes("plan") || msg.toLowerCase().includes("season") ? "saison hors plan gratuit" : `erreur : ${msg.slice(0, 60)}`;
        continue;
      }
      if (fixtures.length > 0) {
        console.log(`${line} ${season} | ${fixtures.length} | ${fixtures[0].fixture.date.slice(0, 16).replace("T", " ")} | ✅ servie |`);
        printed = true;
        break;
      }
      verdict = "0 match à venir (hors période ?)";
    }
    if (!printed) console.log(`${line} ${seasons.join("/")} | 0 | — | ${verdict} |`);
  }

  const after = await get("/status");
  const sub2 = (after.json as { response?: { requests?: { current: number; limit_day: number } } }).response;
  console.log(`\nRequêtes consommées par la sonde : ${(sub2?.requests?.current ?? 0) - (sub?.requests?.current ?? 0)}. Restant aujourd'hui : ${(sub2?.requests?.limit_day ?? 100) - (sub2?.requests?.current ?? 0)}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
