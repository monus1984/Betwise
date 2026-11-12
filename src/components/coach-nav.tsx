import Link from "next/link";

/** Sous-navigation de la section Coach : tout le conseil au même endroit. */
export function CoachNav({ current }: { current: "jour" | "options" | "discussion" }) {
  const items = [{ k: "jour", t: "Aujourd’hui", href: "/coach" }, { k: "options", t: "Options du jour", href: "/options" }, { k: "discussion", t: "Discussion", href: "/coach?v=discussion" }] as const;
  return (
    <nav className="mb-4 grid grid-cols-3 rounded-xl border border-line bg-surface-2 p-1 text-[13px] font-medium" aria-label="Coach">
      {items.map((i) => <Link key={i.k} href={i.href} className={`truncate rounded-lg px-1 py-2 text-center ${current === i.k ? "bg-white shadow-card" : "text-ink-muted"}`} aria-current={current === i.k ? "page" : undefined}>{i.t}</Link>)}
    </nav>
  );
}
