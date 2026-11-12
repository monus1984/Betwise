/** Compétitions qui ont un classement (championnats et phases de groupes). */
export const STANDING_COMPS = ["PL", "PD", "SA", "BL1", "FL1", "CL", "UNL", "CIV1", "CANQ", "CAFCL", "CAFCC"];
export type StandingRow = { comp_code: string; groupe: string; af_team_id: number; rang: number; team_nom: string; team_id: string | null; joues: number; gagnes: number; nuls: number; perdus: number; bp: number; bc: number; diff: number; points: number; forme: string | null; zone: string | null; updated_at: string };

/** Garde la dernière mise à jour de chaque équipe (une ligne d'un ancien découpage en groupes peut subsister en base). */
export function latestStandings(rows: StandingRow[]): StandingRow[] {
  const max = rows.reduce((x, r) => Math.max(x, Date.parse(r.updated_at)), 0);
  return rows.filter((r) => max - Date.parse(r.updated_at) < 30 * 60000);
}
