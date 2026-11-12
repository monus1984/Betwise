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
  const files = form.getAll("image").filter((f): f is File => f instanceof File && f.size > 0);
  const file = files[0] ?? null;
  const text = String(form.get("text") ?? "").trim();
  const link = String(form.get("link") ?? "").trim();

  // Lien 1xBet seul : on renvoie une référence, pas d'appel LLM
  const coupon = parseCouponLink(link || text);
  if (!file && !text && coupon) {
    return NextResponse.json({ coupon_only: true, coupon, message: "Lien reconnu. Ajoute une capture ou le texte du coupon pour lire les sélections." });
  }
  if (!file && !text) return NextResponse.json({ error: "Aucune capture ni texte" }, { status: 400 });

  let images, storagePath: string | null = null, truncated = false;
  if (file) {
    if (files.length > 8) return NextResponse.json({ error: "8 captures maximum pour un même ticket" }, { status: 400 });
    const total = files.reduce((a, f) => a + f.size, 0);
    if (total > MAX_BYTES * 2) return NextResponse.json({ error: "Images trop lourdes (16 Mo max au total)" }, { status: 413 });
    images = [];
    for (const f of files) {
      const prep = await prepareTicketImage(Buffer.from(await f.arrayBuffer()));
      images.push(...prep.images);
      truncated = truncated || prep.truncated;
    }
    if (images.length > 10) { images = images.slice(0, 10); truncated = true; }

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
