/**
 * Types du schéma `betwise`. Maintenus à la main tant que le générateur Supabase
 * ne couvre que `public` ; à régénérer via `npm run db:types` quand il le fera.
 * Seules les tables utilisées par le code sont détaillées ; les autres sont ajoutées au fil des phases.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Enums = {
  source_type: "perso" | "tipster" | "page_facebook" | "compte_instagram" | "canal_telegram" | "site" | "modele_betwise";
  source_visibility: "privee" | "partagee";
  prediction_status: "verifie" | "declare" | "annule";
  settle_result: "en_attente" | "gagne" | "perdu" | "rembourse";
  risk_category: "prudent" | "moyen" | "risque";
  bet_type: "simple" | "combine";
  bet_status: "en_cours" | "gagne" | "perdu" | "rembourse" | "annule";
  import_channel: "manuel" | "texte" | "capture" | "prono" | "telegram";
  tx_type: "depot" | "retrait" | "mise" | "gain" | "ajustement";
  match_status: "programme" | "en_cours" | "termine" | "reporte" | "annule";
  eval_status: "tendance" | "provisoire" | "evalue";
  metric_axis: "marche" | "competition" | "risque";
};

type CompetitionRow = {
  id: string; code_externe: string | null; nom: string; pays: string | null; saison: string; couverte_auto: boolean; created_at: string;
};
type TeamRow = {
  id: string; code_externe: string | null; nom: string; alias: string[]; competition_id: string | null; created_at: string;
};
type MatchRow = {
  id: string; code_externe: string | null; competition_id: string; home_team_id: string; away_team_id: string; kickoff_at: string;
  statut: Enums["match_status"]; score_home: number | null; score_away: number | null; source_resultat: string | null;
  result_at: string | null; created_at: string; updated_at: string;
};
type MarketRow = { code: string; libelle_fr: string; a_parametre: boolean; version: number };
type ProfileRow = { user_id: string; pseudo: string; devise: string; role: "user" | "admin"; created_at: string };
type SourceRow = {
  id: string; type: Enums["source_type"]; nom: string; identifiant_externe: string | null; description: string | null;
  visibilite: Enums["source_visibility"]; created_by: string | null; created_at: string;
};

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Required extends keyof Row, R extends Rel[] = []> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: R;
};

export type Database = {
  betwise: {
    Tables: {
      competitions: Table<CompetitionRow, "nom" | "saison">;
      teams: Table<TeamRow, "nom", [
        { foreignKeyName: "teams_competition_id_fkey"; columns: ["competition_id"]; isOneToOne: false; referencedRelation: "competitions"; referencedColumns: ["id"] },
      ]>;
      matches: Table<MatchRow, "competition_id" | "home_team_id" | "away_team_id" | "kickoff_at", [
        { foreignKeyName: "matches_competition_id_fkey"; columns: ["competition_id"]; isOneToOne: false; referencedRelation: "competitions"; referencedColumns: ["id"] },
        { foreignKeyName: "matches_home_team_id_fkey"; columns: ["home_team_id"]; isOneToOne: false; referencedRelation: "teams"; referencedColumns: ["id"] },
        { foreignKeyName: "matches_away_team_id_fkey"; columns: ["away_team_id"]; isOneToOne: false; referencedRelation: "teams"; referencedColumns: ["id"] },
      ]>;
      markets: Table<MarketRow, "code" | "libelle_fr">;
      profiles: Table<ProfileRow, "user_id" | "pseudo">;
      sources: Table<SourceRow, "type" | "nom">;
    };
    Views: { [_ in never]: never };
    Functions: {
      ensure_profile: { Args: { p_pseudo?: string | null }; Returns: ProfileRow };
      risk_from_odds: { Args: { c: number }; Returns: Enums["risk_category"] };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Enums;
    CompositeTypes: { [_ in never]: never };
  };
};
