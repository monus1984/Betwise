/**
 * « Ce que disent les sources » (23/11) : les avis sur un match, regroupés, et la conclusion de Betster.
 * Règles retenues avec le conseil d'IA :
 *  - Betster se fait son avis d'abord (son verdict vient des cotes) ; les sources le confortent ou l'alertent, sans le dicter.
 *  - Chaque source humaine compte pour un avis, nouvelle ou ancienne (23/11, Mounir : « un avis d'un nouveau tipster
 *    peut confirmer celui d'un autre »). Le bilan vérifié reste affiché pour qu'on sache qui a fait ses preuves.
 *  - Les tipsters IA lisent les mêmes données avec la même consigne : ensemble, ils valent UN avis, pas un par IA.
 */
import { relation } from "./relation";
import { SEUIL } from "./proof";

export type Avis = { sourceId: string; nom: string; ia: boolean; regles: number; market: string; param: number | null; sel: string; cote: number | null };
export type Pari = { market: string; param: number | null; sel: string };
export type Groupe = Pari & { humains: Avis[]; ia: Avis[]; betster: boolean };
export type Camp = { confirmees: number; autres: number; ia: number };
export type Consensus = { groupes: Groupe[]; lignes: LigneAvis[]; pour: Camp; contre: Camp; conclusion: string; iaTotal: number };

const cle = (p: Pari) => `${p.market}|${p.param ?? ""}|${p.sel.trim().toLowerCase()}`;
const memeLigne = (a: Pari, b: Pari) => cle(a) === cle(b);

/** Un avis confirme un pari s'il est le même, ou s'il l'entraîne : « les deux marquent » confirme « plus de 1,5 but »,
 *  « victoire de Milan » confirme « Milan ou nul » ; l'inverse ne confirme pas (conseil d'IA du 23/11). */
export const soutient = (avis: Pari, pari: Pari) => { const r = relation(avis, pari); return r === "meme" || r === "entraine"; };
const oppose = (avis: Pari, pari: Pari) => relation(avis, pari) === "contredit";

/** Un prono et ce que les autres sources en disent : combien le confirment (même pari ou pari compatible), combien le contredisent. */
export type LigneAvis = { avis: Avis; confirment: string[]; contredisent: string[]; betster: "avec" | "contre" | null };

/** Les IA forment un seul avis : on garde les noms des humains et « les tipsters IA » une fois. */
function voix(l: Avis[], moi: Avis): string[] {
  const humains = [...new Set(l.filter((x) => !x.ia).map((x) => x.nom))];
  return moi.ia || !l.some((x) => x.ia) ? humains : [...humains, "IA"];
}

export function lignesAvis(avis: Avis[], verdict: Pari | null): LigneAvis[] {
  const vus = new Map<string, Avis>();
  for (const a of avis) vus.set(`${a.sourceId}|${cle(a)}`, a); // un même prono chargé deux fois ne compte qu'une fois
  const l = [...vus.values()];
  return l.map((a) => {
    const autres = l.filter((b) => b.sourceId !== a.sourceId && !(a.ia && b.ia));
    return {
      avis: a,
      confirment: voix(autres.filter((b) => soutient(b, a)), a),
      contredisent: voix(autres.filter((b) => oppose(b, a)), a),
      betster: (verdict ? (soutient(verdict, a) ? "avec" : oppose(verdict, a) ? "contre" : null) : null) as LigneAvis["betster"],
    };
  }).sort((x, y) => y.confirment.length - x.confirment.length || x.contredisent.length - y.contredisent.length);
}

export function consensus(avis: Avis[], verdict: (Pari & { label: string }) | null): Consensus {
  const confirme = (a: Avis) => !a.ia && a.regles >= SEUIL.classement;
  const groupes = new Map<string, Groupe>();
  for (const a of avis) {
    const g = groupes.get(cle(a)) ?? { market: a.market, param: a.param, sel: a.sel, humains: [], ia: [], betster: !!verdict && memeLigne(a, verdict) };
    (a.ia ? g.ia : g.humains).push(a);
    groupes.set(cle(a), g);
  }
  const poids = (g: Groupe) => g.humains.length * 10 + (g.ia.length ? 10 : 0) + g.humains.filter(confirme).length + (g.betster ? 5 : 0);
  const liste = [...groupes.values()].sort((a, b) => poids(b) - poids(a));
  const iaTotal = new Set(avis.filter((a) => a.ia).map((a) => a.sourceId)).size;

  const camp = (f: (a: Avis) => boolean): Camp => {
    const l = avis.filter(f);
    return { confirmees: new Set(l.filter(confirme).map((a) => a.sourceId)).size, autres: new Set(l.filter((a) => !a.ia && !confirme(a)).map((a) => a.sourceId)).size, ia: new Set(l.filter((a) => a.ia).map((a) => a.sourceId)).size };
  };
  const vide = { confirmees: 0, autres: 0, ia: 0 };
  const lignes = lignesAvis(avis, verdict);
  if (!verdict) return { groupes: liste, lignes, pour: vide, contre: vide, iaTotal,
    conclusion: avis.length ? "Betster n'a pas d'avis sur ce match (pas de cote) : les avis ci-dessous sont à titre d'information." : "Aucun avis de source sur ce match pour l'instant." };

  // Va dans le même sens que Betster : même pari, ou l'un entraîne l'autre (comme « Betster d'accord » sur chaque ligne)
  const pour = camp((a) => soutient(a, verdict) || soutient(verdict, a));
  const contre = camp((a) => oppose(a, verdict));
  // Les IA ne comptent qu'une fois, dans le camp où elles sont le plus nombreuses
  const iaPour = pour.ia > 0 && pour.ia >= contre.ia ? 1 : 0, iaContre = contre.ia > pour.ia ? 1 : 0;
  const humains = (k: Camp) => k.confirmees + k.autres;
  const p = humains(pour) + iaPour, c = humains(contre) + iaContre;
  const qui = (k: Camp, ia: number) => {
    const n = humains(k);
    const src = n ? `${n} source${n > 1 ? "s" : ""}${k.confirmees ? ` (dont ${k.confirmees} confirmée${k.confirmees > 1 ? "s" : ""})` : ""}` : "";
    return [src, ia ? "les tipsters IA" : ""].filter(Boolean).join(" et ");
  };
  const vont = (k: Camp, ia: number) => (humains(k) + ia > 1 ? "vont" : "va");
  const conclusion =
    p === 0 && c === 0
      ? `Betster retient « ${verdict.label} ». Aucune source ne s'est prononcée dans un sens ou dans l'autre : son choix repose sur les cotes seules.`
      : c === 0
        ? `Betster retient « ${verdict.label} », et ${qui(pour, iaPour)} ${vont(pour, iaPour)} dans le même sens. Ça conforte son choix, sans le rendre certain.`
        : p === 0
          ? `Betster retient « ${verdict.label} », mais ${qui(contre, iaContre)} ${humains(contre) + iaContre > 1 ? "pensent" : "pense"} l'inverse. Betster garde son choix, fondé sur les cotes : prends ce désaccord comme un signal de prudence.`
          : p >= 2 * c
            ? `Betster retient « ${verdict.label} » : ${qui(pour, iaPour)} avec lui, ${qui(contre, iaContre)} contre. La majorité le conforte.`
            : c >= 2 * p
              ? `Betster retient « ${verdict.label} », mais la majorité pense l'inverse : ${qui(contre, iaContre)} contre, ${qui(pour, iaPour)} avec lui. Signal de prudence.`
              : `Les avis sont partagés : ${qui(pour, iaPour)} avec Betster (« ${verdict.label} »), ${qui(contre, iaContre)} contre. Pas de signal net.`;
  return { groupes: liste, lignes, pour, contre, conclusion, iaTotal };
}

/** Les coups du jour de BETWISE sont les choix de Betster lui-même : ils ne comptent pas comme une source qui le confirme (24/11). */
export const estBetwise = (nom: string) => /^Coups du jour BETWISE$/i.test(nom.trim());

/** Une source est un tipster IA de BETWISE (nom fixé à la création, voir scripts/tipsters-ia.ts). */
export const estIA = (nom: string) => /· tipster IA$/.test(nom);

/**
 * Le point de Betster sur la journée (24/11, Mounir : « Betster fait le point et retient les paris les plus probables
 * selon les sources, simples et combinés »). Entrée : chaque prono avec le nombre de voix qui le portent (lui-même et
 * ceux qui le confirment), la chance BETWISE et la cote quand on les a.
 * Simples : au moins 2 voix, un par match, classés par voix puis par chance. Combiné : 2 ou 3 de ces simples, chacun
 * à 65 % au moins, cote totale jusqu'à 3,00 (règle du conseil d'IA du 23/11).
 */
export type Candidat = { matchId: string; match: string; label: string; voix: number; qui: string[]; p: number | null; cote: number | null };
export function pointDuJour(l: Candidat[]): { simples: Candidat[]; combine: { selections: Candidat[]; cote: number | null; p: number } | null } {
  const tri = [...l].filter((x) => x.voix >= 2).sort((a, b) => b.voix - a.voix || (b.p ?? 0) - (a.p ?? 0));
  const vus = new Set<string>(), simples: Candidat[] = [];
  for (const x of tri) { if (vus.has(x.matchId)) continue; vus.add(x.matchId); simples.push(x); if (simples.length === 5) break; }
  const sur = simples.filter((x) => (x.p ?? 0) >= 0.65 && x.cote).sort((a, b) => (b.p ?? 0) - (a.p ?? 0));
  const coteDe = (l: Candidat[]) => l.reduce((c, y) => c * (y.cote ?? 1), 1);
  // La meilleure combinaison de 2 ou 3 paris dont la cote totale est entre 1,50 et 3,00 (consensus du conseil, 23/11) :
  // la plus probable d'abord.
  let sel: Candidat[] = [], pSel = 0;
  for (let i = 0; i < sur.length; i++) for (let j = i + 1; j < sur.length; j++) {
    for (const l of [[sur[i], sur[j]], ...sur.slice(j + 1).map((k) => [sur[i], sur[j], k])]) {
      const c = coteDe(l), p = l.reduce((x, y) => x * (y.p ?? 1), 1);
      if (c >= 1.5 && c <= 3 && p > pSel) { sel = l; pSel = p; }
    }
  }
  const combine = sel.length >= 2 ? { selections: sel, cote: Math.round(sel.reduce((c, y) => c * (y.cote ?? 1), 1) * 100) / 100, p: sel.reduce((c, y) => c * (y.p ?? 1), 1) } : null;
  return { simples, combine };
}
