/**
 * Dossier commun d'un passage et outils de lecture des tipsters IA. Tous les tipsters d'un même passage reçoivent le
 * même dossier (mêmes matchs, mêmes cotes, même heure) et les mêmes outils. Aucun outil n'écrit : l'enregistrement
 * des paris est fait par l'orchestrateur après validation.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { loadSignals, pickLabel, probOfSignal, familleOf, type Signal } from "../probs/signals";
import { loadRecit } from "../matches/recit";
import { probOf } from "../probs/grid";
import { getExtras } from "../api-football/extras";
import { categorieFromOdds, CAT_LABEL } from "../coach/categories";
import { COMPETITIONS } from "../competitions";
import type { Option } from "./validation";

type Db = SupabaseClient<Database, "betwise">;
type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const pct = (p: number | null) => (p === null ? null : Math.round(p * 1000) / 10);
const heure = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

export type MatchDossier = { id: string; ref: string; affiche: string; home: string; away: string; comp: string; compNom: string; kickoff: string; afFixture: number | null; statut: string };
export type Dossier = { creeA: string; matchs: MatchDossier[]; signals: Map<string, Signal>; options: Map<string, Option>; parMatch: Map<string, Option[]> };

/** Matchs qui commencent dans 20 min à `heures` heures, avec au moins une cote 1xBet fraîche. */
export async function construireDossier(db: Db, heures = 10): Promise<Dossier> {
  const { data } = await db.from("matches")
    .select("id, kickoff_at, statut, af_fixture_id, competition:competitions(code_externe, nom), home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom)")
    .eq("statut", "programme").gte("kickoff_at", new Date(Date.now() + 20 * 60000).toISOString()).lte("kickoff_at", new Date(Date.now() + heures * 3600000).toISOString())
    .order("kickoff_at").limit(300);
  const bruts = (data ?? []) as unknown as { id: string; kickoff_at: string; statut: string; af_fixture_id: number | null; competition: One<{ code_externe: string | null; nom: string }>; home: One<{ nom: string }>; away: One<{ nom: string }> }[];
  const signals = await loadSignals(db as never, bruts.map((m) => m.id), { bookmakers: true });
  const matchs: MatchDossier[] = [], options = new Map<string, Option>(), parMatch = new Map<string, Option[]>();
  for (const m of bruts) {
    const sg = signals.get(m.id);
    const book = (sg?.bookAll ?? []).filter((o) => o.bookmaker.toLowerCase().replace(/\s/g, "").includes("1xbet"));
    if (!book.length) continue;
    const home = one(m.home)?.nom ?? "?", away = one(m.away)?.nom ?? "?", comp = one(m.competition)?.code_externe ?? "";
    const ref = `M${matchs.length + 1}`;
    matchs.push({ id: m.id, ref, affiche: `${home} – ${away}`, home, away, comp, compNom: one(m.competition)?.nom ?? comp, kickoff: m.kickoff_at, afFixture: m.af_fixture_id, statut: m.statut });
    const liste = book.map((o, i): Option => ({ id: `${ref}.${i + 1}`, matchId: m.id, market: o.market, param: o.param, sel: o.sel, label: pickLabel(o.market, o.param, o.sel, home, away), cote: o.cote, releveAt: o.releveAt, kickoff: m.kickoff_at }));
    for (const o of liste) options.set(o.id, o);
    parMatch.set(m.id, liste);
  }
  return { creeA: new Date().toISOString(), matchs, signals, options, parMatch };
}

/** Les outils, au format commun (nom, description, schéma d'entrée). */
export const OUTILS = [
  { name: "matchs_a_venir", description: "Liste des matchs du passage (le matin : toute la journée ; ensuite : les 10 heures suivantes) : référence M1, M2…, compétition, heure d'Abidjan, cotes 1xBet du résultat, probabilités du marché (cotes de référence sans marge) quand elles existent.", input_schema: { type: "object", properties: {} } },
  { name: "analyser_match", description: "Fiche d'un match : enjeu au classement, forme récente, dernier match, confrontations, joueur du moment, absents et blessés, compositions si elles sont publiées (environ 1 h avant), buts attendus par le marché et par le modèle BETWISE.", input_schema: { type: "object", properties: { match: { type: "string", description: "Référence du match, ex. M3" } }, required: ["match"] } },
  { name: "cotes_match", description: "Toutes les options cotées par 1xBet pour un match, avec leur identifiant (ex. M3.12), la cote, l'heure du relevé, et quand elles sont calculables la probabilité du marché et celle du modèle. Seules ces options peuvent être jouées.", input_schema: { type: "object", properties: { match: { type: "string" }, famille: { type: "string", enum: ["tout", "resultat", "buts", "mitemps", "combo"], description: "Filtrer par famille de marchés ; par défaut tout" } }, required: ["match"] } },
  { name: "mon_historique", description: "Ton propre historique : bankroll, argent en jeu, paris déjà joués aujourd'hui, tes 40 derniers paris avec cote, mise, probabilité annoncée, raison et résultat, et ton bilan par niveau de cote et par marché.", input_schema: { type: "object", properties: {} } },
  { name: "decision", description: "Ta décision finale pour ce passage (une seule fois, à la fin). Tu peux ne rien jouer.", input_schema: { type: "object", properties: {
    paris: { type: "array", items: { type: "object", properties: {
      option: { type: "string", description: "Identifiant d'une option renvoyée par cotes_match, ex. M3.12" },
      mise: { type: "number", description: "Mise en FCFA, que tu fixes toi-même" },
      probabilite: { type: "number", description: "Ta propre estimation de la chance que le pari passe, entre 0 et 1" },
      raison: { type: "string", description: "Pourquoi ce pari, en t'appuyant sur les informations consultées" },
    }, required: ["option", "mise", "probabilite", "raison"] } },
    combines: { type: "array", description: "Combinés (facultatif) : 2 ou 3 options de matchs différents, cote totale de 1,50 à 3. Un match déjà joué en simple peut y figurer.", items: { type: "object", properties: {
      options: { type: "array", items: { type: "string" }, description: "Identifiants des options renvoyées par cotes_match, une par match" },
      mise: { type: "number", description: "Mise en FCFA, que tu fixes toi-même" },
      probabilite: { type: "number", description: "Ta propre estimation de la chance que TOUT le combiné passe, entre 0 et 1 (le produit des chances n'est juste que si les sélections sont indépendantes)" },
      raison: { type: "string", description: "Pourquoi ces sélections ensemble : ce qui rend chacune probable, et pourquoi elles ne dépendent pas l'une de l'autre" },
    }, required: ["options", "mise", "probabilite", "raison"] } },
    abstention: { type: "string", description: "Si tu ne joues rien ou peu : pourquoi" },
    carnet: { type: "string", description: "Ton carnet réécrit en entier (tes règles du moment et ce que tu as appris). Obligatoire quand on te le demande, sinon facultatif." },
  }, required: ["paris"] } },
] as const;

export type HistoriqueFn = () => Promise<unknown>;

/** Exécute un outil de lecture. Les erreurs sont renvoyées au modèle comme données, pas levées. */
export async function executerOutil(db: Db, d: Dossier, nom: string, input: Record<string, unknown>, historique: HistoriqueFn): Promise<unknown> {
  const parRef = (r: unknown) => d.matchs.find((m) => m.ref === String(r ?? "").trim().toUpperCase());
  switch (nom) {
    case "matchs_a_venir":
      return d.matchs.map((m) => {
        const sg = d.signals.get(m.id), b = (s: string) => d.parMatch.get(m.id)?.find((o) => o.market === "1X2" && o.sel === s)?.cote ?? null;
        return { match: m.ref, affiche: m.affiche, competition: `${m.compNom}${COMPETITIONS[m.comp]?.pays ? ` (${COMPETITIONS[m.comp]!.pays})` : ""}`, coup_envoi: heure(m.kickoff),
          cotes_1xbet_1N2: [b("1"), b("N"), b("2")], proba_marche_1N2_pct: sg?.source === "marche" ? [pct(sg.direct("1X2", null, "1")), pct(sg.direct("1X2", null, "N")), pct(sg.direct("1X2", null, "2"))] : null,
          options_cotees: d.parMatch.get(m.id)?.length ?? 0 };
      });
    case "analyser_match": {
      const m = parRef(input.match); if (!m) return { erreur: "match inconnu dans ce passage" };
      const [rc, ex] = await Promise.all([loadRecit(db as never, m.id), getExtras({ id: m.id, af_fixture_id: m.afFixture, kickoff_at: m.kickoff, statut: m.statut }).catch(() => null)]);
      const sg = d.signals.get(m.id);
      return {
        match: m.ref, affiche: m.affiche, competition: m.compNom, coup_envoi: heure(m.kickoff),
        contexte: rc ? rc.etapes.map((e) => ({ etape: e.titre, faits: e.lignes })) : "pas de contexte disponible",
        absents: ex?.injuries?.length ? ex.injuries.map((a) => `${a.equipe} : ${a.joueur}${a.motif ? ` (${a.motif})` : ""}${a.type === "Questionable" ? " — incertain" : ""}`) : ex?.disponible ? "aucun absent signalé par le fournisseur" : "absents non disponibles pour ce match",
        compositions: ex?.lineups?.length ? ex.lineups.map((l) => ({ equipe: l.equipe, schema: l.schema, titulaires: l.titulaires.map((p) => p.nom) })) : "pas encore publiées",
        buts_attendus_marche: sg?.market ? [Math.round(sg.market.lh * 100) / 100, Math.round(sg.market.la * 100) / 100] : null,
        buts_attendus_modele: sg?.model ? [Math.round(sg.model.lh * 100) / 100, Math.round(sg.model.la * 100) / 100] : null,
        note: "Le contexte vient des résultats et classements en base ; le modèle BETWISE ne couvre bien que les grands championnats.",
      };
    }
    case "cotes_match": {
      const m = parRef(input.match); if (!m) return { erreur: "match inconnu dans ce passage" };
      const fam = String(input.famille ?? "tout"), sg = d.signals.get(m.id);
      return (d.parMatch.get(m.id) ?? []).filter((o) => fam === "tout" || familleOf(o.market) === fam).map((o) => {
        const p = sg ? probOfSignal(sg, o.market, o.param, o.sel) : null;
        const pm = sg?.model ? pct(probOf(sg.model.grid, o.market, o.param, o.sel)) : null;
        const niveau = categorieFromOdds(o.cote);
        return { id: o.id, pari: o.label, cote: o.cote, niveau: niveau ? CAT_LABEL[niveau] : "sous 1,10", proba_marche_pct: p === null ? null : pct(p), proba_modele_pct: pm, releve: heure(o.releveAt) };
      });
    }
    case "mon_historique":
      return historique();
    default:
      return { erreur: `outil inconnu : ${nom}` };
  }
}
