import { describe, expect, it } from "vitest";
import { normalizePick, parseFrDate } from "./ticket";
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
