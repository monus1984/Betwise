"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type R = { ok: true; id?: string } | { ok: false; error: string };

export async function creerMontante(input: { nom: string; mise: number; objectif: number; paliers: number; niveau: string | null }): Promise<R> {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };
  const mise = Math.round(Number(input.mise)), objectif = Math.round(Number(input.objectif)), paliers = Math.round(Number(input.paliers));
  if (!(mise > 0)) return { ok: false, error: "Indique une mise de départ." };
  if (!(objectif > mise)) return { ok: false, error: "L’objectif doit dépasser la mise de départ." };
  if (!(paliers >= 1 && paliers <= 30)) return { ok: false, error: "Entre 1 et 30 paliers." };
  const niveau = input.niveau && ["sur", "audacieux", "risque"].includes(input.niveau) ? input.niveau : null;
  const nom = (input.nom || "").trim().slice(0, 80) || `${mise.toLocaleString("fr-FR")} F vers ${objectif.toLocaleString("fr-FR")} F`;
  const { data, error } = await db.from("montantes").insert({ user_id: user.id, nom, mise_depart: mise, objectif, paliers_prevus: paliers, niveau }).select("id").single();
  if (error) return { ok: false, error: "Enregistrement impossible : " + error.message };
  revalidatePath("/montantes");
  return { ok: true, id: data.id };
}

export async function arreterMontante(id: string): Promise<R> {
  const db = await createClient();
  const { error } = await db.from("montantes").update({ statut: "arretee", termine_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("statut", "en_cours");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/montantes"); revalidatePath(`/montantes/${id}`);
  return { ok: true };
}

export async function rattacherPalier(montanteId: string, betId: string): Promise<R> {
  const db = await createClient();
  const { error } = await db.rpc("montante_rattacher", { p_montante_id: montanteId, p_bet_id: betId });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/montantes/${montanteId}`); revalidatePath("/montantes");
  return { ok: true };
}
