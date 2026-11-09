"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/** Client navigateur. Toutes les requêtes ciblent le schéma `betwise`. */
export function createClient() {
  return createBrowserClient<Database, "betwise">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "betwise" } },
  );
}
