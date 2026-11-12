"use client";

import { useEffect, useRef, useState } from "react";

export type LiveScore = { id: string; label: string; h: number; a: number };

/**
 * Appli ouverte pendant un match : quand un score augmente au rafraîchissement, un court signal sonore et un bandeau « But ! ».
 * Le son se coupe d'un toucher (mémorisé sur ce téléphone).
 */
export function GoalWatcher({ scores }: { scores: LiveScore[] }) {
  const prev = useRef<Map<string, number> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sound, setSound] = useState(true);
  useEffect(() => { try { setSound(localStorage.getItem("betwise.son") !== "0"); } catch { /* ignore */ } }, []);
  useEffect(() => {
    const now = new Map(scores.map((s) => [s.id, s.h + s.a]));
    if (prev.current) {
      const goal = scores.find((s) => prev.current!.has(s.id) && s.h + s.a > (prev.current!.get(s.id) ?? 0));
      if (goal) { setToast(`⚽ But ! ${goal.label}`); if (sound) beep(); }
    }
    prev.current = now;
  }, [scores, sound]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);
  const toggle = () => { const v = !sound; setSound(v); try { localStorage.setItem("betwise.son", v ? "1" : "0"); } catch { /* ignore */ } if (v) beep(); };

  if (!scores.length) return null;
  return (
    <>
      <button type="button" onClick={toggle} aria-pressed={sound} className="mb-3 rounded-full border border-line bg-white px-3 py-1 text-[11px] text-ink-soft">{sound ? "🔊 Son des buts activé" : "🔈 Son des buts coupé"}</button>
      {toast && <div role="status" className="fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-40 mx-auto w-fit max-w-[92vw] rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-xl">{toast}</div>}
    </>
  );
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [660, 880, 1100].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.25);
    });
    setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch { /* son indisponible */ }
}
