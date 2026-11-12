import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { COMP_FLAG, COMP_SHORT } from "@/components/match-ui";
import { StandingsTable } from "@/components/standings-table";
import { STANDING_COMPS, latestStandings, type StandingRow } from "@/lib/matches/standings";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClassementPage({ searchParams }: { searchParams: Promise<{ c?: string; e?: string }> }) {
  const sp = await searchParams;
  const comp = STANDING_COMPS.includes(sp.c ?? "") ? sp.c! : "PL";
  const db = await createClient();
  const [{ data }, { data: fol }] = await Promise.all([
    db.from("standings").select("*").eq("comp_code", comp).order("groupe").order("rang").limit(400),
    db.from("team_follows").select("team_id"),
  ]);
  const rows = latestStandings((data ?? []) as StandingRow[]);
  const groups = [...new Set(rows.map((r) => r.groupe))];
  const highlight = [...(sp.e ?? "").split(",").filter(Boolean), ...(fol ?? []).map((f) => f.team_id)];
  const maj = rows[0]?.updated_at;

  return (
    <>
      <PageHeader title="Classements" subtitle={COMP_SHORT[comp] ?? comp} />
      <Link href="/matchs" className="mb-3 inline-block text-sm text-ink-muted">‹ Matchs</Link>
      <nav className="-mx-4 mb-4 overflow-x-auto px-4" aria-label="Compétitions">
        <div className="flex w-max gap-1.5">
          {STANDING_COMPS.map((c) => <Link key={c} href={`/matchs/classement?c=${c}`} scroll={false} className={`rounded-full border px-3 py-1.5 text-xs ${comp === c ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft"}`}>{COMP_FLAG[c] ?? "⚽"} {COMP_SHORT[c] ?? c}</Link>)}
        </div>
      </nav>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-ink-muted">Pas encore de classement pour cette compétition. Les classements sont mis à jour toutes les trois heures ; certaines compétitions n’en publient pas avant le début de la phase de groupes.</div>
      ) : groups.map((g) => (
        <section key={g} className="mb-3 rounded-xl border border-line bg-white p-3 shadow-card">
          {g && <h2 className="mb-1 text-xs font-semibold text-ink-soft">{g}</h2>}
          <StandingsTable rows={rows.filter((r) => r.groupe === g)} highlight={highlight} />
        </section>
      ))}
      {rows.length > 0 && <p className="px-1 text-[11px] leading-relaxed text-ink-muted">Trait vert : qualification directe · orange : barrage ou autre compétition · rouge : relégation. En surbrillance : tes équipes suivies{sp.e ? " et celles du match" : ""}.{maj ? ` Mis à jour le ${new Date(maj).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })}.` : ""}</p>}
    </>
  );
}
