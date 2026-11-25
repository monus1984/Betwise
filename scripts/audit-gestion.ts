/**
 * Robot de vérification « modifier / supprimer » (25/11), avec le compte d'audit uniquement (aucune donnée réelle).
 * Il crée ses propres données de test, clique sur les boutons comme un utilisateur, vérifie le résultat en base,
 * capture chaque étape, puis efface tout ce qu'il a créé.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, type Page } from "playwright-core";
import { createAdminClient } from "../src/lib/supabase/admin";
import { compteAudit, sessionAudit, clientAudit, AUDIT_PSEUDO } from "../src/lib/tipster-virtuel/compte";

const BASE = process.env.BETWISE_URL ?? "https://betwise-iota.vercel.app";
const OUT = "rapports/gestion";
const PREPARER = "globalThis.__name = globalThis.__name || ((f) => f);";
function cookies(session: object, url: string) {
  const name = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const base = { domain: new URL(BASE).hostname, path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const };
  if (value.length <= 3180) return [{ ...base, name, value }];
  return value.match(/.{1,3180}/g)!.map((v, i) => ({ ...base, name: `${name}.${i}`, value: v }));
}

type Res = { etape: string; ok: boolean; detail: string };
const res: Res[] = [];
const note = (etape: string, ok: boolean, detail = "") => { res.push({ etape, ok, detail }); console.log(`${ok ? "OK " : "ÉCHEC"} ${etape}${detail ? " — " + detail : ""}`); };

async function main() {
  mkdirSync(OUT, { recursive: true });
  const admin = createAdminClient();
  const auditId = await compteAudit();
  const session = await sessionAudit();
  const moi = clientAudit(session);
  await moi.rpc("ensure_profile", { p_pseudo: AUDIT_PSEUDO });
  const rpc = moi.rpc as unknown as (f: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>;

  // Données de test : 2 matchs à venir, la source « Moi », une source à soi avec un prono, un dépôt, un combiné, une montante à 2 paliers
  const { data: ms } = await admin.from("matches").select("id").eq("statut", "programme").gte("kickoff_at", new Date(Date.now() + 3 * 3600000).toISOString()).order("kickoff_at").limit(3);
  const [m1, m2, m3] = (ms ?? []).map((x) => x.id);
  const { data: perso } = await moi.from("sources").select("id").eq("type", "perso").eq("created_by", auditId).maybeSingle();
  const persoId = perso?.id ?? (await moi.from("sources").select("id").eq("type", "perso").limit(1).single()).data!.id;
  await rpc("bankroll_move", { p_type: "depot", p_montant: 12345 });
  const { data: src } = await moi.from("sources").insert({ type: "tipster", nom: "Robot test gestion", visibilite: "privee", created_by: auditId } as never).select("id").single();
  const srcId = (src as { id: string }).id;
  await moi.from("source_follows").upsert({ user_id: auditId, source_id: srcId } as never, { onConflict: "user_id,source_id" });
  const lp = await rpc("log_prediction", { p_source_id: srcId, p_market_code: "1X2", p_selection: "1", p_match_id: m1, p_match_libre: null, p_market_param: null, p_cote_annoncee: 1.8, p_risque_annonce: null, p_published_at: null });
  note("préparation : prono", !lp.error, lp.error?.message ?? "");
  const sel = (m: string, s: string, c: number) => ({ match_id: m, match_libre: null, market_code: "1X2", market_param: null, selection: s, cote: c, origin_source_id: persoId });
  const pb = await rpc("place_bet", { p_mise: 500, p_selections: [sel(m1, "1", 1.5), sel(m2, "2", 2.1)], p_source_import: "manuel", p_virtuel: false });
  const betId = pb.data as string; note("préparation : combiné", !pb.error, pb.error?.message ?? "");
  const { data: mo } = await moi.from("montantes").insert({ user_id: auditId, nom: "Robot montante", mise_depart: 1000, objectif: 4000, paliers_prevus: 3, niveau: "sur" } as never).select("id").single();
  const moId = (mo as { id: string }).id;
  const p1 = await rpc("place_bet", { p_mise: 1000, p_selections: [sel(m3 ?? m1, "1", 1.6)], p_source_import: "manuel", p_virtuel: false });
  await rpc("montante_rattacher", { p_montante_id: moId, p_bet_id: p1.data });

  const { data: bk } = await moi.from("bankroll_transactions").select("bankroll_id").eq("type", "depot").eq("montant", 12345).limit(1).maybeSingle();
  const bkId = bk?.bankroll_id ?? null;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR", timezoneId: "Africa/Abidjan" });
  await ctx.addInitScript({ content: PREPARER });
  await ctx.addCookies(cookies(session, process.env.NEXT_PUBLIC_SUPABASE_URL!));
  const page = await ctx.newPage();
  let n = 0;
  const shot = async (p: Page, nom: string) => { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${nom}.jpg`, type: "jpeg", quality: 80, fullPage: true }); };
  const aller = async (chemin: string) => { await page.goto(BASE + chemin, { waitUntil: "networkidle" }); };
  const bouton = (t: string | RegExp) => page.getByRole("button", { name: t });
  const essai = async (etape: string, f: () => Promise<string | true>) => { try { const r = await f(); note(etape, r === true, r === true ? "" : r); } catch (e) { note(etape, false, (e as Error).message.split("\n")[0]); } };

  try {
    // 1. Pari : retirer une ligne du combiné
    await essai("pari : retirer une ligne du combiné", async () => {
      await aller(`/paris/${betId}`); await shot(page, "pari-detail");
      await page.getByRole("button", { name: "Retirer cette ligne" }).first().click();
      await page.getByRole("button", { name: "Oui", exact: true }).click(); await page.waitForTimeout(2500); await shot(page, "pari-ligne-retiree");
      const { data } = await moi.from("bets").select("nb_selections, type, cote_totale").eq("id", betId).single();
      return data?.nb_selections === 1 && data.type === "simple" ? true : `en base : ${JSON.stringify(data)}`;
    });
    // 2. Pari réglé puis rouvert
    await essai("pari : rouvrir un pari réglé", async () => {
      await admin.from("bets").update({ statut: "perdu", gain_net: -500, settled_at: new Date().toISOString() } as never).eq("id", betId);
      await aller(`/paris/${betId}`); await shot(page, "pari-regle");
      await bouton("Rouvrir pour corriger").click(); await bouton(/^Rouvrir$/).click(); await page.waitForTimeout(2500); await shot(page, "pari-rouvert");
      const { data } = await moi.from("bets").select("statut").eq("id", betId).single();
      return data?.statut === "en_cours" ? true : `statut : ${data?.statut}`;
    });
    // 3. Pari supprimé
    await essai("pari : supprimer", async () => {
      await aller(`/paris/${betId}`);
      await page.getByRole("region", { name: "Gérer ce pari" }).getByRole("button", { name: "Supprimer" }).click(); await shot(page, "pari-confirmation-suppression");
      await page.getByRole("region", { name: "Gérer ce pari" }).getByRole("button", { name: "Supprimer" }).click(); await page.waitForURL(/\/paris$/, { timeout: 10000 }).catch(() => {}); await shot(page, "pari-supprime");
      const { data } = await moi.from("bets").select("id").eq("id", betId).maybeSingle();
      const { count } = await moi.from("bankroll_transactions").select("id", { count: "exact", head: true }).eq("bet_id", betId);
      return !data && !count ? true : "le pari ou ses mouvements existent encore";
    });
    // 4. Prono : modifier la cote puis supprimer
    await essai("prono : modifier", async () => {
      await aller(`/sources/${srcId}`); await shot(page, "source-fiche");
      await bouton("Modifier").first().click(); await shot(page, "prono-edition");
      const cote = page.getByLabel(/Cote annoncée/); await cote.fill("1,95");
      await bouton("Enregistrer").click(); await page.waitForTimeout(2500); await shot(page, "prono-modifie");
      const { data } = await moi.from("predictions").select("cote_annoncee").eq("source_id", srcId).single();
      return Number(data?.cote_annoncee) === 1.95 ? true : `cote en base : ${data?.cote_annoncee}`;
    });
    await essai("prono : supprimer", async () => {
      await aller(`/sources/${srcId}`);
      await page.locator("li").getByRole("button", { name: "Supprimer" }).first().click();
      await page.locator("li").getByRole("button", { name: "Supprimer" }).first().click(); await page.waitForTimeout(2500); await shot(page, "prono-supprime");
      const { count } = await moi.from("predictions").select("id", { count: "exact", head: true }).eq("source_id", srcId);
      return count === 0 ? true : `${count} prono(s) restant(s)`;
    });
    // 5. Source : renommer puis supprimer
    await essai("source : renommer", async () => {
      await aller(`/sources/${srcId}`);
      const zone = page.getByRole("region", { name: "Gérer cette source" });
      await zone.getByRole("button", { name: "Modifier" }).click(); await zone.getByLabel("Nom").fill("Robot test renommé");
      await zone.getByRole("button", { name: "Enregistrer" }).click(); await page.waitForTimeout(2500); await shot(page, "source-renommee");
      const { data } = await moi.from("sources").select("nom").eq("id", srcId).single();
      return data?.nom === "Robot test renommé" ? true : `nom : ${data?.nom}`;
    });
    await essai("source : supprimer", async () => {
      await aller(`/sources/${srcId}`);
      const zone = page.getByRole("region", { name: "Gérer cette source" });
      await zone.getByRole("button", { name: "Supprimer" }).click(); await shot(page, "source-confirmation");
      await zone.getByRole("button", { name: "Supprimer" }).click(); await page.waitForURL(/\/sources/, { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(1500); await shot(page, "source-supprimee");
      const { data } = await admin.from("sources").select("id").eq("id", srcId).maybeSingle();
      return !data ? true : "la source existe encore";
    });
    // 6. Bankroll : modifier puis supprimer le dépôt
    const { data: dep } = await moi.from("bankroll_transactions").select("id, bankroll_id").eq("type", "depot").eq("montant", 12345).order("at", { ascending: false }).limit(1).maybeSingle();
    await essai("bankroll : modifier un dépôt", async () => {
      await aller("/bankroll?v=mouvements"); await shot(page, "bankroll-mouvements");
      await page.getByRole("button", { name: "Modifier ce mouvement" }).first().click();
      await page.getByLabel("Montant").fill("12000"); await bouton("Enregistrer").click(); await page.waitForTimeout(2500); await shot(page, "bankroll-depot-modifie");
      const { data } = await moi.from("bankroll_transactions").select("montant").eq("id", dep!.id).maybeSingle();
      return Number(data?.montant) === 12000 ? true : `montant : ${data?.montant} (le premier dépôt de la liste n'est peut-être pas celui du robot)`;
    });
    await essai("bankroll : supprimer un dépôt", async () => {
      await aller("/bankroll?v=mouvements");
      await page.getByRole("button", { name: "Modifier ce mouvement" }).first().click();
      await bouton("Supprimer").click(); await bouton("Supprimer").last().click(); await page.waitForTimeout(2500); await shot(page, "bankroll-depot-supprime");
      const { data } = await moi.from("bankroll_transactions").select("id").eq("id", dep!.id).maybeSingle();
      return !data ? true : "le dépôt existe encore";
    });
    // 7. Montante : détacher le dernier palier, arrêter, reprendre
    await essai("montante : détacher le palier", async () => {
      await aller(`/montantes/${moId}`); await shot(page, "montante");
      await bouton("Détacher ce palier").click(); await bouton(/^Détacher$/).click(); await page.waitForTimeout(2500); await shot(page, "montante-palier-detache");
      const { data } = await moi.from("bets").select("montante_id").eq("id", p1.data as string).single();
      return data?.montante_id === null ? true : "le pari est encore rattaché";
    });
    await essai("montante : reprendre après arrêt", async () => {
      await admin.from("montantes").update({ statut: "arretee", termine_at: new Date().toISOString() } as never).eq("id", moId);
      await aller(`/montantes/${moId}`); await shot(page, "montante-arretee");
      await bouton("Reprendre la montante").click(); await page.waitForTimeout(2500); await shot(page, "montante-reprise");
      const { data } = await moi.from("montantes").select("statut").eq("id", moId).single();
      return data?.statut === "en_cours" ? true : `statut : ${data?.statut}`;
    });
  } finally {
    await browser.close();
    // Nettoyage : tout ce que le robot a créé
    if (betId) await rpc("delete_bet", { p_bet_id: betId }).catch(() => {});
    if (p1.data) await rpc("delete_bet", { p_bet_id: p1.data }).catch(() => {});
    await admin.from("montantes").delete().eq("id", moId);
    await admin.from("predictions").delete().eq("source_id", srcId);
    await admin.from("source_follows").delete().eq("source_id", srcId);
    await admin.from("sources").delete().eq("id", srcId);
    if (bkId) await admin.from("bankroll_transactions").delete().eq("bankroll_id", bkId).eq("type", "depot").in("montant", [12345, 12000]);
    writeFileSync(`${OUT}/resultats.json`, JSON.stringify(res, null, 2));
  }
  const echecs = res.filter((r) => !r.ok).length;
  console.log(`${res.length - echecs}/${res.length} vérifications réussies`);
}
main().catch((e) => { console.error(e); process.exit(1); });
