"use client";
/**
 * Animation du portrait de Betster (19/11) : une image fixe mise en mouvement, pas un personnage incarné (voir
 * docs/brand/betster/etude-avatar-reel.md sur la branche design-accueil pour la cible). Le portrait validé n'est pas retouché.
 * Repos : il respire et balance légèrement la tête. Pense : il penche la tête, un anneau tourne.
 * Parle : il bouge au rythme réel de la voix du Coach (niveau sonore), ou à un rythme régulier avec la voix du téléphone.
 * Tout s'arrête si l'utilisateur a demandé moins d'animations.
 */
import { useEffect, useRef } from "react";
import { niveauVoix } from "@/lib/coach/speak";

export type EtatBetster = "repos" | "pense" | "parle";
const LIBELLE: Record<EtatBetster, string> = { repos: "Betster", pense: "Betster consulte tes données", parle: "Betster parle" };

export function BetsterAnime({ etat, taille = 64, decoratif = false }: { etat: EtatBetster; taille?: number; decoratif?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || etat !== "parle") return;
    let id = 0, lisse = 0;
    const tour = () => {
      const n = niveauVoix();
      if (n === null) el.removeAttribute("data-voix");
      else { el.setAttribute("data-voix", ""); lisse = lisse * 0.55 + n * 0.45; el.style.setProperty("--niveau", lisse.toFixed(3)); }
      id = requestAnimationFrame(tour);
    };
    id = requestAnimationFrame(tour);
    return () => { cancelAnimationFrame(id); el.removeAttribute("data-voix"); el.style.removeProperty("--niveau"); };
  }, [etat]);
  return (
    <span ref={ref} className="betster-anime relative inline-flex shrink-0 rounded-full" data-etat={etat}
      {...(decoratif ? { "aria-hidden": true } : { role: "img", "aria-label": LIBELLE[etat] })} style={{ width: taille, height: taille }}>
      <span aria-hidden className="betster-anneau absolute -inset-[5px] rounded-full" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/betster/betster-112.webp" alt="" width={taille} height={taille} className="betster-portrait relative h-full w-full rounded-full ring-2 ring-brand/70" />
    </span>
  );
}
