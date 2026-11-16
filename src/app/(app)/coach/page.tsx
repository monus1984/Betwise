import Link from "next/link";
import { CoachNav } from "@/components/coach-nav";
import { IconFlask, IconTarget, IconTile } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { etatBudget } from "@/lib/coach/budget";
import { cartesDe, type Carte } from "@/lib/coach/cartes";
import { Notice } from "@/components/ui";
import { misesDuJour } from "@/lib/coach/plan";
import { COACH_SUGGESTIONS } from "@/lib/coach/prompt";
import { loadToday } from "@/lib/coach/today";
import { createClient } from "@/lib/supabase/server";
import { CoachChat, type ChatMsg } from "./chat";
import { CoupsDuJour } from "./coups-du-jour";
import { BudgetCard } from "./budget-card";

export const dynamic = "force-dynamic";

/** Coach : la discussion d'abord. Le budget, les sélections du jour et les tests sont dans « Outils ». */
export default async function CoachPage({ searchParams }: { searchParams: Promise<{ nouvelle?: string; v?: string; q?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const db = await createClient();

  if (sp.v !== "outils") {
    let conversationId: string | null = null;
    let messages: ChatMsg[] = [];
    if (!sp.nouvelle) {
      const { data: c } = await db.from("conversations").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (c) {
        conversationId = c.id;
        const { data: ms } = await db.from("messages").select("id, role, contenu, fonctions").eq("conversation_id", c.id).in("role", ["user", "assistant"]).order("created_at").limit(60);
        messages = (ms ?? []).map((m) => {
          const appels = Array.isArray(m.fonctions) ? (m.fonctions as { nom?: string; sortie?: unknown }[]) : [];
          return { id: m.id, role: m.role as "user" | "assistant", text: m.contenu ?? "", fonctions: appels.map((f) => f.nom ?? "").filter(Boolean), cartes: cartesDe(appels) as Carte[] };
        });
      }
    }
    return (
      <>
        <PageHeader title="Coach" subtitle="Il lit tes paris, tes sources et ta bankroll, puis explique les chiffres. Il n’en invente aucun." />
        <CoachNav current="discussion" />
        <CoachChat key={conversationId ?? "nouvelle"} initialId={conversationId} initial={messages} suggestions={COACH_SUGGESTIONS} initialText={(sp.q ?? "").slice(0, 300)} />
      </>
    );
  }

  const { data: { user } } = await db.auth.getUser();
  const [{ data: summary }, { data: tests }, { data: bud }, { data: recents }] = await Promise.all([
    db.from("my_bankroll_summary").select("solde, exposition").maybeSingle(),
    db.from("bets").select("statut, mise, gain_net").eq("virtuel", true).neq("statut", "annule").limit(2000),
    db.from("budgets").select("mise_semaine, perte_max_semaine").maybeSingle(),
    db.from("bets").select("mise, statut, gain_net, placed_at, settled_at").eq("virtuel", false).gte("placed_at", new Date(Date.now() - 9 * 86400000).toISOString()).limit(300),
  ]);
  const solde = Number(summary?.solde ?? 0), capital = solde + Number(summary?.exposition ?? 0);
  const budget = bud ? { miseSemaine: Number(bud.mise_semaine), perteMaxSemaine: Number(bud.perte_max_semaine) } : null;
  const etat = budget ? etatBudget(budget, (recents ?? []).map((b) => ({ ...b, mise: Number(b.mise), gain_net: b.gain_net === null ? null : Number(b.gain_net) }))) : null;
  const today = await loadToday(db, user!.id);
  const mises = solde > 0 ? misesDuJour(solde, solde) : null;
  const tRegles = (tests ?? []).filter((t) => t.statut !== "en_cours");
  const tMises = tRegles.reduce((x, t) => x + Number(t.mise), 0), tNet = tRegles.reduce((x, t) => x + Number(t.gain_net ?? 0), 0);

  return (
    <>
      <PageHeader title="Coach" subtitle="Ton budget de la semaine, tes tests, et les sélections du jour si tu les demandes." />
      <CoachNav current="outils" />
      {sp.ok === "budget" && <div className="mb-3"><Notice kind="info">Budget enregistré.</Notice></div>}
      {sp.err && <div className="mb-3"><Notice>{sp.err === "budget" ? "Indique deux montants ; la perte maximale ne peut pas dépasser le budget de mise." : "Enregistrement impossible. Réessaie."}</Notice></div>}

      <BudgetCard budget={budget} etat={etat} soldeTotal={capital} />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Link href="/paris?vue=tests" className="rounded-2xl border border-line bg-surface p-3 active:bg-surface-2">
          <IconTile size="sm" tone="test"><IconFlask width={18} height={18} /></IconTile>
          <p className="mt-2 text-sm font-semibold">Mes tests</p>
          <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">
            {!tests?.length ? "Teste tes choix et ceux de tes sources, sans miser."
              : !tRegles.length ? `${tests.length} en attente de résultat.`
              : <>{tRegles.length} réglé{tRegles.length > 1 ? "s" : ""} · {Math.round((100 * tRegles.filter((t) => t.statut === "gagne").length) / tRegles.length)} % gagnés · <span className={tNet >= 0 ? "text-gain" : "text-loss"}>{tNet >= 0 ? "+" : ""}{tMises ? Math.round((100 * tNet) / tMises) : 0} %</span></>}
          </p>
        </Link>
        <Link href="/options" className="rounded-2xl border border-line bg-surface p-3 active:bg-surface-2">
          <IconTile size="sm" tone="neutre"><IconTarget width={18} height={18} /></IconTile>
          <p className="mt-2 text-sm font-semibold">Chercher par probabilité</p>
          <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">Les marchés du jour dans la fourchette de chances que tu choisis.</p>
        </Link>
      </div>

      {/* En retrait : les sélections du jour ne s'affichent que si on les ouvre, et jamais quand le budget est atteint */}
      {etat?.statut === "atteint" ? (
        <p className="mt-3 rounded-xl border border-line bg-surface p-3 text-[13px] text-ink-muted">Les sélections du jour sont masquées : ton budget de la semaine est atteint.</p>
      ) : (
        <details className="mt-3 rounded-xl border border-line bg-surface p-3">
          <summary className="cursor-pointer text-sm font-semibold">Sélections du jour <span className="font-normal text-ink-muted">· {today.picks.length ? `${today.picks.length} sur des marchés à cote de référence` : "rien de solide aujourd’hui"}</span></summary>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">Ce sont des probabilités tirées des cotes, pas des conseils. Une sélection « Très probable » perd environ 12 fois sur 100.</p>
          <CoupsDuJour picks={today.picks} theirs={today.theirs} mises={mises} />
        </details>
      )}
    </>
  );
}
