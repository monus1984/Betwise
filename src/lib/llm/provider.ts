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

export interface LlmProvider {
  extract(call: ExtractCall): Promise<ExtractResult>;
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
