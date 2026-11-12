import { describe, expect, it, vi } from "vitest";

// Ce que la lecture d'image doit renvoyer pour les modèles réels fournis (messages Telegram, post Instagram du 12/11/2026).
const sel = (team_only: string | null, pick_text: string, home: string | null = null, away: string | null = null) =>
  ({ home_team: home, away_team: away, team_only, competition: null, kickoff: null, market_text: "", pick_text, odds: null, score: null, outcome: "won", confidence: 0.9 });
const base = { kind: "pronos", bookmaker: null, nb_selections_declared: null, stake: null, currency: null, payout: null, status: "unknown", placed_at: null, coupon_code: null, is_collapsed: false, notes: null };
const TG = { name: "Informations foot international", platform: "telegram", evidence: "en-tête du message", published_at: null };
const FIXTURE = { tickets: [
  { ...base, ticket_type: "single", total_odds: null, source: TG, selections: [
    sel("Ghana", "1ère mi-temps"), sel("Sénégal", "1ère mi-temps"), sel("Espagne", "Victoire"), sel("RD Congo", "Victoire"), sel("Cameroun", "Victoire"),
    sel("Côte d’Ivoire", "Victoire"), sel("Angleterre", "Victoire"), sel("Guinée", "Victoire"), sel("Biélorussie", "Victoire"), sel("Malte", "Victoire"), sel("Bénin", "Victoire"), sel("Monténégro", "Victoire") ] },
  { ...base, ticket_type: "combo", total_odds: 10.16, source: { ...TG, published_at: "07:47" }, selections: [sel("Belgique", "Victoire"), sel("Russie", "Victoire"), sel("Guinée-Bissau", "Victoire")] },
  { ...base, ticket_type: "single", total_odds: null, source: { name: "NIRO SPORT", platform: "instagram", evidence: "nom du compte sous la vidéo", published_at: "il y a 15 heures" }, selections: [
    sel(null, "ITALIE OU NUL", "Italie", "France"), sel(null, "PÉPITE DU JOUR", "Angleterre", "Croatie"), sel(null, "LES 2 MARQUENT", "République Tchèque", "Espagne"), sel(null, "LES 2 MARQUENT", "Turquie", "Belgique") ] },
] };
vi.mock("../llm/provider", () => ({ getLlm: () => ({ extract: async () => ({ json: FIXTURE, tokensIn: 0, tokensOut: 0, model: "test" }) }) }));

const H = 3600000, now = Date.now();
const M = (home: string, away: string, h: number, alias: string[] = []) => ({ id: `${home}-${away}`, kickoff_at: new Date(now + h * H).toISOString(), score_home: null, score_away: null, home: { nom: home, alias: home === "Tchéquie" ? ["République tchèque"] : alias }, away: { nom: away, alias: [] }, competition: { code_externe: "X" } });
const POOL = [M("Uzbekistan", "Russie", 2), M("Ghana", "Somalie", 2), M("Guinée équatoriale", "Zimbabwe", 3), M("Madagascar", "Guinée-Bissau", 3), M("RD Congo", "Sierra Leone", 3), M("Guinée", "Érythrée", 3),
  M("Turquie", "Belgique", 4), M("Malte", "Eswatini", 4), M("Côte d'Ivoire", "Gambie", 6), M("Sénégal", "Soudan", 6), M("Bénin", "Centrafrique", 6), M("Cameroun", "Namibie", 6), M("Italie", "France", 7),
  M("Monténégro", "Lettonie", 7), M("Saint-Marin", "Biélorussie", 7), M("Angleterre", "Croatie", 7), M("Tchéquie", "Espagne", 7), M("Comores", "Congo", 24), M("Espagne", "Géorgie", 80)];
const db = { from: (t: string) => { const q: Record<string, unknown> = {}; for (const k of ["select", "eq", "in", "gte", "lte", "order", "limit"]) q[k] = () => q; q.then = (r: (v: unknown) => unknown) => Promise.resolve({ data: t === "matches" ? POOL : [], error: null }).then(r); return q; } };

describe("pronos de tipsters, de bout en bout (lecture simulée)", async () => {
  const { extractTickets } = await import("./ticket");
  const [liste, combine, niro] = await extractTickets(db as never, { images: [{ mediaType: "image/jpeg", base64: "" }] });
  const line = (t: typeof liste, i: number) => { const s = t.selections[i]; return `${s.match ? `${s.match.home}–${s.match.away}` : "?"} ${s.market_code} ${s.selection} ${s.ok ? "ok" : "KO"}`; };

  it("liste Telegram : une équipe nommée seule retrouve son match et son côté", () => {
    expect(line(liste, 2)).toBe("Tchéquie–Espagne 1X2 2 ok");            // Espagne joue à l'extérieur ce soir, pas le match dans 3 jours
    expect(line(liste, 3)).toBe("RD Congo–Sierra Leone 1X2 1 ok");        // et non Comores–Congo
    expect(line(liste, 5)).toBe("Côte d'Ivoire–Gambie 1X2 1 ok");
    expect(line(liste, 7)).toBe("Guinée–Érythrée 1X2 1 ok");              // ni Guinée équatoriale ni Guinée-Bissau
    expect(line(liste, 8)).toBe("Saint-Marin–Biélorussie 1X2 2 ok");
    expect(liste.selections.filter((s) => s.ok)).toHaveLength(12);
  });
  it("mi-temps comprise, ✅ jamais pris pour un résultat", () => {
    expect(line(liste, 0)).toBe("Ghana–Somalie HT_1X2 1 ok");
    expect(line(liste, 1)).toBe("Sénégal–Soudan HT_1X2 1 ok");
    expect([...liste.selections, ...combine.selections].every((s) => s.outcome === "unknown")).toBe(true);
  });
  it("combiné à cote totale", () => {
    expect(combine.raw.total_odds).toBe(10.16);
    expect([0, 1, 2].map((i) => line(combine, i))).toEqual(["Turquie–Belgique 1X2 2 ok", "Uzbekistan–Russie 1X2 2 ok", "Madagascar–Guinée-Bissau 1X2 2 ok"]);
  });
  it("post Instagram : libellés courts, « pépite » à compléter", () => {
    expect([0, 1, 2, 3].map((i) => line(niro, i))).toEqual(["Italie–France DC 1N ok", "Angleterre–Croatie 1X2 PÉPITE DU JOUR KO", "Tchéquie–Espagne BTTS Oui ok", "Turquie–Belgique BTTS Oui ok"]);
    expect(niro.raw.source?.name).toBe("NIRO SPORT");
  });
});
