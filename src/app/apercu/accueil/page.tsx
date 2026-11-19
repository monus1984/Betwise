import { notFound } from "next/navigation";
import { BandeauBetster, CarteMatchUI, Demain, ImportCarte, RaccourcisCoach, TipstersDuJour } from "@/components/accueil";
import { ProfilsDuJour } from "@/components/profils-du-jour";
import { BoutonMasque, Montant } from "@/components/montant";
import { TabBar } from "@/components/tab-bar";
import type { CarteMatch, Proposition } from "@/lib/accueil/load";
import type { Categorie } from "@/lib/coach/categories";
import { BetsterAnime } from "@/components/betster-anime";

/** Accueil Prédictions avec des DONNÉES FICTIVES, pour contrôler le rendu sans compte. N'existe pas en production. */
const H = (h: number) => new Date(Date.now() + h * 3600000).toISOString();
const P = (home: string, away: string, h: number, marche: string, label: string, p: number, profil: Categorie, c: number | null, bk = true): Proposition => ({
  matchId: home, home, away, kickoff: H(h), comp: "PL", market: "1X2", param: null, sel: label, marche, label, p, profil,
  cote: c ? { cote: c, ou: bk ? "Cote 1xBet" : "Cote médiane", age: "il y a 2 h", frais: true } : null, book: c && bk ? { cote: c, bookmaker: "1xBet" } : null, refCote: c, couverture: "marche_modele",
});
const PROFILS: Record<Categorie, Proposition[]> = {
  sur: [P("Bayern Munich", "Cologne", 4, "Résultat", "Bayern Munich gagne", 0.86, "sur", 1.17), P("Real Madrid", "Séville", 6, "Double chance", "Real Madrid ou nul", 0.88, "sur", 1.13)],
  audacieux: [P("Arsenal", "Brentford", 3, "Résultat", "Arsenal gagne", 0.68, "audacieux", 1.52), P("Inter", "Lazio", 5, "Autre marché : plus / moins de buts", "Plus de 1,5 buts", 0.77, "audacieux", 1.28, false), P("PSG", "Lens", 7, "Double chance", "PSG ou nul", 0.81, "audacieux", 1.22)],
  risque: [P("Lyon", "Marseille", 8, "Autre marché : les deux marquent", "Les deux équipes marquent", 0.6, "risque", 1.7)],
};
const carte = (o: Partial<CarteMatch>): CarteMatch => ({
  id: "x", comp: "BL1", kickoff: H(4), statut: "programme", minute: null, home: "Bayern Munich", away: "1. FC Cologne", score: null, couverture: "marche_modele",
  probs: { p1: 0.86, pN: 0.09, p2: 0.05 }, choix: { marche: "Résultat", label: "Bayern Munich gagne", p: 0.86, market: "1X2", param: null, sel: "1", cote: { cote: 1.17, ou: "Cote 1xBet", age: "il y a 2 h", frais: true }, book: null, refCote: 1.17 },
  verdict: null, tonPari: false, propositions: [], ...o,
});
const CARTES: CarteMatch[] = [
  carte({ id: "a", comp: "PD", home: "Real Madrid", away: "Séville", statut: "en_cours", minute: 67, score: [1, 0], tonPari: true }),
  carte({ id: "b", home: "Athletic Club", away: "RCD Espanyol de Barcelona", comp: "PD", probs: { p1: 0.55, pN: 0.27, p2: 0.18 }, pourquoi: { forme: "Forme sur les 5 derniers : Athletic Club 3V 1N 1D, RCD Espanyol de Barcelona 1V 2N 2D", face: "Face-à-face, 4 derniers : 2 victoires Athletic Club, 1 victoire RCD Espanyol de Barcelona, 1 nul", buts: null }, propositions: [
    { ...PROFILS.sur[1], label: "Athletic ou nul", marche: "Double chance", p: 0.82, profil: "sur" },
    { ...PROFILS.audacieux[1], label: "Moins de 3,5 buts", p: 0.74, profil: "audacieux" },
    { ...PROFILS.risque[0], label: "Athletic Club gagne", marche: "Résultat", p: 0.55, profil: "risque" },
  ] }),
  carte({ id: "c", comp: "CIV1", home: "Mouna", away: "US Tchologo", couverture: "aucune", probs: null, choix: null }),
];

export default async function ApercuAccueil({ searchParams }: { searchParams: Promise<{ masque?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  await searchParams;
  return (
    <main className="mx-auto max-w-xl px-4 pb-28 pt-4">
      <p className="mb-3 rounded-lg bg-draw-soft p-2 text-[11px] text-draw-ink">Aperçu — données fictives.</p>
      <div id="etats-betster" className="mb-4 flex justify-around rounded-xl bg-surface p-3">{(["repos", "pense", "parle"] as const).map((e) => <span key={e} className="flex flex-col items-center gap-2 text-[11px] text-ink-muted"><BetsterAnime etat={e} taille={56} />{e}</span>)}</div>
      <BandeauBetster prenom="Mounir" expression="positive" maj="09:14" synthese="Aujourd’hui, j’ai analysé 9 matchs à venir et retenu 6 propositions. Demain, 12 matchs déjà analysés." />
      <ProfilsDuJour profils={PROFILS} titre="Les meilleures options du jour" />
      <section className="mt-6 flex flex-col gap-2.5"><h2 className="text-[17px] font-bold">Matchs du jour</h2>{CARTES.map((c) => <CarteMatchUI key={c.id} c={c} />)}</section>
      <Demain titre="Demain" total={12} matchs={[{ matchId: "d", home: "ES Troyes AC", away: "Le Havre AC", kickoff: H(28), comp: "FL1", propositions: [{ ...PROFILS.sur[0], label: "Troyes ou nul", marche: "Double chance", p: 0.84 }, { ...PROFILS.audacieux[1], label: "Moins de 2,5 buts", p: 0.66, profil: "risque" }] }]} />
      <RaccourcisCoach nouveau={false} solde={<Montant texte="42 350 F" />} sept={<Montant texte="+3 200 F" />} budget={<Montant texte="6 000 F misés sur 10 000 F" />} paris="2 paris en cours · 1 à confirmer" vigilance={{ titre: "3 combinés de plus de 5 matchs cette semaine, aucun n’est passé.", href: "#" }} masque={<BoutonMasque />} />
      <div className="mt-3.5"><ImportCarte /></div>
      <TipstersDuJour t={[{ qui: "Alfred", match: "Arsenal – Brentford", selection: "Arsenal gagne", marche: "Résultat", p: 0.68, publieAvant: true, tone: "good", aussiBetwise: true }]} />
      <TabBar />
    </main>
  );
}
