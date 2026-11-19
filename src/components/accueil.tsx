/**
 * Blocs du nouvel accueil (maquettes validées le 19/11 : docs/design/accueil/maquettes/).
 * Probabilité, couverture et fraîcheur sont toujours séparées ; aucune « convergence » affichée (D12).
 */
import Link from "next/link";
import { APP_NAME } from "@/lib/app-name";
import { TeamBadge, COMP_SHORT } from "@/components/match-ui";
import { AddToSlip } from "@/components/slip";
import { legFrom } from "@/lib/slip/leg";
import { COUVERTURE_FR } from "@/lib/accueil/regles";
import type { Avis, CarteMatch, TipsterDuJour } from "@/lib/accueil/load";
import type { Repli } from "@/lib/coach/today";

const pct = (p: number) => `${Math.round(p * 100)} %`;
const cote = (x: number) => x.toFixed(2).replace(".", ",");
const heure = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const jourCourt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", timeZone: "Africa/Abidjan" });

/** Betster, nom de travail du personnage IA. Une seule image pour l'instant : l'expression est calculée et exposée,
 * l'image changera quand les trois expressions seront livrées (docs/brand/betster-character-bible.md). */
export function Betster({ expression, taille = 56 }: { expression: string; taille?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/betster/betster-112.webp" alt="Betster" width={taille} height={taille} data-expression={expression}
      className="shrink-0 rounded-full ring-2 ring-brand/70" style={{ width: taille, height: taille }} />
  );
}

function legDe(c: CarteMatch) {
  const ch = c.choix!;
  return legFrom({ matchId: c.id, home: c.home, away: c.away, kickoff: c.kickoff, comp: c.comp ?? "", market: ch.market, param: ch.param, sel: ch.sel, p: ch.p, cote: ch.refCote, book: ch.book, label: ch.label });
}

/** L'avis de Betster : premier coup du jour Audacieux, sinon Sûr (D10). */
export function AvisBetster({ a }: { a: Avis }) {
  const ch = a.choix!;
  const tour = 2 * Math.PI * 29, plein = Math.round(ch.p * tour);
  return (
    <section aria-label="L'avis de Betster" className="card-hero flex flex-col gap-3.5 rounded-[22px] p-4">
      <div className="flex items-start gap-3">
        <Betster expression={a.expression} />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-brand">L’avis de Betster</p>
          <p className="mt-0.5 text-[15px] font-semibold leading-snug">{ch.label} : c’est ma sélection la plus probable du jour, à cote moyenne.</p>
        </div>
      </div>
      <div className="flex items-center gap-3.5 rounded-2xl bg-surface/40 p-3">
        <div className="relative h-[68px] w-[68px] shrink-0">
          <svg viewBox="0 0 68 68" width="68" height="68" aria-hidden><circle cx="34" cy="34" r="29" fill="none" className="stroke-line" strokeWidth="7" /><circle cx="34" cy="34" r="29" fill="none" className="stroke-brand" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${plein} ${Math.round(tour)}`} transform="rotate(-90 34 34)" /></svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-2xl font-bold leading-none">{pct(ch.p)}</span><span className="text-[9px] text-ink-soft">de chance</span></span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight">{ch.label}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-ink-soft">{a.home} – {a.away} · {COMP_SHORT[a.comp ?? ""] ?? a.comp} · {heure(a.kickoff)}</p>
          <p className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
            {ch.cote && <span className="rounded-md bg-surface/60 px-1.5 py-0.5">{ch.cote.ou} {cote(ch.cote.cote)}{ch.cote.age ? ` · ${ch.cote.age}` : ""}</span>}
            <span className="rounded-md bg-surface/60 px-1.5 py-0.5">{COUVERTURE_FR[a.couverture]}</span>
          </p>
        </div>
      </div>
      <p className="text-[11.5px] leading-snug text-ink-soft">Ce choix perd {a.perdSur100} fois sur 100. Choisi parmi les coups du jour à cote moyenne : la plus forte probabilité. Ce n’est pas un calcul de valeur de la cote.</p>
      <div className="flex items-center gap-2">
        <Link href={`/matchs/${a.id}`} className="flex h-11 flex-1 items-center justify-center rounded-xl bg-brand text-[13.5px] font-bold text-on-fill active:opacity-90">Voir l’analyse</Link>
        <AddToSlip leg={legDe(a)} label="Ajouter au coupon" />
      </div>
      <Link href="/coach" className="self-center text-[12px] font-medium text-brand">Les autres coups du jour ›</Link>
    </section>
  );
}

/** Barre 1 / N / 2 : l'issue la plus probable en couleur, les autres en gris, les chiffres écrits dessous. */
function Barre({ p }: { p: { p1: number; pN: number; p2: number } }) {
  const max = Math.max(p.p1, p.pN, p.p2);
  const seg = (x: number) => <span className={`block h-2 ${x === max ? "bg-brand" : "bg-surface-2"}`} style={{ width: `${x * 100}%` }} />;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-0.5 overflow-hidden rounded" aria-hidden>{seg(p.p1)}{seg(p.pN)}{seg(p.p2)}</div>
      <p className="grid grid-cols-3 text-[11px] text-ink-muted"><span>1 · {pct(p.p1)}</span><span className="text-center">N · {pct(p.pN)}</span><span className="text-right">2 · {pct(p.p2)}</span></p>
    </div>
  );
}

export function CarteMatchUI({ c }: { c: CarteMatch }) {
  const direct = c.statut === "en_cours", fini = c.statut === "termine";
  return (
    <Link href={`/matchs/${c.id}`} className="tile flex flex-col gap-2.5 p-3 active:bg-surface-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-ink-muted">{COMP_SHORT[c.comp ?? ""] ?? c.comp} · {heure(c.kickoff)}</span>
        <span className="flex shrink-0 gap-1.5">
          {c.tonPari && <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[10.5px] font-bold text-brand">Ton pari</span>}
          {direct && <span className="rounded-md bg-draw-soft px-1.5 py-0.5 text-[10.5px] font-bold text-draw-ink">En direct{c.minute ? ` · ${c.minute}e` : ""}</span>}
          {fini && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-bold text-ink-soft">Terminé</span>}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {([[c.home, c.score?.[0]], [c.away, c.score?.[1]]] as const).map(([nom, sc]) => (
          <div key={nom} className="flex items-center gap-2"><TeamBadge name={nom} size={24} /><span className="flex-1 truncate text-sm font-semibold">{nom}</span>{sc !== undefined && <span className="font-display text-xl font-bold tabular-nums">{sc}</span>}</div>
        ))}
      </div>
      {c.probs && c.choix ? (
        <>
          <Barre p={c.probs} />
          <div className="flex flex-col gap-1 border-t border-line pt-2">
            <span className="text-[10.5px] text-ink-muted">{c.choix.marche}</span>
            <span className="text-[13px] font-semibold">{c.choix.label} <span className="font-medium text-ink-muted">· {pct(c.choix.p)}</span></span>
            <span className="text-[10.5px] text-ink-muted">{COUVERTURE_FR[c.couverture]}{c.choix.cote ? ` · ${c.choix.cote.ou.replace(/^Cote/, "cote")} ${cote(c.choix.cote.cote)}${c.choix.cote.age ? `, relevée ${c.choix.cote.age}` : ""}` : " · pas de cote"}{direct ? " · probabilité d’avant le match" : ""}</span>
            {c.verdict && <span className={`text-[11.5px] font-semibold ${c.verdict === "passe" ? "text-gain" : "text-loss"}`}>{c.verdict === "passe" ? "Passé" : "Pas passé"} · annoncé à {pct(c.choix.p)}</span>}
          </div>
        </>
      ) : (
        <p className="flex items-start gap-2 rounded-xl bg-surface-2 p-2.5 text-[12px] leading-snug text-ink-soft">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="mt-px shrink-0 text-ink-muted"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.5" /></svg>
          <span><b className="text-ink">Pas d’analyse pour ce match.</b> Ni cote ni modèle sur cette compétition pour l’instant.</span>
        </p>
      )}
    </Link>
  );
}

/** Jour creux : rien d'analysé aujourd'hui ; les meilleures probabilités des prochains jours. */
export function JourCreux({ repli }: { repli: Repli[] }) {
  return (
    <section aria-label="L'avis de Betster" className="card-hero flex flex-col gap-3 rounded-[22px] p-4">
      <div className="flex items-start gap-3">
        <Betster expression="neutre" />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-brand">L’avis de Betster</p>
          <p className="mt-0.5 text-[15px] font-semibold leading-snug">{repli.length ? "Pas de match analysé aujourd’hui. Voici ce que je vois pour les prochains jours." : "Pas de match analysé pour l’instant. Tu peux importer un ticket ou parcourir le calendrier."}</p>
        </div>
      </div>
      {repli.length > 0 && (
        <ul className="divide-y divide-line/60 rounded-2xl bg-surface/40">
          {repli.map((r) => (
            <li key={r.matchId + r.selection}><Link href={`/matchs/${r.matchId}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{r.selection}</span><span className="block truncate text-[11px] text-ink-soft">{r.match} · {jourCourt(r.kickoff)} {heure(r.kickoff)}</span></span>
              <span className="shrink-0 text-right"><span className="block text-[13px] font-bold">{pct(r.p)}</span><span className="block text-[10px] text-ink-soft">{r.estimation ? "estimation du modèle" : `cote ${cote(r.cote!)}`}</span></span>
            </Link></li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Link href="/matchs" className="flex h-11 flex-1 items-center justify-center rounded-xl bg-brand text-[13.5px] font-bold text-on-fill">Voir le calendrier</Link>
        <Link href="/import" className="flex h-11 flex-1 items-center justify-center rounded-xl border border-line text-[13.5px] font-semibold">Importer un ticket</Link>
      </div>
    </section>
  );
}

export function ImportCarte() {
  return (
    <section aria-label="Importer un ticket" className="flex items-center gap-3 rounded-[20px] border-[1.5px] border-dashed border-brand p-3.5">
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand"><IconeScan /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold">Importer un ticket</span><span className="block text-[11.5px] text-ink-muted">Capture, texte copié ou vidéo d’écran</span></span>
      <Link href="/import" className="flex h-10 items-center rounded-xl bg-brand px-3.5 text-[13px] font-bold text-on-fill">Scanner</Link>
    </section>
  );
}

export function IconeScan() {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 8V6a2 2 0 0 1 2-2h2" /><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M20 16v2a2 2 0 0 1-2 2h-2" /><path d="M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M8 10h8M8 14h5" /></svg>;
}

/** Ce que disent les tipsters suivis sur les matchs du jour, face à BETWISE, avec le niveau de preuve. */
export function TipstersDuJour({ t }: { t: TipsterDuJour[] }) {
  if (!t.length) return null;
  const badge = (x: TipsterDuJour) => x.aussiBetwise ? ["Comme Betster", "bg-gain-soft text-gain-ink"]
    : x.p === null ? ["Pas d’analyse", "bg-surface-2 text-ink-soft"]
    : [`${APP_NAME} : ${pct(x.p)}`, x.tone === "good" ? "bg-gain-soft text-gain-ink" : x.tone === "mid" ? "bg-draw-soft text-draw-ink" : "bg-loss-soft text-loss-ink"];
  return (
    <section aria-label="Ce que disent tes tipsters" className="mt-6">
      <div className="mb-2.5 flex items-baseline justify-between"><h2 className="text-[17px] font-bold">Ce que disent tes tipsters</h2><Link href="/sources" className="text-[12px] font-semibold text-brand">Tous ›</Link></div>
      <ul className="tile divide-y divide-line">
        {t.map((x, i) => { const [txt, cls] = badge(x); return (
          <li key={i} className="flex items-center justify-between gap-2.5 p-3">
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold">{x.qui}</span>
              <span className="block text-[12px] text-ink-soft">{x.match} · {x.marche.replace("Autre marché : ", "")} : {x.selection}</span>
              <span className="block text-[10.5px] text-ink-muted">{x.publieAvant === true ? "Publié avant le match, heure vérifiée" : x.publieAvant === false ? "Ajouté après le coup d’envoi" : "Heure de publication non vérifiée"}</span>
            </span>
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ${cls}`}>{txt}</span>
          </li>); })}
      </ul>
    </section>
  );
}

/** Nouvel abonné : trois étapes pour démarrer. */
export function Bienvenue() {
  const etapes = [
    ["1", "Importe ton premier ticket", `Une capture suffit : ${APP_NAME} le lit et le règle seul.`, "/import"],
    ["2", "Suis un tipster", "Ses pronos sont notés sur leurs vrais résultats.", "/sources"],
    ["3", "Fixe ton budget de la semaine", "Ton coach te prévient avant que tu le dépasses.", "/coach?v=outils"],
  ];
  return (
    <section aria-label="Bien démarrer" className="tile mt-3.5 flex flex-col gap-3 p-3.5">
      <h2 className="text-[17px] font-bold">Bien démarrer</h2>
      {etapes.map(([n, titre, texte, href]) => (
        <Link key={n} href={href} className="flex items-center gap-3">
          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-extrabold text-brand">{n}</span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{titre}</span><span className="block text-[12px] text-ink-muted">{texte}</span></span>
          <span aria-hidden className="text-brand">›</span>
        </Link>
      ))}
    </section>
  );
}
