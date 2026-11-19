import { describe, expect, it } from "vitest";
import { issue } from "./issue";

/**
 * 60 sélections × 15 scores = 900 cas, réglés par betwise.settle_selection() le 18/11/2026 (g = gagné, p = perdu,
 * r = remboursé, e = en attente). issue() doit donner exactement la même chose : c'est elle qui sert à la mesure.
 * Pour régénérer la chaîne après un changement du règlement en base : même liste, même ordre, sélections en boucle extérieure.
 */
const SCORES: [number, number, number | null, number | null][] = [[0, 0, 0, 0], [1, 0, 1, 0], [1, 0, 0, 0], [0, 1, 0, 1], [1, 1, 1, 0], [1, 1, 0, 0], [2, 1, 0, 1], [2, 2, 1, 1], [3, 0, 1, 0], [0, 2, 0, 0], [3, 2, 2, 2], [2, 3, 1, 1], [4, 1, 3, 0], [1, 2, null, null], [5, 0, 2, 0]];
const SELS: [string, number | null, string][] = [["1X2", null, "1"], ["1X2", null, "N"], ["1X2", null, "2"], ["DC", null, "1N"], ["DC", null, "12"], ["DC", null, "N2"], ["DNB", null, "1"], ["DNB", null, "2"], ["OU", 1.5, "Plus"], ["OU", 2.5, "Moins"], ["OU", 2, "Plus"], ["OU", 3, "Moins"],
  ["BTTS", null, "Oui"], ["BTTS", null, "Non"], ["AH", -1.5, "1"], ["AH", 1.5, "2"], ["AH", -1, "1"], ["AH", 0, "2"], ["TT1", 0.5, "Plus"], ["TT2", 1.5, "Moins"], ["TT1", 1, "Plus"],
  ["HT_1X2", null, "1"], ["HT_1X2", null, "N"], ["HT_DC", null, "N2"], ["HT_OU", 0.5, "Plus"], ["HT_OU", 1.5, "Moins"], ["HT_BTTS", null, "Oui"], ["HT_TT1", 0.5, "Plus"], ["H2_1X2", null, "2"], ["H2_OU", 0.5, "Plus"], ["H2_BTTS", null, "Non"], ["H2_DC", null, "1N"], ["H2_TT2", 0.5, "Moins"],
  ["HTFT", null, "1/1"], ["HTFT", null, "N/2"], ["HMG", null, "1"], ["HMG", null, "N"], ["HMG", null, "2"], ["WEH", null, "1"], ["WEH", null, "2"], ["BH", null, "Oui"], ["BH", null, "Non"],
  ["OE", null, "Pair"], ["OE", null, "Impair"], ["MG", null, "1-2"], ["MG", null, "2-4"], ["EH", -1, "1"], ["EH", -1, "N"], ["EH", 1, "2"], ["WTN", null, "1"], ["WTN", null, "2"],
  ["DC_OU", 1.5, "1N|Plus"], ["DC_OU", 2.5, "N2|Moins"], ["1X2_OU", 2.5, "1|Plus"], ["1X2_OU", 2, "2|Plus"], ["DC_BTTS", null, "12|Oui"], ["1X2_BTTS", null, "N|Non"], ["OU_BTTS", 2.5, "Plus|Oui"], ["OU_BTTS", 3, "Moins|Non"], ["CS", null, "1-1"]];
const SQL = "pggpppgpgpgpgpggpppggpgppppppppppgpppppgpgpgpgggpgggggpgpgpgpgggppgpggggggggppgggpgpgpgpgprggprrgrgpgpgpgrppgrrprpgpgpgpppppgggggggggggggggggpppgppppppppprrgggrgggggggggggrprgppprpppppggggppggggpggggppppggppppgppppppppgpppgpgggggggggpgggpgpprrppprpgprpgpgrppgrrprpgpgpgppggpgggggpggggggggggggpgpppgpgprrprrgggpgggrgpgppgpppgpppgeggpgppgpgpgggpepgpggpgggpgggpeppgpggpgggpgggeggggggggpggpppeppppppppgppggpeppgppgppggpgggegppppgppppgpgpepppgpgggggggggeggggggpgpgggppegggggpggggpgpgegggggppgpgpgppegpgppppppgpppgegpppppppppgpgpeppgpgppppppgpgepgpppgppgpppppepppgppggpggpgpegpggpgpgpgpgpgegpppggpgppgpgpepppppgpgggpgggegggggpgpppgpppepgpppggpgpgppppppgggppgpgpgggggpgggggpppgpppppppppggggggpppgpppppppppgpppgpgpggpppgpppgpppppppppppppgppppppggpppppgpppppgpppgpppppgpppppppppgggggpgpgpggppgggpppgpppppppppppgpgpgpgpgpppppppppgpgpgpppppppgpppggggpgppppppppppppppppppppggppggggpggggppppggpppppppppggppppppppp";

describe("issue() suit le règlement en base", () => {
  it("900 cas identiques à settle_selection()", () => {
    expect(SQL.length).toBe(SELS.length * SCORES.length);
    const ecarts: string[] = [];
    let k = 0;
    for (const [m, p, s] of SELS) for (const [h, a, hth, hta] of SCORES) {
      const r = issue(m, p, s, { h, a, hth, hta });
      const c = r === "gagne" ? "g" : r === "perdu" ? "p" : r === "rembourse" ? "r" : "e";
      if (c !== SQL[k]) ecarts.push(`${m} ${p ?? ""} ${s} sur ${h}-${a} (mi-temps ${hth ?? "?"}-${hta ?? "?"}) : ${c} au lieu de ${SQL[k]}`);
      k++;
    }
    expect(ecarts).toEqual([]);
  });
});
