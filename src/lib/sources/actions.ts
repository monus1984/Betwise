"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MARKETS } from "@/lib/bets/markets";
import { normalizeLink } from "./link";

const SOURCE_TYPES = ["tipster", "page_facebook", "compte_instagram", "canal_telegram", "site"] as const;

const sourceSchema = z.object({
  type: z.enum(SOURCE_TYPES),
  nom: z.string().trim().min(2).max(60),
  identifiant_externe: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  lien: z.string().trim().max(300).optional().or(z.literal("")),
  visibilite: z.enum(["privee", "partagee"]),
});

export type ActionState = { error?: string } | undefined;

export async function createSource(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = sourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Vérifie le nom (2 à 60 caractères) et le type." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  // Une source partagée avec le même identifiant externe existe peut-être déjà : on la suit plutôt que la dupliquer
  const ident = parsed.data.identifiant_externe?.trim() || null;
  const lienSaisi = parsed.data.lien?.trim() || "";
  const lien = normalizeLink(lienSaisi, parsed.data.type);
  if (lienSaisi && !lien) return { error: "Lien de la page non reconnu. Colle l’adresse complète, par exemple https://www.facebook.com/nomdelapage." };
  if (ident) {
    const { data: existing } = await supabase
      .from("sources")
      .select("id")
      .eq("visibilite", "partagee")
      .ilike("identifiant_externe", ident)
      .maybeSingle();
    if (existing) {
      await supabase.from("source_follows").upsert({ user_id: user.id, source_id: existing.id });
      revalidatePath("/sources");
      redirect(`/sources/${existing.id}?existante=1`);
    }
  }

  const { data, error } = await supabase
    .from("sources")
    .insert({
      type: parsed.data.type,
      nom: parsed.data.nom,
      identifiant_externe: ident,
      description: parsed.data.description?.trim() || null,
      lien,
      visibilite: parsed.data.visibilite,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: "Création impossible : " + error.message };
  await supabase.from("source_follows").upsert({ user_id: user.id, source_id: data.id });
  revalidatePath("/sources");
  redirect(`/sources/${data.id}`);
}

export async function toggleFollow(sourceId: string, follow: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  if (follow) await supabase.from("source_follows").upsert({ user_id: user.id, source_id: sourceId });
  else await supabase.from("source_follows").delete().eq("user_id", user.id).eq("source_id", sourceId);
  revalidatePath("/sources");
  revalidatePath(`/sources/${sourceId}`);
}

const predictionSchema = z.object({
  source_id: z.string().uuid(),
  match_id: z.string().uuid().nullable(),
  match_libre: z.string().trim().min(2).max(120).nullable(),
  market_code: z.enum(MARKETS),
  market_param: z.number().nullable(),
  selection: z.string().trim().min(1).max(60),
  cote_annoncee: z.number().gt(1).lte(1000).nullable(),
  risque_annonce: z.enum(["prudent", "moyen", "risque"]).nullable(),
  published_at: z.string().datetime().nullable(),
}).refine((p) => p.match_id || p.match_libre, { message: "Match requis" });

export type LogPredictionInput = z.infer<typeof predictionSchema>;
export type LogPredictionResult =
  | { ok: true; id: string; created: boolean; statut: "verifie" | "declare" | "annule" }
  | { ok: false; error: string };

export async function logPrediction(input: LogPredictionInput): Promise<LogPredictionResult> {
  const parsed = predictionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide" };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("log_prediction", {
    p_source_id: d.source_id,
    p_market_code: d.market_code,
    p_selection: d.selection,
    p_match_id: d.match_id,
    p_match_libre: d.match_libre,
    p_market_param: d.market_param,
    p_cote_annoncee: d.cote_annoncee,
    p_risque_annonce: d.risque_annonce,
    p_published_at: d.published_at,
  });
  if (error) return { ok: false, error: error.message.includes("source") ? "Source inconnue." : "Enregistrement impossible : " + error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, error: "Réponse vide." };
  revalidatePath(`/sources/${d.source_id}`);
  revalidatePath("/sources");
  return { ok: true, id: row.prediction_id, created: row.created, statut: row.statut };
}

export async function cancelPrediction(id: string, motif: string, sourceId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_prediction", { p_id: id, p_motif: motif });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/sources/${sourceId}`);
  return { ok: true as const };
}

/** Création express depuis un pari ou un import : nom + type. Réutilise une source visible du même nom. */
export async function quickCreateSource(input: { nom: string; type: string; visibilite?: "privee" | "partagee" }): Promise<{ ok: true; source: { id: string; nom: string; type: string } } | { ok: false; error: string }> {
  const nom = input.nom.trim().replace(/\s+/g, " ");
  if (nom.length < 2 || nom.length > 60) return { ok: false, error: "Le nom doit faire entre 2 et 60 caractères." };
  const type = (SOURCE_TYPES as readonly string[]).includes(input.type) ? (input.type as (typeof SOURCE_TYPES)[number]) : "tipster";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const visibilite = input.visibilite === "privee" ? "privee" : "partagee";
  const { data: existing } = await supabase.from("sources").select("id, nom, type").ilike("nom", nom).not("type", "in", "(perso,modele_betwise)").limit(1).maybeSingle();
  if (existing) {
    await supabase.from("source_follows").upsert({ user_id: user.id, source_id: existing.id });
    revalidatePath("/sources");
    return { ok: true, source: existing };
  }
  const { data, error } = await supabase.from("sources").insert({ type, nom, visibilite, created_by: user.id }).select("id, nom, type").single();
  if (error) return { ok: false, error: "Création impossible : " + error.message };
  await supabase.from("source_follows").upsert({ user_id: user.id, source_id: data.id });
  revalidatePath("/sources");
  return { ok: true, source: data };
}

/** Enregistre (ou retire) le lien de la page d'une source. */
export async function setSourceLink(sourceId: string, type: string, saisie: string): Promise<{ ok: true; lien: string | null } | { ok: false; error: string }> {
  const brut = saisie.trim();
  const lien = brut ? normalizeLink(brut, type) : null;
  if (brut && !lien) return { ok: false, error: "Lien non reconnu. Colle l’adresse complète de la page, par exemple https://www.facebook.com/nomdelapage." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_source_link", { p_source_id: sourceId, p_lien: lien });
  if (error) return { ok: false, error: error.message.includes("créateur") ? "Seul le créateur de cette source peut changer son lien." : "Enregistrement impossible : " + error.message };
  revalidatePath(`/sources/${sourceId}`);
  revalidatePath("/sources");
  return { ok: true, lien };
}
