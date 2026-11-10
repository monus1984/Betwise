import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RISK_CLASS, RISK_LABEL, riskFromOdds } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Named = { nom: string } | { nom: string }[] | null;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("matches")
    .select("id, kickoff_at, statut, score_home, score_away, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(nom, code_externe)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const m = data as unknown as { id: string; kickoff_at: string; statut: string; score_home: number | null; score_away: number | null; home: Named; away: Named; competition: { nom: string } | { nom: string }[] | null };
  const home = one(m.home)?.nom ?? "";
  const away = one(m.away)?.nom ?? "";

  const { data: odds } = await supabase
    .from("odds_observations")
    .select("market_code, market_param, selection, cote, bookmaker, origine, observed_at")
    .eq("match_id", id)
    .order("observed_at", { ascending: false })
    .limit(200);

  // Dernière cote par (marché, paramètre, sélection, bookmaker)
  const latest = new Map<string, NonNullable<typeof odds>[number]>();
  for (const o of odds ?? []) {
    const k = `${o.market_code}|${o.market_param ?? ""}|${o.selection}|${o.bookmaker ?? "—"}`;
    if (!latest.has(k)) latest.set(k, o);
  }
  const ref = (code: string, sel: string, param?: number) =>
    latest.get(`${code}|${param ?? ""}|${sel}|ref:eu-median`) ?? null;
  const userObs = [...latest.values()].filter((o) => o.origine !== "api");

  const { data: est } = await supabase
    .from("model_estimates")
    .select("market_code, market_param, selection, probabilite, cote_reference, niveau_risque, justification, updated_at, prediction_id")
    .eq("match_id", id)
    .eq("model_version", "poisson-v1");
  const { data: modelSrc } = await supabase.from("sources").select("id").eq("type", "modele_betwise").limit(1).maybeSingle();
  const e = (code: string, sel: string) => (est ?? []).find((x) => x.market_code === code && x.selection === sel) ?? null;
  const just = (est?.[0]?.justification ?? null) as { lambda_dom?: number; lambda_ext?: number; score_probable?: string; matchs_historique_dom?: number; matchs_historique_ext?: number } | null;

  const upcoming = m.statut === "programme" || m.statut === "en_cours";
  const parierHref = (market: string, sel: string, cote?: number, param?: number) =>
    `/nouveau?match=${m.id}&market=${market}${param !== undefined ? `&param=${param}` : ""}&sel=${encodeURIComponent(sel)}${cote ? `&cote=${cote}` : ""}`;

  return (
    <>
      <Link href="/matchs" className="mb-3 inline-block text-sm text-slate-600">‹ Matchs</Link>
      <PageHeader
        title={`${home} – ${away}`}
        subtitle={`${one(m.competition)?.nom ?? ""} · ${new Date(m.kickoff_at).toLocaleString("fr-FR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })}`}
      />

      {m.statut === "termine" && (
        <div className="mb-5 rounded-xl bg-slate-900 p-5 text-center text-white">
          <p className="text-xs uppercase tracking-wide text-slate-300">Score final</p>
          <p className="text-4xl font-semibold tabular-nums">{m.score_home} – {m.score_away}</p>
        </div>
      )}

      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Cotes de référence</h2>
          <span className="text-[11px] text-slate-500">médiane des bookmakers européens</span>
        </div>
        <OddsRow label="1X2" cells={[
          { sel: "1", name: short(home), o: ref("1X2", "1") },
          { sel: "N", name: "Nul", o: ref("1X2", "N") },
          { sel: "2", name: short(away), o: ref("1X2", "2") },
        ]} market="1X2" upcoming={upcoming} href={parierHref} />
        <OddsRow label="Buts" cells={[
          { sel: "Plus", name: "+ de 2,5", o: ref("OU", "Plus", 2.5) },
          { sel: "Moins", name: "− de 2,5", o: ref("OU", "Moins", 2.5) },
        ]} market="OU" param={2.5} upcoming={upcoming} href={parierHref} />
        {!ref("1X2", "1") && (
          <p className="mt-2 text-xs text-slate-500">Pas encore de cote de référence pour ce match : elles arrivent chaque matin à partir de J-8.</p>
        )}
        {ref("1X2", "1") && (
          <p className="mt-2 text-[11px] text-slate-400">Mise à jour {fmtRel(ref("1X2", "1")!.observed_at)}. La probabilité implicite est 1 / cote, marge du bookmaker comprise.</p>
        )}
      </section>

      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Cotes vues par les utilisateurs</h2>
        {userObs.length === 0 ? (
          <p className="text-xs text-slate-500">Aucune pour l’instant. Chaque pari saisi sur ce match ajoute sa cote ici, avec l’heure.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {userObs.slice(0, 12).map((o, i) => (
              <li key={i} className="flex justify-between py-1.5">
                <span>{o.market_code}{o.market_param ? ` ${o.market_param}` : ""} · {o.selection}{o.bookmaker ? ` · ${o.bookmaker}` : ""}</span>
                <span className="tabular-nums">{Number(o.cote).toFixed(2)} <span className="text-xs text-slate-400">{fmtRel(o.observed_at)}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Indicateur BETWISE</h2>
          {modelSrc && <Link href={`/sources/${modelSrc.id}`} className="text-[11px] text-slate-500 underline">voir son bilan</Link>}
        </div>
        {!est?.length ? (
          <p className="text-xs text-slate-500">Pas d’estimation pour ce match : le modèle couvre les 5 grands championnats à partir de J-8 (pas encore la Ligue des champions).</p>
        ) : (
          <>
            <EstimateRow label="1X2" cells={[
              { name: short(home), e: e("1X2", "1") }, { name: "Nul", e: e("1X2", "N") }, { name: short(away), e: e("1X2", "2") },
            ]} />
            <EstimateRow label="Buts" cells={[{ name: "+ de 2,5", e: e("OU", "Plus") }, { name: "− de 2,5", e: e("OU", "Moins") }]} />
            <EstimateRow label="Les deux marquent" cells={[{ name: "Oui", e: e("BTTS", "Oui") }, { name: "Non", e: e("BTTS", "Non") }]} />
            {just && (
              <p className="mt-1 text-xs text-slate-600">
                Buts attendus : {fmtDec(just.lambda_dom)} – {fmtDec(just.lambda_ext)} · score le plus probable {just.score_probable}
              </p>
            )}
            <p className="mt-2 text-[11px] text-slate-400">
              Modèle statistique (Poisson) sur les deux dernières saisons, matchs récents pondérés davantage. Il ignore blessures, rotations et motivation.
              L’écart (en points) compare sa probabilité à celle de la cote de référence. Case encadrée : l’issue enregistrée comme prono du modèle, notée comme n’importe quelle source. Mis à jour {fmtRel(est[0].updated_at)}.
            </p>
          </>
        )}
      </section>

      {upcoming && (
        <Link href={`/nouveau?match=${m.id}`} className="block rounded-lg bg-slate-900 py-3 text-center text-base font-medium text-white">Parier sur ce match</Link>
      )}
    </>
  );
}

function OddsRow({ label, cells, market, param, upcoming, href }: {
  label: string;
  cells: { sel: string; name: string; o: { cote: number } | null }[];
  market: string;
  param?: number;
  upcoming: boolean;
  href: (market: string, sel: string, cote?: number, param?: number) => string;
}) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className={`grid gap-2 ${cells.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {cells.map((c) => {
          const cote = c.o ? Number(c.o.cote) : null;
          const inner = (
            <>
              <p className="truncate text-xs text-slate-600">{c.name}</p>
              <p className="text-lg font-semibold tabular-nums">{cote ? cote.toFixed(2) : "—"}</p>
              {cote && (
                <p className="text-[11px] text-slate-500">
                  {Math.round(100 / cote)} % · <span className={`rounded px-1 ${RISK_CLASS[riskFromOdds(cote)]}`}>{RISK_LABEL[riskFromOdds(cote)]}</span>
                </p>
              )}
            </>
          );
          return upcoming ? (
            <Link key={c.sel} href={href(market, c.sel, cote ?? undefined, param)} className="rounded-lg border border-slate-200 p-2 text-center active:bg-slate-50">{inner}</Link>
          ) : (
            <div key={c.sel} className="rounded-lg border border-slate-200 p-2 text-center opacity-70">{inner}</div>
          );
        })}
      </div>
    </div>
  );
}

const RISK_TXT = ["", "très probable", "probable", "incertain", "peu probable", "improbable"];
function EstimateRow({ label, cells }: { label: string; cells: { name: string; e: { probabilite: number; cote_reference: number | null; niveau_risque: number | null; prediction_id: string | null } | null }[] }) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className={`grid gap-2 ${cells.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {cells.map((c) => {
          const p = c.e ? Number(c.e.probabilite) : null;
          const ref = c.e?.cote_reference ? Number(c.e.cote_reference) : null;
          const gap = p !== null && ref ? Math.round((p - 1 / ref) * 100) : null;
          return (
            <div key={c.name} className={`rounded-lg border p-2 text-center ${c.e?.prediction_id ? "border-slate-900" : "border-slate-200"}`}>
              <p className="truncate text-xs text-slate-600">{c.name}</p>
              <p className="text-lg font-semibold tabular-nums">{p !== null ? `${Math.round(p * 100)} %` : "—"}</p>
              <p className="text-[11px] text-slate-500">
                {c.e?.niveau_risque ? RISK_TXT[c.e.niveau_risque] : ""}
                {gap !== null && <> · <span className={gap >= 3 ? "text-emerald-700" : gap <= -3 ? "text-red-700" : ""}>{gap > 0 ? "+" : ""}{gap} pts</span></>}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
const fmtDec = (x?: number) => (x === undefined ? "?" : x.toFixed(1).replace(".", ","));
const short = (n: string) => n.replace(/\s?(FC|CF|SC|AC|AS|US|SV|RB|SSC|Calcio)\b\.?/g, "").trim().slice(0, 14);
function fmtRel(iso: string) {
  const h = Math.round((Date.now() - Date.parse(iso)) / 3600000);
  if (h < 1) return "il y a moins d’une heure";
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}
