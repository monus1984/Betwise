/**
 * Diagnostic de l'erreur d'hydratation intermittente de l'accueil (P1-11) : l'application tourne en mode développement,
 * qui nomme le composant fautif et montre l'écart entre le serveur et le navigateur. L'accueil est chargé N fois
 * avec le compte d'audit ; chaque message d'erreur complet est gardé.
 * Variables : BETWISE_URL (http://localhost:3000), NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ESSAIS (25).
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { cookies } from "./audit-ecrans";
import { compteAudit, sessionAudit } from "../src/lib/tipster-virtuel/compte";

const BASE = process.env.BETWISE_URL ?? "http://localhost:3000";
const N = Number(process.env.ESSAIS ?? 25);

async function main() {
  await compteAudit();
  const session = await sessionAudit();
  const browser = await chromium.launch();
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < N; i++) {
    const c = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, locale: "fr-FR", timezoneId: "Africa/Abidjan", colorScheme: i % 2 ? "dark" : "light" });
    await c.addCookies(cookies(session, process.env.NEXT_PUBLIC_SUPABASE_URL!));
    const page = await c.newPage();
    const erreurs: string[] = [];
    page.on("console", (m) => { if (m.type() === "error" || /hydrat/i.test(m.text())) erreurs.push(m.text().slice(0, 6000)); });
    page.on("pageerror", (e) => erreurs.push(`pageerror: ${e.message}\n${(e.stack ?? "").slice(0, 3000)}`));
    const t0 = Date.now();
    await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 180000 }).catch((e) => erreurs.push(`chargement: ${String(e).slice(0, 200)}`));
    await page.waitForTimeout(4000);
    out.push({ essai: i + 1, heure: new Date().toISOString(), ms: Date.now() - t0, erreurs });
    console.log(`essai ${i + 1} : ${erreurs.length} erreur(s)${erreurs[0] ? ` — ${erreurs[0].slice(0, 300).replace(/\s+/g, " ")}` : ""}`);
    await c.close();
  }
  await browser.close();
  mkdirSync("rapports/diag", { recursive: true });
  writeFileSync("rapports/diag/hydratation-dev.json", JSON.stringify(out, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
