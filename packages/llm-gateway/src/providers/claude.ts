/**
 * Claude provider adapter — the ONLY file that knows Anthropic specifics.
 * Model ids per the latest Claude family (default provider).
 */
import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider, LlmRequest, LlmResponse, ModelTier } from "../types.js";

const MODELS: Record<ModelTier, string> = {
  cheap: "claude-haiku-4-5",
  default: "claude-sonnet-4-6",
  strong: "claude-opus-4-8",
};

export interface ClaudeProviderOptions {
  apiKey: string;
  /** Override tier→model mapping if needed. */
  models?: Partial<Record<ModelTier, string>>;
}

export class ClaudeProvider implements LlmProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private models: Record<ModelTier, string>;

  constructor(opts: ClaudeProviderOptions) {
    if (!opts.apiKey) throw new Error("ClaudeProvider: missing ANTHROPIC_API_KEY");
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.models = { ...MODELS, ...(opts.models ?? {}) };
  }

  modelFor(tier: ModelTier): string {
    return this.models[tier];
  }

  async complete(req: LlmRequest, model: string): Promise<LlmResponse> {
    const system = req.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const messages = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const res = await this.client.messages.create({
      model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.3,
      ...(system ? { system } : {}),
      messages,
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return {
      text,
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      },
      model,
      provider: this.name,
    };
  }
}
