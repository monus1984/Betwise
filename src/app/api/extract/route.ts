import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prepareTicketImage } from "@/lib/extract/image";
import { extractTickets, parseCouponLink } from "@/lib/extract/ticket";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * POST multipart : `image` (fichier) ou `text` (ticket partagé en texte), optionnel `link`.
 * Réponse : ticket extrait + rapprochements + contrôles, et l'id de l'upload journalisé.
 */
const IMPORTS_PAR_JOUR = 40;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  // Limite quotidienne pendant le test : chaque lecture de capture ou de vidéo a un coût
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const { count: lus } = await supabase.from("uploads").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", startOfDay.toISOString());
  if ((lus ?? 0) >= IMPORTS_PAR_JOUR) return NextResponse.json({ error: `Limite de ${IMPORTS_PAR_JOUR} tickets lus par jour atteinte pendant le test. Reprise demain ; la saisie à la main reste possible.` }, { status: 429 });

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
    if (files.length > 12) return NextResponse.json({ error: "12 captures maximum par envoi" }, { status: 400 });
    const total = files.reduce((a, f) => a + f.size, 0);
    if (total > MAX_BYTES * 2) return NextResponse.json({ error: "Images trop lourdes (16 Mo max au total)" }, { status: 413 });
    images = [];
    for (const f of files) {
      const prep = await prepareTicketImage(Buffer.from(await f.arrayBuffer()));
      images.push(...prep.images);
      truncated = truncated || prep.truncated;
    }
    if (images.length > 16) { images = images.slice(0, 16); truncated = true; } // 8 écrans de téléphone récent = 16 morceaux

    // Conservation de la première tuile seulement (pas l'original : il peut contenir le solde du compte)
    storagePath = `${user.id}/${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage.from("betwise-uploads").upload(storagePath, Buffer.from(images[0].base64, "base64"), { contentType: "image/jpeg", upsert: false });
    if (upErr) storagePath = null;
  }

  try {
    const tickets = await extractTickets(supabase, { images, text: text || undefined });
    if (coupon && tickets.length === 1) {
      if (!tickets[0].raw.coupon_code) tickets[0].raw.coupon_code = coupon.code;
      if (!tickets[0].raw.bookmaker) tickets[0].raw.bookmaker = coupon.bookmaker;
    }

    // Une ligne d'upload par ticket lu (même image source), pour tracer chaque import
    const out = [];
    for (const t of tickets) {
      const { data: up } = await supabase
        .from("uploads")
        .insert({ user_id: user.id, storage_path: storagePath ?? "(texte)", kind: "ticket", json_extrait: JSON.parse(JSON.stringify(t.raw)), confiance: { selections: t.selections.map((s) => s.confidence), checks: t.checks, usage: t.usage, tickets_dans_l_envoi: tickets.length } })
        .select("id")
        .single();
      out.push({ ...t, upload_id: up?.id ?? null, truncated });
    }
    return NextResponse.json({ tickets: out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "Extraction indisponible : clé API non configurée." : "Lecture impossible : " + msg }, { status });
  }
}
