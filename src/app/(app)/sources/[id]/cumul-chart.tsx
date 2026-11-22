"use client";

import { useState } from "react";

export type CumulPoint = { at: string; gain: number; cumul: number; resultat: string; libelle: string };

/** Rendement cumulé en unités (mise fixe 1) : une ligne, points verts/rouges, survol. */
export function CumulChart({ points }: { points: CumulPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="text-xs text-slate-500">La courbe apparaît à partir de deux pronos réglés avec cote.</p>;

  const W = 640, H = 200, padL = 36, padR = 12, padT = 12, padB = 24;
  const xs = points.map((_, i) => padL + (i * (W - padL - padR)) / (points.length - 1));
  const vals = [0, ...points.map((p) => Number(p.cumul))];
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const y = (v: number) => padT + ((max - v) * (H - padT - padB)) / span;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${xs[i].toFixed(1)} ${y(Number(p.cumul)).toFixed(1)}`).join(" ");
  const last = Number(points[points.length - 1].cumul);
  const h = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full" role="img" aria-label="Rendement cumulé en unités">
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="rgb(var(--c-line))" strokeDasharray="3 3" />
        <text x={padL - 6} y={y(0) + 4} textAnchor="end" fontSize="10" fill="rgb(var(--c-ink-muted))">0</text>
        <text x={padL - 6} y={y(max) + 4} textAnchor="end" fontSize="10" fill="rgb(var(--c-ink-muted))">{max > 0 ? `+${max.toFixed(1).replace(".", ",")}` : max.toFixed(1).replace(".", ",")}</text>
        {min < 0 && <text x={padL - 6} y={y(min) + 4} textAnchor="end" fontSize="10" fill="rgb(var(--c-ink-muted))">{min.toFixed(1).replace(".", ",")}</text>}
        <path d={path} fill="none" stroke={last >= 0 ? "rgb(var(--c-gain))" : "rgb(var(--c-loss))"} strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={xs[i]} cy={y(Number(p.cumul))} r={hover === i ? 5 : 3} fill={p.resultat === "gagne" ? "rgb(var(--c-gain))" : p.resultat === "perdu" ? "rgb(var(--c-loss))" : "rgb(var(--c-draw))"} stroke="#fff" strokeWidth="1.5" />
            <rect x={xs[i] - (W - padL - padR) / (points.length - 1) / 2} y={0} width={(W - padL - padR) / (points.length - 1)} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)} />
          </g>
        ))}
        <text x={W - padR} y={H - 6} textAnchor="end" fontSize="10" fill="rgb(var(--c-ink-muted))">{points.length} pronos · unités</text>
      </svg>
      {h && (
        <div className="pointer-events-none absolute left-0 top-0 rounded-md border border-slate-200 bg-surface px-2 py-1 text-[11px] shadow">
          <p className="font-medium">{h.libelle}</p>
          <p className="text-slate-600">{new Date(h.at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", timeZone: "Africa/Abidjan" })} · {h.resultat === "gagne" ? `+${Number(h.gain).toFixed(2).replace(".", ",")}` : h.resultat === "perdu" ? "−1" : "0"} · cumul {Number(h.cumul) >= 0 ? "+" : ""}{Number(h.cumul).toFixed(2).replace(".", ",")}</p>
        </div>
      )}
    </div>
  );
}
