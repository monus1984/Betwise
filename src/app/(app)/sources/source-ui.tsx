import { APP_NAME } from "@/lib/app-name";
import { NIVEAU, niveau, reussite, type Proof } from "@/lib/sources/proof";
export function labelType(t: string) {
  return ({
    perso: "Mes propres choix",
    tipster: "Pronostiqueur",
    page_facebook: "Page Facebook",
    compte_instagram: "Compte Instagram",
    canal_telegram: "Canal Telegram",
    site: "Site de prédictions",
    modele_betwise: `Modèle statistique ${APP_NAME}`,
  } as Record<string, string>)[t] ?? t;
}

/** Note d'une source, à droite d'une ligne : justes sur réglés dès le premier résultat, sinon une invitation. */
export function ProofBadge({ proof }: { proof: Proof }) {
  const nv = niveau(proof), r = reussite(proof);
  if (nv === "non_etabli") return (
    <span className="shrink-0 text-right">
      <span className="block text-sm font-semibold text-brand">{proof.prouves ? "En attente" : "À suivre"}</span>
      <span className="block text-[11px] text-ink-muted">{proof.prouves ? `${proof.prouves} prono${proof.prouves > 1 ? "s" : ""} en cours` : "ajoute ses pronos"}</span>
    </span>
  );
  return (
    <span className="shrink-0 text-right">
      <span className="block text-sm font-semibold tabular-nums">{proof.prouvesGagnes} sur {proof.prouvesRegles}</span>
      <span className="block text-[11px] text-ink-muted">{Math.round((r ?? 0) * 100)} % · {NIVEAU[nv]}</span>
    </span>
  );
}

export { MARCHE_FR } from "@/lib/markets-fr";
