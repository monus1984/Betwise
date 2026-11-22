/**
 * Tipster à règles fixes, témoin sans IA (créé le 22/11/2026 sous le nom « Claude · tipster virtuel »).
 *
 * Le principe : parier seulement quand 1xBet paie une sélection plus cher que sa valeur juste. La valeur juste vient
 * des cotes de référence (médiane des bookmakers européens, marge retirée), corrigée un peu par le modèle BETWISE
 * quand il couvre le match. Aucune garantie : un écart positif ne dit pas que le pari passera, il dit seulement que
 * le prix est meilleur que celui du marché. C'est ce que la simulation doit vérifier dans la durée.
 *
 * Règles fixées ici, en simple, pour qu'on puisse les relire et les contester :
 *  - paris simples uniquement, match pas encore commencé ;
 *  - les deux prix comparés doivent avoir été relevés à peu près au même moment (3 h d'écart au plus) et la cote 1xBet
 *    depuis moins de 6 h : sinon l'écart mesuré peut n'être qu'un mouvement de cote entre deux relevés (défaut constaté
 *    sur les trois premiers paris du 22/11 : référence de la veille 15 h 17, 1xBet de minuit) ;
 *  - jamais d'amical, jamais de cote au-dessus de 3,20 (au-delà, trop peu de paris pour juger un marché) ;
 *  - si le modèle est nettement moins optimiste que le marché (8 points), on s'abstient ;
 *  - écart minimum exigé : +1 % en Prudent, +2 % en Équilibré, +4 % en Audacieux (plus la cote monte, plus l'erreur
 *    possible sur la valeur juste est grande) ;
 *  - au plus 2 paris par profil et 6 par jour, un seul par match, 3 au plus de la même famille de marchés ;
 *  - mise : un quart du critère de Kelly, entre 0,5 % et 3 % de la bankroll du moment, arrondie à 100 FCFA.
 */
import { profilDe, type Categorie } from "../coach/categories";
import { familleOf } from "../probs/signals";

/** Témoin sans IA (22/11) : des règles fixes écrites dans ce fichier, à comparer aux tipsters IA. */
export const TIPSTER_NOM = "Tipster BETWISE (règles)";
export const ANCIEN_NOM = "Claude · tipster virtuel";
export const BANKROLL_DEPART = 100_000;
export const COTE_MAX = 3.2;
export const DESACCORD_MAX = 0.08;
export const POIDS_MODELE = 0.2;
export const SEUIL: Record<Categorie, number> = { sur: 0.01, audacieux: 0.02, risque: 0.04 };
export const LIMITES = { parProfil: 2, parJour: 6, parFamille: 3 } as const;
/** Fraîcheur exigée des deux relevés de cote, en heures. */
export const RELEVES = { ecartMax: 3, ageMax1xBet: 6 } as const;
export const MISE = { kelly: 0.25, min: 0.005, max: 0.03, arrondi: 100 } as const;

export type Candidat = {
  matchId: string; kickoff: string; comp: string | null;
  market: string; param: number | null; sel: string;
  /** Probabilité tirée des cotes de référence. */
  p: number;
  /** Avis du modèle sur la même sélection, s'il couvre le match. */
  pModele: number | null;
  /** Cote réelle 1xBet. */
  cote: number;
  /** Cote médiane de référence, si elle existe. */
  coteRef: number | null;
  /** Heure du relevé de la cote 1xBet chez le fournisseur, et du dernier relevé des cotes de référence. */
  coteAt: string; refAt: string | null;
};
export type Evalue = Candidat & { pJuste: number; valeur: number; kelly: number; profil: Categorie; famille: string };
export type DejaJoue = { matchs: Set<string>; parProfil: Record<Categorie, number>; parFamille: Record<string, number>; total: number };

/** Les deux relevés sont-ils assez récents et assez proches pour être comparés ? */
export function relevesComparables(c: Pick<Candidat, "coteAt" | "refAt">, now = Date.now()): boolean {
  const b = Date.parse(c.coteAt), r = c.refAt ? Date.parse(c.refAt) : NaN;
  if (!Number.isFinite(b) || !Number.isFinite(r)) return false;
  return Math.abs(b - r) <= RELEVES.ecartMax * 3600000 && now - b <= RELEVES.ageMax1xBet * 3600000;
}

/** Note une sélection ; null si elle ne remplit pas les règles. */
export function evaluer(c: Candidat, now = Date.now()): Evalue | null {
  if (c.comp === "AMI") return null;
  if (!relevesComparables(c, now)) return null;
  if (!(c.cote > 1) || c.cote > COTE_MAX || !(c.p > 0 && c.p < 1)) return null;
  const profil = profilDe(c.p, c.cote);
  if (!profil) return null;
  if (c.pModele !== null && c.pModele < c.p - DESACCORD_MAX) return null;
  const pJuste = c.pModele === null ? c.p : (1 - POIDS_MODELE) * c.p + POIDS_MODELE * c.pModele;
  const valeur = pJuste * c.cote - 1;
  if (valeur < SEUIL[profil]) return null;
  return { ...c, pJuste, valeur, kelly: valeur / (c.cote - 1), profil, famille: familleOf(c.market) };
}

/** Choisit les paris du passage, en tenant compte de ce qui a déjà été joué dans la journée. */
export function choisir(cands: Candidat[], deja: DejaJoue, now = Date.now()): Evalue[] {
  const ev = cands.map((c) => evaluer(c, now)).filter((x): x is Evalue => x !== null).sort((a, b) => b.valeur - a.valeur);
  const matchs = new Set(deja.matchs), parProfil = { ...deja.parProfil }, parFamille = { ...deja.parFamille };
  let total = deja.total;
  const out: Evalue[] = [];
  for (const e of ev) {
    if (total >= LIMITES.parJour) break;
    if (matchs.has(e.matchId) || parProfil[e.profil] >= LIMITES.parProfil || (parFamille[e.famille] ?? 0) >= LIMITES.parFamille) continue;
    out.push(e); matchs.add(e.matchId); parProfil[e.profil]++; parFamille[e.famille] = (parFamille[e.famille] ?? 0) + 1; total++;
  }
  return out;
}

/** Mise en FCFA pour une bankroll donnée. */
export function mise(bankroll: number, kelly: number): number {
  const f = Math.min(MISE.max, Math.max(MISE.min, kelly * MISE.kelly));
  return Math.max(MISE.arrondi, Math.round((bankroll * f) / MISE.arrondi) * MISE.arrondi);
}

const pct = (x: number) => `${Math.round(x * 100)} %`;
const cote2 = (x: number) => x.toFixed(2).replace(".", ",");
/** Raison courte, en chiffres, enregistrée avec le pari. */
export function raison(e: Evalue): string {
  const avis = e.pModele === null ? `${pct(e.p)} selon les cotes de référence` : `${pct(e.p)} selon les cotes de référence, ${pct(e.pModele)} selon le modèle`;
  const ecart = Math.round(e.valeur * 1000) / 10;
  return `Probabilité ${avis}. 1xBet paie ${cote2(e.cote)} pour une cote juste de ${cote2(1 / e.pJuste)} : écart de +${String(ecart).replace(".", ",")} %.`;
}

/** Bilan de la bankroll virtuelle à partir des paris réglés. */
export function bilan(paris: { mise: number; gain_net: number | null; statut: string }[]) {
  const regles = paris.filter((b) => b.statut !== "en_cours" && b.statut !== "annule" && b.gain_net !== null);
  const net = regles.reduce((s, b) => s + Number(b.gain_net), 0);
  const mises = regles.reduce((s, b) => s + Number(b.mise), 0);
  const enJeu = paris.filter((b) => b.statut === "en_cours").reduce((s, b) => s + Number(b.mise), 0);
  return {
    bankroll: BANKROLL_DEPART + net, net, enJeu, regles: regles.length,
    gagnes: regles.filter((b) => b.statut === "gagne").length,
    roi: mises > 0 ? net / mises : null,
  };
}
