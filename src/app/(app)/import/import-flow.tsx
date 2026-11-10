"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { placeImportedBet } from "@/lib/bets/import-actions";
import { SourceChooser } from "@/components/source-chooser";
import { Button, Chip, Field, Input, Notice, RISK_CLASS, RISK_LABEL, fcfa, riskFromOdds } from "@/components/ui";
import type { ExtractedTicket, MatchedSelection } from "@/lib/extract/ticket";

type Source = { id: string; nom: string; type: string };
type Extracted = ExtractedTicket & { upload_id: string | null; truncated: boolean };
type CouponOnly = { coupon_only: true; coupon: { bookmaker: string; code: string; url: string }; message: string };

type Line = MatchedSelection & { key: number; origin: string | null; coteStr: string; include: boolean };

const OUTCOME: Record<MatchedSelection["outcome"], { label: string; cls: string }> = {
  won: { label: "Gagnée", cls: "bg-emerald-100 text-emerald-800" },
  lost: { label: "Perdue", cls: "bg-red-100 text-red-800" },
  void: { label: "Remboursée", cls: "bg-amber-100 text-amber-800" },
  pending: { label: "En cours", cls: "bg-slate-100 text-slate-700" },
  unknown: { label: "?", cls: "bg-slate-100 text-slate-500" },
};
const toNum = (s: string) => Number(String(s).replace(/\s/g, "").replace(",", "."));

export function ImportFlow({ sources, defaultOrigin, initialText, justSaved, nextTab }: { sources: Source[]; defaultOrigin: string | null; initialText: string; justSaved?: boolean; nextTab?: string }) {
  const [srcList, setSrcList] = useState<{ id: string; nom: string; type?: string }[]>(sources);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extracted | null>(null);
  const [coupon, setCoupon] = useState<CouponOnly["coupon"] | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [mise, setMise] = useState("");
  const [status, setStatus] = useState<"en_cours" | "gagne" | "perdu" | "rembourse">("en_cours");
  const [summaryOrigin, setSummaryOrigin] = useState<string | null>(defaultOrigin);
  const [pending, start] = useTransition();

  // Fichiers arrivés par la feuille de partage Android (voir /import/share)
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("shared")) return;
    try {
      const raw = sessionStorage.getItem("betwise.shared");
      if (!raw) return;
      sessionStorage.removeItem("betwise.shared");
      const parts = JSON.parse(raw) as { name: string; type: string; b64: string }[];
      const fd = new FormData();
      for (const p of parts) {
        const bin = atob(p.b64); const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        fd.append("image", new File([arr], p.name || "capture.jpg", { type: p.type }));
      }
      run(fd);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fd: FormData) {
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await fetch("/api/extract", { method: "POST", body: fd });
      const j = (await r.json()) as Extracted | CouponOnly | { error: string };
      if ("error" in j) { setError(j.error); return; }
      if ("coupon_only" in j) { setCoupon(j.coupon); setError(null); return; }
      setResult(j);
      setLines(j.selections.map((s, i) => ({ ...s, key: i, origin: defaultOrigin, coteStr: s.odds ? String(s.odds) : "", include: true })));
      setMise(j.raw.stake ? String(j.raw.stake) : "");
      setStatus(j.raw.status === "won" ? "gagne" : j.raw.status === "lost" ? "perdu" : j.raw.status === "void" ? "rembourse" : "en_cours");
    } catch {
      setError("Connexion impossible. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  function onFiles(list: FileList | null) {
    const files = Array.from(list ?? []).filter((f) => f.size > 0);
    if (files.length === 0) return;
    const fd = new FormData();
    for (const f of files) fd.append("image", f);
    if (coupon) fd.set("link", coupon.url);
    run(fd);
  }
  function onText() {
    const fd = new FormData(); fd.set("text", text.trim());
    run(fd);
  }

  function update(key: number, patch: Partial<Line>) { setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l))); }

  const included = lines.filter((l) => l.include);
  const collapsed = result?.raw.is_collapsed || (result && lines.length === 0);
  const readyDetail = included.length > 0 && included.every((l) => l.ok && toNum(l.coteStr) > 1 && l.origin && (l.match || (l.home_team && l.away_team)));
  const readySummary = !!collapsed && toNum(mise) > 0 && !!result?.raw.total_odds && !!summaryOrigin;
  const ready = toNum(mise) > 0 && (collapsed ? readySummary : readyDetail);

  function save() {
    if (!result) return;
    setError(null);
    start(async () => {
      const res = await placeImportedBet({
        mise: toNum(mise),
        statut: status,
        placed_at: result.placed_at_iso,
        bookmaker: result.raw.bookmaker ?? coupon?.bookmaker ?? null,
        coupon_externe: result.raw.coupon_code ?? coupon?.code ?? null,
        upload_id: result.upload_id,
        raw_text: text || null,
        summary: collapsed ? { cote_totale: result.raw.total_odds!, nb_selections: result.raw.nb_selections_declared ?? 0, origin_source_id: summaryOrigin! } : null,
        selections: collapsed ? [] : included.map((l) => ({
          match_id: l.match?.id ?? null,
          match_libre: l.match ? null : `${l.home_team ?? "?"} – ${l.away_team ?? "?"}`,
          market_code: l.market_code as never,
          market_param: l.market_param,
          selection: l.selection,
          cote: toNum(l.coteStr),
          origin_source_id: l.origin!,
          resultat: l.outcome === "won" ? "gagne" : l.outcome === "lost" ? "perdu" : l.outcome === "void" ? "rembourse" : null,
        })),
      });
      if (!res.ok) { setError(res.error); return; }
      router.push("/import?ok=1&next=" + (status === "en_cours" ? "paris" : "regles"));
    });
  }

  // ---------- Étape 1 : entrée ----------
  if (!result) {
    return (
      <div className="space-y-4">
        {justSaved && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <span>Ticket enregistré.</span>
            <a href={nextTab === "regles" ? "/paris?f=regles" : "/paris"} className="font-medium underline">Voir mes paris</a>
          </div>
        )}
        {coupon && (
          <Notice kind="info">Lien {coupon.bookmaker} reconnu (coupon {coupon.code}). Il ne contient pas les sélections : ajoute une capture ou le texte du coupon.</Notice>
        )}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">Capture d’écran</h2>
          <p className="mb-3 text-xs text-slate-500">Déplie le ticket avant la capture. Un ticket long peut être envoyé en plusieurs captures : sélectionne-les toutes, dans l’ordre (6 max).</p>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
          <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "Lecture en cours…" : "Choisir une ou plusieurs captures"}</Button>
          <p className="mt-2 text-[11px] text-slate-400">Betclic ne partage pas ses tickets : la capture d’écran est le seul moyen. Sur iPhone : Photos. Sur Android : Galerie ou Fichiers.</p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">Texte partagé ou lien</h2>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder={"Colle ici le texte partagé par l’app de paris, ou un lien xbet://…"} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <Button className="mt-2" onClick={onText} disabled={busy || text.trim().length < 5}>{busy ? "Lecture en cours…" : "Lire le texte"}</Button>
        </section>
        {error && <Notice>{error}</Notice>}
      </div>
    );
  }

  // ---------- Étape 2 : carte de confirmation ----------
  const raw = result.raw;
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold">{raw.bookmaker ?? "Bookmaker inconnu"} · {raw.ticket_type === "combo" ? `Combiné (${raw.nb_selections_declared ?? lines.length})` : "Simple"}</p>
            <p className="text-xs text-slate-500">{raw.placed_at ? `Ticket du ${raw.placed_at}` : "Date du ticket non lue"}{raw.coupon_code ? ` · coupon ${raw.coupon_code}` : ""}</p>
          </div>
          <button className="text-xs text-slate-600 underline" onClick={() => { setResult(null); setLines([]); }}>Recommencer</button>
        </div>
        {result.truncated && <Notice>Capture trop longue : seules les premières lignes ont été lues. Vérifie et complète.</Notice>}
        {raw.notes && <p className="mt-2 text-xs text-amber-800">{raw.notes}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <Check ok={result.checks.odds_product_ok} label="Produit des cotes = cote totale" />
          <Check ok={result.checks.count_ok} label="Nombre de lignes cohérent" />
        </div>
      </section>

      {collapsed ? (
        <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">Ticket replié : le détail des sélections n’est pas visible. On enregistre le résumé (mise, cote totale, résultat) pour que ta bankroll soit juste. Tu pourras ajouter le détail plus tard.</p>
          <p className="text-sm">Cote totale <strong>{raw.total_odds ?? "—"}</strong> · {raw.nb_selections_declared ?? "?"} sélections</p>
          <Field label="Origine de ce ticket (pour l’ensemble)">
            <SourceChooser sources={srcList} value={summaryOrigin} onChange={setSummaryOrigin} onCreated={(s) => setSrcList((x) => [...x, s])} />
          </Field>
        </section>
      ) : (
        lines.map((l, i) => (
          <section key={l.key} className={`space-y-2 rounded-xl border bg-white p-4 ${l.include ? "border-slate-200" : "border-dashed border-slate-300 opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sélection {i + 1}</p>
                <p className="truncate text-sm font-medium">{l.match ? `${l.match.home} – ${l.match.away}` : `${l.home_team ?? "?"} – ${l.away_team ?? "?"}`}</p>
                <p className="text-xs text-slate-600">{l.label_pick} <span className="text-slate-400">({l.market_code}{l.market_param !== null ? ` ${l.market_param}` : ""} → {l.selection})</span></p>
                {l.match
                  ? <p className="text-[11px] text-emerald-700">Match reconnu · {l.match.competition}{l.match.score ? ` · score en base ${l.match.score}` : ""}{l.score_consistent === false ? " · ⚠ diffère du ticket" : ""}</p>
                  : <p className="text-[11px] text-amber-700">Match non reconnu : sera gardé en texte et réglé à la main.</p>}
                {!l.ok && <p className="text-[11px] text-red-700">Sélection non comprise : corrige le marché ou retire la ligne.</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${OUTCOME[l.outcome].cls}`}>{OUTCOME[l.outcome].label}</span>
            </div>
            <div className="flex items-center gap-3">
              <Field label="Cote"><Input inputMode="decimal" value={l.coteStr} onChange={(e) => update(l.key, { coteStr: e.target.value })} className="max-w-[7rem]" /></Field>
              {toNum(l.coteStr) > 1 && <span className={`mt-5 rounded-full border px-2 py-1 text-[11px] ${RISK_CLASS[riskFromOdds(toNum(l.coteStr))]}`}>{RISK_LABEL[riskFromOdds(toNum(l.coteStr))]}</span>}
              <label className="ml-auto mt-5 flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={l.include} onChange={(e) => update(l.key, { include: e.target.checked })} /> inclure</label>
            </div>
            <Field label="Origine du choix">
              <SourceChooser size="sm" sources={srcList} value={l.origin} onChange={(id) => update(l.key, { origin: id })} onCreated={(s) => setSrcList((x) => [...x, s])} />
            </Field>
          </section>
        ))
      )}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mise (F CFA)"><Input inputMode="numeric" value={mise} onChange={(e) => setMise(e.target.value)} /></Field>
          <Field label="Résultat du ticket">
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base">
              <option value="en_cours">En cours</option>
              <option value="gagne">Gagné</option>
              <option value="perdu">Perdu</option>
              <option value="rembourse">Remboursé</option>
            </select>
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          {collapsed
            ? `Cote totale ${raw.total_odds ?? "—"}`
            : `Cote totale calculée ${included.reduce((a, l) => a * (toNum(l.coteStr) > 1 ? toNum(l.coteStr) : 1), 1).toFixed(2)}${raw.total_odds ? ` · lue sur le ticket ${raw.total_odds}` : ""}`}
          {toNum(mise) > 0 && status === "gagne" && raw.total_odds ? ` · gain ${fcfa(toNum(mise) * raw.total_odds - toNum(mise))}` : ""}
        </p>
      </section>

      {error && <Notice>{error}</Notice>}
      <Button onClick={save} disabled={pending || !ready}>{pending ? "Enregistrement…" : "Enregistrer ce ticket"}</Button>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean | null; label: string }) {
  const cls = ok === null ? "bg-slate-100 text-slate-500" : ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800";
  return <span className={`rounded-full px-2 py-0.5 ${cls}`}>{ok === null ? "–" : ok ? "✓" : "✗"} {label}</span>;
}
