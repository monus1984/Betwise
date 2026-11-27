/**
 * Le récit d'un match : la démarche d'un analyste, dans l'ordre où il la déroule.
 *   l'enjeu → la forme → le dernier match → le face-à-face → le joueur du moment → le chiffre qui pèse → le verdict.
 * Chaque étape n'apparaît que si la base a de quoi la dire : rien n'est inventé pour remplir.
 * Le verdict, lui, vient des probabilités BETWISE (cotes de référence d'abord) et non des étapes : elles l'éclairent,
 * elles ne le prouvent pas, et l'écran le dit.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { coteDe } from "./compos";
import type { Database } from "../supabase/database.types";
import { profilDe, type Categorie } from "../coach/categories";
import { familleOf, loadSignals, pickLabel, picksOf, releveFrais, type Pick } from "../probs/signals";
import { latestStandings, type StandingRow } from "./standings";
import { getConfrontations } from "../api-football/extras";
import { enjeux, fraicheur } from "./enjeux";

type Db = SupabaseClient<Database, "betwise">;
type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const TZ = "Africa/Abidjan";

export type Etape = { cle: "enjeu" | "forme" | "terrain" | "calendrier" | "absents" | "dernier" | "face" | "joueur" | "chiffre"; titre: string; lignes: string[] };
export type Choix = { market: string; param: number | null; sel: string; label: string; p: number; cote: number | null; categorie: Categorie;
  /** D'où vient la cote : nom du bookmaker (1xBet) ou « médiane » des bookmakers européens ; null sans cote. */
  ou?: string | null };
export type Recit = { affiche: string; cles: string[]; redaction: string[]; etapes: Etape[]; verdict: Choix | null; autres: Choix[]; source: "marche" | "modele" | null; texte: string };

export type Passe = { date: string; home: string; away: string; sh: number; sa: number; buteurs: { n: string | null; e: "1" | "2" }[] };
export type RecitInput = {
  home: string; away: string;
  rangs: { home: StandingRow | null; away: StandingRow | null };
  /** Classement complet de la compétition (pour les enjeux : titre, places qualificatives, maintien). */
  table?: StandingRow[]; comp?: string;
  /** Matchs terminés des deux équipes, du plus récent au plus ancien. */
  passes: Passe[];
  picks: Pick[]; source: "marche" | "modele" | null; butsAttendus: number | null;
  /** Confrontations directes sur plusieurs saisons (API-Football), noms déjà ramenés à ceux de BETWISE. */
  h2h?: Passe[];
  /** Matchs proches de chaque équipe, toutes compétitions : la veille (jusqu'à 3 jours avant) et le suivant (jusqu'à 4 jours après). */
  calendrier?: { home: Proche[]; away: Proche[] };
  /** Absents annoncés (API-Football), par équipe. */
  absents?: { equipe: string; joueurs: string[] }[];
  /** Coup d'envoi du match (pour situer le calendrier). */
  kickoff?: string;
};
export type Proche = { date: string; comp: string; adversaire: string; avant: boolean };

const dec = (x: number) => x.toFixed(1).replace(".", ",");
const ord = (n: number) => (n === 1 ? "1er" : `${n}e`);
const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const pl = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
/** « passe 80 fois sur 100, risque de perte 20 % » (formulation demandée par Mounir, 27/11) */
export const passe = (p: number) => { const n = Math.round(p * 100); return `passe ${n} fois sur 100, risque de perte ${100 - n} %`; };

/** Ce que la place au classement donne, dit simplement ; null si on ne sait pas le traduire sans risque d'erreur. */
export function zoneFr(zone: string | null): string | null {
  const z = (zone ?? "").toLowerCase();
  if (!z) return null;
  if (z.includes("relegation")) return z.includes("play") ? "en position de barrage pour le maintien" : "en position de relégation";
  if (z.includes("quarter")) return "en position de qualifié pour les quarts de finale";
  if (z.includes("champions league")) return "en position de qualifié pour la Ligue des champions";
  if (z.includes("europa")) return "en position européenne";
  if (z.includes("promotion")) return "en position de montée";
  if (z.includes("play")) return "en position de barragiste";
  if (z.includes("next round") || z.includes("qualif") || z.includes("final")) return "en position de qualifié";
  return null;
}

function etapeEnjeu({ home, away, rangs, table, comp }: RecitInput): Etape | null {
  const h = rangs.home, a = rangs.away;
  if (!h && !a) return null;
  const dit = (nom: string, r: StandingRow) => `${nom} est ${ord(r.rang)} avec ${pl(r.points, "point")} en ${pl(r.joues, "match")}${zoneFr(r.zone) ? `, ${zoneFr(r.zone)}` : ""}.`;
  const lignes = [h && dit(home, h), a && dit(away, a)].filter(Boolean) as string[];
  const en = table?.length ? enjeux({ home, away, comp: comp ?? "", homeRow: h, awayRow: a, table }) : [];
  if (en.length) {
    lignes.push(...en);
    const f = fraicheur(table!);
    if (f) lignes.push(`Source : ${f}, selon API-Football.`);
    return { cle: "enjeu", titre: "L’enjeu", lignes };
  }
  if (h && a && h.groupe === a.groupe) {
    const ecart = Math.abs(h.points - a.points);
    lignes.push(ecart === 0 ? "Les deux équipes sont à égalité de points : ce match les départage." : ecart <= 3 ? `${pl(ecart, "point")} d’écart : le classement peut basculer ce soir-là.` : `${ecart} points d’écart entre les deux.`);
  }
  return { cle: "enjeu", titre: "L’enjeu", lignes };
}

function etapeForme({ home, away, rangs }: RecitInput): Etape | null {
  const dit = (nom: string, r: StandingRow | null) => {
    if (!r || !r.joues) return null;
    const f = (r.forme ?? "").toUpperCase().replace(/[^WDL]/g, "");
    const v = [...f].filter((c) => c === "W").length, d = [...f].filter((c) => c === "L").length;
    const serie = f.length >= 3 ? `${pl(v, "victoire")} et ${pl(d, "défaite")} sur les ${f.length} derniers matchs` : `${pl(r.gagnes, "victoire")} en ${pl(r.joues, "match")}`;
    const net = f.length >= 4 && v === f.length ? ` : ${f.length} victoires sur ${f.length}` : f.length >= 4 && v === 0 ? ` : aucune victoire sur les ${f.length} derniers` : "";
    return `${nom} : ${serie}${net}, ${dec(r.bp / r.joues)} but marqué et ${dec(r.bc / r.joues)} encaissé par match.`;
  };
  const lignes = [dit(home, rangs.home), dit(away, rangs.away)].filter(Boolean) as string[];
  return lignes.length ? { cle: "forme", titre: "La forme", lignes } : null;
}


/** Domicile et extérieur : le bilan de la saison de l'équipe qui reçoit chez elle, et du visiteur hors de chez lui. */
function etapeTerrain({ home, away, rangs }: RecitInput): Etape | null {
  const dit = (nom: string, b: StandingRow["domicile"], ou: string) => {
    if (!b || b.j < 3) return null;
    const fin = b.g === 0 ? ` : aucune victoire ${ou}` : b.p === 0 ? ` : invaincu ${ou}` : "";
    return `${nom} ${ou} cette saison : ${pl(b.g, "victoire")}, ${pl(b.n, "nul")}, ${pl(b.p, "défaite")} en ${pl(b.j, "match")} (${b.bp} buts marqués, ${b.bc} encaissés)${fin}.`;
  };
  const lignes = [dit(home, rangs.home?.domicile, "à domicile"), dit(away, rangs.away?.exterieur, "à l'extérieur")].filter(Boolean) as string[];
  return lignes.length ? { cle: "terrain", titre: "Domicile et extérieur", lignes } : null;
}

/** Le calendrier : un match rapproché avant ou après peut peser (fatigue, rotation). On le signale, sans conclure. */
function etapeCalendrier({ home, away, calendrier, kickoff }: RecitInput): Etape | null {
  if (!calendrier || !kickoff) return null;
  const k = Date.parse(kickoff);
  const dit = (nom: string, l: Proche[]) => l.map((x) => {
    const j = Math.max(1, Math.round(Math.abs(Date.parse(x.date) - k) / 86_400_000));
    return x.avant
      ? `${nom} a joué ${jour(x.date)} (${x.comp}, contre ${x.adversaire}) : ${pl(j, "jour")} de récupération seulement.`
      : `${nom} rejoue ${jour(x.date)} (${x.comp}, contre ${x.adversaire}), ${pl(j, "jour")} après : des changements dans l'équipe sont possibles.`;
  });
  const lignes = [...dit(home, calendrier.home), ...dit(away, calendrier.away)];
  return lignes.length ? { cle: "calendrier", titre: "Le calendrier", lignes: lignes.slice(0, 3) } : null;
}

function etapeAbsents({ absents }: RecitInput): Etape | null {
  const lignes = (absents ?? []).filter((a) => a.joueurs.length).map((a) =>
    `${a.equipe} : ${pl(a.joueurs.length, "absent")} annoncé${a.joueurs.length > 1 ? "s" : ""}${a.joueurs.length ? `, dont ${a.joueurs.slice(0, 3).join(", ")}` : ""}.`);
  return lignes.length ? { cle: "absents", titre: "Les absents", lignes: [...lignes, "Source : API-Football ; la liste peut changer jusqu'aux compositions."] } : null;
}

const score = (p: Passe) => `${p.home} ${p.sh}–${p.sa} ${p.away}`;
const joue = (p: Passe, nom: string) => p.home === nom || p.away === nom;

function etapeDernier({ home, away, passes }: RecitInput): Etape | null {
  const dit = (nom: string) => {
    const p = passes.find((x) => joue(x, nom) && !(joue(x, home) && joue(x, away)));
    if (!p) return null;
    const cote = p.home === nom ? "1" : "2";
    const buteurs = [...new Set(p.buteurs.filter((b) => b.e === cote && b.n).map((b) => b.n as string))];
    return `${jour(p.date)} : ${score(p)}${buteurs.length ? ` (${buteurs.slice(0, 3).join(", ")} pour ${nom})` : ""}.`;
  };
  const lignes = [dit(home), dit(away)].filter(Boolean) as string[];
  return lignes.length ? { cle: "dernier", titre: "Le dernier match", lignes } : null;
}

function etapeFace({ home, away, passes, h2h }: RecitInput): Etape | null {
  if (h2h && h2h.length >= 2) {
    const n = h2h.length;
    const gagne = (nom: string) => h2h.filter((p) => (p.home === nom && p.sh > p.sa) || (p.away === nom && p.sa > p.sh)).length;
    const gh = gagne(home), ga = gagne(away), nuls = n - gh - ga;
    const lignes = [`Sur les ${n} dernières confrontations : ${pl(gh, "victoire")} de ${home}, ${pl(nuls, "nul")}, ${pl(ga, "victoire")} de ${away}.`];
    // série en cours : les confrontations les plus récentes, gagnées par la même équipe
    const vainqueur = (p: Passe) => (p.sh > p.sa ? p.home : p.sa > p.sh ? p.away : null);
    const premier = vainqueur(h2h[0]);
    let serie = 0;
    if (premier) for (const p of h2h) { if (vainqueur(p) !== premier) break; serie++; }
    if (premier && serie >= 3) lignes.push(`${premier} a gagné les ${serie} dernières.`);
    lignes.push(...h2h.slice(0, 3).map((p) => `${jour(p.date)} : ${score(p)}.`));
    return { cle: "face", titre: "Les confrontations directes", lignes };
  }
  const faces = passes.filter((p) => joue(p, home) && joue(p, away)).slice(0, 3);
  if (!faces.length) return null;
  return { cle: "face", titre: faces.length === 1 ? "Le match aller" : "Les dernières confrontations", lignes: faces.map((p) => `${jour(p.date)} : ${score(p)}.`) };
}

function etapeJoueur({ home, away, passes }: RecitInput): Etape | null {
  const dit = (nom: string) => {
    const ms = passes.filter((p) => joue(p, nom)).slice(0, 5);
    const buts = new Map<string, number>();
    for (const p of ms) for (const b of p.buteurs) if (b.n && b.e === (p.home === nom ? "1" : "2")) buts.set(b.n, (buts.get(b.n) ?? 0) + 1);
    const top = [...buts.entries()].sort((x, y) => y[1] - x[1])[0];
    return top && top[1] >= 2 ? `${top[0]} (${nom}) : ${top[1]} buts sur ${ms.length === 1 ? "le dernier match" : `les ${ms.length} derniers matchs`}.` : null;
  };
  const lignes = [dit(home), dit(away)].filter(Boolean) as string[];
  return lignes.length ? { cle: "joueur", titre: "Le joueur du moment", lignes } : null;
}

function etapeChiffre({ home, away, rangs, butsAttendus, table }: RecitInput): Etape | null {
  const lignes: string[] = [];
  // Rang de la défense et de l'attaque, seulement dans un classement assez fourni (8 équipes, 5 matchs joués)
  const rangDe = (r: StandingRow | null, cle: "bp" | "bc") => {
    if (!r || r.joues < 5 || !table?.length) return null;
    const pairs = table.filter((x) => x.groupe === r.groupe && x.joues >= 5);
    if (pairs.length < 8) return null;
    const v = (x: StandingRow) => x[cle] / x.joues;
    return { rang: pairs.filter((x) => (cle === "bc" ? v(x) < v(r) : v(x) > v(r))).length + 1, n: pairs.length };
  };
  for (const [nom, r] of [[home, rangs.home], [away, rangs.away]] as const) {
    if (!r || r.joues < 3) continue;
    const d = rangDe(r, "bc"), a = rangDe(r, "bp");
    const meilleure = (k: number) => (k === 1 ? "meilleure" : `${ord(k)} meilleure`);
    if (d && d.rang <= 3) lignes.push(`${nom} a la ${meilleure(d.rang)} défense du classement (${pl(r.bc, "but")} encaissé${r.bc > 1 ? "s" : ""} en ${r.joues} matchs).`);
    else if (d && d.rang >= d.n - 1) lignes.push(`${nom} a l'une des deux défenses les plus faibles du classement (${r.bc} buts encaissés en ${r.joues} matchs).`);
    else if (r.bc / r.joues >= 2) lignes.push(`${nom} a encaissé ${r.bc} buts en ${r.joues} matchs.`);
    else if (r.bc / r.joues <= 0.6) lignes.push(`${nom} n’a encaissé que ${pl(r.bc, "but")} en ${r.joues} matchs.`);
    if (a && a.rang <= 2) lignes.push(`${nom} a la ${meilleure(a.rang)} attaque du classement (${pl(r.bp, "but")} en ${r.joues} matchs).`);
    else if (r.bp / r.joues <= 0.6) lignes.push(`${nom} n’a marqué que ${pl(r.bp, "but")} en ${r.joues} matchs.`);
    if (r.points === 0) lignes.push(`${nom} n’a pris aucun point.`);
  }
  if (butsAttendus !== null) lignes.push(`Les cotes annoncent environ ${dec(butsAttendus)} buts dans ce match.`);
  return lignes.length ? { cle: "chiffre", titre: "Le chiffre qui pèse", lignes: lignes.length > 4 ? [...lignes.slice(0, 3), lignes[lignes.length - 1]] : lignes } : null;
}

/**
 * L'essentiel (25/11) : 2 à 4 faits courts, les plus parlants, comme un pronostiqueur qui va droit au but.
 * Chaque fait n'est retenu que s'il est net (série, écart, absence) ; le détail reste dans « Toute l'analyse ».
 */
export function pointsCles({ home, away, rangs, passes, h2h, absents, calendrier, kickoff, butsAttendus }: RecitInput): string[] {
  const c: { poids: number; t: string }[] = [];
  const forme = (nom: string, r: StandingRow | null) => {
    const f = (r?.forme ?? "").toUpperCase().replace(/[^WDL]/g, "");
    if (f.length < 4) return;
    const v = [...f].filter((x) => x === "W").length, d = [...f].filter((x) => x === "L").length;
    if (v >= f.length - 1) c.push({ poids: 5 + v, t: `${nom} en forme : ${v} victoires sur ses ${f.length} derniers matchs.` });
    else if (v === 0) c.push({ poids: 6 + d, t: `${nom} en difficulté : aucune victoire sur ses ${f.length} derniers matchs.` });
    else if (d >= f.length - 1) c.push({ poids: 5 + d, t: `${nom} : ${d} défaites sur ses ${f.length} derniers matchs.` });
  };
  forme(home, rangs.home); forme(away, rangs.away);
  const dom = rangs.home?.domicile, ext = rangs.away?.exterieur;
  if (dom && dom.j >= 4 && dom.p === 0) c.push({ poids: 7, t: `${home} invaincu à domicile cette saison (${dom.g} V, ${dom.n} N).` });
  else if (dom && dom.j >= 4 && dom.g === 0) c.push({ poids: 7, t: `${home} n'a pas encore gagné à domicile cette saison.` });
  if (ext && ext.j >= 4 && ext.g === 0) c.push({ poids: 6, t: `${away} n'a pas encore gagné à l'extérieur cette saison.` });
  else if (ext && ext.j >= 4 && ext.p === 0) c.push({ poids: 7, t: `${away} invaincu à l'extérieur cette saison.` });
  const h = rangs.home, a = rangs.away;
  if (h && a && h.groupe === a.groupe && h.joues >= 5 && Math.abs(h.rang - a.rang) >= 8) {
    const fort = h.rang < a.rang ? [home, h] as const : [away, a] as const, faible = h.rang < a.rang ? [away, a] as const : [home, h] as const;
    c.push({ poids: 6, t: `Écart au classement : ${fort[0]} ${ord(fort[1].rang)}, ${faible[0]} ${ord(faible[1].rang)}.` });
  } else if (h && a && h.groupe === a.groupe && h.joues >= 5 && Math.abs(h.points - a.points) <= 2) c.push({ poids: 4, t: `Match serré au classement : ${pl(Math.abs(h.points - a.points), "point")} d'écart.` });
  const faces = h2h && h2h.length >= 3 ? h2h : passes.filter((p) => joue(p, home) && joue(p, away));
  if (faces.length >= 3) {
    const vainqueur = (p: Passe) => (p.sh > p.sa ? p.home : p.sa > p.sh ? p.away : null);
    const premier = vainqueur(faces[0]);
    let serie = 0;
    if (premier) for (const p of faces) { if (vainqueur(p) !== premier) break; serie++; }
    if (premier && serie >= 3) c.push({ poids: 6, t: `${premier} a gagné les ${serie} dernières confrontations.` });
    else {
      const sans = faces.slice(0, 5).filter((p) => vainqueur(p) !== home).length, k = Math.min(5, faces.length);
      if (sans === k) c.push({ poids: 5, t: `${home} n'a battu ${away} dans aucune des ${k} dernières confrontations.` });
    }
  }
  for (const x of absents ?? []) if (x.joueurs.length >= 2) c.push({ poids: 3 + Math.min(x.joueurs.length, 4), t: `${x.equipe} privé de ${pl(x.joueurs.length, "joueur")}, dont ${x.joueurs.slice(0, 2).join(" et ")}.` });
  if (calendrier && kickoff) {
    const k = Date.parse(kickoff);
    for (const [nom, l] of [[home, calendrier.home], [away, calendrier.away]] as const) {
      const x = l.find((y) => y.avant && Math.abs(Date.parse(y.date) - k) < 3.5 * 86_400_000);
      if (x) c.push({ poids: 4, t: `${nom} a joué il y a ${pl(Math.max(1, Math.round((k - Date.parse(x.date)) / 86_400_000)), "jour")} : peu de récupération.` });
    }
  }
  if (butsAttendus !== null && (butsAttendus >= 3 || butsAttendus <= 2.1)) c.push({ poids: 4, t: butsAttendus >= 3 ? `Les cotes annoncent un match ouvert : environ ${dec(butsAttendus)} buts.` : `Les cotes annoncent un match fermé : environ ${dec(butsAttendus)} buts.` });
  return c.sort((x, y) => y.poids - x.poids).slice(0, 4).map((x) => x.t);
}

/** Le verdict : la sélection la plus probable de la catégorie Audacieux, puis une plus sûre et une plus osée. */
function verdictDe({ home, away, picks }: RecitInput): { verdict: Choix | null; autres: Choix[] } {
  const utiles = picks.filter((p) => familleOf(p.market) !== "mitemps" && !["MG", "OE", "HMG", "CS"].includes(p.market));
  const de = (cat: Categorie): Choix | null => {
    // La cote montrée est celle du bookmaker quand elle existe (22/11 : « cote 1,36 » ici, « 1xBet 1,40 » juste dessous)
    const vue = (x: Pick) => x.book?.cote ?? x.cote;
    const p = utiles.filter((x) => profilDe(x.p, vue(x)) === cat).sort((x, y) => Number(vue(y) !== null) - Number(vue(x) !== null) || y.p - x.p)[0];
    return p ? { market: p.market, param: p.param, sel: p.sel, label: pickLabel(p.market, p.param, p.sel, home, away), p: p.p, cote: vue(p), categorie: cat,
      ou: p.book ? p.book.bookmaker : p.cote ? "médiane" : null } : null;
  };
  const a = de("audacieux"), s = de("sur"), r = de("risque");
  const verdict = a ?? s ?? r;
  const autres = [s, a, r].filter((c): c is Choix => !!c && c !== verdict);
  // 2 à 3 alternatives par match (27/11) : on complète avec les paris cotés les plus probables, d'un autre marché que ceux déjà montrés
  const vue = (x: Pick) => x.book?.cote ?? x.cote;
  const pris = new Set([verdict, ...autres].filter(Boolean).map((c) => `${c!.market}|${c!.sel}`));
  const marches = new Set([verdict, ...autres].filter(Boolean).map((c) => c!.market));
  for (const p of utiles.filter((x) => vue(x) !== null && x.p >= 0.5).sort((x, y) => y.p - x.p)) {
    if (autres.length >= 3) break;
    if (pris.has(`${p.market}|${p.sel}`) || marches.has(p.market)) continue;
    autres.push({ market: p.market, param: p.param, sel: p.sel, label: pickLabel(p.market, p.param, p.sel, home, away), p: p.p, cote: vue(p), categorie: profilDe(p.p, vue(p)) ?? "sur", ou: p.book ? p.book.bookmaker : "médiane" });
    pris.add(`${p.market}|${p.sel}`); marches.add(p.market);
  }
  return { verdict, autres: autres.slice(0, 3) };
}


/* ---------- La rédaction de Betster (25/11) ----------
 * Sur le modèle des pronostiqueurs en vidéo : un contexte, un ou deux chiffres de forme par équipe, les absents,
 * puis le choix en une phrase. 3 à 5 phrases, chacune posée sur une donnée réelle ; rien n'est inventé.
 * Les faits mis en avant dépendent du type de choix : résultat (forme, terrain, classement) ou buts (marqués, encaissés). */

type Bilan = { n: number; v: number; nul: number; d: number; marque: number; encaisse: number; btts: number; plus25: number };
function bilanRecent(nom: string, passes: Passe[], max = 7): Bilan {
  const ms = passes.filter((p) => joue(p, nom)).slice(0, max);
  const b: Bilan = { n: ms.length, v: 0, nul: 0, d: 0, marque: 0, encaisse: 0, btts: 0, plus25: 0 };
  for (const p of ms) {
    const pour = p.home === nom ? p.sh : p.sa, contre = p.home === nom ? p.sa : p.sh;
    if (pour > contre) b.v++; else if (pour < contre) b.d++; else b.nul++;
    if (pour > 0) b.marque++; if (contre > 0) b.encaisse++; if (pour > 0 && contre > 0) b.btts++; if (pour + contre >= 3) b.plus25++;
  }
  return b;
}
const formeDe = (r: StandingRow | null) => {
  const f = (r?.forme ?? "").toUpperCase().replace(/[^WDL]/g, "");
  return f.length >= 3 ? { k: f.length, v: [...f].filter((c) => c === "W").length, d: [...f].filter((c) => c === "L").length, nul: [...f].filter((c) => c === "D").length } : null;
};
const lister = (l: string[]) => (l.length <= 4 ? l.join(", ").replace(/, ([^,]*)$/, " et $1") : `${l.slice(0, 3).join(", ")} et ${l.length - 3} autres`);

/** L'équipe que vise le choix (celle qu'on voit gagner ou ne pas perdre), s'il y en a une. */
function equipeVisee(c: Choix | null, home: string, away: string): { nom: string; adv: string; cote: "1" | "2" } | null {
  if (!c) return null;
  const sel = c.market === "DC_OU" || c.market === "1X2_OU" ? c.sel.split("|")[0] : c.sel;
  const un = ["1X2", "DNB", "AH", "DC_OU", "1X2_OU", "TT1", "TT2"].includes(c.market) ? (c.market === "TT1" ? "1" : c.market === "TT2" ? "2" : sel) : c.market === "DC" ? (sel === "1N" ? "1" : sel === "N2" ? "2" : null) : null;
  if (un === "1") return { nom: home, adv: away, cote: "1" };
  if (un === "2") return { nom: away, adv: home, cote: "2" };
  return null;
}

/** La phrase du choix, dans la voix d'un pronostiqueur, avec la probabilité d'après les cotes. */
function phraseChoix(c: Choix, home: string, away: string, source: "marche" | "modele" | null): string {
  const p = `${passe(c.p)}${c.cote ? "" : ", estimation"}${source === "modele" ? ", d'après le modèle" : ""}`;
  const minuscule = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
  const v = equipeVisee(c, home, away);
  const param = c.param !== null ? String(c.param).replace(".", ",") : "";
  let t: string;
  switch (c.market) {
    case "1X2": t = c.sel === "N" ? "Je pars sur le match nul" : c.sel === "1" ? `Je vois ${home} s'imposer` : `Je vois ${away} l'emporter à l'extérieur`; break;
    case "DC": t = c.sel === "12" ? `Je ne vois pas de match nul : ${home} ou ${away}` : `Je ne vois pas ${v!.nom} perdre : ${c.sel === "1N" ? `${home} ou nul` : `nul ou ${away}`}`; break;
    case "DNB": t = `Je pars sur ${v!.nom}, remboursé si nul`; break;
    case "OU": t = c.sel === "Plus" ? `Je m'attends à des buts : ${minuscule(c.label)}` : `Je vois un match fermé : ${minuscule(c.label)}`; break;
    case "BTTS": t = c.sel === "Oui" ? "Des buts de chaque côté : les deux équipes marquent" : "Je vois au moins une équipe rester muette"; break;
    case "AH": t = `Je pars sur ${v!.nom} avec le handicap ${param}`; break;
    default: t = `Je pars sur ${c.label}`;
  }
  return `${t} (${p}).`;
}

/**
 * Rédaction de Betster, v2 (27/11) : sur le modèle des vidéos de pronostiqueurs, en paragraphes courts.
 * 1. L'accroche : qui a l'avantage. 2. L'équipe qui reçoit : terrain, classement, buts, absents.
 * 3. L'équipe qui se déplace : idem. 4. Un fait de plus (série en confrontations, calendrier). 5. Le choix, et pourquoi
 * on joue la sécurité quand c'est le cas. Chaque chiffre vient des données ; rien n'est inventé.
 */
export function redaction(input: RecitInput, verdict: Choix | null): string[] {
  const { home, away, rangs, passes, h2h, absents, calendrier, kickoff, butsAttendus, source, picks } = input;
  const h = rangs.home, a = rangs.away;
  const surLesButs = !!verdict && ["OU", "BTTS", "TT1", "TT2", "DC_OU", "1X2_OU", "OU_BTTS"].includes(verdict.market);
  const p1 = picks.find((x) => x.market === "1X2" && x.sel === "1")?.p ?? null, p2 = picks.find((x) => x.market === "1X2" && x.sel === "2")?.p ?? null;
  const out: string[] = [];

  // 1. L'accroche
  if (surLesButs && butsAttendus !== null && butsAttendus >= 2.9) out.push(`${home} – ${away} : je m'attends à des buts, les cotes en annoncent environ ${dec(butsAttendus)}.`);
  else if (surLesButs && butsAttendus !== null && butsAttendus <= 2.2) out.push(`${home} – ${away} : un match qui s'annonce fermé, environ ${dec(butsAttendus)} buts selon les cotes.`);
  else if (p1 !== null && p2 !== null) {
    const [fav, aut, p] = p1 >= p2 ? [home, away, p1] : [away, home, p2];
    out.push(p >= 0.6 ? `Avantage net pour ${fav} face à ${aut}.` : p >= 0.45 ? `Léger avantage pour ${fav} face à ${aut}.` : `Match ouvert entre ${home} et ${away}.`);
  }

  // 2 et 3. Chaque équipe
  const equipe = (nom: string, r: StandingRow | null, chez: "domicile" | "exterieur") => {
    const ph: string[] = [];
    const t = chez === "domicile" ? r?.domicile : r?.exterieur;
    const ou = chez === "domicile" ? "chez lui" : "à l'extérieur";
    if (t && t.j >= 3) {
      const ton = t.p === 0 ? `invaincu ${ou}` : t.g === 0 ? `toujours sans victoire ${ou}` : t.g >= t.j * 0.6 ? `très solide ${ou}` : t.p >= t.j * 0.6 ? `en difficulté ${ou}` : null;
      const bilan = `${pl(t.g, "victoire")}, ${pl(t.n, "nul")} et ${pl(t.p, "défaite")} en ${pl(t.j, "match")}`;
      ph.push(ton ? `${nom} est ${ton} cette saison : ${bilan}.` : `${nom} ${ou} cette saison : ${bilan}.`);
    } else {
      const f = formeDe(r);
      if (f) ph.push(`${nom} sur ses ${f.k} derniers matchs : ${pl(f.v, "victoire")}, ${pl(f.nul, "nul")} et ${pl(f.d, "défaite")}.`);
    }
    if (r && r.joues >= 4) {
      const z = zoneFr(r.zone);
      ph.push(`${ord(r.rang)} du championnat avec ${pl(r.points, "point")} en ${pl(r.joues, "match")}, ${pl(r.bp, "but")} marqué${r.bp > 1 ? "s" : ""} pour ${r.bc} encaissé${r.bc > 1 ? "s" : ""}${z ? `, ${z}` : ""}.`);
    }
    if (surLesButs) {
      const b = bilanRecent(nom, passes);
      if (b.n >= 4 && (b.marque >= b.n - 1 || b.marque <= 1)) ph.push(b.marque === b.n ? `Il a marqué à chacun de ses ${b.n} derniers matchs.` : `Il a marqué sur ${b.marque} de ses ${b.n} derniers matchs.`);
      if (b.n >= 4 && (b.encaisse >= b.n - 1 || b.encaisse <= 1)) ph.push(b.encaisse === b.n ? `Il a encaissé à chacun de ses ${b.n} derniers matchs.` : `Il a encaissé sur ${b.encaisse} de ses ${b.n} derniers matchs.`);
    }
    const abs = (absents ?? []).filter((x) => coteDe(x.equipe, home, away) === (chez === "domicile" ? "1" : "2")).flatMap((x) => x.joueurs);
    if (abs.length) ph.push(`${abs.length > 1 ? "Absents" : "Absent"} : ${lister(abs)}.`);
    if (ph.length) out.push(ph.slice(0, 4).join(" "));
  };
  equipe(home, h, "domicile");
  equipe(away, a, "exterieur");

  // 4. Un fait de plus, le plus parlant
  const faces = h2h && h2h.length >= 3 ? h2h : passes.filter((p) => joue(p, home) && joue(p, away));
  let plus: string | null = null;
  if (faces.length >= 3) {
    const vainqueur = (p: Passe) => (p.sh > p.sa ? p.home : p.sa > p.sh ? p.away : null);
    const premier = vainqueur(faces[0]);
    let serie = 0;
    if (premier) for (const p of faces) { if (vainqueur(p) !== premier) break; serie++; }
    if (surLesButs) { const k = Math.min(faces.length, 5), deux = faces.slice(0, k).filter((p) => p.sh > 0 && p.sa > 0).length; if (deux >= k - 1 || deux <= 1) plus = `Les deux équipes ont marqué dans ${deux} de leurs ${k} dernières confrontations.`; }
    else if (premier && serie >= 3) plus = `${premier} a gagné les ${serie} dernières confrontations.`;
  }
  if (!plus && calendrier && kickoff) {
    const k = Date.parse(kickoff);
    for (const [nom, l] of [[home, calendrier.home], [away, calendrier.away]] as const) {
      const x = l.find((y) => y.avant && k - Date.parse(y.date) < 3.5 * 86_400_000);
      if (x && !plus) plus = `${nom} a joué il y a ${pl(Math.max(1, Math.round((k - Date.parse(x.date)) / 86_400_000)), "jour")} (${x.comp}) : peu de récupération.`;
    }
  }
  if (plus) out.push(plus);

  // 5. Le choix
  if (verdict) {
    const v = equipeVisee(verdict, home, away);
    const pGagne = v ? (v.cote === "1" ? p1 : p2) : null;
    const prudent = (verdict.market === "DC" || verdict.market === "DNB") && v && pGagne !== null && pGagne >= 0.45;
    const proba = `${passe(verdict.p)}${source === "modele" ? ", d'après le modèle" : ""}`;
    out.push(prudent ? `Je vois ${v!.nom} gagner, mais je joue la sécurité : ${verdict.market === "DNB" ? `${v!.nom}, remboursé si nul` : verdict.sel === "1N" ? `${home} ou nul` : `nul ou ${away}`} (${proba}).` : phraseChoix(verdict, home, away, source));
    const alt = verdictDe(input).autres;
    if (alt.length) out.push(`Autres options : ${alt.map((c) => `${c.label} (${Math.round(c.p * 100)} fois sur 100)`).join(" ; ")}.`);
  } else if (out.length) out.push("Pas encore de cote sur ce match : je ne tranche pas.");
  return out;
}

export function buildRecit(input: RecitInput): Recit {
  const etapes = [etapeEnjeu(input), etapeForme(input), etapeTerrain(input), etapeCalendrier(input), etapeAbsents(input), etapeDernier(input), etapeFace(input), etapeJoueur(input), etapeChiffre(input)].filter((e): e is Etape => !!e);
  const { verdict, autres } = verdictDe(input);
  const affiche = `${input.home} – ${input.away}`;
  const avis = verdict
    ? `Le choix le plus probable : ${verdict.label}. ${Math.round(verdict.p * 100)} chances sur 100${verdict.cote ? "" : " (estimation)"}.${autres.length ? ` ${autres.map((c) => `Plus ${c.categorie === "sur" ? "probable" : "osé"} : ${c.label}, ${Math.round(c.p * 100)} sur 100.`).join(" ")}` : ""}`
    : "Pas encore de cote sur ce match : aucun choix à mettre en avant.";
  const cles = pointsCles(input);
  const redac = redaction(input, verdict);
  const texte = [`${input.home} contre ${input.away}.`, ...(redac.length ? [redac.join(" ")] : []), ...etapes.map((e) => `${e.titre}. ${e.lignes.join(" ")}`), avis].join("\n");
  return { affiche, cles, redaction: redac, etapes, verdict, autres, source: input.source, texte };
}

/** `cacheSeul` (27/11) : dans les listes (Sources › Aujourd'hui), pas d'appel au fournisseur pendant l'affichage. */
export async function loadRecit(db: Db, matchId: string, cacheSeul = false): Promise<(Recit & { matchId: string; home: string; away: string; kickoff: string; comp: string; statut: string }) | null> {
  const { data } = await db.from("matches")
    .select("id, kickoff_at, statut, home_team_id, away_team_id, af_home_id, af_away_id, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(code_externe)")
    .eq("id", matchId).maybeSingle();
  if (!data) return null;
  const m = data as unknown as { id: string; kickoff_at: string; statut: string; home_team_id: string; away_team_id: string; af_home_id: number | null; af_away_id: number | null; home: One<{ nom: string }>; away: One<{ nom: string }>; competition: One<{ code_externe: string | null }> };
  const home = one(m.home)?.nom ?? "", away = one(m.away)?.nom ?? "", comp = one(m.competition)?.code_externe ?? "";
  const ids = [m.home_team_id, m.away_team_id];
  const k = Date.parse(m.kickoff_at), J = 86_400_000;
  const [{ data: st }, { data: past }, signals, h2hBrut, { data: proches }, { data: ex }] = await Promise.all([
    comp ? db.from("standings").select("*").eq("comp_code", comp).limit(400) : Promise.resolve({ data: [] }),
    db.from("matches").select("kickoff_at, score_home, score_away, details, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom)")
      .eq("statut", "termine").lt("kickoff_at", m.kickoff_at).or(`home_team_id.in.(${ids.join(",")}),away_team_id.in.(${ids.join(",")})`).order("kickoff_at", { ascending: false }).limit(14),
    loadSignals(db as never, [m.id], { bookmakers: true }),
    getConfrontations(m, cacheSeul).catch(() => null),
    // Calendrier : matchs des deux équipes de 3 jours avant à 4 jours après, toutes compétitions suivies
    db.from("matches").select("id, kickoff_at, home_team_id, away_team_id, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(nom)")
      .neq("id", m.id).neq("statut", "annule").gte("kickoff_at", new Date(k - 3 * J).toISOString()).lte("kickoff_at", new Date(k + 4 * J).toISOString())
      .or(`home_team_id.in.(${ids.join(",")}),away_team_id.in.(${ids.join(",")})`).limit(20),
    db.from("match_extras").select("injuries").eq("match_id", m.id).maybeSingle(),
  ]);
  // Confrontations : identifiants API-Football ramenés aux noms BETWISE (les autres équipes n'y figurent pas)
  const nomAf = (id: number) => (id === m.af_home_id ? home : id === m.af_away_id ? away : null);
  const h2h: Passe[] = (h2hBrut ?? []).filter((c) => nomAf(c.h) && nomAf(c.a)).map((c) => ({ date: c.date, home: nomAf(c.h)!, away: nomAf(c.a)!, sh: c.sh, sa: c.sa, buteurs: [] }));
  type Pr = { kickoff_at: string; home_team_id: string; away_team_id: string; home: One<{ nom: string }>; away: One<{ nom: string }>; competition: One<{ nom: string }> };
  const procheDe = (team: string): Proche[] => {
    const l = ((proches ?? []) as unknown as Pr[]).filter((x) => x.home_team_id === team || x.away_team_id === team);
    const avant = l.filter((x) => Date.parse(x.kickoff_at) < k).sort((x, y) => Date.parse(y.kickoff_at) - Date.parse(x.kickoff_at))[0];
    const apres = l.filter((x) => Date.parse(x.kickoff_at) > k).sort((x, y) => Date.parse(x.kickoff_at) - Date.parse(y.kickoff_at))[0];
    const vers = (x: Pr, av: boolean): Proche => ({ date: x.kickoff_at, comp: one(x.competition)?.nom ?? "autre compétition", adversaire: (x.home_team_id === team ? one(x.away)?.nom : one(x.home)?.nom) ?? "?", avant: av });
    return [avant && vers(avant, true), apres && vers(apres, false)].filter(Boolean) as Proche[];
  };
  // Absents : regroupés par équipe telle qu'API-Football la nomme
  const abs = new Map<string, string[]>();
  for (const a of ((ex?.injuries ?? []) as { equipe: string; joueur: string }[])) abs.set(a.equipe, [...(abs.get(a.equipe) ?? []), a.joueur]);
  const rows = latestStandings((st ?? []) as StandingRow[]);
  const sg = signals.get(m.id) ?? null;
  const passes: Passe[] = ((past ?? []) as unknown as { kickoff_at: string; score_home: number | null; score_away: number | null; details: { evts?: { t: string; n: string | null; e: "1" | "2" }[] } | null; home: One<{ nom: string }>; away: One<{ nom: string }> }[])
    .filter((p) => p.score_home !== null && p.score_away !== null)
    .map((p) => ({ date: p.kickoff_at, home: one(p.home)?.nom ?? "", away: one(p.away)?.nom ?? "", sh: p.score_home as number, sa: p.score_away as number,
      buteurs: (p.details?.evts ?? []).filter((e) => e.t === "but" || e.t === "pen").map((e) => ({ n: e.n, e: e.e })) }));
  const recit = buildRecit({
    home, away, rangs: { home: rows.find((r) => r.team_id === m.home_team_id) ?? null, away: rows.find((r) => r.team_id === m.away_team_id) ?? null }, table: rows, comp,
    passes, picks: sg ? picksOf(sg, "all").map((p) => ({ ...p, book: p.book && releveFrais(p.book.releveAt, m.kickoff_at) ? p.book : null })) : [], source: sg?.source ?? null, butsAttendus: sg ? sg.lh + sg.la : null,
    h2h, calendrier: m.statut === "programme" ? { home: procheDe(m.home_team_id), away: procheDe(m.away_team_id) } : undefined, kickoff: m.kickoff_at,
    absents: m.statut === "programme" ? [...abs].map(([equipe, joueurs]) => ({ equipe, joueurs })) : [],
  });
  return { ...recit, matchId: m.id, home, away, kickoff: m.kickoff_at, comp, statut: m.statut };
}
