import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { getLlm, type ChatTurn } from "@/lib/llm/provider";
import { COACH_TOOLS, runCoachTool } from "@/lib/coach/tools";
import { COACH_SYSTEM } from "@/lib/coach/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const DAILY_LIMIT = 30;     // messages par utilisateur et par jour : protège le crédit API du test
const HISTORY_TURNS = 12;   // contexte envoyé au modèle (texte seul, sans les retours de fonctions)

export async function POST(req: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { message?: string; conversationId?: string | null } | null;
  const message = body?.message?.trim().slice(0, 1500);
  if (!message) return NextResponse.json({ error: "Message vide." }, { status: 400 });

  // Quota quotidien
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await db.from("messages").select("id, conversations!inner(user_id)", { count: "exact", head: true })
    .eq("role", "user").eq("conversations.user_id", user.id).gte("created_at", startOfDay.toISOString());
  if ((count ?? 0) >= DAILY_LIMIT) return NextResponse.json({ error: `Limite de ${DAILY_LIMIT} questions par jour atteinte pendant le test. Reprise demain.` }, { status: 429 });

  // Conversation
  let conversationId = body?.conversationId ?? null;
  if (conversationId) {
    const { data: c } = await db.from("conversations").select("id").eq("id", conversationId).maybeSingle();
    if (!c) conversationId = null;
  }
  if (!conversationId) {
    const { data: c, error } = await db.from("conversations").insert({ user_id: user.id, titre: message.slice(0, 80) }).select("id").single();
    if (error) return NextResponse.json({ error: "Impossible de créer la conversation." }, { status: 500 });
    conversationId = c.id;
  }
  const { data: past } = await db.from("messages").select("role, contenu").eq("conversation_id", conversationId).in("role", ["user", "assistant"]).order("created_at", { ascending: false }).limit(HISTORY_TURNS);
  const history: ChatTurn[] = (past ?? []).reverse().filter((m) => m.contenu).map((m) => ({ role: m.role as "user" | "assistant", text: m.contenu! }));
  // l'historique doit commencer par l'utilisateur
  while (history.length && history[0].role !== "user") history.shift();
  history.push({ role: "user", text: message });

  await db.from("messages").insert({ conversation_id: conversationId, role: "user", contenu: message });

  try {
    const r = await getLlm().chat({ system: COACH_SYSTEM, history, tools: COACH_TOOLS, run: (name, input) => runCoachTool(db, name, input) });
    const fonctions = r.trace.map((t) => ({ nom: t.name, entree: t.input, sortie: t.output, ms: t.ms }));
    const { data: saved } = await db.from("messages").insert({
      conversation_id: conversationId, role: "assistant", contenu: r.text, fonctions: fonctions as unknown as Json, tokens_in: r.tokensIn, tokens_out: r.tokensOut,
    }).select("id, created_at").single();
    return NextResponse.json({ conversationId, reply: { id: saved?.id, text: r.text, fonctions: fonctions.map((f) => f.nom) }, restant: DAILY_LIMIT - (count ?? 0) - 1 });
  } catch (e) {
    console.error("coach", e);
    const msg = e instanceof Error && /ANTHROPIC_API_KEY/.test(e.message) ? "Le coach n’est pas configuré (clé API absente)." : "Le coach n’a pas pu répondre. Réessaie dans un instant.";
    return NextResponse.json({ error: msg, conversationId }, { status: 502 });
  }
}
