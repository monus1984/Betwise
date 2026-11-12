"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Notice } from "@/components/ui";

export type ChatMsg = { id?: string; role: "user" | "assistant"; text: string; fonctions?: string[] };

const FN_LABEL: Record<string, string> = {
  selections_probables: "sélections du jour", mon_objectif: "ton objectif", simuler_objectif: "simulation d’objectif", fixer_objectif: "objectif enregistré", coups_du_jour: "coups du jour", bilan_paris: "bilan des paris", bilan_par_origine: "réussite par origine", etat_bankroll: "état de la bankroll",
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
      if (typeof j.restant === "number") setLeft(j.restant);
    } catch {
      setErr("Pas de connexion. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-28">
      {msgs.length > 0 && (
        <div className="mb-3 flex justify-end">
          <Link href="/coach?nouvelle=1" className="text-xs text-slate-600 underline">Nouvelle conversation</Link>
        </div>
      )}

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
              {m.role === "assistant" ? <Rich text={m.text} /> : m.text}
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
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={1500} placeholder="Pose ta question…"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base" />
          <button type="submit" disabled={busy || !text.trim()} className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-40">Envoyer</button>
        </div>
        {left !== null && left <= 5 && <p className="mx-auto mt-1 max-w-xl text-[11px] text-slate-500">Encore {left} question{left > 1 ? "s" : ""} aujourd’hui.</p>}
      </form>
    </div>
  );
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
