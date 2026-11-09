import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const supabase = await createClient();
  const { data: sources } = await supabase
    .from("sources")
    .select("id, nom, type, visibilite")
    .order("created_at");

  return (
    <>
      <PageHeader title="Sources" subtitle="Qui t’oriente, et avec quels résultats." />
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {(sources ?? []).map((s) => (
          <li key={s.id} className="flex items-center justify-between px-3 py-3 text-sm">
            <div>
              <p className="font-medium">{s.nom}</p>
              <p className="text-xs text-slate-500">{labelType(s.type)}{s.visibilite === "partagee" ? " · partagée" : ""}</p>
            </div>
            <span className="text-xs text-slate-400">Tendance : bientôt</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-slate-500">L’ajout de sources et l’import de pronos arrivent à l’étape suivante.</p>
    </>
  );
}

function labelType(t: string) {
  return ({
    perso: "Mes propres choix",
    tipster: "Pronostiqueur",
    page_facebook: "Page Facebook",
    compte_instagram: "Compte Instagram",
    canal_telegram: "Canal Telegram",
    site: "Site de prédictions",
    modele_betwise: "Modèle statistique BETWISE",
  } as Record<string, string>)[t] ?? t;
}
