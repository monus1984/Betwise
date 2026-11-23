/**
 * Conseil d'IA (23/11) : une question posée dans une issue GitHub (commentaire « /conseil … » ou étiquette « conseil »)
 * part en parallèle à plusieurs modèles par OpenRouter. Claude en fait ensuite la synthèse, et le tout est publié dans
 * la même issue. Les modèles ne reçoivent que le fil de l'issue et les fichiers du dépôt cités avec @chemin :
 * aucune clé, aucune donnée de la base. Le dépôt est public : ne rien écrire de privé dans une consultation.
 *
 * Fichiers : « @chemin » (branche main) ou « @branche:chemin ».
 * Panels : « /conseil » (grands modèles), « /conseil gratuit » (modèles gratuits d'OpenRouter), ou une liste,
 * ex. « /conseil chatgpt,grok ».
 * Variables : GITHUB_TOKEN, GITHUB_REPOSITORY, ISSUE, DECLENCHEUR (texte du commentaire), OPENROUTER_API_KEY, ANTHROPIC_API_KEY.
 */
import { existsSync, readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

export const PANELS: Record<string, Record<string, string>> = {
  grands: { ChatGPT: "openai/gpt-6.2-sol", Gemini: "google/gemini-4-carbon", Grok: "x-ai/grok-4.7", DeepSeek: "deepseek/deepseek-v4.1-flash-1017" },
  // Gemma 4 gratuit renvoyait « Provider returned error » le 23/11 : retiré
  gratuit: { Nemotron: "nvidia/nemotron-3-ultra-550b-a55b:free", "Routeur gratuit": "openrouter/free" },
};
const TOUS = { ...PANELS.grands, ...PANELS.gratuit } as Record<string, string>;
const MAX_SORTIE = 6000; // les modèles qui réfléchissent avant de répondre ont besoin de marge (23/11)
const MAX_FICHIER = 40_000;

/** Lit « /conseil [panel|liste] [question] » ; sans question, c'est le fil de l'issue qui fait foi. */
export function lireDemande(texte: string): { modeles: Record<string, string>; question: string } {
  const m = texte.trim().match(/^\/conseil(?:\s+(\S+))?([\s\S]*)$/i);
  const arg = (m?.[1] ?? "").toLowerCase(), reste = (m?.[2] ?? "").trim();
  if (!arg) return { modeles: PANELS.grands, question: reste };
  if (PANELS[arg]) return { modeles: PANELS[arg], question: reste };
  const choisis = Object.fromEntries(Object.entries(TOUS).filter(([nom]) => arg.split(",").includes(nom.toLowerCase())));
  return Object.keys(choisis).length ? { modeles: choisis, question: reste } : { modeles: PANELS.grands, question: `${m?.[1] ?? ""} ${reste}`.trim() };
}

const interdit = (c: string) => /(^|\/)\.env|secret|\.pem$|\.key$/i.test(c) || c.includes("..");
/** Fichiers du dépôt cités avec @chemin (branche main) ou @branche:chemin (lecture seule, taille limitée, jamais de secrets). */
export function fichiersCites(texte: string): { chemin: string; contenu: string }[] {
  return citations(texte).filter((c) => !c.branche && !interdit(c.chemin) && existsSync(c.chemin))
    .map(({ chemin }) => ({ chemin, contenu: readFileSync(chemin, "utf8").slice(0, MAX_FICHIER) }));
}
export function citations(texte: string): { branche: string | null; chemin: string }[] {
  const vus = new Set<string>(), out: { branche: string | null; chemin: string }[] = [];
  for (const x of texte.matchAll(/@(?:([\w.-]+):)?([\w./-]+\.\w+)/g)) {
    const k = `${x[1] ?? ""}:${x[2]}`; if (vus.has(k)) continue; vus.add(k); out.push({ branche: x[1] ?? null, chemin: x[2] });
  }
  return out.slice(0, 6);
}
/** Fichiers cités sur une autre branche, lus par l'API GitHub. */
async function fichiersAutresBranches(texte: string) {
  const out: { chemin: string; contenu: string }[] = [];
  for (const c of citations(texte).filter((c) => c.branche && !interdit(c.chemin))) {
    try {
      const j = await gh(`/contents/${c.chemin}?ref=${encodeURIComponent(c.branche!)}`) as { content?: string };
      if (j.content) out.push({ chemin: `${c.branche}:${c.chemin}`, contenu: Buffer.from(j.content, "base64").toString("utf8").slice(0, MAX_FICHIER) });
    } catch { /* fichier absent : ignoré */ }
  }
  return out;
}

const gh = async (chemin: string, init?: RequestInit) => {
  const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${chemin}`, { ...init,
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" } });
  if (!r.ok) throw new Error(`GitHub ${r.status} sur ${chemin}`);
  return r.json();
};

type Reponse = { nom: string; modele: string; texte: string; cout: number | null; ms: number; erreur?: string };

async function demander(nom: string, modele: string, prompt: string): Promise<Reponse> {
  const t0 = Date.now();
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modele, max_tokens: MAX_SORTIE, messages: [{ role: "user", content: prompt }] }) });
    const j = await r.json() as { model?: string; usage?: { cost?: number }; choices?: { message?: { content?: string | null }; finish_reason?: string }[]; error?: { message?: string } };
    const texte = j.choices?.[0]?.message?.content?.trim();
    if (!r.ok || !texte) return { nom, modele, texte: "", cout: j.usage?.cost ?? null, ms: Date.now() - t0, erreur: j.error?.message ?? `pas de réponse (${j.choices?.[0]?.finish_reason ?? r.status})` };
    return { nom, modele: j.model ?? modele, texte, cout: j.usage?.cost ?? null, ms: Date.now() - t0 };
  } catch (e) { return { nom, modele, texte: "", cout: null, ms: Date.now() - t0, erreur: e instanceof Error ? e.message : String(e) }; }
}

async function main() {
  const num = Number(process.env.ISSUE);
  if (!num || !process.env.OPENROUTER_API_KEY) throw new Error("ISSUE ou OPENROUTER_API_KEY manquant");
  const issue = await gh(`/issues/${num}`) as { title: string; body: string | null };
  const commentaires = (await gh(`/issues/${num}/comments?per_page=100`) as { user: { login: string }; body: string }[])
    .filter((c) => !c.body.startsWith("<!-- conseil-ia -->")).slice(-8);
  const { modeles, question } = lireDemande(process.env.DECLENCHEUR || "/conseil");
  const fil = [`# ${issue.title}`, issue.body ?? "", ...commentaires.map((c) => `--- commentaire de ${c.user.login} ---\n${c.body}`)].join("\n\n");
  const fichiers = [...fichiersCites(`${fil}\n${question}`), ...await fichiersAutresBranches(`${fil}\n${question}`)];
  const prompt = [
    "Tu fais partie d'un conseil de plusieurs IA consulté par Mounir, porteur de projets à Abidjan (BETWISE : application d'analyse de paris sportifs, Next.js + Supabase, une vingtaine de testeurs). Claude, qui développe le projet, fera la synthèse des avis.",
    "Donne ton avis indépendant, en français, concret et critique : ce qui est juste, ce qui est faux ou manquant, les risques, et ta recommandation n°1. 15 lignes au plus. Pas de flatterie, et dis-le quand tu n'es pas sûr.",
    question ? `Question posée : ${question}` : "La question est dans le fil ci-dessous.",
    `Fil de discussion :\n${fil.slice(0, 30_000)}`,
    ...fichiers.map((f) => `Fichier ${f.chemin} :\n${f.contenu}`),
  ].join("\n\n");

  const reponses = await Promise.all(Object.entries(modeles).map(([nom, modele]) => demander(nom, modele, prompt)));
  const valides = reponses.filter((r) => !r.erreur);

  // Synthèse par Claude : convergences, désaccords, et ce qu'il propose d'en retenir
  let synthese = "", coutSynthese: number | null = null;
  if (process.env.ANTHROPIC_API_KEY && valides.length) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({ model: process.env.CLAUDE_TIPSTER_MODEL || "claude-sonnet-5-5", max_tokens: 1500,
      messages: [{ role: "user", content: `Voici la question et les avis de plusieurs IA. Les IA ont lu le fil et, s'il y en a, ces fichiers : ${fichiers.map((f) => f.chemin).join(", ") || "aucun"} (tu ne les as pas sous les yeux). Fais-en la synthèse pour Mounir, en français, 12 lignes au plus : points d'accord, désaccords, ce qui te semble faux, et ce que tu proposes de retenir. Ne répète pas les avis.\n\nQuestion : ${question || issue.title}\n\n${valides.map((r) => `### ${r.nom}\n${r.texte}`).join("\n\n")}` }] });
    synthese = res.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map((c) => c.text).join("\n").trim();
    coutSynthese = Math.round((res.usage.input_tokens * 2e-6 + res.usage.output_tokens * 1e-5) * 10000) / 10000;
  }
  const total = reponses.reduce((s, r) => s + (r.cout ?? 0), 0) + (coutSynthese ?? 0);
  const corps = [
    "<!-- conseil-ia -->",
    `## Conseil d'IA — ${Object.keys(modeles).join(", ")}`,
    synthese ? `### Synthèse de Claude\n${synthese}` : "_Pas de synthèse : aucune réponse exploitable ou clé Anthropic absente._",
    ...reponses.map((r) => `<details><summary><b>${r.nom}</b> (${r.modele}) — ${r.erreur ? `pas de réponse : ${r.erreur}` : `${Math.round(r.ms / 1000)} s`}${r.cout !== null ? `, ${r.cout.toFixed(4)} $` : ""}</summary>\n\n${r.texte || "—"}\n\n</details>`),
    `Coût total : **${total.toFixed(4)} $**${fichiers.length ? ` · fichiers lus : ${fichiers.map((f) => `\`${f.chemin}\``).join(", ")}` : ""}`,
  ].join("\n\n");
  await gh(`/issues/${num}/comments`, { method: "POST", body: JSON.stringify({ body: corps }) });
  console.log(`Conseil publié sur l'issue #${num} : ${valides.length}/${reponses.length} réponse(s), ${total.toFixed(4)} $.`);
}

if (process.argv[1]?.endsWith("conseil-ia.ts")) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
