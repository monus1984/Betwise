"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Prédictions", icon: TrendIcon, aussi: ["/reglages", "/notifications"] },
  { href: "/matchs", label: "Matchs", icon: BallIcon, aussi: [] },
  { href: "/paris", label: "Mes paris", icon: TicketIcon, aussi: ["/nouveau", "/import", "/sources", "/bilan"] },
  { href: "/coach", label: "Coach", icon: CoachIcon, aussi: ["/options", "/bankroll"] },
] as const;

/** Navigation principale (19/11, 15:54) : Prédictions (accueil), Matchs, Mes paris (avec les sources), Coach. La conversation passe par Betster flottant. Ajouter un pari ou importer se fait par le bouton flottant (AddFab). */
export function TabBar() {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigation principale"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4">
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
function TrendIcon() { return <svg {...P}><path d="M3 17l5-6 4 4 8-9" /><path d="M15 6h5v5" /></svg>; }
function BallIcon() { return <svg {...P}><circle cx="12" cy="12" r="9" /><path d="M12 7l3.5 2.5-1.3 4h-4.4l-1.3-4z" /><path d="M12 3v4M5.3 8.5l3.5 1M18.7 8.5l-3.5 1M7.8 17.5l2-4M16.2 17.5l-2-4" /></svg>; }
function TicketIcon() { return <svg {...P}><path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 100-4z" /><path d="M13 6v12" strokeDasharray="2 2" /></svg>; }
function CoachIcon() { return <svg {...P}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>; }
