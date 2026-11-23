import { APP_NAME } from "@/lib/app-name";
import { gainPour1000 } from "@/components/proposition";
import Link from "next/link";
import { CAT_COTES, CAT_LABEL, CAT_STYLE, type Categorie } from "@/lib/coach/categories";
import type { Repli, TheirPick, TodayPick } from "@/lib/coach/today";
import { COMP_FLAG } from "@/components/match-ui";
import { IconBolt, IconFlame, IconShield, IconTile } from "@/components/icons";
import { AddToSlip } from "@/components/slip";
import { legFrom } from "@/lib/slip/leg";

const F = (x: number) => `${Math.round(x).toLocaleString("fr-FR")} F`;
const C = (x: number) => x.toFixed(2).replace(".", ",");
const time = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const CATS: Categorie[] = ["sur", "audacieux", "risque"];
const CAT_NOTE: Record<Categorie, string> = CAT_COTES;

export function CoupsDuJour({ picks, theirs, mises, repli = [] }: { picks: TodayPick[]; theirs: TheirPick[]; mises: Record<Categorie, number> | null; repli?: Repli[] }) {
  return (
    <section className="mt-3 rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-baseline justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-semibold"><IconTile size="sm" tone="conseil"><IconBolt width={18} height={18} /></IconTile>Les coups du jour</h2><Link href="/options" className="text-[11px] text-brand">toutes les options ›</Link></div>
      {picks.length === 0 ? (
        repli.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun match couvert dans les 48 heures qui viennent. En attendant : charge un coupon de tes sources, ou <Link href="/options" className="text-brand underline">cherche par probabilité</Link> sur les prochains jours.</p>
        ) : (
          <div>
            <p className="mb-2 text-[12px] leading-snug text-ink-soft">Les sélections les plus probables du moment. Pour chacune : sa chance de passer, et le risque que tu prends.</p>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {repli.map((r) => (
                <li key={`${r.matchId}${r.selection}`}>
                  <Link href={`/matchs/${r.matchId}`} className="flex items-center gap-3 px-3 py-2 active:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block leading-snug text-sm font-medium">{r.selection}</span>
                      <span className="block leading-snug text-[11px] text-ink-muted">{r.match} · {time(r.kickoff)}{r.estimation ? " · estimation" : r.cote ? ` · cote ${C(r.cote)}` : ""}</span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="block text-sm font-bold">{Math.round(r.p * 100)} %</span>
                      {r.cote ? <span className="block text-[11px] text-ink-muted">1 000 F → {gainPour1000(r.cote)}</span> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {repli.some((r) => r.estimation) && <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">« Estimation » : pas de cote de bookmaker sur ce marché, le chiffre vient du modèle. Il est moins fiable ; compare-le à la cote de ton bookmaker.</p>}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {CATS.map((cat) => {
            const list = picks.filter((p) => p.categorie === cat);
            if (!list.length) return null;
            const mise = mises?.[cat] ?? 0;
            return (
              <div key={cat}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border py-0.5 pl-1.5 pr-2 text-[11px] font-semibold ${CAT_STYLE[cat]}`}>{cat === "sur" ? <IconShield width={14} height={14} /> : cat === "audacieux" ? <IconFlame width={14} height={14} /> : <IconBolt width={14} height={14} />}{CAT_LABEL[cat]} <span className="font-normal">· {CAT_NOTE[cat]}</span></span>
                  <span className="text-[11px] text-ink-muted">{mises ? (mise ? `mise conseillée ${F(mise)}` : "pas de budget risque") : "mise selon ton budget"}</span>
                </div>
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {list.map((p) => {
                    const cote = p.cote ?? p.coteJuste;
                    return (
                      <li key={p.id} className="flex items-center pr-2">
                        <Link href={`/matchs/${p.match_id}`} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 active:bg-surface-2">
                          <span className="min-w-0 flex-1">
                            <span className="block leading-snug text-sm font-medium">{p.selection}</span>
                            <span className="block leading-snug text-[11px] text-ink-muted">{COMP_FLAG[p.comp ?? ""] ?? "⚽"} {p.match} · {p.statut === "termine" ? "terminé" : time(p.kickoff)}</span>
                            {p.soutiens.length > 0 && <span className="block leading-snug text-[11px] font-medium text-gain">✓ aussi chez {p.soutiens.join(", ")}</span>}
                          </span>
                          <span className="shrink-0 text-right tabular-nums">
                            <span className="block text-sm font-bold">{Math.round(p.p * 100)} %</span>
                            <span className="block text-[11px] text-ink-muted">{p.cote ? `cote ${C(p.cote)}` : `juste ${C(p.coteJuste)}`}</span>
                            {mise > 0 && <span className="block text-[10px] text-gain">+{F(mise * (cote - 1))}</span>}
                          </span>
                        </Link>
                        {p.statut === "programme" && <AddToSlip size="sm" leg={legFrom({ matchId: p.match_id, home: p.home, away: p.away, kickoff: p.kickoff, comp: p.comp ?? "", market: p.market, param: p.param, sel: p.sel, p: p.p, cote: p.cote, label: p.selection })} />}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          <p className="text-[11px] leading-relaxed text-ink-muted">Probabilités tirées des cotes de référence, marge retirée. Prends la sélection si ton bookmaker paie au moins la cote affichée. Ces coups sont enregistrés comme pronos de « Coups du jour {APP_NAME} » : leur bilan est public, bon ou mauvais.</p>
        </div>
      )}

      {theirs.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Tes choix et ceux de tes sources, vus par {APP_NAME}</h3>
          <ul className="space-y-2">
            {theirs.map((t, i) => (
              <li key={i} className="rounded-lg bg-surface-2 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block leading-snug text-sm font-medium">{t.selection}{t.cote ? <span className="font-normal text-ink-muted"> · {C(t.cote)}</span> : null}</span>
                    <span className="block leading-snug text-[11px] text-ink-muted">{t.qui} · {t.match} · {time(t.kickoff)}</span>
                  </span>
                  {t.categorie && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CAT_STYLE[t.categorie]}`}>{CAT_LABEL[t.categorie]}</span>}
                </div>
                <p className={`mt-1 text-[11px] font-medium ${t.tone === "good" ? "text-gain" : t.tone === "mid" ? "text-draw-ink" : t.tone === "bad" ? "text-loss" : "text-ink-muted"}`}>{t.aussiBetwise ? `✓ C’est aussi un coup du jour ${APP_NAME} · ` : ""}{t.verdict}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
