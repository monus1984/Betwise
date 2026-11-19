import { notFound } from "next/navigation";
import { MatchMarkets } from "@/app/(app)/matchs/[id]/markets";
import { CotesParBookmaker } from "@/app/(app)/matchs/[id]/cotes-bookmaker";
import { pickLabel, probaDirecte, probasMarche, type CoteBookmaker, type Signal } from "@/lib/probs/signals";

/** Onglet Marchés d'un match FICTIF, avec et sans cotes de bookmaker (?sans=1). N'existe pas en production. */
const RELEVE = new Date(Date.now() - 21 * 3600000).toISOString();
const b = (market: string, param: number | null, sel: string, cote: number): CoteBookmaker => ({ market, param, sel, cote, bookmaker: "1xBet", releveAt: RELEVE });
const BOOK: CoteBookmaker[] = [
  b("1X2", null, "1", 1.81), b("1X2", null, "N", 4.34), b("1X2", null, "2", 4.29),
  b("DC", null, "1N", 1.26), b("DC", null, "12", 1.26), b("DC", null, "N2", 2.11), b("DNB", null, "1", 1.33), b("DNB", null, "2", 3.2),
  b("OU", 1.5, "Plus", 1.13), b("OU", 1.5, "Moins", 5.36), b("OU", 2.5, "Plus", 1.51), b("OU", 2.5, "Moins", 2.55), b("OU", 3.5, "Plus", 2.38), b("OU", 3.5, "Moins", 1.68), b("OU", 4.5, "Plus", 3.94), b("OU", 4.5, "Moins", 1.25),
  b("BTTS", null, "Oui", 1.5), b("BTTS", null, "Non", 2.45),
  b("TT1", 0.5, "Plus", 1.12), b("TT1", 1.5, "Plus", 1.55), b("TT1", 1.5, "Moins", 2.4), b("TT1", 2.5, "Plus", 2.75), b("TT1", 2.5, "Moins", 1.44),
  b("TT2", 0.5, "Plus", 1.31), b("TT2", 0.5, "Moins", 3.1), b("TT2", 1.5, "Plus", 2.42), b("TT2", 1.5, "Moins", 1.56), b("TT2", 2.5, "Plus", 6), b("TT2", 2.5, "Moins", 1.12),
  b("AH", -1.5, "1", 2.9), b("AH", 1.5, "2", 1.42), b("AH", 1.5, "1", 1.1), b("AH", -1.5, "2", 6.7),
  b("HT_1X2", null, "1", 2.21), b("HT_1X2", null, "N", 2.46), b("HT_1X2", null, "2", 4.4), b("HT_DC", null, "1N", 1.16), b("HT_DC", null, "12", 1.47), b("HT_DC", null, "N2", 1.58),
  b("HT_OU", 0.5, "Plus", 1.36), b("HT_OU", 0.5, "Moins", 3.05), b("HT_OU", 1.5, "Plus", 2.18), b("HT_OU", 1.5, "Moins", 1.69), b("HT_BTTS", null, "Oui", 3.48), b("HT_BTTS", null, "Non", 1.27),
  b("H2_1X2", null, "1", 2), b("H2_1X2", null, "N", 2.91), b("H2_1X2", null, "2", 4.1), b("H2_OU", 0.5, "Plus", 1.2), b("H2_OU", 1.5, "Plus", 1.75), b("H2_OU", 1.5, "Moins", 2.09),
  b("HTFT", null, "1/1", 2.44), b("HTFT", null, "N/1", 4.85), b("HTFT", null, "N/N", 6.9), b("HTFT", null, "2/2", 7), b("HMG", null, "1", 3.04), b("HMG", null, "N", 4.05), b("HMG", null, "2", 1.97),
  b("OE", null, "Pair", 1.85), b("OE", null, "Impair", 1.85),
  b("CORN", 8.5, "Plus", 1.33), b("CORN", 8.5, "Moins", 2.81), b("CORN", 9.5, "Plus", 1.62), b("CORN", 9.5, "Moins", 2.11), b("CORN", 10.5, "Plus", 2.04), b("CORN", 10.5, "Moins", 1.69), b("CORN", 11.5, "Plus", 2.6), b("CORN", 11.5, "Moins", 1.41),
  b("CARD", 4.5, "Plus", 2.1), b("CARD", 4.5, "Moins", 1.67),
  b("CS", null, "1-0", 10), b("CS", null, "2-0", 10), b("CS", null, "2-1", 8), b("CS", null, "1-1", 8), b("CS", null, "3-1", 11), b("CS", null, "2-2", 11), b("CS", null, "3-0", 14), b("CS", null, "0-1", 14), b("CS", null, "1-2", 13),
];

function signal(bookAll: CoteBookmaker[]): Signal {
  const cotes = { c1: 1.85, cN: 4.3, c2: 4.4, plus25: 1.53, moins25: 2.5 };
  const ml = probasMarche(cotes)!;
  const ref: Record<string, number> = { "1X2||1": cotes.c1, "1X2||N": cotes.cN, "1X2||2": cotes.c2, "OU|2.5|Plus": cotes.plus25, "OU|2.5|Moins": cotes.moins25 };
  return {
    source: "marche", lh: ml.lh, la: ml.la, grid: ml.grid, approx: false, market: { lh: ml.lh, la: ml.la, grid: ml.grid }, model: null,
    refOdd: (m, p, s) => ref[`${m}|${p ?? ""}|${s}`] ?? null,
    direct: (m, p, s) => probaDirecte(cotes, m, p, s),
    bookOdd: (m, p, s) => { const o = bookAll.find((x) => x.market === m && x.param === p && x.sel === s); return o ? { cote: o.cote, bookmaker: o.bookmaker, releveAt: o.releveAt } : null; },
    bookAll,
  };
}

export default async function ApercuMatch({ searchParams }: { searchParams: Promise<{ sans?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sans = !!(await searchParams).sans;
  const sg = signal(sans ? [] : BOOK);
  const home = "Alpha FC", away = "Beta United";
  const m = { id: "00000000-0000-4000-8000-0000000000m1", kickoff_at: new Date(Date.now() + 60 * 3600000).toISOString(), home, away, comp: "DEMO", ouvert: true };
  const lignes = ([["1X2", null, "1"], ["1X2", null, "N"], ["1X2", null, "2"], ["OU", 2.5, "Plus"], ["OU", 2.5, "Moins"], ["BTTS", null, "Oui"], ["BTTS", null, "Non"], ["DC", null, "1N"], ["DC", null, "12"], ["DC", null, "N2"]] as [string, number | null, string][])
    .map(([market, param, sel]) => ({ market, param, sel, label: pickLabel(market, param, sel, home, away), book: sg.bookOdd(market, param, sel)?.cote ?? null, mediane: sg.refOdd(market, param, sel) }))
    .filter((l) => l.book !== null || l.mediane !== null);
  return (
    <div className="mx-auto max-w-xl space-y-3 px-4 pb-32 pt-5">
      <p className="rounded-lg bg-surface-2 px-3 py-1.5 text-center text-[11px] text-ink-muted">Onglet Marchés · planche de contrôle, match et cotes fictifs{sans ? " · sans cote de bookmaker" : ""}</p>
      <MatchMarkets m={m} sg={sg} />
      {!sans && <CotesParBookmaker bookmaker="1xBet" releveAt={RELEVE} medianeAt={new Date(Date.now() - 17 * 3600000).toISOString()} upcoming lignes={lignes} href={() => "#"} />}
    </div>
  );
}
