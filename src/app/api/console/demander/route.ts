import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { MODELES, PROJETS, PRIX_SONNET, SYSTEME_CONSOLE, contenuOpenAI, type PieceJointe } from "@/lib/console/modeles";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Console IA : pose une question à un modèle (un appel par modèle, pour afficher chaque réponse dès qu'elle arrive).
 * Réservé à l'administrateur ; les clés restent sur le serveur. Mode « synthese » : Claude résume les réponses reçues.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: admin } = await supabase.rpc("is_admin");
  if (!admin) return NextResponse.json({ error: "réservé à l'administrateur" }, { status: 403 });
  const b = await req.json().catch(() => null) as { modele?: string; question?: string; projet?: string; pieces?: PieceJointe[]; synthese?: { nom: string; texte: string }[] } | null;
  if (!b?.question?.trim() && !b?.pieces?.length) return NextResponse.json({ error: "question vide" }, { status: 400 });
  const question = (b.question ?? "").slice(0, 20_000), pieces = (b.pieces ?? []).slice(0, 6);
  const contexte = PROJETS[b.projet ?? "autre"]?.contexte ?? "";
  const t0 = Date.now();

  // Synthèse : Claude compare les avis
  if (b.synthese) {
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "clé Anthropic absente" }, { status: 503 });
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await client.messages.create({ model: "claude-sonnet-5-5", max_tokens: 1500, messages: [{ role: "user", content:
      `${contexte}\n\nQuestion de Mounir : ${question}\n\nRéponses de plusieurs IA :\n\n${b.synthese.map((s) => `### ${s.nom}\n${s.texte}`).join("\n\n")}\n\nFais la synthèse pour Mounir, en français simple, 12 lignes au plus : sur quoi elles sont d'accord, où elles divergent, ce qui te semble faux, et ce que tu conseilles de retenir. Ne répète pas les réponses.` }] });
    return NextResponse.json({ texte: r.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map((c) => c.text).join("\n"),
      cout: r.usage.input_tokens * PRIX_SONNET.entree + r.usage.output_tokens * PRIX_SONNET.sortie, modele: r.model, ms: Date.now() - t0 });
  }

  const m = MODELES.find((x) => x.id === b.modele);
  if (!m) return NextResponse.json({ error: "modèle inconnu" }, { status: 400 });
  try {
    if (m.fournisseur === "anthropic") {
      if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "clé Anthropic absente" }, { status: 503 });
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const textes = pieces.filter((p) => p.type === "texte").map((p) => `--- Fichier ${p.nom} ---\n${(p as { contenu: string }).contenu}`);
      const images = pieces.filter((p) => p.type === "image").map((p) => { const [, mt, data] = (p as { dataUrl: string }).dataUrl.match(/^data:(image\/\w+);base64,(.*)$/) ?? []; return mt ? { type: "image" as const, source: { type: "base64" as const, media_type: mt as "image/png", data } } : null; }).filter(Boolean);
      const r = await client.messages.create({ model: m.id.replace("anthropic:", ""), max_tokens: 4000, system: SYSTEME_CONSOLE,
        messages: [{ role: "user", content: [...images as Anthropic.ImageBlockParam[], { type: "text", text: [contexte, question, ...textes].filter(Boolean).join("\n\n") }] }] });
      return NextResponse.json({ texte: r.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map((c) => c.text).join("\n"),
        cout: r.usage.input_tokens * PRIX_SONNET.entree + r.usage.output_tokens * PRIX_SONNET.sortie, modele: r.model, ms: Date.now() - t0 });
    }
    if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ error: "clé OpenRouter absente sur le serveur" }, { status: 503 });
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", signal: AbortSignal.timeout(110_000),
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "Console IA de Mounir" },
      body: JSON.stringify({ model: m.id, max_tokens: 8000, messages: [{ role: "system", content: SYSTEME_CONSOLE }, { role: "user", content: contenuOpenAI(question, contexte, pieces) }] }) });
    const j = await r.json() as { model?: string; usage?: { cost?: number }; error?: { message?: string }; choices?: { message?: { content?: string | null }; finish_reason?: string }[] };
    const texte = j.choices?.[0]?.message?.content?.trim();
    if (!r.ok || !texte) return NextResponse.json({ error: j.error?.message ?? `pas de réponse (${j.choices?.[0]?.finish_reason ?? r.status})`, cout: j.usage?.cost ?? null }, { status: 502 });
    return NextResponse.json({ texte, cout: j.usage?.cost ?? null, modele: j.model ?? m.id, ms: Date.now() - t0 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
