import { BetsterAnime } from "@/components/betster-anime";
/**
 * Blocs du nouvel accueil (maquettes validées le 19/11 : docs/design/accueil/maquettes/).
 * Probabilité, couverture et fraîcheur sont toujours séparées ; aucune « convergence » affichée (D12).
 */
import Link from "next/link";
import { APP_NAME } from "@/lib/app-name";
import { TeamBadge, COMP_SHORT } from "@/components/match-ui";
import { LigneProposition, heure, jourCourt, pct } from "@/components/proposition";
import { COUVERTURE_FR } from "@/lib/accueil/regles";
import type { CarteMatch, MatchAVenir, TipsterDuJour } from "@/lib/accueil/load";


/** Betster, nom de travail du personnage IA. Une seule image pour l'instant : l'expression est calculée et exposée,
 * l'image changera quand les trois expressions seront livrées (docs/brand/betster-character-bible.md). */
export function Betster({ expression, taille = 56 }: { expression: string; taille?: number }) {
  return <span data-expression={expression} className="inline-flex shrink-0"><BetsterAnime etat="repos" taille={taille} /></span>;
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
    <article className="tile flex flex-col gap-2.5 p-3">
      <Link href={`/matchs/${c.id}`} className="flex flex-col gap-2.5">
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
            <div key={nom} className="flex items-center gap-2"><TeamBadge name={nom} size={24} /><span className="flex-1 text-[14.5px] font-semibold leading-tight">{nom}</span>{sc !== undefined && <span className="font-display text-xl font-bold tabular-nums">{sc}</span>}</div>
          ))}
        </div>
        {c.probs && <Barre p={c.probs} />}
      </Link>
      {c.probs && c.choix ? (
        <>
          {c.statut === "programme" && c.propositions.length > 0 ? (
            <div className="divide-y divide-line border-t border-line">{c.propositions.map((x) => <LigneProposition key={`${x.market}|${x.param}|${x.sel}`} x={x} />)}</div>
          ) : (
            <div className="flex flex-col gap-1 border-t border-line pt-2">
              <span className="text-[10.5px] text-ink-muted">{c.choix.marche}</span>
              <span className="text-[13px] font-semibold">{c.choix.label} <span className="font-medium text-ink-muted">· {pct(c.choix.p)}</span></span>
              {direct && <span className="text-[10.5px] text-ink-muted">Probabilité d’avant le match</span>}
              {c.verdict && <span className={`text-[11.5px] font-semibold ${c.verdict === "passe" ? "text-gain" : "text-loss"}`}>{c.verdict === "passe" ? "Passé" : "Pas passé"} · annoncé à {pct(c.choix.p)}</span>}
            </div>
          )}
          {c.statut === "programme" && <Pourquoi p={c.pourquoi} />}
          <p className="flex items-center justify-between gap-2 text-[10.5px] text-ink-muted">
            <span>{COUVERTURE_FR[c.couverture]}{c.choix.cote?.age ? ` · cotes relevées ${c.choix.cote.age}` : ""}</span>
            {c.statut === "programme" && <Link href={`/matchs/${c.id}?v=marches`} className="shrink-0 font-semibold text-brand">Toutes les options ›</Link>}
          </p>
        </>
      ) : (
        <p className="flex items-start gap-2 rounded-xl bg-surface-2 p-2.5 text-[12px] leading-snug text-ink-soft">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="mt-px shrink-0 text-ink-muted"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.5" /></svg>
          <span><b className="text-ink">Analyse statistique indisponible.</b> Ni cote ni modèle sur cette compétition pour l’instant ; le score et les pronos de tes tipsters restent suivis.</span>
        </p>
      )}
    </article>
  );
}

/** Bandeau de Betster : salutation, synthèse calculée de la journée, heure de mise à jour, accès à la conversation. */
export { BandeauBetster } from "@/components/betster-bandeau";

/** Demain et les prochains jours : les matchs analysés, deux propositions chacun. */
export function Demain({ matchs, titre, total }: { matchs: MatchAVenir[]; titre: string; total: number }) {
  if (!matchs.length) return null;
  return (
    <section aria-label={titre} className="mt-6 flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2"><h2 className="text-[17px] font-bold">{titre}</h2><span className="text-[11.5px] text-ink-muted">{matchs.length} analysé{matchs.length > 1 ? "s" : ""}{total > matchs.length ? ` sur ${total}` : ""}</span></div>
      {matchs.slice(0, 5).map((m) => (
        <article key={m.matchId} className="tile p-3">
          <Link href={`/matchs/${m.matchId}`} className="flex items-center justify-between gap-2">
            <span className="min-w-0"><span className="block text-[14px] font-semibold leading-tight">{m.home} – {m.away}</span><span className="block text-[11px] text-ink-muted">{COMP_SHORT[m.comp ?? ""] ?? m.comp} · {jourCourt(m.kickoff)} {heure(m.kickoff)}</span></span>
            <span aria-hidden className="text-brand">›</span>
          </Link>
          <div className="mt-1 divide-y divide-line">{m.propositions.map((x) => <LigneProposition key={`${x.market}|${x.param}|${x.sel}`} x={x} />)}</div>
          <Pourquoi p={m.pourquoi} />
        </article>
      ))}
      {matchs.length > 5 && <Link href="/matchs" className="flex h-11 items-center justify-center rounded-xl border border-line text-[13.5px] font-semibold">Tous les matchs</Link>}
    </section>
  );
}

/** Raccourcis du Coach : bankroll, budget et objectifs, mes paris, conversation (D14). */
export function RaccourcisCoach({ solde, sept, budget, paris, vigilance, nouveau, masque }: { solde: React.ReactNode; sept: React.ReactNode | null; budget: React.ReactNode | null; paris: string; vigilance: { titre: string; href: string } | null; nouveau: boolean; masque: React.ReactNode }) {
  const tuile = "tile flex min-h-[84px] flex-col justify-between gap-1 p-3 active:bg-surface-2";
  return (
    <section aria-label="Mon Coach" className="mt-6">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-[17px] font-bold">Mon Coach</h2>{masque}</div>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/bankroll" className={tuile}><span className="text-[11.5px] text-ink-muted">Bankroll</span><span className="text-[20px] font-extrabold leading-tight tabular-nums">{nouveau ? "À créer" : solde}</span>{sept && <span className="text-[11px] text-ink-soft">{sept} sur 7 jours</span>}</Link>
        <Link href="/coach?v=outils" className={tuile}><span className="text-[11.5px] text-ink-muted">Budget et objectifs</span><span className="text-[14px] font-bold leading-snug">{budget ?? "À fixer"}</span></Link>
        <Link href="/paris" className={tuile}><span className="text-[11.5px] text-ink-muted">Mes paris</span><span className="text-[14px] font-bold leading-snug">{paris}</span></Link>
        <Link href="/coach?v=discussion" className={`${tuile} border-brand/40 bg-brand-soft`}><span className="text-[11.5px] text-ink-muted">Conversation</span><span className="text-[14px] font-bold leading-snug text-brand">Écrire à Betster ›</span></Link>
      </div>
      {vigilance && (
        <Link href={vigilance.href} className="mt-2 flex items-start gap-2 rounded-xl bg-draw-soft p-2.5 text-draw-ink">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-px shrink-0"><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4.5M12 17.3v.2" /></svg>
          <span className="text-[12px] leading-snug"><b>Point de vigilance.</b> {vigilance.titre}</span>
        </Link>
      )}
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

/** Pourquoi ces propositions : la forme et le face-à-face, quand l'historique existe. Rien sinon. */
export function Pourquoi({ p }: { p: import("@/lib/matches/justification").Pourquoi | null | undefined }) {
  const l = p ? [p.forme, p.face, p.buts].filter(Boolean) as string[] : [];
  if (!l.length) return null;
  return (
    <ul className="space-y-1 rounded-xl bg-surface-2 px-2.5 py-2 text-[11.5px] leading-snug text-ink-soft" aria-label="Pourquoi">
      {l.map((x) => <li key={x} className="flex gap-1.5"><span aria-hidden className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-brand" />{x}</li>)}
    </ul>
  );
}
