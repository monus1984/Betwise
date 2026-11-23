/**
 * « Ce que disent les sources » (23/11) : les avis sur un match, regroupés, et la conclusion de Betster.
 * Règles retenues avec le conseil d'IA :
 *  - Betster se fait son avis d'abord (son verdict vient des cotes) ; les sources le confortent ou l'alertent, sans le dicter.
 *  - Chaque source humaine compte pour un avis, nouvelle ou ancienne (23/11, Mounir : « un avis d'un nouveau tipster
 *    peut confirmer celui d'un autre »). Le bilan vérifié reste affiché pour qu'on sache qui a fait ses preuves.
 *  - Les tipsters IA lisent les mêmes données avec la même consigne : ensemble, ils valent UN avis, pas un par IA.
 */
import { contredit } from "./desaccord";
import { SEUIL } from "./proof";

export type Avis = { sourceId: string; nom: string; ia: boolean; regles: number; market: string; param: number | null; sel: string; cote: number | null };
export type Pari = { market: string; param: number | null; sel: string };
export type Groupe = Pari & { humains: Avis[]; ia: Avis[]; betster: boolean };
export type Camp = { confirmees: number; autres: number; ia: number };
export type Consensus = { groupes: Groupe[]; pour: Camp; contre: Camp; conclusion: string; iaTotal: number };

const cle = (p: Pari) => `${p.market}|${p.param ?? ""}|${p.sel.trim().toLowerCase()}`;
const memeLigne = (a: Pari, b: Pari) => cle(a) === cle(b);
const issues = (p: Pari) => (p.market === "1X2" ? new Set([p.sel.toUpperCase()]) : p.market === "DC" ? new Set(p.sel.toUpperCase().replace("X", "N").split("")) : null);

/** Un avis va dans le sens d'un pari s'il est le même, ou plus exigeant et compatible (« victoire de A » soutient « A ou nul »). */
export function soutient(avis: Pari, pari: Pari): boolean {
  if (memeLigne(avis, pari)) return true;
  const ia = issues(avis), ip = issues(pari);
  if (ia && ip) return [...ia].every((x) => ip.has(x));
  if (avis.market === "OU" && pari.market === "OU" && avis.param !== null && pari.param !== null && avis.sel === pari.sel)
    return avis.sel === "Plus" ? avis.param >= pari.param : avis.param <= pari.param;
  return false;
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
  if (!verdict) return { groupes: liste, pour: vide, contre: vide, iaTotal,
    conclusion: avis.length ? "Betster n'a pas d'avis sur ce match (pas de cote) : les avis ci-dessous sont à titre d'information." : "Aucun avis de source sur ce match pour l'instant." };

  const pour = camp((a) => soutient(a, verdict));
  const contre = camp((a) => !soutient(a, verdict) && contredit({ source: a.sourceId, ...a }, { source: "betster", ...verdict }));
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
  return { groupes: liste, pour, contre, conclusion, iaTotal };
}

/** Une source est un tipster IA de BETWISE (nom fixé à la création, voir scripts/tipsters-ia.ts). */
export const estIA = (nom: string) => /· tipster IA$/.test(nom);
