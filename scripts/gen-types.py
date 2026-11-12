#!/usr/bin/env python3
"""
Génère src/lib/supabase/database.types.ts pour le schéma `betwise`, au format du générateur Supabase.
La spec ci-dessous est le miroir des migrations (supabase/migrations). À mettre à jour à chaque migration
qui change une table, un enum ou une fonction ; `npm run db:types` lance ce script.

Format d'une colonne : "nom:type[?][=]"   ? = nullable, = = a une valeur par défaut (optionnelle à l'insertion)
Types : uuid text bool int2 int4 int8 numeric timestamptz jsonb text[]  ou  enum:<nom>
"""
from pathlib import Path

ENUMS = {
    "source_type": ["perso", "tipster", "page_facebook", "compte_instagram", "canal_telegram", "site", "modele_betwise"],
    "source_visibility": ["privee", "partagee"],
    "prediction_status": ["verifie", "declare", "annule"],
    "settle_result": ["en_attente", "gagne", "perdu", "rembourse"],
    "risk_category": ["prudent", "moyen", "risque"],
    "bet_type": ["simple", "combine"],
    "bet_status": ["en_cours", "gagne", "perdu", "rembourse", "annule"],
    "import_channel": ["manuel", "texte", "capture", "prono", "telegram"],
    "tx_type": ["depot", "retrait", "mise", "gain", "ajustement"],
    "match_status": ["programme", "en_cours", "termine", "reporte", "annule"],
    "eval_status": ["tendance", "provisoire", "evalue"],
    "metric_axis": ["marche", "competition", "risque"],
}

TABLES = {
    "competitions": "id:uuid= code_externe:text? nom:text pays:text? saison:text couverte_auto:bool= created_at:timestamptz=",
    "teams": "id:uuid= code_externe:text? nom:text alias:text[]= competition_id:uuid? created_at:timestamptz=",
    "matches": "id:uuid= code_externe:text? competition_id:uuid home_team_id:uuid away_team_id:uuid kickoff_at:timestamptz statut:enum:match_status= score_home:int2? score_away:int2? source_resultat:text? result_at:timestamptz? af_fixture_id:int4? af_home_id:int4? af_away_id:int4? minute:int2? live_at:timestamptz? ht_home:int2? ht_away:int2? details:jsonb? details_at:timestamptz? created_at:timestamptz= updated_at:timestamptz=",
    "markets": "code:text libelle_fr:text a_parametre:bool= version:int2=",
    "profiles": "user_id:uuid pseudo:text devise:text= role:text= created_at:timestamptz=",
    "bankrolls": "id:uuid= user_id:uuid capital_initial:numeric= devise:text= active:bool= created_at:timestamptz=",
    "user_limits": "id:uuid= user_id:uuid mise_max:numeric? perte_max_jour:numeric? perte_max_semaine:numeric? nb_paris_max_jour:int2? valid_from:timestamptz=",
    "sources": "id:uuid= type:enum:source_type nom:text identifiant_externe:text? description:text? visibilite:enum:source_visibility= created_by:uuid? created_at:timestamptz=",
    "source_follows": "user_id:uuid source_id:uuid followed_at:timestamptz=",
    "uploads": "id:uuid= user_id:uuid storage_path:text kind:text json_extrait:jsonb? confiance:jsonb? corrections:jsonb? created_at:timestamptz=",
    "predictions": "id:uuid= source_id:uuid match_id:uuid? match_libre:text? market_code:text market_param:numeric? selection:text cote_annoncee:numeric? probabilite_annoncee:numeric? risque_annonce:enum:risk_category? risque_calcule:enum:risk_category? published_at:timestamptz? logged_at:timestamptz= statut:enum:prediction_status= motif_annulation:text? submitted_by:uuid? upload_id:uuid? resultat:enum:settle_result= settled_at:timestamptz? dedupe_key:text?",
    "prediction_versions": "id:uuid= prediction_id:uuid changes:jsonb changed_by:uuid? changed_at:timestamptz=",
    "odds_observations": "id:uuid= match_id:uuid? market_code:text market_param:numeric? selection:text cote:numeric bookmaker:text? origine:text observed_at:timestamptz= observed_by:uuid?",
    "bets": "id:uuid= user_id:uuid bankroll_id:uuid type:enum:bet_type= mise:numeric cote_totale:numeric? statut:enum:bet_status= gain_net:numeric? placed_at:timestamptz= source_import:enum:import_channel= raw_text:text? upload_id:uuid? settled_at:timestamptz? created_at:timestamptz= nb_selections:int2? detail_complet:bool= coupon_externe:text? bookmaker:text? ticket_fingerprint:text? virtuel:bool=",
    "bet_selections": "id:uuid= bet_id:uuid match_id:uuid? match_libre:text? market_code:text market_param:numeric? selection:text cote:numeric cote_observed_at:timestamptz= origin_source_id:uuid prediction_id:uuid? risque_calcule:enum:risk_category? resultat:enum:settle_result= settled_at:timestamptz?",
    "bankroll_transactions": "id:uuid= bankroll_id:uuid type:enum:tx_type montant:numeric bet_id:uuid? note:text? at:timestamptz=",
    "source_metrics": "source_id:uuid periode:text nb_declares:int4= nb_verifies:int4= nb_gagnes:int4= nb_regles:int4= taux_reussite:numeric? rendement:numeric? ic_bas:numeric? ic_haut:numeric? pire_serie:numeric? statut_eval:enum:eval_status= computed_at:timestamptz=",
    "source_metrics_by_axis": "source_id:uuid periode:text axe:enum:metric_axis valeur:text nb_declares:int4= nb_gagnes:int4= rendement:numeric? computed_at:timestamptz=",
    "model_estimates": "id:uuid= match_id:uuid market_code:text market_param:numeric? selection:text probabilite:numeric cote_reference:numeric? niveau_risque:int2? justification:jsonb? model_version:text prediction_id:uuid? created_at:timestamptz= updated_at:timestamptz=",
    "match_extras": "match_id:uuid lineups:jsonb? lineups_at:timestamptz? injuries:jsonb? injuries_at:timestamptz? stats:jsonb? stats_at:timestamptz?",
    "af_history": "fixture_id:int4 league:int4 season:int4 played_at:timestamptz home_id:int4 home_nom:text away_id:int4 away_nom:text home_goals:int2 away_goals:int2 xg_home:numeric? xg_away:numeric? shots_home:int2? shots_away:int2? sot_home:int2? sot_away:int2? stats_checked:bool= imported_at:timestamptz=",
    "objectifs": "id:uuid= user_id:uuid bankroll_depart:numeric cible:numeric debut:date= echeance:date paris_par_jour:int2= actif:bool= created_at:timestamptz=",
    "push_subscriptions": "id:uuid= user_id:uuid endpoint:text p256dh:text auth:text user_agent:text? created_at:timestamptz= last_ok_at:timestamptz?",
    "notification_prefs": "user_id:uuid resultats:bool= coup_envoi:bool= coups_du_jour:bool= sources:bool= updated_at:timestamptz=",
    "notifications": "id:uuid= user_id:uuid type:text cle:text titre:text corps:text url:text= created_at:timestamptz= sent_at:timestamptz? lu_at:timestamptz?",
    "app_secrets": "name:text value:jsonb created_at:timestamptz=",
    "daily_picks": "id:uuid= jour:date match_id:uuid market_code:text market_param:numeric? selection:text categorie:text rang:int2 probabilite:numeric cote_ref:numeric? cote_juste:numeric p_modele:numeric? prediction_id:uuid? created_at:timestamptz=",
    "match_history": "id:uuid= ligue:text saison:text played_on:date home_nom:text away_nom:text home_goals:int2 away_goals:int2 cote_1:numeric? cote_n:numeric? cote_2:numeric? cote_plus25:numeric? cote_moins25:numeric? imported_at:timestamptz=",
    "conversations": "id:uuid= user_id:uuid titre:text? created_at:timestamptz=",
    "messages": "id:uuid= conversation_id:uuid role:text contenu:text? fonctions:jsonb? tokens_in:int4? tokens_out:int4? created_at:timestamptz=",
    "feedback": "id:uuid= user_id:uuid? ecran:text? message:text created_at:timestamptz=",
    "bet_versions": "id:uuid= bet_id:uuid selection_id:uuid? changes:jsonb changed_by:uuid? changed_at:timestamptz=",
}

VIEWS = {
    "source_trend": "source_id:uuid? nb_declares:int8? nb_verifies:int8? nb_regles:int8? nb_gagnes:int8? nb_perdus:int8? unites_nettes:numeric? nb_avec_cote:int8? prudent_regles:int8? prudent_gagnes:int8? moyen_regles:int8? moyen_gagnes:int8? risque_regles:int8? risque_gagnes:int8? dernier_prono:timestamptz?",
    "my_bankroll_summary": "bankroll_id:uuid? user_id:uuid? devise:text? solde:numeric? exposition:numeric? resultat_net:numeric? nb_regles:int8? nb_gagnes:int8?",
}

# (nom_contrainte, table, colonne, table_ref, colonne_ref, one_to_one) — uniquement les FK internes au schéma
FKS = [
    ("teams_competition_id_fkey", "teams", "competition_id", "competitions", "id", False),
    ("matches_competition_id_fkey", "matches", "competition_id", "competitions", "id", False),
    ("matches_home_team_id_fkey", "matches", "home_team_id", "teams", "id", False),
    ("matches_away_team_id_fkey", "matches", "away_team_id", "teams", "id", False),
    ("source_follows_source_id_fkey", "source_follows", "source_id", "sources", "id", False),
    ("predictions_source_id_fkey", "predictions", "source_id", "sources", "id", False),
    ("predictions_match_id_fkey", "predictions", "match_id", "matches", "id", False),
    ("predictions_market_code_fkey", "predictions", "market_code", "markets", "code", False),
    ("predictions_upload_id_fkey", "predictions", "upload_id", "uploads", "id", False),
    ("prediction_versions_prediction_id_fkey", "prediction_versions", "prediction_id", "predictions", "id", False),
    ("odds_observations_match_id_fkey", "odds_observations", "match_id", "matches", "id", False),
    ("odds_observations_market_code_fkey", "odds_observations", "market_code", "markets", "code", False),
    ("bets_bankroll_id_fkey", "bets", "bankroll_id", "bankrolls", "id", False),
    ("bets_upload_id_fkey", "bets", "upload_id", "uploads", "id", False),
    ("bet_selections_bet_id_fkey", "bet_selections", "bet_id", "bets", "id", False),
    ("bet_selections_match_id_fkey", "bet_selections", "match_id", "matches", "id", False),
    ("bet_selections_market_code_fkey", "bet_selections", "market_code", "markets", "code", False),
    ("bet_selections_origin_source_id_fkey", "bet_selections", "origin_source_id", "sources", "id", False),
    ("bet_selections_prediction_id_fkey", "bet_selections", "prediction_id", "predictions", "id", False),
    ("bankroll_transactions_bankroll_id_fkey", "bankroll_transactions", "bankroll_id", "bankrolls", "id", False),
    ("bankroll_transactions_bet_id_fkey", "bankroll_transactions", "bet_id", "bets", "id", False),
    ("source_metrics_source_id_fkey", "source_metrics", "source_id", "sources", "id", False),
    ("source_metrics_by_axis_source_id_fkey", "source_metrics_by_axis", "source_id", "sources", "id", False),
    ("model_estimates_match_id_fkey", "model_estimates", "match_id", "matches", "id", False),
    ("model_estimates_market_code_fkey", "model_estimates", "market_code", "markets", "code", False),
    ("model_estimates_prediction_id_fkey", "model_estimates", "prediction_id", "predictions", "id", False),
    ("messages_conversation_id_fkey", "messages", "conversation_id", "conversations", "id", False),
    ("bet_versions_bet_id_fkey", "bet_versions", "bet_id", "bets", "id", False),
    ("bet_versions_selection_id_fkey", "bet_versions", "selection_id", "bet_selections", "id", False),
]

# nom -> (args [(nom, type, optionnel)], retour)   retour : type scalaire ou "row:<table>"
FUNCTIONS = {
    "is_admin": ([], "bool"),
    "risk_from_odds": ([("c", "numeric", False)], "enum:risk_category"),
    "ensure_profile": ([("p_pseudo", "text", True)], "row:profiles"),
    "place_bet": ([("p_mise", "numeric", False), ("p_selections", "jsonb", False), ("p_source_import", "enum:import_channel", True), ("p_raw_text", "text", True), ("p_upload_id", "uuid", True), ("p_placed_at", "timestamptz", True), ("p_summary", "jsonb", True), ("p_virtuel", "bool", True)], "uuid"),
    "bankroll_move": ([("p_type", "enum:tx_type", False), ("p_montant", "numeric", False), ("p_note", "text", True)], "row:bankroll_transactions"),
    "settle_bet": ([("p_bet_id", "uuid", False), ("p_result", "enum:settle_result", False)], "row:bets"),
    "settle_selection": ([("p_market", "text", False), ("p_param", "numeric", False), ("p_selection", "text", False), ("p_home", "int4", False), ("p_away", "int4", False), ("p_ht_home", "int4", True), ("p_ht_away", "int4", True)], "enum:settle_result"),
    "settle_pending": ([], "setof:matchs:int4,selections_reglees:int4,pronos_regles:int4,paris_finalises:int4"),
    "log_prediction": ([("p_source_id", "uuid", False), ("p_market_code", "text", False), ("p_selection", "text", False), ("p_match_id", "uuid", True), ("p_match_libre", "text", True), ("p_market_param", "numeric", True), ("p_cote_annoncee", "numeric", True), ("p_risque_annonce", "enum:risk_category", True), ("p_published_at", "timestamptz", True), ("p_upload_id", "uuid", True)], "setof:prediction_id:uuid,created:bool,statut:enum:prediction_status"),
    "cancel_prediction": ([("p_id", "uuid", False), ("p_motif", "text", False)], "void"),
    "delete_duplicate_bet": ([("p_bet_id", "uuid", False)], "void"),
    "source_cumulative": ([("p_source_id", "uuid", False), ("p_since", "timestamptz", True)], "setof:at:timestamptz,gain:numeric,cumul:numeric,resultat:enum:settle_result,libelle:text"),
    "compute_source_metrics": ([], "setof:sources_calculees:int4"),
    "set_selection_origin": ([("p_selection_id", "uuid", False), ("p_source_id", "uuid", False)], "void"),
    "update_selection": ([("p_selection_id", "uuid", False), ("p_cote", "numeric", True), ("p_match_id", "uuid", True), ("p_match_libre", "text", True), ("p_market_code", "text", True), ("p_market_param", "numeric", True), ("p_selection", "text", True), ("p_clear_match", "bool", True)], "void"),
    "update_bet": ([("p_bet_id", "uuid", False), ("p_mise", "numeric", True), ("p_bookmaker", "text", True), ("p_placed_at", "timestamptz", True)], "void"),
}

TS = {"uuid": "string", "text": "string", "bool": "boolean", "int2": "number", "int4": "number", "int8": "number",
      "numeric": "number", "timestamptz": "string", "date": "string", "jsonb": "Json", "text[]": "string[]"}


def ts_type(t: str) -> str:
    if t.startswith("enum:"):
        return f'Database["betwise"]["Enums"]["{t[5:]}"]'
    return TS[t]


def parse(spec: str):
    cols = []
    for tok in spec.split():
        name, _, rest = tok.partition(":")
        nullable = rest.endswith("?") or rest.endswith("?=") or rest.endswith("=?")
        hasdef = "=" in rest
        t = rest.rstrip("?=")
        cols.append((name, t, nullable, hasdef))
    return cols


def rows(cols, mode):
    out = []
    for name, t, nullable, hasdef in cols:
        ty = ts_type(t) + (" | null" if nullable else "")
        if mode == "Row":
            out.append(f"          {name}: {ty}")
        elif mode == "Insert":
            opt = "?" if (nullable or hasdef) else ""
            out.append(f"          {name}{opt}: {ty}")
        else:
            out.append(f"          {name}?: {ty}")
    return "\n".join(out)


def relationships(table):
    rels = [f for f in FKS if f[1] == table]
    if not rels:
        return "        Relationships: []"
    items = []
    for name, _, col, ref, refcol, o2o in rels:
        items.append(
            "          {\n"
            f'            foreignKeyName: "{name}"\n'
            f'            columns: ["{col}"]\n'
            f"            isOneToOne: {'true' if o2o else 'false'}\n"
            f'            referencedRelation: "{ref}"\n'
            f'            referencedColumns: ["{refcol}"]\n'
            "          },"
        )
    return "        Relationships: [\n" + "\n".join(items) + "\n        ]"


def table_block(name, spec):
    cols = parse(spec)
    return (
        f"      {name}: {{\n"
        f"        Row: {{\n{rows(cols, 'Row')}\n        }}\n"
        f"        Insert: {{\n{rows(cols, 'Insert')}\n        }}\n"
        f"        Update: {{\n{rows(cols, 'Update')}\n        }}\n"
        f"{relationships(name)}\n"
        f"      }}"
    )


def view_block(name, spec):
    cols = parse(spec)
    return (
        f"      {name}: {{\n"
        f"        Row: {{\n{rows(cols, 'Row')}\n        }}\n"
        f"        Relationships: []\n"
        f"      }}"
    )


def fn_block(name, args, ret):
    if args:
        a = "\n".join(f"          {n}{'?' if opt else ''}: {ts_type(t)}{' | null' if opt else ''}" for n, t, opt in args)
        args_s = f"        Args: {{\n{a}\n        }}"
    else:
        args_s = "        Args: Record<PropertyKey, never>"
    if ret.startswith("row:"):
        r = f'Database["betwise"]["Tables"]["{ret[4:]}"]["Row"]'
    elif ret == "void":
        r = "undefined"
    elif ret.startswith("setof:"):
        fields = []
        for f in ret[6:].split(","):
            n, t = f.split(":", 1)
            fields.append(f"{n}: {ts_type(t)}")
        r = "{ " + "; ".join(fields) + " }[]"
    else:
        r = ts_type(ret)
    return f"      {name}: {{\n{args_s}\n        Returns: {r}\n      }}"


def main():
    tables = "\n".join(table_block(n, s) for n, s in TABLES.items())
    views = "\n".join(view_block(n, s) for n, s in VIEWS.items())
    fns = "\n".join(fn_block(n, a, r) for n, (a, r) in FUNCTIONS.items())
    enums = "\n".join(f"      {n}: {' | '.join(repr(v).replace(chr(39), chr(34)) for v in vals)}" for n, vals in ENUMS.items())
    consts = "\n".join(f"      {n}: [{', '.join(repr(v).replace(chr(39), chr(34)) for v in vals)}]," for n, vals in ENUMS.items())

    out = f'''// Généré par scripts/gen-types.py — ne pas éditer à la main. `npm run db:types` pour régénérer.
export type Json =
  | string
  | number
  | boolean
  | null
  | {{ [key: string]: Json | undefined }}
  | Json[]

export type Database = {{
  __InternalSupabase: {{
    PostgrestVersion: "14.18"
  }}
  betwise: {{
    Tables: {{
{tables}
    }}
    Views: {{
{views}
    }}
    Functions: {{
{fns}
    }}
    Enums: {{
{enums}
    }}
    CompositeTypes: {{
      [_ in never]: never
    }}
  }}
}}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

export type Tables<
  SchemaTableName extends keyof (DatabaseWithoutInternals["betwise"]["Tables"] & DatabaseWithoutInternals["betwise"]["Views"]),
> = (DatabaseWithoutInternals["betwise"]["Tables"] & DatabaseWithoutInternals["betwise"]["Views"])[SchemaTableName]["Row"]

export type TablesInsert<SchemaTableName extends keyof DatabaseWithoutInternals["betwise"]["Tables"]> =
  DatabaseWithoutInternals["betwise"]["Tables"][SchemaTableName]["Insert"]

export type Enums<E extends keyof DatabaseWithoutInternals["betwise"]["Enums"]> = DatabaseWithoutInternals["betwise"]["Enums"][E]

export const Constants = {{
  betwise: {{
    Enums: {{
{consts}
    }},
  }},
}} as const
'''
    Path(__file__).resolve().parent.parent.joinpath("src/lib/supabase/database.types.ts").write_text(out, encoding="utf-8")
    print("database.types.ts régénéré")


if __name__ == "__main__":
    main()
