"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Fixe (ou remplace) l'objectif actif. La bankroll de départ est le solde du moment. */
export async function setObjectif(input: { cible: number; jours: number; parisParJour?: number }): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };
  const { data: s } = await db.from("my_bankroll_summary").select("solde").maybeSingle();
  const solde = Number(s?.solde ?? 0);
  if (solde <= 0) return { ok: false, error: "Enregistre d'abord ta bankroll (un dépôt) : l'objectif part de ton solde actuel." };
  const cible = Math.round(Number(input.cible));
  if (!Number.isFinite(cible) || cible <= solde) return { ok: false, error: `L'objectif doit dépasser ton solde actuel (${solde.toLocaleString("fr-FR")} F).` };
  const jours = Math.min(180, Math.max(1, Math.round(Number(input.jours))));
  const today = new Date().toISOString().slice(0, 10);
  const echeance = new Date(Date.now() + jours * 86400000).toISOString().slice(0, 10);
  await db.from("objectifs").update({ actif: false }).eq("user_id", user.id).eq("actif", true);
  const { error } = await db.from("objectifs").insert({ user_id: user.id, bankroll_depart: solde, cible, debut: today, echeance, paris_par_jour: Math.min(10, Math.max(1, Math.round(input.parisParJour ?? 2))) });
  if (error) return { ok: false, error: "Enregistrement impossible : " + error.message };
  revalidatePath("/"); revalidatePath("/coach");
  return { ok: true };
}

export async function stopObjectif() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return;
  await db.from("objectifs").update({ actif: false }).eq("user_id", user.id).eq("actif", true);
  revalidatePath("/");
}

/** Simulation sans enregistrement, pour l'aperçu du formulaire. */
export async function previewObjectif(input: { cible: number; jours: number }) {
  const db = await createClient();
  const { data: s } = await db.from("my_bankroll_summary").select("solde").maybeSingle();
  const solde = Number(s?.solde ?? 0);
  if (solde <= 0 || input.cible <= solde || input.jours < 1) return null;
  const { evaluatePlan } = await import("./plan");
  return { solde, ...evaluatePlan({ bankroll: solde, depart: solde, cible: input.cible, jours: Math.min(180, input.jours), parisParJour: 2 }) };
}
