/**
 * Le solde, compte par compte. Tout vient du journal de la bankroll : rien n'est recalculé ailleurs,
 * donc la somme des comptes est égale au solde affiché, au franc près.
 *   solde = dépôts − retraits + gains moins pertes des paris réglés − mises en jeu + recalages
 */
export type Mouvement = { type: "depot" | "retrait" | "mise" | "gain" | "ajustement"; montant: number; bet_id: string | null; bookmaker: string | null };
export type EnJeu = { mise: number; bookmaker: string | null };
export type Compte = { nom: string; solde: number; depots: number; retraits: number; resultat: number; enJeu: number; recalages: number };

export const SANS_NOM = "Non précisé";
const cle = (b: string | null) => (b ?? "").trim().toLowerCase();
const arr = (x: number) => Math.round(x * 100) / 100;

export function comptes(mouvements: Mouvement[], enJeu: EnJeu[]): { comptes: Compte[]; total: Compte } {
  const m = new Map<string, Compte>();
  const de = (b: string | null) => {
    const k = cle(b);
    if (!m.has(k)) m.set(k, { nom: (b ?? "").trim() || SANS_NOM, solde: 0, depots: 0, retraits: 0, resultat: 0, enJeu: 0, recalages: 0 });
    return m.get(k)!;
  };
  for (const t of mouvements) {
    const c = de(t.bookmaker), x = Number(t.montant);
    c.solde += x;
    if (t.bet_id) c.resultat += x;            // mise, gain et correction d'un pari
    else if (t.type === "depot") c.depots += x;
    else if (t.type === "retrait") c.retraits += -x;
    else c.recalages += x;
  }
  // Les mises des paris en cours sont déjà sorties du solde : on les sépare du résultat des paris réglés.
  for (const b of enJeu) { const c = de(b.bookmaker); c.enJeu += Number(b.mise); c.resultat += Number(b.mise); }
  const liste = [...m.values()].map((c) => ({ ...c, solde: arr(c.solde), depots: arr(c.depots), retraits: arr(c.retraits), resultat: arr(c.resultat), enJeu: arr(c.enJeu), recalages: arr(c.recalages) }))
    .sort((a, b) => b.solde - a.solde);
  const total = liste.reduce((s, c) => ({ nom: "Total", solde: arr(s.solde + c.solde), depots: arr(s.depots + c.depots), retraits: arr(s.retraits + c.retraits), resultat: arr(s.resultat + c.resultat), enJeu: arr(s.enJeu + c.enJeu), recalages: arr(s.recalages + c.recalages) }),
    { nom: "Total", solde: 0, depots: 0, retraits: 0, resultat: 0, enJeu: 0, recalages: 0 });
  return { comptes: liste, total };
}
