/**
 * Données du nouvel accueil (maquettes validées le 19/11, docs/design/accueil/) : l'avis de Betster, les matchs du jour,
 * ce que disent les tipsters suivis. Lecture seule. Rien n'est inventé : un match sans donnée est montré sans chiffre.
 */
import type { createClient } from "@/lib/supabase/server";
import { coteAffichee, loadSignals, pickLabel, probOfSignal, releveFrais, bestPick, type Signal } from "@/lib/probs/signals";
import { loadToday, loadRepli, type TheirPick } from "@/lib/coach/today";
import { issue } from "@/lib/mesure/issue";
import { avisDuJour, couverture, expression, ilYA, libelleMarche, publieAvant, type Couverture, type Expression } from "./regles";

type Db = Awaited<ReturnType<typeof createClient>>;
type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const TZ = "Africa/Abidjan";
const jourDe = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

export type Cote = { cote: number; ou: string; age: string | null; frais: boolean };
export type CarteMatch = {
  id: string; comp: string | null; kickoff: string; statut: string; minute: number | null; home: string; away: string;
  score: [number, number] | null; couverture: Couverture;
  probs: { p1: number; pN: number; p2: number } | null;
  choix: { marche: string; label: string; p: number; market: string; param: number | null; sel: string; cote: Cote | null; book: { cote: number; bookmaker: string } | null; refCote: number | null } | null;
  verdict: "passe" | "pas_passe" | null; tonPari: boolean;
};
export type Avis = CarteMatch & { categorie: string; expression: Expression; perdSur100: number };
export type TipsterDuJour = { qui: string; match: string; selection: string; marche: string; p: number | null; publieAvant: boolean | null; tone: TheirPick["tone"]; aussiBetwise: boolean };

const MATCH = "id, kickoff_at, statut, minute, score_home, score_away, ht_home, ht_away, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(code_externe)";
type M = { id: string; kickoff_at: string; statut: string; minute: number | null; score_home: number | null; score_away: number | null; ht_home: number | null; ht_away: number | null; home: One<{ nom: string }>; away: One<{ nom: string }>; competition: One<{ code_externe: string | null }> };

/** Heure du dernier relevé de cote de référence par match (la médiane n'a pas d'heure à elle). */
async function relevesRef(db: Db, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 20) {
    const { data } = await db.from("odds_observations").select("match_id, observed_at").in("match_id", ids.slice(i, i + 20)).order("observed_at", { ascending: false }).limit(1000);
    for (const r of data ?? []) if (r.match_id && r.observed_at && !out.has(r.match_id)) out.set(r.match_id, r.observed_at);
  }
  return out;
}

function carte(m: M, sg: Signal | undefined, releve: string | undefined, choix?: { market: string; param: number | null; sel: string }): CarteMatch {
  const home = one(m.home)?.nom ?? "", away = one(m.away)?.nom ?? "";
  const cv = couverture(sg ? { source: sg.source, model: sg.model } : null);
  const score: [number, number] | null = m.score_home !== null && m.score_away !== null && m.statut !== "programme" ? [m.score_home, m.score_away] : null;
  let probs = null, c: CarteMatch["choix"] = null;
  if (sg) {
    const p = (s: string) => probOfSignal(sg, "1X2", null, s) ?? 0;
    probs = { p1: p("1"), pN: p("N"), p2: p("2") };
    const pk = choix ? { ...choix, p: probOfSignal(sg, choix.market, choix.param, choix.sel) ?? 0, cote: sg.refOdd(choix.market, choix.param, choix.sel), book: sg.bookOdd(choix.market, choix.param, choix.sel) } : bestPick(sg);
    const book = pk.book && releveFrais(pk.book.releveAt, m.kickoff_at) ? pk.book : null;
    const aff = coteAffichee({ cote: pk.cote, book });
    const refFrais = releve ? releveFrais(releve, m.kickoff_at) : false;
    const cote: Cote | null = aff ? (aff.origine === "bookmaker"
      ? { cote: aff.cote, ou: `Cote ${aff.bookmaker}`, age: ilYA(book!.releveAt), frais: true }
      : { cote: aff.cote, ou: "Cote médiane", age: releve ? ilYA(releve) : null, frais: refFrais }) : null;
    c = { marche: libelleMarche(pk.market), label: pickLabel(pk.market, pk.param, pk.sel, home, away), p: pk.p, market: pk.market, param: pk.param, sel: pk.sel, cote, book: book ? { cote: book.cote, bookmaker: book.bookmaker } : null, refCote: pk.cote };
  }
  // Après le match : la sélection affichée est-elle passée ? Seulement pour les marchés réglés sur le score.
  let verdict: CarteMatch["verdict"] = null;
  if (c && m.statut === "termine" && score) {
    const r = issue(c.market, c.param, c.sel, { h: score[0], a: score[1], hth: m.ht_home, hta: m.ht_away });
    verdict = r === "gagne" ? "passe" : r === "perdu" ? "pas_passe" : null;
  }
  return { id: m.id, comp: one(m.competition)?.code_externe ?? null, kickoff: m.kickoff_at, statut: m.statut, minute: m.minute, home, away, score, couverture: cv, probs, choix: c, verdict, tonPari: false };
}

export async function loadAccueil(db: Db, userId: string) {
  const today = await loadToday(db, userId);
  const jour = jourDe(new Date().toISOString());

  // Matchs du jour (heure d'Abidjan) et ceux encore en cours d'hier soir
  const debut = new Date(Date.now() - 18 * 3600000).toISOString(), fin = new Date(Date.now() + 30 * 3600000).toISOString();
  const { data } = await db.from("matches").select(MATCH).gte("kickoff_at", debut).lte("kickoff_at", fin).neq("statut", "annule").order("kickoff_at").limit(200);
  const tous = ((data ?? []) as unknown as M[]).filter((m) => jourDe(m.kickoff_at) === jour || m.statut === "en_cours");

  const avisPick = avisDuJour(today.picks);
  const ids = [...new Set([...tous.map((m) => m.id), ...(avisPick ? [avisPick.match_id] : [])])];
  const [signals, releves] = await Promise.all([loadSignals(db, ids, { bookmakers: true }), relevesRef(db, ids)]);

  const mesMatchs = new Set(today.theirs.filter((t) => t.type === "pari").map((t) => t.match_id));
  const cartes = tous.map((m) => ({ ...carte(m, signals.get(m.id), releves.get(m.id)), tonPari: mesMatchs.has(m.id) }));
  // En direct d'abord, puis à venir, puis terminés ; à heure égale, les matchs analysés avant les autres
  const rang = (c: CarteMatch) => (c.statut === "en_cours" ? 0 : c.statut === "programme" ? 1 : 2);
  cartes.sort((a, b) => rang(a) - rang(b) || Date.parse(a.kickoff) - Date.parse(b.kickoff) || Number(!a.probs) - Number(!b.probs));

  let avis: Avis | null = null;
  if (avisPick) {
    const { data: m } = await db.from("matches").select(MATCH).eq("id", avisPick.match_id).maybeSingle();
    if (m) {
      const c = carte(m as unknown as M, signals.get(avisPick.match_id), releves.get(avisPick.match_id), { market: avisPick.market, param: avisPick.param, sel: avisPick.sel });
      const p = c.choix?.p ?? avisPick.p;
      avis = { ...c, tonPari: mesMatchs.has(c.id), categorie: avisPick.categorie, perdSur100: Math.round((1 - p) * 100),
        expression: expression({ p, couverture: c.couverture, coteFraiche: !!c.choix?.cote?.frais }) };
    }
  }

  // Jour creux : rien d'analysé à venir aujourd'hui → les meilleures probabilités des prochains jours
  const analysesAVenir = cartes.filter((c) => c.probs && c.statut === "programme").length;
  const repli = !avis && analysesAVenir === 0 ? await loadRepli(db, 3) : [];

  const tipsters: TipsterDuJour[] = today.theirs.filter((t) => t.type === "prono").slice(0, 4).map((t) => ({
    qui: t.qui, match: t.match, selection: t.selection, marche: libelleMarche(t.market), p: t.p, publieAvant: publieAvant(t.publie, t.kickoff), tone: t.tone, aussiBetwise: t.aussiBetwise,
  }));

  return { avis, cartes, repli, tipsters, nbAnalyses: cartes.filter((c) => c.probs).length, nbSans: cartes.filter((c) => !c.probs).length };
}
