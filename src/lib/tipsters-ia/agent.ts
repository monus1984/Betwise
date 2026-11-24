/**
 * Boucle d'agent d'un tipster IA : le modèle appelle des outils de lecture autant qu'il en a besoin (dans une limite
 * de tours), puis rend sa décision avec l'outil « decision ». Deux familles de fournisseurs :
 *  - Anthropic (Claude), par le SDK officiel ;
 *  - format compatible OpenAI (OpenAI, OpenRouter, Gemini), par HTTP.
 * Aucun secret n'est écrit dans le journal ni dans les rapports.
 */
import Anthropic from "@anthropic-ai/sdk";

export type Outil = { name: string; description: string; input_schema: Record<string, unknown> };
export type Decision = { paris: { option: string; mise: number; probabilite: number; raison: string }[]; combines?: { options: string[]; mise: number; probabilite: number; raison: string }[]; abstention?: string; carnet?: string };
export type Trace = { outil: string; entree: unknown; ms: number };
export type Resultat = { decision: Decision | null; modele: string; tours: number; traces: Trace[]; jetons: { entree: number; sortie: number; cacheLu: number; cacheEcrit: number }; erreur?: string };
export type Profil = {
  id: string; nom: string; fournisseur: "anthropic" | "openai-compatible";
  modele: string; cle: string | undefined; baseUrl?: string;
  /** Allers-retours maximum avec les outils (DeepSeek tournait en rond : 13 le 23/11). */
  maxTours?: number;
};

const MAX_TOURS = 14;
const MAX_SORTIE = 4000;

export async function lancerAgent(p: Profil, systeme: string, consigne: string, outils: readonly Outil[], executer: (nom: string, entree: Record<string, unknown>) => Promise<unknown>): Promise<Resultat> {
  return p.fournisseur === "anthropic" ? agentAnthropic(p, systeme, consigne, outils, executer) : agentOpenAI(p, systeme, consigne, outils, executer);
}

async function agentAnthropic(p: Profil, systeme: string, consigne: string, outils: readonly Outil[], executer: (nom: string, entree: Record<string, unknown>) => Promise<unknown>): Promise<Resultat> {
  const client = new Anthropic({ apiKey: p.cle });
  // Consignes et outils identiques d'un tour à l'autre : mis en cache pour réduire le coût
  const tools = outils.map((o, i) => ({ ...o, ...(i === outils.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}) })) as Anthropic.Tool[];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: consigne }];
  const r: Resultat = { decision: null, modele: p.modele, tours: 0, traces: [], jetons: { entree: 0, sortie: 0, cacheLu: 0, cacheEcrit: 0 } };
  for (const max = p.maxTours ?? MAX_TOURS; r.tours < max; r.tours++) {
    const derniers = r.tours === max - 1;
    const res = await client.messages.create({
      model: p.modele, max_tokens: MAX_SORTIE,
      system: [{ type: "text", text: systeme, cache_control: { type: "ephemeral" } }],
      tools, messages,
      ...(derniers ? { tool_choice: { type: "tool", name: "decision" } } : {}),
    });
    r.modele = res.model;
    r.jetons.entree += res.usage.input_tokens; r.jetons.sortie += res.usage.output_tokens;
    r.jetons.cacheLu += res.usage.cache_read_input_tokens ?? 0; r.jetons.cacheEcrit += res.usage.cache_creation_input_tokens ?? 0;
    messages.push({ role: "assistant", content: res.content });
    const appels = res.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    const fin = appels.find((c) => c.name === "decision");
    if (fin) { r.decision = fin.input as Decision; return r; }
    if (!appels.length) {
      messages.push({ role: "user", content: "Rends maintenant ta décision avec l'outil decision (tu peux ne rien jouer)." });
      continue;
    }
    const resultats: Anthropic.ToolResultBlockParam[] = [];
    for (const a of appels) {
      const t0 = Date.now();
      const sortie = await executer(a.name, (a.input ?? {}) as Record<string, unknown>).catch((e) => ({ erreur: e instanceof Error ? e.message : String(e) }));
      r.traces.push({ outil: a.name, entree: a.input, ms: Date.now() - t0 });
      resultats.push({ type: "tool_result", tool_use_id: a.id, content: JSON.stringify(sortie) });
    }
    messages.push({ role: "user", content: resultats });
  }
  r.erreur = "aucune décision après le nombre maximal de tours";
  return r;
}

type MsgOA = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[]; tool_call_id?: string };

async function agentOpenAI(p: Profil, systeme: string, consigne: string, outils: readonly Outil[], executer: (nom: string, entree: Record<string, unknown>) => Promise<unknown>): Promise<Resultat> {
  const tools = outils.map((o) => ({ type: "function", function: { name: o.name, description: o.description, parameters: o.input_schema } }));
  const messages: MsgOA[] = [{ role: "system", content: systeme }, { role: "user", content: consigne }];
  const r: Resultat = { decision: null, modele: p.modele, tours: 0, traces: [], jetons: { entree: 0, sortie: 0, cacheLu: 0, cacheEcrit: 0 } };
  const seuleDecision = tools.filter((t) => t.function.name === "decision");
  for (const max = p.maxTours ?? MAX_TOURS; r.tours < max; r.tours++) {
    // Les deux derniers tours, seul l'outil decision est proposé : certains modèles (DeepSeek, 23/11) ignorent tool_choice
    const derniers = r.tours >= max - 2;
    if (r.tours === max - 2) messages.push({ role: "user", content: "Fin de l'analyse : rends maintenant ta décision avec l'outil decision (tu peux ne rien jouer)." });
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST", headers: { Authorization: `Bearer ${p.cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: p.modele, messages, tools: derniers ? seuleDecision : tools, max_tokens: MAX_SORTIE, ...(derniers ? { tool_choice: { type: "function", function: { name: "decision" } } } : {}) }),
    });
    const j = await res.json() as { model?: string; error?: { message?: string }; usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }; choices?: { message: MsgOA }[] };
    if (!res.ok) { r.erreur = `API ${res.status} : ${j.error?.message ?? "erreur sans détail"}`.slice(0, 300); return r; }
    if (j.model) r.modele = j.model;
    r.jetons.entree += j.usage?.prompt_tokens ?? 0; r.jetons.sortie += j.usage?.completion_tokens ?? 0; r.jetons.cacheLu += j.usage?.prompt_tokens_details?.cached_tokens ?? 0;
    const msg = j.choices?.[0]?.message;
    if (!msg) { r.erreur = "réponse sans message"; return r; }
    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
    const appels = msg.tool_calls ?? [];
    const fin = appels.find((c) => c.function.name === "decision");
    if (fin) {
      try { r.decision = JSON.parse(fin.function.arguments) as Decision; } catch { r.erreur = "décision illisible (JSON invalide)"; }
      return r;
    }
    if (!appels.length) {
      // Décision écrite en texte plutôt que par l'outil : on la reprend si elle est lisible
      const brut = (msg.content ?? "").match(/\{[\s\S]*"paris"[\s\S]*\}/)?.[0];
      if (brut) try { r.decision = JSON.parse(brut) as Decision; return r; } catch { /* pas un JSON complet */ }
      messages.push({ role: "user", content: "Rends maintenant ta décision avec l'outil decision (tu peux ne rien jouer)." }); continue;
    }
    for (const a of appels) {
      // Aux derniers tours, certains modèles appellent encore un outil retiré de la liste (DeepSeek, 24/11) :
      // on ne l'exécute pas, on répond que seule la décision reste possible.
      if (derniers) { messages.push({ role: "tool", tool_call_id: a.id, content: JSON.stringify({ erreur: "Cet outil n'est plus disponible. Rends ta décision avec l'outil decision (tu peux ne rien jouer)." }) }); continue; }
      const t0 = Date.now();
      let entree: Record<string, unknown> = {};
      try { entree = JSON.parse(a.function.arguments || "{}"); } catch { /* entrée illisible : l'outil répondra par une erreur */ }
      const sortie = await executer(a.function.name, entree).catch((e) => ({ erreur: e instanceof Error ? e.message : String(e) }));
      r.traces.push({ outil: a.function.name, entree, ms: Date.now() - t0 });
      messages.push({ role: "tool", tool_call_id: a.id, content: JSON.stringify(sortie) });
    }
  }
  r.erreur = "aucune décision après le nombre maximal de tours";
  return r;
}
