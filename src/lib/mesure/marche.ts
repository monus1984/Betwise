/**
 * Mesure des probabilités « marché » : celles que l'application affiche quand elle a les cotes de référence d'un match.
 * Pour chaque match terminé, on reprend les dernières cotes relevées AVANT le coup d'envoi, on recalcule les
 * probabilités exactement comme la fiche match (probasMarche), et on les confronte au score.
 */
import { ALL_CANDIDATES, probasMarche, type Cotes5 } from "../probs/signals";
import { issue, type Score } from "./issue";
import { ecartCalibration, logLoss3, resume, tranches, type Obs, type Resume, type Tranche } from "./calibration";

export type MatchMesure = { code: string; cotes: Cotes5; score: Score };
export type TypeFamille = "cote" | "deduit" | "mitemps";

/** Familles de marchés. « cote » : probabilité tirée directement d'une cote ; « deduit » : tirée de la grille de scores ; « mitemps » : grille + hypothèse de 45 % des buts avant la pause. */
export const FAMILLES: { cle: string; nom: string; type: TypeFamille; marches: string[] }[] = [
  { cle: "1X2", nom: "Résultat du match", type: "cote", marches: ["1X2"] },
  { cle: "OU25", nom: "Plus / moins 2,5 buts", type: "cote", marches: ["OU@2.5"] },
  { cle: "DC", nom: "Double chance", type: "deduit", marches: ["DC"] },
  { cle: "DNB", nom: "Remboursé si nul", type: "deduit", marches: ["DNB"] },
  { cle: "OU", nom: "Plus / moins, autres lignes (0,5 à 4,5)", type: "deduit", marches: ["OU"] },
  { cle: "BTTS", nom: "Les deux équipes marquent", type: "deduit", marches: ["BTTS"] },
  { cle: "TT", nom: "Buts d'une équipe", type: "deduit", marches: ["TT1", "TT2"] },
  { cle: "AH", nom: "Handicap ±1,5", type: "deduit", marches: ["AH"] },
  { cle: "COMBO", nom: "Combinés du match (deux conditions)", type: "deduit", marches: ["DC_OU", "1X2_OU", "DC_BTTS", "1X2_BTTS", "OU_BTTS"] },
  { cle: "AUTRES", nom: "Pair / impair, tranche de buts, handicap européen, sans encaisser", type: "deduit", marches: ["OE", "MG", "EH", "WTN"] },
  { cle: "MT1", nom: "1re mi-temps (résultat, buts, les deux marquent)", type: "mitemps", marches: ["HT_1X2", "HT_DC", "HT_OU", "HT_BTTS", "HT_TT1", "HT_TT2"] },
  { cle: "MT2", nom: "2e mi-temps (résultat, buts, les deux marquent)", type: "mitemps", marches: ["H2_1X2", "H2_DC", "H2_OU", "H2_BTTS", "H2_TT1", "H2_TT2"] },
  { cle: "MTX", nom: "Mi-temps / fin, mi-temps la plus prolifique, gagne une mi-temps, but dans les deux", type: "mitemps", marches: ["HTFT", "HMG", "WEH", "BH"] },
];

const PO = ["Plus", "Moins"], ON = ["Oui", "Non"];
/** Tout ce que l'application sait chiffrer : la liste de la fiche match, plus les marchés de mi-temps ajoutés le 18/11. */
export const SELECTIONS: [string, number | null, string][] = [
  ...ALL_CANDIDATES,
  ...["1N", "N2", "12"].map((x) => ["H2_DC", null, x] as [string, null, string]),
  ...ON.map((x) => ["H2_BTTS", null, x] as [string, null, string]),
  ...["HT_TT1", "HT_TT2", "H2_TT1", "H2_TT2"].flatMap((m) => PO.map((x) => [m, 0.5, x] as [string, number, string])),
  ["WEH", null, "1"], ["WEH", null, "2"], ...ON.map((x) => ["BH", null, x] as [string, null, string]),
];

const familleDe = (market: string, param: number | null) =>
  FAMILLES.find((f) => f.marches.includes(`${market}@${param}`)) ?? FAMILLES.find((f) => f.marches.includes(market)) ?? null;

export type MesureFamille = {
  cle: string; nom: string; type: TypeFamille; matchs: number; selections: number;
  /** Sélections que l'application donnait favorites (50 % ou plus) : ce qu'elle annonçait, ce qui est arrivé. */
  favoris: Resume | null;
  /** Toutes les sélections de la famille. */
  tout: Resume; ecart: number;
};
export type MesureMarche = {
  matchs: number;
  familles: MesureFamille[];
  groupes: Record<TypeFamille, { selections: number; tout: Resume | null; ecart: number; tranches: Tranche[] }>;
  resultat: { n: number; logLoss: number; hasard: number; frequences: number } | null;
  parCompetition: { code: string; matchs: number; logLoss: number }[];
  miTemps: { matchs: number; buts: number; butsAvantPause: number; part: number } | null;
};

export function mesurerMarche(matchs: MatchMesure[]): MesureMarche {
  const parFamille = new Map<string, { obs: Obs[]; matchs: Set<number> }>();
  const x12: { p: [number, number, number]; k: 0 | 1 | 2; code: string }[] = [];
  let buts = 0, avant = 0, nMt = 0, n = 0;

  matchs.forEach((m, i) => {
    const sg = probasMarche(m.cotes);
    if (!sg) return;
    n++;
    const p1 = sg.p("1X2", null, "1"), pN = sg.p("1X2", null, "N"), p2 = sg.p("1X2", null, "2");
    if (p1 !== null && pN !== null && p2 !== null) x12.push({ p: [p1, pN, p2], k: m.score.h > m.score.a ? 0 : m.score.h === m.score.a ? 1 : 2, code: m.code });
    if (m.score.hth !== null && m.score.hta !== null) { nMt++; buts += m.score.h + m.score.a; avant += m.score.hth + m.score.hta; }
    for (const [market, param, sel] of SELECTIONS) {
      const f = familleDe(market, param); if (!f) continue;
      const p = sg.p(market, param, sel); if (p === null) continue;
      const r = issue(market, param, sel, m.score);
      if (r !== "gagne" && r !== "perdu") continue; // remboursé ou non calculable : ni gagné ni perdu
      const acc = parFamille.get(f.cle) ?? { obs: [], matchs: new Set<number>() };
      acc.obs.push({ p, y: r === "gagne" ? 1 : 0 }); acc.matchs.add(i);
      parFamille.set(f.cle, acc);
    }
  });

  const familles = FAMILLES.flatMap<MesureFamille>((f) => {
    const acc = parFamille.get(f.cle); if (!acc?.obs.length) return [];
    return [{ cle: f.cle, nom: f.nom, type: f.type, matchs: acc.matchs.size, selections: acc.obs.length, favoris: resume(acc.obs.filter((o) => o.p >= 0.5)), tout: resume(acc.obs)!, ecart: ecartCalibration(acc.obs) }];
  });
  const groupe = (t: TypeFamille) => {
    const obs = FAMILLES.filter((f) => f.type === t).flatMap((f) => parFamille.get(f.cle)?.obs ?? []);
    return { selections: obs.length, tout: resume(obs), ecart: ecartCalibration(obs), tranches: tranches(obs) };
  };
  const freq = x12.length ? ([0, 1, 2] as const).map((k) => x12.filter((r) => r.k === k).length / x12.length) : [1 / 3, 1 / 3, 1 / 3];
  const codes = [...new Set(x12.map((r) => r.code))].sort();

  return {
    matchs: n, familles,
    groupes: { cote: groupe("cote"), deduit: groupe("deduit"), mitemps: groupe("mitemps") },
    resultat: x12.length ? { n: x12.length, logLoss: logLoss3(x12)!, hasard: Math.log(3), frequences: logLoss3(x12.map((r) => ({ p: freq as [number, number, number], k: r.k })))! } : null,
    parCompetition: codes.map((c) => { const xs = x12.filter((r) => r.code === c); return { code: c, matchs: xs.length, logLoss: logLoss3(xs)! }; }),
    miTemps: nMt ? { matchs: nMt, buts, butsAvantPause: avant, part: buts ? avant / buts : 0 } : null,
  };
}
