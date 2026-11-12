"use client";

import { useEffect, useState, useTransition } from "react";
import { setNotifPref, type NotifPrefs } from "@/lib/push/actions";

const TYPES: { k: keyof NotifPrefs; t: string; d: string }[] = [
  { k: "resultats", t: "Résultat de mes paris et tests", d: "Dès qu’un pari ou un test est réglé." },
  { k: "coup_envoi", t: "Coup d’envoi", d: "30 minutes avant un match de mes paris en cours." },
  { k: "coups_du_jour", t: "Coups du jour", d: "Le matin, quand les sélections du jour sont prêtes." },
  { k: "sources", t: "Sources suivies", d: "Quand un tipster que je suis publie de nouveaux pronos." },
];
const b64ToBytes = (s: string) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };

/** Réglage des notifications sur ce téléphone : activation, types, test. */
export function NotificationsCard({ prefs }: { prefs: NotifPrefs }) {
  const [state, setState] = useState<"chargement" | "indisponible" | "refuse" | "inactif" | "actif">("chargement");
  const [p, setP] = useState(prefs);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const ios = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installe = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setState("indisponible"); return; }
      if (Notification.permission === "denied") { setState("refuse"); return; }
      try { const reg = await navigator.serviceWorker.ready; setState((await reg.pushManager.getSubscription()) ? "actif" : "inactif"); }
      catch { setState("inactif"); }
    })();
  }, []);

  async function activer() {
    setBusy(true); setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "refuse" : "inactif"); return; }
      const k = await (await fetch("/api/push")).json();
      if (!k.publicKey) throw new Error(k.error ?? "clé indisponible");
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(k.publicKey) }));
      const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), test: true }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "abonnement impossible");
      setState("actif"); setMsg("Activé : une notification de test vient de partir.");
    } catch (e) {
      setMsg(`Activation impossible${e instanceof Error && e.message ? ` : ${e.message}` : ""}.`);
    } finally { setBusy(false); }
  }
  async function couper() {
    setBusy(true); setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
      if (sub) { await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
      setState("inactif");
    } finally { setBusy(false); }
  }
  async function tester() {
    setBusy(true); setMsg(null);
    try { const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test: true }) }); const j = await r.json(); setMsg(r.ok ? "Test envoyé." : j.error ?? "Échec du test."); }
    finally { setBusy(false); }
  }
  function toggle(k: keyof NotifPrefs) { const on = !p[k]; setP({ ...p, [k]: on }); start(async () => { const r = await setNotifPref(k, on); if (!r.ok) setP((x) => ({ ...x, [k]: !on })); }); }

  return (
    <details className="mt-3 rounded-xl border border-line bg-white p-4" open={state === "inactif"}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
        <span>🔔 Notifications</span>
        <span className={`text-xs font-normal ${state === "actif" ? "text-gain" : "text-ink-muted"}`}>{state === "actif" ? "activées sur ce téléphone" : state === "chargement" ? "…" : "désactivées"}</span>
      </summary>
      <div className="mt-3 space-y-3">
        {state === "indisponible" && (
          <p className="text-xs leading-relaxed text-ink-muted">
            {ios && !installe ? "Sur iPhone, les notifications ne marchent que si BETWISE est installée sur l’écran d’accueil : dans Safari, touche Partager puis « Sur l’écran d’accueil », ouvre BETWISE depuis cette icône et reviens ici." : "Ce navigateur ne permet pas les notifications. Sur Android, utilise Chrome ; sur iPhone, installe BETWISE sur l’écran d’accueil (iOS 16.4 ou plus récent)."}
          </p>
        )}
        {state === "refuse" && <p className="text-xs leading-relaxed text-ink-muted">Les notifications sont bloquées pour BETWISE sur ce téléphone. Autorise-les dans les réglages du navigateur (ou de l’application), puis reviens ici.</p>}
        {state === "inactif" && <button type="button" onClick={activer} disabled={busy} className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Activation…" : "Activer sur ce téléphone"}</button>}
        {(state === "actif" || state === "inactif") && (
          <ul className="divide-y divide-line">
            {TYPES.map((t) => (
              <li key={t.k} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1"><span className="block text-sm">{t.t}</span><span className="block text-[11px] text-ink-muted">{t.d}</span></span>
                <button type="button" role="switch" aria-checked={p[t.k]} aria-label={t.t} onClick={() => toggle(t.k)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${p[t.k] ? "bg-brand" : "bg-slate-300"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${p[t.k] ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {state === "actif" && (
          <div className="flex gap-2">
            <button type="button" onClick={tester} disabled={busy} className="flex-1 rounded-lg border border-line py-2 text-xs font-medium">Envoyer un test</button>
            <button type="button" onClick={couper} disabled={busy} className="flex-1 rounded-lg border border-line py-2 text-xs text-ink-muted">Désactiver sur ce téléphone</button>
          </div>
        )}
        {msg && <p className="text-xs text-ink-soft">{msg}</p>}
        <p className="text-[11px] leading-relaxed text-ink-muted">Aucun montant n’apparaît dans une notification : elle peut s’afficher sur l’écran verrouillé.</p>
      </div>
    </details>
  );
}
