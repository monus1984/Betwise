/**
 * Couche LLM : une interface, un fournisseur (Claude) pour l'instant.
 * Tout appel passe par ici, côté serveur uniquement. Le navigateur ne voit jamais de clé.
 */
import Anthropic from "@anthropic-ai/sdk";

export type LlmImage = { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string };

export type ExtractCall = {
  system: string;
  user: string;
  images?: LlmImage[];
  /** Schéma JSON de la réponse attendue ; le fournisseur force une sortie conforme. */
  schema: Record<string, unknown>;
  maxTokens?: number;
};

export type ExtractResult = { json: unknown; tokensIn: number; tokensOut: number; model: string };

export type ChatTool = { name: string; description: string; input_schema: Record<string, unknown> };
export type ChatTurn = { role: "user" | "assistant"; text: string };
export type ToolTrace = { name: string; input: unknown; output: unknown; ms: number };
export type ChatCall = {
  system: string;
  history: ChatTurn[];
  tools: ChatTool[];
  /** Exécute un outil côté serveur ; le retour est envoyé tel quel au modèle (JSON). */
  run: (name: string, input: Record<string, unknown>) => Promise<unknown>;
  maxRounds?: number;
  maxTokens?: number;
};
export type ChatResult = { text: string; trace: ToolTrace[]; tokensIn: number; tokensOut: number; model: string };

export interface LlmProvider {
  extract(call: ExtractCall): Promise<ExtractResult>;
  chat(call: ChatCall): Promise<ChatResult>;
}

/** Modèle léger pour l'extraction (lecture de tickets), un plus complet pour les analyses du coach. */
const MODELS = {
  extract: process.env.LLM_MODEL_EXTRACT ?? "claude-haiku-5-5",
  analyze: process.env.LLM_MODEL_ANALYZE ?? "claude-sonnet-5-5",
};

class ClaudeProvider implements LlmProvider {
  private client: Anthropic;
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async extract(call: ExtractCall): Promise<ExtractResult> {
    const content: Anthropic.ContentBlockParam[] = [];
    for (const img of call.images ?? []) {
      content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } });
    }
    content.push({ type: "text", text: call.user });

    // Sortie structurée par appel d'outil : le modèle doit remplir le schéma, rien d'autre.
    const res = await this.client.messages.create({
      model: MODELS.extract,
      max_tokens: call.maxTokens ?? 2048,
      system: call.system,
      messages: [{ role: "user", content }],
      tools: [{ name: "emit", description: "Renvoie l'extraction structurée.", input_schema: call.schema as Anthropic.Tool["input_schema"] }],
      tool_choice: { type: "tool", name: "emit" },
    });
    const tool = res.content.find((c) => c.type === "tool_use");
    if (!tool || tool.type !== "tool_use") throw new Error("Le modèle n'a pas renvoyé de sortie structurée");
    return { json: tool.input, tokensIn: res.usage.input_tokens, tokensOut: res.usage.output_tokens, model: res.model };
  }

  async chat(call: ChatCall): Promise<ChatResult> {
    const messages: Anthropic.MessageParam[] = call.history.map((t) => ({ role: t.role, content: t.text }));
    const trace: ToolTrace[] = [];
    let tokensIn = 0, tokensOut = 0, model: string = MODELS.analyze;
    const rounds = call.maxRounds ?? 6;

    for (let round = 0; round <= rounds; round++) {
      const res = await this.client.messages.create({
        model: MODELS.analyze,
        max_tokens: call.maxTokens ?? 1500,
        system: call.system,
        messages,
        tools: call.tools as Anthropic.Tool[],
        // au dernier tour, plus d'outil : il doit conclure avec ce qu'il a
        tool_choice: round === rounds ? { type: "none" } : { type: "auto" },
      });
      tokensIn += res.usage.input_tokens; tokensOut += res.usage.output_tokens; model = res.model;
      const uses = res.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
      if (res.stop_reason !== "tool_use" || uses.length === 0) {
        const text = res.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map((c) => c.text).join("\n").trim();
        return { text, trace, tokensIn, tokensOut, model };
      }
      messages.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const u of uses) {
        const t0 = Date.now();
        let output: unknown, isError = false;
        try { output = await call.run(u.name, (u.input ?? {}) as Record<string, unknown>); }
        catch (e) { output = { erreur: e instanceof Error ? e.message : String(e) }; isError = true; }
        trace.push({ name: u.name, input: u.input, output, ms: Date.now() - t0 });
        results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(output), is_error: isError });
      }
      messages.push({ role: "user", content: results });
    }
    return { text: "Je n’ai pas pu terminer l’analyse, reformule ta question plus précisément.", trace, tokensIn, tokensOut, model };
  }
}

let cached: LlmProvider | null = null;
export function getLlm(): LlmProvider {
  if (cached) return cached;
  const provider = process.env.LLM_PROVIDER ?? "claude";
  if (provider !== "claude") throw new Error(`LLM_PROVIDER inconnu : ${provider}`);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY manquant");
  cached = new ClaudeProvider(key);
  return cached;
}
