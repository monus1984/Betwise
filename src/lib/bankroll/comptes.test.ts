import { describe, expect, it } from "vitest";
import { comptes, type Mouvement } from "./comptes";

const mv = (type: Mouvement["type"], montant: number, bookmaker: string | null, bet_id: string | null = null): Mouvement => ({ type, montant, bookmaker, bet_id });

describe("comptes par bookmaker", () => {
  // Le cas réel du 16 novembre : transfert de 4 000 F de Betclic vers 1xBet, un combiné gagné, un perdu.
  const journal = [
    mv("depot", 30000, "Betclic"), mv("retrait", -4000, "Betclic"), mv("depot", 4000, "1xBet"),
    mv("mise", -1500, "1xBet", "a"), mv("gain", 20906.74, "1xBet", "a"), mv("ajustement", -9786.14, "1xBet", "a"),
    mv("mise", -2000, "1xBet", "b"),
    mv("mise", -4000, "betclic ", "c"), mv("mise", -2000, "Betclic", "d"),
    mv("ajustement", -10000, "Betclic"),
  ];
  const { comptes: c, total } = comptes(journal, [{ mise: 4000, bookmaker: "Betclic" }, { mise: 2000, bookmaker: "Betclic" }]);
  const x = c.find((k) => k.nom === "1xBet")!, b = c.find((k) => k.nom === "Betclic")!;

  it("chaque compte a son solde, la casse du nom ne crée pas de doublon", () => {
    expect(c).toHaveLength(2);
    expect(x.solde).toBe(11620.6);
    expect(b.solde).toBe(10000);
  });
  it("les mises en jeu sont séparées du résultat des paris réglés", () => {
    expect(b.enJeu).toBe(6000);
    expect(b.resultat).toBe(0);
    expect(x.resultat).toBe(7620.6);
  });
  it("solde = dépôts − retraits + résultat − en jeu + recalages, pour chaque compte et pour le total", () => {
    for (const k of [...c, total]) expect(k.solde).toBeCloseTo(k.depots - k.retraits + k.resultat - k.enJeu + k.recalages, 2);
    expect(total.solde).toBe(21620.6);
    expect(total.solde).toBeCloseTo(journal.reduce((s, t) => s + t.montant, 0), 2);
  });
  it("un mouvement sans bookmaker va dans « Non précisé »", () => {
    expect(comptes([mv("depot", 500, null)], []).comptes[0].nom).toBe("Non précisé");
  });
});
