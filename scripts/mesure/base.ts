/**
 * Mesure des probabilités à partir de la base (lecture seule, sauf --enregistrer qui écrit le résumé).
 * Lancé par scripts/mesure-probabilites.ts ; séparé pour que la partie « jeu de données » tourne sans accès à la base.
 */
import { createAdminClient } from "../../src/lib/supabase/admin";
import { MODEL_OPTS } from "../../src/lib/model/run";
import { ecartCalibration, logLoss3, pct, rendement, resume, tranches, type Obs, type Resume } from "../../src/lib/mesure/calibration";
import { mesurerMarche, type MatchMesure, type MesureMarche } from "../../src/lib/mesure/marche";
import { proportionnelle, puissance } from "../../src/lib/probs/marge";
import { rejouerModele, type MatchHist } from "../../src/lib/mesure/modele";
import { normalizeTeam, teamSimilarity } from "../../src/lib/odds-api/client";

type Db = ReturnType<typeof createAdminClient>;
const d3 = (x: number) => x.toFixed(3).replace(".", ",");
const pts = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1).replace(".", ",")}`;
const LIGUES: Record<number, string> = { 39: "E0", 140: "SP1", 135: "I1", 78: "D1", 61: "F1" };
const NOM_LIGUE: Record<string, string> = { E0: "Premier League", SP1: "Liga", I1: "Serie A", D1: "Bundesliga", F1: "Ligue 1" };

/** Lit une table entière par pages de 1 000 lignes. */
async function tout<T>(page: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await page(de, de + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** 1. Matchs suivis par l'application : dernières cotes de référence relevées avant le coup d'envoi. */
async function matchsSuivis(db: Db): Promise<MatchMesure[]> {
  type M = { id: string; kickoff_at: string; score_home: number; score_away: number; ht_home: number | null; ht_away: number | null; competition: { code_externe: string | null } | { code_externe: string | null }[] | null };
  const ms = await tout<M>((de, a) => db.from("matches").select("id, kickoff_at, score_home, score_away, ht_home, ht_away, competition:competitions(code_externe)").eq("statut", "termine").not("score_home", "is", null).order("kickoff_at").order("id").range(de, a) as never);
  const out: MatchMesure[] = [];
  for (let i = 0; i < ms.length; i += 50) {
    const lot = ms.slice(i, i + 50);
    type O = { match_id: string; market_code: string; market_param: number | null; selection: string; cote: number; observed_at: string };
    const odds = await tout<O>((de, a) => db.from("odds_observations").select("match_id, market_code, market_param, selection, cote, observed_at").eq("bookmaker", "ref:eu-median").in("match_id", lot.map((m) => m.id)).order("observed_at", { ascending: false }).order("id").range(de, a) as never);
    for (const m of lot) {
      const avant = odds.filter((o) => o.match_id === m.id && o.observed_at < m.kickoff_at); // déjà triées de la plus récente à la plus ancienne
      const c = (market: string, sel: string) => { const o = avant.find((x) => x.market_code === market && x.selection === sel); return o ? Number(o.cote) : null; };
      const cotes = { c1: c("1X2", "1"), cN: c("1X2", "N"), c2: c("1X2", "2"), plus25: c("OU", "Plus"), moins25: c("OU", "Moins") };
      if (!cotes.c1 || !cotes.cN || !cotes.c2) continue;
      const comp = Array.isArray(m.competition) ? m.competition[0] : m.competition;
      out.push({ code: comp?.code_externe ?? "?", cotes, score: { h: m.score_home, a: m.score_away, hth: m.ht_home, hta: m.ht_away } });
    }
  }
  return out;
}

function ligneResume(nom: string, r: Resume | null, extra = "") {
  return r ? `| ${nom} | ${r.n} | ${pct(r.pMoy, 1)} | ${pct(r.freq, 1)} | ${Math.round(r.ic[0] * 100)}–${Math.round(r.ic[1] * 100)} % | ${pts(r.freq - r.pMoy)} |${extra}` : `| ${nom} | 0 | — | — | — | — |${extra}`;
}

/** 2. Coups du jour : ce que l'application annonçait, ce qui est arrivé. */
async function coupsDuJour(db: Db) {
  type P = { jour: string; categorie: string; probabilite: number; cote_ref: number | null; prediction_id: string | null };
  const picks = await tout<P>((de, a) => db.from("daily_picks").select("jour, categorie, probabilite, cote_ref, prediction_id").order("jour").order("id").range(de, a) as never);
  const ids = picks.map((p) => p.prediction_id).filter((x): x is string => !!x);
  const res = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from("predictions").select("id, resultat").in("id", ids.slice(i, i + 100));
    if (error) throw new Error(error.message);
    for (const r of data ?? []) res.set(r.id, r.resultat);
  }
  const regles = picks.flatMap((p) => { const r = p.prediction_id ? res.get(p.prediction_id) : null; return r === "gagne" || r === "perdu" ? [{ ...p, y: (r === "gagne" ? 1 : 0) as 0 | 1 }] : []; });
  console.log(`\n## 2. Coups du jour : ${regles.length} réglés sur ${picks.length} publiés (${new Set(picks.map((p) => p.jour)).size} jours)\n`);
  console.log("| Catégorie | Réglés | Annoncé en moyenne | Arrivé | Intervalle à 95 % | Écart (points) | Rendement à la cote de référence |");
  console.log("| --- | ---: | ---: | ---: | --- | ---: | ---: |");
  const lignes: { cle: string; libelle: string; r: Resume }[] = [];
  for (const cat of ["Tous", ...new Set(regles.map((p) => p.categorie))]) {
    const xs = regles.filter((p) => cat === "Tous" || p.categorie === cat);
    const r = resume(xs.map((p) => ({ p: Number(p.probabilite), y: p.y })));
    const rd = rendement(xs.filter((p) => p.cote_ref).map((p) => ({ cote: Number(p.cote_ref), y: p.y })));
    console.log(ligneResume(cat, r, ` ${rd === null ? "—" : pts(rd)} % |`));
    if (r) lignes.push({ cle: cat, libelle: `Coups du jour — ${cat}`, r });
  }
  return lignes;
}

/** 3. Historique des cinq championnats (cotes moyennes de clôture) : mêmes calculs que l'application, sur des milliers de matchs. */
async function historique(db: Db, rapportMarche: (r: MesureMarche, titre: string) => void, rapportMethodes: (m: MatchMesure[]) => void) {
  type H = { ligue: string; played_on: string; home_nom: string; away_nom: string; home_goals: number; away_goals: number; cote_1: number | null; cote_n: number | null; cote_2: number | null; cote_plus25: number | null; cote_moins25: number | null; ht_home_goals: number | null; ht_away_goals: number | null };
  const hs = await tout<H>((de, a) => db.from("match_history").select("ligue, played_on, home_nom, away_nom, home_goals, away_goals, cote_1, cote_n, cote_2, cote_plus25, cote_moins25, ht_home_goals, ht_away_goals").order("played_on").order("id").range(de, a) as never);
  const cotes = hs.filter((h) => h.cote_1 && h.cote_n && h.cote_2);
  const matchs: MatchMesure[] = cotes.map((h) => ({ code: h.ligue, cotes: { c1: Number(h.cote_1), cN: Number(h.cote_n), c2: Number(h.cote_2), plus25: h.cote_plus25 ? Number(h.cote_plus25) : null, moins25: h.cote_moins25 ? Number(h.cote_moins25) : null }, score: { h: h.home_goals, a: h.away_goals, hth: h.ht_home_goals, hta: h.ht_away_goals } }));
  const r = mesurerMarche(matchs);
  rapportMarche(r, `## 3. Mêmes calculs sur l'historique des cinq championnats : ${r.matchs} matchs du ${hs[0]?.played_on ?? "?"} au ${hs[hs.length - 1]?.played_on ?? "?"}, cotes moyennes de clôture`);
  rapportMethodes(matchs);

  return { hs, r };
}

/** 4. Modèle maison rejoué semaine après semaine, comparé aux cotes de clôture sur les mêmes matchs. */
async function modele(db: Db, hs: { ligue: string; played_on: string; home_nom: string; away_nom: string; home_goals: number; away_goals: number; cote_1: number | null; cote_n: number | null; cote_2: number | null }[]) {
  type A = { league: number; played_at: string; home_id: number; home_nom: string; away_id: number; away_nom: string; home_goals: number; away_goals: number; xg_home: number | null; xg_away: number | null };
  const af = await tout<A>((de, a) => db.from("af_history").select("league, played_at, home_id, home_nom, away_id, away_nom, home_goals, away_goals, xg_home, xg_away").order("played_at").order("fixture_id").range(de, a) as never);
  const noms = new Map<string, string>();
  const matchs: MatchHist[] = af.filter((m) => LIGUES[m.league]).map((m) => {
    noms.set(String(m.home_id), m.home_nom); noms.set(String(m.away_id), m.away_nom);
    return { ligue: LIGUES[m.league], date: new Date(m.played_at), home: String(m.home_id), away: String(m.away_id), hg: m.home_goals, ag: m.away_goals, xh: m.xg_home === null ? null : Number(m.xg_home), xa: m.xg_away === null ? null : Number(m.xg_away) };
  });
  const pr = rejouerModele(matchs, MODEL_OPTS);
  console.log(`\n## 4. Modèle maison rejoué semaine après semaine : ${pr.length} matchs prédits sur ${matchs.length} en historique (${matchs[0]?.date.toISOString().slice(0, 10) ?? "?"} → ${matchs[matchs.length - 1]?.date.toISOString().slice(0, 10) ?? "?"})\n`);
  if (!pr.length) return [];

  // Cotes de clôture du même match : même championnat, même score, date à un jour près, noms les plus proches
  const jour = (d: Date) => Math.round(d.getTime() / 86400000);
  let rapproches = 0;
  const paires = pr.map((p) => {
    const cands = hs.filter((h) => h.ligue === p.ligue && h.home_goals === p.hg && h.away_goals === p.ag && h.cote_1 && h.cote_n && h.cote_2 && Math.abs(jour(new Date(h.played_on)) - jour(p.date)) <= 1);
    const note = (h: (typeof hs)[number]) => teamSimilarity(noms.get(p.home) ?? "", h.home_nom) + teamSimilarity(noms.get(p.away) ?? "", h.away_nom)
      + (normalizeTeam(noms.get(p.home) ?? "").startsWith(normalizeTeam(h.home_nom).slice(0, 4)) ? 0.5 : 0) + (normalizeTeam(noms.get(p.away) ?? "").startsWith(normalizeTeam(h.away_nom).slice(0, 4)) ? 0.5 : 0);
    const best = cands.length === 1 ? cands[0] : cands.sort((a, b) => note(b) - note(a))[0];
    const ok = best && (cands.length === 1 || note(best) > 0);
    if (ok) rapproches++;
    return { p, marche: ok ? (proportionnelle([Number(best.cote_1), Number(best.cote_n), Number(best.cote_2)]) as [number, number, number]) : null };
  });
  const k = (p: { hg: number; ag: number }): 0 | 1 | 2 => (p.hg > p.ag ? 0 : p.hg === p.ag ? 1 : 2);
  const communs = paires.filter((x) => x.marche);
  const freq = ([0, 1, 2] as const).map((i) => communs.filter((x) => k(x.p) === i).length / Math.max(1, communs.length)) as [number, number, number];
  console.log(`Résultat du match, log-loss sur les ${communs.length} matchs où les cotes de clôture sont retrouvées (${rapproches} sur ${pr.length}) :`);
  console.log(`modèle **${d3(logLoss3(communs.map((x) => ({ p: x.p.p, k: k(x.p) })))!)}** · cotes de clôture **${d3(logLoss3(communs.map((x) => ({ p: x.marche!, k: k(x.p) })))!)}** · fréquences de base ${d3(logLoss3(communs.map((x) => ({ p: freq, k: k(x.p) })))!)} · hasard ${d3(Math.log(3))} (plus bas = meilleur).\n`);

  const obs1x2: Obs[] = pr.flatMap((p) => p.p.map((x, i) => ({ p: x, y: (k(p) === i ? 1 : 0) as 0 | 1 })));
  const obsOU: Obs[] = pr.map((p) => ({ p: p.pPlus25, y: (p.hg + p.ag > 2.5 ? 1 : 0) as 0 | 1 }));
  const obsBT: Obs[] = pr.map((p) => ({ p: p.pBtts, y: (p.hg > 0 && p.ag > 0 ? 1 : 0) as 0 | 1 }));
  console.log("| Marché (modèle) | Sélections | Écart moyen de calibration (points) | Gain sur la moyenne | Favoris ≥ 50 % : annoncé | arrivé | écart (points) |");
  console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  const lignes: { cle: string; libelle: string; r: Resume }[] = [];
  for (const [cle, nom, obs] of [["1X2", "Résultat du match", obs1x2], ["OU25", "Plus de 2,5 buts", obsOU], ["BTTS", "Les deux marquent", obsBT]] as [string, string, Obs[]][]) {
    const r = resume(obs)!, fav = resume(obs.filter((o) => o.p >= 0.5));
    console.log(`| ${nom} | ${r.n} | ${pts(ecartCalibration(obs)).slice(1)} | ${pct(r.gain, 1)} | ${fav ? pct(fav.pMoy, 1) : "—"} | ${fav ? pct(fav.freq, 1) : "—"} | ${fav ? pts(fav.freq - fav.pMoy) : "—"} |`);
    lignes.push({ cle, libelle: `Modèle rejoué — ${nom}`, r });
  }
  console.log("\n### Modèle, résultat du match : annoncé contre arrivé\n");
  console.log("| Probabilité annoncée | Sélections | Annoncé en moyenne | Arrivé | Écart (points) |");
  console.log("| --- | ---: | ---: | ---: | ---: |");
  for (const t of tranches(obs1x2)) console.log(`| ${Math.round(t.de * 100)} à ${Math.round(t.a * 100)} % | ${t.n} | ${pct(t.pMoy, 1)} | ${pct(t.freq, 1)} | ${pts(t.freq - t.pMoy)} |`);
  console.log(`\nPar championnat (log-loss du modèle) : ${[...new Set(pr.map((p) => p.ligue))].map((l) => { const xs = pr.filter((p) => p.ligue === l); return `${NOM_LIGUE[l] ?? l} ${d3(logLoss3(xs.map((p) => ({ p: p.p, k: k(p) })))!)} (${xs.length})`; }).join(" · ")}.`);
  return lignes;
}

export async function mesurerDepuisLaBase(o: { enregistrer: boolean; rapportMarche: (r: MesureMarche, titre?: string) => void; rapportMethodes: (m: MatchMesure[]) => void; resumeVersLigne: (r: Resume) => Record<string, number> }) {
  const db = createAdminClient();
  const ms = await matchsSuivis(db);
  const suivis = mesurerMarche(ms);
  o.rapportMarche(suivis);
  o.rapportMethodes(ms);
  const cdj = await coupsDuJour(db);
  const { hs, r: ligues } = await historique(db, o.rapportMarche as never, o.rapportMethodes);
  const mod = await modele(db, hs);

  if (!o.enregistrer) return;
  const jour = new Date().toISOString().slice(0, 10);
  const rows = [
    ...suivis.familles.map((f) => ({ perimetre: "marche", cle: f.cle, libelle: f.nom, ...o.resumeVersLigne(f.tout), detail: { type: f.type, matchs: f.matchs, ecart: f.ecart, favoris: f.favoris } })),
    ...ligues.familles.map((f) => ({ perimetre: "ligues", cle: f.cle, libelle: f.nom, ...o.resumeVersLigne(f.tout), detail: { type: f.type, matchs: f.matchs, ecart: f.ecart, favoris: f.favoris } })),
    ...(["cote", "deduit", "mitemps"] as const).flatMap((t) => (suivis.groupes[t].tout ? [{ perimetre: "marche", cle: `groupe:${t}`, libelle: `Ensemble « ${t} »`, ...o.resumeVersLigne(suivis.groupes[t].tout!), detail: { tranches: suivis.groupes[t].tranches, ecart: suivis.groupes[t].ecart } }] : [])),
    ...cdj.map((x) => ({ perimetre: "coups_du_jour", cle: x.cle, libelle: x.libelle, ...o.resumeVersLigne(x.r), detail: null })),
    ...mod.map((x) => ({ perimetre: "modele", cle: x.cle, libelle: x.libelle, ...o.resumeVersLigne(x.r), detail: null })),
  ].map((x) => ({ mesure_le: jour, ...x }));
  const { error } = await db.from("mesures_probabilites").upsert(JSON.parse(JSON.stringify(rows)), { onConflict: "mesure_le,perimetre,cle" });
  if (error) throw new Error(error.message);
  console.log(`\nRésumé enregistré : ${rows.length} lignes pour le ${jour}.`);
}
