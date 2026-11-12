import type { StandingRow } from "@/lib/matches/standings";

const FORME: Record<string, string> = { W: "bg-gain", D: "bg-draw", L: "bg-loss" };
/** Couleur de la zone (qualification, barrage, relégation) d'après le libellé du classement. */
function zoneColor(z: string | null) {
  if (!z) return "bg-transparent";
  if (/releg|descen/i.test(z)) return "bg-loss";
  if (/champions league|promotion|qualif|next round|1\/8|round of/i.test(z) && !/qualifying|play-?off|barrage/i.test(z)) return "bg-gain";
  return "bg-brand";
}

/** Tableau de classement compact. `highlight` : identifiants d'équipes à mettre en avant ; `only` : n'afficher que ces équipes. */
export function StandingsTable({ rows, highlight = [], only }: { rows: StandingRow[]; highlight?: (string | null)[]; only?: boolean }) {
  const hl = new Set(highlight.filter(Boolean) as string[]);
  const list = only ? rows.filter((r) => r.team_id && hl.has(r.team_id)) : rows;
  if (!list.length) return null;
  return (
    <table className="w-full text-[13px] tabular-nums">
      <thead>
        <tr className="text-[11px] text-ink-muted">
          <th className="w-7 py-1.5 text-left font-medium">#</th><th className="text-left font-medium">Équipe</th>
          <th className="w-7 font-medium">J</th><th className="w-8 font-medium">+/−</th><th className="w-8 font-medium">Pts</th>{!only && <th className="w-[70px] text-right font-medium">Forme</th>}
        </tr>
      </thead>
      <tbody>
        {list.map((r) => {
          const on = r.team_id && hl.has(r.team_id);
          return (
            <tr key={`${r.groupe}${r.af_team_id}`} className={`border-t border-line ${on ? "bg-brand-soft font-semibold" : ""}`}>
              <td className="relative py-1.5 pl-2"><span className={`absolute inset-y-1 left-0 w-[3px] rounded-full ${zoneColor(r.zone)}`} />{r.rang}</td>
              <td className="max-w-0 truncate pr-1">{r.team_nom}</td>
              <td className="text-center text-ink-muted">{r.joues}</td>
              <td className="text-center text-ink-muted">{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
              <td className="text-center font-bold">{r.points}</td>
              {!only && <td className="py-1.5"><span className="flex justify-end gap-0.5">{(r.forme ?? "").slice(-5).split("").map((f, i) => <span key={i} className={`h-2 w-2 rounded-full ${FORME[f] ?? "bg-slate-300"}`} />)}</span></td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
