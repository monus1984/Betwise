import { describe, expect, it } from "vitest";
import { libelleBrut, normalizePick, parseFrDate } from "./ticket";
import { matchSource } from "./source-match";

const CP = ["Crystal Palace", "Liverpool"] as const;
const MU = ["Manchester United", "Aston Villa"] as const;

describe("normalizePick — Betclic", () => {
  it("résultat du match avec le nom de l'équipe", () => {
    expect(normalizePick("Résultat du match (t. rég)", "Liverpool", ...CP)).toMatchObject({ market_code: "1X2", selection: "2", ok: true });
    expect(normalizePick("Résultat du match (t. rég)", "Chelsea", "Sunderland", "Chelsea")).toMatchObject({ market_code: "1X2", selection: "2", ok: true });
    expect(normalizePick("Résultat du match (t. rég)", "Nul", "Naples", "Lazio")).toMatchObject({ market_code: "1X2", selection: "N", ok: true });
  });
  it("double chance & nombre de buts", () => {
    expect(normalizePick("Double chance & nombre de buts", "Liverpool / Nul & + de 1,5", ...CP)).toMatchObject({ market_code: "DC_OU", market_param: 1.5, selection: "N2|Plus", ok: true });
    expect(normalizePick("Double chance & nombre de buts", "Manchester Utd / Aston Villa & + de 1,5", ...MU)).toMatchObject({ market_code: "DC_OU", selection: "12|Plus", ok: true });
    expect(normalizePick("Double chance & nombre de buts", "Betis / Nul & + de 1,5", "Elche", "Betis")).toMatchObject({ selection: "N2|Plus" });
  });
  it("double chance avec des noms qui contiennent « ou »", () => {
    expect(normalizePick("Double chance", "Cameroun ou Namibie", "Cameroun", "Namibie")).toMatchObject({ market_code: "DC", selection: "12", ok: true });
    expect(normalizePick("Double chance", "Toulouse ou Nul", "Toulouse", "Lens")).toMatchObject({ selection: "1N", ok: true });
    expect(normalizePick("Double chance", "Nul ou Burkina Faso", "Mauritanie", "Burkina Faso")).toMatchObject({ selection: "N2", ok: true });
    expect(normalizePick("Double chance", "1X", "Cameroun", "Namibie")).toMatchObject({ selection: "1N", ok: true });
    expect(normalizePick("Double chance & nombre de buts", "Cameroun / Nul & + de 1,5", "Cameroun", "Namibie")).toMatchObject({ market_code: "DC_OU", selection: "1N|Plus", ok: true });
  });
  it("nombre total de buts", () => {
    expect(normalizePick("Nombre total de buts (t. rég)", "+ de 1,5", "Brighton", "Brentford")).toMatchObject({ market_code: "OU", market_param: 1.5, selection: "Plus", ok: true });
    expect(normalizePick("Plus/Moins 2.5", "Moins de 2.5", "A", "B")).toMatchObject({ market_code: "OU", market_param: 2.5, selection: "Moins" });
  });
  it("signale ce qu'il ne reconnaît pas", () => {
    expect(normalizePick("Résultat du match", "Inconnu FC", ...CP).ok).toBe(false);
  });
});

describe("normalizePick — pronos de tipsters", () => {
  it("équipe nommée seule", () => {
    expect(normalizePick("", "Victoire", "RD Congo", "Sierra Leone", "RD Congo")).toMatchObject({ market_code: "1X2", selection: "1", ok: true });
    expect(normalizePick("", "Victoire", "Turquie", "Belgique", "Belgique")).toMatchObject({ market_code: "1X2", selection: "2", ok: true });
  });
  it("libellés courts des posts", () => {
    expect(normalizePick("", "ITALIE OU NUL", "Italie", "France")).toMatchObject({ market_code: "DC", selection: "1N", ok: true });
    expect(normalizePick("", "LES 2 MARQUENT", "Tchéquie", "Espagne")).toMatchObject({ market_code: "BTTS", selection: "Oui", ok: true });
  });
  it("✅ = oui pour l'option, ❌ = non", () => {
    expect(normalizePick("", "✅", "Tchéquie", "Espagne", "Espagne")).toMatchObject({ market_code: "1X2", selection: "2", ok: true });
    expect(normalizePick("", "Espagne ✅", "Tchéquie", "Espagne")).toMatchObject({ market_code: "1X2", selection: "2", ok: true });
    expect(normalizePick("", "Victoire ✅", "RD Congo", "Sierra Leone", "RD Congo")).toMatchObject({ selection: "1", ok: true });
    expect(normalizePick("", "BTTS ✅", "Italie", "France")).toMatchObject({ market_code: "BTTS", selection: "Oui", ok: true });
    expect(normalizePick("", "BTTS ❌", "Italie", "France")).toMatchObject({ market_code: "BTTS", selection: "Non", ok: true });
    expect(normalizePick("", "+2,5 buts ✅", "Italie", "France")).toMatchObject({ market_code: "OU", market_param: 2.5, selection: "Plus", ok: true });
    expect(normalizePick("", "Italie ou nul ✅", "Italie", "France")).toMatchObject({ market_code: "DC", selection: "1N", ok: true });
  });
  it("mi-temps et autres marchés", () => {
    expect(normalizePick("", "1ère mi-temps ✅", "Ghana", "Somalie", "Ghana")).toMatchObject({ market_code: "HT_1X2", selection: "1", ok: true });
    expect(normalizePick("Résultat mi-temps", "Nul", "Ghana", "Somalie")).toMatchObject({ market_code: "HT_1X2", selection: "N", ok: true });
    expect(normalizePick("", "+0,5 but en 1ère mi-temps", "Ghana", "Somalie")).toMatchObject({ market_code: "HT_OU", market_param: 0.5, selection: "Plus", ok: true });
    expect(normalizePick("2e mi-temps - Résultat", "Somalie", "Ghana", "Somalie")).toMatchObject({ market_code: "H2_1X2", selection: "2", ok: true });
    expect(normalizePick("Mi-temps / Fin de match", "Nul / Ghana", "Ghana", "Somalie")).toMatchObject({ market_code: "HTFT", selection: "N/1", ok: true });
    expect(normalizePick("Mi-temps/Fin de match", "1/2", "Ghana", "Somalie")).toMatchObject({ market_code: "HTFT", selection: "1/2", ok: true });
    expect(normalizePick("Total de buts pair/impair", "Impair", "A", "B")).toMatchObject({ market_code: "OE", selection: "Impair", ok: true });
    expect(normalizePick("Multi-buts", "2-4 buts", "A", "B")).toMatchObject({ market_code: "MG", selection: "2-4", ok: true });
    expect(normalizePick("", "Ghana gagne sans encaisser", "Ghana", "Somalie")).toMatchObject({ market_code: "WTN", selection: "1", ok: true });
    expect(normalizePick("Handicap européen", "Somalie (+1)", "Ghana", "Somalie")).toMatchObject({ market_code: "EH", market_param: -1, selection: "2", ok: true });
    // les marchés existants ne sont pas détournés
    expect(normalizePick("Nombre total de buts (t. rég)", "+ de 1,5", "Brighton", "Brentford")).toMatchObject({ market_code: "OU", market_param: 1.5 });
    expect(normalizePick("Double chance & nombre de buts", "Liverpool / Nul & + de 1,5", "Crystal Palace", "Liverpool")).toMatchObject({ market_code: "DC_OU" });
  });
  it("corners, cartons, tirs, buteurs, qualification", () => {
    const G = ["Ghana", "Somalie"] as const;
    expect(normalizePick("Nombre total de corners", "+ de 9,5", ...G)).toMatchObject({ market_code: "CORN", market_param: 9.5, selection: "Plus", ok: true });
    expect(normalizePick("Corners Ghana", "Plus de 5,5", ...G)).toMatchObject({ market_code: "CORN1", market_param: 5.5, selection: "Plus", ok: true });
    expect(normalizePick("Équipe avec le plus de corners", "Somalie", "Ghana", "Somalie", "Somalie")).toMatchObject({ market_code: "CORN_1X2", selection: "2", ok: true });
    expect(normalizePick("Total cartons", "Moins de 4,5", ...G)).toMatchObject({ market_code: "CARD", market_param: 4.5, selection: "Moins", ok: true });
    expect(normalizePick("Carton rouge dans le match", "Oui", ...G)).toMatchObject({ market_code: "RED", selection: "Oui", ok: true });
    expect(normalizePick("Tirs cadrés", "+7,5", ...G)).toMatchObject({ market_code: "SOT", market_param: 7.5, selection: "Plus", ok: true });
    expect(normalizePick("Buteur", "Jordan Ayew ✅", ...G)).toMatchObject({ market_code: "BUT", selection: "Jordan Ayew", ok: true });
    expect(normalizePick("Premier buteur", "Ayew", ...G)).toMatchObject({ market_code: "BUT1", selection: "Ayew", ok: true });
    expect(normalizePick("Qualification", "Ghana", ...G)).toMatchObject({ market_code: "QUALIF", selection: "1", ok: true });
    expect(normalizePick("Y aura-t-il prolongation ?", "Non", ...G)).toMatchObject({ market_code: "ET", selection: "Non", ok: true });
    expect(normalizePick("Mi-temps - Score exact", "1-0", ...G)).toMatchObject({ market_code: "HT_CS", selection: "1-0", ok: true });
    // un total de buts ne devient pas un pari sur les tirs
    expect(normalizePick("Nombre total de buts (t. rég)", "+ de 1,5", ...G)).toMatchObject({ market_code: "OU" });
    expect(normalizePick("", "Les 2 marquent", ...G)).toMatchObject({ market_code: "BTTS" });
  });
  it("dit clairement ce qui n'est pas suivi ou pas visible", () => {
    expect(normalizePick("", "PÉPITE DU JOUR", "Angleterre", "Croatie").ok).toBe(false);
    expect(normalizePick("", "", "Côte d'Ivoire", "Gambie")).toMatchObject({ ok: false, reason: expect.stringContaining("oral") });
  });
});

describe("parseFrDate", () => {
  it("lit l'horodatage Betclic", () => {
    expect(parseFrDate("08/11/2026 13:38")).toBe("2026-11-08T13:38:00.000Z");
    expect(parseFrDate(null)).toBeNull();
  });
});

describe("matchSource", () => {
  const src = [{ id: "a", nom: "Groupe Betclic CI", type: "page_facebook" }, { id: "b", nom: "Pronos Élite 225", type: "canal_telegram" }, { id: "m", nom: "Moi", type: "perso" }];
  it("retrouve une source malgré la casse, les accents et les emojis", () => {
    expect(matchSource("GROUPE BETCLIC CI 🇨🇮", src)?.id).toBe("a");
    expect(matchSource("Pronos Elite 225 ✅", src)?.id).toBe("b");
    expect(matchSource("Elite 225 Pronos officiel", src)?.id).toBe("b");
  });
  it("ne force pas une correspondance douteuse", () => {
    expect(matchSource("Betclic", src)).toBeNull();
    expect(matchSource("Moi", src)).toBeNull();
    expect(matchSource(null, src)).toBeNull();
  });
  it("statistique d'un joueur : jamais lue comme un total du match", () => {
    for (const [m, pk] of [["Tirs cadrés du joueur", "Kylian Mbappé - Plus de 1,5"], ["Tirs cadrés", "Plus de 1,5"], ["Nombre de tirs cadrés", "+ de 0,5"]] as const) {
      const r = normalizePick(m, pk, "Italie", "France");
      expect(r.ok).toBe(false); expect(r.reason).toMatch(/joueur/);
    }
    expect(normalizePick("Total tirs cadrés", "Plus de 8,5", "Italie", "France")).toMatchObject({ market_code: "SOT", market_param: 8.5, selection: "Plus", ok: true });
    expect(normalizePick("Tirs cadrés Italie", "Plus de 3,5", "Italie", "France")).toMatchObject({ market_code: "SOT1", ok: true });
  });
  it("tickets Betclic du 12/11 : total d'une équipe, écart de buts, marché inconnu", () => {
    expect(normalizePick("Total de buts (t. rég) - Sierra Leone", "- de 1,5", "RD Congo", "Sierra Leone")).toMatchObject({ market_code: "TT2", market_param: 1.5, selection: "Moins", ok: true });
    expect(normalizePick("Total de buts (t. rég) - Albanie", "- de 2,5", "Albanie", "Finlande")).toMatchObject({ market_code: "TT1", market_param: 2.5, selection: "Moins", ok: true });
    expect(normalizePick("Écart de buts (t. rég)", "Madagascar ne perd pas ou perd de 1 but exactement", "Madagascar", "Guinée-Bissau")).toMatchObject({ market_code: "AH", market_param: 1.5, selection: "1", ok: true });
    expect(normalizePick("Écart de buts (t. rég)", "Espagne gagne de 2 buts ou plus", "Tchéquie", "Espagne")).toMatchObject({ market_code: "AH", market_param: -1.5, selection: "2", ok: true });
    expect(normalizePick("Nombre total de buts (t. rég)", "+ de 1,5", "Turquie", "Belgique")).toMatchObject({ market_code: "OU", market_param: 1.5, selection: "Plus", ok: true });
    expect(normalizePick("Résultat du match (t. rég)", "RD Congo", "RD Congo", "Sierra Leone")).toMatchObject({ market_code: "1X2", selection: "1", ok: true });
    expect(normalizePick("Double chance (t. rég)", "Cameroun ou Namibie", "Cameroun", "Namibie")).toMatchObject({ market_code: "DC", selection: "12", ok: true });
    expect(normalizePick("Marché exotique", "Madagascar marque dans les deux périodes du match", "Madagascar", "Guinée-Bissau").ok).toBe(false);
  });
});

describe("handicap 1xBet", () => {
  const n = (m: string, p: string) => normalizePick(m, p, "République centrafricaine", "Benin");
  it("« Handicap 2 (-1) » = handicap asiatique sur l'équipe 2, où qu'il soit écrit", () => {
    for (const [m, p] of [["", "Handicap 2 (-1)"], ["Handicap", "2 (-1)"], ["Handicap 2", "-1"], ["Handicap", "Handicap 2 (-1)"]] as const)
      expect(n(m, p)).toMatchObject({ market_code: "AH", market_param: -1, selection: "2", ok: true });
    expect(n("", "Handicap 2 (-1.5)")).toMatchObject({ market_code: "AH", market_param: -1.5, selection: "2" });
    expect(n("", "Handicap 1 (+1,5)")).toMatchObject({ market_code: "AH", market_param: 1.5, selection: "1" });
  });
  it("le handicap européen reste à part", () => {
    expect(n("Handicap européen", "Bénin (-1)").market_code).toBe("EH");
  });
});

describe("libellés 1xBet du ticket du 17/11", () => {
  const cas: [string, string, object][] = [
    ["", "Les deux équipes vont marquer - Oui", { market_code: "BTTS", selection: "Oui" }],
    ["Les deux équipes vont marquer", "Non", { market_code: "BTTS", selection: "Non" }],
    ["", "Total Plus de (1.5)", { market_code: "OU", market_param: 1.5, selection: "Plus" }],
    ["Total", "Moins de (2.5)", { market_code: "OU", market_param: 2.5, selection: "Moins" }],
    ["", "Total Individuel 2 Plus de (0.5)", { market_code: "TT2", market_param: 0.5, selection: "Plus" }],
    ["Total Individuel 1", "Moins de (1.5)", { market_code: "TT1", market_param: 1.5, selection: "Moins" }],
    ["", "1ère mi-temps Total Plus de (0.5)", { market_code: "HT_OU", market_param: 0.5, selection: "Plus" }],
    ["", "Handicap 2 (-1.5)", { market_code: "AH", market_param: -1.5, selection: "2" }],
    ["", "Handicap 2 (0)", { market_code: "AH", market_param: 0, selection: "2" }],
    ["", "V2", { market_code: "1X2", selection: "2" }],
    ["", "12", { market_code: "DC", selection: "12" }],
  ];
  it.each(cas)("%s | %s", (m, p, attendu) => {
    expect(normalizePick(m, p, "Rwanda", "Mali")).toMatchObject({ ...attendu, ok: true });
  });
});

describe("marchés ajoutés le 18/11 : penalty, mi-temps, paris composés", () => {
  const n = (m: string, p: string, t?: string) => normalizePick(m, p, "Galles", "Portugal", t);
  it("penalty dans le match", () => {
    expect(n("Y aura-t-il un penalty ?", "Oui")).toMatchObject({ market_code: "PK", selection: "Oui", ok: true });
    expect(n("", "Penalty accordé - Non")).toMatchObject({ market_code: "PK", selection: "Non", ok: true });
    expect(n("Penalty marqué dans le match", "Non")).toMatchObject({ market_code: "PKB", selection: "Non", ok: true });
    expect(n("Portugal marque un penalty", "Oui")).toMatchObject({ ok: false });
    expect(n("Penalty manqué", "Oui")).toMatchObject({ ok: false });
    // La séance de tirs au but reste un autre marché
    expect(n("Tirs au but", "Oui")).toMatchObject({ market_code: "PEN", selection: "Oui", ok: true });
  });
  it("les deux équipes marquent ne se confond pas avec un penalty", () => {
    expect(n("Les 2 équipes marquent (t. rég)", "Oui")).toMatchObject({ market_code: "BTTS", selection: "Oui", ok: true });
    expect(n("Les 2 équipes marquent un pénalty", "Oui").market_code).not.toBe("BTTS");
  });
  it("buts par mi-temps", () => {
    expect(n("", "1ère mi-temps Total Plus de (0.5)")).toMatchObject({ market_code: "HT_OU", market_param: 0.5, selection: "Plus", ok: true });
    expect(n("", "2ème mi-temps Total Moins de (1.5)")).toMatchObject({ market_code: "H2_OU", market_param: 1.5, selection: "Moins", ok: true });
    expect(n("", "1ère mi-temps Total Individuel 2 Plus de (0.5)")).toMatchObject({ market_code: "HT_TT2", market_param: 0.5, selection: "Plus", ok: true });
    expect(n("", "Les deux équipes vont marquer en 2ème mi-temps - Oui")).toMatchObject({ market_code: "H2_BTTS", selection: "Oui", ok: true });
    expect(n("Les 2 équipes marquent - 1ère mi-temps", "Non")).toMatchObject({ market_code: "HT_BTTS", selection: "Non", ok: true });
    expect(n("Double chance - 2e mi-temps", "Portugal ou Nul")).toMatchObject({ market_code: "H2_DC", selection: "N2", ok: true });
    expect(n("But dans les deux mi-temps", "Oui")).toMatchObject({ market_code: "BH", selection: "Oui", ok: true });
    expect(n("But dans les deux mi-temps", "Non")).toMatchObject({ market_code: "BH", selection: "Non", ok: true });
    expect(n("Mi-temps avec le plus de buts", "2e mi-temps")).toMatchObject({ market_code: "HMG", selection: "2", ok: true });
    expect(n("Mi-temps la plus prolifique", "Égalité")).toMatchObject({ market_code: "HMG", selection: "N", ok: true });
  });
  it("gagne au moins une mi-temps", () => {
    expect(n("Portugal gagne au moins 1 mi-temps", "Oui")).toMatchObject({ market_code: "WEH", selection: "2", ok: true });
    expect(n("", "Gagne au moins une mi-temps ✅", "Galles")).toMatchObject({ market_code: "WEH", selection: "1", ok: true });
    expect(n("Portugal gagne au moins 1 mi-temps", "Non")).toMatchObject({ ok: false });
    // « Gagne la 1re mi-temps » reste un autre pari
    expect(n("", "Victoire 1ère mi-temps ✅", "Portugal")).toMatchObject({ market_code: "HT_1X2", selection: "2", ok: true });
  });
  it("mi-temps / fin de match avec les codes de 1xBet", () => {
    expect(n("", "Mi-temps/Fin de match V1/V2")).toMatchObject({ market_code: "HTFT", selection: "1/2", ok: true });
    expect(n("Mi-temps / Fin de match", "X/V2")).toMatchObject({ market_code: "HTFT", selection: "N/2", ok: true });
    expect(n("Mi-temps / Fin de match", "Galles / Nul")).toMatchObject({ market_code: "HTFT", selection: "1/N", ok: true });
  });
  it("paris composés de 1xBet", () => {
    expect(n("", "V2 et Total < (3.5) - Oui")).toMatchObject({ market_code: "1X2_OU", market_param: 3.5, selection: "2|Moins", ok: true });
    expect(n("", "Equipe 2 ne va pas perdre et Total > (1.5) - Oui")).toMatchObject({ market_code: "DC_OU", market_param: 1.5, selection: "N2|Plus", ok: true });
    expect(n("", "Les deux équipes vont marquer et Total > (2.5) - Oui")).toMatchObject({ market_code: "OU_BTTS", market_param: 2.5, selection: "Plus|Oui", ok: true });
    // La négation d'un pari composé ne se ramène à aucun marché suivi
    expect(n("", "Equipe 1 ne va pas perdre et Total > (1.5) - Non")).toMatchObject({ ok: false });
  });
  it("deux paris du même match sur une ligne", () => {
    expect(n("Résultat du match (t. rég) / Nombre total de buts (t. rég)", "Portugal / + de 1,5")).toMatchObject({ market_code: "1X2_OU", market_param: 1.5, selection: "2|Plus", ok: true });
    expect(n("Double chance (t. rég) / Les 2 équipes marquent (t. rég)", "Galles ou Nul / Non")).toMatchObject({ market_code: "DC_BTTS", selection: "1N|Non", ok: true });
    expect(n("Résultat du match (t. rég) / Les 2 équipes marquent (t. rég) / Nombre total de buts (t. rég)", "Portugal / Oui / + de 2,5")).toMatchObject({ ok: false });
    // Une double chance écrite avec une barre n'est pas deux paris
    expect(n("Double chance (t. rég)", "Galles / Nul")).toMatchObject({ market_code: "DC", selection: "1N", ok: true });
    expect(n("Double chance & nombre de buts", "Portugal / Nul & + de 1,5")).toMatchObject({ market_code: "DC_OU", selection: "N2|Plus", ok: true });
  });
  it("remboursé si nul", () => {
    expect(n("Résultat du match (remboursé si match nul)", "Portugal")).toMatchObject({ market_code: "DNB", selection: "2", ok: true });
    expect(n("", "Remboursé si nul", "Galles")).toMatchObject({ market_code: "DNB", selection: "1", ok: true });
  });
  it("paris sur un joueur avec une condition : gardés tels quels", () => {
    expect(n("Joueur ou son remplaçant décisif (tps rég.)", "Bruno Fernandes")).toMatchObject({ ok: false });
    expect(n("Double chance buteur (remplaçants inclus - t. rég)", "E. Haaland / R. Højlund")).toMatchObject({ ok: false });
    expect(n("Buteur (tps rég.)", "Bruno Fernandes")).toMatchObject({ market_code: "BUT", selection: "Bruno Fernandes", ok: true });
  });
  it("un nom d'équipe ne vaut victoire que si rien d'autre n'est écrit", () => {
    expect(n("", "Portugal")).toMatchObject({ market_code: "1X2", selection: "2", ok: true });
    expect(n("", "Portugal – Victoire")).toMatchObject({ market_code: "1X2", selection: "2", ok: true });
    expect(n("", "Victoire de Portugal par 2 buts")).toMatchObject({ ok: false });
    expect(n("Premier corner", "Portugal")).toMatchObject({ ok: false });
    expect(n("", "Portugal va marquer")).toMatchObject({ market_code: "TT2", market_param: 0.5, selection: "Plus", ok: true });
  });
  it("libellé gardé quand le pari n'est pas reconnu", () => {
    expect(libelleBrut("Joueur ou son remplaçant décisif (tps rég.)", "Bruno Fernandes")).toBe("Joueur ou son remplaçant décisif (tps rég.) : Bruno Fernandes");
    expect(libelleBrut("Total Plus de (1.5)", "Total Plus de (1.5)")).toBe("Total Plus de (1.5)");
    expect(libelleBrut("", "")).toBe("Pari non lu");
    expect(libelleBrut("x".repeat(100), "y".repeat(100)).length).toBe(120);
  });
});

describe("date du ticket selon le bookmaker", () => {
  it("1xBet : points et parenthèses", () => {
    expect(parseFrDate("17.11.2026 (13:12)")).toBe("2026-11-17T13:12:00.000Z");
    expect(parseFrDate("Combiné à partir de 17.11.2026 (15:55)")).toBe("2026-11-17T15:55:00.000Z");
  });
  it("autres écritures", () => {
    expect(parseFrDate("08/11/2026 à 13h38")).toBe("2026-11-08T13:38:00.000Z");
    expect(parseFrDate("08-11-2026 13:38")).toBe("2026-11-08T13:38:00.000Z");
    expect(parseFrDate("hier")).toBeNull();
  });
});
