"use client";
import { BetsterAnime } from "@/components/betster-anime";

/**
 * Betster flottant : toujours au même endroit (en bas à droite, au-dessus des onglets et du coupon), il ouvre la
 * conversation avec le Coach depuis n'importe quel écran. Masqué là où il gênerait : la conversation elle-même,
 * la saisie d'un pari ou d'un import.
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSlip } from "@/lib/slip/store";

export function BetsterFab() {
  const path = usePathname();
  const sp = useSearchParams();
  const legs = useSlip();
  const dansLaConversation = path === "/coach" && sp.get("v") === "discussion";
  if (dansLaConversation || ["/nouveau", "/import", "/reglages"].some((p) => path.startsWith(p))) return null;
  // Le coupon occupe une barre au-dessus des onglets : Betster remonte d'autant. La barre « Parier sur ce match »
  // (seulement avant le match) le fait remonter aussi, par une règle CSS (globals.css, data-barre-pari).
  const bas = legs.length ? 136 : 80;
  return (
    <div className="betster-fab-zone pointer-events-none fixed inset-x-0 z-30 mx-auto flex max-w-xl justify-end px-4" style={{ bottom: `calc(${bas}px + env(safe-area-inset-bottom))` }}>
      <Link href="/coach?v=discussion" aria-label="Parler à Betster"
        className="betster-fab pointer-events-auto relative block h-[58px] w-[58px] rounded-full shadow-lg shadow-brand/40 ring-2 ring-brand transition active:scale-95">
        <BetsterAnime etat="repos" taille={58} decoratif />
        <span aria-hidden className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-on-fill">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></svg>
        </span>
      </Link>
    </div>
  );
}
