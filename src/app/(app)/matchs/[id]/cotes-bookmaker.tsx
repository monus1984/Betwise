import Link from "next/link";
import { BETCLIC_CI, estimerBetclicCI } from "@/lib/odds-api/betclic-ci";

export type LigneCote = { market: string; param: number | null; sel: string; label: string; book: number | null; mediane: number | null; betclicFr?: number | null };

export function ilYA(iso: string, now = Date.now()) {
  const h = Math.round((now - Date.parse(iso)) / 3600000);
  if (h < 1) return "il y a moins d’une heure";
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}
/** « mer. 18/11 à 03:34 », heure d'Abidjan. */
export function quandReleve(iso: string) {
  const d = new Date(iso), o = { timeZone: "Africa/Abidjan" } as const;
  return `${d.toLocaleDateString("fr-FR", { ...o, weekday: "short", day: "2-digit", month: "2-digit" })} à ${d.toLocaleTimeString("fr-FR", { ...o, hour: "2-digit", minute: "2-digit" })}`;
}
const C = (x: number) => x.toFixed(2).replace(".", ",");

/** Écart moyen entre les cotes du bookmaker et la médiane, sur les sélections où les deux existent (−0,02 = 2 % de moins). */
export function ecartMoyen(lignes: LigneCote[]): number | null {
  const paires = lignes.filter((l) => l.book !== null && l.mediane !== null);
  return paires.length ? paires.reduce((s, l) => s + (l.book! / l.mediane! - 1), 0) / paires.length : null;
}

/** Les cotes 1xBet et Betclic France à côté de la médiane, avec l'estimation Betclic CI et l'heure de chaque relevé. */
export function CotesParBookmaker({ bookmaker, releveAt, betclicAt, medianeAt, lignes, upcoming, href }: {
  bookmaker: string | null; releveAt: string | null; betclicAt: string | null; medianeAt: string | null; upcoming: boolean; lignes: LigneCote[];
  href: (market: string, sel: string, cote?: number, param?: number) => string;
}) {
  const ecart = bookmaker ? ecartMoyen(lignes) : null;
  const avecBetclic = lignes.some((l) => l.betclicFr);
  const pct = (x: number) => `+${(x * 100).toFixed(1).replace(".", ",")} %`;
  const cell = (l: LigneCote, c: number | null) => c === null ? <span className="font-normal text-ink-muted">—</span>
    : upcoming ? <Link href={href(l.market, l.sel, c, l.param ?? undefined)} className="underline decoration-line underline-offset-4">{C(c)}</Link> : C(c);
  const tableau = (ls: LigneCote[], betclic: boolean) => (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="text-[11px] leading-tight text-ink-muted">
          <th className="pb-1 text-left font-normal">{betclic ? "Résultat" : "Sélection"}</th>
          {bookmaker && <th className="w-[3.4rem] pb-1 text-right font-normal">{bookmaker}</th>}
          {betclic && <th className="w-[3.4rem] pb-1 text-right font-normal">Betclic<br />France</th>}
          {betclic && <th className="w-[3.9rem] pb-1 text-right font-normal">Betclic CI<br />estimée</th>}
          <th className="w-[3.4rem] pb-1 text-right font-normal">Médiane</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {ls.map((l) => {
          const ci = betclic ? estimerBetclicCI(l.betclicFr) : null;
          return (
            <tr key={`${l.market}${l.param}${l.sel}`} className="align-top">
              <td className="py-1.5 pr-2 text-[13px] leading-snug [overflow-wrap:anywhere]">{l.label}</td>
              {bookmaker && <td className="py-1.5 text-right font-semibold tabular-nums">{cell(l, l.book)}</td>}
              {betclic && <td className="py-1.5 text-right font-semibold tabular-nums">{cell(l, l.betclicFr ?? null)}</td>}
              {betclic && (
                <td className="py-1.5 text-right tabular-nums">
                  {ci ? <><span className="text-ink-soft">≈ {C(ci.cote)}</span><span className="block text-[10px] leading-tight text-ink-muted">{C(ci.bas)}–{C(ci.haut)}</span></> : <span className="text-ink-muted">—</span>}
                </td>
              )}
              <td className="py-1.5 text-right tabular-nums text-ink-soft">{l.mediane === null ? <span className="text-ink-muted">—</span> : C(l.mediane)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-baseline justify-between gap-2"><h2 className="text-sm font-semibold">Cotes par bookmaker</h2>{bookmaker && releveAt && <span className="text-[11px] text-ink-muted">{bookmaker} : relevé {ilYA(releveAt)}</span>}</div>
      {avecBetclic ? (
        <>
          {tableau(lignes.filter((l) => l.market === "1X2"), true)}
          {lignes.some((l) => l.market !== "1X2") && <div className="mt-3">{tableau(lignes.filter((l) => l.market !== "1X2"), false)}</div>}
        </>
      ) : tableau(lignes, false)}
      <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
        {bookmaker && releveAt ? `${bookmaker} : cotes relevées ${quandReleve(releveAt)} par notre fournisseur. ` : ""}
        {avecBetclic && betclicAt ? `Betclic France : relevé ${quandReleve(betclicAt)}. ` : ""}
        Les cotes ont pu bouger depuis, ton coupon fait foi.
        {medianeAt ? ` Médiane : cote du milieu chez les bookmakers européens, mise à jour ${ilYA(medianeAt)}.` : ""}
        {ecart !== null && Math.abs(ecart) >= 0.005 ? ` Sur ce match, ${bookmaker} paie en moyenne ${Math.abs(ecart * 100).toFixed(1).replace(".", ",")} % ${ecart < 0 ? "de moins" : "de plus"} que la médiane.` : ""}
      </p>
      {avecBetclic ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
          <b className="font-semibold text-ink-soft">Betclic CI est une estimation, pas une cote relevée.</b> Aucun fournisseur ne relève Betclic Côte d’Ivoire.
          On part de Betclic France, plus {pct(BETCLIC_CI.reference)} : l’écart médian mesuré le {BETCLIC_CI.mesure} sur {BETCLIC_CI.paires} cotes ({BETCLIC_CI.matchs} matchs).
          Dans deux cas sur trois, l’écart tombe entre {pct(BETCLIC_CI.bas)} et {pct(BETCLIC_CI.haut)} : c’est la fourchette en petit. Vérifie la cote sur ton appli avant de parier.
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">Betclic Côte d’Ivoire n’est relevé par aucun fournisseur : ses cotes n’apparaissent que si un ticket Betclic a été importé (plus bas).</p>
      )}
    </section>
  );
}
