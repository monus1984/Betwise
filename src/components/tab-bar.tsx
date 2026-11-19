"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Accueil", icon: HomeIcon, aussi: ["/reglages", "/bankroll", "/notifications"] },
  { href: "/matchs", label: "Prédictions", icon: TrendIcon, aussi: [] },
  { href: "/paris", label: "Mes paris", icon: TicketIcon, aussi: ["/bilan", "/nouveau", "/import"] },
  { href: "/sources", label: "Tipsters", icon: UsersIcon, aussi: [] },
  { href: "/coach", label: "Coach", icon: CoachIcon, aussi: ["/options"] },
] as const;

/** Navigation principale : cinq destinations (ordre et noms validés le 19/11 : Prédictions, Tipsters). Ajouter un pari ou importer se fait par le bouton flottant (AddFab). */
export function TabBar() {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigation principale"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" || t.aussi.some((a) => path.startsWith(a)) : path.startsWith(t.href) || t.aussi.some((a) => path.startsWith(a));
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] transition-colors ${active ? "font-semibold text-brand" : "text-ink-muted"}`}
                aria-current={active ? "page" : undefined}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" />}
                <Icon />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, width: 24, height: 24, viewBox: "0 0 24 24" };
function HomeIcon() { return <svg {...P}><path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1z" /></svg>; }
function TicketIcon() { return <svg {...P}><path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 100-4z" /><path d="M13 6v12" strokeDasharray="2 2" /></svg>; }
function UsersIcon() { return <svg {...P}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.5a5 5 0 015.5 5.5" /></svg>; }
function TrendIcon() { return <svg {...P}><path d="M3 17l5-6 4 4 8-9" /><path d="M15 6h5v5" /></svg>; }
function CoachIcon() { return <svg {...P}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>; }
