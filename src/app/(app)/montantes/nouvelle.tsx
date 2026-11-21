"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { creerMontante, modifierMontante } from "@/lib/montantes/actions";

const NIVEAUX = [["sur", "Prudent"], ["audacieux", "Équilibré"], ["risque", "Audacieux"]] as const;
const fr = (x: number) => x.toFixed(2).replace(".", ",");

export type EditionMontante = { id: string; nom: string; mise: number; objectif: number; paliers: number; niveau: string | null; joues: number };

/** Création, ou modification quand `edition` est fourni (la mise de départ ne change plus après le premier palier). */
export function NouvelleMontante({ ouverte, edition, onFin }: { ouverte: boolean; edition?: EditionMontante; onFin?: () => void }) {
  const [open, setOpen] = useState(ouverte);
  const [mise, setMise] = useState(edition?.mise ?? 1000), [objectif, setObjectif] = useState(edition?.objectif ?? 10000), [paliers, setPaliers] = useState(edition?.paliers ?? 4), [niveau, setNiveau] = useState<string>(edition?.niveau ?? "audacieux"), [nom, setNom] = useState(edition?.nom ?? "");
  const miseBloquee = !!edition && edition.joues > 0;
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ok = mise > 0 && objectif > mise && paliers >= 1;
  const cote = ok ? Math.pow(objectif / mise, 1 / paliers) : null;
  if (!open) return <button onClick={() => setOpen(true)} className="flex h-11 w-full items-center justify-center rounded-xl bg-brand text-[13.5px] font-bold text-on-fill">Nouvelle montante</button>;
  const champ = "mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] tabular-nums";
  return (
    <form className="tile space-y-3 p-3.5" onSubmit={(e) => { e.preventDefault(); setErr(null); start(async () => {
        if (edition) { const r = await modifierMontante(edition.id, { nom, mise, objectif, paliers, niveau }); if (!r.ok) setErr(r.error); else { onFin?.(); router.refresh(); } return; }
        const r = await creerMontante({ nom, mise, objectif, paliers, niveau }); if (!r.ok) setErr(r.error); else router.push(`/montantes/${r.id}`); }); }}>
      <h2 className="text-[16px] font-bold">{edition ? "Modifier la montante" : "Nouvelle montante"}</h2>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="text-[12px] text-ink-soft">Mise de départ (F)<input inputMode="numeric" disabled={miseBloquee} className={`${champ} disabled:opacity-60`} value={mise || ""} onChange={(e) => setMise(Number(e.target.value.replace(/\D/g, "")))} />{miseBloquee && <span className="mt-0.5 block text-[10.5px] text-ink-muted">Fixée : un palier est joué.</span>}</label>
        <label className="text-[12px] text-ink-soft">Objectif (F)<input inputMode="numeric" className={champ} value={objectif || ""} onChange={(e) => setObjectif(Number(e.target.value.replace(/\D/g, "")))} /></label>
      </div>
      <label className="block text-[12px] text-ink-soft">Nombre de paliers : <b className="text-ink">{paliers}</b><input type="range" min={Math.max(1, edition?.joues ?? 1)} max={10} value={paliers} onChange={(e) => setPaliers(Number(e.target.value))} className="mt-1 w-full accent-[var(--brand)]" /></label>
      <fieldset><legend className="text-[12px] text-ink-soft">Niveau des paliers</legend>
        <div className="mt-1 grid grid-cols-3 gap-1.5">{NIVEAUX.map(([k, t]) => <button type="button" key={k} onClick={() => setNiveau(k)} aria-pressed={niveau === k} className={`h-10 rounded-lg border text-[13px] font-semibold ${niveau === k ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-soft"}`}>{t}</button>)}</div>
      </fieldset>
      <label className="block text-[12px] text-ink-soft">Nom (facultatif)<input className={champ} value={nom} maxLength={80} onChange={(e) => setNom(e.target.value)} placeholder="Ma montante du week-end" /></label>
      {cote !== null && (
        <p className="rounded-xl bg-surface-2 p-2.5 text-[12.5px] leading-snug text-ink-soft">
          Il faut une cote d’environ <b className="text-ink">{fr(cote)}</b> à chaque palier. D’après les cotes, environ <b className="text-ink">{Math.round((mise / objectif) * 100)} %</b> de chances d’aller au bout, un peu moins avec la marge du bookmaker. Si un palier perd, tu perds la mise de départ.
        </p>
      )}
      {err && <p className="text-[12.5px] text-loss">{err}</p>}
      <button disabled={!ok || pending} className="flex h-11 w-full items-center justify-center rounded-xl bg-brand text-[13.5px] font-bold text-on-fill disabled:opacity-50">{pending ? "Enregistrement…" : edition ? "Enregistrer les changements" : "Créer la montante"}</button>
      {edition && <button type="button" onClick={() => onFin?.()} className="h-10 w-full rounded-xl border border-line text-[13px] text-ink-soft">Annuler</button>}
    </form>
  );
}
