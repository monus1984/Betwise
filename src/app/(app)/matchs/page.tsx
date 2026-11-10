import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Named = { nom: string } | { nom: string }[] | null;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

type Row = {
  id: string;
  kickoff_at: string;
  statut: "programme" | "en_cours" | "termine" | "reporte" | "annule";
  score_home: number | null;
  score_away: number | null;
  home: Named;
  away: Named;
  competition: { nom: string; code_externe: string | null } | { nom: string; code_externe: string | null }[] | null;
};

export default async function MatchsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const sp = await searchParams;
  const filter = sp.f === "resultats" ? "resultats" : "a_venir";
  const supabase = await createClient();

  let q = supabase
    .from("matches")
    .select("id, kickoff_at, statut, score_home, score_away, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(nom, code_externe)")
    .limit(250);
  q = filter === "a_venir"
    ? q.in("statut", ["programme", "en_cours"]).gte("kickoff_at", new Date(Date.now() - 3 * 3600000).toISOString()).order("kickoff_at")
    : q.eq("statut", "termine").gte("kickoff_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("kickoff_at", { ascending: false });
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];

  // Regroupement par jour (heure d'Abidjan)
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const day = new Date(r.kickoff_at).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", timeZone: "Africa/Abidjan" });
    groups.set(day, [...(groups.get(day) ?? []), r]);
  }

  // Prochaine date couverte si rien à venir
  let nextKickoff: string | null = null;
  if (filter === "a_venir" && rows.length === 0) {
    const { data: n } = await supabase.from("matches").select("kickoff_at").gt("kickoff_at", new Date().toISOString()).order("kickoff_at").limit(1).maybeSingle();
    nextKickoff = n?.kickoff_at ?? null;
  }

  return (
    <>
      <PageHeader title="Matchs" subtitle="Les 6 compétitions européennes et la Ligue des nations, sur 14 jours." />
      <div className="mb-4 flex gap-2">
        <Tab href="/matchs" active={filter === "a_venir"}>À venir</Tab>
        <Tab href="/matchs?f=resultats" active={filter === "resultats"}>Résultats</Tab>
      </div>

      {rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
          {filter === "a_venir"
            ? nextKickoff
              ? `Pas de match avant le ${fmtLong(nextKickoff)}. Le calendrier se met à jour chaque matin.`
              : "Trêve internationale : les championnats reprennent le 21 novembre. Le calendrier se met à jour chaque matin."
            : "Aucun résultat sur les 7 derniers jours."}
        </div>
      )}

      {[...groups.entries()].map(([day, list]) => (
        <section key={day} className="mb-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{day}</h2>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {list.map((m) => {
              const comp = one(m.competition);
              return (
                <li key={m.id}>
                  <Link href={`/matchs/${m.id}`} className="flex items-center justify-between gap-3 px-3 py-3 text-sm active:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{one(m.home)?.nom} – {one(m.away)?.nom}</p>
                      <p className="text-xs text-slate-500">{comp?.code_externe} · {fmtTime(m.kickoff_at)}</p>
                    </div>
                    <span className="shrink-0 tabular-nums text-slate-700">
                      {m.statut === "termine" ? `${m.score_home} – ${m.score_away}` : m.statut === "en_cours" ? "en cours" : "›"}
                    </span>
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

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`rounded-full px-3.5 py-1.5 text-sm ${active ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>
      {children}
    </Link>
  );
}
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const fmtLong = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", timeZone: "Africa/Abidjan" });
