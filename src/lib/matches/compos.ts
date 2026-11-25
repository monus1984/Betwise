/**
 * Compositions (25/11) : placement des titulaires sur le terrain et rapprochement avec les événements du match.
 * Modèle visé : la vue « Compos » de Flashscore — terrain vertical, équipe qui reçoit en haut, puis les listes.
 */
import { teamSimilarity } from "../odds-api/client";

export type JoueurCompo = { nom: string; numero: number | null; poste: string | null; grid?: string | null };
export type Evenement = { t: "but" | "pen" | "csc" | "pen_rate" | "jaune" | "rouge"; n: string | null; e: "1" | "2" };
export type Marques = { buts: number; csc: number; jaune: boolean; rouge: boolean };

/** Rangées du terrain, de la cage vers l'attaque : la grille API-Football (« rangée:colonne ») d'abord, sinon le schéma. */
export function rangees(titulaires: JoueurCompo[], schema: string | null): JoueurCompo[][] {
  const grille = titulaires.map((p) => p.grid?.match(/^(\d+):(\d+)$/)).map((m) => (m ? [Number(m[1]), Number(m[2])] : null));
  if (titulaires.length && grille.filter(Boolean).length >= titulaires.length - 1) {
    const parRangee = new Map<number, { c: number; p: JoueurCompo }[]>();
    titulaires.forEach((p, i) => { const g = grille[i] ?? [99, 99]; parRangee.set(g[0], [...(parRangee.get(g[0]) ?? []), { c: g[1], p }]); });
    return [...parRangee.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l.sort((a, b) => a.c - b.c).map((x) => x.p));
  }
  // Repli : le gardien, puis les lignes du schéma (« 4-2-3-1 ») prises dans l'ordre de la feuille
  const gardien = titulaires.find((p) => p.poste === "G") ?? titulaires[0];
  const reste = titulaires.filter((p) => p !== gardien);
  const lignes = (schema ?? "").split("-").map(Number).filter((n) => n > 0);
  const tailles = lignes.reduce((a, b) => a + b, 0) === reste.length ? lignes : parPoste(reste);
  const out: JoueurCompo[][] = gardien ? [[gardien]] : [];
  let i = 0;
  for (const n of tailles) { out.push(reste.slice(i, i + n)); i += n; }
  if (i < reste.length) out.push(reste.slice(i));
  return out.filter((r) => r.length);
}

function parPoste(l: JoueurCompo[]): number[] {
  const n = (k: string) => l.filter((p) => p.poste === k).length;
  const d = n("D"), m = n("M"), f = n("F");
  return d + m + f === l.length ? [d, m, f].filter(Boolean) : [l.length];
}

/** Nom court pour le terrain : « J. Oblak » → « Oblak », « R. Le Normand » → « Le Normand », « Lee Kang-In » inchangé. */
export function nomCourt(nom: string, max = 13): string {
  const n = nom.replace(/^(?:[A-ZÀ-Ý]\.\s*)+/, "").trim() || nom;
  return n.length > max ? n.slice(0, max - 1) + "…" : n;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();

/** Buts et cartons de chaque joueur d'une équipe, d'après les événements du match (nom exact, sinon nom de famille unique). */
export function marquesDe(joueurs: JoueurCompo[], evts: Evenement[], cote: "1" | "2"): Map<string, Marques> {
  const out = new Map<string, Marques>();
  const cle = new Map(joueurs.map((p) => [norm(p.nom), p.nom]));
  const famille = new Map<string, string[]>();
  for (const p of joueurs) { const f = norm(p.nom).split(" ").pop()!; famille.set(f, [...(famille.get(f) ?? []), p.nom]); }
  const trouve = (n: string): string | null => {
    const k = norm(n);
    if (cle.has(k)) return cle.get(k)!;
    const f = k.split(" ").pop()!;
    const c = famille.get(f);
    return c && c.length === 1 ? c[0] : null;
  };
  for (const e of evts) {
    if (e.e !== cote || !e.n) continue;
    const nom = trouve(e.n);
    if (!nom) continue;
    const m = out.get(nom) ?? { buts: 0, csc: 0, jaune: false, rouge: false };
    if (e.t === "but" || e.t === "pen") m.buts++;
    else if (e.t === "csc") m.csc++;
    else if (e.t === "jaune") m.jaune = true;
    else if (e.t === "rouge") m.rouge = true;
    out.set(nom, m);
  }
  return out;
}

/** Répartit les absents entre les deux équipes : d'abord les noms des compositions (même fournisseur), sinon par ressemblance. */
export function coteDe(equipe: string, home: string, away: string, compos?: [string | undefined, string | undefined]): "1" | "2" {
  if (compos?.[0] && equipe === compos[0]) return "1";
  if (compos?.[1] && equipe === compos[1]) return "2";
  return teamSimilarity(equipe, home) >= teamSimilarity(equipe, away) ? "1" : "2";
}
