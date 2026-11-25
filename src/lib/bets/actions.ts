"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MARKETS_ALL } from "./markets";
import { reglableA } from "./reglement";


const selectionSchema = z.object({
  match_id: z.string().uuid().nullable(),
  match_libre: z.string().trim().min(2).max(120).nullable(),
  market_code: z.enum(MARKETS_ALL),
  market_param: z.number().nullable(),
  selection: z.string().trim().min(1).max(120),
  cote: z.number().gt(1).lte(1000),
  origin_source_id: z.string().uuid(),
  prediction_id: z.string().uuid().nullable().optional(),
}).refine((s) => s.match_id || s.match_libre, { message: "Match requis" });

const placeSchema = z.object({
  virtuel: z.boolean().optional(),
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
    p_virtuel: parsed.data.virtuel ?? false,
  });
  if (error) return { ok: false, error: humanize(error.message) };
  revalidatePath("/");
  revalidatePath("/paris", "layout");
  if (parsed.data.virtuel) revalidatePath("/sources", "layout");
  return { ok: true, betId: data as string };
}

export async function settleBet(betId: string, result: "gagne" | "perdu" | "rembourse") {
  const supabase = await createClient();
  // Pas de règlement à la main avant la fin des matchs (22/11)
  const { data: sels } = await supabase.from("bet_selections").select("match:matches(kickoff_at, statut)").eq("bet_id", betId);
  const ms = (sels ?? []).map((x) => (Array.isArray(x.match) ? x.match[0] : x.match) as { kickoff_at: string; statut: string } | null);
  const a = reglableA(ms.map((m) => ({ kickoff_at: m?.kickoff_at ?? null, statut: m?.statut ?? null })));
  if (a && a.getTime() > Date.now()) return { ok: false as const, error: `Ce pari se règle après ses matchs, à partir de ${a.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })}.` };
  const { error } = await supabase.rpc("settle_bet", { p_bet_id: betId, p_result: result });
  if (error) return { ok: false as const, error: humanize(error.message) };
  revalidatePath("/");
  revalidatePath("/paris", "layout");
  return { ok: true as const };
}

/** Recale la bankroll sur le solde réel du bookmaker : un ajustement égal à l'écart, visible dans le journal. */
export async function bankrollAlign(formData: FormData) {
  const solde = Number(String(formData.get("solde") ?? "").replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(solde) || solde < 0) return;
  const supabase = await createClient();
  await supabase.rpc("bankroll_align", { p_solde: solde });
  revalidatePath("/");
  redirect("/");
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
  if (msg.includes("pas encore terminé")) return "Le match n’est pas terminé : tu pourras régler cette ligne après le coup de sifflet final.";
  if (msg.includes("réglée sur le score")) return "Cette ligne est réglée sur le score du match. Si le résultat est faux, corrige le pari entier.";
  if (msg.includes("source inconnue")) return "Source inconnue.";
  return "Enregistrement impossible : " + msg;
}

/** Corrige le résultat d'un pari déjà réglé (réglage automatique faux) ; la bankroll est ajustée. */
export async function correctBetResult(betId: string, result: "gagne" | "perdu" | "rembourse") {
  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_bet_result", { p_bet_id: betId, p_result: result });
  if (error) return { ok: false as const, error: "Correction impossible : " + error.message };
  revalidatePath("/"); revalidatePath("/paris", "layout");
  return { ok: true as const };
}

/** « Je n'ai pas joué ce pari » : le pari réel devient un test, la bankroll est rétablie. */
export async function convertBetToTest(betId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("convert_bet_to_test", { p_bet_id: betId });
  if (error) return { ok: false as const, error: error.message.includes("existe déjà") ? "Ce ticket existe déjà parmi tes tests." : error.message.includes("déjà un test") ? "C’est déjà un test." : "Conversion impossible : " + error.message };
  revalidatePath("/"); revalidatePath("/paris", "layout"); revalidatePath("/sources", "layout");
  return { ok: true as const };
}

/** Suppression d'un pari saisi en double (autorisée 24 h après la saisie, sur ses propres paris). */
export async function deleteDuplicateBet(betId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_duplicate_bet", { p_bet_id: betId });
  if (error) return { ok: false as const, error: error.message.includes("24 h") ? "Suppression possible seulement dans les 24 h après la saisie." : error.message };
  revalidatePath("/"); revalidatePath("/paris", "layout");
  return { ok: true as const };
}

/** Règle à la main une ligne que BETWISE ne sait pas régler seul (pari libre, match non suivi, statistique absente). */
export async function setSelectionResult(selectionId: string, result: "gagne" | "perdu" | "rembourse" | "en_attente") {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_selection_result", { p_selection_id: selectionId, p_result: result });
  if (error) return { ok: false as const, error: humanize(error.message) };
  revalidatePath("/"); revalidatePath("/paris", "layout"); revalidatePath("/sources", "layout");
  return { ok: true as const };
}

export async function setSelectionOrigin(selectionId: string, sourceId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_selection_origin", { p_selection_id: selectionId, p_source_id: sourceId });
  if (error) return { ok: false as const, error: humanize(error.message) };
  revalidatePath("/paris", "layout"); revalidatePath("/"); revalidatePath("/sources", "layout");
  return { ok: true as const };
}

export async function updateSelection(input: { selectionId: string; cote?: number; matchId?: string | null; matchLibre?: string | null; clearMatch?: boolean; marketCode?: string; marketParam?: number | null; selection?: string }) {
  if (input.marketCode !== undefined && input.selection !== undefined && !String(input.selection ?? "").trim()) return { ok: false as const, error: "Choisis la sélection avant d’enregistrer." };
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
  revalidatePath("/paris", "layout"); revalidatePath("/");
  return { ok: true as const };
}

export async function updateBet(input: { betId: string; mise?: number; bookmaker?: string; placedAt?: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_bet", { p_bet_id: input.betId, p_mise: input.mise ?? null, p_bookmaker: input.bookmaker ?? null, p_placed_at: input.placedAt ?? null });
  if (error) return { ok: false as const, error: humanize(error.message) };
  revalidatePath("/paris", "layout"); revalidatePath("/");
  return { ok: true as const };
}

const montantDe = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));

/** Dépôt ou retrait sur un compte de bookmaker précis. */
export async function bankrollMoveBk(formData: FormData) {
  const type = String(formData.get("type")) === "retrait" ? "retrait" : "depot";
  const montant = montantDe(formData.get("montant")), bookmaker = String(formData.get("bookmaker") ?? "").trim();
  if (!Number.isFinite(montant) || montant <= 0 || !bookmaker) redirect("/bankroll?v=comptes&err=saisie");
  const supabase = await createClient();
  const { error } = await supabase.rpc("bankroll_move_bk", { p_type: type, p_montant: montant, p_bookmaker: bookmaker });
  revalidatePath("/"); revalidatePath("/bankroll");
  redirect(error ? "/bankroll?v=comptes&err=serveur" : "/bankroll?v=comptes&ok=mouvement");
}

/** Recale un compte sur le solde réel du bookmaker : l'écart est inscrit au journal. */
export async function bankrollAlignBk(formData: FormData) {
  const solde = montantDe(formData.get("solde")), bookmaker = String(formData.get("bookmaker") ?? "").trim();
  if (!Number.isFinite(solde) || solde < 0 || !bookmaker) redirect("/bankroll?v=comptes&err=saisie");
  const supabase = await createClient();
  const { error } = await supabase.rpc("bankroll_align_bk", { p_bookmaker: bookmaker, p_solde: solde });
  revalidatePath("/"); revalidatePath("/bankroll");
  redirect(error ? "/bankroll?v=comptes&err=serveur" : "/bankroll?v=comptes&ok=recalage");
}

/** Cashout : le montant encaissé chez le bookmaker règle le pari, quels que soient les matchs encore en cours. */
export async function cashoutBet(betId: string, montant: number) {
  if (!Number.isFinite(montant) || montant <= 0) return { ok: false as const, error: "Indique le montant encaissé." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cashout_bet", { p_bet_id: betId, p_montant: montant });
  if (error) return { ok: false as const, error: humanize(error.message) };
  revalidatePath("/paris", "layout"); revalidatePath("/"); revalidatePath("/bankroll");
  return { ok: true as const };
}

// ── Modifier et supprimer ses saisies (25/11, 0059) ─────────────────────────────────────────────
type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const appel = async (fn: string, args: Record<string, unknown>) => {
  const supabase = await createClient();
  const { data, error } = await (supabase.rpc as unknown as Rpc)(fn, args);
  return { data, error: error ? humanize(error.message) : null };
};
const rafraichir = () => { revalidatePath("/"); revalidatePath("/paris", "layout"); revalidatePath("/bankroll"); revalidatePath("/montantes", "layout"); revalidatePath("/sources", "layout"); };

/** Supprimer un pari, à tout moment ; ses mouvements de bankroll partent avec lui. */
export async function deleteBet(betId: string) {
  const { error } = await appel("delete_bet", { p_bet_id: betId });
  if (error) return { ok: false as const, error };
  rafraichir();
  return { ok: true as const };
}

/** Rouvrir un pari réglé pour le corriger : gains annulés, mise gardée, il sera réglé de nouveau. */
export async function reopenBet(betId: string) {
  const { error } = await appel("reopen_bet", { p_bet_id: betId });
  if (error) return { ok: false as const, error };
  rafraichir();
  return { ok: true as const };
}

/** Retirer une ligne d'un combiné en cours ; la cote totale est recalculée. */
export async function removeSelection(selectionId: string) {
  const { error } = await appel("remove_bet_selection", { p_selection_id: selectionId });
  if (error) return { ok: false as const, error };
  rafraichir();
  return { ok: true as const };
}

/** Modifier ou supprimer un dépôt ou un retrait saisi à la main. */
export async function updateBankrollTx(id: string, montant: number, note: string) {
  const { error } = await appel("update_bankroll_tx", { p_id: id, p_montant: montant, p_note: note });
  if (error) return { ok: false as const, error };
  rafraichir();
  return { ok: true as const };
}
export async function deleteBankrollTx(id: string) {
  const { error } = await appel("delete_bankroll_tx", { p_id: id });
  if (error) return { ok: false as const, error };
  rafraichir();
  return { ok: true as const };
}
