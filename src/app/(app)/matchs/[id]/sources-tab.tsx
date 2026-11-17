import Link from "next/link";
import { pickLabel } from "@/lib/probs/signals";
import { desaccords } from "@/lib/sources/desaccord";
import { resume, type Proof } from "@/lib/sources/proof";
import { Empty } from "@/components/ui";

type Prono = { id: string; sourceId: string; source: string; market: string; param: number | null; sel: string; cote: number | null; prouve: boolean; resultat: string };

/** Ce que disent les sources sur ce match : chaque prono avec son niveau de preuve, et les contradictions entre elles. */
export function MatchSources({ pronos, proofs, home, away, joue }: { pronos: Prono[]; proofs: Record<string, Proof>; home: string; away: string; joue: boolean }) {
  if (pronos.length === 0) return <Empty titre="Aucun prono sur ce match">Quand une de tes sources en donne un, charge son coupon : il comptera dans sa note et nourrira tes comparaisons.</Empty>;
  const lib = (p: Prono) => pickLabel(p.market, p.param, p.sel, home, away);
  const conflits = desaccords(pronos.map((p) => ({ source: p.source, market: p.market, param: p.param, sel: p.sel })));
  const parSource = new Map<string, Prono[]>();
  for (const p of pronos) parSource.set(p.sourceId, [...(parSource.get(p.sourceId) ?? []), p]);

  return (
    <div className="space-y-3">
      {conflits.length > 0 && (
        <section className="rounded-xl border border-draw/40 bg-draw-soft p-3" aria-label="Désaccords entre sources">
          <p className="text-sm font-semibold text-draw-ink">{conflits.length > 1 ? `${conflits.length} désaccords entre tes sources` : "Tes sources ne sont pas d’accord"}</p>
          <ul className="mt-1.5 space-y-1 text-[13px] leading-snug text-draw-ink">
            {conflits.slice(0, 4).map((c, i) => (
              <li key={i}><b>{c.a.source}</b> : {pickLabel(c.a.market, c.a.param, c.a.sel, home, away)} · <b>{c.b.source}</b> : {pickLabel(c.b.market, c.b.param, c.b.sel, home, away)}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-draw-ink">Les deux ne peuvent pas passer : compare leur réussite, à droite de leur nom.</p>
        </section>
      )}
      {[...parSource.entries()].map(([sid, liste]) => {
        const pf = proofs[sid];
        return (
          <section key={sid} className="rounded-xl border border-line bg-surface p-3">
            <div className="flex items-baseline justify-between gap-3">
              <Link href={`/sources/${sid}`} className="min-w-0 truncate text-sm font-semibold underline decoration-line underline-offset-2">{liste[0].source}</Link>
              <span className="shrink-0 text-[11px] text-ink-muted">{pf ? resume(pf) : "à suivre"}</span>
            </div>
            <ul className="mt-1 divide-y divide-line">
              {liste.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="min-w-0">
                    <span className="block truncate">{lib(p)}{p.cote ? <span className="text-ink-muted"> · cote {p.cote.toFixed(2).replace(".", ",")}</span> : null}</span>
                    {p.prouve && <span className="text-[11px] text-ink-muted">chargé avant le coup d’envoi</span>}
                  </span>
                  {joue || p.resultat !== "en_attente" ? (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.resultat === "gagne" ? "bg-gain-soft text-gain-ink" : p.resultat === "perdu" ? "bg-loss-soft text-loss-ink" : "bg-surface-2 text-ink-soft"}`}>{p.resultat === "gagne" ? "Juste" : p.resultat === "perdu" ? "Raté" : p.resultat === "rembourse" ? "Remboursé" : "En attente"}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="px-1 text-[11px] leading-relaxed text-ink-muted">À droite de chaque source : ses pronos justes sur ses pronos réglés. Ajoute les coupons de tes sources pour enrichir ces chiffres.</p>
    </div>
  );
}
