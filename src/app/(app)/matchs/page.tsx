import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { COMP_FLAG, COMP_ORDER, COMP_SHORT, PickBadge, TeamBadge, shortName } from "@/components/match-ui";
import { bestPick, loadSignals, pickLabel, picksOf } from "@/lib/probs/signals";
import { createClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/live-refresh";

export const dynamic = "force-dynamic";

type Named = { nom: string } | { nom: string }[] | null;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
type Row = {
  id: string; kickoff_at: string; statut: "programme" | "en_cours" | "termine" | "reporte" | "annule";
  score_home: number | null; score_away: number | null; minute: number | null; home: Named; away: Named;
  competition: { nom: string; code_externe: string | null } | { nom: string; code_externe: string | null }[] | null;
};

const TZ = "Africa/Abidjan";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ }); // AAAA-MM-JJ
const todayKey = () => dayKey(new Date().toISOString());

export default async function MatchsPage({ searchParams }: { searchParams: Promise<{ d?: string; c?: string; top?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  const from = new Date(Date.now() - 3 * 86400000), to = new Date(Date.now() + 15 * 86400000);
  const { data } = await supabase
    .from("matches")
    .select("id, kickoff_at, statut, score_home, score_away, minute, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(nom, code_externe)")
    .gte("kickoff_at", from.toISOString()).lte("kickoff_at", to.toISOString())
    .neq("statut", "annule").order("kickoff_at").limit(400);
  const all = (data ?? []) as unknown as Row[];

  // Bandeau des jours : uniquement les jours qui ont des matchs
  const counts = new Map<string, number>();
  for (const r of all) counts.set(dayKey(r.kickoff_at), (counts.get(dayKey(r.kickoff_at)) ?? 0) + 1);
  const days = [...counts.keys()].sort();
  const today = todayKey();
  const day = sp.d && counts.has(sp.d) ? sp.d : days.find((d) => d >= today) ?? days.at(-1) ?? today;
  const comp = sp.c && COMP_ORDER.includes(sp.c) ? sp.c : null;

  const rows = all.filter((r) => dayKey(r.kickoff_at) === day && (!comp || one(r.competition)?.code_externe === comp));
  const ids = rows.map((r) => r.id);

  const signals = await loadSignals(supabase, ids);
  const seuil = [70, 80, 85].includes(Number(sp.top)) ? Number(sp.top) : null;

  // Vue « Les plus probables » : au plus deux sélections par match, de marchés différents, au-dessus du seuil
  const top = seuil === null ? [] : rows.filter((r) => r.statut === "programme").flatMap((r) => {
    const sg = signals.get(r.id); if (!sg) return [];
    const seen = new Set<string>();
    return picksOf(sg).filter((p) => p.p >= seuil / 100 && p.p <= 0.95 && !seen.has(p.market) && seen.add(p.market)).slice(0, 2).map((p) => ({ r, sg, p }));
  }).sort((x, y) => y.p.p - x.p.p);

  // Groupes par compétition, dans un ordre fixe
  const groups = new Map<string, Row[]>();
  for (const r of rows) { const k = one(r.competition)?.code_externe ?? "?"; groups.set(k, [...(groups.get(k) ?? []), r]); }
  const ordered = [...groups.entries()].sort((a, b) => COMP_ORDER.indexOf(a[0]) - COMP_ORDER.indexOf(b[0]));
  const compsOfDay = [...new Set(all.filter((r) => dayKey(r.kickoff_at) === day).map((r) => one(r.competition)?.code_externe ?? "?"))].sort((a, b) => COMP_ORDER.indexOf(a) - COMP_ORDER.indexOf(b));
  const q = (d: string, c: string | null, t: number | null = seuil) => `/matchs?d=${d}${c ? `&c=${c}` : ""}${t ? `&top=${t}` : ""}`;

  return (
    <>
      <LiveRefresh active={rows.some((r) => r.statut === "en_cours" || (r.statut === "programme" && Math.abs(Date.parse(r.kickoff_at) - Date.now()) < 15 * 60000))} />
      <PageHeader title="Matchs" subtitle="Sur chaque match, l’issue la plus probable d’après les cotes de référence ; en bleu, d’après le modèle quand il n’y a pas de cote." />

      {/* Bandeau des jours */}
      <nav className="-mx-4 mb-3 overflow-x-auto px-4 pb-1" aria-label="Jours">
        <div className="flex w-max gap-1.5">
          {days.map((d) => {
            const dt = new Date(`${d}T12:00:00Z`);
            const label = d === today ? "Auj." : d === dayKey(new Date(Date.now() + 86400000).toISOString()) ? "Demain" : d === dayKey(new Date(Date.now() - 86400000).toISOString()) ? "Hier" : dt.toLocaleDateString("fr-FR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
            const active = d === day;
            return (
              <Link key={d} href={q(d, null)} scroll={false} className={`flex w-[54px] flex-col items-center rounded-xl border py-1.5 ${active ? "border-ink bg-ink text-white" : d < today ? "border-line bg-surface-2 text-ink-muted" : "border-line bg-white text-ink-soft"}`}>
                <span className="text-[10px] capitalize">{label}</span>
                <span className="text-base font-semibold leading-tight tabular-nums">{dt.getUTCDate()}</span>
                <span className={`text-[10px] tabular-nums ${active ? "text-white/70" : "text-ink-muted"}`}>{counts.get(d)}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Tous les matchs / Les plus probables */}
      <div className="mb-3 flex items-center gap-1.5 overflow-x-auto">
        <Link href={q(day, comp, null)} scroll={false} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${seuil === null ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-soft"}`}>Tous les matchs</Link>
        <Link href={q(day, comp, seuil ?? 80)} scroll={false} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${seuil !== null ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-soft"}`}>⚡ Les plus probables</Link>
        {seuil !== null && [70, 80, 85].map((t) => (
          <Link key={t} href={q(day, comp, t)} scroll={false} className={`shrink-0 rounded-full border px-2.5 py-1.5 text-xs tabular-nums ${seuil === t ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft"}`}>≥ {t} %</Link>
        ))}
      </div>

      {/* Filtre compétition */}
      {compsOfDay.length > 1 && (
        <nav className="-mx-4 mb-4 overflow-x-auto px-4" aria-label="Compétitions">
          <div className="flex w-max gap-1.5">
            <Link href={q(day, null)} scroll={false} className={`rounded-full border px-3 py-1 text-xs ${!comp ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft"}`}>Tout</Link>
            {compsOfDay.map((c) => (
              <Link key={c} href={q(day, c)} scroll={false} className={`rounded-full border px-3 py-1 text-xs ${comp === c ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft"}`}>{COMP_FLAG[c] ?? "⚽"} {COMP_SHORT[c] ?? c}</Link>
            ))}
          </div>
        </nav>
      )}

      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-ink-muted">
          Aucun match ce jour-là. Le calendrier couvre les 14 prochains jours et se met à jour chaque matin.
        </div>
      )}

      {seuil !== null && rows.length > 0 && (
        <section className="mb-4">
          {top.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-ink-muted">Aucune sélection à {seuil} % ou plus ce jour-là. Essaie un seuil plus bas.</div>
          ) : (
            <>
              <ul className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
                {top.map(({ r, sg, p }, i) => {
                  const h = shortName(one(r.home)?.nom ?? ""), a = shortName(one(r.away)?.nom ?? "");
                  return (
                    <li key={`${r.id}-${p.market}-${p.sel}`} className={i ? "border-t border-line" : ""}>
                      <Link href={`/matchs/${r.id}`} className="flex items-center gap-3 px-3 py-2.5 active:bg-surface-2">
                        <span className="w-7 shrink-0 text-center text-xs font-semibold text-ink-muted">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{pickLabel(p.market, p.param, p.sel, h, a)}</span>
                          <span className="block truncate text-xs text-ink-muted">{COMP_FLAG[one(r.competition)?.code_externe ?? ""] ?? "⚽"} {h} – {a} · {fmtTime(r.kickoff_at)}</span>
                        </span>
                        <PickBadge label={sg.source === "modele" ? "Modèle" : "Marché"} p={p.p} cote={p.cote} source={sg.source} pModele={p.pModele} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 px-1 text-[11px] leading-relaxed text-ink-muted">
                Probable ne veut pas dire rentable : à {seuil} %, la cote tourne autour de {(100 / seuil).toFixed(2)}. « ≈ » signale une cote juste calculée, faute de cote de référence sur ce marché.
                {top.length >= 3 && <> Combinées, les {Math.min(top.length, 5)} premières n’ont plus que <b>{Math.round(top.slice(0, 5).reduce((x, t) => x * t.p.p, 1) * 100)} %</b> de chances de passer ensemble.</>}
              </p>
            </>
          )}
        </section>
      )}

      {seuil === null && ordered.map(([code, list]) => (
        <section key={code} className="mb-4 overflow-hidden rounded-xl border border-line bg-white shadow-card">
          <h2 className="flex items-center justify-between border-b border-line bg-surface-2 px-3 py-2 text-xs font-semibold text-ink-soft">
            <span>{COMP_FLAG[code] ?? "⚽"} {COMP_SHORT[code] ?? one(list[0].competition)?.nom}</span>
            <span className="font-normal text-ink-muted">{list.length} match{list.length > 1 ? "s" : ""}</span>
          </h2>
          <ul className="divide-y divide-line">
            {list.map((m) => {
              const h = one(m.home)?.nom ?? "", a = one(m.away)?.nom ?? "";
              const done = m.statut === "termine";
              const live = m.statut === "en_cours" && m.score_home !== null;
              const homeWin = done && (m.score_home ?? 0) > (m.score_away ?? 0), awayWin = done && (m.score_away ?? 0) > (m.score_home ?? 0);
              return (
                <li key={m.id}>
                  <Link href={`/matchs/${m.id}`} className="flex items-center gap-3 px-3 py-2.5 active:bg-surface-2">
                    <span className="w-10 shrink-0 text-center text-xs tabular-nums">
                      {done ? <span className="font-medium text-ink-muted">Fin</span>
                        : m.statut === "en_cours" ? <span className="font-semibold text-loss">● {m.minute ? `${m.minute}’` : "Live"}</span>
                        : m.statut === "reporte" ? <span className="text-draw">Rep.</span>
                        : <span className="font-medium text-ink-soft">{fmtTime(m.kickoff_at)}</span>}
                    </span>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex items-center gap-2 text-sm"><TeamBadge name={h} size={18} /><span className={`truncate ${homeWin ? "font-semibold" : ""}`}>{shortName(h)}</span>{(done || live) && <span className={`ml-auto pl-2 font-semibold tabular-nums ${live ? "text-loss" : ""}`}>{m.score_home}</span>}</span>
                      <span className="flex items-center gap-2 text-sm"><TeamBadge name={a} size={18} /><span className={`truncate ${awayWin ? "font-semibold" : ""}`}>{shortName(a)}</span>{(done || live) && <span className={`ml-auto pl-2 font-semibold tabular-nums ${live ? "text-loss" : ""}`}>{m.score_away}</span>}</span>
                    </span>
                    {!done && !live && (() => { const sg = signals.get(m.id); if (!sg) return <span className="w-[120px] shrink-0 text-right text-[11px] text-ink-muted">pas encore de cote</span>; const p = bestPick(sg); return <PickBadge label={pickLabel(p.market, p.param, p.sel, shortName(h), shortName(a))} p={p.p} cote={p.cote} source={sg.source} pModele={p.pModele} />; })()}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
