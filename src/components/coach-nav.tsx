import Link from "next/link";

/** Navigation du Coach (19/11) : tableau de bord, bankroll, outils. La conversation s'ouvre par Betster flottant. */
export function CoachNav({ current }: { current: "tableau" | "bankroll" | "outils" | "options" | "jour" }) {
  const actif = current === "tableau" ? "tableau" : current === "bankroll" ? "bankroll" : "outils";
  const items = [{ k: "tableau", t: "Tableau de bord", href: "/coach" }, { k: "bankroll", t: "Bankroll", href: "/bankroll" }, { k: "outils", t: "Outils", href: "/coach?v=outils" }] as const;
  return <SousNav items={items} actif={actif} label="Coach" />;
}

/** Navigation de Mes paris (19/11) : mes paris, ajouter (charger, saisir, simuler, communauté), sources. */
export function ParisNav({ current }: { current: "paris" | "ajouter" | "sources" }) {
  const items = [{ k: "paris", t: "Mes paris", href: "/paris" }, { k: "ajouter", t: "Ajouter", href: "/paris/ajouter" }, { k: "sources", t: "Sources", href: "/sources" }] as const;
  return <SousNav items={items} actif={current} label="Mes paris" />;
}

function SousNav({ items, actif, label }: { items: readonly { k: string; t: string; href: string }[]; actif: string; label: string }) {
  return (
    <nav className="mb-4 grid grid-cols-3 rounded-xl border border-line bg-surface-2 p-1 text-[13px] font-medium" aria-label={label}>
      {items.map((i) => <Link key={i.k} href={i.href} className={`truncate rounded-lg px-1 py-2 text-center ${actif === i.k ? "bg-surface font-semibold shadow-card" : "text-ink-muted"}`} aria-current={actif === i.k ? "page" : undefined}>{i.t}</Link>)}
    </nav>
  );
}
