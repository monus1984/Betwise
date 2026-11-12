"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cancelPrediction, setSourceLink, toggleFollow } from "@/lib/sources/actions";
import { linkLabel } from "@/lib/sources/link";
import { RISK_CLASS, RISK_LABEL } from "@/components/ui";

export function FollowButton({ sourceId, following }: { sourceId: string; following: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(() => toggleFollow(sourceId, !following))}
      className={`rounded-lg px-3 py-2 text-sm font-medium ${following ? "border border-slate-300 bg-white text-slate-700" : "bg-slate-900 text-white"}`}
    >
      {following ? "Suivie ✓" : "Suivre"}
    </button>
  );
}

export type PredictionView = {
  id: string;
  label: string;
  matchId: string | null;
  kickoff: string | null;
  score: string | null;
  market: string;
  param: number | null;
  selection: string;
  cote: number | null;
  risque: "prudent" | "moyen" | "risque" | null;
  statut: "verifie" | "declare" | "annule";
  resultat: "en_attente" | "gagne" | "perdu" | "rembourse";
  loggedAt: string;
  mine: boolean;
};

const RES: Record<PredictionView["resultat"], { label: string; cls: string }> = {
  en_attente: { label: "En attente", cls: "bg-slate-100 text-slate-700" },
  gagne: { label: "Gagné", cls: "bg-emerald-100 text-emerald-800" },
  perdu: { label: "Perdu", cls: "bg-red-100 text-red-800" },
  rembourse: { label: "Remboursé", cls: "bg-amber-100 text-amber-800" },
};

export function PredictionRow({ p, sourceId }: { p: PredictionView; sourceId: string }) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [motif, setMotif] = useState("");
  const upcoming = p.kickoff ? Date.parse(p.kickoff) > Date.now() : p.resultat === "en_attente";
  const res = p.statut === "annule" ? { label: "Annulé", cls: "bg-slate-100 text-slate-500 line-through" } : RES[p.resultat];

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{p.label}{p.score ? <span className="ml-2 tabular-nums text-slate-500">{p.score}</span> : null}</p>
          <p className="text-xs text-slate-600">
            {marketLabel(p.market, p.param, p.selection)}{p.cote ? ` · cote ${Number(p.cote).toFixed(2)}` : " · sans cote"}
            {p.risque && <span className={`ml-2 rounded border px-1.5 py-0.5 text-[10px] ${RISK_CLASS[p.risque]}`}>{RISK_LABEL[p.risque]}</span>}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {p.statut === "verifie" ? "Vérifié · enregistré avant le coup d’envoi" : p.statut === "declare" ? "Déclaré · enregistré après coup ou match non identifié" : "Annulé"} · {new Date(p.loggedAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${res.cls}`}>{res.label}</span>
      </div>

      {p.statut !== "annule" && (
        <div className="mt-2 flex gap-2">
          {upcoming && p.matchId && (
            <Link
              href={`/nouveau?match=${p.matchId}&market=${p.market}${p.param !== null ? `&param=${p.param}` : ""}&sel=${encodeURIComponent(p.selection)}${p.cote ? `&cote=${p.cote}` : ""}&origin=${sourceId}&prediction=${p.id}`}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Jouer ce prono
            </Link>
          )}
          {p.mine && p.resultat === "en_attente" && !asking && (
            <button onClick={() => setAsking(true)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700">Annuler…</button>
          )}
        </div>
      )}
      {asking && (
        <div className="mt-2 flex gap-2">
          <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif (obligatoire, reste visible)" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <button disabled={pending || motif.trim().length < 3} onClick={() => start(async () => { await cancelPrediction(p.id, motif.trim(), sourceId); setAsking(false); })} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Confirmer</button>
        </div>
      )}
    </li>
  );
}

export function marketLabel(code: string, param: number | null, sel: string) {
  switch (code) {
    case "1X2": return { "1": "Victoire dom.", N: "Nul", "2": "Victoire ext." }[sel] ?? sel;
    case "DC": return `Double chance ${sel}`;
    case "DNB": return `Remb. si nul · ${sel === "1" ? "dom." : "ext."}`;
    case "OU": return `${sel} de ${param ?? ""} buts`;
    case "BTTS": return `Les deux marquent : ${sel}`;
    case "AH": return `Handicap ${param ?? ""} · ${sel === "1" ? "dom." : "ext."}`;
    case "CS": return `Score exact ${sel}`;
    case "DC_OU": { const [dc, ou] = sel.split("|"); return `Double chance ${dc} & ${ou} de ${param ?? ""} buts`; }
    case "1X2_OU": { const [r, ou] = sel.split("|"); return `${({ "1": "Dom.", N: "Nul", "2": "Ext." } as Record<string,string>)[r] ?? r} & ${ou} de ${param ?? ""} buts`; }
    default: return `${code} ${sel}`;
  }
}

/** Lien vers la page de la source : bouton pour s'y rendre, et saisie quand il manque ou qu'on peut le corriger. */
export function SourceLink({ sourceId, type, url, saved, canEdit }: { sourceId: string; type: string; url: string | null; saved: boolean; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(saved && url ? url : "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = (v: string) => start(async () => {
    const r = await setSourceLink(sourceId, type, v);
    if (r.ok) { setErr(null); setOpen(false); } else setErr(r.error);
  });
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white active:scale-[0.98]">
            Ouvrir sur {linkLabel(url)}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
          </a>
        )}
        {canEdit && !open && (
          <button type="button" onClick={() => setOpen(true)} className={url ? "text-xs text-ink-muted underline" : "rounded-lg border border-brand/40 px-3 py-2 text-sm font-medium text-brand"}>
            {url ? "Changer le lien" : "+ Ajouter le lien de sa page"}
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={(e) => { e.preventDefault(); save(val); }} className="mt-2 rounded-xl border border-line bg-white p-3">
          <label htmlFor="source-lien" className="block text-xs font-medium text-ink-muted">Adresse de la page (Facebook, Telegram, Instagram, site…)</label>
          <input id="source-lien" value={val} onChange={(e) => setVal(e.target.value)} inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://www.facebook.com/…" maxLength={300}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base" />
          <p className="mt-1 text-[11px] text-ink-muted">Dans l’appli du réseau : ouvre la page, « Partager » puis « Copier le lien », et colle-le ici.</p>
          {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
          <div className="mt-2 flex items-center gap-3">
            <button type="submit" disabled={pending || !val.trim()} className="rounded-lg bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? "Enregistrement…" : "Enregistrer"}</button>
            <button type="button" onClick={() => { setOpen(false); setErr(null); }} className="text-sm text-ink-muted">Annuler</button>
            {saved && <button type="button" disabled={pending} onClick={() => { setVal(""); save(""); }} className="ml-auto text-xs text-red-700 underline">Retirer le lien</button>}
          </div>
        </form>
      )}
    </div>
  );
}
