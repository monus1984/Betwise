/**
 * Un pari ne se règle à la main qu'une fois ses matchs joués (audit du 22/11, P1-4) : avant, un toucher par erreur
 * réglait un pari qui n'avait pas commencé. Durée retenue : coup d'envoi du dernier match + 2 h 15 (prolongations
 * comprises). Une sélection sans match reconnu (match saisi en texte libre) ne bloque pas : on ne connaît pas son heure.
 */
export const DUREE_MATCH_MS = 135 * 60000;

type Sel = { kickoff_at: string | null | undefined; statut?: string | null };

/** Heure à partir de laquelle le pari peut être réglé à la main, ou null si rien ne l'empêche. */
export function reglableA(selections: Sel[]): Date | null {
  const fins = selections
    .filter((s) => s.kickoff_at && s.statut !== "termine" && s.statut !== "annule")
    .map((s) => Date.parse(s.kickoff_at!) + DUREE_MATCH_MS)
    .filter(Number.isFinite);
  return fins.length ? new Date(Math.max(...fins)) : null;
}

export function reglableMaintenant(selections: Sel[], now = Date.now()): boolean {
  const a = reglableA(selections);
  return !a || a.getTime() <= now;
}
