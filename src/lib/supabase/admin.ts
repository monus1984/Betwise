import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Client service_role : contourne la RLS. Réservé aux jobs (import des matchs,
 * règlement, recalcul des indicateurs). Jamais importé côté navigateur.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant");
  return createSupabaseClient<Database, "betwise">(url, key, {
    db: { schema: "betwise" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
