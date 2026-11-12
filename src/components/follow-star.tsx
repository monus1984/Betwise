"use client";

import { useState, useTransition } from "react";
import { toggleFollowMatch, toggleFollowTeam } from "@/lib/matches/actions";

/** Étoile de suivi d'un match. `light` : sur fond sombre (tableau d'affichage). */
export function FollowStar({ matchId, teamId, initial, light, label, small }: { matchId?: string; teamId?: string; initial: boolean; light?: boolean; label?: boolean; small?: boolean }) {
  const [on, setOn] = useState(initial);
  const [, start] = useTransition();
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const next = !on; setOn(next);
    start(async () => { const r = teamId ? await toggleFollowTeam(teamId, next) : await toggleFollowMatch(matchId!, next); if (!r.ok) setOn(!next); });
  };
  const color = on ? "text-amber-400" : light ? "text-white/70" : "text-slate-300";
  return (
    <button type="button" onClick={toggle} aria-pressed={on} aria-label={teamId ? (on ? "Ne plus suivre cette équipe" : "Suivre cette équipe") : on ? "Ne plus suivre ce match" : "Suivre ce match"}
      className={`flex shrink-0 items-center gap-1.5 ${label ? "rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-xs text-white" : small ? "h-6 w-6 justify-center" : "h-9 w-8 justify-center"}`}>
      <svg width={small ? 16 : 20} height={small ? 16 : 20} viewBox="0 0 24 24" className={color} fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9 6.7 19.6l1-5.8L3.5 9.7l5.9-.9z" /></svg>
      {label && <span>{on ? "Suivi" : "Suivre"}</span>}
    </button>
  );
}
