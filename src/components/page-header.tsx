import type { ReactNode } from "react";

/** Bandeau de page : le terrain, pleine largeur, avec le titre en lettres de tableau d'affichage. */
export function PageHeader({ title, subtitle, action, tall, photo }: { title: string; subtitle?: string; action?: ReactNode; tall?: boolean; photo?: boolean }) {
  return (
    <header className={`pitch ${photo ? "pitch-photo" : ""} -mx-4 -mt-[max(1.25rem,env(safe-area-inset-top))] mb-4 flex items-end justify-between gap-3 rounded-b-[28px] px-4 ${tall ? (photo ? "pb-16" : "pb-14") : "pb-5"} ${photo ? "pt-[calc(max(1.25rem,env(safe-area-inset-top))+2rem)]" : "pt-[calc(max(1.25rem,env(safe-area-inset-top))+0.5rem)]"}`}>
      <div className="min-w-0">
        <h1 className="font-display text-[34px] font-bold leading-[1.02]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[34ch] text-[13px] leading-snug text-white/75">{subtitle}</p>}
      </div>
      {action && <div className="page-action shrink-0">{action}</div>}
    </header>
  );
}
