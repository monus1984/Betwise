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

      <section className="mb-5 rounded-xl border border-dashed border-slate-300 bg-white p-4">
        <h2 className="text-sm font-semibold">Indicateur de risque BETWISE</h2>
        <p className="mt-1 text-xs text-slate-500">Arrive en phase 2 : estimation statistique par issue, comparée à la cote de référence, et notée comme n’importe quelle source.</p>
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

const short = (n: string) => n.replace(/\s?(FC|CF|SC|AC|AS|US|SV|RB|SSC|Calcio)\b\.?/g, "").trim().slice(0, 14);
function fmtRel(iso: string) {
  const h = Math.round((Date.now() - Date.parse(iso)) / 3600000);
  if (h < 1) return "il y a moins d’une heure";
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}
