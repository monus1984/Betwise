"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Rafraîchit les données de la page à intervalle régulier tant qu'un match est en cours (onglet visible uniquement). */
export function LiveRefresh({ active, seconds = 45 }: { active: boolean; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    return () => clearInterval(t);
  }, [active, seconds, router]);
  return null;
}
