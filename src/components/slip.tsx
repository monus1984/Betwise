"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CAT_LABEL, CAT_STYLE, categorieOf } from "@/lib/coach/categories";
import { slip, slipHref, useSlip, type Leg } from "@/lib/slip/store";

const C = (x: number) => x.toFixed(2).replace(".", ",");

/** Bouton « + » : ajoute la sélection au coupon (ou la retire). Utilisable à l'intérieur d'une ligne cliquable. */
export function AddToSlip({ leg, size = "md", label }: { leg: Leg; size?: "sm" | "md"; label?: string }) {
  const legs = useSlip();
  const inSlip = legs.some((x) => x.matchId === leg.matchId && x.market === leg.market && (x.param ?? null) === (leg.param ?? null) && x.sel === leg.sel);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 1400); return () => clearTimeout(t); }, [flash]);
  const dim = size === "sm" ? "h-7 min-w-7 text-sm" : "h-8 min-w-8 text-base";
  return (
    <span className="relative shrink-0">
      <button
        type="button"
        aria-label={inSlip ? "Retirer du coupon" : "Ajouter au coupon"}
        aria-pressed={inSlip}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); const r = slip.toggle(leg); setFlash(r === "remplace" ? "Remplacé" : r === "ajoute" ? "Ajouté" : null); }}
        className={`flex ${dim} items-center justify-center rounded-full border px-2 font-semibold transition active:scale-95 ${inSlip ? "border-brand bg-brand text-white" : "border-brand/40 bg-white text-brand"}`}
      >
        {inSlip ? "✓" : "+"}{label && <span className="ml-1 text-xs font-medium">{label}</span>}
      </button>
      {flash && <span className="pointer-events-none absolute -top-6 right-0 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[10px] text-white">{flash}</span>}
    </span>
  );
}

/** Case de cote façon bookmaker : libellé, cote, probabilité ; un appui l'ajoute au coupon. `wide` : ligne pleine largeur. */
export function OddButton({ leg, name, disabled, wide }: { leg: Leg; name: string; disabled?: boolean; wide?: boolean }) {
  const legs = useSlip();
  const on = legs.some((x) => x.matchId === leg.matchId && x.market === leg.market && (x.param ?? null) === (leg.param ?? null) && x.sel === leg.sel);
  const tone = on ? "text-white/80" : "text-ink-muted";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => slip.toggle(leg)}
      className={`min-w-0 rounded-lg border transition active:scale-[0.98] disabled:opacity-50 ${on ? "border-brand bg-brand text-white" : "border-line bg-white"} ${wide ? "flex w-full items-center gap-2 px-3 py-2 text-left" : "flex flex-col items-center px-1.5 py-1.5 text-center"}`}
    >
      <span className={wide ? "min-w-0 flex-1 text-[13px] leading-snug" : `w-full truncate text-[11px] leading-tight ${tone}`}>{name}</span>
      {wide && leg.p !== null && <span className={`shrink-0 text-[11px] tabular-nums ${tone}`}>{Math.round(leg.p * 100)} %</span>}
      <span className={`shrink-0 font-semibold tabular-nums ${wide ? "w-12 text-right text-sm" : "text-[15px]"}`}>{leg.estimee ? "≈" : ""}{C(leg.cote)}</span>
      {!wide && leg.p !== null && <span className={`text-[10px] tabular-nums ${tone}`}>{Math.round(leg.p * 100)} %</span>}
    </button>
  );
}

/** Barre du coupon, au-dessus de la barre d'onglets, et son volet de détail. */
export function SlipBar() {
  const legs = useSlip();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  if (!legs.length || path.startsWith("/nouveau")) return null;
  const cote = legs.reduce((x, l) => x * l.cote, 1);
  const known = legs.every((l) => l.p !== null);
  const p = known ? legs.reduce((x, l) => x * (l.p as number), 1) : null;

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setOpen(false)} aria-hidden />}
      <div className="fixed inset-x-0 z-30 mx-auto max-w-xl px-3" style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}>
        {open && (
          <section className="mb-2 max-h-[65dvh] overflow-y-auto rounded-2xl border border-line bg-white p-3 shadow-xl" aria-label="Coupon">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Mon coupon · {legs.length} sélection{legs.length > 1 ? "s" : ""}</h2>
              <button type="button" onClick={() => slip.clear()} className="text-xs text-ink-muted underline">Vider</button>
            </div>
            <ul className="divide-y divide-line">
              {legs.map((l) => {
                const cat = l.p !== null ? categorieOf(l.p) : null;
                return (
                  <li key={l.matchId} className="flex items-center gap-2 py-2">
                    <Link href={`/matchs/${l.matchId}`} className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{l.label}</span>
                      <span className="block truncate text-[11px] text-ink-muted">{l.home} – {l.away} · {new Date(l.kickoff).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })}</span>
                    </Link>
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="block text-sm font-semibold">{l.estimee ? "≈ " : ""}{C(l.cote)}</span>
                      {l.p !== null && <span className="block text-[10px] text-ink-muted">{Math.round(l.p * 100)} %{cat ? ` · ${CAT_LABEL[cat]}` : ""}</span>}
                    </span>
                    <button type="button" aria-label="Retirer" onClick={() => slip.remove(l.matchId)} className="shrink-0 px-1 text-lg leading-none text-ink-muted">×</button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 rounded-lg bg-surface-2 p-2.5 text-xs">
              <div className="flex justify-between"><span>Cote totale</span><b className="tabular-nums">{C(cote)}</b></div>
              {p !== null && (
                <div className="mt-1 flex items-center justify-between">
                  <span>Chance de passer</span>
                  <span className="tabular-nums"><b>{p >= 0.1 ? Math.round(p * 100) : (p * 100).toFixed(1).replace(".", ",")} %</b>{categorieOf(p) && <span className={`ml-1.5 rounded-full border px-1.5 text-[10px] ${CAT_STYLE[categorieOf(p)!]}`}>{CAT_LABEL[categorieOf(p)!]}</span>}</span>
                </div>
              )}
              {legs.some((l) => l.estimee) && <p className="mt-1 text-[10px] text-ink-muted">≈ : cote estimée (pas de cote de référence). Mets la cote de ton bookmaker à l’étape suivante.</p>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href={slipHref(legs, true)} className="rounded-xl border border-line py-2.5 text-center text-sm font-semibold">Tester sans miser</Link>
              <Link href={slipHref(legs, false)} className="rounded-xl bg-brand py-2.5 text-center text-sm font-semibold text-white">Parier</Link>
            </div>
          </section>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 rounded-2xl bg-ink px-4 py-2.5 text-left text-white shadow-lg">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-brand px-1.5 text-sm font-bold tabular-nums">{legs.length}</span>
          <span className="flex-1 text-sm font-medium">{legs.length > 1 ? "Combiné" : "Simple"} · cote <b className="tabular-nums">{C(cote)}</b>{p !== null && <span className="text-white/70"> · passe {p >= 0.1 ? Math.round(p * 100) : (p * 100).toFixed(1).replace(".", ",")} %</span>}</span>
          <span className="text-xs text-white/70">{open ? "Fermer ▾" : "Voir ▴"}</span>
        </button>
      </div>
    </>
  );
}

/** Met tout un combiné proposé dans le coupon (remplace les sélections des mêmes matchs). */
export function AddAllToSlip({ legs, className }: { legs: Leg[]; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => { slip.addMany(legs); setDone(true); }} className={className ?? "rounded-lg border border-brand/40 px-2.5 py-1.5 text-xs font-medium text-brand"}>
      {done ? "✓ Au coupon" : "+ Coupon"}
    </button>
  );
}
