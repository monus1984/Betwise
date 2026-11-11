import Link from "next/link";
import { notFound } from "next/navigation";
import { RISK_CLASS, RISK_LABEL, riskFromOdds } from "@/components/ui";
import { COMP_FLAG, COMP_SHORT, TeamBadge, confidenceLabel, marketProbs, shortName } from "@/components/match-ui";
import { createClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/live-refresh";
import { getExtras, type Extras } from "@/lib/api-football/extras";
import { probOf } from "@/lib/probs/grid";
import { loadSignals, pickLabel, picksOf } from "@/lib/probs/signals";

export const dynamic = "force-dynamic";

type Named = { nom: string } | { nom: string }[] | null;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
type Form = { date: string; adv: string; lieu: "D" | "E"; score: string; r: "V" | "N" | "D" }[];
type Just = { lambda_dom?: number; lambda_ext?: number; score_probable?: string; forme_dom?: Form; forme_ext?: Form; h2h?: { date: string; dom: "home" | "away"; score: string }[] };
const TABS = [
  { k: "analyse", t: "Analyse" }, { k: "cotes", t: "Cotes" }, { k: "forme", t: "Forme" }, { k: "equipes", t: "Équipes" }, { k: "pronos", t: "Pronos" },
] as const;
const TZ = "Africa/Abidjan";

export default async function MatchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = sp.t === "h2h" ? "forme" : TABS.some((x) => x.k === sp.t) ? sp.t! : "analyse";
  const supabase = await createClient();

  const { data } = await supabase
    .from("matches")
    .select("id, kickoff_at, statut, score_home, score_away, minute, af_fixture_id, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(nom, code_externe)")
    .eq("id", id).maybeSingle();
  if (!data) notFound();
  const m = data as unknown as { id: string; kickoff_at: string; statut: string; score_home: number | null; score_away: number | null; minute: number | null; af_fixture_id: number | null; home: Named; away: Named; competition: { nom: string; code_externe: string | null } | { nom: string; code_externe: string | null }[] | null };
  const home = one(m.home)?.nom ?? "", away = one(m.away)?.nom ?? "";
  const comp = one(m.competition);
  const upcoming = m.statut === "programme" || m.statut === "en_cours";

  const [{ data: odds }, { data: est }, { data: modelSrc }, { data: preds }] = await Promise.all([
    supabase.from("odds_observations").select("market_code, market_param, selection, cote, bookmaker, origine, observed_at").eq("match_id", id).order("observed_at", { ascending: false }).limit(200),
    supabase.from("model_estimates").select("market_code, market_param, selection, probabilite, cote_reference, niveau_risque, justification, updated_at, prediction_id").eq("match_id", id).eq("model_version", "poisson-v1"),
    supabase.from("sources").select("id").eq("type", "modele_betwise").limit(1).maybeSingle(),
    supabase.from("predictions").select("id, market_code, market_param, selection, cote_annoncee, statut, resultat, logged_at, source:sources(id, nom, type)").eq("match_id", id).neq("statut", "annule").order("logged_at", { ascending: false }).limit(30),
  ]);

  const latest = new Map<string, NonNullable<typeof odds>[number]>();
  for (const o of odds ?? []) { const k = `${o.market_code}|${o.market_param ?? ""}|${o.selection}|${o.bookmaker ?? "—"}`; if (!latest.has(k)) latest.set(k, o); }
  const ref = (code: string, sel: string, param?: number) => latest.get(`${code}|${param ?? ""}|${sel}|ref:eu-median`) ?? null;
  const userObs = [...latest.values()].filter((o) => o.origine !== "api");
  const e = (code: string, sel: string) => (est ?? []).find((x) => x.market_code === code && x.selection === sel) ?? null;
  const just = (est?.[0]?.justification ?? null) as Just | null;
  const model = e("1X2", "1") ? { p1: Number(e("1X2", "1")!.probabilite), pN: Number(e("1X2", "N")!.probabilite), p2: Number(e("1X2", "2")!.probabilite) } : null;
  const market = marketProbs(ref("1X2", "1")?.cote, ref("1X2", "N")?.cote, ref("1X2", "2")?.cote);
  const extras: Extras | null = tab === "equipes" ? await getExtras({ id: m.id, af_fixture_id: m.af_fixture_id, kickoff_at: m.kickoff_at, statut: m.statut }) : null;
  const sg = (await loadSignals(supabase, [id])).get(id) ?? null;
  const mk = sg?.market ?? null;
  const picks = sg ? picksOf(sg).filter((p) => p.p >= 0.6 && p.p <= 0.95).slice(0, 4) : [];
  const parier = (market: string, sel: string, cote?: number, param?: number) => `/nouveau?match=${m.id}&market=${market}${param !== undefined ? `&param=${param}` : ""}&sel=${encodeURIComponent(sel)}${cote ? `&cote=${cote}` : ""}`;

  return (
    <div className="pb-20">
      <LiveRefresh active={m.statut === "en_cours"} />
      <Link href="/matchs" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted">‹ Matchs</Link>

      {/* En-tête façon tableau d'affichage */}
      <header className="mb-3 rounded-2xl bg-ink px-4 pb-4 pt-3 text-white">
        <p className="mb-3 text-center text-[11px] text-white/60">{COMP_FLAG[comp?.code_externe ?? ""] ?? "⚽"} {COMP_SHORT[comp?.code_externe ?? ""] ?? comp?.nom} · {new Date(m.kickoff_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })}</p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex flex-col items-center gap-1.5 text-center"><TeamBadge name={home} size={44} /><span className="text-sm font-medium leading-tight">{shortName(home)}</span></div>
          <div className="text-center">
            {m.statut === "termine" ? <p className="text-3xl font-semibold tabular-nums">{m.score_home} – {m.score_away}</p>
              : m.statut === "en_cours" && m.score_home !== null ? <><p className="text-3xl font-semibold tabular-nums">{m.score_home} – {m.score_away}</p><p className="text-[11px] font-semibold text-red-300">● {m.minute ? `${m.minute}’` : "en direct"}</p></>
              : <><p className="text-2xl font-semibold tabular-nums">{new Date(m.kickoff_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ })}</p><p className="text-[11px] text-white/60">{countdown(m.kickoff_at)}</p></>}
          </div>
          <div className="flex flex-col items-center gap-1.5 text-center"><TeamBadge name={away} size={44} /><span className="text-sm font-medium leading-tight">{shortName(away)}</span></div>
        </div>
        {(model || market) && (
          <div className="mt-4">
            <ProbBar p={model ?? market!} light />
            <p className="mt-1.5 text-center text-[11px] text-white/60">{model ? "Modèle BETWISE" : "Cotes de référence (marge retirée)"}</p>
          </div>
        )}
      </header>

      {/* Onglets */}
      <nav className="sticky top-0 z-10 -mx-4 mb-3 bg-canvas/95 px-4 py-1.5 backdrop-blur">
        <div className="grid grid-cols-5 gap-0.5 rounded-xl bg-surface-2 p-1">
          {TABS.map((t) => (
            <Link key={t.k} href={`/matchs/${m.id}?t=${t.k}`} scroll={false} replace className={`truncate rounded-lg px-1 py-1.5 text-center text-[12.5px] ${tab === t.k ? "bg-white font-semibold text-ink shadow-card" : "text-ink-muted"}`}>
              {t.t}{t.k === "pronos" && preds?.length ? ` (${preds.length})` : ""}
            </Link>
          ))}
        </div>
      </nav>

      {tab === "analyse" && (
        <div className="space-y-3">
          {picks.length > 0 && (
            <Card title="Les issues les plus probables" note={sg!.source === "modele" ? "modèle BETWISE" : "d’après les cotes"}>
              <ul className="divide-y divide-line">
                {picks.map((p) => (
                  <li key={`${p.market}${p.param}${p.sel}`}>
                    <Link href={upcoming ? parier(p.market, p.sel, p.cote ?? undefined, p.param ?? undefined) : "#"} className="flex items-center justify-between gap-3 py-2 text-sm active:bg-surface-2">
                      <span className="truncate">{pickLabel(p.market, p.param, p.sel, shortName(home), shortName(away))}</span>
                      <span className="shrink-0 tabular-nums"><b>{Math.round(p.p * 100)} %</b> <span className="text-xs text-ink-muted">{p.cote ? `cote ${p.cote.toFixed(2)}` : `cote juste ${(1 / p.p).toFixed(2)}`}</span>{p.valeur !== null && Math.abs(p.valeur) >= 0.03 && <span className={`ml-1 text-xs ${p.valeur > 0 ? "text-gain" : "text-loss"}`}>{p.valeur > 0 ? "+" : ""}{Math.round(p.valeur * 100)} %</span>}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-ink-muted">« Cote juste » : la cote sans marge du bookmaker. En dessous, le pari perd de l’argent sur la durée, même s’il passe souvent.</p>
            </Card>
          )}
          {!model ? (
            mk ? (
              <>
                <Card title="Ce que disent les cotes" note="marge du bookmaker retirée">
                  <Compare label={shortName(home)} m={probOf(mk.grid, "1X2", null, "1")!} />
                  <Compare label="Match nul" m={probOf(mk.grid, "1X2", null, "N")!} />
                  <Compare label={shortName(away)} m={probOf(mk.grid, "1X2", null, "2")!} />
                  <Compare label="+ de 1,5 but" m={probOf(mk.grid, "OU", 1.5, "Plus")!} />
                  <Compare label="+ de 2,5 buts" m={probOf(mk.grid, "OU", 2.5, "Plus")!} />
                  <Compare label="Les deux marquent" m={probOf(mk.grid, "BTTS", null, "Oui")!} />
                  <p className="mt-2 text-xs text-ink-soft">Buts attendus selon le marché <b className="tabular-nums">{fmtDec(mk.lh)} – {fmtDec(mk.la)}</b> (total {fmtDec(mk.lh + mk.la)})</p>
                </Card>
                <p className="px-1 text-[11px] leading-relaxed text-ink-muted">Le modèle BETWISE ne couvre pas encore ce match (sélections nationales, Ligue des champions). Ces chiffres sont déduits des cotes de référence : victoire, nul et plus/moins de 2,5 buts sont repris tels quels, les autres marchés en sont calculés.</p>
              </>
            ) : <Card><p className="text-sm text-ink-muted">Pas encore de cote ni d’estimation pour ce match. Elles arrivent chaque matin à partir de J-14.</p></Card>
          ) : (
            <>
              <Card title="Qui l’emporte ?">
                <Compare label={shortName(home)} m={model.p1} k={market?.p1} />
                <Compare label="Match nul" m={model.pN} k={market?.pN} />
                <Compare label={shortName(away)} m={model.p2} k={market?.p2} />
                <Verdict model={model} market={market} home={shortName(home)} away={shortName(away)} />
              </Card>
              <Card title="Buts">
                <Compare label="+ de 2,5 buts" m={Number(e("OU", "Plus")?.probabilite ?? 0)} k={ref("OU", "Plus", 2.5) && ref("OU", "Moins", 2.5) ? (1 / ref("OU", "Plus", 2.5)!.cote) / (1 / ref("OU", "Plus", 2.5)!.cote + 1 / ref("OU", "Moins", 2.5)!.cote) : undefined} />
                <Compare label="Les deux marquent" m={Number(e("BTTS", "Oui")?.probabilite ?? 0)} />
                {just && <p className="mt-2 text-xs text-ink-soft">Buts attendus <b className="tabular-nums">{fmtDec(just.lambda_dom)} – {fmtDec(just.lambda_ext)}</b> · score le plus probable <b>{just.score_probable}</b>{mk && <> · selon le marché <b className="tabular-nums">{fmtDec(mk.lh)} – {fmtDec(mk.la)}</b></>}</p>}
              </Card>
              <p className="px-1 text-[11px] leading-relaxed text-ink-muted">
                Barre pleine : le modèle (Poisson sur trois saisons de résultats). Trait noir : le marché. Le modèle ne voit ni blessures ni compositions et reste un peu moins précis que les cotes sur le passé. Ses pronos sont notés comme ceux de n’importe quelle source{modelSrc ? <> — <Link href={`/sources/${modelSrc.id}`} className="underline">voir son bilan</Link></> : null}.
              </p>
            </>
          )}
        </div>
      )}

      {tab === "cotes" && (
        <div className="space-y-3">
          <Card title="Cotes de référence" note="médiane des bookmakers européens">
            <OddsRow cells={[{ sel: "1", name: shortName(home), o: ref("1X2", "1") }, { sel: "N", name: "Nul", o: ref("1X2", "N") }, { sel: "2", name: shortName(away), o: ref("1X2", "2") }]} market="1X2" upcoming={upcoming} href={parier} />
            <OddsRow cells={[{ sel: "Plus", name: "+ de 2,5", o: ref("OU", "Plus", 2.5) }, { sel: "Moins", name: "− de 2,5", o: ref("OU", "Moins", 2.5) }]} market="OU" param={2.5} upcoming={upcoming} href={parier} />
            {ref("1X2", "1") ? <p className="text-[11px] text-ink-muted">Mise à jour {fmtRel(ref("1X2", "1")!.observed_at)}. Touche une cote pour préremplir un pari.</p>
              : <p className="text-xs text-ink-muted">Pas encore de cote de référence : elles arrivent chaque matin à partir de J-14.</p>}
          </Card>
          <Card title="Cotes vues par les utilisateurs">
            {userObs.length === 0 ? <p className="text-xs text-ink-muted">Aucune pour l’instant. Chaque pari saisi sur ce match ajoute sa cote ici, avec l’heure.</p> : (
              <ul className="divide-y divide-line text-sm">
                {userObs.slice(0, 12).map((o, i) => (
                  <li key={i} className="flex justify-between py-1.5"><span>{o.market_code}{o.market_param ? ` ${o.market_param}` : ""} · {o.selection}{o.bookmaker ? ` · ${o.bookmaker}` : ""}</span><span className="tabular-nums">{Number(o.cote).toFixed(2)} <span className="text-xs text-ink-muted">{fmtRel(o.observed_at)}</span></span></li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "forme" && (
        just?.forme_dom ? (
          <div className="grid grid-cols-1 gap-3">
            <FormCard team={shortName(home)} form={just.forme_dom} />
            <FormCard team={shortName(away)} form={just.forme_ext ?? []} />
          </div>
        ) : <Card><p className="text-sm text-ink-muted">Forme disponible pour les 5 grands championnats, avec l’estimation du modèle (J-14).</p></Card>
      )}

      {tab === "forme" && (
        <div className="mt-3"><Card title="Dernières confrontations">
          {!just?.h2h ? <p className="text-sm text-ink-muted">Disponible pour les 5 grands championnats, avec l’estimation du modèle.</p>
            : just.h2h.length === 0 ? <p className="text-sm text-ink-muted">Pas de confrontation en championnat sur les trois dernières saisons.</p> : (
              <ul className="divide-y divide-line">
                {just.h2h.map((h, i) => {
                  const [a, b] = h.score.split("-");
                  const left = h.dom === "home" ? shortName(home) : shortName(away), right = h.dom === "home" ? shortName(away) : shortName(home);
                  return (
                    <li key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2 text-sm">
                      <span className="truncate text-right">{left}</span>
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 font-semibold tabular-nums">{a} – {b}</span>
                      <span className="truncate">{right}</span>
                      <span className="col-span-3 -mt-1 text-center text-[10px] text-ink-muted">{fmtDate(h.date)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
        </Card></div>
      )}


      {tab === "equipes" && extras && (
        <div className="space-y-3">
          {!extras.disponible && <Card><p className="text-sm text-ink-muted">Compositions et absents indisponibles pour ce match pour l’instant.</p></Card>}
          {extras.stats && extras.stats.length === 2 && (
            <Card title="Statistiques du match" note={m.statut === "en_cours" ? "en direct" : undefined}>
              {([["Buts attendus (xG)", "xg"], ["Tirs", "tirs"], ["Tirs cadrés", "cadres"], ["Possession", "possession"], ["Corners", "corners"], ["Cartons jaunes", "jaunes"]] as const).map(([lab, k]) => {
                const a = extras.stats![0][k], b = extras.stats![1][k];
                if (a === null && b === null) return null;
                const na = parseFloat(String(a ?? 0)), nb = parseFloat(String(b ?? 0)), tot = na + nb || 1;
                return (
                  <div key={k} className="mb-2.5">
                    <div className="mb-1 flex justify-between text-sm tabular-nums"><b>{a ?? "–"}</b><span className="text-xs text-ink-muted">{lab}</span><b>{b ?? "–"}</b></div>
                    <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full"><div className="bg-brand" style={{ width: `${(na / tot) * 100}%` }} /><div className="flex-1 bg-ink" /></div>
                  </div>
                );
              })}
              <p className="mt-1 flex justify-between text-[11px] text-ink-muted"><span>{shortName(home)}</span><span>{shortName(away)}</span></p>
            </Card>
          )}
          {extras.disponible && (
            <Card title="Compositions">
              {!extras.lineups?.length ? (
                <p className="text-sm text-ink-muted">{m.statut === "programme" ? "Elles sortent environ une heure avant le coup d’envoi. Reviens à ce moment-là : la page les récupère toute seule." : "Compositions non communiquées pour ce match."}</p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {extras.lineups.slice(0, 2).map((l) => (
                    <div key={l.equipe} className="min-w-0">
                      <p className="truncate text-sm font-semibold">{l.equipe}</p>
                      <p className="mb-2 text-[11px] text-ink-muted">{l.schema ?? "schéma ?"}{l.entraineur ? ` · ${l.entraineur}` : ""}</p>
                      <ol className="space-y-1 text-sm">
                        {l.titulaires.map((p) => <li key={p.nom} className="flex gap-2"><span className="w-5 shrink-0 text-right text-xs tabular-nums text-ink-muted">{p.numero ?? ""}</span><span className="truncate">{p.nom}</span></li>)}
                      </ol>
                      {l.remplacants.length > 0 && <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">Banc : {l.remplacants.join(", ")}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
          {extras.disponible && m.statut === "programme" && (
            <Card title="Absents annoncés" note="blessés et suspendus">
              {extras.injuries === null ? <p className="text-sm text-ink-muted">Disponibles dans les 7 jours avant le match.</p>
                : extras.injuries.length === 0 ? <p className="text-sm text-ink-muted">Aucun absent signalé pour l’instant. Cette information n’est pas suivie pour toutes les compétitions (sélections nationales notamment).</p> : (
                  <div className="space-y-3">
                    {[...new Set(extras.injuries.map((x) => x.equipe))].map((t) => (
                      <div key={t}>
                        <p className="mb-1 text-sm font-semibold">{t} <span className="font-normal text-ink-muted">· {extras.injuries!.filter((x) => x.equipe === t).length}</span></p>
                        <ul className="space-y-0.5 text-sm">
                          {extras.injuries!.filter((x) => x.equipe === t).map((x) => <li key={x.joueur} className="flex justify-between gap-2"><span className="truncate">{x.joueur}</span><span className="shrink-0 text-xs text-ink-muted">{x.type === "Questionable" ? "incertain" : "absent"}{x.motif ? ` · ${x.motif}` : ""}</span></li>)}
                        </ul>
                      </div>
                    ))}
                    <p className="text-[11px] text-ink-muted">Le modèle BETWISE ne tient pas encore compte de ces absences : à toi d’en juger le poids.</p>
                  </div>
                )}
            </Card>
          )}
        </div>
      )}

      {tab === "pronos" && (
        <Card title="Pronos enregistrés sur ce match" note="toutes sources visibles">
          {!preds?.length ? <p className="text-sm text-ink-muted">Aucun prono pour l’instant.</p> : (
            <ul className="divide-y divide-line">
              {preds.map((p) => {
                const src = one(p.source as { id: string; nom: string; type: string } | { id: string; nom: string; type: string }[] | null);
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <Link href={`/sources/${src?.id}`} className="block truncate font-medium">{src?.type === "modele_betwise" ? "📊 " : ""}{src?.nom}</Link>
                      <span className="text-xs text-ink-muted">{p.market_code}{p.market_param ? ` ${p.market_param}` : ""} · {p.selection}{p.cote_annoncee ? ` · cote ${Number(p.cote_annoncee).toFixed(2)}` : ""}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${p.resultat === "gagne" ? "bg-emerald-50 text-gain" : p.resultat === "perdu" ? "bg-red-50 text-loss" : p.statut === "verifie" ? "bg-brand-soft text-brand" : "bg-surface-2 text-ink-muted"}`}>
                      {p.resultat === "gagne" ? "gagné" : p.resultat === "perdu" ? "perdu" : p.statut === "verifie" ? "vérifié avant match" : "déclaré"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {upcoming && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 px-4 pb-2">
          <Link href={`/nouveau?match=${m.id}`} className="mx-auto block max-w-xl rounded-xl bg-ink py-3 text-center text-base font-medium text-white shadow-lg active:opacity-90">Parier sur ce match</Link>
        </div>
      )}
    </div>
  );
}

function Card({ title, note, children }: { title?: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-4 shadow-card">
      {title && <div className="mb-3 flex items-baseline justify-between gap-2"><h2 className="text-sm font-semibold">{title}</h2>{note && <span className="text-[11px] text-ink-muted">{note}</span>}</div>}
      {children}
    </section>
  );
}

function ProbBar({ p, light }: { p: { p1: number; pN: number; p2: number }; light?: boolean }) {
  const seg = [p.p1, p.pN, p.p2];
  const cls = light ? ["bg-white", "bg-white/40", "bg-white/75"] : ["bg-brand", "bg-ink-muted/50", "bg-ink"];
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full">{seg.map((v, i) => <div key={i} className={`${cls[i]} ${i ? "ml-0.5" : ""}`} style={{ width: `${v * 100}%` }} />)}</div>
      <div className={`mt-1 flex justify-between text-xs font-semibold tabular-nums ${light ? "text-white" : ""}`}><span>1 · {Math.round(p.p1 * 100)} %</span><span>N · {Math.round(p.pN * 100)} %</span><span>2 · {Math.round(p.p2 * 100)} %</span></div>
    </div>
  );
}

/** Barre du modèle + repère du marché. */
function Compare({ label, m, k }: { label: string; m: number; k?: number }) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex justify-between text-sm"><span className="truncate">{label}</span><span className="tabular-nums"><b>{Math.round(m * 100)} %</b>{k !== undefined && <span className="ml-1.5 text-xs text-ink-muted">marché {Math.round(k * 100)} %</span>}</span></div>
      <div className="relative h-2 rounded-full bg-surface-2">
        <div className="h-2 rounded-full bg-brand" style={{ width: `${m * 100}%` }} />
        {k !== undefined && <div className="absolute -top-1 h-4 w-0.5 rounded bg-ink" style={{ left: `calc(${k * 100}% - 1px)` }} />}
      </div>
    </div>
  );
}

function Verdict({ model, market, home, away }: { model: { p1: number; pN: number; p2: number }; market: { p1: number; pN: number; p2: number } | null; home: string; away: string }) {
  const arr = [{ n: home, p: model.p1, k: market?.p1 }, { n: "le nul", p: model.pN, k: market?.pN }, { n: away, p: model.p2, k: market?.p2 }];
  const top = [...arr].sort((a, b) => b.p - a.p)[0];
  const conf = confidenceLabel(top.p);
  const gap = top.k !== undefined ? Math.round((top.p - top.k) * 100) : null;
  return (
    <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm text-ink-soft">
      Issue la plus probable pour le modèle : <b>{top.n === "le nul" ? "match nul" : top.n}</b> à {Math.round(top.p * 100)} % — <span className={conf.c}>{conf.t}</span>.
      {gap !== null && (Math.abs(gap) < 3 ? " Il est d’accord avec le marché." : gap > 0 ? ` Il y croit ${gap} points de plus que le marché.` : ` Il y croit ${-gap} points de moins que le marché.`)}
    </p>
  );
}

function FormCard({ team, form }: { team: string; form: Form }) {
  const pts = form.reduce((s, f) => s + (f.r === "V" ? 3 : f.r === "N" ? 1 : 0), 0);
  return (
    <section className="rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{team}</h2>
        <span className="flex gap-1">{[...form].reverse().map((f, i) => <span key={i} className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold text-white ${f.r === "V" ? "bg-gain" : f.r === "N" ? "bg-draw" : "bg-loss"}`}>{f.r}</span>)}</span>
      </div>
      <ul className="divide-y divide-line text-sm">
        {form.map((f, i) => (
          <li key={i} className="flex items-center justify-between py-1.5">
            <span className="truncate"><span className="mr-2 text-[10px] text-ink-muted">{fmtDate(f.date)}</span>{f.lieu === "D" ? "vs" : "à"} {f.adv}</span>
            <span className="tabular-nums font-medium">{f.score}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-ink-muted">{pts} points sur 15 · championnat uniquement</p>
    </section>
  );
}

function OddsRow({ cells, market, param, upcoming, href }: { cells: { sel: string; name: string; o: { cote: number } | null }[]; market: string; param?: number; upcoming: boolean; href: (market: string, sel: string, cote?: number, param?: number) => string }) {
  return (
    <div className={`mb-3 grid gap-2 ${cells.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {cells.map((c) => {
        const cote = c.o ? Number(c.o.cote) : null;
        const inner = (<>
          <p className="truncate text-xs text-ink-muted">{c.name}</p>
          <p className="text-lg font-semibold tabular-nums">{cote ? cote.toFixed(2) : "—"}</p>
          {cote && <p className="text-[11px] text-ink-muted">{Math.round(100 / cote)} % · <span className={`rounded px-1 ${RISK_CLASS[riskFromOdds(cote)]}`}>{RISK_LABEL[riskFromOdds(cote)]}</span></p>}
        </>);
        return upcoming && cote
          ? <Link key={c.sel} href={href(market, c.sel, cote, param)} className="rounded-lg border border-line p-2 text-center active:bg-surface-2">{inner}</Link>
          : <div key={c.sel} className="rounded-lg border border-line p-2 text-center opacity-80">{inner}</div>;
      })}
    </div>
  );
}

const fmtDec = (x?: number) => (x === undefined ? "?" : x.toFixed(1).replace(".", ","));
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });
function countdown(iso: string) {
  const h = (Date.parse(iso) - Date.now()) / 3600000;
  if (h < 0) return "en cours";
  if (h < 1) return `dans ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 24) return `dans ${Math.round(h)} h`;
  return `dans ${Math.round(h / 24)} j`;
}
function fmtRel(iso: string) {
  const h = Math.round((Date.now() - Date.parse(iso)) / 3600000);
  if (h < 1) return "il y a moins d’une heure";
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}
