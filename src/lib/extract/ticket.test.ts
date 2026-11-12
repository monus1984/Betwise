import { describe, expect, it } from "vitest";
import { normalizePick, parseFrDate } from "./ticket";

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

describe("parseFrDate", () => {
  it("lit l'horodatage Betclic", () => {
    expect(parseFrDate("08/11/2026 13:38")).toBe("2026-11-08T13:38:00.000Z");
    expect(parseFrDate(null)).toBeNull();
  });
});
