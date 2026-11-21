/**
 * Briefing parlé de Betster (19/11) : ce qu'il dit quand on touche « Écouter Betster » sur l'accueil.
 * Uniquement des données déjà affichées (propositions, probabilités, cotes, forme, face-à-face) : aucune phrase d'avis
 * inventée. Quatre blocs au plus, pour rester sous une minute et limiter les demandes de voix.
 */
import type { Categorie } from "@/lib/coach/categories";
import type { Pourquoi } from "@/lib/matches/justification";

export type PropBrief = { matchId: string; home: string; away: string; kickoff: string; label: string; p: number; profil: Categorie; cote: number | null; bookmaker: string | null };
const PROFIL: Record<Categorie, string> = { sur: "prudent", audacieux: "équilibré", risque: "audacieux" };
const ORDRE: Categorie[] = ["sur", "audacieux", "risque"];
const TZ = "Africa/Abidjan";

export function quand(iso: string, maintenant = new Date()): string {
  const j = (d: Date) => d.toLocaleDateString("fr-CA", { timeZone: TZ });
  const d = new Date(iso);
  const h = d.toLocaleTimeString("fr-FR", { hour: "numeric", minute: "2-digit", timeZone: TZ }).replace(":", " h ").replace(" h 00", " h");
  const jour = j(d) === j(maintenant) ? "aujourd’hui" : j(d) === j(new Date(maintenant.getTime() + 86400000)) ? "demain" : d.toLocaleDateString("fr-FR", { weekday: "long", timeZone: TZ });
  return `${jour} à ${h}`;
}

export function briefing(input: { prenom: string; synthese: string; profils: Record<Categorie, PropBrief[]>; pourquoi: Map<string, Pourquoi | null | undefined>; maintenant?: Date }): string[] {
  const blocs = [`Bonjour${input.prenom ? ` ${input.prenom}` : ""} ! ${input.synthese}`.trim()];
  const vus = new Set<string>();
  for (const k of ORDRE) {
    // La meilleure proposition du profil, sur un match pas encore cité quand c'est possible
    const l = input.profils[k] ?? [];
    const x = l.find((o) => !vus.has(o.matchId)) ?? l[0];
    if (!x) continue;
    const dejaCite = vus.has(x.matchId);
    vus.add(x.matchId);
    const pct = Math.round(x.p * 100);
    const cote = x.cote ? ` Cote ${x.cote.toFixed(2).replace(".", ",")}${x.bookmaker ? ` chez ${x.bookmaker}` : ""}.` : "";
    const pq = dejaCite ? null : input.pourquoi.get(x.matchId);
    const raison = pq ? [pq.enjeu, pq.face, pq.forme].filter(Boolean).slice(0, 1).map((t) => ` ${String(t).replace(/\.$/, "")}.`).join("") : "";
    blocs.push(`Profil ${PROFIL[k]}. ${x.home} contre ${x.away}, ${quand(x.kickoff, input.maintenant)} : ${x.label}. Probabilité ${pct} %, donc ça ne passe pas environ ${100 - pct} fois sur 100.${cote}${raison}`);
  }
  if (blocs.length === 1) blocs.push("Je n’ai pas de proposition calculée pour l’instant, et je ne t’en invente pas. Les prochains matchs couverts sont affichés plus bas.");
  else blocs[blocs.length - 1] += " Le détail est juste en dessous. Pour me poser une question, touche mon portrait en bas de l’écran.";
  return blocs;
}
