import { loadPourquoi, type Pourquoi } from "@/lib/matches/justification";
/**
 * Données du nouvel accueil (maquettes validées le 19/11, docs/design/accueil/) : l'avis de Betster, les matchs du jour,
 * ce que disent les tipsters suivis. Lecture seule. Rien n'est inventé : un match sans donnée est montré sans chiffre.
 */
import type { createClient } from "@/lib/supabase/server";
import { coteAffichee, loadSignals, pickLabel, probOfSignal, releveFrais, bestPick, type Signal } from "@/lib/probs/signals";
import { loadToday, loadRepli, type TheirPick } from "@/lib/coach/today";
import { issue } from "@/lib/mesure/issue";
import { loadOptions, type Periode } from "@/lib/options/load";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Option } from "@/lib/options/build";
import { profilDe, type Categorie } from "@/lib/coach/categories";
import { logoEquipe } from "@/lib/logos";
import { estTop5 } from "@/lib/competitions";
import { BETCLIC_FR, estimerBetclicCI, type EstimationCI } from "@/lib/odds-api/betclic-ci";
import { avisDuJour, couverture, expression, ilYA, libelleMarche, publieAvant, type Couverture, type Expression } from "./regles";

type Db = Awaited<ReturnType<typeof createClient>>;
type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const TZ = "Africa/Abidjan";
const jourDe = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

export type Cote = { cote: number; ou: string; age: string | null; frais: boolean };
export type CarteMatch = {
  id: string; comp: string | null; kickoff: string; statut: string; minute: number | null; home: string; away: string;
  score: [number, number] | null; couverture: Couverture; logos?: [string | null, string | null];
  probs: { p1: number; pN: number; p2: number } | null;
  choix: { marche: string; label: string; p: number; market: string; param: number | null; sel: string; cote: Cote | null; book: { cote: number; bookmaker: string } | null; refCote: number | null } | null;
  verdict: "passe" | "pas_passe" | null; tonPari: boolean;
  /** Jusqu'à trois propositions, une par niveau de risque quand elles existent (moteur d'options). */
  propositions: Proposition[];
  /** Forme et face-à-face tirés des matchs terminés en base ; null si les équipes n'ont pas d'historique suivi. */
  pourquoi?: Pourquoi | null;
};
export type Avis = CarteMatch & { categorie: string; expression: Expression; perdSur100: number };
/** Une proposition affichée : marché, probabilité, cote avec sa source et son heure, niveau de risque. */
export type Proposition = {
  matchId: string; home: string; away: string; kickoff: string; comp: string | null;
  market: string; param: number | null; sel: string; marche: string; label: string; p: number;
  profil: Categorie; cote: Cote | null; book: { cote: number; bookmaker: string } | null; refCote: number | null; couverture: Couverture;
  /** Résultat du match seulement, grands championnats couverts par Betclic France : cote France et estimation Côte d'Ivoire. */
  betclic: { fr: number; ci: EstimationCI; age: string } | null;
};
/** Une option du jour pour la recherche par fourchette de probabilité. */
export type OptionRecherche = { matchId: string; home: string; away: string; kickoff: string; comp: string | null; label: string; p: number; cote: number | null; ou: string | null };

export type MatchAVenir = { matchId: string; home: string; away: string; kickoff: string; comp: string | null; propositions: Proposition[]; pourquoi?: Pourquoi | null };
export type TipsterDuJour = { qui: string; match: string; selection: string; marche: string; p: number | null; publieAvant: boolean | null; tone: TheirPick["tone"]; aussiBetwise: boolean };

const MATCH = "id, kickoff_at, statut, minute, score_home, score_away, ht_home, ht_away, af_home_id, af_away_id, home:teams!matches_home_team_id_fkey(nom, code_externe), away:teams!matches_away_team_id_fkey(nom, code_externe), competition:competitions(code_externe)";
type M = { id: string; kickoff_at: string; statut: string; minute: number | null; score_home: number | null; score_away: number | null; ht_home: number | null; ht_away: number | null; af_home_id: number | null; af_away_id: number | null; home: One<{ nom: string; code_externe: string | null }>; away: One<{ nom: string; code_externe: string | null }>; competition: One<{ code_externe: string | null }> };

/** Heure du dernier relevé de cote de référence par match (la médiane n'a pas d'heure à elle). */
/** Dernière cote Betclic France de chaque issue du résultat (1, N, 2), par match. */
type Betclic = Map<string, Map<string, { cote: number; at: string }>>;
async function relevesBetclic(db: Db, ids: string[]): Promise<Betclic> {
  const out: Betclic = new Map();
  for (let i = 0; i < ids.length; i += 40) {
    const { data } = await db.from("odds_observations").select("match_id, selection, cote, observed_at").eq("bookmaker", BETCLIC_FR).eq("market_code", "1X2")
      .in("match_id", ids.slice(i, i + 40)).order("observed_at", { ascending: false }).limit(1000);
    for (const r of data ?? []) {
      if (!r.match_id || !r.observed_at) continue;
      const m = out.get(r.match_id) ?? new Map();
      if (!m.has(r.selection)) m.set(r.selection, { cote: Number(r.cote), at: r.observed_at });
      out.set(r.match_id, m);
    }
  }
  return out;
}

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
  return { id: m.id, comp: one(m.competition)?.code_externe ?? null, kickoff: m.kickoff_at, statut: m.statut, minute: m.minute, home, away, score, couverture: cv,
    logos: [logoEquipe({ af: m.af_home_id, code: one(m.home)?.code_externe }), logoEquipe({ af: m.af_away_id, code: one(m.away)?.code_externe })], probs, choix: c, verdict, tonPari: false, propositions: [] };
}

const PROFILS: Categorie[] = ["sur", "audacieux", "risque"];

/** Une option du moteur → proposition affichable, avec la cote 1xBet fraîche si le signal du match l'a. */
function proposition(o: Option, sg: Signal | undefined, releve: string | undefined, bc: Betclic): Proposition | null {
  const bk = sg?.bookOdd(o.market, o.param, o.sel) ?? null;
  const book = bk && releveFrais(bk.releveAt, o.kickoff) ? bk : null;
  const aff = coteAffichee({ cote: o.cote, book });
  // Le niveau se lit sur la cote affichée (1xBet quand elle existe), pour ne jamais écrire « cote 1,29 · Équilibré »
  const profil = profilDe(o.p, aff?.cote ?? o.cote);
  if (!profil) return null;
  const b = o.market === "1X2" ? bc.get(o.matchId)?.get(o.sel) : undefined;
  const ci = b && releveFrais(b.at, o.kickoff) ? estimerBetclicCI(b.cote) : null;
  const cote: Cote | null = aff ? (aff.origine === "bookmaker"
    ? { cote: aff.cote, ou: `Cote ${aff.bookmaker}`, age: ilYA(book!.releveAt), frais: true }
    : { cote: aff.cote, ou: "Cote médiane", age: releve ? ilYA(releve) : null, frais: releve ? releveFrais(releve, o.kickoff) : false }) : null;
  return { matchId: o.matchId, home: o.home, away: o.away, kickoff: o.kickoff, comp: o.comp || null, market: o.market, param: o.param, sel: o.sel,
    marche: libelleMarche(o.market), label: o.label, p: o.p, profil, cote, book: book ? { cote: book.cote, bookmaker: book.bookmaker } : null, refCote: o.cote,
    couverture: o.source === "modele" ? "modele" : sg?.model ? "marche_modele" : "marche",
    betclic: b && ci ? { fr: b.cote, ci, age: ilYA(b.at) } : null };
}
const nn = <T,>(x: T | null): x is T => x !== null;

/** Pour chaque match, la meilleure option de chaque niveau de risque (marchés différents), Prudent d'abord. */
export function parProfil(options: Option[]): Map<string, { o: Option; profil: Categorie }[]> {
  const out = new Map<string, { o: Option; profil: Categorie }[]>();
  for (const o of [...options].sort((a, b) => b.p - a.p)) {
    const profil = profilDe(o.p, o.cote); if (!profil) continue;
    const l = out.get(o.matchId) ?? [];
    if (!l.some((x) => x.profil === profil || x.o.market === o.market)) l.push({ o, profil });
    out.set(o.matchId, l);
  }
  for (const l of out.values()) l.sort((a, b) => PROFILS.indexOf(a.profil) - PROFILS.indexOf(b.profil));
  return out;
}

/**
 * Options du jour et de demain : les mêmes pour tous les utilisateurs (matchs et cotes publics), longues à calculer.
 * Gardées une minute en mémoire (P1-10, 22/11) ; lues avec le client serveur, sans aucune donnée personnelle.
 */
const optionsCommunes = unstable_cache(
  async (periode: Periode) => loadOptions(createAdminClient() as never, periode),
  ["accueil-options"], { revalidate: 60 },
);

export async function loadAccueil(db: Db, userId: string) {
  const jour = jourDe(new Date().toISOString());
  // Matchs du jour (heure d'Abidjan) et ceux encore en cours d'hier soir
  const debut = new Date(Date.now() - 18 * 3600000).toISOString(), fin = new Date(Date.now() + 30 * 3600000).toISOString();
  // Indépendants les uns des autres : lancés ensemble (P1-10, 22/11)
  const [today, { data }, [optAuj, optDemain]] = await Promise.all([
    loadToday(db, userId),
    db.from("matches").select(MATCH).gte("kickoff_at", debut).lte("kickoff_at", fin).neq("statut", "annule").order("kickoff_at").limit(200),
    Promise.all([optionsCommunes("auj"), optionsCommunes("demain")]),
  ]);
  // Prédictions du jour : uniquement les matchs pas encore commencés (21/11) ; le direct et les résultats sont dans Matchs
  const pasCommence = (statut: string, kickoff: string) => statut === "programme" && Date.parse(kickoff) > Date.now();
  const tous = ((data ?? []) as unknown as M[]).filter((m) => jourDe(m.kickoff_at) === jour && pasCommence(m.statut, m.kickoff_at));
  today.picks = today.picks.filter((x) => pasCommence(x.statut, x.kickoff));

  const avisPick = avisDuJour(today.picks);
  const ids = [...new Set([...tous.map((m) => m.id), ...today.picks.map((p) => p.match_id), ...optDemain.options.map((o) => o.matchId)])];
  const [signals, releves, bc] = await Promise.all([loadSignals(db, ids, { bookmakers: true }), relevesRef(db, ids), relevesBetclic(db, ids)]);

  const mesMatchs = new Set(today.theirs.filter((t) => t.type === "pari").map((t) => t.match_id));
  const profilsAuj = parProfil(optAuj.options);
  const cartes = tous.map((m) => ({ ...carte(m, signals.get(m.id), releves.get(m.id)), tonPari: mesMatchs.has(m.id),
    propositions: (profilsAuj.get(m.id) ?? []).map(({ o }) => proposition(o, signals.get(m.id), releves.get(m.id), bc)).filter(nn) }));
  // En direct d'abord, puis à venir, puis terminés ; à heure égale, les matchs analysés avant les autres
  const rang = (c: CarteMatch) => (c.statut === "en_cours" ? 0 : c.statut === "programme" ? 1 : 2);
  // Les 5 grands championnats d'abord (21/11), puis les autres ; dans chaque groupe, du plus proche au plus lointain
  cartes.sort((a, b) => rang(a) - rang(b) || Number(!estTop5(a.comp)) - Number(!estTop5(b.comp)) || Date.parse(a.kickoff) - Date.parse(b.kickoff) || Number(!a.probs) - Number(!b.probs));

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

  // Meilleures options du jour par profil : les coups du jour (3 par niveau), sinon les meilleures options de demain
  const profils: Record<Categorie, Proposition[]> = { sur: [], audacieux: [], risque: [] };
  const optionDe = (pk: (typeof today.picks)[number]): Option => ({ matchId: pk.match_id, kickoff: pk.kickoff, home: pk.home, away: pk.away, comp: pk.comp ?? "", market: pk.market, param: pk.param, sel: pk.sel, label: pk.selection, famille: "resultat", p: pk.p, cote: pk.cote, source: "marche" });
  for (const pk of today.picks.filter((x) => x.statut === "programme")) {
    const x = proposition(optionDe(pk), signals.get(pk.match_id), releves.get(pk.match_id), bc);
    if (x) profils[x.profil].push(x);
  }
  for (const k of PROFILS) profils[k].sort((a, b) => Number(!estTop5(a.comp)) - Number(!estTop5(b.comp)));
  const profilsDeDemain = !today.picks.some((x) => x.statut === "programme");
  if (profilsDeDemain) {
    const vus = new Set<string>();
    for (const [, l] of [...parProfil(optDemain.options).entries()].sort(([, a], [, b]) => Number(!estTop5(a[0].o.comp)) - Number(!estTop5(b[0].o.comp)))) for (const { o, profil } of l) {
      const x = proposition(o, signals.get(o.matchId), releves.get(o.matchId), bc);
      if (!x || profils[x.profil].length >= 3 || vus.has(`${o.matchId}|${x.profil}`)) continue;
      vus.add(`${o.matchId}|${x.profil}`); profils[x.profil].push(x);
    }
    for (const k of PROFILS) profils[k].sort((a, b) => Number(!estTop5(a.comp)) - Number(!estTop5(b.comp)) || b.p - a.p);
  }

  // Demain : les matchs analysés, deux propositions chacun
  const demain: MatchAVenir[] = [...parProfil(optDemain.options).entries()].map(([matchId, l]) => {
    const o = l[0].o;
    return { matchId, home: o.home, away: o.away, kickoff: o.kickoff, comp: o.comp || null, propositions: l.slice(0, 2).map(({ o: x }) => proposition(x, signals.get(matchId), releves.get(matchId), bc)).filter(nn) };
  }).sort((a, b) => Number(!estTop5(a.comp)) - Number(!estTop5(b.comp)) || Date.parse(a.kickoff) - Date.parse(b.kickoff));

  // Justification (forme, face-à-face) pour les matchs à venir affichés
  const aJustifier = [...new Set([...cartes.filter((c) => c.statut === "programme" && c.probs).map((c) => c.id), ...demain.map((m) => m.matchId)])].slice(0, 40);
  const raisons = await loadPourquoi(db, aJustifier);
  for (const c of cartes) c.pourquoi = raisons.get(c.id) ?? null;
  for (const m of demain) m.pourquoi = raisons.get(m.matchId) ?? null;

  const nbPropositions = PROFILS.reduce((n, k) => n + profils[k].length, 0);
  // Recherche par fourchette : toutes les options calculées des matchs du jour pas encore commencés
  const recherche: OptionRecherche[] = optAuj.options.filter((o) => Date.parse(o.kickoff) > Date.now()).map((o) => {
    const sg = signals.get(o.matchId), bk = sg?.bookOdd(o.market, o.param, o.sel);
    const book = bk && releveFrais(bk.releveAt, o.kickoff) ? bk : null;
    return { matchId: o.matchId, home: o.home, away: o.away, kickoff: o.kickoff, comp: o.comp || null, label: o.label, p: o.p, cote: book?.cote ?? o.cote ?? null, ou: book ? book.bookmaker : o.cote ? "médiane" : null };
  }).slice(0, 1500);
  return { avis, recherche, cartes, repli, tipsters, profils, profilsDeDemain, demain, nbPropositions,
    nbDemain: optDemain.nbMatchs, nbDemainAnalyses: optDemain.nbCouverts,
    nbAnalyses: cartes.filter((c) => c.probs).length, nbSans: cartes.filter((c) => !c.probs).length };
}
