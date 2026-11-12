import type { TicketAnalysis } from "@/lib/probs/ticket";
import { CAT_LABEL, CAT_STYLE, categorieOf } from "@/lib/coach/categories";

const fr = (x: number) => x.toFixed(2).replace(".", ",");
const ORIG = { modele: "modèle", marche: "cotes", estime: "estimé" } as const;

export function TicketAnalysisCard({ a }: { a: TicketAnalysis }) {
  const combo = a.lignes.length > 1;
  const pct = (x: number) => `${x >= 0.1 ? Math.round(x * 100) : (x * 100).toFixed(1).replace(".", ",")} %`;
  return (
    <section className="mb-4 rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="mb-3 flex items-baseline justify-between"><h2 className="text-sm font-semibold">Analyse du ticket</h2><span className="text-[11px] text-ink-muted">probabilités BETWISE</span></div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-surface-2 p-2"><p className="text-[11px] text-ink-muted">Chances de passer</p><p className="text-lg font-bold tabular-nums">{pct(a.pTicket)}</p></div>
        <div className="rounded-lg bg-surface-2 p-2"><p className="text-[11px] text-ink-muted">Cote juste</p><p className="text-lg font-bold tabular-nums">{fr(a.coteJuste)}</p><p className="text-[10px] text-ink-muted">obtenue {fr(a.coteObtenue)}</p></div>
        <div className="rounded-lg bg-surface-2 p-2"><p className="text-[11px] text-ink-muted">Rendement attendu</p><p className={`text-lg font-bold tabular-nums ${a.esperance >= 0 ? "text-gain" : "text-loss"}`}>{a.esperance >= 0 ? "+" : ""}{Math.round(a.esperance * 100)} %</p></div>
      </div>

      <ul className="mt-3 divide-y divide-line">
        {a.lignes.map((l, i) => (
          <li key={i} className="py-2">
            <div className="flex items-baseline justify-between gap-2 text-sm"><span className="truncate">{l.label}</span><span className="shrink-0 tabular-nums"><b>{pct(l.p)}</b> <span className="text-xs text-ink-muted">cote {fr(l.cote)}</span></span></div>
            <p className="flex items-center gap-1.5 truncate text-[11px] text-ink-muted">{(() => { const c = categorieOf(l.p); return c ? <span className={`rounded-full border px-1.5 text-[10px] font-semibold ${CAT_STYLE[c]}`}>{CAT_LABEL[c]}</span> : null; })()}<span className="truncate">{l.match} · {ORIG[l.origine]}</span></p>
            <div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className={`h-1.5 rounded-full ${l.p >= 0.75 ? "bg-gain" : l.p >= 0.55 ? "bg-draw" : "bg-loss"}`} style={{ width: `${l.p * 100}%` }} /></div>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        {combo ? <>Chaque sélection a entre {pct(Math.min(...a.lignes.map((l) => l.p)))} et {pct(Math.max(...a.lignes.map((l) => l.p)))} de chances, mais il faut les réussir toutes : ensemble, <b>{pct(a.pTicket)}</b>. </> : null}
        {a.esperance < -0.03 ? <>À cette cote, le ticket rend en moyenne {Math.round(-a.esperance * 100)} % de moins que sa mise : c’est la marge du bookmaker{combo ? ", cumulée sur chaque sélection" : ""}. </> : a.esperance > 0.03 ? <>La cote obtenue est au-dessus de la cote juste : le pari est favorable sur le papier. </> : <>La cote obtenue est proche de la cote juste. </>}
        {a.maillonFaible && <>Maillon faible : <b>{a.maillonFaible.label}</b> ({a.maillonFaible.match}).</>}
      </p>
      {(a.memeMatch || a.partEstimee > 0) && (
        <p className="mt-1 text-[11px] text-ink-muted">
          {a.memeMatch && "Deux sélections portent sur le même match : elles ne sont pas indépendantes, le chiffre global est approximatif. "}
          {a.partEstimee > 0 && "« Estimé » : match non couvert, probabilité tirée de la cote jouée moins 5 % de marge."}
        </p>
      )}
    </section>
  );
}
