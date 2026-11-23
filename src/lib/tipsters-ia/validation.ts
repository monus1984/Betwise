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
  /** Combinés (23/11, consensus du conseil d'IA) : 2 ou 3 sélections sur des matchs différents, cote totale de 1,50 à 3. */
  combineMin: 2, combineMax: 3, coteCombineMin: 1.5, coteCombineMax: 3,
} as const;

export type Option = { id: string; matchId: string; market: string; param: number | null; sel: string; label: string; cote: number; releveAt: string; kickoff: string };
export type Proposition = { option: string; mise: number; probabilite: number; raison: string };
export type Etat = { bankroll: number; enJeu: number; parisDuJour: number; matchsJoues: Set<string>;
  /** Sélections déjà jouées en simple (clé match|marché|paramètre|sélection), interdites dans un combiné. */
  simplesJoues?: Set<string> };
export const cleSel = (o: { matchId: string; market: string; param: number | null; sel: string }) => `${o.matchId}|${o.market}|${o.param ?? ""}|${o.sel}`;
export type Retenu = Option & { mise: number; probabilite: number; raison: string };
export type Rejet = { option: string; motif: string };
export type PropositionCombine = { options: string[]; mise: number; probabilite: number; raison: string };
export type CombineRetenu = { selections: Option[]; cote: number; mise: number; probabilite: number; raison: string };

export function arrondirMise(m: number) { return Math.round(m / GARDE_FOUS.arrondi) * GARDE_FOUS.arrondi; }

export function valider(props: Proposition[], options: Map<string, Option>, etat: Etat, now = Date.now(), combines: PropositionCombine[] = []): { retenus: Retenu[]; rejets: Rejet[]; combinesRetenus: CombineRetenu[] } {
  const retenus: Retenu[] = [], rejets: Rejet[] = [], combinesRetenus: CombineRetenu[] = [];
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
  // Combinés : chaque sélection passe les mêmes contrôles qu'un simple ; un match déjà joué en simple peut y figurer,
  // mais pas la même sélection.
  const simplesJoues = new Set([...(etat.simplesJoues ?? []), ...retenus.map(cleSel)]);
  for (const c of combines) {
    const ids = (Array.isArray(c.options) ? c.options : []).map((x) => String(x ?? "").trim());
    const nom = `combiné ${ids.join(" + ")}`, non = (motif: string) => rejets.push({ option: nom, motif });
    if (ids.length < GARDE_FOUS.combineMin || ids.length > GARDE_FOUS.combineMax) { non(`un combiné a de ${GARDE_FOUS.combineMin} à ${GARDE_FOUS.combineMax} sélections`); continue; }
    const sels = ids.map((id) => options.get(id));
    if (sels.some((o) => !o)) { non("sélection inconnue : elle n'est pas dans les cotes relevées"); continue; }
    const os = sels as Option[];
    if (new Set(os.map((o) => o.matchId)).size !== os.length) { non("deux sélections sur le même match"); continue; }
    if (os.some((o) => Date.parse(o.kickoff) - now < GARDE_FOUS.delaiMinMinutes * 60000)) { non("un des matchs est commencé ou trop proche du coup d'envoi"); continue; }
    if (os.some((o) => o.cote < GARDE_FOUS.coteMin)) { non(`sélection sous ${GARDE_FOUS.coteMin}`); continue; }
    // Une sélection déjà jouée en simple ferait perdre deux fois sur le même résultat (23/11)
    if (os.some((o) => simplesJoues.has(cleSel(o)))) { non("sélection déjà jouée en simple : elle compterait deux fois"); continue; }
    const cote = Math.round(os.reduce((x, o) => x * o.cote, 1) * 100) / 100;
    if (cote < GARDE_FOUS.coteCombineMin || cote > GARDE_FOUS.coteCombineMax) { non(`cote totale ${cote} hors de ${GARDE_FOUS.coteCombineMin} à ${GARDE_FOUS.coteCombineMax}`); continue; }
    if (jour >= GARDE_FOUS.parJour) { non(`${GARDE_FOUS.parJour} paris par jour au plus`); continue; }
    if (!(c.probabilite > 0 && c.probabilite < 1)) { non("probabilité absente ou hors de 0 à 1"); continue; }
    if (!c.raison || c.raison.trim().length < 20) { non("raison absente"); continue; }
    const disponible = etat.bankroll - enJeu;
    const mise = Math.min(arrondirMise(Number(c.mise) || 0), arrondirMise(etat.bankroll * GARDE_FOUS.miseMaxPart));
    if (mise < GARDE_FOUS.miseMin) { non("mise trop faible"); continue; }
    if (mise > disponible || enJeu + mise > etat.bankroll * GARDE_FOUS.expositionMax) { non("bankroll déjà trop engagée"); continue; }
    combinesRetenus.push({ selections: os, cote, mise, probabilite: Math.round(c.probabilite * 1000) / 1000, raison: c.raison.trim().slice(0, 1200) });
    enJeu += mise; jour++;
  }
  return { retenus, rejets, combinesRetenus };
}
