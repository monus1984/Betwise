import Link from "next/link";
import { CoachNav } from "@/components/coach-nav";
import { PageHeader } from "@/components/page-header";
import { loadGoal } from "@/lib/coach/goal";
import { misesDuJour } from "@/lib/coach/plan";
import { COACH_SUGGESTIONS } from "@/lib/coach/prompt";
import { loadToday } from "@/lib/coach/today";
import { createClient } from "@/lib/supabase/server";
import { CoachChat, type ChatMsg } from "./chat";
import { CoupsDuJour } from "./coups-du-jour";
import { ObjectifCard } from "./objectif-card";

export const dynamic = "force-dynamic";

/** Section Coach : objectif, coups du jour, options, tests et discussion, au même endroit. */
export default async function CoachPage({ searchParams }: { searchParams: Promise<{ nouvelle?: string; v?: string }> }) {
  const sp = await searchParams;
  const db = await createClient();

  if (sp.v === "discussion" || sp.nouvelle) {
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
        <CoachNav current="discussion" />
        <CoachChat key={conversationId ?? "nouvelle"} initialId={conversationId} initial={messages} suggestions={COACH_SUGGESTIONS} />
      </>
    );
  }

  const { data: { user } } = await db.auth.getUser();
  const [{ data: summary }, { data: tests }] = await Promise.all([
    db.from("my_bankroll_summary").select("solde").maybeSingle(),
    db.from("bets").select("statut, mise, gain_net").eq("virtuel", true).neq("statut", "annule").limit(2000),
  ]);
  const solde = Number(summary?.solde ?? 0);
  const [goal, today] = await Promise.all([loadGoal(db, solde), loadToday(db, user!.id)]);
  const mises = goal ? goal.mises : solde > 0 ? misesDuJour(solde, solde) : null;
  const tRegles = (tests ?? []).filter((t) => t.statut !== "en_cours");
  const tMises = tRegles.reduce((x, t) => x + Number(t.mise), 0), tNet = tRegles.reduce((x, t) => x + Number(t.gain_net ?? 0), 0);

  return (
    <>
      <PageHeader title="Coach" subtitle="Ton objectif, les coups du jour, les options à ton taux de réussite et tes tests." />
      <CoachNav current="jour" />

      <ObjectifCard goal={goal} solde={solde} />
      <CoupsDuJour picks={today.picks} theirs={today.theirs} mises={mises} />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Link href="/options" className="rounded-xl border border-line bg-white p-3 shadow-card active:bg-surface-2">
          <p className="text-sm font-semibold">🎯 Options du jour</p>
          <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">Ton % de réussite, en simple ou en combiné à la cote voulue.</p>
        </Link>
        <Link href="/paris?vue=tests" className="rounded-xl border border-line bg-white p-3 shadow-card active:bg-surface-2">
          <p className="text-sm font-semibold">🧪 Mes tests</p>
          <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">
            {!tests?.length ? "Teste tes choix et ceux de tes tipsters, sans miser."
              : !tRegles.length ? `${tests.length} en attente de résultat.`
              : <>{tRegles.length} réglé{tRegles.length > 1 ? "s" : ""} · {Math.round((100 * tRegles.filter((t) => t.statut === "gagne").length) / tRegles.length)} % gagnés · <span className={tNet >= 0 ? "text-gain" : "text-loss"}>{tNet >= 0 ? "+" : ""}{tMises ? Math.round((100 * tNet) / tMises) : 0} %</span></>}
          </p>
        </Link>
      </div>

      <section className="mt-3 rounded-xl border border-line bg-white p-4 shadow-card">
        <h2 className="mb-2 text-sm font-semibold">💬 Poser une question au Coach</h2>
        <ul className="space-y-1.5">
          {COACH_SUGGESTIONS.slice(0, 4).map((s) => <li key={s}><Link href="/coach?v=discussion" className="block rounded-lg border border-line px-3 py-2 text-[13px] text-ink-soft active:bg-surface-2">{s}</Link></li>)}
        </ul>
        <Link href="/coach?v=discussion" className="mt-3 block rounded-xl bg-brand py-2.5 text-center text-sm font-semibold text-white">Ouvrir la discussion</Link>
      </section>
    </>
  );
}
