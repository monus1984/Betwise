import Link from "next/link";
import { CAT_CONSTATE, CAT_LABEL, CAT_STYLE, type Categorie } from "@/lib/coach/categories";
import type { TheirPick, TodayPick } from "@/lib/coach/today";
import { COMP_FLAG } from "@/components/match-ui";

const F = (x: number) => `${Math.round(x).toLocaleString("fr-FR")} F`;
const C = (x: number) => x.toFixed(2).replace(".", ",");
const time = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const CATS: Categorie[] = ["sur", "audacieux", "risque"];
const CAT_NOTE: Record<Categorie, string> = { sur: "cotes 1,10–1,20", audacieux: "cotes 1,20–1,50", risque: "cotes 1,50–1,90" };

export function CoupsDuJour({ picks, theirs, mises }: { picks: TodayPick[]; theirs: TheirPick[]; mises: Record<Categorie, number> | null }) {
  return (
    <section className="mt-3 rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="mb-3 flex items-baseline justify-between gap-2"><h2 className="text-sm font-semibold">⚡ Les coups du jour</h2><Link href="/options" className="text-[11px] text-brand">toutes les options ›</Link></div>
      {picks.length === 0 ? (
        <p className="text-sm text-ink-muted">Rien de solide aujourd’hui : aucune sélection ne s’appuie sur une vraie cote de référence. Le Coach préfère se taire que proposer au hasard.</p>
      ) : (
        <div className="space-y-4">
          {CATS.map((cat) => {
            const list = picks.filter((p) => p.categorie === cat);
            if (!list.length) return null;
            const mise = mises?.[cat] ?? 0;
            return (
              <div key={cat}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CAT_STYLE[cat]}`}>{CAT_LABEL[cat]} <span className="font-normal">· {CAT_NOTE[cat]}</span></span>
                  <span className="text-[11px] text-ink-muted">{mises ? (mise ? `mise conseillée ${F(mise)}` : "pas de budget risque") : `passe ~${Math.round(CAT_CONSTATE[cat] * 100)} fois sur 100`}</span>
                </div>
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {list.map((p) => {
                    const cote = p.cote ?? p.coteJuste;
                    return (
                      <li key={p.id}>
                        <Link href={`/matchs/${p.match_id}`} className="flex items-center gap-3 px-3 py-2 active:bg-surface-2">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{p.selection}</span>
                            <span className="block truncate text-[11px] text-ink-muted">{COMP_FLAG[p.comp ?? ""] ?? "⚽"} {p.match} · {p.statut === "termine" ? "terminé" : time(p.kickoff)}</span>
                            {p.soutiens.length > 0 && <span className="block truncate text-[11px] font-medium text-gain">✓ aussi chez {p.soutiens.join(", ")}</span>}
                          </span>
                          <span className="shrink-0 text-right tabular-nums">
                            <span className="block text-sm font-bold">{Math.round(p.p * 100)} %</span>
                            <span className="block text-[11px] text-ink-muted">{p.cote ? `cote ${C(p.cote)}` : `juste ${C(p.coteJuste)}`}</span>
                            {mise > 0 && <span className="block text-[10px] text-gain">+{F(mise * (cote - 1))}</span>}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          <p className="text-[11px] leading-relaxed text-ink-muted">Probabilités tirées des cotes de référence, marge retirée. Prends la sélection si ton bookmaker paie au moins la cote affichée. Ces coups sont enregistrés comme pronos de « Coups du jour BETWISE » : leur bilan est public, bon ou mauvais.</p>
        </div>
      )}

      {theirs.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Tes choix et ceux de tes sources, vus par BETWISE</h3>
          <ul className="space-y-2">
            {theirs.map((t, i) => (
              <li key={i} className="rounded-lg bg-surface-2 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{t.selection}{t.cote ? <span className="font-normal text-ink-muted"> · {C(t.cote)}</span> : null}</span>
                    <span className="block truncate text-[11px] text-ink-muted">{t.qui} · {t.match} · {time(t.kickoff)}</span>
                  </span>
                  {t.categorie && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CAT_STYLE[t.categorie]}`}>{CAT_LABEL[t.categorie]}</span>}
                </div>
                <p className={`mt-1 text-[11px] font-medium ${t.tone === "good" ? "text-gain" : t.tone === "mid" ? "text-draw" : t.tone === "bad" ? "text-loss" : "text-ink-muted"}`}>{t.aussiBetwise ? "✓ C’est aussi un coup du jour BETWISE · " : ""}{t.verdict}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
