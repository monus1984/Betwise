/**
 * Issue d'une sélection d'après le score, pour la mesure des probabilités.
 * Miroir de betwise.settle_selection() (SQL), qui reste la seule référence pour régler les paris :
 * le test issue.test.ts vérifie que les deux donnent le même résultat sur 600 cas.
 */
import { jambesDe } from "../bets/combo";

export type Score = { h: number; a: number; hth: number | null; hta: number | null };
export type Issue = "gagne" | "perdu" | "rembourse" | null; // null : non calculable (score à la mi-temps absent, choix inconnu)

const gp = (ok: boolean): Issue => (ok ? "gagne" : "perdu");

export function issue(market: string, param: number | null, selection: string, s: Score): Issue {
  const sel = selection.trim().toUpperCase();
  const total = s.h + s.a, diff = s.h - s.a;

  if (market.startsWith("HT_") || market.startsWith("H2_")) {
    if (s.hth === null || s.hta === null) return null;
    const half: Score = market.startsWith("HT_") ? { h: s.hth, a: s.hta, hth: null, hta: null } : { h: s.h - s.hth, a: s.a - s.hta, hth: null, hta: null };
    return issue(market.slice(3), param, selection, half);
  }
  if (market === "HTFT") {
    if (s.hth === null || s.hta === null || !sel.includes("/")) return null;
    const [x, y] = sel.split("/");
    const r1 = issue("1X2", null, x, { h: s.hth, a: s.hta, hth: null, hta: null }), r2 = issue("1X2", null, y, { ...s, hth: null, hta: null });
    return r1 === null || r2 === null ? null : gp(r1 === "gagne" && r2 === "gagne");
  }
  if (market === "HMG") {
    if (s.hth === null || s.hta === null) return null;
    const adj = s.hth + s.hta - (total - s.hth - s.hta);
    return sel === "1" ? gp(adj > 0) : sel === "N" || sel === "X" ? gp(adj === 0) : sel === "2" ? gp(adj < 0) : null;
  }
  if (market === "WEH") {
    if (s.hth === null || s.hta === null) return null;
    const h2h = s.h - s.hth, h2a = s.a - s.hta;
    return sel === "1" ? gp(s.hth > s.hta || h2h > h2a) : sel === "2" ? gp(s.hta > s.hth || h2a > h2h) : null;
  }
  if (market === "BH") {
    if (s.hth === null || s.hta === null) return null;
    const oui = s.hth + s.hta >= 1 && total - s.hth - s.hta >= 1;
    return sel === "OUI" || sel === "YES" ? gp(oui) : sel === "NON" || sel === "NO" ? gp(!oui) : null;
  }
  if (market === "WBH") {
    if (s.hth === null || s.hta === null) return null;
    const h2h = s.h - s.hth, h2a = s.a - s.hta;
    return sel === "1" ? gp(s.hth > s.hta && h2h > h2a) : sel === "2" ? gp(s.hta > s.hth && h2a > h2h) : null;
  }
  if (market === "SBH") {
    if (s.hth === null || s.hta === null) return null;
    return sel === "1" ? gp(s.hth >= 1 && s.h - s.hth >= 1) : sel === "2" ? gp(s.hta >= 1 && s.a - s.hta >= 1) : null;
  }
  if (market === "OE1" || market === "OE2") {
    const v = market === "OE1" ? s.h : s.a;
    return sel === "PAIR" || sel === "EVEN" ? gp(v % 2 === 0) : sel === "IMPAIR" || sel === "ODD" ? gp(v % 2 === 1) : null;
  }
  if (market === "MG1" || market === "MG2") { const r = sel.match(/^(\d+)-(\d+)$/), v = market === "MG1" ? s.h : s.a; return r ? gp(v >= Number(r[1]) && v <= Number(r[2])) : null; }
  if (market === "COMBO") {
    // Toutes les conditions doivent se régler sur le score : sinon null (réglé en base sur la feuille de match)
    const js = jambesDe(selection);
    if (!js) return null;
    const rs = js.map((j) => issue(j.market, j.param, j.sel, s));
    if (rs.includes("perdu")) return "perdu"; // une condition perdue suffit, même si une autre n'est pas encore calculable
    if (rs.includes(null)) return null;
    const remb = rs.filter((r) => r === "rembourse").length;
    return remb === 0 ? "gagne" : remb === rs.length ? "rembourse" : null; // une condition remboursée parmi des gagnées : cote à recalculer, pas tranché ici
  }
  if (market === "OE") return sel === "PAIR" || sel === "EVEN" ? gp(total % 2 === 0) : sel === "IMPAIR" || sel === "ODD" ? gp(total % 2 === 1) : null;
  if (market === "MG") { const r = sel.match(/^(\d+)-(\d+)$/); return r ? gp(total >= Number(r[1]) && total <= Number(r[2])) : null; }
  if (market === "EH") {
    if (param === null) return null;
    const adj = diff + param;
    return sel === "1" ? gp(adj > 0) : sel === "N" || sel === "X" ? gp(adj === 0) : sel === "2" ? gp(adj < 0) : null;
  }
  // « Home Win to Nil — No » (26/11) : gagne si l'équipe ne gagne PAS sans encaisser
  if (market === "WTN" && /\|non$/i.test(sel)) { const t = sel.split("|")[0]; return t === "1" ? gp(!(diff > 0 && s.a === 0)) : t === "2" ? gp(!(diff < 0 && s.h === 0)) : null; }
  if (market === "WTN") return sel === "1" ? gp(diff > 0 && s.a === 0) : sel === "2" ? gp(diff < 0 && s.h === 0) : null;

  if (["DC_OU", "1X2_OU", "DC_BTTS", "1X2_BTTS", "OU_BTTS"].includes(market)) {
    if (!sel.includes("|")) return null;
    const [a, b] = selection.split("|");
    const r1 = market === "OU_BTTS" ? issue("OU", param, a, s) : issue(market.startsWith("DC") ? "DC" : "1X2", null, a, s);
    const r2 = market.endsWith("_OU") ? issue("OU", param, b, s) : issue("BTTS", null, b, s);
    if (r1 === "perdu" || r2 === "perdu") return "perdu";
    if (r1 === null || r2 === null) return null;
    if (r1 === "rembourse") return r2;
    if (r2 === "rembourse") return r1;
    return "gagne";
  }
  if (market === "TT1" || market === "TT2") {
    if (param === null) return null;
    const v = market === "TT1" ? s.h : s.a;
    if (v === param) return "rembourse";
    return sel === "PLUS" || sel === "OVER" || sel === "+" ? gp(v > param) : sel === "MOINS" || sel === "UNDER" || sel === "-" ? gp(v < param) : null;
  }
  switch (market) {
    case "1X2": return sel === "1" ? gp(diff > 0) : sel === "N" || sel === "X" ? gp(diff === 0) : sel === "2" ? gp(diff < 0) : null;
    case "DC": return sel === "1N" || sel === "1X" ? gp(diff >= 0) : sel === "12" ? gp(diff !== 0) : sel === "N2" || sel === "X2" ? gp(diff <= 0) : null;
    case "DNB": return diff === 0 ? "rembourse" : sel === "1" ? gp(diff > 0) : sel === "2" ? gp(diff < 0) : null;
    case "OU":
      if (param === null) return null;
      if (total === param) return "rembourse";
      return sel === "PLUS" || sel === "OVER" || sel === "+" ? gp(total > param) : sel === "MOINS" || sel === "UNDER" || sel === "-" ? gp(total < param) : null;
    case "BTTS": return sel === "OUI" || sel === "YES" ? gp(s.h >= 1 && s.a >= 1) : sel === "NON" || sel === "NO" ? gp(s.h === 0 || s.a === 0) : null;
    case "AH": {
      if (param === null) return null;
      const adj = sel === "1" ? diff + param : sel === "2" ? -diff + param : null;
      return adj === null ? null : adj > 0 ? "gagne" : adj < 0 ? "perdu" : "rembourse";
    }
    case "CS": return gp(sel.replace(/\s/g, "") === `${s.h}-${s.a}`);
  }
  return null;
}
