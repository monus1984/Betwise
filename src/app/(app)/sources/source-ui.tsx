import { APP_NAME } from "@/lib/app-name";
import { NIVEAU, SEUIL, niveau, reussite, type Proof } from "@/lib/sources/proof";
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

/** Note d'une source, à droite d'une ligne : le volume prouvé, ou « Non établi » avec sa raison en dessous. */
export function ProofBadge({ proof }: { proof: Proof }) {
  const nv = niveau(proof), r = reussite(proof);
  if (nv === "non_etabli") return (
    <span className="shrink-0 text-right">
      <span className="block text-sm font-semibold text-ink-soft">Non établi</span>
      <span className="block text-[11px] text-ink-muted">{proof.prouves + proof.apresCoup === 0 ? "aucun prono" : `${proof.prouvesRegles} prouvé${proof.prouvesRegles > 1 ? "s" : ""} sur ${SEUIL.classement}`}</span>
    </span>
  );
  return (
    <span className="shrink-0 text-right">
      <span className="block text-sm font-semibold tabular-nums">{proof.prouvesGagnes} sur {proof.prouvesRegles}</span>
      <span className="block text-[11px] text-ink-muted">{Math.round((r ?? 0) * 100)} % · {NIVEAU[nv]}</span>
    </span>
  );
}

export const MARCHE_FR: Record<string, string> = {
  "1X2": "Victoire / nul", DC: "Double chance", DNB: "Remboursé si nul", OU: "Plus / moins de buts", BTTS: "Les deux marquent", AH: "Handicap", EH: "Handicap européen",
  CS: "Score exact", DC_OU: "Double chance + buts", "1X2_OU": "Résultat + buts", DC_BTTS: "Double chance + les deux marquent", "1X2_BTTS": "Résultat + les deux marquent", OU_BTTS: "Buts + les deux marquent",
  TT1: "Buts équipe 1", TT2: "Buts équipe 2", CORN: "Corners", CARD: "Cartons", SOT: "Tirs cadrés", SHOT: "Tirs", OE: "Pair / impair", MG: "Tranche de buts", WTN: "Gagne sans encaisser",
};
