"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Accueil", icon: HomeIcon },
  { href: "/matchs", label: "Matchs", icon: BallIcon },
  { href: "/paris", label: "Paris", icon: TicketIcon },
  { href: "/nouveau", label: "", icon: PlusIcon, central: true },
  { href: "/sources", label: "Sources", icon: UsersIcon },
  { href: "/coach", label: "Coach", icon: CoachIcon },
] as const;

export function TabBar() {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigation principale"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-6">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href) || (t.href === "/coach" && path.startsWith("/options"));
          const Icon = t.icon;
          if ("central" in t && t.central) {
            return (
              <li key={t.href} className="flex items-center justify-center">
                <Link
                  href={t.href}
                  aria-label="Ajouter un pari ou un prono"
                  className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 transition active:scale-95"
                >
                  <Icon />
                </Link>
              </li>
            );
          }
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
function BallIcon() { return <svg {...P}><circle cx="12" cy="12" r="9" /><path d="M12 7l3.5 2.5-1.3 4h-4.4l-1.3-4z" /><path d="M12 3v4M5.3 8.5l3.5 1M18.7 8.5l-3.5 1M7.8 17.5l2-4M16.2 17.5l-2-4" /></svg>; }
function CoachIcon() { return <svg {...P}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>; }
function PlusIcon() { return <svg {...P} strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>; }
