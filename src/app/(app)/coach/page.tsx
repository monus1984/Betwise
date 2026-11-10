import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { COACH_SUGGESTIONS } from "@/lib/coach/prompt";
import { CoachChat, type ChatMsg } from "./chat";

export const dynamic = "force-dynamic";

export default async function CoachPage({ searchParams }: { searchParams: Promise<{ nouvelle?: string }> }) {
  const sp = await searchParams;
  const db = await createClient();
  let conversationId: string | null = null;
  let messages: ChatMsg[] = [];
  if (!sp.nouvelle) {
    const { data: c } = await db.from("conversations").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (c) {
      conversationId = c.id;
      const { data: ms } = await db.from("messages").select("id, role, contenu, fonctions").eq("conversation_id", c.id).in("role", ["user", "assistant"]).order("created_at").limit(60);
      messages = (ms ?? []).map((m) => ({
        id: m.id, role: m.role as "user" | "assistant", text: m.contenu ?? "",
        fonctions: Array.isArray(m.fonctions) ? (m.fonctions as { nom?: string }[]).map((f) => f.nom ?? "").filter(Boolean) : [],
      }));
    }
  }
  return (
    <>
      <PageHeader title="Coach" subtitle="Il lit tes paris, tes sources et ta bankroll, puis explique les chiffres. Il n’en invente aucun." />
      <CoachChat key={conversationId ?? "nouvelle"} initialId={conversationId} initial={messages} suggestions={COACH_SUGGESTIONS} />
    </>
  );
}
