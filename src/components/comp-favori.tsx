"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Nom du cookie des compétitions favorites (codes séparés par des virgules). Pas de table : c'est une préférence d'affichage. */
export const COOKIE_FAVORIS = "bw_comps";

/** Épingle une compétition en haut de l'écran Matchs. */
export function CompFavori({ code, initial, nom }: { code: string; initial: boolean; nom: string }) {
  const [on, setOn] = useState(initial);
  const router = useRouter();
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const actuels = (document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_FAVORIS}=`))?.split("=")[1] ?? "").split(",").filter(Boolean);
    const next = !on;
    const liste = next ? [...new Set([...actuels, code])] : actuels.filter((c) => c !== code);
    document.cookie = `${COOKIE_FAVORIS}=${liste.join(",")}; path=/; max-age=${400 * 86400}; samesite=lax`;
    setOn(next);
    router.refresh();
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={on} aria-label={on ? `Retirer ${nom} de mes compétitions` : `Épingler ${nom} en haut`}
      className="flex h-10 w-10 shrink-0 items-center justify-center">
      <svg width={17} height={17} viewBox="0 0 24 24" className={on ? "text-band-draw" : "text-slate-300"} fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9 6.7 19.6l1-5.8L3.5 9.7l5.9-.9z" /></svg>
    </button>
  );
}
