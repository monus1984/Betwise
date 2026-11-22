/**
 * Captures de tous les écrans de BETWISE pour l'audit UI/UX, avec le compte d'audit (aucun mot de passe).
 * Téléphone 360 × 780, thème clair puis sombre, page entière. Sortie : rapports/ecrans/<clair|sombre>/<nom>.jpg
 * et rapports/ecrans/index.json (temps de chargement, erreurs de console, débordement horizontal).
 * Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BETWISE_URL (défaut : production).
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, type BrowserContext } from "playwright-core";
import { createAdminClient } from "../src/lib/supabase/admin";
import { compteAudit, sessionAudit, clientAudit } from "../src/lib/tipster-virtuel/compte";

const BASE = process.env.BETWISE_URL ?? "https://betwise-iota.vercel.app";
const OUT = "rapports/ecrans";

/** Cookie de session au format de @supabase/ssr : « base64- » + JSON en base64url, découpé en morceaux de 3 180. */
function cookies(session: object, url: string) {
  const ref = new URL(url).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const host = new URL(BASE).hostname;
  const base = { domain: host, path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const };
  if (value.length <= 3180) return [{ ...base, name, value }];
  const parts = value.match(/.{1,3180}/g)!;
  return parts.map((v, i) => ({ ...base, name: `${name}.${i}`, value: v }));
}

async function main() {
  const admin = createAdminClient();
  const auditId = await compteAudit();
  const session = await sessionAudit();
  const moi = clientAudit(session);
  await moi.rpc("ensure_profile", { p_pseudo: "Claude (audit)" });

  // Pages qui demandent un identifiant : un match à venir, un pari, une montante, une source
  const { data: m } = await admin.from("matches").select("id").eq("statut", "programme").gte("kickoff_at", new Date().toISOString()).order("kickoff_at").limit(1).maybeSingle();
  const { data: fini } = await admin.from("matches").select("id").eq("statut", "termine").order("kickoff_at", { ascending: false }).limit(1).maybeSingle();
  const { data: b } = await moi.from("bets").select("id").order("placed_at", { ascending: false }).limit(1).maybeSingle();
  const { data: mo } = await moi.from("montantes").select("id").limit(1).maybeSingle();
  const { data: so } = await moi.from("sources").select("id").neq("type", "perso").limit(1).maybeSingle();
  void auditId;

  const ecrans: [string, string][] = [
    ["01-predictions", "/"], ["02-matchs", "/matchs"], ["03-matchs-en-direct", "/matchs?f=direct"],
    ["04-fiche-match", m ? `/matchs/${m.id}` : ""], ["05-fiche-match-terminee", fini ? `/matchs/${fini.id}` : ""],
    ["06-classement", "/matchs/classement"], ["07-mes-paris", "/paris"], ["08-paris-test", "/paris?vue=tests"],
    ["09-detail-pari", b ? `/paris/${b.id}` : ""], ["10-ajouter-pari", "/paris/ajouter"], ["11-importer", "/import"],
    ["12-importer-test", "/import?test=1"], ["13-coach", "/coach"], ["14-montantes", "/montantes"],
    ["15-montante", mo ? `/montantes/${mo.id}` : ""], ["16-sources", "/sources"], ["17-source", so ? `/sources/${so.id}` : ""],
    ["18-nouvelle-source", "/sources/nouvelle"], ["19-comparer-sources", "/sources/comparer"], ["20-bankroll", "/bankroll"],
    ["21-bilan", "/bilan"], ["22-notifications", "/notifications"], ["23-reglages", "/reglages"], ["24-options", "/options"],
    ["25-nouveau", "/nouveau"],
  ];
  const publics: [string, string][] = [["00a-connexion", "/connexion"], ["00b-inscription", "/inscription"]];

  const browser = await chromium.launch();
  const index: Record<string, unknown>[] = [];
  for (const theme of ["clair", "sombre"] as const) {
    mkdirSync(`${OUT}/${theme}`, { recursive: true });
    const ctx = (auth: boolean): Promise<BrowserContext> => browser.newContext({
      viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR",
      timezoneId: "Africa/Abidjan", colorScheme: theme === "sombre" ? "dark" : "light",
    }).then(async (c) => { if (auth) await c.addCookies(cookies(session, process.env.NEXT_PUBLIC_SUPABASE_URL!)); return c; });
    for (const [liste, auth] of [[publics, false], [ecrans, true]] as const) {
      const c = await ctx(auth);
      for (const [nom, chemin] of liste) {
        if (!chemin) { index.push({ theme, nom, absent: "aucune donnée pour cet écran" }); continue; }
        const page = await c.newPage();
        const erreurs: string[] = [];
        page.on("console", (msg) => { if (msg.type() === "error") erreurs.push(msg.text().slice(0, 200)); });
        page.on("pageerror", (err) => erreurs.push(err.message.slice(0, 200)));
        const t0 = Date.now();
        let statut: number | null = null;
        try {
          const r = await page.goto(BASE + chemin, { waitUntil: "networkidle", timeout: 45000 });
          statut = r?.status() ?? null;
        } catch (e) { erreurs.push(`chargement : ${e instanceof Error ? e.message.slice(0, 120) : e}`); }
        const ms = Date.now() - t0;
        await page.waitForTimeout(800);
        const mesures = await page.evaluate(() => {
          const w = document.documentElement.clientWidth;
          const deborde = [...document.querySelectorAll("body *")].filter((el) => el.getBoundingClientRect().right > w + 1).length;
          // cibles tactiles de moins de 40 px de haut (liens et boutons visibles)
          const petites = [...document.querySelectorAll("a, button, [role=button], select, input")].filter((el) => {
            const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 40 || r.width < 40);
          }).map((el) => (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 40));
          return { hauteur: document.documentElement.scrollHeight, deborde, petites: petites.slice(0, 30), nbPetites: petites.length };
        });
        await page.screenshot({ path: `${OUT}/${theme}/${nom}.jpg`, fullPage: true, type: "jpeg", quality: 80 });
        index.push({ theme, nom, chemin, statut, url: page.url().replace(BASE, ""), ms, erreurs, ...mesures });
        await page.close();
      }
      await c.close();
    }
  }
  await browser.close();
  writeFileSync(`${OUT}/index.json`, JSON.stringify(index, null, 2));
  console.log(`${index.length} captures`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : JSON.stringify(e)); process.exit(1); });
