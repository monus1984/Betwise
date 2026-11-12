"use client";

import { useSyncExternalStore } from "react";

/**
 * Coupon en cours (comme le panier de Betclic ou 1xBet) : gardé dans le navigateur, partagé par toutes les pages.
 * Une sélection par match : les bookmakers refusent deux paris liés du même match ; pour combiner sur un match,
 * il faut un marché combiné (« Sénégal ou nul et plus de 1,5 but »), qui compte pour une sélection.
 */
export type Leg = {
  matchId: string; home: string; away: string; kickoff: string; comp: string;
  market: string; param: number | null; sel: string; label: string;
  cote: number; estimee: boolean; p: number | null;
};

const KEY = "betwise.coupon";
let legs: Leg[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { const raw = localStorage.getItem(KEY); if (raw) legs = (JSON.parse(raw) as Leg[]).filter((l) => Date.parse(l.kickoff) > Date.now() - 2 * 3600000); } catch { legs = []; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(legs)); } catch { /* navigation privée : le coupon vit le temps de la page */ }
  listeners.forEach((f) => f());
}
const sameSel = (a: Pick<Leg, "matchId" | "market" | "param" | "sel">, b: Pick<Leg, "matchId" | "market" | "param" | "sel">) =>
  a.matchId === b.matchId && a.market === b.market && (a.param ?? null) === (b.param ?? null) && a.sel === b.sel;

export const slip = {
  get: () => { load(); return legs; },
  has: (l: Pick<Leg, "matchId" | "market" | "param" | "sel">) => slip.get().some((x) => sameSel(x, l)),
  /** Ajoute, retire si déjà présent, ou remplace la sélection du même match. */
  toggle(l: Leg): "ajoute" | "retire" | "remplace" {
    load();
    if (legs.some((x) => sameSel(x, l))) { legs = legs.filter((x) => !sameSel(x, l)); save(); return "retire"; }
    const replaced = legs.some((x) => x.matchId === l.matchId);
    legs = [...legs.filter((x) => x.matchId !== l.matchId), l].slice(-20);
    save();
    return replaced ? "remplace" : "ajoute";
  },
  addMany(ls: Leg[]) { load(); const ids = new Set(ls.map((l) => l.matchId)); legs = [...legs.filter((x) => !ids.has(x.matchId)), ...ls].slice(-20); save(); },
  remove(matchId: string) { load(); legs = legs.filter((x) => x.matchId !== matchId); save(); },
  clear() { legs = []; save(); },
  subscribe(f: () => void) {
    listeners.add(f);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) { loaded = false; load(); f(); } };
    window.addEventListener("storage", onStorage);
    return () => { listeners.delete(f); window.removeEventListener("storage", onStorage); };
  },
};

const EMPTY: Leg[] = [];
export function useSlip(): Leg[] {
  return useSyncExternalStore(slip.subscribe, slip.get, () => EMPTY);
}

/** Lien de saisie préremplie à partir du coupon (format de /nouveau?legs=). */
export function slipHref(ls: Leg[], test: boolean) {
  const legsParam = ls.map((l) => [l.matchId, l.market, l.param ?? "", l.sel, l.cote.toFixed(2)].join("~")).join(",");
  return `/nouveau?${new URLSearchParams({ legs: legsParam, from: "coupon", ...(test ? { test: "1" } : {}) }).toString()}`;
}
