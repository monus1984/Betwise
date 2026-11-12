import { describe, expect, it } from "vitest";
import { findMatch, type PoolMatch } from "./relink";

const M = (home: string, away: string, iso: string, alias: string[] = []): PoolMatch => ({ id: `${home}-${away}`, kickoff_at: iso, home: { nom: home, alias }, away: { nom: away, alias: [] } });
const POOL = [M("Ghana", "Somalie", "2026-11-12T13:00:00Z"), M("Sénégal", "Soudan", "2026-11-12T19:00:00Z"), M("Maroc", "Niger", "2026-11-13T19:00:00Z"), M("Alavés", "Valence", "2026-11-14T15:00:00Z"), M("RD Congo", "Sierra Leone", "2026-11-12T16:00:00Z", ["Congo DR"]), M("Ghana", "Somalie", "2026-12-20T13:00:00Z")];
const REF = "2026-11-11T07:16:00Z";

describe("rattachement d'un match saisi en libre", () => {
  it("retrouve le match quand les deux équipes sont reconnues", () => {
    expect(findMatch("Ghana – Somalie", REF, POOL)?.kickoff_at).toBe("2026-11-12T13:00:00Z");
    expect(findMatch("Maroc - Niger", REF, POOL)?.id).toBe("Maroc-Niger");
    expect(findMatch("RDC vs Sierra Leone", REF, POOL)?.id).toBe("RD Congo-Sierra Leone");
  });
  it("ne devine pas : une seule équipe reconnue, autre sport, ou match trop loin", () => {
    expect(findMatch("Anaitasuna FT – Alaves", REF, POOL)).toBeNull();
    expect(findMatch("Tavernes – Valence", REF, POOL)).toBeNull();
    expect(findMatch("Ghana – Somalie", "2026-11-25T07:00:00Z", POOL)).toBeNull();
    expect(findMatch("Sénégal", REF, POOL)).toBeNull();
  });
});
