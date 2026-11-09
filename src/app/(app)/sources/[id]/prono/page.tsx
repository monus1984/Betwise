import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { NewPredictionForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewPredictionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: s } = await supabase.from("sources").select("id, nom, type").eq("id", id).maybeSingle();
  if (!s || s.type === "modele_betwise") notFound();
  const { data: markets } = await supabase.from("markets").select("code, libelle_fr, a_parametre").order("code");

  return (
    <>
      <Link href={`/sources/${id}`} className="mb-3 inline-block text-sm text-slate-600">‹ {s.nom}</Link>
      <PageHeader title="Enregistrer un prono" subtitle={`Ce que ${s.nom} annonce, tel quel. Tu décides ensuite de le jouer ou non.`} />
      <NewPredictionForm sourceId={id} markets={markets ?? []} />
    </>
  );
}
