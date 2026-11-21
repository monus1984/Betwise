/**
 * Le récit d'un match : la démarche d'un analyste, dans l'ordre où il la déroule.
 *   l'enjeu → la forme → le dernier match → le face-à-face → le joueur du moment → le chiffre qui pèse → le verdict.
 * Chaque étape n'apparaît que si la base a de quoi la dire : rien n'est inventé pour remplir.
 * Le verdict, lui, vient des probabilités BETWISE (cotes de référence d'abord) et non des étapes : elles l'éclairent,
 * elles ne le prouvent pas, et l'écran le dit.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { categorieOf, type Categorie } from "../coach/categories";
import { familleOf, loadSignals, pickLabel, picksOf, type Pick } from "../probs/signals";
import { latestStandings, type StandingRow } from "./standings";
import { enjeux, fraicheur } from "./enjeux";

type Db = SupabaseClient<Database, "betwise">;
type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const TZ = "Africa/Abidjan";

export type Etape = { cle: "enjeu" | "forme" | "dernier" | "face" | "joueur" | "chiffre"; titre: string; lignes: string[] };
export type Choix = { market: string; param: number | null; sel: string; label: string; p: number; cote: number | null; categorie: Categorie };
export type Recit = { affiche: string; etapes: Etape[]; verdict: Choix | null; autres: Choix[]; source: "marche" | "modele" | null; texte: string };

export type Passe = { date: string; home: string; away: string; sh: number; sa: number; buteurs: { n: string | null; e: "1" | "2" }[] };
export type RecitInput = {
  home: string; away: string;
  rangs: { home: StandingRow | null; away: StandingRow | null };
  /** Classement complet de la compétition (pour les enjeux : titre, places qualificatives, maintien). */
  table?: StandingRow[]; comp?: string;
  /** Matchs terminés des deux équipes, du plus récent au plus ancien. */
  passes: Passe[];
  picks: Pick[]; source: "marche" | "modele" | null; butsAttendus: number | null;
};

const dec = (x: number) => x.toFixed(1).replace(".", ",");
const ord = (n: number) => (n === 1 ? "1er" : `${n}e`);
const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const pl = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

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
    return `${nom} : ${serie}, ${dec(r.bp / r.joues)} but marqué et ${dec(r.bc / r.joues)} encaissé par match.`;
  };
  const lignes = [dit(home, rangs.home), dit(away, rangs.away)].filter(Boolean) as string[];
  return lignes.length ? { cle: "forme", titre: "La forme", lignes } : null;
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

function etapeFace({ home, away, passes }: RecitInput): Etape | null {
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

function etapeChiffre({ home, away, rangs, butsAttendus }: RecitInput): Etape | null {
  const lignes: string[] = [];
  for (const [nom, r] of [[home, rangs.home], [away, rangs.away]] as const) {
    if (!r || r.joues < 3) continue;
    if (r.bc / r.joues >= 2) lignes.push(`${nom} a encaissé ${r.bc} buts en ${r.joues} matchs.`);
    else if (r.bc / r.joues <= 0.6) lignes.push(`${nom} n’a encaissé que ${pl(r.bc, "but")} en ${r.joues} matchs.`);
    if (r.bp / r.joues <= 0.6) lignes.push(`${nom} n’a marqué que ${pl(r.bp, "but")} en ${r.joues} matchs.`);
    if (r.points === 0) lignes.push(`${nom} n’a pris aucun point.`);
  }
  if (butsAttendus !== null) lignes.push(`Les cotes annoncent environ ${dec(butsAttendus)} buts dans ce match.`);
  return lignes.length ? { cle: "chiffre", titre: "Le chiffre qui pèse", lignes: lignes.slice(0, 3) } : null;
}

/** Le verdict : la sélection la plus probable de la catégorie Audacieux, puis une plus sûre et une plus osée. */
function verdictDe({ home, away, picks }: RecitInput): { verdict: Choix | null; autres: Choix[] } {
  const utiles = picks.filter((p) => familleOf(p.market) !== "mitemps" && !["MG", "OE", "HMG", "CS"].includes(p.market));
  const de = (cat: Categorie): Choix | null => {
    const p = utiles.filter((x) => categorieOf(x.p) === cat).sort((x, y) => Number(y.cote !== null) - Number(x.cote !== null) || y.p - x.p)[0];
    return p ? { market: p.market, param: p.param, sel: p.sel, label: pickLabel(p.market, p.param, p.sel, home, away), p: p.p, cote: p.cote, categorie: cat } : null;
  };
  const a = de("audacieux"), s = de("sur"), r = de("risque");
  const verdict = a ?? s ?? r;
  return { verdict, autres: [s, a, r].filter((c): c is Choix => !!c && c !== verdict) };
}

export function buildRecit(input: RecitInput): Recit {
  const etapes = [etapeEnjeu(input), etapeForme(input), etapeDernier(input), etapeFace(input), etapeJoueur(input), etapeChiffre(input)].filter((e): e is Etape => !!e);
  const { verdict, autres } = verdictDe(input);
  const affiche = `${input.home} – ${input.away}`;
  const avis = verdict
    ? `Le choix le plus probable : ${verdict.label}. ${Math.round(verdict.p * 100)} chances sur 100${verdict.cote ? "" : " (estimation)"}.${autres.length ? ` ${autres.map((c) => `Plus ${c.categorie === "sur" ? "probable" : "osé"} : ${c.label}, ${Math.round(c.p * 100)} sur 100.`).join(" ")}` : ""}`
    : "Pas encore de cote sur ce match : aucun choix à mettre en avant.";
  const texte = [`${input.home} contre ${input.away}.`, ...etapes.map((e) => `${e.titre}. ${e.lignes.join(" ")}`), avis].join("\n");
  return { affiche, etapes, verdict, autres, source: input.source, texte };
}

export async function loadRecit(db: Db, matchId: string): Promise<(Recit & { matchId: string; home: string; away: string; kickoff: string; comp: string; statut: string }) | null> {
  const { data } = await db.from("matches")
    .select("id, kickoff_at, statut, home_team_id, away_team_id, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(code_externe)")
    .eq("id", matchId).maybeSingle();
  if (!data) return null;
  const m = data as unknown as { id: string; kickoff_at: string; statut: string; home_team_id: string; away_team_id: string; home: One<{ nom: string }>; away: One<{ nom: string }>; competition: One<{ code_externe: string | null }> };
  const home = one(m.home)?.nom ?? "", away = one(m.away)?.nom ?? "", comp = one(m.competition)?.code_externe ?? "";
  const ids = [m.home_team_id, m.away_team_id];
  const [{ data: st }, { data: past }, signals] = await Promise.all([
    comp ? db.from("standings").select("*").eq("comp_code", comp).limit(400) : Promise.resolve({ data: [] }),
    db.from("matches").select("kickoff_at, score_home, score_away, details, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom)")
      .eq("statut", "termine").lt("kickoff_at", m.kickoff_at).or(`home_team_id.in.(${ids.join(",")}),away_team_id.in.(${ids.join(",")})`).order("kickoff_at", { ascending: false }).limit(14),
    loadSignals(db as never, [m.id]),
  ]);
  const rows = latestStandings((st ?? []) as StandingRow[]);
  const sg = signals.get(m.id) ?? null;
  const passes: Passe[] = ((past ?? []) as unknown as { kickoff_at: string; score_home: number | null; score_away: number | null; details: { evts?: { t: string; n: string | null; e: "1" | "2" }[] } | null; home: One<{ nom: string }>; away: One<{ nom: string }> }[])
    .filter((p) => p.score_home !== null && p.score_away !== null)
    .map((p) => ({ date: p.kickoff_at, home: one(p.home)?.nom ?? "", away: one(p.away)?.nom ?? "", sh: p.score_home as number, sa: p.score_away as number,
      buteurs: (p.details?.evts ?? []).filter((e) => e.t === "but" || e.t === "pen").map((e) => ({ n: e.n, e: e.e })) }));
  const recit = buildRecit({
    home, away, rangs: { home: rows.find((r) => r.team_id === m.home_team_id) ?? null, away: rows.find((r) => r.team_id === m.away_team_id) ?? null }, table: rows, comp,
    passes, picks: sg ? picksOf(sg, "all") : [], source: sg?.source ?? null, butsAttendus: sg ? sg.lh + sg.la : null,
  });
  return { ...recit, matchId: m.id, home, away, kickoff: m.kickoff_at, comp, statut: m.statut };
}
