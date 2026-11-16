"use client";

import { useEffect, useState } from "react";

type Choix = "auto" | "light" | "dark";
const OPTIONS: [Choix, string][] = [["auto", "Comme le téléphone"], ["light", "Clair"], ["dark", "Sombre"]];

/** Choix du thème. Gardé sur ce téléphone seulement : rien n'est envoyé au serveur. */
export function ThemeChoice() {
  const [choix, setChoix] = useState<Choix>("auto");
  useEffect(() => {
    try { const t = localStorage.getItem("bw-theme"); if (t === "light" || t === "dark") setChoix(t); } catch { /* stockage indisponible : on reste sur le thème du téléphone */ }
  }, []);
  const choisir = (c: Choix) => {
    setChoix(c);
    const root = document.documentElement;
    if (c === "auto") delete root.dataset.theme; else root.dataset.theme = c;
    try { if (c === "auto") localStorage.removeItem("bw-theme"); else localStorage.setItem("bw-theme", c); } catch { /* le choix vaudra pour cette visite */ }
  };
  return (
    <div role="radiogroup" aria-label="Thème" className="flex gap-2">
      {OPTIONS.map(([c, mot]) => (
        <button key={c} type="button" role="radio" aria-checked={choix === c} onClick={() => choisir(c)}
          className={`flex-1 rounded-full border px-2 py-2 text-[13px] leading-tight ${choix === c ? "border-inverse bg-inverse text-on-inverse" : "border-line bg-surface text-ink-soft"}`}>
          {mot}
        </button>
      ))}
    </div>
  );
}
