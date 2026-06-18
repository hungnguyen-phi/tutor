/** Provider-agnostic LLM types. No provider name leaks past this package. */

export type ModelTier = "cheap" | "default" | "strong";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  /** Hint for routing — harder tasks get a stronger model. */
  tier?: ModelTier;
  maxTokens?: number;
  temperature?: number;
  /** For budgeting + audit; never sent to the provider. */
  studentId?: string;
  /** Label of the calling agent, e.g. "guide" | "evaluate-rubric". */
  agent?: string;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmResponse {
  text: string;
  usage: LlmUsage;
  model: string;
  provider: string;
  /** True when served from cache (no provider call, no token spend). */
  cached?: boolean;
}

export interface LlmProvider {
  readonly name: string;
  /** Map an abstract tier to a concrete model id for this provider. */
  modelFor(tier: ModelTier): string;
  complete(req: LlmRequest, model: string): Promise<LlmResponse>;
}
