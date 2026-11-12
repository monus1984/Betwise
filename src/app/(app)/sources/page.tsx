import Link from "next/link";
import { linkOf } from "@/lib/sources/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { labelType, TrendBadge } from "./source-ui";

export const dynamic = "force-dynamic";

export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const sp = await searchParams;
  const filter = sp.f === "decouvrir" ? "decouvrir" : "suivies";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: follows } = await supabase.from("source_follows").select("source_id").eq("user_id", user!.id);
  const followed = new Set((follows ?? []).map((f) => f.source_id));

  const { data: sources } = await supabase
    .from("sources")
    .select("id, nom, type, visibilite, created_by, created_at, lien, identifiant_externe")
    .order("created_at");
  const { data: trends } = await supabase.from("source_trend").select("*");
  const trend = new Map((trends ?? []).map((t) => [t.source_id, t]));

  const all = sources ?? [];
  const mine = all.filter((s) => s.type === "perso" && s.created_by === user!.id);
  const model = all.filter((s) => s.type === "modele_betwise");
  const others = all.filter((s) => s.type !== "perso" && s.type !== "modele_betwise");
  const list = filter === "suivies"
    ? [...mine, ...others.filter((s) => followed.has(s.id) || s.created_by === user!.id), ...model]
    : others.filter((s) => s.visibilite === "partagee" && !followed.has(s.id) && s.created_by !== user!.id);

  return (
    <>
      <PageHeader
        title="Sources"
        subtitle="Qui t’oriente, et avec quels résultats."
        action={<Link href="/sources/nouvelle" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">+ Source</Link>}
      />
      <div className="mb-4 flex gap-2">
        <Tab href="/sources" active={filter === "suivies"}>Mes sources</Tab>
        <Tab href="/sources?f=decouvrir" active={filter === "decouvrir"}>Partagées par d’autres</Tab>
      </div>

      {list.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
          {filter === "suivies" ? "Ajoute un pronostiqueur, une page ou un canal que tu suis." : "Aucune source partagée à découvrir pour l’instant."}
        </div>
      )}

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {list.map((s) => {
          const t = trend.get(s.id);
          return (
            <li key={s.id} className="flex items-stretch">
              <Link href={`/sources/${s.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-3 active:bg-slate-50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.nom}</p>
                  <p className="text-xs text-slate-500">{labelType(s.type)}{s.visibilite === "partagee" && s.type !== "modele_betwise" ? " · partagée" : ""}</p>
                </div>
                <TrendBadge regles={Number(t?.nb_regles ?? 0)} gagnes={Number(t?.nb_gagnes ?? 0)} declares={Number(t?.nb_declares ?? 0)} />
              </Link>
              {linkOf(s) && (
                <a href={linkOf(s)!} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir la page de ${s.nom}`} className="flex w-11 shrink-0 items-center justify-center border-l border-slate-200 text-brand active:bg-slate-50">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`rounded-full px-3.5 py-1.5 text-sm ${active ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>
      {children}
    </Link>
  );
}
