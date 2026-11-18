import { notFound } from "next/navigation";
import { ImportFlow } from "@/app/(app)/import/import-flow";

/** Écran d'import avec des marchés et des sources FICTIFS, pour contrôler l'affichage sans compte. N'existe pas en production. */
const MARCHES = [
  ["1X2", "Résultat du match", false], ["DC", "Double chance", false], ["OU", "Plus / Moins de buts", true], ["BTTS", "Les deux équipes marquent", false],
  ["AH", "Handicap asiatique", true], ["TT1", "Buts de l'équipe à domicile", true], ["TT2", "Buts de l'équipe à l'extérieur", true],
  ["PK", "Penalty sifflé dans le match", false], ["PKB", "But sur penalty dans le match", false], ["WEH", "Gagne au moins une mi-temps", false],
  ["BUT", "Buteur (marque à tout moment)", false], ["LIBRE", "Autre pari (réglé à la main)", false],
] as const;

export default function ApercuImport() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-5">
      <p className="mb-3 rounded-lg bg-surface-2 px-3 py-1.5 text-center text-[11px] text-ink-muted">Import · planche de contrôle, données fictives</p>
      <ImportFlow markets={MARCHES.map(([code, libelle_fr, a_parametre]) => ({ code, libelle_fr, a_parametre }))}
        sources={[{ id: "00000000-0000-4000-8000-000000000001", nom: "Moi", type: "perso" }, { id: "00000000-0000-4000-8000-000000000002", nom: "Source fictive", type: "tipster" }]}
        defaultOrigin="00000000-0000-4000-8000-000000000001" initialText="ticket fictif" />
    </div>
  );
}
