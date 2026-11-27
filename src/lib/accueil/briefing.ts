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
  // Toutes les propositions retenues, profil par profil (27/11 : « j'en ai retenu 9 » mais 3 seulement étaient citées)
  for (const k of ORDRE) {
    const l = input.profils[k] ?? [];
    if (!l.length) continue;
    const lignes = l.map((x, n) => {
      const pct = Math.round(x.p * 100);
      const cote = x.cote ? `, cote ${x.cote.toFixed(2).replace(".", ",")}${x.bookmaker ? ` chez ${x.bookmaker}` : ""}` : "";
      const pq = n === 0 ? input.pourquoi.get(x.matchId) : null;
      const raison = pq ? [pq.enjeu, pq.face, pq.forme].filter(Boolean).slice(0, 1).map((t) => ` ${String(t).replace(/\.$/, "")}.`).join("") : "";
      return `${x.home} contre ${x.away}, ${quand(x.kickoff, input.maintenant)} : ${x.label}. Ça passe ${pct} fois sur 100, risque de perte ${100 - pct} %${cote}.${raison}`;
    });
    blocs.push(`Profil ${PROFIL[k]}, ${l.length} proposition${l.length > 1 ? "s" : ""}. ${lignes.join(" ")}`);
  }
  if (blocs.length === 1) blocs.push("Je n’ai pas de proposition calculée pour l’instant, et je ne t’en invente pas. Les prochains matchs couverts sont affichés plus bas.");
  else blocs[blocs.length - 1] += " Le détail est juste en dessous. Pour me poser une question, touche mon portrait en bas de l’écran.";
  return blocs;
}
