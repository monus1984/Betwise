import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { loadSourceOptions } from "@/lib/sources/options";
import { ImportFlow } from "./import-flow";

export const dynamic = "force-dynamic";

/** Cible de partage Android (manifest share_target) et point d'entrée « Importer un ticket ». */
export default async function ImportPage({ searchParams }: { searchParams: Promise<{ text?: string; url?: string; title?: string; ok?: string; next?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ordered = await loadSourceOptions(supabase, user!.id);
  const mine = ordered.find((s) => s.type === "perso");
  const sharedText = [sp.title, sp.text, sp.url].filter(Boolean).join("\n");

  return (
    <>
      <PageHeader title="Importer un ticket" subtitle="Une capture d’écran suffit. Tu vérifies, puis tu enregistres." />
      <ImportFlow sources={ordered} defaultOrigin={mine?.id ?? null} initialText={sharedText} justSaved={!!sp.ok} nextTab={sp.next} />
    </>
  );
}
