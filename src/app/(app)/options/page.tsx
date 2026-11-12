import { createClient } from "@/lib/supabase/server";
import { OptionsView, type SP } from "./options-view";

export const dynamic = "force-dynamic";

export default async function OptionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <OptionsView sp={await searchParams} db={await createClient()} />;
}

