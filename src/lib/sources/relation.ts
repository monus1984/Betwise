/**
 * Relation entre deux paris sur un même match (23/11, Mounir : « si Grok met les deux marquent, cela doit confirmer
 * le +1,5 but de ChatGPT »). On ne code pas les règles marché par marché : on essaie tous les scores plausibles
 * (0 à 7 buts par équipe, avec toutes les mi-temps possibles) et on regarde quand chaque pari passe.
 *  - « même »      : le même pari ;
 *  - « confirme »  : l'un entraîne l'autre (chaque fois que A passe, B passe aussi, ou l'inverse) ;
 *  - « contredit » : ils ne peuvent jamais passer ensemble ;
 *  - « neutre »    : ni l'un ni l'autre (ou pari impossible à évaluer sur le score seul : buteur, corners…).
 */
import { issue, type Score } from "../mesure/issue";

export type Pari = { market: string; param: number | null; sel: string };
export type Relation = "meme" | "confirme" | "contredit" | "neutre";

const SCORES: Score[] = (() => {
  const l: Score[] = [];
  for (let h = 0; h <= 7; h++) for (let a = 0; a <= 7; a++) for (let hth = 0; hth <= h; hth++) for (let hta = 0; hta <= a; hta++) l.push({ h, a, hth, hta });
  return l;
})();

const cache = new Map<string, (boolean | null)[]>();
const cle = (p: Pari) => `${p.market}|${p.param ?? ""}|${p.sel.trim().toUpperCase()}`;
/** Pour chaque score : true si le pari passe, false s'il perd, null si remboursé ou non évaluable. */
function profil(p: Pari): (boolean | null)[] {
  const k = cle(p);
  let v = cache.get(k);
  if (!v) {
    v = SCORES.map((s) => { const r = issue(p.market, p.param, p.sel, s); return r === "gagne" ? true : r === "perdu" ? false : null; });
    cache.set(k, v);
  }
  return v;
}

export function relation(a: Pari, b: Pari): Relation {
  if (cle(a) === cle(b)) return "meme";
  const pa = profil(a), pb = profil(b);
  let aGagne = 0, bGagne = 0, ensemble = 0, aSansB = 0, bSansA = 0, evaluables = 0;
  for (let i = 0; i < pa.length; i++) {
    if (pa[i] === null || pb[i] === null) continue;
    evaluables++;
    if (pa[i]) aGagne++;
    if (pb[i]) bGagne++;
    if (pa[i] && pb[i]) ensemble++;
    if (pa[i] && !pb[i]) aSansB++;
    if (pb[i] && !pa[i]) bSansA++;
  }
  if (!evaluables || !aGagne || !bGagne) return "neutre";
  if (!ensemble) return "contredit";
  if (!aSansB || !bSansA) return "confirme";
  return "neutre";
}
