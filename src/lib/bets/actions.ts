"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MARKETS } from "./markets";


const selectionSchema = z.object({
  match_id: z.string().uuid().nullable(),
  match_libre: z.string().trim().min(2).max(120).nullable(),
  market_code: z.enum(MARKETS),
  market_param: z.number().nullable(),
  selection: z.string().trim().min(1).max(60),
  cote: z.number().gt(1).lte(1000),
  origin_source_id: z.string().uuid(),
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
  return "Enregistrement impossible : " + msg;
}
