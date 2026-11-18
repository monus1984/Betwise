import { notFound } from "next/navigation";
import { BetEditor, type EditableBet } from "@/app/(app)/paris/[id]/editor";

/** Détail d'un pari FICTIF dont une ligne se règle à la main. N'existe pas en production. */
const SRC = "00000000-0000-4000-8000-000000000001";
const match = (id: string, home: string, away: string, statut: string, score: string | null) => ({ id, kickoff_at: "2026-01-10T19:45:00Z", statut, home, away, competition: "DEMO", score });
const PARI: EditableBet = {
  id: "00000000-0000-4000-8000-0000000000aa", type: "combine", mise: 1000, cote_totale: 4.57, statut: "en_cours", placed_at: "2026-01-10T12:00:00Z",
  bookmaker: "Bookmaker fictif", detail_complet: true, nb_selections: 3,
  selections: [
    { id: "00000000-0000-4000-8000-0000000000a1", market_code: "LIBRE", market_param: null, selection: "Joueur ou son remplaçant décisif (tps rég.) : Joueur Fictif", cote: 1.6, resultat: "en_attente", origin_source_id: SRC, match_libre: null, match: match("00000000-0000-4000-8000-0000000000b1", "Équipe A", "Équipe B", "termine", "2–1") },
    { id: "00000000-0000-4000-8000-0000000000a2", market_code: "LIBRE", market_param: null, selection: "Double chance buteur : Joueur Un / Joueur Deux", cote: 1.36, resultat: "gagne", origin_source_id: SRC, match_libre: null, match: match("00000000-0000-4000-8000-0000000000b2", "Équipe C", "Équipe D", "termine", "0–3") },
    { id: "00000000-0000-4000-8000-0000000000a3", market_code: "PKB", market_param: null, selection: "Oui", cote: 2.1, resultat: "en_attente", origin_source_id: SRC, match_libre: null, match: match("00000000-0000-4000-8000-0000000000b3", "Équipe E", "Équipe F", "programme", null) },
  ],
};
const MARCHES = [{ code: "LIBRE", libelle_fr: "Autre pari (réglé à la main)", a_parametre: false }, { code: "PKB", libelle_fr: "But sur penalty dans le match", a_parametre: false }, { code: "1X2", libelle_fr: "Résultat du match", a_parametre: false }];

export default function ApercuPari() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-5">
      <p className="mb-3 rounded-lg bg-surface-2 px-3 py-1.5 text-center text-[11px] text-ink-muted">Détail d’un pari · planche de contrôle, données fictives</p>
      <BetEditor bet={PARI} sources={[{ id: SRC, nom: "Moi", type: "perso" }]} markets={MARCHES} />
    </div>
  );
}
