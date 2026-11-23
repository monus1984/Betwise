import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConsoleIA } from "./console";

export const metadata = { title: "Console IA", robots: { index: false } };

/** Console IA de Mounir (23/11) : plusieurs IA interrogées en même temps, pour tous ses projets. Réservée à l'administrateur. */
export default async function Page() {
  const supabase = await createClient();
  const { data: admin } = await supabase.rpc("is_admin");
  if (!admin) notFound();
  return <ConsoleIA />;
}
