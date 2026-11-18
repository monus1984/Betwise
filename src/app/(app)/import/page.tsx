import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { loadSourceOptions } from "@/lib/sources/options";
import { ImportFlow } from "./import-flow";

export const dynamic = "force-dynamic";

/** Cible de partage Android (manifest share_target) et point d'entrée « Importer un ticket ». */
export default async function ImportPage({ searchParams }: { searchParams: Promise<{ text?: string; url?: string; title?: string; ok?: string; next?: string; source?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ordered = await loadSourceOptions(supabase, user!.id);
  const mine = ordered.find((s) => s.type === "perso");
  // Arrivée depuis la fiche d'une source : ses coupons lui sont attribués d'office (modifiable ligne par ligne)
  const voulue = sp.source ? ordered.find((s) => s.id === sp.source) : undefined;
  const sharedText = [sp.title, sp.text, sp.url].filter(Boolean).join("\n");
  const { data: markets } = await supabase.from("markets").select("code, libelle_fr, a_parametre").order("code");

  return (
    <>
      <PageHeader title="Importer" subtitle={voulue ? `Coupon ou pronos de ${voulue.nom} : une capture, une vidéo ou le texte, joués ou non, avant ou après le match.` : "Ticket de bookmaker ou pronos d’un tipster : une capture, une vidéo ou le texte. Tu vérifies, puis tu enregistres."} />
      <ImportFlow markets={markets ?? []} sources={ordered} defaultOrigin={voulue?.id ?? mine?.id ?? null} initialText={sharedText} justSaved={!!sp.ok} nextTab={sp.next} />
    </>
  );
}
