/**
 * Captures et mesures de tous les écrans de BETWISE pour l'audit UI/UX, avec le compte d'audit (aucun mot de passe).
 *
 * Trois passes :
 *  - « clair » et « sombre » : téléphone 360 × 780, page entière, tous les écrans et leurs états (onglets, filtres,
 *    championnat déroulé, aide ouverte, états vides, erreurs) ;
 *  - « petit » : 320 × 640 en thème clair, sur les écrans les plus denses.
 * Pour chaque écran : temps de chargement, erreurs de console, débordement horizontal réel, textes coupés, cibles
 * tactiles trop petites, images non chargées, éléments recouverts par Betster flottant, contrôle d'accessibilité axe.
 * Les noms des sources partagées (tipsters suivis par les utilisateurs) sont remplacés par « Source 1, 2… » avant la
 * capture : les captures sont déposées sur un dépôt public.
 *
 * Sortie : rapports/ecrans/<passe>/<nom>.jpg, rapports/ecrans/index.json, rapports/ecrans/hydratation.json
 * Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BETWISE_URL (défaut : production).
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { createAdminClient } from "../src/lib/supabase/admin";
import { compteAudit, sessionAudit, clientAudit, AUDIT_PSEUDO } from "../src/lib/tipster-virtuel/compte";
import { TOP5 } from "../src/lib/competitions";

const BASE = process.env.BETWISE_URL ?? "https://betwise-iota.vercel.app";
const OUT = "rapports/ecrans";
const AXE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

type Ecran = { nom: string; chemin: string; auth?: boolean; action?: (p: Page) => Promise<void>; ecranSeul?: boolean; note?: string };

/** Cookie de session au format de @supabase/ssr : « base64- » + JSON en base64url, découpé en morceaux de 3 180. */
export function cookies(session: object, url: string) {
  const ref = new URL(url).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const base = { domain: new URL(BASE).hostname, path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const };
  if (value.length <= 3180) return [{ ...base, name, value }];
  return value.match(/.{1,3180}/g)!.map((v, i) => ({ ...base, name: `${name}.${i}`, value: v }));
}

/** tsx (esbuild) entoure les fonctions nommées d'un appel à __name : la page doit le connaître, sinon tout evaluate échoue. */
export const PREPARER = "globalThis.__name = globalThis.__name || ((f) => f);";

/** Remplace les noms de sources par des alias dans tout le texte de la page. */
export async function masquer(page: Page, noms: string[]) {
  if (!noms.length) return;
  await page.evaluate((ns) => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (w.nextNode()) nodes.push(w.currentNode as Text);
    for (const n of nodes) {
      let t = n.nodeValue ?? "";
      if (t.length < 3) continue;
      let change = false;
      ns.forEach((nom, i) => { if (t.includes(nom)) { t = t.split(nom).join(`Source ${i + 1}`); change = true; } });
      if (change) n.nodeValue = t;
    }
  }, noms);
}

/** Fait défiler toute la page pour charger les images différées, puis revient en haut. */
export async function derouler(page: Page) {
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 110)); }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(350);
}

export async function mesurer(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement, w = de.clientWidth;
    const visible = (el: Element) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
    const txt = (el: Element) => (el.textContent || el.getAttribute("aria-label") || el.tagName).replace(/\s+/g, " ").trim().slice(0, 48);
    // textes coupés par des points de suspension
    const coupes: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const s = getComputedStyle(el);
      if (s.textOverflow === "ellipsis" && s.overflow !== "visible" && el.scrollWidth > el.clientWidth + 1 && visible(el)) coupes.push(txt(el));
    }
    // cibles tactiles
    const cibles = [...document.querySelectorAll<HTMLElement>("a, button, [role=button], [role=tab], [role=radio], select, input, textarea, summary")].filter(visible);
    const sous24 = cibles.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 24 || r.height < 24; });
    const sous44 = cibles.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; });
    // images non chargées
    const images = [...document.images].filter(visible);
    const cassees = images.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src.split("/").slice(-3).join("/").slice(0, 60));
    // petits caractères
    const tailles: Record<string, number> = {};
    const w2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w2.nextNode()) {
      const n = w2.currentNode as Text; const p = n.parentElement;
      if (!p || !(n.nodeValue ?? "").trim() || !visible(p)) continue;
      const fs = Math.round(parseFloat(getComputedStyle(p).fontSize) * 2) / 2;
      if (fs < 12) tailles[String(fs)] = (tailles[String(fs)] ?? 0) + 1;
    }
    // Betster flottant : ce qu'il recouvre en permanence, et ce qui passera dessous en défilant
    const fab = document.querySelector<HTMLElement>(".betster-fab");
    let betster: { fixes: string[]; passeDessous: number } | null = null;
    if (fab && visible(fab)) {
      const f = fab.getBoundingClientRect();
      const croise = (r: DOMRect) => r.right > f.left + 2 && r.left < f.right - 2;
      const fixes = [...document.querySelectorAll<HTMLElement>("body *")].filter((el) => {
        if (fab.contains(el) || el.contains(fab)) return false;
        const p = getComputedStyle(el).position; if (p !== "fixed" && p !== "sticky") return false;
        const r = el.getBoundingClientRect(); return visible(el) && croise(r) && r.bottom > f.top + 2 && r.top < f.bottom - 2;
      }).map(txt);
      betster = { fixes, passeDessous: cibles.filter((el) => !fab.contains(el) && croise(el.getBoundingClientRect())).length };
    }
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const poids = performance.getEntriesByType("resource").reduce((s, r) => s + ((r as PerformanceResourceTiming).transferSize || 0), nav?.transferSize ?? 0);
    return {
      hauteur: de.scrollHeight, ecrans: Math.round((de.scrollHeight / innerHeight) * 10) / 10,
      debordePage: de.scrollWidth - w,
      coupes: { n: coupes.length, exemples: [...new Set(coupes)].slice(0, 25) },
      cibles: { total: cibles.length, sous24: sous24.length, sous44: sous44.length, exemplesSous24: [...new Set(sous24.map(txt))].slice(0, 12) },
      images: { total: images.length, cassees },
      petitsCaracteres: tailles,
      betster,
      noeuds: document.querySelectorAll("*").length,
      perf: nav ? { ttfb: Math.round(nav.responseStart), dom: Math.round(nav.domContentLoadedEventEnd), charge: Math.round(nav.loadEventEnd), ko: Math.round(poids / 1024) } : null,
    };
  });
}

type Violation = { id: string; impact: string; help: string; nodes: { html: string; any: { data?: { fgColor?: string; bgColor?: string; contrastRatio?: number } }[] }[] };
export async function axe(page: Page) {
  try {
    await page.addScriptTag({ path: AXE });
    return await page.evaluate(async () => {
      const lance = (window as unknown as { axe: { run: (c: Document, o: object) => Promise<{ violations: unknown[] }> } }).axe.run;
      const r = await lance(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, resultTypes: ["violations"] });
      return (r.violations as Violation[]).map((v) => ({
        regle: v.id, gravite: v.impact, aide: v.help, n: v.nodes.length,
        exemples: v.nodes.slice(0, 6).map((n) => {
          const d = n.any?.[0]?.data;
          return { html: n.html.replace(/\s+/g, " ").slice(0, 140), contraste: d?.contrastRatio ?? null, couleurs: d?.fgColor ? `${d.fgColor} sur ${d.bgColor}` : null };
        }),
      }));
    });
  } catch (e) { return [{ regle: "axe", gravite: "erreur", aide: e instanceof Error ? e.message.slice(0, 120) : String(e), n: 0, exemples: [] }]; }
}

async function main() {
  const admin = createAdminClient();
  const auditId = await compteAudit();
  const session = await sessionAudit();
  const moi = clientAudit(session);
  await moi.rpc("ensure_profile", { p_pseudo: AUDIT_PSEUDO });

  // Noms à masquer : les sources créées par des utilisateurs (pas les sources du système ni la source « Moi »)
  const { data: srcs } = await moi.from("sources").select("nom, type, created_by");
  const noms = [...new Set((srcs ?? []).filter((s) => s.created_by && s.created_by !== auditId && s.type !== "perso").map((s) => s.nom.trim()).filter((n) => n.length >= 3))].sort((a, b) => b.length - a.length);

  // Matchs de référence : un grand championnat à venir, un terminé, un en direct, un sans cote
  const now = new Date();
  const jour = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Abidjan" });
  const hier = jour(new Date(now.getTime() - 86400000));
  const sel = "id, kickoff_at, statut, competition:competitions(code_externe)";
  const { data: aVenir } = await admin.from("matches").select(sel).eq("statut", "programme").gte("kickoff_at", new Date(now.getTime() + 30 * 60000).toISOString()).order("kickoff_at").limit(200);
  const { data: finis } = await admin.from("matches").select(sel).eq("statut", "termine").gte("kickoff_at", new Date(now.getTime() - 40 * 3600000).toISOString()).order("kickoff_at", { ascending: false }).limit(200);
  const { data: direct } = await admin.from("matches").select("id").eq("statut", "en_cours").limit(1);
  const top = (l: typeof aVenir) => (l ?? []).find((x) => TOP5.has(one(x.competition)?.code_externe ?? ""))?.id ?? l?.[0]?.id ?? null;
  const mTop = top(aVenir), mFini = top(finis), mDirect = direct?.[0]?.id ?? null;
  let mSans: string | null = null;
  const cand = (aVenir ?? []).map((x) => x.id);
  for (let i = 0; i < cand.length && !mSans; i += 30) {
    const lot = cand.slice(i, i + 30);
    const { data: o } = await admin.from("odds_observations").select("match_id").in("match_id", lot).limit(1000);
    const avec = new Set((o ?? []).map((x) => x.match_id));
    mSans = lot.find((id) => !avec.has(id)) ?? null;
  }
  const { data: b } = await moi.from("bets").select("id").order("placed_at", { ascending: false }).limit(1).maybeSingle();
  const { data: mo } = await moi.from("montantes").select("id").limit(1).maybeSingle();
  const { data: modele } = await moi.from("sources").select("id").eq("type", "modele_betwise").limit(1).maybeSingle();
  const { data: coups } = await moi.from("sources").select("id").eq("nom", "Coups du jour BETWISE").limit(1).maybeSingle();

  const clic = (texte: string | RegExp, role: "button" | "tab" | "link" = "button") => async (p: Page) => { await p.getByRole(role, { name: texte }).first().click({ timeout: 5000 }).catch(() => {}); await p.waitForTimeout(500); };
  const ouvrirChampionnat = async (p: Page) => { await p.locator("details > summary").first().click({ timeout: 5000 }).catch(() => {}); await p.waitForTimeout(400); };
  const m = (id: string | null, suite = "") => (id ? `/matchs/${id}${suite}` : "");

  const ecrans: Ecran[] = [
    { nom: "00a-connexion", chemin: "/connexion", auth: false },
    { nom: "00b-inscription", chemin: "/inscription", auth: false },
    { nom: "01-predictions", chemin: "/" },
    { nom: "01b-predictions-audacieux", chemin: "/", action: clic(/Audacieux/, "tab"), ecranSeul: true, note: "onglet Audacieux des coups du jour" },
    { nom: "01c-predictions-aide", chemin: "/", action: clic(/Comment ça marche/), ecranSeul: true, note: "aide ouverte" },
    { nom: "02-matchs", chemin: "/matchs" },
    { nom: "02b-matchs-championnat-ouvert", chemin: "/matchs", action: ouvrirChampionnat, note: "premier championnat déroulé" },
    { nom: "02c-matchs-hier", chemin: `/matchs?d=${hier}`, action: ouvrirChampionnat, note: "veille : matchs terminés, scores" },
    { nom: "02d-matchs-termines", chemin: "/matchs?s=termines&d=" + jour(now) },
    { nom: "02e-matchs-a-venir", chemin: "/matchs?s=programmes&d=" + jour(now) },
    { nom: "02f-matchs-direct", chemin: "/matchs?f=direct" },
    { nom: "02g-matchs-suivis", chemin: "/matchs?f=suivis" },
    { nom: "02h-matchs-recherche", chemin: "/matchs?q=barcelona" },
    { nom: "02i-matchs-recherche-vide", chemin: "/matchs?q=zzqqxx" },
    { nom: "02j-matchs-aide", chemin: "/matchs", action: clic(/Comment ça marche/), ecranSeul: true, note: "aide ouverte" },
    { nom: "03a-match-analyse", chemin: m(mTop) },
    { nom: "03b-match-stats", chemin: m(mTop, "?t=stats") },
    { nom: "03c-match-marches", chemin: m(mTop, "?t=marches") },
    { nom: "03d-match-sources", chemin: m(mTop, "?t=sources") },
    { nom: "03e-match-termine", chemin: m(mFini) },
    { nom: "03f-match-termine-stats", chemin: m(mFini, "?t=stats") },
    { nom: "03g-match-termine-marches", chemin: m(mFini, "?t=marches") },
    { nom: "03h-match-en-direct", chemin: m(mDirect) },
    { nom: "03i-match-sans-cote", chemin: m(mSans) },
    { nom: "03j-match-introuvable", chemin: "/matchs/00000000-0000-0000-0000-000000000000" },
    { nom: "04-classement", chemin: "/matchs/classement" },
    { nom: "05a-paris-en-cours", chemin: "/paris" },
    { nom: "05b-paris-regles", chemin: "/paris?f=regles" },
    { nom: "05c-paris-test", chemin: "/paris?vue=tests" },
    { nom: "05d-detail-pari", chemin: b ? `/paris/${b.id}` : "" },
    { nom: "06a-ajouter", chemin: "/paris/ajouter" },
    { nom: "06b-nouveau-pari", chemin: "/nouveau" },
    { nom: "06c-nouveau-test", chemin: "/nouveau?test=1" },
    { nom: "06d-importer", chemin: "/import" },
    { nom: "06e-importer-test", chemin: "/import?test=1" },
    { nom: "07a-coach", chemin: "/coach" },
    { nom: "07b-coach-discussion", chemin: "/coach?v=discussion" },
    { nom: "07c-bankroll", chemin: "/bankroll" },
    { nom: "07d-montantes", chemin: "/montantes" },
    { nom: "07e-montante", chemin: mo ? `/montantes/${mo.id}` : "" },
    { nom: "07f-options", chemin: "/options" },
    { nom: "08a-sources", chemin: "/sources" },
    { nom: "08b-sources-analyse", chemin: "/sources?f=analyse" },
    { nom: "08c-sources-classement", chemin: "/sources?f=classement" },
    { nom: "08d-sources-decouvrir", chemin: "/sources?f=decouvrir" },
    { nom: "08e-source-modele", chemin: modele ? `/sources/${modele.id}` : "" },
    { nom: "08f-source-coups-du-jour", chemin: coups ? `/sources/${coups.id}` : "" },
    { nom: "08g-nouvelle-source", chemin: "/sources/nouvelle" },
    { nom: "08h-comparer", chemin: "/sources/comparer" },
    { nom: "09a-bilan", chemin: "/bilan" },
    { nom: "09b-notifications", chemin: "/notifications" },
    { nom: "09c-reglages", chemin: "/reglages" },
    { nom: "10-page-inexistante", chemin: "/page-qui-n-existe-pas" },
  ];
  const PETIT = new Set(["01-predictions", "02-matchs", "02b-matchs-championnat-ouvert", "03a-match-analyse", "03c-match-marches", "05c-paris-test", "06b-nouveau-pari", "07f-options", "08e-source-modele"]);

  const browser = await chromium.launch();
  const index: Record<string, unknown>[] = [];
  const passes = [
    { passe: "clair", w: 360, h: 780, sombre: false, liste: ecrans },
    { passe: "sombre", w: 360, h: 780, sombre: true, liste: ecrans },
    { passe: "petit", w: 320, h: 640, sombre: false, liste: ecrans.filter((e) => PETIT.has(e.nom)) },
  ];
  for (const ps of passes) {
    mkdirSync(`${OUT}/${ps.passe}`, { recursive: true });
    const ctx = async (auth: boolean): Promise<BrowserContext> => {
      const c = await browser.newContext({ viewport: { width: ps.w, height: ps.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR", timezoneId: "Africa/Abidjan", colorScheme: ps.sombre ? "dark" : "light" });
      await c.addInitScript({ content: PREPARER });
      if (auth) await c.addCookies(cookies(session, process.env.NEXT_PUBLIC_SUPABASE_URL!));
      return c;
    };
    const ctxs = { pub: await ctx(false), auth: await ctx(true) };
    for (const e of ps.liste) {
      if (!e.chemin) { index.push({ passe: ps.passe, nom: e.nom, absent: "aucune donnée pour cet écran au moment de la capture" }); continue; }
      const page = await (e.auth === false ? ctxs.pub : ctxs.auth).newPage();
      const erreurs: string[] = [];
      page.on("console", (msg) => { if (msg.type() === "error") erreurs.push(msg.text().slice(0, 220)); });
      page.on("pageerror", (err) => erreurs.push(err.message.slice(0, 220)));
      const t0 = Date.now();
      let statut: number | null = null;
      try { statut = (await page.goto(BASE + e.chemin, { waitUntil: "networkidle", timeout: 45000 }))?.status() ?? null; }
      catch (err) { erreurs.push(`chargement : ${err instanceof Error ? err.message.slice(0, 120) : err}`); }
      const ms = Date.now() - t0;
      const anonyme = (s: string) => s.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, "<id>");
      try {
        await page.waitForTimeout(500);
        if (!e.ecranSeul) await derouler(page);
        if (e.action) await e.action(page);
        await masquer(page, noms);
        const mesures = await mesurer(page);
        const a11y = ps.passe === "petit" ? [] : await axe(page);
        await page.screenshot({ path: `${OUT}/${ps.passe}/${e.nom}.jpg`, fullPage: !e.ecranSeul, type: "jpeg", quality: 80 });
        index.push({ passe: ps.passe, nom: e.nom, chemin: anonyme(e.chemin), note: e.note ?? null, statut, arrivee: anonyme(page.url().replace(BASE, "")), ms, erreurs, ...mesures, a11y });
      } catch (err) { index.push({ passe: ps.passe, nom: e.nom, chemin: anonyme(e.chemin), statut, ms, erreurs, echec: err instanceof Error ? err.message.slice(0, 200) : String(err) }); }
      await page.close();
    }
    await ctxs.pub.close(); await ctxs.auth.close();
  }

  // Hydratation : l'accueil chargé plusieurs fois, pour compter les chargements qui lèvent une erreur de console
  const hydratation: Record<string, unknown>[] = [];
  for (const sombre of [false, true]) {
    for (let i = 0; i < 8; i++) {
      const c = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: "fr-FR", timezoneId: "Africa/Abidjan", colorScheme: sombre ? "dark" : "light" });
      await c.addCookies(cookies(session, process.env.NEXT_PUBLIC_SUPABASE_URL!));
      const page = await c.newPage();
      const erreurs: string[] = [];
      page.on("console", (msg) => { if (msg.type() === "error") erreurs.push(msg.text().slice(0, 300)); });
      page.on("pageerror", (err) => erreurs.push(err.message.slice(0, 300)));
      const t0 = Date.now();
      await page.goto(BASE + "/", { waitUntil: "load", timeout: 45000 }).catch((err) => erreurs.push(String(err).slice(0, 120)));
      await page.waitForTimeout(3500);
      hydratation.push({ theme: sombre ? "sombre" : "clair", essai: i + 1, heure: new Date().toISOString(), ms: Date.now() - t0, erreurs: erreurs.length, premiere: erreurs[0] ?? null });
      await c.close();
    }
  }
  await browser.close();
  writeFileSync(`${OUT}/index.json`, JSON.stringify({ quand: new Date().toISOString(), base: BASE, sourcesMasquees: noms.length, ecrans: index }, null, 1));
  writeFileSync(`${OUT}/hydratation.json`, JSON.stringify(hydratation, null, 1));
  console.log(`${index.length} captures, ${hydratation.filter((h) => (h.erreurs as number) > 0).length}/${hydratation.length} chargements de l'accueil avec erreur de console`);
}

if (process.argv[1]?.endsWith("audit-ecrans.ts")) main().catch((e) => { console.error(e instanceof Error ? e.message : JSON.stringify(e)); process.exit(1); });
