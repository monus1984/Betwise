/**
 * Sonde : les cotes « 1xBet » du fournisseur sont-elles celles que l'on obtient vraiment sur 1xBet ?
 * Compare chaque cote lue sur un ticket 1xBet importé (odds_observations) à la cote 1xBet du fournisseur pour la même
 * sélection du même match. N'écrit rien ; n'affiche que des cotes (ni mise, ni compte, ni utilisateur).
 * Variables : API_FOOTBALL_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import "dotenv/config";
import { createAdminClient } from "../src/lib/supabase/admin";
import { cleanKey, type AfOdds } from "../src/lib/api-football/client";
import { cotesBookmaker } from "../src/lib/api-football/bookmakers";

async function main() {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) { console.error("API_FOOTBALL_KEY manquant"); process.exit(1); }
  const db = createAdminClient();
  const { data: obs, error } = await db.from("odds_observations")
    .select("match_id, market_code, market_param, selection, cote, observed_at, match:matches(af_fixture_id, kickoff_at)")
    .ilike("bookmaker", "1xbet%").eq("origine", "ticket").order("observed_at", { ascending: false }).limit(300);
  if (error) throw new Error(error.message);
  type M = { af_fixture_id: number | null; kickoff_at: string };
  const rows = (obs ?? []).map((o) => ({ ...o, m: (Array.isArray(o.match) ? o.match[0] : o.match) as M | null })).filter((o) => o.m?.af_fixture_id);
  const fixtures = [...new Set(rows.map((o) => o.m!.af_fixture_id!))].slice(0, 40);
  console.log(`## Cotes de tickets 1xBet : ${rows.length} cotes sur ${fixtures.length} matchs rattachés au fournisseur\n`);
  console.log("| Match (n°) | Marché | Ligne | Sélection | Cote du ticket | Cote 1xBet du fournisseur | Écart | Relevé du fournisseur | Avant le coup d'envoi |");
  console.log("| --- | --- | ---: | --- | ---: | ---: | ---: | --- | ---: |");
  const ratios: number[] = [];
  let sansReleve = 0, sansSelection = 0;
  for (const fx of fixtures) {
    const r = await fetch(`https://v3.football.api-sports.io/odds?fixture=${fx}&bookmaker=11`, { headers: { "x-apisports-key": cleanKey(key) } });
    const j = (await r.json()) as { response?: AfOdds[] };
    const o = j.response?.[0];
    const mine = rows.filter((x) => x.m!.af_fixture_id === fx);
    if (!o) { sansReleve += mine.length; continue; }
    const cotes = cotesBookmaker(o, 11);
    for (const x of mine) {
      const p = x.market_param === null ? null : Number(x.market_param);
      const c = cotes.find((k) => k.m === x.market_code && k.p === p && k.s === x.selection);
      if (!c) { sansSelection++; console.log(`| ${fx} | ${x.market_code} | ${p ?? ""} | ${x.selection} | ${Number(x.cote).toFixed(2)} | — | — | ${o.update ?? "?"} | |`); continue; }
      const ratio = c.c / Number(x.cote);
      ratios.push(ratio);
      const avant = o.update ? Math.round((Date.parse(x.m!.kickoff_at) - Date.parse(o.update)) / 360000) / 10 : null;
      console.log(`| ${fx} | ${x.market_code} | ${p ?? ""} | ${x.selection} | ${Number(x.cote).toFixed(2)} | ${c.c.toFixed(2)} | ${ratio >= 1 ? "+" : "−"}${Math.abs((ratio - 1) * 100).toFixed(1)} % | ${o.update ?? "?"} | ${avant === null ? "?" : `${avant} h`} |`);
    }
  }
  ratios.sort((a, b) => a - b);
  const med = ratios.length ? ratios[ratios.length >> 1] : null;
  console.log(`\nComparables : ${ratios.length} · sans relevé chez le fournisseur : ${sansReleve} · sélection absente du relevé : ${sansSelection}`);
  if (med !== null) console.log(`Cote du fournisseur / cote du ticket — médiane ${med.toFixed(3)} · à ±3 % : ${ratios.filter((x) => Math.abs(x - 1) <= 0.03).length} sur ${ratios.length} · à ±6 % : ${ratios.filter((x) => Math.abs(x - 1) <= 0.06).length} · min ${ratios[0].toFixed(3)} · max ${ratios[ratios.length - 1].toFixed(3)}`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
