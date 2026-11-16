"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSlip } from "@/lib/slip/store";

const CHOIX = [
  { href: "/import", titre: "Importer un ticket ou des pronos", texte: "Capture, vidéo d’écran ou texte collé" },
  { href: "/nouveau", titre: "Saisir un pari", texte: "Simple ou combiné, enregistré dans ta bankroll" },
  { href: "/nouveau?test=1", titre: "Tester sans miser", texte: "Suivi comme un pari, sans toucher à ta bankroll" },
];

/** Bouton « + » flottant : les trois façons d'ajouter quelque chose. Il s'efface quand le coupon est ouvert ou qu'on saisit déjà. */
export function AddFab() {
  const path = usePathname();
  const legs = useSlip();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  if (legs.length || ["/nouveau", "/import", "/coach", "/options", "/reglages"].some((p) => path.startsWith(p)) || /^\/paris\/./.test(path)) return null;
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setOpen(false)} aria-hidden />}
      <div className="pointer-events-none fixed inset-x-0 z-30 mx-auto flex max-w-xl flex-col items-end gap-2 px-4" style={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}>
        {open && (
          <ul className="pointer-events-auto w-full max-w-xs overflow-hidden rounded-2xl border border-line bg-white shadow-xl" aria-label="Ajouter">
            {CHOIX.map((c) => (
              <li key={c.href} className="border-t border-line first:border-t-0">
                <Link href={c.href} className="block px-4 py-3 active:bg-surface-2"><span className="block text-sm font-semibold">{c.titre}</span><span className="block text-[12px] text-ink-muted">{c.texte}</span></Link>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Fermer" : "Ajouter un pari, un test ou un import"}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/40 transition active:scale-95">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className={`transition-transform ${open ? "rotate-45" : ""}`} aria-hidden><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
    </>
  );
}
