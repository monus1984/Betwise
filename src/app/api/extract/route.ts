import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prepareTicketImage } from "@/lib/extract/image";
import { extractTicket, parseCouponLink } from "@/lib/extract/ticket";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * POST multipart : `image` (fichier) ou `text` (ticket partagé en texte), optionnel `link`.
 * Réponse : ticket extrait + rapprochements + contrôles, et l'id de l'upload journalisé.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("image");
  const text = String(form.get("text") ?? "").trim();
  const link = String(form.get("link") ?? "").trim();

  // Lien 1xBet seul : on renvoie une référence, pas d'appel LLM
  const coupon = parseCouponLink(link || text);
  if (!file && !text && coupon) {
    return NextResponse.json({ coupon_only: true, coupon, message: "Lien reconnu. Ajoute une capture ou le texte du coupon pour lire les sélections." });
  }
  if (!file && !text) return NextResponse.json({ error: "Aucune capture ni texte" }, { status: 400 });

  let images, storagePath: string | null = null, truncated = false;
  if (file && file instanceof File) {
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image trop lourde (8 Mo max)" }, { status: 413 });
    const buf = Buffer.from(await file.arrayBuffer());
    const prep = await prepareTicketImage(buf);
    images = prep.images; truncated = prep.truncated;

    // Conservation de la première tuile seulement (pas l'original : il peut contenir le solde du compte)
    storagePath = `${user.id}/${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage.from("betwise-uploads").upload(storagePath, Buffer.from(images[0].base64, "base64"), { contentType: "image/jpeg", upsert: false });
    if (upErr) storagePath = null;
  }

  try {
    const result = await extractTicket(supabase, { images, text: text || undefined });
    if (coupon && !result.raw.coupon_code) result.raw.coupon_code = coupon.code;
    if (coupon && !result.raw.bookmaker) result.raw.bookmaker = coupon.bookmaker;

    const { data: up } = await supabase
      .from("uploads")
      .insert({ user_id: user.id, storage_path: storagePath ?? "(texte)", kind: "ticket", json_extrait: JSON.parse(JSON.stringify(result.raw)), confiance: { selections: result.selections.map((s) => s.confidence), checks: result.checks, usage: result.usage } })
      .select("id")
      .single();

    return NextResponse.json({ ...result, upload_id: up?.id ?? null, truncated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "Extraction indisponible : clé API non configurée." : "Lecture impossible : " + msg }, { status });
  }
}
