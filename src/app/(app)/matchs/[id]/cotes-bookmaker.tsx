import Link from "next/link";

export type LigneCote = { market: string; param: number | null; sel: string; label: string; book: number | null; mediane: number | null };

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

/** Les cotes d'un bookmaker à côté de la médiane, sélection par sélection, avec l'heure de chaque relevé. */
export function CotesParBookmaker({ bookmaker, releveAt, medianeAt, lignes, upcoming, href }: {
  bookmaker: string; releveAt: string; medianeAt: string | null; upcoming: boolean; lignes: LigneCote[];
  href: (market: string, sel: string, cote?: number, param?: number) => string;
}) {
  const ecart = ecartMoyen(lignes);
  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-baseline justify-between gap-2"><h2 className="text-sm font-semibold">Cotes par bookmaker</h2><span className="text-[11px] text-ink-muted">{bookmaker} : relevé {ilYA(releveAt)}</span></div>
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="text-[11px] text-ink-muted"><th className="pb-1 text-left font-normal">Sélection</th><th className="w-16 pb-1 text-right font-normal">{bookmaker}</th><th className="w-16 pb-1 text-right font-normal">Médiane</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {lignes.map((l) => (
            <tr key={`${l.market}${l.param}${l.sel}`}>
              <td className="truncate py-1.5 pr-2">{l.label}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">
                {l.book === null ? <span className="font-normal text-ink-muted">—</span>
                  : upcoming ? <Link href={href(l.market, l.sel, l.book, l.param ?? undefined)} className="underline decoration-line underline-offset-4">{C(l.book)}</Link>
                  : C(l.book)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-ink-soft">{l.mediane === null ? <span className="text-ink-muted">—</span> : C(l.mediane)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
        {bookmaker} : cotes relevées {quandReleve(releveAt)} par notre fournisseur ; elles ont pu bouger depuis, ton coupon fait foi.
        {medianeAt ? ` Médiane : cote du milieu chez les bookmakers européens, mise à jour ${ilYA(medianeAt)}.` : ""}
        {ecart !== null && Math.abs(ecart) >= 0.005 ? ` Sur ce match, ${bookmaker} paie en moyenne ${Math.abs(ecart * 100).toFixed(1).replace(".", ",")} % ${ecart < 0 ? "de moins" : "de plus"} que la médiane.` : ""}
        {" "}Betclic Côte d’Ivoire n’est relevé par aucun fournisseur : ses cotes n’apparaissent que si un ticket Betclic a été importé (plus bas).
      </p>
    </section>
  );
}
