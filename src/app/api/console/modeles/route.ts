import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODELES } from "@/lib/console/modeles";

export const revalidate = 3600;

/** Capacités et prix des modèles de la console, d'après la liste publique d'OpenRouter (réservé à l'administrateur). */
export async function GET() {
  const supabase = await createClient();
  const { data: admin } = await supabase.rpc("is_admin");
  if (!admin) return NextResponse.json({ error: "réservé" }, { status: 403 });
  const liste = await fetch("https://openrouter.ai/api/v1/models", { next: { revalidate: 3600 } }).then((r) => r.json()).catch(() => ({ data: [] })) as
    { data: { id: string; pricing?: { prompt?: string; completion?: string }; architecture?: { input_modalities?: string[] } }[] };
  const parId = new Map(liste.data.map((m) => [m.id, m]));
  return NextResponse.json(MODELES.map((m) => {
    const o = parId.get(m.fournisseur === "anthropic" ? "anthropic/claude-sonnet-5.5" : m.id);
    return { ...m, image: o ? (o.architecture?.input_modalities ?? []).includes("image") : m.fournisseur === "anthropic",
      prix: o?.pricing ? [Number(o.pricing.prompt) * 1e6, Number(o.pricing.completion) * 1e6] : null, disponible: m.fournisseur === "anthropic" || !!o };
  }));
}
