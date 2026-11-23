import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { fcfa } from "@/components/ui";
import { signOut } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { InstallButton } from "@/components/install-button";
import { ThemeChoice } from "@/components/theme-choice";
import { NotificationsCard } from "@/components/notifications-card";

export const dynamic = "force-dynamic";

/** Tout ce qui se règle une fois de temps en temps : bankroll, comparaison avec le bookmaker, notifications, compte. */
export default async function ReglagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: summary }, { data: np }, { data: admin }] = await Promise.all([
    supabase.from("my_bankroll_summary").select("solde").maybeSingle(),
    supabase.from("notification_prefs").select("resultats, direct, coup_envoi, coups_du_jour, sources").maybeSingle(),
    supabase.rpc("is_admin"),
  ]);
  const solde = Number(summary?.solde ?? 0);

  return (
    <>
      <PageHeader title="Réglages" subtitle="Notifications, apparence et compte." action={<Link href="/">Accueil</Link>} />

      {admin && (
        <Link href="/console" className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-brand bg-surface p-4 active:bg-surface-2">
          <span><b className="block text-sm">Console IA</b><span className="block text-[12px] text-ink-muted">Interroger plusieurs IA en même temps, pour tous tes projets (réservé à l’administrateur)</span></span>
          <span aria-hidden>›</span>
        </Link>
      )}
      <Link href="/bankroll" className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 active:bg-surface-2">
        <span><b className="block text-sm">Ma bankroll</b><span className="block text-[12px] text-ink-muted">Solde {fcfa(solde)} · dépôts, retraits, comparaison avec le bookmaker, journal</span></span>
        <span className="text-brand">›</span>
      </Link>

      <h2 className="mt-6 text-base font-bold">Notifications</h2>
      <p className="mt-1 text-[12px] text-ink-muted"><Link href="/notifications" className="text-brand underline">Voir les notifications reçues</Link></p>
      <NotificationsCard prefs={{ resultats: np?.resultats ?? true, direct: np?.direct ?? true, coup_envoi: np?.coup_envoi ?? true, coups_du_jour: np?.coups_du_jour ?? true, sources: np?.sources ?? true }} />

      <h2 className="mt-6 text-base font-bold">Apparence</h2>
      <div className="mt-3 rounded-xl border border-line bg-surface p-4">
        <ThemeChoice />
        <p className="mt-2 text-xs text-ink-muted">Le choix reste sur ce téléphone.</p>
      </div>

      <h2 className="mt-6 text-base font-bold">Application et compte</h2>
      <div className="mt-3"><InstallButton /></div>
      <section className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
        <p className="min-w-0 truncate text-sm text-ink-muted">Connecté : {user?.email}</p>
        <form action={signOut}><button className="rounded-lg border border-line px-3 py-2 text-sm font-medium">Déconnexion</button></form>
      </section>
    </>
  );
}
