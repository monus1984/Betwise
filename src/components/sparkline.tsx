/** Petite courbe sans axes, pour donner la tendance d'un coup d'œil. Rendue côté serveur, sans interaction. */
export function Sparkline({ values, className = "", label }: { values: number[]; className?: string; label: string }) {
  if (values.length < 2) return null;
  const W = 120, H = 44, min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, 4 + ((max - v) / span) * (H - 8)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const col = values[values.length - 1] >= values[0] ? "rgb(var(--c-gain))" : "rgb(var(--c-loss))";
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={label} preserveAspectRatio="none">
      <defs><linearGradient id="spark-fond" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={col} stopOpacity=".28" /><stop offset="1" stopColor={col} stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L${W} ${H} L0 ${H} Z`} fill="url(#spark-fond)" />
      <path d={d} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="2.5" fill={col} />
    </svg>
  );
}
