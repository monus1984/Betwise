import { describe, expect, it } from "vitest";
import { normalizePick } from "./ticket";
import { CORPUS, type CorpusRow } from "./corpus.fixture";

/** Lecture d'un libellé du corpus, dans les conditions de l'import : équipe nommée seule = équipe à domicile d'un match retrouvé. */
const lire = ([, , m, p, h, a, t]: CorpusRow) => normalizePick(m, p, h ?? t ?? null, a ?? (t || h ? "Adversaire" : null), t);
const dire = (r: CorpusRow) => { const n = lire(r); return `${r[2]} | ${r[3]}${r[6] ? ` (${r[6]})` : ""} → ${n.ok ? "lu" : "gardé tel quel"} · ${n.market_code}${n.market_param !== null ? ` ${n.market_param}` : ""} · ${n.ok ? n.selection : "—"}`; };
const trouve = (m: string, p: string) => { const r = CORPUS.find((x) => x[2] === m && x[3] === p); if (!r) throw new Error(`absent du corpus : ${m} | ${p}`); return lire(r); };

describe("corpus des libellés réellement importés (10 au 18/11/2026)", () => {
  it("chaque libellé garde sa lecture", () => {
    expect(CORPUS.map(dire)).toMatchSnapshot();
  });

  it("206 libellés sur 230 au moins sont compris", () => {
    expect(CORPUS.length).toBe(230);
    expect(CORPUS.filter((r) => lire(r).ok).length).toBeGreaterThanOrEqual(206);
  });

  it("aucun des libellés non compris ne devient un autre marché en silence", () => {
    // Les seuls libellés gardés tels quels : anciennes lectures sans équipe, choix ambigu ou absent, paris de joueurs, paris mêlant buts et corners, penalty de chaque équipe
    const gardes = CORPUS.filter((r) => !lire(r).ok).map((r) => `${r[2]} | ${r[3]}`);
    for (const g of gardes) expect(g).toMatch(/^(Victoire \| .+ – Victoire|1ère mi-temps \| .+ – 1ère mi-temps|\+1,5 \| Sénégal \+1,5|PÉPITE DU JOUR \| |1BUT\+ 3 CORNERS \| .*|Les 2 équipes marquent un pénalty \| Oui|Nombre de tirs cadrés du joueur \(OPTA\) \| .+)$/);
  });

  it("lectures fausses corrigées le 18/11 : elles passaient pour comprises", () => {
    // Deux paris du même match sur une ligne (MyCombi) : était lu « les deux marquent » seulement
    expect(trouve("+ de 2,5 Nombre total de buts (t. rég) / Les 2 équipes marquent (t. rég)", "+ de 2,5 / Oui")).toMatchObject({ market_code: "OU_BTTS", market_param: 2.5, selection: "Plus|Oui", ok: true });
    // Penalty : était lu « les deux marquent », ou rangé à la main sous « tirs au but »
    expect(trouve("Les 2 équipes marquent un pénalty", "Oui")).toMatchObject({ ok: false });
    expect(trouve("Une des 2 équipes marque un pénalty", "But marqué sur penalty")).toMatchObject({ market_code: "PKB", selection: "Oui", ok: true });
    // Remboursé si nul : était lu comme une victoire sèche
    expect(trouve("Résultat du match (remboursé si match nul)", "Angola")).toMatchObject({ market_code: "DNB", selection: "2", ok: true });
    // « Sénégal +1,5 » : était lu comme une victoire du Sénégal
    expect(trouve("+1,5", "Sénégal +1,5")).toMatchObject({ ok: false });
    // « +2 » d'un tipster : au moins deux buts, soit plus de 1,5 (et non plus de 2)
    expect(trouve("+2", "+2")).toMatchObject({ market_code: "OU", market_param: 1.5, selection: "Plus", ok: true });
  });

  it("libellés 1xBet et codes de tipsters écrits sur une seule ligne", () => {
    expect(trouve("V2", "V2")).toMatchObject({ market_code: "1X2", selection: "2", ok: true });
    expect(trouve("12", "12")).toMatchObject({ market_code: "DC", selection: "12", ok: true });
    expect(trouve("X.2", "X.2")).toMatchObject({ market_code: "DC", selection: "N2", ok: true });
    expect(trouve("GG", "GG")).toMatchObject({ market_code: "BTTS", selection: "Oui", ok: true });
    expect(trouve("Total Individuel 2 Plus de (0.5)", "Total Individuel 2 Plus de (0.5)")).toMatchObject({ market_code: "TT2", market_param: 0.5, selection: "Plus", ok: true });
    expect(trouve("Equipe 1 ne va pas perdre et Total > (1.5) - Oui", "Equipe 1 ne va pas perdre et Total > (1.5) - Oui")).toMatchObject({ market_code: "DC_OU", market_param: 1.5, selection: "1N|Plus", ok: true });
    expect(trouve("Un Joueur va marquer un doublé - Non", "Un Joueur va marquer un doublé - Non")).toMatchObject({ market_code: "DBL", selection: "Non", ok: true });
    expect(trouve("Portugal gagne au moins 1 mi-temps", "Oui")).toMatchObject({ market_code: "WEH", selection: "2", ok: true });
    expect(trouve("Écart de buts (t. rég)", "Sénégal gagne de 2 buts ou +")).toMatchObject({ market_code: "AH", market_param: -1.5, selection: "1", ok: true });
  });
});
