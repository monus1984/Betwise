import Link from "next/link";

/** Sous-navigation du Coach : la discussion d'abord, les outils (budget, sélections du jour, tests) en retrait. */
export function CoachNav({ current }: { current: "discussion" | "outils" | "options" | "jour" | "paris" }) {
  const actif = current === "discussion" ? "discussion" : current === "paris" ? "paris" : "outils";
  // Mes paris quitte la barre d'onglets (D14, 19/11) : on y accède depuis le Coach
  const items = [{ k: "discussion", t: "Discussion", href: "/coach" }, { k: "outils", t: "Outils", href: "/coach?v=outils" }, { k: "paris", t: "Mes paris", href: "/paris" }] as const;
  return (
    <nav className="mb-4 grid grid-cols-3 rounded-xl border border-line bg-surface-2 p-1 text-[13px] font-medium" aria-label="Coach">
      {items.map((i) => <Link key={i.k} href={i.href} className={`truncate rounded-lg px-1 py-2 text-center ${actif === i.k ? "bg-surface shadow-card" : "text-ink-muted"}`} aria-current={actif === i.k ? "page" : undefined}>{i.t}</Link>)}
    </nav>
  );
}
