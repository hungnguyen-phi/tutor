/**
 * Model Router / LLM Gateway (MANDATORY, PRD §9.3, Q19).
 * Ties together: provider selection · budget · cache · audit hook.
 * Anonymization is the CALLER's responsibility before building the request
 * (so the gateway never sees raw PII); `assertAnonymized` is a tripwire.
 */
import type { LlmProvider, LlmRequest, LlmResponse, ModelTier } from "./types.js";
import { TokenBudget } from "./budget.js";
import { type CacheStore, cacheKey } from "./cache.js";

export interface AuditEvent {
  studentId?: string;
  agent?: string;
  provider: string;
  model: string;
  tier: ModelTier;
  usage: { inputTokens: number; outputTokens: number };
  cached: boolean;
}

export interface GatewayOptions {
  providers: LlmProvider[];
  /** Name of the default provider (e.g. "anthropic"). */
  defaultProvider: string;
  budget?: TokenBudget;
  cache?: CacheStore;
  /** Sink for audit_logs rows (AI decisions). */
  onAudit?: (e: AuditEvent) => void | Promise<void>;
}

export class LlmGateway {
  private byName: Map<string, LlmProvider>;
  constructor(private opts: GatewayOptions) {
    this.byName = new Map(opts.providers.map((p) => [p.name, p]));
    if (!this.byName.has(opts.defaultProvider)) {
      throw new Error(`Default provider not registered: ${opts.defaultProvider}`);
    }
  }

  private pickProvider(_req: LlmRequest): LlmProvider {
    // Phase 1: single provider. Routing by cost/availability/privacy lands at M6.
    return this.byName.get(this.opts.defaultProvider)!;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    assertAnonymized(req);
    const tier: ModelTier = req.tier ?? "default";

    // Cache hit → no provider call, no token spend.
    if (this.opts.cache) {
      const hit = await this.opts.cache.get(cacheKey(req));
      if (hit) {
        await this.opts.onAudit?.({
          studentId: req.studentId,
          agent: req.agent,
          provider: hit.provider,
          model: hit.model,
          tier,
          usage: { inputTokens: 0, outputTokens: 0 },
          cached: true,
        });
        return { ...hit, cached: true };
      }
    }

    if (this.opts.budget) await this.opts.budget.assertWithinBudget(req.studentId ?? "");

    const provider = this.pickProvider(req);
    const model = provider.modelFor(tier);
    const res = await provider.complete(req, model);

    if (this.opts.budget) {
      await this.opts.budget.record(
        req.studentId ?? "",
        res.usage.inputTokens + res.usage.outputTokens,
      );
    }
    if (this.opts.cache) await this.opts.cache.set(cacheKey(req), res);
    await this.opts.onAudit?.({
      studentId: req.studentId,
      agent: req.agent,
      provider: res.provider,
      model: res.model,
      tier,
      usage: res.usage,
      cached: false,
    });

    return res;
  }
}

/** Tripwire: refuse obvious raw PII (emails/phones) reaching the gateway. */
export function assertAnonymized(req: LlmRequest): void {
  const blob = req.messages.map((m) => m.content).join("\n");
  if (/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/.test(blob)) {
    throw new Error("LlmGateway: request contains an email — anonymize before sending.");
  }
}
