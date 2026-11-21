/**
 * Audit lot 1 (21/11, branche audit-lot1, lecture seule) : forfait et quota API-Football, puis, pour chaque
 * compétition demandée par Mounir, ce que le fournisseur couvre et le nombre de matchs des 7 prochains jours.
 * N'écrit rien en base. Environ 40 requêtes.
 */
const BASE = "https://v3.football.api-sports.io";
const KEY = (process.env.API_FOOTBALL_KEY ?? "").trim().replace(/^["']|["']$/g, "");
let appels = 0;
async function get(path: string): Promise<any> {
  appels++;
  const r = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": KEY } });
  return r.json();
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const VOULUES: [number, string][] = [
  [144, "Belgique D1"], [145, "Belgique D2"], [203, "Turquie D1"], [204, "Turquie D2"], [88, "Pays-Bas D1"], [89, "Pays-Bas D2"],
  [119, "Danemark D1"], [103, "Norvège D1"], [307, "Arabie saoudite D1"], [94, "Portugal D1"], [179, "Écosse D1"], [207, "Suisse D1"],
  [218, "Autriche D1"], [197, "Grèce D1"], [283, "Roumanie D1"], [305, "Qatar D1"],
  [40, "Angleterre D2 (Championship)"], [41, "Angleterre D3 (League One)"], [62, "France D2"], [79, "Allemagne D2"], [136, "Italie D2"], [141, "Espagne D2"],
  [3, "Ligue Europa"], [848, "Ligue Conférence"], [525, "Ligue des champions féminine"],
  [44, "Angleterre D1 féminine"], [64, "France D1 féminine"], [82, "Allemagne D1 féminine"], [142, "Espagne D1 féminine"], [139, "Italie D1 féminine"],
];
async function main() {
  const st = await get("/status");
  const s = st.response ?? {};
  console.log(`## Forfait : ${s.subscription?.plan} · fin ${s.subscription?.end} · requêtes aujourd'hui ${s.requests?.current} / ${s.requests?.limit_day}`);
  const tout = await get("/leagues?current=true");
  const par = new Map<number, any>((tout.response ?? []).map((l: any) => [l.league.id, l]));
  const de = iso(new Date()), a = iso(new Date(Date.now() + 7 * 86400000));
  console.log("id | compétition | nom fournisseur | saison | matchs 7 j | classement | stats match | cotes | prédictions");
  for (const [id, nom] of VOULUES) {
    const l = par.get(id);
    if (!l) { console.log(`${id} | ${nom} | (pas de saison en cours) | — | — | — | — | — | —`); continue; }
    const sa = (l.seasons ?? []).find((x: any) => x.current) ?? {};
    const c = sa.coverage ?? {};
    const fx = await get(`/fixtures?league=${id}&season=${sa.year}&from=${de}&to=${a}`);
    console.log(`${id} | ${nom} | ${l.league.name} (${l.country?.name}) | ${sa.year} | ${fx.results ?? "?"} | ${c.standings ? "oui" : "non"} | ${c.fixtures?.statistics_fixtures ? "oui" : "non"} | ${c.odds ? "oui" : "non"} | ${c.predictions ? "oui" : "non"}`);
  }
  const fin = await get("/status");
  console.log(`\n## Requêtes utilisées par cet audit : ${appels} · compteur du jour maintenant ${fin.response?.requests?.current} / ${fin.response?.requests?.limit_day}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
