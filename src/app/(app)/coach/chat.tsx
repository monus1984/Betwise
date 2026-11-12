"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Notice } from "@/components/ui";
import { pickVoice, spoken } from "@/lib/coach/voice";

export type ChatMsg = { id?: string; role: "user" | "assistant"; text: string; fonctions?: string[] };

const FN_LABEL: Record<string, string> = {
  options_du_jour: "options du jour", combine_cible: "combiné à cote visée", mes_tests: "tes tests", mon_objectif: "ton objectif", simuler_objectif: "simulation d’objectif", fixer_objectif: "objectif enregistré", coups_du_jour: "coups du jour", bilan_paris: "bilan des paris", bilan_par_origine: "réussite par origine", etat_bankroll: "état de la bankroll",
  paris_en_cours: "paris en cours", sources_suivies: "sources suivies", detail_source: "détail d’une source", analyse_match: "analyse de match",
};

export function CoachChat({ initialId, initial, suggestions }: { initialId: string | null; initial: ChatMsg[]; suggestions: string[] }) {
  const [id, setId] = useState(initialId);
  const [msgs, setMsgs] = useState<ChatMsg[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);
  // Voix : dictée de la question (reconnaissance vocale du téléphone) et lecture des réponses à voix haute
  const [listening, setListening] = useState(false);
  const [voiceOut, setVoiceOut] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  const voiceOutRef = useRef(false);
  useEffect(() => {
    setCanListen(!!recCtor());
    setCanSpeak("speechSynthesis" in window);
    try { window.speechSynthesis?.getVoices(); } catch { /* la liste des voix se charge en arrière-plan */ }
    try { const on = localStorage.getItem("betwise.coach.voix") === "1"; setVoiceOut(on); voiceOutRef.current = on; } catch { /* ignore */ }
    return () => { try { rec.current?.abort(); window.speechSynthesis?.cancel(); } catch { /* ignore */ } };
  }, []);
  function setVoice(on: boolean) {
    setVoiceOut(on); voiceOutRef.current = on;
    try { localStorage.setItem("betwise.coach.voix", on ? "1" : "0"); } catch { /* ignore */ }
    if (on) unlockSpeech(); else window.speechSynthesis?.cancel();
  }
  function listen() {
    const Ctor = recCtor();
    if (!Ctor || busy) return;
    if (listening) { rec.current?.stop(); return; }
    window.speechSynthesis?.cancel();
    unlockSpeech(); // sur iPhone, la lecture à voix haute doit être autorisée par un geste
    const r = new Ctor();
    r.lang = "fr-FR"; r.interimResults = true; r.continuous = false;
    let final = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) final += t; else interim += t; }
      setText((final + interim).trim());
    };
    r.onerror = (e) => { setListening(false); if (e.error === "not-allowed" || e.error === "service-not-allowed") setErr("Micro refusé : autorise le micro pour BETWISE dans les réglages du navigateur."); else if (e.error !== "aborted" && e.error !== "no-speech") setErr("La dictée n’a pas fonctionné. Réessaie ou écris ta question."); };
    r.onend = () => { setListening(false); const q = final.trim(); if (q) { if (!voiceOutRef.current) setVoice(true); send(q); } };
    rec.current = r; setErr(null); setListening(true);
    try { r.start(); } catch { setListening(false); }
  }
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  async function send(q: string) {
    const message = q.trim();
    if (!message || busy) return;
    setErr(null); setBusy(true); setText("");
    setMsgs((m) => [...m, { role: "user", text: message }]);
    try {
      const r = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, conversationId: id }) });
      const j = await r.json();
      if (j.conversationId) setId(j.conversationId);
      if (!r.ok) { setErr(j.error ?? "Erreur."); return; }
      setMsgs((m) => [...m, { id: j.reply.id, role: "assistant", text: j.reply.text, fonctions: j.reply.fonctions }]);
      if (voiceOutRef.current) speak(j.reply.text);
      if (typeof j.restant === "number") setLeft(j.restant);
    } catch {
      setErr("Pas de connexion. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-28">
      <div className="mb-3 flex items-center justify-between gap-3">
        {canSpeak ? (
          <button type="button" onClick={() => setVoice(!voiceOut)} aria-pressed={voiceOut} className={`rounded-full border px-3 py-1 text-xs font-medium ${voiceOut ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-soft"}`}>
            {voiceOut ? "🔊 Réponses à voix haute" : "🔈 Voix coupée"}
          </button>
        ) : <span />}
        {msgs.length > 0 && <Link href="/coach?nouvelle=1" className="text-xs text-slate-600 underline">Nouvelle conversation</Link>}
      </div>

      {msgs.length === 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm text-slate-600">Quelques questions pour commencer :</p>
          {suggestions.map((s) => (
            <button key={s} onClick={() => send(s)} disabled={busy} className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm active:bg-slate-50">{s}</button>
          ))}
          <p className="pt-2 text-[11px] text-slate-400">Le coach ne reçoit ni ton nom ni tes montants en F CFA : il raisonne en unités (ta mise habituelle) et en pourcentages.</p>
        </div>
      )}

      <div className="space-y-3">
        {msgs.map((m, i) => (
          <div key={m.id ?? i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 px-3.5 py-2.5 text-sm text-white" : "rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800"}>
              {m.role === "assistant" ? <Rich text={m.text || "Réponse vide : repose ta question."} /> : m.text}
              {m.role === "assistant" && canSpeak && !!m.text && <button type="button" onClick={() => speak(m.text)} className="mt-1.5 text-[11px] font-medium text-brand">🔊 Écouter</button>}
              {m.role === "assistant" && !!m.fonctions?.length && (
                <p className="mt-2 border-t border-slate-100 pt-1.5 text-[11px] text-slate-400">Données consultées : {[...new Set(m.fonctions)].map((f) => FN_LABEL[f] ?? f).join(", ")}</p>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-xs text-slate-500">Le coach consulte tes données…</p>}
        {err && <Notice>{err}</Notice>}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="fixed inset-x-0 bottom-16 z-10 border-t border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto flex max-w-xl items-end gap-2">
          {canListen && (
            <button type="button" onClick={listen} disabled={busy} aria-label={listening ? "Arrêter la dictée" : "Poser la question à la voix"} aria-pressed={listening}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-lg disabled:opacity-40 ${listening ? "animate-pulse border-loss bg-loss text-white" : "border-slate-300 bg-white"}`}>🎙️</button>
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={1500} placeholder={listening ? "Je t’écoute…" : "Pose ta question…"}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base" />
          <button type="submit" disabled={busy || !text.trim()} className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-40">Envoyer</button>
        </div>
        {left !== null && left <= 5 && <p className="mx-auto mt-1 max-w-xl text-[11px] text-slate-500">Encore {left} question{left > 1 ? "s" : ""} aujourd’hui.</p>}
      </form>
    </div>
  );
}

// ----- Voix (API du navigateur : rien n'est envoyé à un service tiers par BETWISE) -----
type SpeechRecEvent = { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } };
type SpeechRec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: SpeechRecEvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
function recCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
function unlockSpeech() {
  try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; window.speechSynthesis.speak(u); } catch { /* ignore */ }
}
/** Phrases courtes dites une à une : le débit respire mieux qu'un bloc lu d'une traite. */
function speak(text: string) {
  try {
    const synth = window.speechSynthesis; if (!synth) return;
    synth.cancel();
    const voice = pickVoice(synth.getVoices());
    const parts = spoken(text).split(/(?<=[.!?:])\s+/).map((x) => x.trim()).filter(Boolean);
    for (const part of parts) {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = voice?.lang ?? "fr-FR"; u.rate = 1.08; u.pitch = 1.12; // un peu plus vif et plus clair que le réglage d'usine
      if (voice) u.voice = voice as SpeechSynthesisVoice;
      synth.speak(u);
    }
  } catch { /* ignore */ }
}

/** Rendu minimal : paragraphes, listes « - », gras **…**. Pas de HTML injecté. */
function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-•*]|\d+[.)])\s+/.test(l))) {
          return <ul key={i} className="list-disc space-y-1 pl-5">{lines.map((l, k) => <li key={k}>{inline(l.replace(/^\s*([-•*]|\d+[.)])\s+/, ""))}</li>)}</ul>;
        }
        return <p key={i}>{lines.map((l, k) => <span key={k}>{k > 0 && <br />}{inline(l.replace(/^#+\s*/, ""))}</span>)}</p>;
      })}
    </div>
  );
}
function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part));
}
