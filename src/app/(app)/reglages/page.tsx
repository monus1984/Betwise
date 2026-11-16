import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { fcfa } from "@/components/ui";
import { signOut } from "@/lib/auth/actions";
import { bankrollAlign, bankrollMove } from "@/lib/bets/actions";
import { createClient } from "@/lib/supabase/server";
import { InstallButton } from "@/components/install-button";
import { NotificationsCard } from "@/components/notifications-card";

export const dynamic = "force-dynamic";

/** Tout ce qui se règle une fois de temps en temps : bankroll, comparaison avec le bookmaker, notifications, compte. */
export default async function ReglagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: summary }, { data: k }, { data: journal }, { data: np }] = await Promise.all([
    supabase.from("my_bankroll_summary").select("solde").maybeSingle(),
    supabase.from("bankrolls").select("verifie_at").eq("active", true).maybeSingle(),
    supabase.from("bankroll_transactions").select("id, type, montant, note, bet_id, at").order("at", { ascending: false }).limit(30),
    supabase.from("notification_prefs").select("resultats, direct, coup_envoi, coups_du_jour, sources").maybeSingle(),
  ]);
  const solde = Number(summary?.solde ?? 0), verifie = k?.verifie_at ?? null;

  return (
    <>
      <PageHeader title="Réglages" subtitle="Bankroll, notifications et compte." action={<Link href="/">Accueil</Link>} />

      <h2 className="text-base font-bold">Bankroll</h2>
      <details className="mt-3 rounded-xl border border-line bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold">Alimenter ou retirer la bankroll</summary>
        <form action={bankrollMove} className="mt-3 flex gap-2">
          <select name="type" className="rounded-lg border border-line bg-white px-2 py-2 text-sm">
            <option value="depot">Dépôt</option>
            <option value="retrait">Retrait</option>
          </select>
          <input name="montant" inputMode="numeric" placeholder="Montant F CFA" className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-base" required />
          <button className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">OK</button>
        </form>
        <p className="mt-2 text-xs text-ink-muted">Le solde part de 0 : enregistre ton capital de départ comme premier dépôt.</p>
      </details>

      <details id="solde" open className="mt-3 rounded-xl border border-line bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold">Comparer mon solde à celui du bookmaker</summary>
        <p className="mt-2 text-xs text-ink-muted">Solde BETWISE : <b className="text-ink">{fcfa(solde)}</b>{verifie ? <> · dernière comparaison le {new Date(verifie).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" })}</> : <> · jamais comparé</>}. Si ton bookmaker affiche autre chose, regarde d’abord le journal : un pari mal réglé ou jamais joué se corrige sur sa fiche. S’il reste un écart que tu n’expliques pas (dépôt, retrait ou pari non saisi), indique ton solde réel : BETWISE ajoute un seul mouvement d’ajustement, noté comme tel. Si les deux soldes sont égaux, saisis-le quand même : la comparaison est datée.</p>
        <form action={bankrollAlign} className="mt-3 flex gap-2">
          <input name="solde" inputMode="numeric" placeholder="Solde réel en F CFA" className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-base" required />
          <button className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">Recaler</button>
        </form>
        <h3 className="mt-4 text-xs font-semibold text-ink-muted">Journal de la bankroll (30 derniers mouvements)</h3>
        <ul className="mt-1 divide-y divide-line text-[13px]">
          {(journal ?? []).map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-1.5">
              <span className="w-20 shrink-0 text-[11px] text-ink-muted">{new Date(t.at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Africa/Abidjan" })} {new Date(t.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })}</span>
              {t.bet_id ? <Link href={`/paris/${t.bet_id}`} className="min-w-0 flex-1 truncate underline decoration-line">{t.note ?? t.type}</Link> : <span className="min-w-0 flex-1 truncate">{t.note ?? (t.type === "depot" ? "Dépôt" : t.type === "retrait" ? "Retrait" : t.type)}</span>}
              <span className={`shrink-0 font-semibold tabular-nums ${Number(t.montant) >= 0 ? "text-gain" : "text-loss"}`}>{Number(t.montant) >= 0 ? "+" : "−"}{Math.abs(Math.round(Number(t.montant))).toLocaleString("fr-FR")}</span>
            </li>
          ))}
        </ul>
      </details>


      <h2 className="mt-6 text-base font-bold">Notifications</h2>
      <NotificationsCard prefs={{ resultats: np?.resultats ?? true, direct: np?.direct ?? true, coup_envoi: np?.coup_envoi ?? true, coups_du_jour: np?.coups_du_jour ?? true, sources: np?.sources ?? true }} />

      <h2 className="mt-6 text-base font-bold">Application et compte</h2>
      <div className="mt-3"><InstallButton /></div>
      <section className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-4">
        <p className="min-w-0 truncate text-sm text-ink-muted">Connecté : {user?.email}</p>
        <form action={signOut}><button className="rounded-lg border border-line px-3 py-2 text-sm font-medium">Déconnexion</button></form>
      </section>
    </>
  );
}
