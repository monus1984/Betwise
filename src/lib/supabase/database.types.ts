// Généré par scripts/gen-types.py — ne pas éditer à la main. `npm run db:types` pour régénérer.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  betwise: {
    Tables: {
      competitions: {
        Row: {
          id: string
          code_externe: string | null
          nom: string
          pays: string | null
          saison: string
          couverte_auto: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code_externe?: string | null
          nom: string
          pays?: string | null
          saison: string
          couverte_auto?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          code_externe?: string | null
          nom?: string
          pays?: string | null
          saison?: string
          couverte_auto?: boolean
          created_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          id: string
          code_externe: string | null
          nom: string
          alias: string[]
          competition_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code_externe?: string | null
          nom: string
          alias?: string[]
          competition_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code_externe?: string | null
          nom?: string
          alias?: string[]
          competition_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          id: string
          code_externe: string | null
          competition_id: string
          home_team_id: string
          away_team_id: string
          kickoff_at: string
          statut: Database["betwise"]["Enums"]["match_status"]
          score_home: number | null
          score_away: number | null
          source_resultat: string | null
          result_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code_externe?: string | null
          competition_id: string
          home_team_id: string
          away_team_id: string
          kickoff_at: string
          statut?: Database["betwise"]["Enums"]["match_status"]
          score_home?: number | null
          score_away?: number | null
          source_resultat?: string | null
          result_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code_externe?: string | null
          competition_id?: string
          home_team_id?: string
          away_team_id?: string
          kickoff_at?: string
          statut?: Database["betwise"]["Enums"]["match_status"]
          score_home?: number | null
          score_away?: number | null
          source_resultat?: string | null
          result_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          code: string
          libelle_fr: string
          a_parametre: boolean
          version: number
        }
        Insert: {
          code: string
          libelle_fr: string
          a_parametre?: boolean
          version?: number
        }
        Update: {
          code?: string
          libelle_fr?: string
          a_parametre?: boolean
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          user_id: string
          pseudo: string
          devise: string
          role: string
          created_at: string
        }
        Insert: {
          user_id: string
          pseudo: string
          devise?: string
          role?: string
          created_at?: string
        }
        Update: {
          user_id?: string
          pseudo?: string
          devise?: string
          role?: string
          created_at?: string
        }
        Relationships: []
      }
      bankrolls: {
        Row: {
          id: string
          user_id: string
          capital_initial: number
          devise: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          capital_initial?: number
          devise?: string
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          capital_initial?: number
          devise?: string
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      user_limits: {
        Row: {
          id: string
          user_id: string
          mise_max: number | null
          perte_max_jour: number | null
          perte_max_semaine: number | null
          nb_paris_max_jour: number | null
          valid_from: string
        }
        Insert: {
          id?: string
          user_id: string
          mise_max?: number | null
          perte_max_jour?: number | null
          perte_max_semaine?: number | null
          nb_paris_max_jour?: number | null
          valid_from?: string
        }
        Update: {
          id?: string
          user_id?: string
          mise_max?: number | null
          perte_max_jour?: number | null
          perte_max_semaine?: number | null
          nb_paris_max_jour?: number | null
          valid_from?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          id: string
          type: Database["betwise"]["Enums"]["source_type"]
          nom: string
          identifiant_externe: string | null
          description: string | null
          visibilite: Database["betwise"]["Enums"]["source_visibility"]
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          type: Database["betwise"]["Enums"]["source_type"]
          nom: string
          identifiant_externe?: string | null
          description?: string | null
          visibilite?: Database["betwise"]["Enums"]["source_visibility"]
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          type?: Database["betwise"]["Enums"]["source_type"]
          nom?: string
          identifiant_externe?: string | null
          description?: string | null
          visibilite?: Database["betwise"]["Enums"]["source_visibility"]
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      source_follows: {
        Row: {
          user_id: string
          source_id: string
          followed_at: string
        }
        Insert: {
          user_id: string
          source_id: string
          followed_at?: string
        }
        Update: {
          user_id?: string
          source_id?: string
          followed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_follows_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          id: string
          user_id: string
          storage_path: string
          kind: string
          json_extrait: Json | null
          confiance: Json | null
          corrections: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          storage_path: string
          kind: string
          json_extrait?: Json | null
          confiance?: Json | null
          corrections?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          storage_path?: string
          kind?: string
          json_extrait?: Json | null
          confiance?: Json | null
          corrections?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      predictions: {
        Row: {
          id: string
          source_id: string
          match_id: string | null
          match_libre: string | null
          market_code: string
          market_param: number | null
          selection: string
          cote_annoncee: number | null
          probabilite_annoncee: number | null
          risque_annonce: Database["betwise"]["Enums"]["risk_category"] | null
          risque_calcule: Database["betwise"]["Enums"]["risk_category"] | null
          published_at: string | null
          logged_at: string
          statut: Database["betwise"]["Enums"]["prediction_status"]
          motif_annulation: string | null
          submitted_by: string | null
          upload_id: string | null
          resultat: Database["betwise"]["Enums"]["settle_result"]
          settled_at: string | null
          dedupe_key: string | null
        }
        Insert: {
          id?: string
          source_id: string
          match_id?: string | null
          match_libre?: string | null
          market_code: string
          market_param?: number | null
          selection: string
          cote_annoncee?: number | null
          probabilite_annoncee?: number | null
          risque_annonce?: Database["betwise"]["Enums"]["risk_category"] | null
          risque_calcule?: Database["betwise"]["Enums"]["risk_category"] | null
          published_at?: string | null
          logged_at?: string
          statut?: Database["betwise"]["Enums"]["prediction_status"]
          motif_annulation?: string | null
          submitted_by?: string | null
          upload_id?: string | null
          resultat?: Database["betwise"]["Enums"]["settle_result"]
          settled_at?: string | null
          dedupe_key?: string | null
        }
        Update: {
          id?: string
          source_id?: string
          match_id?: string | null
          match_libre?: string | null
          market_code?: string
          market_param?: number | null
          selection?: string
          cote_annoncee?: number | null
          probabilite_annoncee?: number | null
          risque_annonce?: Database["betwise"]["Enums"]["risk_category"] | null
          risque_calcule?: Database["betwise"]["Enums"]["risk_category"] | null
          published_at?: string | null
          logged_at?: string
          statut?: Database["betwise"]["Enums"]["prediction_status"]
          motif_annulation?: string | null
          submitted_by?: string | null
          upload_id?: string | null
          resultat?: Database["betwise"]["Enums"]["settle_result"]
          settled_at?: string | null
          dedupe_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "predictions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_market_code_fkey"
            columns: ["market_code"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "predictions_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_versions: {
        Row: {
          id: string
          prediction_id: string
          changes: Json
          changed_by: string | null
          changed_at: string
        }
        Insert: {
          id?: string
          prediction_id: string
          changes: Json
          changed_by?: string | null
          changed_at?: string
        }
        Update: {
          id?: string
          prediction_id?: string
          changes?: Json
          changed_by?: string | null
          changed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_versions_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      odds_observations: {
        Row: {
          id: string
          match_id: string | null
          market_code: string
          market_param: number | null
          selection: string
          cote: number
          bookmaker: string | null
          origine: string
          observed_at: string
          observed_by: string | null
        }
        Insert: {
          id?: string
          match_id?: string | null
          market_code: string
          market_param?: number | null
          selection: string
          cote: number
          bookmaker?: string | null
          origine: string
          observed_at?: string
          observed_by?: string | null
        }
        Update: {
          id?: string
          match_id?: string | null
          market_code?: string
          market_param?: number | null
          selection?: string
          cote?: number
          bookmaker?: string | null
          origine?: string
          observed_at?: string
          observed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "odds_observations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odds_observations_market_code_fkey"
            columns: ["market_code"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
        ]
      }
      bets: {
        Row: {
          id: string
          user_id: string
          bankroll_id: string
          type: Database["betwise"]["Enums"]["bet_type"]
          mise: number
          cote_totale: number | null
          statut: Database["betwise"]["Enums"]["bet_status"]
          gain_net: number | null
          placed_at: string
          source_import: Database["betwise"]["Enums"]["import_channel"]
          raw_text: string | null
          upload_id: string | null
          settled_at: string | null
          created_at: string
          nb_selections: number | null
          detail_complet: boolean
          coupon_externe: string | null
          bookmaker: string | null
          ticket_fingerprint: string | null
        }
        Insert: {
          id?: string
          user_id: string
          bankroll_id: string
          type?: Database["betwise"]["Enums"]["bet_type"]
          mise: number
          cote_totale?: number | null
          statut?: Database["betwise"]["Enums"]["bet_status"]
          gain_net?: number | null
          placed_at?: string
          source_import?: Database["betwise"]["Enums"]["import_channel"]
          raw_text?: string | null
          upload_id?: string | null
          settled_at?: string | null
          created_at?: string
          nb_selections?: number | null
          detail_complet?: boolean
          coupon_externe?: string | null
          bookmaker?: string | null
          ticket_fingerprint?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          bankroll_id?: string
          type?: Database["betwise"]["Enums"]["bet_type"]
          mise?: number
          cote_totale?: number | null
          statut?: Database["betwise"]["Enums"]["bet_status"]
          gain_net?: number | null
          placed_at?: string
          source_import?: Database["betwise"]["Enums"]["import_channel"]
          raw_text?: string | null
          upload_id?: string | null
          settled_at?: string | null
          created_at?: string
          nb_selections?: number | null
          detail_complet?: boolean
          coupon_externe?: string | null
          bookmaker?: string | null
          ticket_fingerprint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bets_bankroll_id_fkey"
            columns: ["bankroll_id"]
            isOneToOne: false
            referencedRelation: "bankrolls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      bet_selections: {
        Row: {
          id: string
          bet_id: string
          match_id: string | null
          match_libre: string | null
          market_code: string
          market_param: number | null
          selection: string
          cote: number
          cote_observed_at: string
          origin_source_id: string
          prediction_id: string | null
          risque_calcule: Database["betwise"]["Enums"]["risk_category"] | null
          resultat: Database["betwise"]["Enums"]["settle_result"]
          settled_at: string | null
        }
        Insert: {
          id?: string
          bet_id: string
          match_id?: string | null
          match_libre?: string | null
          market_code: string
          market_param?: number | null
          selection: string
          cote: number
          cote_observed_at?: string
          origin_source_id: string
          prediction_id?: string | null
          risque_calcule?: Database["betwise"]["Enums"]["risk_category"] | null
          resultat?: Database["betwise"]["Enums"]["settle_result"]
          settled_at?: string | null
        }
        Update: {
          id?: string
          bet_id?: string
          match_id?: string | null
          match_libre?: string | null
          market_code?: string
          market_param?: number | null
          selection?: string
          cote?: number
          cote_observed_at?: string
          origin_source_id?: string
          prediction_id?: string | null
          risque_calcule?: Database["betwise"]["Enums"]["risk_category"] | null
          resultat?: Database["betwise"]["Enums"]["settle_result"]
          settled_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bet_selections_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_selections_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_selections_market_code_fkey"
            columns: ["market_code"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bet_selections_origin_source_id_fkey"
            columns: ["origin_source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_selections_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      bankroll_transactions: {
        Row: {
          id: string
          bankroll_id: string
          type: Database["betwise"]["Enums"]["tx_type"]
          montant: number
          bet_id: string | null
          note: string | null
          at: string
        }
        Insert: {
          id?: string
          bankroll_id: string
          type: Database["betwise"]["Enums"]["tx_type"]
          montant: number
          bet_id?: string | null
          note?: string | null
          at?: string
        }
        Update: {
          id?: string
          bankroll_id?: string
          type?: Database["betwise"]["Enums"]["tx_type"]
          montant?: number
          bet_id?: string | null
          note?: string | null
          at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bankroll_transactions_bankroll_id_fkey"
            columns: ["bankroll_id"]
            isOneToOne: false
            referencedRelation: "bankrolls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bankroll_transactions_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
        ]
      }
      source_metrics: {
        Row: {
          source_id: string
          periode: string
          nb_declares: number
          nb_verifies: number
          nb_gagnes: number
          nb_regles: number
          taux_reussite: number | null
          rendement: number | null
          ic_bas: number | null
          ic_haut: number | null
          pire_serie: number | null
          statut_eval: Database["betwise"]["Enums"]["eval_status"]
          computed_at: string
        }
        Insert: {
          source_id: string
          periode: string
          nb_declares?: number
          nb_verifies?: number
          nb_gagnes?: number
          nb_regles?: number
          taux_reussite?: number | null
          rendement?: number | null
          ic_bas?: number | null
          ic_haut?: number | null
          pire_serie?: number | null
          statut_eval?: Database["betwise"]["Enums"]["eval_status"]
          computed_at?: string
        }
        Update: {
          source_id?: string
          periode?: string
          nb_declares?: number
          nb_verifies?: number
          nb_gagnes?: number
          nb_regles?: number
          taux_reussite?: number | null
          rendement?: number | null
          ic_bas?: number | null
          ic_haut?: number | null
          pire_serie?: number | null
          statut_eval?: Database["betwise"]["Enums"]["eval_status"]
          computed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_metrics_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_metrics_by_axis: {
        Row: {
          source_id: string
          periode: string
          axe: Database["betwise"]["Enums"]["metric_axis"]
          valeur: string
          nb_declares: number
          nb_gagnes: number
          rendement: number | null
          computed_at: string
        }
        Insert: {
          source_id: string
          periode: string
          axe: Database["betwise"]["Enums"]["metric_axis"]
          valeur: string
          nb_declares?: number
          nb_gagnes?: number
          rendement?: number | null
          computed_at?: string
        }
        Update: {
          source_id?: string
          periode?: string
          axe?: Database["betwise"]["Enums"]["metric_axis"]
          valeur?: string
          nb_declares?: number
          nb_gagnes?: number
          rendement?: number | null
          computed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_metrics_by_axis_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      model_estimates: {
        Row: {
          id: string
          match_id: string
          market_code: string
          market_param: number | null
          selection: string
          probabilite: number
          cote_reference: number | null
          niveau_risque: number | null
          justification: Json | null
          model_version: string
          prediction_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          market_code: string
          market_param?: number | null
          selection: string
          probabilite: number
          cote_reference?: number | null
          niveau_risque?: number | null
          justification?: Json | null
          model_version: string
          prediction_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          match_id?: string
          market_code?: string
          market_param?: number | null
          selection?: string
          probabilite?: number
          cote_reference?: number | null
          niveau_risque?: number | null
          justification?: Json | null
          model_version?: string
          prediction_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_estimates_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_estimates_market_code_fkey"
            columns: ["market_code"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "model_estimates_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          titre: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          titre?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          titre?: string | null
          created_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: string
          contenu: string | null
          fonctions: Json | null
          tokens_in: number | null
          tokens_out: number | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: string
          contenu?: string | null
          fonctions?: Json | null
          tokens_in?: number | null
          tokens_out?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: string
          contenu?: string | null
          fonctions?: Json | null
          tokens_in?: number | null
          tokens_out?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          id: string
          user_id: string | null
          ecran: string | null
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          ecran?: string | null
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          ecran?: string | null
          message?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      source_trend: {
        Row: {
          source_id: string | null
          nb_declares: number | null
          nb_verifies: number | null
          nb_regles: number | null
          nb_gagnes: number | null
          nb_perdus: number | null
          unites_nettes: number | null
          nb_avec_cote: number | null
          prudent_regles: number | null
          prudent_gagnes: number | null
          moyen_regles: number | null
          moyen_gagnes: number | null
          risque_regles: number | null
          risque_gagnes: number | null
          dernier_prono: string | null
        }
        Relationships: []
      }
      my_bankroll_summary: {
        Row: {
          bankroll_id: string | null
          user_id: string | null
          devise: string | null
          solde: number | null
          exposition: number | null
          resultat_net: number | null
          nb_regles: number | null
          nb_gagnes: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      risk_from_odds: {
        Args: {
          c: number
        }
        Returns: Database["betwise"]["Enums"]["risk_category"]
      }
      ensure_profile: {
        Args: {
          p_pseudo?: string | null
        }
        Returns: Database["betwise"]["Tables"]["profiles"]["Row"]
      }
      place_bet: {
        Args: {
          p_mise: number
          p_selections: Json
          p_source_import?: Database["betwise"]["Enums"]["import_channel"] | null
          p_raw_text?: string | null
          p_upload_id?: string | null
          p_placed_at?: string | null
          p_summary?: Json | null
        }
        Returns: string
      }
      bankroll_move: {
        Args: {
          p_type: Database["betwise"]["Enums"]["tx_type"]
          p_montant: number
          p_note?: string | null
        }
        Returns: Database["betwise"]["Tables"]["bankroll_transactions"]["Row"]
      }
      settle_bet: {
        Args: {
          p_bet_id: string
          p_result: Database["betwise"]["Enums"]["settle_result"]
        }
        Returns: Database["betwise"]["Tables"]["bets"]["Row"]
      }
      settle_selection: {
        Args: {
          p_market: string
          p_param: number
          p_selection: string
          p_home: number
          p_away: number
        }
        Returns: Database["betwise"]["Enums"]["settle_result"]
      }
      settle_pending: {
        Args: Record<PropertyKey, never>
        Returns: { matchs: number; selections_reglees: number; pronos_regles: number; paris_finalises: number }[]
      }
      log_prediction: {
        Args: {
          p_source_id: string
          p_market_code: string
          p_selection: string
          p_match_id?: string | null
          p_match_libre?: string | null
          p_market_param?: number | null
          p_cote_annoncee?: number | null
          p_risque_annonce?: Database["betwise"]["Enums"]["risk_category"] | null
          p_published_at?: string | null
          p_upload_id?: string | null
        }
        Returns: { prediction_id: string; created: boolean; statut: Database["betwise"]["Enums"]["prediction_status"] }[]
      }
      cancel_prediction: {
        Args: {
          p_id: string
          p_motif: string
        }
        Returns: undefined
      }
      delete_duplicate_bet: {
        Args: {
          p_bet_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      source_type: "perso" | "tipster" | "page_facebook" | "compte_instagram" | "canal_telegram" | "site" | "modele_betwise"
      source_visibility: "privee" | "partagee"
      prediction_status: "verifie" | "declare" | "annule"
      settle_result: "en_attente" | "gagne" | "perdu" | "rembourse"
      risk_category: "prudent" | "moyen" | "risque"
      bet_type: "simple" | "combine"
      bet_status: "en_cours" | "gagne" | "perdu" | "rembourse" | "annule"
      import_channel: "manuel" | "texte" | "capture" | "prono" | "telegram"
      tx_type: "depot" | "retrait" | "mise" | "gain" | "ajustement"
      match_status: "programme" | "en_cours" | "termine" | "reporte" | "annule"
      eval_status: "tendance" | "provisoire" | "evalue"
      metric_axis: "marche" | "competition" | "risque"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

export type Tables<
  SchemaTableName extends keyof (DatabaseWithoutInternals["betwise"]["Tables"] & DatabaseWithoutInternals["betwise"]["Views"]),
> = (DatabaseWithoutInternals["betwise"]["Tables"] & DatabaseWithoutInternals["betwise"]["Views"])[SchemaTableName]["Row"]

export type TablesInsert<SchemaTableName extends keyof DatabaseWithoutInternals["betwise"]["Tables"]> =
  DatabaseWithoutInternals["betwise"]["Tables"][SchemaTableName]["Insert"]

export type Enums<E extends keyof DatabaseWithoutInternals["betwise"]["Enums"]> = DatabaseWithoutInternals["betwise"]["Enums"][E]

export const Constants = {
  betwise: {
    Enums: {
      source_type: ["perso", "tipster", "page_facebook", "compte_instagram", "canal_telegram", "site", "modele_betwise"],
      source_visibility: ["privee", "partagee"],
      prediction_status: ["verifie", "declare", "annule"],
      settle_result: ["en_attente", "gagne", "perdu", "rembourse"],
      risk_category: ["prudent", "moyen", "risque"],
      bet_type: ["simple", "combine"],
      bet_status: ["en_cours", "gagne", "perdu", "rembourse", "annule"],
      import_channel: ["manuel", "texte", "capture", "prono", "telegram"],
      tx_type: ["depot", "retrait", "mise", "gain", "ajustement"],
      match_status: ["programme", "en_cours", "termine", "reporte", "annule"],
      eval_status: ["tendance", "provisoire", "evalue"],
      metric_axis: ["marche", "competition", "risque"],
    },
  },
} as const
