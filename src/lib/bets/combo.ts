/**
 * Pari combiné sur un même match (« MyCombi », « bet builder ») : plusieurs conditions, une seule cote.
 * Enregistré sous le marché COMBO ; la sélection porte les conditions, séparées par « & » :
 *   « DC:1N & OU@2.5:Plus & CORN@8.5:Plus »  (code du marché, ligne éventuelle après « @ », choix après « : »).
 * Gagné si toutes les conditions sont gagnées, perdu dès qu'une seule est perdue.
 * Même format que betwise.settle_sel() côté base.
 */
export type Jambe = { market: string; param: number | null; sel: string };
export const MARCHE_COMBO = "COMBO";
const RE = /^([A-Z0-9_]+)(?:@(-?\d+(?:\.\d+)?))?:(.+)$/;

export function jambesDe(selection: string): Jambe[] | null {
  const parts = selection.split("&").map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const out: Jambe[] = [];
  for (const p of parts) {
    const r = p.match(RE);
    if (!r || r[1] === MARCHE_COMBO || r[1] === "LIBRE") return null;
    out.push({ market: r[1], param: r[2] === undefined ? null : Number(r[2]), sel: r[3].trim() });
  }
  return out;
}

/** Sélection d'un combiné à partir de ses conditions ; null s'il y en a moins de deux ou si le texte dépasse la place prévue. */
export function selectionCombo(jambes: Jambe[], max = 120): string | null {
  if (jambes.length < 2 || jambes.some((j) => /[&:@]/.test(j.sel) || j.market === MARCHE_COMBO || j.market === "LIBRE")) return null;
  const s = jambes.map((j) => `${j.market}${j.param === null ? "" : `@${j.param}`}:${j.sel}`).join(" & ");
  return s.length <= max ? s : null;
}
