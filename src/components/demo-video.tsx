"use client";

import { useEffect, useState } from "react";

/**
 * Vidéo de démonstration (1 min 30, 6 Mo, voix Google de l'application). Rien n'est téléchargé avant le toucher :
 * les testeurs sont souvent sur leur forfait mobile. Les matchs et chiffres de la vidéo sont des exemples.
 */
export function DemoVideo({ clair, onOuvre }: { clair?: boolean; onOuvre?: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => {
    if (!ouvert) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [ouvert]);
  return (
    <>
      <button type="button" onClick={() => { onOuvre?.(); setOuvert(true); }}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${clair ? "border-line bg-surface-2 text-ink" : "border-white/30 bg-white/10 text-white"}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
        Voir la démo · 1 min 30
      </button>
      {ouvert && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4" role="dialog" aria-modal="true" aria-label="Vidéo de démonstration" onClick={() => setOuvert(false)}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- la vidéo est sous-titrée à l'image */}
          <video src="/demo/betwise-demo.mp4" poster="/demo/betwise-demo.jpg" controls playsInline autoPlay preload="metadata"
            className="max-h-[76dvh] w-auto max-w-full rounded-2xl" onClick={(e) => e.stopPropagation()} />
          <p className="mt-3 max-w-xs text-center text-xs text-white/70">Les matchs et les chiffres montrés sont des exemples. Vidéo de 6 Mo.</p>
          <button type="button" onClick={() => setOuvert(false)} className="mt-3 rounded-full border border-white/30 px-5 py-2 text-sm text-white">Fermer</button>
        </div>
      )}
    </>
  );
}
