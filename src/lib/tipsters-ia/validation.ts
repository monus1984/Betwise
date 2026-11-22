/**
 * Contrôles du serveur sur les décisions d'un tipster IA. Le modèle choisit et justifie ; le serveur n'enregistre que
 * ce qui existe vraiment (option relevée chez 1xBet, match pas commencé) et dans des garde-fous de bankroll.
 * Les choix eux-mêmes ne sont jamais corrigés : un pari invalide est rejeté avec son motif.
 */
export const GARDE_FOUS = {
  bankrollDepart: 100_000,
  /** Mise d'un pari : au plus 10 % de la bankroll disponible, au moins 100 F, arrondie à 100 F. */
  miseMaxPart: 0.1, miseMin: 100, arrondi: 100,
  /** Argent en jeu en même temps : au plus 40 % de la bankroll. */
  expositionMax: 0.4,
  /** Paris par jour, tous passages confondus. */
  parJour: 8,
  coteMin: 1.1, coteMax: 10,
  /** Le match doit commencer dans plus de 10 minutes. */
  delaiMinMinutes: 10,
} as const;

export type Option = { id: string; matchId: string; market: string; param: number | null; sel: string; label: string; cote: number; releveAt: string; kickoff: string };
export type Proposition = { option: string; mise: number; probabilite: number; raison: string };
export type Etat = { bankroll: number; enJeu: number; parisDuJour: number; matchsJoues: Set<string> };
export type Retenu = Option & { mise: number; probabilite: number; raison: string };
export type Rejet = { option: string; motif: string };

export function arrondirMise(m: number) { return Math.round(m / GARDE_FOUS.arrondi) * GARDE_FOUS.arrondi; }

export function valider(props: Proposition[], options: Map<string, Option>, etat: Etat, now = Date.now()): { retenus: Retenu[]; rejets: Rejet[] } {
  const retenus: Retenu[] = [], rejets: Rejet[] = [];
  const matchs = new Set(etat.matchsJoues);
  let enJeu = etat.enJeu, jour = etat.parisDuJour;
  for (const p of props) {
    const o = options.get(String(p.option ?? "").trim());
    const non = (motif: string) => rejets.push({ option: String(p.option), motif });
    if (!o) { non("option inconnue : elle n'est pas dans les cotes relevées"); continue; }
    if (Date.parse(o.kickoff) - now < GARDE_FOUS.delaiMinMinutes * 60000) { non("match commencé ou trop proche du coup d'envoi"); continue; }
    if (o.cote < GARDE_FOUS.coteMin || o.cote > GARDE_FOUS.coteMax) { non(`cote ${o.cote} hors de ${GARDE_FOUS.coteMin} à ${GARDE_FOUS.coteMax}`); continue; }
    if (matchs.has(o.matchId)) { non("un pari par match au plus"); continue; }
    if (jour >= GARDE_FOUS.parJour) { non(`${GARDE_FOUS.parJour} paris par jour au plus`); continue; }
    if (!(p.probabilite > 0 && p.probabilite < 1)) { non("probabilité absente ou hors de 0 à 1"); continue; }
    if (!p.raison || p.raison.trim().length < 20) { non("raison absente"); continue; }
    const disponible = etat.bankroll - enJeu;
    const mise = Math.min(arrondirMise(Number(p.mise) || 0), arrondirMise(etat.bankroll * GARDE_FOUS.miseMaxPart));
    if (mise < GARDE_FOUS.miseMin) { non("mise trop faible"); continue; }
    if (mise > disponible || enJeu + mise > etat.bankroll * GARDE_FOUS.expositionMax) { non("bankroll déjà trop engagée"); continue; }
    retenus.push({ ...o, mise, probabilite: Math.round(p.probabilite * 1000) / 1000, raison: p.raison.trim().slice(0, 1200) });
    matchs.add(o.matchId); enJeu += mise; jour++;
  }
  return { retenus, rejets };
}
