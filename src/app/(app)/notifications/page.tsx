import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, Empty } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const quand = (iso: string) => {
  const d = new Date(iso), j = Math.floor((Date.now() - d.getTime()) / 86400000);
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
  return j < 1 ? heure : `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Africa/Abidjan" })}, ${heure}`;
};

/** Boîte de notifications : les 60 dernières, non lues en tête de lecture. Ouvrir la page les marque comme lues. */
export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("id, type, titre, corps, url, created_at, lu_at").order("created_at", { ascending: false }).limit(60);
  const liste = data ?? [], nonLues = liste.filter((n) => !n.lu_at).length;
  if (nonLues > 0) await supabase.rpc("notifications_read");

  return (
    <>
      <PageHeader title="Notifications" subtitle="Résultats à confirmer, coups d’envoi et buts de tes matchs." action={<Link href="/reglages">Régler</Link>} />
      {liste.length === 0 ? (
        <Empty titre="Aucune notification">Elles arrivent quand un de tes matchs commence, qu’un but tombe ou qu’un résultat attend ta confirmation.</Empty>
      ) : (
        <Card className="!p-0">
          <ul className="divide-y divide-line">
            {liste.map((n) => (
              <li key={n.id}>
                <Link href={n.url || "/"} className="flex gap-3 px-4 py-3 active:bg-surface-2">
                  <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.lu_at ? "bg-transparent" : "bg-brand"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.lu_at ? "font-medium" : "font-semibold"}`}>{n.titre}{!n.lu_at && <span className="sr-only"> (non lue)</span>}</span>
                    <span className="block text-[13px] leading-snug text-ink-muted">{n.corps}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-muted">{quand(n.created_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="mt-2 px-1 text-[11px] text-ink-muted">Les 60 plus récentes. Aucun montant n’apparaît dans une notification.</p>
    </>
  );
}
