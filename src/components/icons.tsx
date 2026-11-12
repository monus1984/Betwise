import type { ReactNode, SVGProps } from "react";

/** Icônes au trait de BETWISE, et pastilles colorées selon le contexte (conseil, test, alerte…). */
const S = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;
type P = SVGProps<SVGSVGElement>;
export const IconCompass = (p: P) => <svg {...S} {...p}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>;
export const IconTarget = (p: P) => <svg {...S} {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>;
export const IconFlask = (p: P) => <svg {...S} {...p}><path d="M9.5 3h5M10 3v6.2L4.8 18a2 2 0 001.7 3h11a2 2 0 001.7-3L14 9.2V3" /><path d="M7.5 15h9" /></svg>;
export const IconChat = (p: P) => <svg {...S} {...p}><path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z" /><path d="M8 9.5h8M8 12.5h5" /></svg>;
export const IconCamera = (p: P) => <svg {...S} {...p}><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.4" /></svg>;
export const IconBell = (p: P) => <svg {...S} {...p}><path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15z" /><path d="M10 21h4" /></svg>;
export const IconPhone = (p: P) => <svg {...S} {...p}><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M12 8v7M9 12.5l3 3 3-3" /></svg>;
export const IconBolt = (p: P) => <svg {...S} {...p}><path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" /></svg>;
export const IconShield = (p: P) => <svg {...S} {...p}><path d="M12 3l7.5 3v5.5c0 4.5-3 8-7.5 9.5-4.5-1.5-7.5-5-7.5-9.5V6z" /><path d="M8.8 12l2.2 2.2 4.2-4.4" /></svg>;
export const IconFlame = (p: P) => <svg {...S} {...p}><path d="M12 21c-3.6 0-6.5-2.7-6.5-6.3 0-2.7 1.7-4.3 3-6 .5 1.6 1.3 2.3 2.2 2.8C10.4 8 11.5 5 14 3c.2 3 1.5 4.5 2.8 6.2 1 1.3 1.7 2.9 1.7 5.5 0 3.6-2.9 6.3-6.5 6.3z" /></svg>;
export const IconWallet = (p: P) => <svg {...S} {...p}><path d="M4 7.5h14.5a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18z" /><path d="M4 7.5V6a1.5 1.5 0 011.5-1.5H16" /><circle cx="16" cy="13.5" r="1.2" fill="currentColor" /></svg>;

const TONES = {
  conseil: "bg-brand-soft text-brand", test: "bg-violet-100 text-violet-700", alerte: "bg-amber-100 text-amber-700", info: "bg-sky-100 text-sky-700",
  gain: "bg-emerald-100 text-gain", terrain: "bg-pitch text-white", neutre: "bg-surface-2 text-ink-soft", perte: "bg-red-100 text-loss",
} as const;
export type Tone = keyof typeof TONES;
/** Pastille d'icône : la couleur dit de quoi il s'agit avant qu'on lise. */
export function IconTile({ tone = "neutre", children, size = "md" }: { tone?: Tone; children: ReactNode; size?: "sm" | "md" }) {
  return <span className={`flex shrink-0 items-center justify-center rounded-xl ${size === "sm" ? "h-8 w-8" : "h-10 w-10"} ${TONES[tone]}`}>{children}</span>;
}

/** Le signe BETWISE : le rond central et la ligne médiane d'un terrain, le ballon orange au centre. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="12" fill="#0a2b22" />
      <path d="M24 4v40" stroke="#fff" strokeOpacity=".55" strokeWidth="2" />
      <circle cx="24" cy="24" r="12.5" fill="none" stroke="#fff" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="5" fill="#f26a1b" />
    </svg>
  );
}
