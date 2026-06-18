/**
 * OpenRouter provider adapter — OpenAI-compatible aggregator.
 * Lets the pilot run on FREE models (the `:free` catalog) with a single key,
 * and swap to paid/better models later without touching business logic.
 *
 * fetch-based so it runs in both Node (gateway tests) and Deno (Edge Functions).
 * Free model ids change over time — override via `models` if a model is retired.
 */
import type { LlmProvider, LlmRequest, LlmResponse, ModelTier } from "../types.js";

const FREE_MODELS: Record<ModelTier, string> = {
  cheap: "meta-llama/llama-3.3-70b-instruct:free",
  default: "google/gemini-2.0-flash-exp:free",
  strong: "deepseek/deepseek-r1:free",
};

export interface OpenRouterOptions {
  apiKey: string;
  models?: Partial<Record<ModelTier, string>>;
  /** Optional attribution headers (recommended by OpenRouter). */
  referer?: string;
  title?: string;
  baseUrl?: string;
}

interface OpenRouterResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
  model?: string;
  error?: { message: string };
}

export class OpenRouterProvider implements LlmProvider {
  readonly name = "openrouter";
  private models: Record<ModelTier, string>;
  private baseUrl: string;

  constructor(private opts: OpenRouterOptions) {
    if (!opts.apiKey) throw new Error("OpenRouterProvider: missing OPENROUTER_API_KEY");
    this.models = { ...FREE_MODELS, ...(opts.models ?? {}) };
    this.baseUrl = opts.baseUrl ?? "https://openrouter.ai/api/v1";
  }

  modelFor(tier: ModelTier): string {
    return this.models[tier];
  }

  async complete(req: LlmRequest, model: string): Promise<LlmResponse> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.opts.apiKey}`,
      "Content-Type": "application/json",
    };
    if (this.opts.referer) headers["HTTP-Referer"] = this.opts.referer;
    if (this.opts.title) headers["X-Title"] = this.opts.title;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.3,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 500)}`);
    }

    const data = (await res.json()) as OpenRouterResponse;
    if (data.error) throw new Error(`OpenRouter error: ${data.error.message}`);

    const text = data.choices?.[0]?.message?.content ?? "";
    return {
      text,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      model: data.model ?? model,
      provider: this.name,
    };
  }
}
