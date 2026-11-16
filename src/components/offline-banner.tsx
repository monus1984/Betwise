"use client";

import { useEffect, useState } from "react";

/** Prévient quand le téléphone n'a plus de réseau : ce qui est affiché peut dater, et rien ne s'enregistre. */
export function OfflineBanner() {
  const [off, setOff] = useState(false);
  useEffect(() => {
    const maj = () => setOff(!navigator.onLine);
    maj();
    window.addEventListener("online", maj);
    window.addEventListener("offline", maj);
    return () => { window.removeEventListener("online", maj); window.removeEventListener("offline", maj); };
  }, []);
  if (!off) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 bg-draw-soft px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-[13px] font-medium text-draw-ink">
      Pas de connexion. Ce que tu vois peut dater, et rien ne sera enregistré tant que le réseau n’est pas revenu.
    </div>
  );
}
