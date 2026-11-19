/**
 * Ajoute les statistiques par joueur (details.joueurs) aux matchs terminés des 30 derniers jours qui n'en ont pas.
 * Ne touche à aucune autre clé de la feuille de match. Une requête pour 20 matchs.
 * Variables : API_FOOTBALL_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import "dotenv/config";
import { createAdminClient } from "../src/lib/supabase/admin";
import { ApiFootball } from "../src/lib/api-football/client";
import { joueursOf } from "../src/lib/api-football/sync";

async function main() {
  const db = createAdminClient(); const api = new ApiFootball(process.env.API_FOOTBALL_KEY ?? "");
  const { data, error } = await db.from("matches").select("id, af_fixture_id, details")
    .eq("statut", "termine").not("af_fixture_id", "is", null).not("details_at", "is", null)
    .gte("kickoff_at", new Date(Date.now() - 30 * 86400000).toISOString()).order("kickoff_at").order("id").limit(1000);
  if (error) throw new Error(error.message);
  const ms = (data ?? []).filter((m) => !(m.details as { joueurs?: unknown } | null)?.joueurs);
  let ok = 0, vide = 0;
  for (let i = 0; i < ms.length; i += 20) {
    const lot = ms.slice(i, i + 20); const fx = await api.byIds(lot.map((m) => m.af_fixture_id!));
    for (const m of lot) {
      const f = fx.find((x) => x.fixture.id === m.af_fixture_id); const j = f ? joueursOf(f) : undefined;
      if (!j) { vide++; continue; }
      const { error: e } = await db.from("matches").update({ details: { ...(m.details as object ?? {}), joueurs: j } }).eq("id", m.id);
      if (e) throw new Error(e.message); ok++;
    }
  }
  console.log(`Joueurs : ${ok} match(s) complété(s), ${vide} sans statistiques de joueurs chez le fournisseur, sur ${ms.length} · requêtes ${api.calls} · restant ${api.remaining}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
