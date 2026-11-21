/**
 * Enjeux de classement d'un match (lot « Coach contextuel », 21/11/2026).
 *
 * Uniquement des faits tirés du classement en base (API-Football, mis à jour chaque jour) : places, points, zones
 * annoncées par le fournisseur. Les phrases au conditionnel (« en cas de victoire… pourrait… ») ne portent que sur
 * des points : le reste de la journée peut changer la donne, et la formulation le dit. Rien n'est produit sans
 * classement, ni avant 3 matchs joués. Aucune motivation, rivalité ou « obligation de gagner » n'est inventée.
 */
import type { StandingRow } from "./standings";

export type Zone = { sens: "haut" | "bas"; label: string };

const ord = (n: number) => (n === 1 ? "1re" : `${n}e`);
const pts = (n: number) => `${n} point${n > 1 ? "s" : ""}`;
/** Phases de ligue des coupes d'Europe : pas de « titre », seulement les qualifications. */
const PHASES_DE_LIGUE = new Set(["CL", "EL", "ECL", "UWCL"]);

/** Ce que signifie la zone annoncée par le fournisseur ; null si on ne sait pas la traduire sans risque. */
export function zoneDe(brut: string | null): Zone | null {
  const z = (brut ?? "").toLowerCase().trim();
  if (!z) return null;
  if (z.includes("relegation")) {
    if (z.includes("group")) return { sens: "bas", label: "la poule de relégation" };
    if (z.includes("play") || /\(relegation\)$/.test(z)) return { sens: "bas", label: "la zone de barrage pour le maintien" };
    return { sens: "bas", label: "la zone de relégation" };
  }
  if (z.includes("1/8")) return { sens: "haut", label: "la qualification directe pour les huitièmes" };
  if (z.includes("1/16")) return { sens: "haut", label: "les barrages des huitièmes" };
  if (z.includes("championship group")) return { sens: "haut", label: "la poule pour le titre" };
  if (z.includes("conference league group")) return { sens: "haut", label: "la poule Ligue Conférence" };
  if (z.includes("champions league") || z.includes("cl women") || z === "champions league") return { sens: "haut", label: "la Ligue des champions" };
  if (z.includes("europa")) return { sens: "haut", label: "la Ligue Europa" };
  if (z.includes("conference")) return { sens: "haut", label: "la Ligue Conférence" };
  if (z.includes("caf")) return { sens: "haut", label: "une coupe africaine" };
  if (z.includes("afc") || z.includes("gulf")) return { sens: "haut", label: "une coupe asiatique" };
  if (z.includes("africa cup of nations")) return { sens: "haut", label: "la CAN" };
  if (z.includes("promotion") && z.includes("play")) return { sens: "haut", label: "les barrages de montée" };
  if (z.includes("promotion")) return { sens: "haut", label: "la montée directe" };
  if (z.includes("play")) return { sens: "haut", label: "la poule haute" };
  if (z.includes("qualif")) return { sens: "haut", label: "une qualification européenne" };
  return null;
}

/** Lignes d'enjeu pour une équipe ; table = un seul groupe, trié par rang. */
function pourEquipe(nom: string, t: StandingRow, table: StandingRow[], comp: string): string[] {
  const out: string[] = [];
  const P = t.points, r = t.rang;
  const zt = zoneDe(t.zone);
  if (!PHASES_DE_LIGUE.has(comp)) {
    if (r === 1) {
      const s = table.find((x) => x.rang === 2);
      if (s) {
        const d = P - s.points;
        out.push(d === 0 ? `${nom} est en tête, à égalité de points avec ${s.team_nom}.` : `${nom} est en tête avec ${pts(d)} d’avance sur ${s.team_nom}.`);
        if (d <= 2) out.push(`Une défaite pourrait lui coûter la première place.`);
      }
    } else {
      const l = table.find((x) => x.rang === 1);
      if (l && r <= 5 && l.points - P <= 3) {
        const apres = P + 3;
        out.push(`${nom} est à ${pts(l.points - P)} du leader ${l.team_nom}${apres > l.points ? ` : en cas de victoire, il pourrait passer en tête si ${l.team_nom} ne gagne pas` : apres === l.points ? ` : une victoire le ramènerait à hauteur du leader au nombre de points, si ${l.team_nom} ne gagne pas` : ""}.`);
      }
    }
  }
  // Place au-dessus qui change de zone (ex. dernière place qualificative), à 3 points ou moins
  const au = [...table].filter((x) => x.rang < r).sort((a, b) => b.rang - a.rang).find((x) => { const z = zoneDe(x.zone); return z?.sens === "haut" && z.label !== zt?.label; });
  if (au && (out.length === 0 || au.rang > 1) && au.points - P <= 3 && au.rang > 1) {
    const z = zoneDe(au.zone)!;
    const apres = P + 3;
    out.push(`${nom} est à ${pts(au.points - P)} de la ${ord(au.rang)} place, la dernière pour ${z.label}${apres >= au.points ? " : une victoire pourrait l’y faire entrer" : ""}.`);
  }
  // Relégation
  const bas = table.filter((x) => zoneDe(x.zone)?.sens === "bas").sort((a, b) => a.rang - b.rang)[0];
  if (bas) {
    const zb = zoneDe(bas.zone)!;
    if (zt?.sens === "bas") {
      const sauf = table.find((x) => x.rang === bas.rang - 1);
      if (sauf) out.push(`${nom} est ${ord(r)}, dans ${zb.label} ; ${sauf.team_nom}, premier non concerné, a ${pts(sauf.points - P)} de plus.`);
    } else if (r < bas.rang && P - bas.points <= 3) {
      const d = P - bas.points;
      out.push(d === 0 ? `${nom} a autant de points que ${bas.team_nom}, premier dans ${zb.label}.` : `${nom} n’a ${d === 1 ? "qu’un point" : `que ${d} points`} d’avance sur ${zb.label}.`);
    }
  }
  return out;
}

/**
 * Enjeux du match : au plus deux lignes par équipe et une sur le duel direct. Vide si le classement manque,
 * si les deux équipes ne sont pas dans le même groupe, ou avant 3 matchs joués.
 */
export function enjeux(input: { home: string; away: string; comp: string; homeRow: StandingRow | null; awayRow: StandingRow | null; table: StandingRow[] }): string[] {
  const { home, away, homeRow: h, awayRow: a, comp } = input;
  if (!h || !a || h.groupe !== a.groupe || h.joues < 3 || a.joues < 3) return [];
  const table = input.table.filter((x) => x.groupe === h.groupe).sort((x, y) => x.rang - y.rang);
  if (table.length < 4) return [];
  const lignes = [...pourEquipe(home, h, table, comp).slice(0, 2), ...pourEquipe(away, a, table, comp).slice(0, 2)];
  // Duel direct : seul ce match change l'écart entre les deux, l'effet sur leur ordre est donc exact
  const [haut, basE, nh, nb] = h.rang < a.rang ? [h, a, home, away] : [a, h, away, home];
  const d = haut.points - basE.points;
  if (d <= 3 && Math.abs(h.rang - a.rang) <= 4) {
    lignes.push(d < 3 ? `En cas de victoire, ${nb} passerait devant ${nh} au classement.` : `En cas de victoire, ${nb} reviendrait à égalité de points avec ${nh}.`);
  }
  return lignes;
}

/** « classement au 21/11 » : fraîcheur affichée à côté des enjeux. */
export function fraicheur(table: StandingRow[]): string | null {
  const max = table.reduce((x, r) => Math.max(x, Date.parse(r.updated_at)), 0);
  return max ? `classement au ${new Date(max).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Africa/Abidjan" })}` : null;
}
