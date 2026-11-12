"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global { interface Window { __bwInstall?: InstallEvent | null } }

/**
 * Bouton « Installer BETWISE ». Android (Chrome, Edge, Samsung) : ouvre la fenêtre d'installation du navigateur.
 * iPhone : Apple ne permet pas d'installer par un bouton, on montre les deux gestes à faire dans Safari.
 * Rien ne s'affiche quand l'appli est déjà installée.
 */
export function InstallButton({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<"cache" | "android" | "ios" | "autre">("cache");
  const [help, setHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    try { if (localStorage.getItem("betwise.install.non") === "1") setDismissed(true); } catch { /* ignore */ }
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    if (ios) { setMode("ios"); return; }
    if (window.__bwInstall) setMode("android");
    else if (/android/i.test(ua)) setMode("autre"); // Android sans proposition du navigateur : on explique le menu
    const onPrompt = (e: Event) => { e.preventDefault(); window.__bwInstall = e as InstallEvent; setMode("android"); };
    const onInstalled = () => { window.__bwInstall = null; setMode("cache"); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (mode === "cache" || (dismissed && !compact)) return null;

  async function install() {
    const ev = window.__bwInstall;
    if (mode === "android" && ev) {
      await ev.prompt();
      const r = await ev.userChoice.catch(() => null);
      window.__bwInstall = null;
      if (r?.outcome === "accepted") setMode("cache");
      return;
    }
    setHelp((h) => !h);
  }
  function later() { setDismissed(true); try { localStorage.setItem("betwise.install.non", "1"); } catch { /* ignore */ } }

  const steps = mode === "ios"
    ? ["Ouvre BETWISE dans Safari (pas dans une autre appli).", "Touche le bouton Partager, le carré avec une flèche vers le haut.", "Choisis « Sur l’écran d’accueil », puis « Ajouter »."]
    : ["Ouvre le menu du navigateur, les trois points en haut à droite.", "Choisis « Installer l’application » ou « Ajouter à l’écran d’accueil »."];

  if (compact) {
    return (
      <div className="text-center">
        <button type="button" onClick={install} className="text-sm font-medium text-brand underline">📲 Installer BETWISE sur ce téléphone</button>
        {help && <ol className="mx-auto mt-2 max-w-xs list-decimal space-y-1 pl-5 text-left text-xs text-slate-600">{steps.map((s) => <li key={s}>{s}</li>)}</ol>}
      </div>
    );
  }
  return (
    <section className="mb-3 rounded-xl border border-brand/30 bg-brand/5 p-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">📲</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Installer BETWISE</span>
          <span className="block text-[11px] text-ink-muted">Une icône sur l’écran d’accueil, le plein écran et les notifications.</span>
        </span>
        <button type="button" onClick={install} className="shrink-0 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white">{mode === "android" ? "Installer" : "Comment faire"}</button>
      </div>
      {help && <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-ink-soft">{steps.map((s) => <li key={s}>{s}</li>)}</ol>}
      <button type="button" onClick={later} className="mt-1.5 text-[11px] text-ink-muted underline">Plus tard</button>
    </section>
  );
}
