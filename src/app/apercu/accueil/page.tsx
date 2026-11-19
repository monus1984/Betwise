import { notFound } from "next/navigation";
import { AvisBetster, Bienvenue, CarteMatchUI, ImportCarte, JourCreux, TipstersDuJour } from "@/components/accueil";
import { BoutonMasque, Montant } from "@/components/montant";
import { TabBar } from "@/components/tab-bar";
import type { Avis, CarteMatch } from "@/lib/accueil/load";

/** Blocs du nouvel accueil avec des DONNÉES FICTIVES, pour contrôler le rendu sans compte. N'existe pas en production. */
const H = (h: number) => new Date(Date.now() + h * 3600000).toISOString();
const base = (o: Partial<CarteMatch>): CarteMatch => ({
  id: "x", comp: "PL", kickoff: H(3), statut: "programme", minute: null, home: "Arsenal", away: "Brentford", score: null, couverture: "marche_modele",
  probs: { p1: 0.68, pN: 0.19, p2: 0.13 },
  choix: { marche: "Résultat", label: "Arsenal gagne", p: 0.68, market: "1X2", param: null, sel: "1", cote: { cote: 1.52, ou: "Cote 1xBet", age: "il y a 2 h", frais: true }, book: { cote: 1.52, bookmaker: "1xBet" }, refCote: 1.47 },
  verdict: null, tonPari: false, ...o,
});
const AVIS: Avis = { ...base({}), categorie: "audacieux", expression: "positive", perdSur100: 32 };
const CARTES: CarteMatch[] = [
  base({ id: "a", comp: "PD", home: "Real Madrid", away: "Séville", statut: "en_cours", minute: 67, score: [1, 0], tonPari: true, probs: { p1: 0.71, pN: 0.17, p2: 0.12 }, choix: { ...base({}).choix!, label: "Real Madrid gagne", p: 0.71 } }),
  base({ id: "b", comp: "SA", home: "Inter", away: "Lazio", probs: { p1: 0.55, pN: 0.25, p2: 0.2 }, choix: { marche: "Autre marché : plus / moins de buts", label: "Plus de 2,5 buts", p: 0.58, market: "OU", param: 2.5, sel: "Plus", cote: { cote: 1.66, ou: "Cote médiane", age: "il y a 5 h", frais: true }, book: null, refCote: 1.66 } }),
  base({ id: "c", comp: "CL", home: "PSG", away: "Bayern", couverture: "marche", probs: { p1: 0.39, pN: 0.24, p2: 0.37 }, choix: { marche: "Autre marché : les deux marquent", label: "Les deux marquent", p: 0.67, market: "BTTS", param: null, sel: "Oui", cote: { cote: 1.44, ou: "Cote 1xBet", age: "il y a 1 h", frais: true }, book: null, refCote: 1.44 } }),
  base({ id: "d", comp: "PL", home: "Chelsea", away: "Newcastle", statut: "termine", score: [2, 0], verdict: "passe", choix: { ...base({}).choix!, marche: "Double chance", label: "Chelsea ou nul", p: 0.73 } }),
  base({ id: "e", comp: "CIV1", home: "ASEC Mimosas", away: "Africa Sports", couverture: "aucune", probs: null, choix: null }),
];

export default function ApercuAccueil() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-xl px-4 pb-28 pt-4">
      <p className="mb-3 rounded-lg bg-draw-soft p-2 text-[11px] text-draw-ink">Aperçu — données fictives.</p>
      <AvisBetster a={AVIS} />
      <section className="mt-6 flex flex-col gap-2.5">{CARTES.map((c) => <CarteMatchUI key={c.id} c={c} />)}</section>
      <section className="tile mt-6 flex flex-col gap-3 p-3.5">
        <div className="flex items-center justify-between"><h2 className="text-[17px] font-bold">Mon Coach</h2><BoutonMasque /></div>
        <Montant texte="42 350 F" className="block text-[28px] font-extrabold" />
      </section>
      <div className="mt-3.5"><ImportCarte /></div>
      <TipstersDuJour t={[
        { qui: "Alfred", match: "Arsenal – Brentford", selection: "Arsenal gagne", marche: "Résultat", p: 0.68, publieAvant: true, tone: "good", aussiBetwise: true },
        { qui: "Info foot international", match: "Chelsea – Newcastle", selection: "Chelsea −1,5", marche: "Autre marché : handicap", p: 0.24, publieAvant: null, tone: "bad", aussiBetwise: false },
      ]} />
      <h2 className="mt-8 text-sm font-bold">Jour creux</h2>
      <div className="mt-2"><JourCreux repli={[{ matchId: "p", match: "PSG – Bayern", kickoff: H(80), selection: "Les deux marquent", p: 0.67, cote: 1.44, estimation: false }]} /></div>
      <h2 className="mt-8 text-sm font-bold">Nouvel abonné</h2>
      <Bienvenue />
      <TabBar />
    </main>
  );
}
