import { describe, expect, it } from "vitest";
import { coteDe, marquesDe, nomCourt, rangees } from "./compos";

const j = (nom: string, numero: number, poste: string, grid: string | null = null) => ({ nom, numero, poste, grid });

describe("compos : placement sur le terrain", () => {
  it("suit la grille API-Football, rangée par rangée, colonne par colonne", () => {
    const onze = [j("J. Oblak", 13, "G", "1:1"), j("A. Grimaldo", 22, "D", "2:4"), j("M. Llorente", 14, "D", "2:1"), j("R. Le Normand", 24, "D", "2:2"), j("D. Hancko", 17, "D", "2:3"),
      j("Lee Kang-In", 7, "M", "3:1"), j("Koke", 6, "M", "3:2"), j("J. Cardoso", 5, "M", "3:3"), j("A. Baena", 10, "M", "3:4"), j("J. Alvarez", 19, "F", "4:1"), j("A. Sorloth", 9, "F", "4:2")];
    const r = rangees(onze, "4-4-2");
    expect(r.map((x) => x.length)).toEqual([1, 4, 4, 2]);
    expect(r[1].map((p) => p.numero)).toEqual([14, 24, 17, 22]);
  });
  it("sans grille, suit le schéma dans l'ordre de la feuille, gardien d'abord", () => {
    const onze = [j("G", 1, "G"), ...[2, 3, 4, 5].map((n) => j(`D${n}`, n, "D")), ...[6, 8].map((n) => j(`M${n}`, n, "M")), ...[7, 10, 11].map((n) => j(`A${n}`, n, "M")), j("F9", 9, "F")];
    expect(rangees(onze, "4-2-3-1").map((x) => x.length)).toEqual([1, 4, 2, 3, 1]);
  });
  it("sans grille ni schéma cohérent, regroupe par poste", () => {
    const onze = [j("G", 1, "G"), ...[2, 3, 4].map((n) => j(`D${n}`, n, "D")), ...[5, 6, 7, 8, 10].map((n) => j(`M${n}`, n, "M")), j("F9", 9, "F"), j("F11", 11, "F")];
    expect(rangees(onze, null).map((x) => x.length)).toEqual([1, 3, 5, 2]);
    expect(rangees(onze, "4-3-3").map((x) => x.length)).toEqual([1, 4, 3, 3]); // un schéma cohérent l'emporte sur les postes
  });
});

describe("compos : noms et événements", () => {
  it("raccourcit les noms pour le terrain", () => {
    expect(nomCourt("J. Oblak")).toBe("Oblak");
    expect(nomCourt("R. Le Normand")).toBe("Le Normand");
    expect(nomCourt("Lee Kang-In")).toBe("Lee Kang-In");
    expect(nomCourt("S. Kvia-Egeskog Johansen")).toBe("Kvia-Egeskog…");
  });
  it("rattache buts et cartons aux joueurs de la bonne équipe, par nom exact ou nom de famille", () => {
    const m = marquesDe([j("J. Alvarez", 19, "F"), j("A. Sorloth", 9, "F"), j("Koke", 6, "M")], [
      { t: "but", n: "J. Alvarez", e: "1" }, { t: "pen", n: "Julián Alvarez", e: "1" }, { t: "jaune", n: "Koke", e: "1" }, { t: "but", n: "A. Sorloth", e: "2" },
    ], "1");
    expect(m.get("J. Alvarez")).toEqual({ buts: 2, csc: 0, jaune: false, rouge: false });
    expect(m.get("Koke")?.jaune).toBe(true);
    expect(m.has("A. Sorloth")).toBe(false); // but marqué pour l'autre équipe : pas le sien
  });
  it("range un absent du bon côté, par nom de composition puis par ressemblance", () => {
    expect(coteDe("Sporting CP", "Sporting Clube de Portugal", "Manchester United", ["Sporting CP", "Manchester United"])).toBe("1");
    expect(coteDe("Manchester Utd", "Sporting Clube de Portugal", "Manchester United")).toBe("2");
  });
});
