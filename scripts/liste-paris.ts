/**
 * Liste ponctuelle de candidats pour une fiche à partager : matchs du jour pas encore commencés, probabilité de l'app
 * (cotes de référence, modèle quand il couvre le match) et cote 1xBet réelle. Aucune écriture en base.
 * Sortie : rapports/liste-paris.json (avec les écussons en base64 pour l'image).
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { createAdminClient } from "../src/lib/supabase/admin";
import { loadSignals, picksOf, pickLabel, releveFrais } from "../src/lib/probs/signals";
import { libelleMarche } from "../src/lib/accueil/regles";
import { logoEquipe } from "../src/lib/logos";
import { COMPETITIONS } from "../src/lib/competitions";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

async function main() {
  const db = createAdminClient();
  const debut = new Date(Date.now() + 40 * 60000).toISOString();
  const fin = process.env.FIN ?? "2026-11-22T23:59:00Z";
  const { data: ms } = await db.from("matches").select("id, kickoff_at, af_home_id, af_away_id, home:teams!matches_home_team_id_fkey(nom, code_externe), away:teams!matches_away_team_id_fkey(nom, code_externe), competition:competitions(code_externe, nom)")
    .eq("statut", "programme").gte("kickoff_at", debut).lte("kickoff_at", fin).order("kickoff_at").limit(300);
  const info = new Map((ms ?? []).map((m) => [m.id, m]));
  const signals = await loadSignals(db as never, [...info.keys()], { bookmakers: true });
  const out: Record<string, unknown>[] = [];
  const logos = new Map<string, string | null>();
  for (const [id, sg] of signals) {
    const m = info.get(id)!;
    const home = one(m.home)?.nom ?? "?", away = one(m.away)?.nom ?? "?";
    const code = one(m.competition)?.code_externe ?? null;
    for (const pk of picksOf(sg, "all")) {
      if (!pk.book || !releveFrais(pk.book.releveAt, m.kickoff_at)) continue;
      out.push({ matchId: id, kickoff: m.kickoff_at, comp: code, compNom: (code && COMPETITIONS[code]?.court) || one(m.competition)?.nom, home, away,
        market: pk.market, param: pk.param, sel: pk.sel, marche: libelleMarche(pk.market), label: pickLabel(pk.market, pk.param, pk.sel, home, away),
        p: pk.p, pModele: pk.pModele, source: sg.source, cote: pk.book.cote, coteRef: pk.cote, releve: pk.book.releveAt });
    }
    for (const [k, l] of [[`${id}:h`, logoEquipe({ af: m.af_home_id, code: one(m.home)?.code_externe })], [`${id}:a`, logoEquipe({ af: m.af_away_id, code: one(m.away)?.code_externe })]] as const) {
      if (!l) { logos.set(k, null); continue; }
      try { const r = await fetch(l); logos.set(k, r.ok ? `data:${r.headers.get("content-type") ?? "image/png"};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}` : null); }
      catch { logos.set(k, null); }
    }
  }
  mkdirSync("rapports", { recursive: true });
  writeFileSync("rapports/liste-paris.json", JSON.stringify({ quand: new Date().toISOString(), matchs: info.size, avecSignal: signals.size, candidats: out, logos: Object.fromEntries(logos) }));
  console.log(`${info.size} matchs, ${signals.size} avec signal, ${out.length} candidats`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : JSON.stringify(e)); process.exit(1); });
