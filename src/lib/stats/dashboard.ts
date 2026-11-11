/** Chiffres du tableau de bord : calculés côté serveur à partir des paris de l'utilisateur (RLS). */
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;
type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

type Row = {
  id: string; type: "simple" | "combine"; mise: number; cote_totale: number | null; statut: string; gain_net: number | null; placed_at: string; settled_at: string | null; bookmaker: string | null;
  bet_selections: { market_code: string; cote: number; resultat: string; origin: One<{ id: string; nom: string; type: string }> }[];
};
export type Group = { cle: string; lien?: string; paris: number; gagnes: number; mises: number; net: number; reussite: number | null; rendement: number | null };
export type OriginRow = { id: string; nom: string; type: string; selections: number; gagnees: number; reussite: number; attendu: number; coteMoy: number };
export type Dashboard = {
  regles: number; gagnes: number; perdus: number; enCours: number; mises: number; net: number; reussite: number | null; rendement: number | null; coteMoy: number | null; miseMoy: number | null;
  attendu: number | null;
  courbe: { at: string; cumul: number; net: number; libelle: string }[];
  parType: Group[]; parRisque: Group[]; parBookmaker: Group[]; parMarche: Group[];
  parOrigine: OriginRow[];
  discipline: { miseApresPerte: number | null; miseApresGain: number | null; pireSerie: number; serie: string; combinesPerdus: number; combinesAUnePres: number; plusGrosseMise: number };
};

const MARKET_FR: Record<string, string> = { "1X2": "Victoire / nul", DC: "Double chance", DNB: "Remboursé si nul", OU: "Plus / moins de buts", BTTS: "Les deux marquent", AH: "Handicap", CS: "Score exact", DC_OU: "Double chance + buts", "1X2_OU": "Résultat + buts" };
const riskOf = (c: number) => (c < 1.5 ? "Prudent (cote < 1,50)" : c <= 2.2 ? "Moyen (1,50 à 2,20)" : c <= 5 ? "Risqué (2,20 à 5)" : "Très risqué (> 5)");

function group(rows: Row[], key: (b: Row) => string): Group[] {
  const m = new Map<string, Row[]>();
  for (const b of rows) m.set(key(b), [...(m.get(key(b)) ?? []), b]);
  return [...m].map(([cle, v]) => {
    const dec = v.filter((b) => b.statut === "gagne" || b.statut === "perdu");
    const mises = dec.reduce((s, b) => s + Number(b.mise), 0), net = v.reduce((s, b) => s + Number(b.gain_net ?? 0), 0), g = dec.filter((b) => b.statut === "gagne").length;
    return { cle, paris: dec.length, gagnes: g, mises, net, reussite: dec.length ? g / dec.length : null, rendement: mises ? net / mises : null };
  }).filter((g) => g.paris > 0).sort((a, b) => b.paris - a.paris);
}

export async function loadDashboard(db: Db, since: string | null): Promise<Dashboard> {
  let q = db.from("bets").select("id, type, mise, cote_totale, statut, gain_net, placed_at, settled_at, bookmaker, bet_selections(market_code, cote, resultat, origin:sources!bet_selections_origin_source_id_fkey(id, nom, type))").neq("statut", "annule").order("placed_at").limit(3000);
  if (since) q = q.gte("placed_at", since);
  const { data } = await q;
  const all = (data ?? []) as unknown as Row[];
  const settled = all.filter((b) => ["gagne", "perdu", "rembourse"].includes(b.statut));
  const dec = settled.filter((b) => b.statut !== "rembourse");
  const mises = dec.reduce((s, b) => s + Number(b.mise), 0), net = settled.reduce((s, b) => s + Number(b.gain_net ?? 0), 0), g = dec.filter((b) => b.statut === "gagne").length;
  const odds = dec.map((b) => Number(b.cote_totale)).filter((c) => c > 1);

  let cumul = 0;
  const courbe = [...settled].sort((a, b) => Date.parse(a.settled_at ?? a.placed_at) - Date.parse(b.settled_at ?? b.placed_at)).map((b) => {
    cumul += Number(b.gain_net ?? 0);
    return { at: b.settled_at ?? b.placed_at, cumul, net: Number(b.gain_net ?? 0), libelle: `${b.type === "combine" ? `Combiné ${b.bet_selections.length}` : "Simple"} · cote ${Number(b.cote_totale ?? 0).toFixed(2).replace(".", ",")}` };
  });

  const by = new Map<string, OriginRow & { imp: number; odds: number }>();
  for (const b of all) for (const s of b.bet_selections) {
    if (s.resultat !== "gagne" && s.resultat !== "perdu") continue;
    const o = one(s.origin); const id = o?.id ?? "?";
    const e = by.get(id) ?? { id, nom: o?.type === "perso" ? "Mes choix" : o?.nom ?? "Non renseignée", type: o?.type ?? "", selections: 0, gagnees: 0, reussite: 0, attendu: 0, coteMoy: 0, imp: 0, odds: 0 };
    e.selections++; if (s.resultat === "gagne") e.gagnees++; e.imp += 1 / Number(s.cote); e.odds += Number(s.cote);
    by.set(id, e);
  }
  const parOrigine = [...by.values()].map((e) => ({ id: e.id, nom: e.nom, type: e.type, selections: e.selections, gagnees: e.gagnees, reussite: e.gagnees / e.selections, attendu: e.imp / e.selections, coteMoy: e.odds / e.selections })).sort((a, b) => b.selections - a.selections);

  // Discipline
  const chrono = dec; let worst = 0, cur = 0;
  for (const b of chrono) { if (b.statut === "perdu") { cur++; worst = Math.max(worst, cur); } else cur = 0; }
  let streak = 0, st = "";
  for (let i = chrono.length - 1; i >= 0; i--) { if (!st) st = chrono[i].statut; if (chrono[i].statut !== st) break; streak++; }
  const afterLoss: number[] = [], afterWin: number[] = [];
  for (let i = 1; i < all.length; i++) {
    const prev = all.slice(0, i).reverse().find((b) => (b.statut === "gagne" || b.statut === "perdu") && Date.parse(b.settled_at ?? b.placed_at) < Date.parse(all[i].placed_at));
    if (prev) (prev.statut === "perdu" ? afterLoss : afterWin).push(Number(all[i].mise));
  }
  const avg = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : null);
  const lostCombos = all.filter((b) => b.type === "combine" && b.statut === "perdu");

  return {
    regles: settled.length, gagnes: g, perdus: dec.length - g, enCours: all.filter((b) => b.statut === "en_cours").length, mises, net,
    reussite: dec.length ? g / dec.length : null, rendement: mises ? net / mises : null,
    coteMoy: odds.length ? odds.reduce((a, b) => a + b, 0) / odds.length : null, miseMoy: dec.length ? mises / dec.length : null,
    attendu: odds.length ? odds.reduce((a, c) => a + 1 / c, 0) / odds.length : null,
    courbe,
    parType: group(settled, (b) => (b.type === "combine" ? "Combinés" : "Simples")),
    parRisque: group(settled, (b) => riskOf(Number(b.cote_totale ?? 0))),
    parBookmaker: group(settled, (b) => b.bookmaker ?? "Non renseigné"),
    parMarche: group(settled.filter((b) => b.bet_selections.length === 1), (b) => MARKET_FR[b.bet_selections[0].market_code] ?? b.bet_selections[0].market_code),
    parOrigine,
    discipline: { miseApresPerte: avg(afterLoss), miseApresGain: avg(afterWin), pireSerie: worst, serie: streak ? `${streak} ${st === "gagne" ? "gagné" : "perdu"}${streak > 1 ? "s" : ""} d’affilée` : "—", combinesPerdus: lostCombos.length, combinesAUnePres: lostCombos.filter((b) => b.bet_selections.filter((s) => s.resultat === "perdu").length === 1).length, plusGrosseMise: all.length ? Math.max(...all.map((b) => Number(b.mise))) : 0 },
  };
}
