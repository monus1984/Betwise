"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MARKETS_ALL } from "./markets";

const selection = z.object({
  match_id: z.string().uuid().nullable(),
  match_libre: z.string().trim().min(2).max(120).nullable(),
  market_code: z.enum(MARKETS_ALL),
  market_param: z.number().nullable(),
  selection: z.string().trim().min(1).max(60),
  cote: z.number().gt(1).lte(1000),
  origin_source_id: z.string().uuid(),
  resultat: z.enum(["gagne", "perdu", "rembourse"]).nullable(),
});

const schema = z.object({
  virtuel: z.boolean().optional(),
  assurance: z.boolean().optional(),
  mise: z.number().positive().lte(100_000_000),
  statut: z.enum(["en_cours", "gagne", "perdu", "rembourse"]),
  placed_at: z.string().datetime().nullable(),
  bookmaker: z.string().max(40).nullable(),
  coupon_externe: z.string().max(40).nullable(),
  upload_id: z.string().uuid().nullable(),
  raw_text: z.string().max(5000).nullable(),
  summary: z.object({ cote_totale: z.number().gt(1), nb_selections: z.number().int().min(0), origin_source_id: z.string().uuid() }).nullable(),
  selections: z.array(selection).max(30),
});
export type ImportedBetInput = z.infer<typeof schema>;

export async function placeImportedBet(input: ImportedBetInput): Promise<{ ok: true; betId: string } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide" };
  const d = parsed.data;
  if (d.selections.length === 0 && !d.summary) return { ok: false, error: "Aucune sélection lisible et pas de résumé." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_bet", {
    p_mise: d.mise,
    p_selections: d.selections,
    p_source_import: d.upload_id ? "capture" : "texte",
    p_raw_text: d.raw_text,
    p_upload_id: d.upload_id,
    p_placed_at: d.placed_at,
    p_summary: {
      statut: d.statut,
      bookmaker: d.bookmaker,
      coupon_externe: d.coupon_externe,
      ...(d.summary ?? { nb_selections: d.selections.length }),
    },
    p_virtuel: d.virtuel ?? false,
  });
  if (error) {
    if (error.message.includes("coupon déjà importé")) return { ok: false, error: "Ce coupon a déjà été importé." };
    if (error.message.includes("ticket déjà importé")) return { ok: false, error: "Ce " + error.message.replace(/^.*?ticket déjà importé/, "ticket a déjà été importé") + ". Rien n’a été ajouté." };
    return { ok: false, error: "Enregistrement impossible : " + error.message };
  }
  // Combiné assuré : posé après coup (le pari est recalculé si une seule sélection est déjà perdue)
  if (d.assurance && data) await supabase.rpc("set_bet_assurance", { p_bet_id: data as string, p_on: true });
  revalidatePath("/"); revalidatePath("/paris");
  if (d.virtuel) revalidatePath("/sources", "layout");
  return { ok: true, betId: data as string };
}
