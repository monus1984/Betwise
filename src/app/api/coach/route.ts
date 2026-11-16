import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { getLlm, type ChatTurn } from "@/lib/llm/provider";
import { COACH_TOOLS, runCoachTool } from "@/lib/coach/tools";
import { COACH_SYSTEM } from "@/lib/coach/prompt";
import { etatBudget } from "@/lib/coach/budget";
import { FONCTIONS_DE_PARI, gardeFou } from "@/lib/coach/garde-fou";
import { cartesDe } from "@/lib/coach/cartes";

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

  // Garde-fou : série de pertes, budget de la semaine atteint, ou demande de « se refaire ». Décidé ici, en code :
  // les fonctions qui composent des paris sont retirées pour ce tour, le modèle ne peut donc pas les appeler.
  const [{ data: recents }, { data: bud }] = await Promise.all([
    db.from("bets").select("mise, statut, gain_net, placed_at, settled_at").eq("virtuel", false).neq("statut", "annule").order("placed_at", { ascending: false }).limit(60),
    db.from("budgets").select("mise_semaine, perte_max_semaine").maybeSingle(),
  ]);
  const paris = (recents ?? []).map((b) => ({ ...b, mise: Number(b.mise), gain_net: b.gain_net === null ? null : Number(b.gain_net) }));
  let serie = 0;
  for (const b of paris.filter((x) => (x.statut === "gagne" || x.statut === "perdu") && x.settled_at).sort((x, y) => Date.parse(y.settled_at!) - Date.parse(x.settled_at!))) { if (b.statut === "perdu") serie++; else break; }
  const garde = gardeFou(message, { serie, budget: bud ? etatBudget({ miseSemaine: Number(bud.mise_semaine), perteMaxSemaine: Number(bud.perte_max_semaine) }, paris) : null });
  const tools = garde.bloque ? COACH_TOOLS.filter((t) => !FONCTIONS_DE_PARI.includes(t.name)) : COACH_TOOLS;
  const system = garde.bloque ? `${COACH_SYSTEM}\n\n${garde.consigne}` : COACH_SYSTEM;

  try {
    const r = await getLlm().chat({ system, history, tools, run: (name, input) => (garde.bloque && FONCTIONS_DE_PARI.includes(name) ? Promise.resolve({ refuse: true, raison: garde.raisons.join(" ") }) : runCoachTool(db, name, input)), maxTokens: 2000 });
    const fonctions = r.trace.map((t) => ({ nom: t.name, entree: t.input, sortie: t.output, ms: t.ms }));
    const cartes = cartesDe(fonctions);
    const { data: saved } = await db.from("messages").insert({
      conversation_id: conversationId, role: "assistant", contenu: r.text, fonctions: fonctions as unknown as Json, tokens_in: r.tokensIn, tokens_out: r.tokensOut,
    }).select("id, created_at").single();
    return NextResponse.json({ conversationId, reply: { id: saved?.id, text: r.text, fonctions: fonctions.map((f) => f.nom), cartes, garde: garde.bloque }, restant: DAILY_LIMIT - (count ?? 0) - 1 });
  } catch (e) {
    console.error("coach", e);
    const msg = e instanceof Error && /ANTHROPIC_API_KEY/.test(e.message) ? "Le coach n’est pas configuré (clé API absente)." : "Le coach n’a pas pu répondre. Réessaie dans un instant.";
    return NextResponse.json({ error: msg, conversationId }, { status: 502 });
  }
}
