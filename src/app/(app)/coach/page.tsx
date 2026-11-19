import Link from "next/link";
import { CoachNav } from "@/components/coach-nav";
import { IconFlask, IconTarget, IconTile } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { etatBudget } from "@/lib/coach/budget";
import { cartesDe, type Carte } from "@/lib/coach/cartes";
import { Notice } from "@/components/ui";
import { misesDuJour } from "@/lib/coach/plan";
import { COACH_SUGGESTIONS } from "@/lib/coach/prompt";
import { loadForces, loadRepli, loadToday } from "@/lib/coach/today";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { TableauDeBord } from "./tableau-de-bord";
import { CoachChat, type ChatMsg } from "./chat";
import { CoupsDuJour } from "./coups-du-jour";
import { BudgetCard } from "./budget-card";

export const dynamic = "force-dynamic";

/**
 * Coach (19/11) : le tableau de bord de l'abonné d'abord ; la bankroll et les outils en onglets ;
 * la conversation s'ouvre par Betster flottant (?v=discussion).
 */
export default async function CoachPage({ searchParams }: { searchParams: Promise<{ nouvelle?: string; suite?: string; v?: string; q?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const db = await createClient();

  if (sp.v === "discussion") {
    let conversationId: string | null = null;
    let messages: ChatMsg[] = [];
    // Toujours une nouvelle conversation à l'ouverture (demande de Mounir, 19/11) ; la précédente se reprend par ?suite=1
    if (sp.suite && !sp.nouvelle) {
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
        <PageHeader title="Betster" subtitle="Il lit tes paris, tes sources et ta bankroll, puis explique les chiffres. Il n’en invente aucun." action={<Link href="/coach">Tableau de bord</Link>} />
        <CoachChat key={conversationId ?? `nouvelle-${sp.nouvelle ?? ""}`} initialId={conversationId} initial={messages} suggestions={COACH_SUGGESTIONS} initialText={(sp.q ?? "").slice(0, 300)} />
      </>
    );
  }

  const { data: { user } } = await db.auth.getUser();
  if (sp.v !== "outils") return <TableauDeBord db={db} userId={user!.id} />;
  const [{ data: summary }, { data: tests }, { data: bud }, { data: recents }] = await Promise.all([
    db.from("my_bankroll_summary").select("solde, exposition").maybeSingle(),
    db.from("bets").select("statut, mise, gain_net").eq("virtuel", true).neq("statut", "annule").limit(2000),
    db.from("budgets").select("mise_semaine, perte_max_semaine").maybeSingle(),
    db.from("bets").select("mise, statut, gain_net, placed_at, settled_at").eq("virtuel", false).gte("placed_at", new Date(Date.now() - 9 * 86400000).toISOString()).limit(300),
  ]);
  const solde = Number(summary?.solde ?? 0), capital = solde + Number(summary?.exposition ?? 0);
  const budget = bud ? { miseSemaine: Number(bud.mise_semaine), perteMaxSemaine: Number(bud.perte_max_semaine) } : null;
  const etat = budget ? etatBudget(budget, (recents ?? []).map((b) => ({ ...b, mise: Number(b.mise), gain_net: b.gain_net === null ? null : Number(b.gain_net) }))) : null;
  const [today, repli, fortes] = await Promise.all([loadToday(db, user!.id), loadRepli(db), loadForces(db, user!.id)]);
  const mises = solde > 0 ? misesDuJour(solde, solde) : null;
  const tRegles = (tests ?? []).filter((t) => t.statut !== "en_cours");
  const tMises = tRegles.reduce((x, t) => x + Number(t.mise), 0), tNet = tRegles.reduce((x, t) => x + Number(t.gain_net ?? 0), 0);

  return (
    <>
      <PageHeader title="Coach" subtitle="Les sélections du jour avec leur risque, tes points forts et ceux de tes sources." />
      <CoachNav current="outils" />
      {sp.ok === "budget" && <div className="mb-3"><Notice kind="info">Budget enregistré.</Notice></div>}
      {sp.err && <div className="mb-3"><Notice>{sp.err === "budget" ? "Indique deux montants ; la perte maximale ne peut pas dépasser le budget de mise." : "Enregistrement impossible. Réessaie."}</Notice></div>}

      {/* Toujours quelque chose à proposer : les sélections du jour avec leur risque, puis les points forts */}
      <CoupsDuJour picks={today.picks} theirs={today.theirs} mises={mises} repli={repli} />

      {(fortes.moi.length > 0 || fortes.sources.length > 0) && (
        <Card className="mt-3">
          <h2 className="text-sm font-semibold">Là où ça passe le mieux</h2>
          {fortes.moi.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-medium text-ink-muted">Tes propres choix</p>
              <ul className="mt-1 space-y-1">{fortes.moi.map((f) => <Force key={f.cle} libelle={f.libelle} g={f.gagnes} n={f.regles} taux={f.taux} />)}</ul>
            </div>
          )}
          {fortes.sources.slice(0, 4).map((x) => (
            <div key={x.id} className="mt-3">
              <Link href={`/sources/${x.id}`} className="text-[11px] font-medium text-brand">{x.nom} ›</Link>
              <ul className="mt-1 space-y-1">{x.forces.map((f) => <Force key={f.cle} libelle={f.libelle} g={f.gagnes} n={f.regles} taux={f.taux} />)}</ul>
            </div>
          ))}
          <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">Calculé sur les paris et pronos réglés, à partir de 3 résultats. Plus tu charges de coupons de tes sources, plus ces chiffres deviennent parlants.</p>
        </Card>
      )}

      <div className="mt-3"><BudgetCard budget={budget} etat={etat} soldeTotal={capital} /></div>

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
    </>
  );
}

function Force({ libelle, g, n, taux }: { libelle: string; g: number; n: number; taux: number }) {
  return (
    <li className="flex items-center gap-3 text-[13px]">
      <span className="min-w-0 flex-1 truncate">{libelle}</span>
      <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-2"><span className="block h-1.5 rounded-full bg-gain" style={{ width: `${Math.round(taux * 100)}%` }} /></span>
      <span className="w-16 shrink-0 text-right font-semibold tabular-nums">{g} sur {n}</span>
    </li>
  );
}
