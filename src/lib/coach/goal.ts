/** Objectif actif de l'utilisateur, sa progression et le plan recalculé sur la bankroll du moment. */
import type { createClient } from "@/lib/supabase/server";
import { evaluatePlan, misesDuJour, type PlanResult } from "./plan";

type Db = Awaited<ReturnType<typeof createClient>>;
export type GoalState = {
  id: string; depart: number; cible: number; debut: string; echeance: string; parisParJour: number;
  solde: number; progression: number; tempsEcoule: number; joursRestants: number; atteint: boolean;
  statut: "atteint" | "en_avance" | "dans_les_temps" | "en_retard" | "echu";
  plan: PlanResult | null; mises: ReturnType<typeof misesDuJour>;
};

const DAY = 86400000;
export async function loadGoal(db: Db, solde: number): Promise<GoalState | null> {
  const { data: g } = await db.from("objectifs").select("*").eq("actif", true).maybeSingle();
  if (!g) return null;
  const depart = Number(g.bankroll_depart), cible = Number(g.cible);
  const debut = Date.parse(`${g.debut}T00:00:00Z`), fin = Date.parse(`${g.echeance}T23:59:59Z`);
  const tempsEcoule = Math.min(1, Math.max(0, (Date.now() - debut) / (fin - debut)));
  const joursRestants = Math.max(0, Math.ceil((fin - Date.now()) / DAY));
  const progression = (solde - depart) / (cible - depart);
  const atteint = solde >= cible;
  const statut = atteint ? "atteint" : joursRestants === 0 ? "echu" : progression >= tempsEcoule + 0.1 ? "en_avance" : progression >= tempsEcoule - 0.1 ? "dans_les_temps" : "en_retard";
  const plan = !atteint && joursRestants > 0 && solde > 0 ? evaluatePlan({ bankroll: solde, depart, cible, jours: joursRestants, parisParJour: g.paris_par_jour }) : null;
  return { id: g.id, depart, cible, debut: g.debut, echeance: g.echeance, parisParJour: g.paris_par_jour, solde, progression, tempsEcoule, joursRestants, atteint, statut, plan, mises: misesDuJour(Math.max(solde, 0), depart) };
}
