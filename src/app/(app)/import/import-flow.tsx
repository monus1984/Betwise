"use client";

import { MarketOptions } from "@/components/market-options";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { placeImportedBet } from "@/lib/bets/import-actions";
import { SourceChooser } from "@/components/source-chooser";
import { Button, Chip, Field, Input, Notice, RISK_CLASS, RISK_LABEL, fcfa, riskFromOdds } from "@/components/ui";
import type { ExtractedTicket, MatchedSelection } from "@/lib/extract/ticket";
import { SOURCE_TYPE_OF, matchSource } from "@/lib/extract/source-match";
import { quickCreateSource } from "@/lib/sources/actions";
import { framesFromVideo } from "@/lib/extract/video-frames";
import { MatchPicker, defaultParam, paramLabel } from "@/components/match-picker";
import { SelectionField } from "@/components/selection-field";
import { pickLabel } from "@/lib/probs/signals";

type Source = { id: string; nom: string; type: string };
type Extracted = ExtractedTicket & { upload_id: string | null; truncated: boolean };
type CouponOnly = { coupon_only: true; coupon: { bookmaker: string; code: string; url: string }; message: string };

type Line = MatchedSelection & { key: number; origin: string | null; coteStr: string; include: boolean; editing: boolean; paramStr: string; query: string };

const OUTCOME: Record<MatchedSelection["outcome"], { label: string; cls: string }> = {
  won: { label: "Gagnée", cls: "bg-emerald-100 text-emerald-800" },
  lost: { label: "Perdue", cls: "bg-red-100 text-red-800" },
  void: { label: "Remboursée", cls: "bg-amber-100 text-amber-800" },
  pending: { label: "En cours", cls: "bg-slate-100 text-slate-700" },
  unknown: { label: "?", cls: "bg-slate-100 text-slate-500" },
};
const toNum = (s: string) => Number(String(s).replace(/\s/g, "").replace(",", "."));

export function ImportFlow({ markets, sources, defaultOrigin, initialText, justSaved, nextTab }: { markets: { code: string; libelle_fr: string; a_parametre: boolean }[]; sources: Source[]; defaultOrigin: string | null; initialText: string; justSaved?: boolean; nextTab?: string }) {
  const [srcList, setSrcList] = useState<{ id: string; nom: string; type?: string }[]>(sources);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extracted | null>(null);
  const [queue, setQueue] = useState<Extracted[]>([]);   // tickets lus dans le même envoi, en attente
  const [done, setDone] = useState<{ n: number; total: number } | null>(null);
  type Hint = NonNullable<ExtractedTicket["raw"]["source"]>;
  const [detected, setDetected] = useState<{ hint: Hint; sourceId: string | null } | null>(null);
  const [creating, setCreating] = useState(false);
  const [coupon, setCoupon] = useState<CouponOnly["coupon"] | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [mise, setMise] = useState("");
  const [status, setStatus] = useState<"en_cours" | "gagne" | "perdu" | "rembourse">("en_cours");
  const [test, setTest] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [videoNote, setVideoNote] = useState<string | null>(null);
  const [summaryOrigin, setSummaryOrigin] = useState<string | null>(defaultOrigin);
  const [pending, start] = useTransition();

  // Fichiers arrivés par la feuille de partage Android : déposés par le service worker (sans limite de taille),
  // sinon par la route serveur /import/share (petites images seulement)
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("shared")) return;
    (async () => {
      try {
        if ("caches" in window) {
          const cache = await caches.open("betwise-share");
          const keys = await cache.keys();
          if (keys.length) {
            const files: File[] = [];
            for (const k of [...keys].sort((a, b) => a.url.localeCompare(b.url))) {
              const r = await cache.match(k); if (!r) continue;
              const blob = await r.blob();
              files.push(new File([blob], decodeURIComponent(r.headers.get("x-name") ?? "partage"), { type: blob.type || r.headers.get("content-type") || "" }));
              await cache.delete(k);
            }
            if (files.length) { await onFiles(files); return; }
          }
        }
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
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load(t: Extracted) {
    setResult(t);
    // Source lue sur la capture (canal, page, groupe, filigrane) : appliquée si elle existe déjà
    const hint = t.raw.source?.name ? t.raw.source : null;
    const found = hint ? matchSource(hint.name, srcList) : null;
    setDetected(hint ? { hint, sourceId: found?.id ?? null } : null);
    const origin = found?.id ?? lines[0]?.origin ?? defaultOrigin;
    if (found) setSummaryOrigin(found.id);
    setLines(t.selections.map((s, i) => ({ ...s, key: i, origin, coteStr: s.odds ? String(s.odds) : "", include: true, editing: !s.ok || !s.match, paramStr: s.market_param !== null ? String(s.market_param) : "", query: s.match ? "" : [s.home_team, s.away_team].filter(Boolean).join(" ") })));
    // Pronos de tipster : ce ne sont pas des paris de l'utilisateur, on les enregistre comme tests par défaut
    const pronos = t.raw.kind === "pronos";
    if (pronos) setTest(true);
    setMise(t.raw.stake ? String(t.raw.stake) : test || pronos ? "1000" : "");
    setStatus(t.raw.status === "won" ? "gagne" : t.raw.status === "lost" ? "perdu" : t.raw.status === "void" ? "rembourse" : "en_cours");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  /** Crée la source détectée (WhatsApp : privée, ce sont souvent des personnes) et l'applique à tout le ticket. */
  async function createDetected() {
    if (!detected?.hint.name) return;
    setCreating(true);
    const r = await quickCreateSource({ nom: detected.hint.name.slice(0, 60), type: SOURCE_TYPE_OF[detected.hint.platform ?? "autre"] ?? "tipster", visibilite: detected.hint.platform === "whatsapp" ? "privee" : "partagee" });
    setCreating(false);
    if (!r.ok) { setError(r.error); return; }
    setSrcList((x) => (x.some((s) => s.id === r.source.id) ? x : [...x, r.source]));
    applySource(r.source.id);
  }
  function applySource(id: string) {
    setDetected((d) => (d ? { ...d, sourceId: id } : d));
    setSummaryOrigin(id);
    setLines((ls) => ls.map((l) => ({ ...l, origin: id })));
  }

  /** Ticket suivant du même envoi, ou fin. */
  function next(saved: boolean) {
    const total = done?.total ?? 1;
    const n = (done?.n ?? 0) + (saved ? 1 : 0);
    if (queue.length) { setDone({ n, total }); load(queue[0]); setQueue(queue.slice(1)); return true; }
    setDone(total > 1 ? { n, total } : null);
    return false;
  }

  async function run(fd: FormData) {
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await fetch("/api/extract", { method: "POST", body: fd });
      const j = (await r.json()) as { tickets: Extracted[] } | CouponOnly | { error: string };
      if ("error" in j) { setError(j.error); return; }
      if ("coupon_only" in j) { setCoupon(j.coupon); setError(null); return; }
      if (!j.tickets.length) { setError("Aucun ticket lisible."); return; }
      setDone(j.tickets.length > 1 ? { n: 0, total: j.tickets.length } : null);
      load(j.tickets[0]);
      setQueue(j.tickets.slice(1));
    } catch {
      setError("Connexion impossible. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  async function onFiles(list: FileList | File[] | null) {
    const all = Array.from(list ?? []).filter((f) => f.size > 0);
    if (all.length === 0) return;
    const videos = all.filter((f) => f.type.startsWith("video/"));
    let images = all.filter((f) => !f.type.startsWith("video/"));
    setVideoNote(null);
    if (videos.length) {
      if (videos.length > 1) { setError("Une seule vidéo à la fois : une vidéo = un ticket."); return; }
      setBusy(true); setError(null); setStage("Lecture de la vidéo…");
      try {
        const r = await framesFromVideo(videos[0], { max: Math.max(2, 12 - images.length) });
        images = [...images, ...r.files];
        setVideoNote(`${r.retenues} image${r.retenues > 1 ? "s" : ""} tirée${r.retenues > 1 ? "s" : ""} de la vidéo (${Math.round(r.duree)} s)${r.candidates > r.retenues ? ` sur ${r.candidates} possibles : vérifie qu’aucune sélection ne manque, ou filme plus lentement` : ""}.`);
      } catch (e) {
        setBusy(false); setStage(null);
        setError(e instanceof Error ? e.message : "Vidéo illisible.");
        return;
      }
      setStage(null);
    }
    const fd = new FormData();
    for (const f of images.slice(0, 12)) fd.append("image", f);
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
  const separes = result?.raw.kind === "pronos" && !result.raw.total_odds && included.length > 1;
  const readyDetail = included.length > 0 && included.every((l) => l.ok && toNum(l.coteStr) > 1 && l.origin && (l.match || (l.home_team && l.away_team)));
  const readySummary = !!collapsed && toNum(mise) > 0 && !!result?.raw.total_odds && !!summaryOrigin;
  const ready = toNum(mise) > 0 && (collapsed ? readySummary : readyDetail);

  function save() {
    if (!result) return;
    setError(null);
    start(async () => {
      // Liste de pronos sans cote totale : un test (ou pari) simple par prono, comme le tipster les a donnés
      if (separes) {
        let ok = 0;
        for (const l of included) {
          const r = await placeImportedBet({
            virtuel: test, mise: toNum(mise), statut: "en_cours", placed_at: result.placed_at_iso, bookmaker: null, coupon_externe: null,
            upload_id: result.upload_id, raw_text: text || null, summary: null,
            selections: [{ match_id: l.match?.id ?? null, match_libre: l.match ? null : `${l.home_team ?? "?"} – ${l.away_team ?? "?"}`, market_code: l.market_code as never, market_param: l.market_param, selection: l.selection, cote: toNum(l.coteStr), origin_source_id: l.origin!, resultat: null }],
          });
          if (!r.ok) { setError(`${ok} prono${ok > 1 ? "s" : ""} enregistré${ok > 1 ? "s" : ""}, puis : ${r.error}`); return; }
          ok++;
        }
        if (next(true)) return;
        router.push(test ? "/paris?vue=tests&ajout=1" : "/paris?ajout=1");
        return;
      }
      const res = await placeImportedBet({
        virtuel: test,
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
      if (next(true)) return;
      router.push(test ? "/paris?vue=tests&ajout=1" : "/import?ok=1&next=" + (status === "en_cours" ? "paris" : "regles"));
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
          <h2 className="mb-2 text-sm font-semibold">Capture ou vidéo d’écran</h2>
          <p className="mb-3 text-xs text-slate-500">Déplie le ticket avant la capture. Un ticket long : plusieurs captures dans l’ordre (6 max), ou une vidéo d’écran en faisant défiler sans te presser. La vidéo est découpée sur ton téléphone, elle n’est pas envoyée.</p>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; void onFiles(f); }} />
          <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? stage ?? "Lecture en cours…" : "Choisir des captures ou une vidéo"}</Button>
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
      <div className="grid grid-cols-2 rounded-xl border border-line bg-surface-2 p-1 text-sm font-medium" role="radiogroup" aria-label="Type d’enregistrement">
        <button type="button" role="radio" aria-checked={!test} onClick={() => setTest(false)} className={`rounded-lg py-2 ${!test ? "bg-white shadow-card" : "text-ink-muted"}`}>J’ai parié</button>
        <button type="button" role="radio" aria-checked={test} onClick={() => { setTest(true); if (!toNum(mise)) setMise("1000"); }} className={`rounded-lg py-2 ${test ? "bg-white shadow-card" : "text-ink-muted"}`}>Tester sans miser</button>
      </div>
      {done && (
        <div className="flex items-center justify-between rounded-xl border border-brand/30 bg-brand/5 px-3 py-2.5 text-sm">
          <span><b>Ticket {done.total - queue.length} sur {done.total}</b>{done.n > 0 && <span className="text-ink-muted"> · {done.n} déjà enregistré{done.n > 1 ? "s" : ""}</span>}</span>
          {queue.length > 0 && <button type="button" onClick={() => next(false)} className="text-xs font-medium text-brand">Passer ›</button>}
        </div>
      )}
      {videoNote && <Notice kind="info">{videoNote}</Notice>}
      {detected && (
        <div className="rounded-xl border border-line bg-white p-3 text-sm shadow-card">
          <p>
            <span className="text-ink-muted">Source repérée{detected.hint.platform && detected.hint.platform !== "autre" ? ` sur ${({ telegram: "Telegram", whatsapp: "WhatsApp", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok" } as Record<string, string>)[detected.hint.platform]}` : ""} : </span>
            <b>{detected.hint.name}</b>
          </p>
          {(detected.hint.evidence || detected.hint.published_at) && <p className="mt-0.5 text-[11px] text-ink-muted">{[detected.hint.evidence, detected.hint.published_at ? `publié ${detected.hint.published_at}` : null].filter(Boolean).join(" · ")}</p>}
          {detected.sourceId ? (
            <p className="mt-1.5 text-xs text-gain">✓ Appliquée à toutes les sélections ({srcList.find((x) => x.id === detected.sourceId)?.nom}). Tu peux changer l’origine ligne par ligne.</p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" disabled={creating} onClick={createDetected} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white">{creating ? "Création…" : "Créer cette source et l’appliquer"}</button>
              <span className="text-[11px] text-ink-muted">ou choisis-la plus bas si elle existe sous un autre nom.{detected.hint.platform === "whatsapp" ? " Une source WhatsApp reste privée." : ""}</span>
            </div>
          )}
        </div>
      )}
      {raw.kind === "pronos" && <Notice kind="info">Pronos de tipster{separes ? ` : ${included.length} pronos séparés, enregistrés chacun comme un ${test ? "test" : "pari"} simple` : raw.total_odds ? " : combiné annoncé par le tipster" : ""}. Réglés automatiquement après les matchs ; les ✅ du message ne sont pas des résultats.</Notice>}
      {test && raw.kind !== "pronos" && <Notice kind="info">Coupon ou pronos chargés comme test : suivis et réglés automatiquement, sans toucher à ta bankroll. Choisis bien l’origine (toi ou le tipster) : c’est elle qui sera notée.</Notice>}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold">{raw.bookmaker ?? "Bookmaker inconnu"} · {raw.ticket_type === "combo" ? `Combiné (${raw.nb_selections_declared ?? lines.length})` : "Simple"}</p>
            <p className="text-xs text-slate-500">{raw.placed_at ? `Ticket du ${raw.placed_at}` : "Date du ticket non lue"}{raw.coupon_code ? ` · coupon ${raw.coupon_code}` : ""}</p>
          </div>
          <button className="text-xs text-slate-600 underline" onClick={() => { setResult(null); setLines([]); setQueue([]); setDone(null); setDetected(null); }}>Recommencer</button>
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
        lines.map((l, i) => {
          const hasParam = markets.find((m) => m.code === l.market_code)?.a_parametre;
          const homeN = l.match?.home ?? l.home_team ?? "Domicile", awayN = l.match?.away ?? l.away_team ?? "Extérieur";
          return (
          <section key={l.key} className={`space-y-2 rounded-xl border bg-white p-4 ${l.include ? "border-slate-200" : "border-dashed border-slate-300 opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{raw.kind === "pronos" ? "Prono" : "Sélection"} {i + 1}</p>
                <p className="truncate text-sm font-medium">{l.match ? `${l.match.home} – ${l.match.away}` : `${l.home_team ?? "?"} – ${l.away_team ?? "?"}`}</p>
                <p className="text-xs text-slate-600">{l.ok ? pickLabel(l.market_code, l.market_param, l.selection, homeN, awayN) : l.label_pick}</p>
                {l.match
                  ? <p className="text-[11px] text-emerald-700">Match reconnu · {l.match.competition} · {new Date(l.match.kickoff_at).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })}{l.match.score ? ` · score en base ${l.match.score}` : ""}{l.score_consistent === false ? " · ⚠ diffère du ticket" : ""}</p>
                  : <p className="text-[11px] text-amber-700">Match non reconnu : choisis-le ci-dessous, sinon il sera gardé en texte et réglé à la main.</p>}
                {!l.ok && <p className="text-[11px] text-red-700">{l.reason ?? "Sélection non comprise : choisis le marché ci-dessous ou retire la ligne."}</p>}
              </div>
              {raw.kind === "pronos"
                ? <button type="button" onClick={() => update(l.key, { editing: !l.editing })} className="shrink-0 text-xs text-brand underline">{l.editing ? "Fermer" : "Modifier"}</button>
                : <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${OUTCOME[l.outcome].cls}`}>{OUTCOME[l.outcome].label}</span>}
            </div>
            {raw.kind !== "pronos" && <button type="button" onClick={() => update(l.key, { editing: !l.editing })} className="text-xs text-brand underline">{l.editing ? "Fermer la correction" : "Corriger le match ou le choix"}</button>}
            {l.editing && (
              <div className="space-y-2 rounded-lg bg-surface-2 p-2.5">
                {!l.match && <MatchPicker line={{ query: l.query, match: null }} onChange={(p) => { if (p.match) update(l.key, { match: { ...p.match, score: null }, query: "" }); else if (p.query !== undefined) update(l.key, { query: p.query }); }} hint="Tape une équipe pour retrouver le match." />}
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Marché">
                    <select value={l.market_code} onChange={(e) => update(l.key, { market_code: e.target.value, selection: "", ok: false, paramStr: defaultParam(e.target.value), market_param: defaultParam(e.target.value) ? Number(defaultParam(e.target.value)) : null })} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
                      <MarketOptions markets={markets} />
                    </select>
                  </Field>
                  {hasParam && <Field label={paramLabel(l.market_code)}><Input inputMode="decimal" value={l.paramStr} onChange={(e) => update(l.key, { paramStr: e.target.value, market_param: toNum(e.target.value) || null })} /></Field>}
                </div>
                <SelectionField market={l.market_code} param={l.paramStr} value={l.selection} match={l.match ? { id: l.match.id, kickoff_at: l.match.kickoff_at, statut: "programme", home: l.match.home, away: l.match.away, competition: l.match.competition } : null}
                  onChange={(v) => update(l.key, { selection: v, ok: !!v && (!v.includes("|") || v.split("|").every(Boolean)), reason: undefined })} />
              </div>
            )}
            <div className="flex items-center gap-3">
              <Field label={l.odds_source === "estimee" ? "Cote (estimée)" : l.odds_source === "reference" ? "Cote (référence)" : "Cote"}><Input inputMode="decimal" value={l.coteStr} onChange={(e) => update(l.key, { coteStr: e.target.value, odds_source: "ticket" })} className="max-w-[7rem]" /></Field>
              {toNum(l.coteStr) > 1 && <span className={`mt-5 rounded-full border px-2 py-1 text-[11px] ${RISK_CLASS[riskFromOdds(toNum(l.coteStr))]}`}>{RISK_LABEL[riskFromOdds(toNum(l.coteStr))]}</span>}
              <label className="ml-auto mt-5 flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={l.include} onChange={(e) => update(l.key, { include: e.target.checked })} /> inclure</label>
            </div>
            {l.odds_source && l.odds_source !== "ticket" && <p className="-mt-1 text-[11px] text-ink-muted">Le tipster ne donne pas de cote : {l.odds_source === "reference" ? "cote de référence des bookmakers" : "cote estimée d’après les probabilités BETWISE"}. Mets la tienne si tu l’as.</p>}
            <Field label="Origine du choix">
              <SourceChooser size="sm" sources={srcList} value={l.origin} onChange={(id) => update(l.key, { origin: id })} onCreated={(s) => setSrcList((x) => [...x, s])} />
            </Field>
          </section>
          );
        })
      )}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${test ? "Mise fictive" : "Mise"}${separes ? " par prono" : ""} (F CFA)`}><Input inputMode="numeric" value={mise} onChange={(e) => setMise(e.target.value)} /></Field>
          {raw.kind !== "pronos" && <Field label="Résultat du ticket">
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base">
              <option value="en_cours">En cours</option>
              <option value="gagne">Gagné</option>
              <option value="perdu">Perdu</option>
              <option value="rembourse">Remboursé</option>
            </select>
          </Field>}
        </div>
        <p className="text-xs text-slate-500">
          {collapsed
            ? `Cote totale ${raw.total_odds ?? "—"}`
            : `Cote totale calculée ${included.reduce((a, l) => a * (toNum(l.coteStr) > 1 ? toNum(l.coteStr) : 1), 1).toFixed(2)}${raw.total_odds ? ` · lue sur le ticket ${raw.total_odds}` : ""}`}
          {toNum(mise) > 0 && status === "gagne" && raw.total_odds ? ` · gain ${fcfa(toNum(mise) * raw.total_odds - toNum(mise))}` : ""}
        </p>
      </section>

      {error && <Notice>{error}</Notice>}
      <Button onClick={save} disabled={pending || !ready}>{pending ? "Enregistrement…" : `${separes ? `Enregistrer les ${included.length} ${test ? "tests" : "paris"}` : test ? "Enregistrer le test" : "Enregistrer ce ticket"}${queue.length ? " et passer au suivant" : ""}`}</Button>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean | null; label: string }) {
  const cls = ok === null ? "bg-slate-100 text-slate-500" : ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800";
  return <span className={`rounded-full px-2 py-0.5 ${cls}`}>{ok === null ? "–" : ok ? "✓" : "✗"} {label}</span>;
}
