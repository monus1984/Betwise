import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Page d'accueil provisoire (phase 0) : prouve que l'app lit le schéma betwise.
 * Remplacée par le tableau de bord en phase 1.
 */
type Named = { nom: string } | { nom: string }[] | null;
type MatchCard = {
  id: string;
  kickoff_at: string;
  statut: "programme" | "en_cours" | "termine" | "reporte" | "annule";
  score_home: number | null;
  score_away: number | null;
  home: Named;
  away: Named;
  competition: Named;
};

export default async function Home() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select("id, kickoff_at, statut, score_home, score_away, home:teams!matches_home_team_id_fkey(nom), away:teams!matches_away_team_id_fkey(nom), competition:competitions(nom)")
    .gte("kickoff_at", new Date(Date.now() - 2 * 86400000).toISOString())
    .order("kickoff_at")
    .limit(30);
  const matches = (data ?? []) as unknown as MatchCard[];

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">BETWISE</h1>
        <p className="text-sm text-slate-600">Prototype V0.1 — phase 0 : référentiel matchs.</p>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Lecture impossible : {error.message}. Vérifie que le schéma <code>betwise</code> est exposé dans Data API.
        </p>
      )}

      {!error && matches.length === 0 && (
        <p className="text-sm text-slate-600">Aucun match importé pour l’instant. Lance <code>npm run import:matches</code>.</p>
      )}

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {matches.map((m) => {
          const home = Array.isArray(m.home) ? m.home[0] : m.home;
          const away = Array.isArray(m.away) ? m.away[0] : m.away;
          const comp = Array.isArray(m.competition) ? m.competition[0] : m.competition;
          const d = new Date(m.kickoff_at);
          return (
            <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{home?.nom} – {away?.nom}</p>
                <p className="text-xs text-slate-500">{comp?.nom} · {d.toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })}</p>
              </div>
              <span className="shrink-0 tabular-nums text-slate-700">
                {m.statut === "termine" ? `${m.score_home} – ${m.score_away}` : m.statut === "en_cours" ? "en cours" : "à venir"}
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
