"use client";

import { useState } from "react";

export type LinePoint = { at: string; y: number; delta: number; libelle: string };

/** Courbe cumulée (une série) : ligne verte ou rouge selon le signe final, points par résultat, info au toucher. */
export function LineChart({ points, unit, empty }: { points: LinePoint[]; unit: string; empty: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="py-6 text-center text-xs text-ink-muted">{empty}</p>;
  const W = 640, H = 190, padL = 46, padR = 10, padT = 12, padB = 20;
  const step = (W - padL - padR) / (points.length - 1);
  const xs = points.map((_, i) => padL + i * step);
  const vals = [0, ...points.map((p) => p.y)];
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const y = (v: number) => padT + ((max - v) * (H - padT - padB)) / span;
  const path = points.map((p, i) => `${i ? "L" : "M"}${xs[i].toFixed(1)} ${y(p.y).toFixed(1)}`).join(" ");
  const last = points[points.length - 1].y;
  const col = last >= 0 ? "#1f8a5b" : "#c43d3d";
  const fmt = (v: number) => `${v > 0 ? "+" : ""}${Math.abs(v) >= 10000 ? `${Math.round(v / 1000)} k` : Math.round(v).toLocaleString("fr-FR")}`;
  const h = hover !== null ? points[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img" aria-label={`Résultat cumulé en ${unit}`}>
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeDasharray="3 3" />
        <text x={padL - 6} y={y(0) + 4} textAnchor="end" fontSize="11" fill="#64748b">0</text>
        {max > 0 && <text x={padL - 6} y={y(max) + 4} textAnchor="end" fontSize="11" fill="#64748b">{fmt(max)}</text>}
        {min < 0 && <text x={padL - 6} y={y(min) + 4} textAnchor="end" fontSize="11" fill="#64748b">{fmt(min)}</text>}
        <path d={`${path} L${xs[xs.length - 1]} ${y(0)} L${xs[0]} ${y(0)} Z`} fill={col} opacity="0.08" />
        <path d={path} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            {(points.length <= 40 || hover === i) && <circle cx={xs[i]} cy={y(p.y)} r={hover === i ? 5 : 3} fill={p.delta > 0 ? "#1f8a5b" : p.delta < 0 ? "#c43d3d" : "#b7791f"} stroke="#fff" strokeWidth="1.5" />}
            <rect x={xs[i] - step / 2} y={0} width={step} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)} />
          </g>
        ))}
      </svg>
      {h && (
        <div className="pointer-events-none absolute left-12 top-0 rounded-md border border-line bg-white px-2 py-1 text-[11px] shadow-card">
          <p className="font-medium">{h.libelle}</p>
          <p className="text-ink-muted">{new Date(h.at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", timeZone: "Africa/Abidjan" })} · {fmt(h.delta)} {unit} · cumul {fmt(h.y)} {unit}</p>
        </div>
      )}
    </div>
  );
}
