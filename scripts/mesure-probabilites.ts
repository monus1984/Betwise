/**
 * Mesure des probabilités affichées par BETWISE, sur les matchs terminés.
 *   1. Probabilités « marché » (cotes de référence relevées avant le coup d'envoi) : marchés cotés et marchés déduits.
 *   2. Coups du jour : probabilité annoncée contre résultat.
 *   3. Modèle maison : rejeu pas à pas sur l'historique des cinq championnats, comparé aux cotes de clôture.
 * Usage : npx tsx scripts/mesure-probabilites.ts [--donnees fichier.json] [--enregistrer]
 *   --donnees     : partie 1 seulement, depuis un jeu de matchs exporté (voir docs/mesures/) ; sans accès à la base.
 *   --enregistrer : écrit le résumé dans betwise.mesures_probabilites (une ligne par famille et par jour de mesure).
 * Variables (sans --donnees) : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. N'écrit rien d'autre.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { pct, type Resume, type Tranche } from "../src/lib/mesure/calibration";
import { mesurerMarche, type MatchMesure, type MesureMarche } from "../src/lib/mesure/marche";
import { METHODE_MARGE, METHODES_MARGE } from "../src/lib/probs/marge";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] ?? "" : null; };
const d3 = (x: number) => x.toFixed(3).replace(".", ",");
const pts = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1).replace(".", ",")}`;
const ic = (r: { ic: [number, number] }) => `${Math.round(r.ic[0] * 100)}–${Math.round(r.ic[1] * 100)} %`;

function tableTranches(titre: string, ts: Tranche[]) {
  console.log(`\n${titre}\n`);
  console.log("| Probabilité annoncée | Sélections | Annoncé en moyenne | Arrivé | Intervalle à 95 % | Écart (points) |");
  console.log("| --- | ---: | ---: | ---: | --- | ---: |");
  for (const t of ts) console.log(`| ${Math.round(t.de * 100)} à ${Math.round(t.a * 100)} % | ${t.n} | ${pct(t.pMoy, 1)} | ${pct(t.freq, 1)} | ${ic(t)} | ${pts(t.freq - t.pMoy)} |`);
}

function rapportMarche(r: MesureMarche, titre?: string) {
  console.log(`\n${titre ?? `## 1. Probabilités « marché » : ${r.matchs} matchs terminés avec des cotes relevées avant le coup d'envoi`}\n`);
  if (r.resultat) {
    console.log(`Résultat du match (1, N, 2), log-loss : **${d3(r.resultat.logLoss)}** · fréquences de base ${d3(r.resultat.frequences)} · hasard ${d3(r.resultat.hasard)} (plus bas = meilleur).`);
    console.log(`Par compétition : ${r.parCompetition.map((c) => `${c.code} ${d3(c.logLoss)} (${c.matchs} matchs)`).join(" · ")}.`);
  }
  console.log("\n| Famille de marchés | Origine | Matchs | Sélections | Favoris (≥ 50 %) : annoncé | arrivé | écart (points) | Écart moyen de calibration | Gain sur la moyenne |");
  console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  const origine = { cote: "cote directe", deduit: "déduit", mitemps: "déduit, mi-temps" } as const;
  for (const f of r.familles) {
    const fav = f.favoris;
    console.log(`| ${f.nom} | ${origine[f.type]} | ${f.matchs} | ${f.selections} | ${fav ? pct(fav.pMoy, 1) : "—"} | ${fav ? pct(fav.freq, 1) : "—"} | ${fav ? pts(fav.freq - fav.pMoy) : "—"} | ${pts(f.ecart).slice(1)} | ${pct(f.tout.gain, 1)} |`);
  }
  tableTranches("### Marchés cotés (résultat, plus/moins 2,5) : annoncé contre arrivé", r.groupes.cote.tranches);
  tableTranches("### Marchés déduits de la grille de scores (hors mi-temps)", r.groupes.deduit.tranches);
  if (r.groupes.mitemps.tranches.length) tableTranches("### Marchés de mi-temps", r.groupes.mitemps.tranches);
  if (r.miTemps) console.log(`\nButs avant la pause : ${r.miTemps.butsAvantPause} sur ${r.miTemps.buts} (${pct(r.miTemps.part, 1)}) sur ${r.miTemps.matchs} matchs. L'application suppose 45 %.`);
}

/** Les trois façons de retirer la marge, sur les mêmes matchs : laquelle annonce le plus juste ? */
function rapportMethodes(matchs: MatchMesure[]) {
  console.log("\n### Retrait de la marge : trois méthodes sur les mêmes matchs\n");
  console.log("| Méthode | Log-loss du résultat | Marchés cotés : écart moyen | favoris ≥ 60 % (sélections) | annoncé | arrivé | écart | outsiders < 20 % : écart | Marchés déduits : écart moyen | favoris ≥ 60 % : écart | Mi-temps : écart moyen |");
  console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const m of METHODES_MARGE) {
    const r = mesurerMarche(matchs, m), c = r.groupes.cote, d = r.groupes.deduit, t = r.groupes.mitemps;
    const e = (x: Resume | null) => (x ? pts(x.freq - x.pMoy) : "—");
    console.log(`| ${m}${m === METHODE_MARGE ? " (application)" : ""} | ${r.resultat ? d3(r.resultat.logLoss) : "—"} | ${pts(c.ecart).slice(1)} | ${c.favoris?.n ?? 0} | ${c.favoris ? pct(c.favoris.pMoy, 1) : "—"} | ${c.favoris ? pct(c.favoris.freq, 1) : "—"} | ${e(c.favoris)} | ${e(c.outsiders)} | ${pts(d.ecart).slice(1)} | ${e(d.favoris)} | ${t.selections ? pts(t.ecart).slice(1) : "—"} |`);
  }
}

const resumeVersLigne = (r: Resume) => ({ n: r.n, proba_moyenne: r.pMoy, frequence: r.freq, brier: r.brier, brier_reference: r.brierRef, log_loss: r.logLoss });

async function main() {
  const fichier = arg("--donnees");
  console.log(`# Mesure des probabilités BETWISE — ${new Date().toISOString().slice(0, 10)}\n`);
  if (fichier) {
    const lignes = JSON.parse(readFileSync(fichier, "utf8")) as [string, number, number, number, number | null, number | null, number, number, number | null, number | null][];
    const matchs: MatchMesure[] = lignes.map(([code, c1, cN, c2, plus25, moins25, h, a, hth, hta]) => ({ code, cotes: { c1, cN, c2, plus25, moins25 }, score: { h, a, hth, hta } }));
    rapportMarche(mesurerMarche(matchs));
    rapportMethodes(matchs);
    return;
  }
  const { mesurerDepuisLaBase } = await import("./mesure/base");
  await mesurerDepuisLaBase({ enregistrer: process.argv.includes("--enregistrer"), rapportMarche, rapportMethodes, resumeVersLigne });
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
