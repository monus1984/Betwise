/** Coups du jour (une fois par jour, après les cotes et le modèle). Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY */
import "dotenv/config";
import { createAdminClient } from "../src/lib/supabase/admin";
import { generateDailyPicks } from "../src/lib/coach/daily";

generateDailyPicks(createAdminClient()).then((r) => console.log("Coups du jour :", JSON.stringify(r))).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
