/**
 * Objectif de bankroll : deux plans simulés (Monte-Carlo, marge du bookmaker comprise).
 *  - « prudent »  : mises de 3 à 8 % selon la catégorie, Risqué seulement sur le budget risque (30 % des gains) ;
 *  - « objectif » : mise unique et mélange plus offensif, réglés pour maximiser la chance d'atteindre la cible
 *                   sans dépasser 40 % de risque de chute.
 * L'objectif est atteint dès que la bankroll touche la cible (l'abonné peut s'arrêter là).
 * « Chute » : la bankroll passe sous la moitié de son niveau de départ.
 */
import { CAT_ANNONCE, CAT_CONSTATE, MARGE_SUPPOSEE, MISE_PART, PART_GAINS_RISQUABLE, type Categorie } from "./categories";

export type PlanInput = { bankroll: number; depart: number; cible: number; jours: number; parisParJour: number };
export type PlanStats = { pAtteindre: number; pChute: number; mise: number; mix: string };
export type PlanResult = {
  croissanceRequise: number; prudent: PlanStats; objectif: PlanStats;
  raisonnable: { cible: number; plan: PlanStats } | null;
  jours: number;
};

const COTE: Record<Categorie, number> = { sur: (1 / CAT_ANNONCE.sur) * (1 - MARGE_SUPPOSEE), audacieux: (1 / CAT_ANNONCE.audacieux) * (1 - MARGE_SUPPOSEE), risque: (1 / CAT_ANNONCE.risque) * (1 - MARGE_SUPPOSEE) };
type Mix = [Categorie, number][];
const MIX_PRUDENT: Mix = [["sur", 0.5], ["audacieux", 0.4], ["risque", 0.1]];
const MIXES: { mix: Mix; label: string }[] = [
  { mix: [["sur", 0.6], ["audacieux", 0.4]], label: "surtout Sûr" },
  { mix: [["sur", 0.3], ["audacieux", 0.5], ["risque", 0.2]], label: "surtout Audacieux" },
  { mix: [["audacieux", 0.4], ["risque", 0.6]], label: "surtout Risqué" },
];
const FRACTIONS = [0.05, 0.08, 0.1, 0.15, 0.2];

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const pick = (mix: Mix, u: number): Categorie => { let a = 0; for (const [c, w] of mix) { a += w; if (u < a) return c; } return mix[mix.length - 1][0]; };

function simulate(i: PlanInput, target: number, plan: { mix: Mix; f: number | null }, runs = 2000) {
  const r = rng(7);
  let hit = 0, chute = 0;
  const n = Math.max(1, Math.round(i.jours * i.parisParJour));
  for (let k = 0; k < runs; k++) {
    let b = i.bankroll, touched = false, fell = false;
    for (let t = 0; t < n && !touched && b > 1; t++) {
      let cat = pick(plan.mix, r()), mise: number;
      if (plan.f === null) {
        mise = cat === "risque" ? Math.min(Math.max(0, (b - i.depart) * PART_GAINS_RISQUABLE), b * MISE_PART.risque) : b * MISE_PART[cat];
        if (mise <= 0) { cat = "audacieux"; mise = b * MISE_PART.audacieux; }
      } else mise = b * plan.f;
      b += r() < CAT_CONSTATE[cat] ? mise * (COTE[cat] - 1) : -mise;
      if (b >= target) touched = true;
      if (b < i.bankroll * 0.5) fell = true;
    }
    if (touched) hit++; if (fell) chute++;
  }
  return { pAtteindre: hit / runs, pChute: chute / runs };
}

function bestPlan(i: PlanInput, target: number, maxChute = 0.4): PlanStats {
  let best: PlanStats | null = null;
  for (const m of MIXES) for (const f of FRACTIONS) {
    const s = simulate(i, target, { mix: m.mix, f }, 1200);
    if (s.pChute > maxChute) continue;
    if (!best || s.pAtteindre > best.pAtteindre + 0.005) best = { ...s, mise: f, mix: m.label };
  }
  return best ?? { ...simulate(i, target, { mix: MIXES[0].mix, f: 0.05 }), mise: 0.05, mix: MIXES[0].label };
}

export function evaluatePlan(i: PlanInput): PlanResult {
  const prudentSim = simulate(i, i.cible, { mix: MIX_PRUDENT, f: null });
  const prudent: PlanStats = { ...prudentSim, mise: MISE_PART.audacieux, mix: "Sûr et Audacieux, Risqué sur les gains" };
  const objectif = bestPlan(i, i.cible);
  // Objectif raisonnable : la plus haute cible avec au moins une chance sur deux et au plus 20 % de risque de chute
  let raisonnable: PlanResult["raisonnable"] = null;
  for (const x of [1.05, 1.1, 1.15, 1.2, 1.3, 1.4, 1.5, 1.75, 2]) {
    const c = Math.round((i.bankroll * x) / 500) * 500;
    if (c >= i.cible) break;
    const p = bestPlan(i, c, 0.2);
    if (p.pAtteindre >= 0.5) raisonnable = { cible: c, plan: p }; else break;
  }
  return { croissanceRequise: i.cible / i.bankroll - 1, prudent, objectif, raisonnable, jours: i.jours };
}

/** Mises conseillées du jour et budget risque, selon la bankroll et les gains depuis le début de l'objectif. */
export function misesDuJour(bankroll: number, depart: number) {
  const gains = Math.max(0, bankroll - depart);
  const budgetRisque = Math.round((gains * PART_GAINS_RISQUABLE) / 100) * 100;
  const r100 = (x: number) => Math.max(100, Math.round(x / 100) * 100);
  return {
    sur: r100(bankroll * MISE_PART.sur), audacieux: r100(bankroll * MISE_PART.audacieux),
    risque: budgetRisque >= 100 ? Math.min(budgetRisque, r100(bankroll * MISE_PART.risque)) : 0,
    budgetRisque,
  };
}
