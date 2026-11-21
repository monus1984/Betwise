/**
 * Une proposition (marché, probabilité, cote, niveau de risque), réutilisée par l'accueil Prédictions.
 * Composant sans état : utilisable côté serveur et dans les composants client.
 */
import Link from "next/link";
import { AddToSlip } from "@/components/slip";
import { legFrom } from "@/lib/slip/leg";
import { CAT_COTES, CAT_LABEL, type Categorie } from "@/lib/coach/categories";
import { COUVERTURE_FR } from "@/lib/accueil/regles";
import type { Proposition } from "@/lib/accueil/load";

export const pct = (p: number) => `${Math.round(p * 100)} %`;
export const cote = (x: number) => x.toFixed(2).replace(".", ",");
export const heure = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
export const jourCourt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", timeZone: "Africa/Abidjan" });

/** Niveau de risque : toujours écrit, la couleur ne fait que l'accompagner. */
export const PROFIL_STYLE: Record<Categorie, string> = {
  sur: "bg-gain-soft text-gain-ink",
  audacieux: "bg-brand-soft text-brand",
  risque: "bg-draw-soft text-draw-ink",
};

export function ProfilPastille({ profil }: { profil: Categorie }) {
  return <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ${PROFIL_STYLE[profil]}`}>{CAT_LABEL[profil]}</span>;
}

export function legDe(x: Proposition) {
  return legFrom({ matchId: x.matchId, home: x.home, away: x.away, kickoff: x.kickoff, comp: x.comp ?? "", market: x.market, param: x.param, sel: x.sel, p: x.p, cote: x.refCote, book: x.book, label: x.label });
}

/** Petit anneau de probabilité. */
export function Anneau({ p, taille = 52 }: { p: number; taille?: number }) {
  const r = taille / 2 - 5, tour = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: taille, height: taille }}>
      <svg viewBox={`0 0 ${taille} ${taille}`} width={taille} height={taille} aria-hidden>
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" className="stroke-surface-2" strokeWidth="5" />
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" className="stroke-brand" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${p * tour} ${tour}`} transform={`rotate(-90 ${taille / 2} ${taille / 2})`} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-[17px] font-bold">{Math.round(p * 100)}<span className="text-[10px]">%</span></span>
    </span>
  );
}

/** Ligne de cote : bookmaker ou médiane, avec l'heure du relevé ; « estimation » quand il n'y a pas de cote. */
export function LigneCote({ x }: { x: Proposition }) {
  return (
    <span className="text-[11px] text-ink-muted">
      {x.cote ? <>{x.cote.ou} <b className="text-ink">{cote(x.cote.cote)}</b>{x.cote.age ? ` · ${x.cote.age}` : ""}</> : "Pas de cote : estimation du modèle"}
      {" · "}{COUVERTURE_FR[x.couverture]}
    </span>
  );
}

/** Carte d'une proposition mise en avant (meilleures options du jour). */
export function CarteProposition({ x }: { x: Proposition }) {
  return (
    <article className="tile flex h-full flex-col gap-2.5 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] text-ink-muted">{x.home} – {x.away}</span>
        <span className="shrink-0 text-[11px] text-ink-muted">{jourCourt(x.kickoff)} · {heure(x.kickoff)}</span>
      </div>
      <div className="flex items-center gap-3">
        <Anneau p={x.p} />
        <span className="min-w-0">
          <span className="block text-[10.5px] text-ink-muted">{x.marche}</span>
          <span className="block text-[15px] font-bold leading-snug">{x.label}</span>
        </span>
      </div>
      <LigneCote x={x} />
      <p className="text-[11.5px] leading-snug text-ink-soft">Perd {100 - Math.round(x.p * 100)} fois sur 100. Niveau {CAT_LABEL[x.profil]} ({CAT_COTES[x.profil]}).</p>
      <div className="mt-auto flex items-center gap-2">
        <Link href={`/matchs/${x.matchId}`} className="flex h-10 flex-1 items-center justify-center rounded-xl bg-brand text-[13px] font-bold text-on-fill active:opacity-90">Voir l’analyse</Link>
        <AddToSlip leg={legDe(x)} />
      </div>
    </article>
  );
}

/** Ligne compacte d'une proposition, dans une carte de match. */
export function LigneProposition({ x }: { x: Proposition }) {
  return (
    <div className="flex items-center gap-2.5 py-2">
      <ProfilPastille profil={x.profil} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-snug">{x.label}</span>
        <span className="block text-[10.5px] text-ink-muted">{x.marche}{x.cote ? ` · ${x.cote.ou.replace(/^Cote/, "cote")} ${cote(x.cote.cote)}` : " · estimation"}</span>
      </span>
      <span className="shrink-0 font-display text-lg font-bold">{pct(x.p)}</span>
      <AddToSlip leg={legDe(x)} size="sm" />
    </div>
  );
}
