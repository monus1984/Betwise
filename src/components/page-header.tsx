import type { ReactNode } from "react";

/** Bandeau de page : bleu nuit dans les deux thèmes, pleine largeur. */
export function PageHeader({ title, subtitle, action, tall }: { title: string; subtitle?: string; action?: ReactNode; tall?: boolean }) {
  return (
    <header className={`pitch -mx-4 -mt-[max(1.25rem,env(safe-area-inset-top))] mb-4 flex items-end justify-between gap-3 rounded-b-3xl px-4 ${tall ? "pb-14" : "pb-5"} pt-[calc(max(1.25rem,env(safe-area-inset-top))+0.5rem)]`}>
      <div className="min-w-0">
        <h1 className="truncate text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-[36ch] text-[13px] leading-snug text-white/75">{subtitle}</p>}
      </div>
      {action && <div className="page-action shrink-0">{action}</div>}
    </header>
  );
}
