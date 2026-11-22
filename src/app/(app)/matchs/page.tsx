import Link from "next/link";
import { cookies } from "next/headers";
import { PageHeader } from "@/components/page-header";
import { COMP_FLAG, COMP_ORDER, COMP_SHORT, TeamBadge, shortName } from "@/components/match-ui";
import { bestPick, loadSignals, pickLabel, type Signal } from "@/lib/probs/signals";
import { createClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/live-refresh";
import { FollowStar } from "@/components/follow-star";
import { GoalWatcher } from "@/components/goal-watcher";
import { CompFavori, COOKIE_FAVORIS } from "@/components/comp-favori";
import { STANDING_COMPS } from "@/lib/matches/standings";
import { COMPETITIONS } from "@/lib/competitions";
import { logoEquipe } from "@/lib/logos";

export const dynamic = "force-dynamic";

type Named = { nom: string; code_externe?: string | null } | { nom: string; code_externe?: string | null }[] | null;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
type Comp = { nom: string; code_externe: string | null; pays: string | null };
type Row = {
  id: string; kickoff_at: string; statut: "programme" | "en_cours" | "termine" | "reporte" | "annule";
  score_home: number | null; score_away: number | null; minute: number | null; home_team_id: string; away_team_id: string; home: Named; away: Named;
  af_home_id: number | null; af_away_id: number | null;
  competition: Comp | Comp[] | null;
};
const SELECT = "id, kickoff_at, statut, score_home, score_away, minute, home_team_id, away_team_id, af_home_id, af_away_id, home:teams!matches_home_team_id_fkey(nom, code_externe), away:teams!matches_away_team_id_fkey(nom, code_externe), competition:competitions(nom, code_externe, pays)";

const TZ = "Africa/Abidjan";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ }); // AAAA-MM-JJ
const todayKey = () => dayKey(new Date().toISOString());
const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Match encore « en cours » plus de 3 h 30 après le coup d'envoi : la source n'a pas confirmé la fin. */
const isStale = (kickoff: string) => Date.now() - Date.parse(kickoff) > 3.5 * 3600000;

export default async function MatchsPage({ searchParams }: { searchParams: Promise<{ d?: string; c?: string; f?: string; q?: string; s?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const favoris = new Set(((await cookies()).get(COOKIE_FAVORIS)?.value ?? "").split(",").filter(Boolean));

  const from = new Date(Date.now() - 3 * 86400000), to = new Date(Date.now() + 15 * 86400000);
  // Vue légère de toute la fenêtre (bandeau des jours, direct) : plusieurs centaines de matchs par semaine depuis la vague 1
  const legers: { id: string; kickoff_at: string; statut: Row["statut"]; home_team_id: string; away_team_id: string }[] = [];
  for (let page = 0; page < 4; page++) {
    const { data } = await supabase.from("matches").select("id, kickoff_at, statut, home_team_id, away_team_id")
      .gte("kickoff_at", from.toISOString()).lte("kickoff_at", to.toISOString()).neq("statut", "annule")
      .order("kickoff_at").range(page * 1000, page * 1000 + 999);
    legers.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const counts = new Map<string, number>();
  for (const r of legers) counts.set(dayKey(r.kickoff_at), (counts.get(dayKey(r.kickoff_at)) ?? 0) + 1);
  const days = [...counts.keys()].sort();
  const today = todayKey();
  const day = sp.d && counts.has(sp.d) ? sp.d : days.find((d) => d >= today) ?? days.at(-1) ?? today;
  const comp = sp.c && COMP_ORDER.includes(sp.c) ? sp.c : null;
  const recherche = (sp.q ?? "").trim().slice(0, 40);
  const filtre = recherche.length >= 2 ? "recherche" : sp.f === "direct" || sp.f === "suivis" ? sp.f : null;
  const etat = sp.s === "termines" || sp.s === "programmes" ? sp.s : null;

  // Matchs suivis (étoile) : par l'étoile du match ou parce qu'une de ses équipes est suivie
  const [{ data: fol }, { data: tfol }] = await Promise.all([supabase.from("match_follows").select("match_id"), supabase.from("team_follows").select("team_id")]);
  const teamsFollowed = new Set((tfol ?? []).map((x) => x.team_id));
  const starred = new Set((fol ?? []).map((x) => x.match_id));
  const followed = new Set([...starred, ...legers.filter((r) => teamsFollowed.has(r.home_team_id) || teamsFollowed.has(r.away_team_id)).map((r) => r.id)]);
  const enDirect = legers.filter((r) => r.statut === "en_cours" && !isStale(r.kickoff_at));

  // Lignes complètes : le jour choisi, ou les matchs d'un filtre sur toute la fenêtre
  let rows: Row[] = [];
  if (filtre === "recherche") {
    const q = recherche.replace(/[%_,()]/g, " ");
    const [{ data: teams }, { data: comps }] = await Promise.all([
      supabase.from("teams").select("id").ilike("nom", `%${q}%`).limit(60),
      supabase.from("competitions").select("id, code_externe, nom"),
    ]);
    const nq = sansAccent(recherche);
    const compIds = (comps ?? []).filter((c) => sansAccent(`${c.nom} ${COMP_SHORT[c.code_externe ?? ""] ?? ""} ${COMPETITIONS[c.code_externe ?? ""]?.pays ?? ""}`).includes(nq)).map((c) => c.id);
    const tIds = (teams ?? []).map((t) => t.id);
    const ors = [tIds.length && `home_team_id.in.(${tIds.join(",")})`, tIds.length && `away_team_id.in.(${tIds.join(",")})`, compIds.length && `competition_id.in.(${compIds.join(",")})`].filter(Boolean).join(",");
    if (ors) {
      const { data } = await supabase.from("matches").select(SELECT).or(ors)
        .gte("kickoff_at", new Date(Date.now() - 36 * 3600000).toISOString()).lte("kickoff_at", to.toISOString()).neq("statut", "annule").order("kickoff_at").limit(150);
      rows = (data ?? []) as unknown as Row[];
    }
  } else if (filtre) {
    const ids = filtre === "direct" ? enDirect.map((r) => r.id) : legers.filter((r) => followed.has(r.id) && Date.parse(r.kickoff_at) > Date.now() - 36 * 3600000).map((r) => r.id);
    if (ids.length) rows = ((await supabase.from("matches").select(SELECT).in("id", ids.slice(0, 200)).order("kickoff_at")).data ?? []) as unknown as Row[];
  } else {
    const debut = new Date(`${day}T00:00:00Z`); // Abidjan = UTC
    const { data } = await supabase.from("matches").select(SELECT)
      .gte("kickoff_at", debut.toISOString()).lt("kickoff_at", new Date(debut.getTime() + 86400000).toISOString()).neq("statut", "annule").order("kickoff_at").limit(1000);
    rows = ((data ?? []) as unknown as Row[]).filter((r) => !comp || one(r.competition)?.code_externe === comp)
      .filter((r) => etat === "termines" ? r.statut === "termine" : etat === "programmes" ? r.statut === "programme" || r.statut === "reporte" : true);
  }

  const signals = await loadSignals(supabase, rows.map((r) => r.id));
  const codeDe = (r: Row) => one(r.competition)?.code_externe ?? "?";
  const groups = new Map<string, Row[]>();
  for (const r of rows) groups.set(codeDe(r), [...(groups.get(codeDe(r)) ?? []), r]);
  const paysDe = (code: string) => COMPETITIONS[code]?.pays ?? one(groups.get(code)?.[0]?.competition ?? null)?.pays ?? "Autres";
  // Ordre « les plus proches d'abord » (21/11) : dans chaque compétition, le direct, puis les matchs à venir par heure,
  // puis les terminés ; les compétitions se suivent selon leur prochain match (direct d'abord, toutes terminées en bas).
  const rangStatut = (m: Row) => (m.statut === "en_cours" && !isStale(m.kickoff_at) ? 0 : m.statut === "programme" || m.statut === "reporte" ? 1 : 2);
  for (const l of groups.values()) l.sort((a, b) => rangStatut(a) - rangStatut(b) || (rangStatut(a) === 2 ? Date.parse(b.kickoff_at) - Date.parse(a.kickoff_at) : Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at)));
  const cleGroupe = (code: string) => { const m = groups.get(code)![0]; return [rangStatut(m), rangStatut(m) === 2 ? -Date.parse(m.kickoff_at) : Date.parse(m.kickoff_at)] as const; };
  const ordre = (a: string, b: string) => { const [ra, ka] = cleGroupe(a), [rb, kb] = cleGroupe(b); return ra - rb || ka - kb || (COMP_ORDER.indexOf(a) + 1 || 999) - (COMP_ORDER.indexOf(b) + 1 || 999); };
  const epingles = [...groups.keys()].filter((c) => favoris.has(c)).sort(ordre);
  const autres = [...groups.keys()].filter((c) => !favoris.has(c)).sort(ordre);
  // Tops matchs (21/11) : le direct et les prochains matchs des grandes compétitions et de celles épinglées, 8 au plus
  const tops = filtre || comp || etat === "termines" ? [] : rows
    .filter((m) => (m.statut === "programme" || (m.statut === "en_cours" && !isStale(m.kickoff_at))) && (COMPETITIONS[codeDe(m)]?.majeure || favoris.has(codeDe(m))))
    .sort((a, b) => rangStatut(a) - rangStatut(b) || Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at)).slice(0, 8);
  const q = (d: string, c: string | null) => `/matchs?d=${d}${c ? `&c=${c}` : ""}`;

  const carte = (code: string, list: Row[]) => {
    const nom = COMP_SHORT[code] ?? one(list[0].competition)?.nom ?? code;
    const live = list.filter((m) => m.statut === "en_cours" && !isStale(m.kickoff_at)).length;
    return (
      <details key={code} open={!!filtre || !!comp || etat === "termines"} className="group mb-2 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {/* Le nom prend toute la largeur (22/11 : 22 noms sur 26 étaient coupés) ; le classement passe dans la partie dépliée */}
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-2.5 border-b border-line bg-surface-2 py-1.5 pl-3 pr-1 [&::-webkit-details-marker]:hidden">
          <span className="text-base">{COMP_FLAG[code] ?? "⚽"}</span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[14px] font-bold text-ink">{nom}</span>
            <span className="block text-[11.5px] tabular-nums text-ink-muted">
              {paysDe(code)} · {list.length} match{list.length > 1 ? "s" : ""}{list.find((x) => x.statut === "programme") ? ` · ${fmtTime(list.find((x) => x.statut === "programme")!.kickoff_at)}` : ""}
              {live > 0 && <span className="font-semibold text-loss"> · ● {live} en direct</span>}
            </span>
          </span>
          <CompFavori code={code} initial={favoris.has(code)} nom={nom} />
          <span aria-hidden className="w-4 shrink-0 text-center text-ink-muted transition-transform group-open:rotate-90">›</span>
        </summary>
        {STANDING_COMPS.includes(code) && <Link href={`/matchs/classement?c=${code}`} className="flex items-center justify-between border-b border-line px-3 py-2.5 text-[12.5px] font-semibold text-brand">Classement · {nom}<span aria-hidden>›</span></Link>}
        <ul className="divide-y divide-line">{list.map((m) => <Ligne key={m.id} m={m} sg={signals.get(m.id) ?? null} starred={starred.has(m.id)} avecDate={filtre === "recherche" || filtre === "suivis"} />)}</ul>
      </details>
    );
  };

  return (
    <>
      <LiveRefresh active={rows.some((r) => r.statut === "en_cours" || (r.statut === "programme" && Math.abs(Date.parse(r.kickoff_at) - Date.now()) < 15 * 60000))} />
      <PageHeader ajout aide="matchs" title="Matchs" subtitle="Sur chaque match, l’issue la plus probable d’après les cotes de référence ; en bleu, d’après le modèle quand il n’y a pas de cote." />

      {/* Recherche d'équipe, de compétition ou de pays */}
      <form action="/matchs" className="mb-3 flex gap-2" role="search">
        <input name="q" defaultValue={recherche} placeholder="Équipe, championnat ou pays" aria-label="Rechercher un match" enterKeyHint="search"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm placeholder:text-ink-muted focus:border-brand focus:outline-none" />
        {filtre === "recherche" ? <Link href="/matchs" className="rounded-full border border-line bg-surface px-3 py-2 text-xs text-ink-soft">Effacer</Link>
          : <button className="rounded-full bg-inverse px-4 py-2 text-xs font-medium text-on-inverse">Chercher</button>}
      </form>

      {filtre !== "recherche" && (
        <nav className="-mx-4 mb-3 overflow-x-auto px-4 pb-1" aria-label="Jours">
          <div className="flex w-max gap-1.5">
            {days.map((d) => {
              const dt = new Date(`${d}T12:00:00Z`);
              const label = d === today ? "Auj." : d === dayKey(new Date(Date.now() + 86400000).toISOString()) ? "Demain" : d === dayKey(new Date(Date.now() - 86400000).toISOString()) ? "Hier" : dt.toLocaleDateString("fr-FR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
              const active = d === day && !filtre;
              return (
                <Link key={d} href={q(d, null)} scroll={false} className={`flex w-[54px] flex-col items-center rounded-xl border py-1.5 ${active ? "border-inverse bg-inverse text-on-inverse" : d < today ? "border-line bg-surface-2 text-ink-muted" : "border-line bg-surface text-ink-soft"}`}>
                  <span className="text-[10px] capitalize">{label}</span>
                  <span className="text-base font-semibold leading-tight tabular-nums">{dt.getUTCDate()}</span>
                  <span className={`text-[10px] tabular-nums ${active ? "text-on-inverse opacity-75" : "text-ink-muted"}`}>{counts.get(d)}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      <GoalWatcher scores={rows.filter((r) => r.statut === "en_cours" && r.score_home !== null).map((r) => ({ id: r.id, label: `${shortName(one(r.home)?.nom ?? "")} ${r.score_home}–${r.score_away} ${shortName(one(r.away)?.nom ?? "")}`, h: r.score_home ?? 0, a: r.score_away ?? 0 }))} />

      {filtre !== "recherche" && (
        <div className="-mx-4 mb-3 overflow-x-auto px-4"><div className="flex w-max gap-1.5">
          <Link href={q(day, comp)} scroll={false} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${!filtre && !etat ? "border-brand bg-brand text-on-fill" : "border-line bg-surface text-ink-soft"}`}>Tous</Link>
          <Link href="/matchs?f=direct" scroll={false} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${filtre === "direct" ? "border-loss bg-loss text-on-fill" : "border-line bg-surface text-ink-soft"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${filtre === "direct" ? "bg-surface" : enDirect.length ? "animate-pulse bg-loss" : "bg-slate-300"}`} />En direct{enDirect.length ? ` (${enDirect.length})` : ""}
          </Link>
          <Link href={`${q(day, comp)}&s=programmes`} scroll={false} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${etat === "programmes" && !filtre ? "border-inverse bg-inverse text-on-inverse" : "border-line bg-surface text-ink-soft"}`}>À venir</Link>
          <Link href={`${q(day, comp)}&s=termines`} scroll={false} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${etat === "termines" && !filtre ? "border-inverse bg-inverse text-on-inverse" : "border-line bg-surface text-ink-soft"}`}>Terminés</Link>
          <Link href="/matchs?f=suivis" scroll={false} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${filtre === "suivis" ? "border-inverse bg-inverse text-on-inverse" : "border-line bg-surface text-ink-soft"}`}>★ Suivis{followed.size ? ` (${followed.size})` : ""}</Link>
          {comp && <Link href={q(day, null)} scroll={false} className="truncate rounded-full border border-inverse bg-inverse px-3 py-1.5 text-xs text-on-inverse">{COMP_FLAG[comp]} {COMP_SHORT[comp]} ✕</Link>}
        </div></div>
      )}

      {filtre === "recherche" && <p className="mb-3 px-1 text-xs text-ink-muted">{rows.length ? `${rows.length} match${rows.length > 1 ? "s" : ""} pour « ${recherche} », d’hier aux 14 prochains jours.` : ""}</p>}

      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-muted">
          {filtre === "recherche" ? `Aucun match pour « ${recherche} » d’hier aux 14 prochains jours. Essaie un autre nom (« Galatasaray », « Belgique », « Ligue 2 »).`
            : filtre === "direct" ? "Aucun match en direct pour l’instant." : filtre === "suivis" ? "Aucun match suivi. Touche l’étoile d’un match pour le suivre et recevoir ses buts en notification." : etat === "termines" ? "Aucun match terminé pour l’instant ce jour-là. Les résultats arrivent au fil de la journée."
            : etat === "programmes" ? "Plus aucun match à venir ce jour-là. Regarde le jour suivant."
            : "Aucun match ce jour-là. Le calendrier couvre les 14 prochains jours et se met à jour plusieurs fois par jour."}
        </div>
      )}

      {tops.length > 0 && (
        <section aria-label="Tops matchs" className="mb-4">
          <h2 className="mb-1.5 px-1 text-[15px] font-bold">Tops matchs</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            {tops.map((m) => (
              <li key={m.id}>
                <p className="px-3 pt-1.5 text-[10.5px] font-semibold text-ink-muted">{COMP_FLAG[codeDe(m)] ?? "⚽"} {COMP_SHORT[codeDe(m)] ?? one(m.competition)?.nom}</p>
                <ul><Ligne m={m} sg={signals.get(m.id) ?? null} starred={starred.has(m.id)} avecDate={false} /></ul>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(epingles.length > 0 || autres.length > 0) && !filtre && !comp && <h2 className="mb-1.5 px-1 text-[15px] font-bold">Championnats</h2>}
      {!filtre && !comp && (epingles.length > 0 || autres.length > 0) && <p className="-mt-1 mb-2 px-1 text-[11px] text-ink-muted">Touche un championnat pour voir ses matchs.</p>}
      {epingles.length > 0 && <h2 className="mb-1.5 px-1 text-xs font-semibold text-ink-soft">Mes compétitions</h2>}
      {epingles.map((c) => carte(c, groups.get(c)!))}
      {epingles.length > 0 && autres.length > 0 && <h2 className="mb-1.5 mt-3 px-1 text-xs font-semibold text-ink-soft">Toutes les compétitions</h2>}
      {autres.map((c) => carte(c, groups.get(c)!))}
      {rows.length > 0 && !epingles.length && <p className="px-1 text-[11px] text-ink-muted">Touche l’étoile d’une compétition pour l’épingler en haut de la liste.</p>}
    </>
  );
}

/** Choix en version courte pour la colonne de droite (comme les cotes d'une ligne Flashscore). */
function court(market: string, param: number | null, sel: string): string {
  const v = param === null ? "" : String(param).replace(".", ",");
  if (market === "1X2" || market === "DC") return sel === "N" ? "N" : sel === "1N" ? "1N" : sel === "N2" ? "N2" : sel;
  if (market === "OU") return `${sel === "Plus" ? "+" : "−"}${v} buts`;
  if (market === "BTTS") return sel === "Oui" ? "2 marquent" : "Pas les 2";
  if (market === "DNB") return `${sel} RSN`;
  if (market === "TT1" || market === "TT2") return `${market === "TT1" ? "Dom." : "Ext."} ${sel === "Plus" ? "+" : "−"}${v}`;
  if (market.startsWith("HT_")) return `MT ${court(market.slice(3), param, sel)}`;
  return sel;
}

/** Une ligne de match à la manière de Flashscore : heure, deux équipes avec écusson, score, puis le choix le plus probable. */
function Ligne({ m, sg, starred, avecDate }: { m: Row; sg: Signal | null; starred: boolean; avecDate: boolean }) {
  const H = one(m.home), A = one(m.away);
  const h = H?.nom ?? "", a = A?.nom ?? "";
  const done = m.statut === "termine";
  const live = m.statut === "en_cours" && m.score_home !== null;
  const homeWin = done && (m.score_home ?? 0) > (m.score_away ?? 0), awayWin = done && (m.score_away ?? 0) > (m.score_home ?? 0);
  const p = sg && !done && !live ? bestPick(sg) : null;
  const equipe = (nom: string, logo: string | null, gras: boolean, score: number | null) => (
    <span className="flex items-center gap-2">
      <TeamBadge name={nom} size={18} logo={logo} />
      <span className={`min-w-0 flex-1 truncate text-[13.5px] leading-tight ${gras ? "font-semibold text-ink" : "text-ink-soft"}`}>{nom}</span>
      {(done || live) && <span className={`w-5 text-right font-display text-[15px] font-bold tabular-nums ${live ? "text-loss" : gras ? "text-ink" : "text-ink-soft"}`}>{score}</span>}
    </span>
  );
  return (
    <li className="flex items-center">
      <span className="w-7 shrink-0 pl-0.5">{!done && <FollowStar matchId={m.id} initial={starred} small />}</span>
      <Link href={`/matchs/${m.id}`} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 active:bg-surface-2">
        <span className="w-10 shrink-0 text-center text-[12px] leading-tight tabular-nums">
          {avecDate && <span className="block text-[10px] text-ink-muted">{fmtJour(m.kickoff_at)}</span>}
          {done ? <span className="text-ink-muted">Fin</span>
            : m.statut === "en_cours" && isStale(m.kickoff_at) ? <span className="text-[10px] text-draw" title="La source n’a pas encore confirmé la fin du match">Fin ?</span>
            : m.statut === "en_cours" ? <span className="font-semibold text-loss">{m.minute ? `${m.minute}’` : "Live"}</span>
            : m.statut === "reporte" ? <span className="text-draw">Rep.</span>
            : <span className="text-ink-soft">{fmtTime(m.kickoff_at)}</span>}
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          {equipe(h, logoEquipe({ af: m.af_home_id, code: H?.code_externe }), homeWin || !done, m.score_home)}
          {equipe(a, logoEquipe({ af: m.af_away_id, code: A?.code_externe }), awayWin || !done, m.score_away)}
        </span>
        {!done && !live && (
          p && sg ? (
            <span className={`flex w-[62px] shrink-0 flex-col items-center rounded-md py-1 leading-tight ${sg.source === "modele" ? "bg-brand-soft text-brand" : p.p >= 0.75 ? "bg-inverse text-on-inverse" : "bg-surface-2 text-ink-soft"}`}
              title={`${pickLabel(p.market, p.param, p.sel, h, a)} · ${sg.source === "modele" ? "modèle, faute de cote" : "d’après les cotes de référence"}`}>
              <span className="max-w-full truncate px-1 text-[10px] font-semibold">{court(p.market, p.param, p.sel)}</span>
              <span className="text-[13px] font-bold tabular-nums">{Math.round(p.p * 100)} %</span>
              {p.cote && <span className="text-[9.5px] tabular-nums opacity-80">{p.cote.toFixed(2).replace(".", ",")}</span>}
            </span>
          ) : <span className="w-[62px] shrink-0 text-center text-[9.5px] leading-tight text-ink-muted">pas encore d’analyse</span>
        )}
      </Link>
    </li>
  );
}

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const fmtJour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", timeZone: TZ }).replace(".", "");
