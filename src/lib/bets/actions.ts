"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MARKETS_ALL } from "./markets";


const selectionSchema = z.object({
  match_id: z.string().uuid().nullable(),
  match_libre: z.string().trim().min(2).max(120).nullable(),
  market_code: z.enum(MARKETS_ALL),
  market_param: z.number().nullable(),
  selection: z.string().trim().min(1).max(60),
  cote: z.number().gt(1).lte(1000),
  origin_source_id: z.string().uuid(),
  prediction_id: z.string().uuid().nullable().optional(),
}).refine((s) => s.match_id || s.match_libre, { message: "Match requis" });

const placeSchema = z.object({
  mise: z.number().positive().lte(100_000_000),
  selections: z.array(selectionSchema).min(1).max(20),
});

export type PlaceBetInput = z.infer<typeof placeSchema>;
export type PlaceBetResult = { ok: true; betId: string } | { ok: false; error: string };

export async function placeBet(input: PlaceBetInput): Promise<PlaceBetResult> {
  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_bet", {
    p_mise: parsed.data.mise,
    p_selections: parsed.data.selections,
    p_source_import: "manuel",
  });
  if (error) return { ok: false, error: humanize(error.message) };
  revalidatePath("/");
  revalidatePath("/paris");
  return { ok: true, betId: data as string };
}

export async function settleBet(betId: string, result: "gagne" | "perdu" | "rembourse") {
  const supabase = await createClient();
  const { error } = await supabase.rpc("settle_bet", { p_bet_id: betId, p_result: result });
  if (error) return { ok: false as const, error: humanize(error.message) };
  revalidatePath("/");
  revalidatePath("/paris");
  return { ok: true as const };
}

export async function bankrollMove(formData: FormData) {
  const type = String(formData.get("type")) === "retrait" ? "retrait" : "depot";
  const montant = Number(String(formData.get("montant") ?? "").replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(montant) || montant <= 0) return;
  const supabase = await createClient();
  await supabase.rpc("bankroll_move", { p_type: type, p_montant: montant });
  revalidatePath("/");
  redirect("/");
}

function humanize(msg: string) {
  if (msg.includes("origine")) return "Choisis l’origine de chaque sélection.";
  if (msg.includes("cote")) return "La cote doit être supérieure à 1.";
  if (msg.includes("mise")) return "La mise doit être positive.";
  if (msg.includes("déjà réglé")) return "Ce pari est déjà réglé.";
  if (msg.includes("pari réglé")) return msg.replace(/^.*pari réglé/, "Pari réglé");
  if (msg.includes("source inconnue")) return "Source inconnue.";
  return "Enregistrement impossible : " + msg;
}

/** Suppression d'un pari saisi en double (autorisée 24 h après la saisie, sur ses propres paris). */
export async function deleteDuplicateBet(betId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_duplicate_bet", { p_bet_id: betId });
  if (error) return { ok: false as const, error: error.message.includes("24 h") ? "Suppression possible seulement dans les 24 h après la saisie." : error.message };
  revalidatePath("/"); revalidatePath("/paris");
  return { ok: true as const };
}

export async function setSelectionOrigin(selectionId: string, sourceId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_selection_origin", { p_selection_id: selectionId, p_source_id: sourceId });
  if (error) return { ok: false as const, error: humanize(error.message) };
  revalidatePath("/paris"); revalidatePath("/");
  return { ok: true as const };
}

export async function updateSelection(input: { selectionId: string; cote?: number; matchId?: string | null; matchLibre?: string | null; clearMatch?: boolean; marketCode?: string; marketParam?: number | null; selection?: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_selection", {
    p_selection_id: input.selectionId,
    p_cote: input.cote ?? null,
    p_match_id: input.matchId ?? null,
    p_match_libre: input.matchLibre ?? null,
    p_market_code: input.marketCode ?? null,
    p_market_param: input.marketParam ?? null,
    p_selection: input.selection ?? null,
    p_clear_match: input.clearMatch ?? false,
  });
  if (error) return { ok: false as const, error: humanize(error.message) };
  revalidatePath("/paris"); revalidatePath("/");
  return { ok: true as const };
}

export async function updateBet(input: { betId: string; mise?: number; bookmaker?: string; placedAt?: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_bet", { p_bet_id: input.betId, p_mise: input.mise ?? null, p_bookmaker: input.bookmaker ?? null, p_placed_at: input.placedAt ?? null });
  if (error) return { ok: false as const, error: humanize(error.message) };
  revalidatePath("/paris"); revalidatePath("/");
  return { ok: true as const };
}
