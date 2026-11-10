import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { ImportFlow } from "./import-flow";

export const dynamic = "force-dynamic";

/** Cible de partage Android (manifest share_target) et point d'entrée « Importer un ticket ». */
export default async function ImportPage({ searchParams }: { searchParams: Promise<{ text?: string; url?: string; title?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: sources } = await supabase.from("sources").select("id, nom, type").neq("type", "modele_betwise").order("created_at");
  const mine = (sources ?? []).find((s) => s.type === "perso");
  const ordered = [...(mine ? [mine] : []), ...(sources ?? []).filter((s) => s.type !== "perso")];
  const sharedText = [sp.title, sp.text, sp.url].filter(Boolean).join("\n");

  return (
    <>
      <PageHeader title="Importer un ticket" subtitle="Capture, texte partagé ou lien. Tu vérifies, puis tu enregistres." />
      <ImportFlow sources={ordered} defaultOrigin={mine?.id ?? null} initialText={sharedText} />
    </>
  );
}
