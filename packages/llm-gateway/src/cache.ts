/**
 * Simple prompt→response cache for frequently-asked turns (PRD §9.4).
 * Pluggable store; M1 can back it with Supabase or KV. In-memory default for dev.
 */
import type { LlmRequest, LlmResponse } from "./types.js";

export interface CacheStore {
  get(key: string): Promise<LlmResponse | null>;
  set(key: string, value: LlmResponse, ttlSeconds?: number): Promise<void>;
}

/** Deterministic cache key from the request (excludes studentId/PII). */
export function cacheKey(req: LlmRequest): string {
  const basis = JSON.stringify({
    messages: req.messages,
    tier: req.tier ?? "default",
    maxTokens: req.maxTokens ?? null,
    temperature: req.temperature ?? null,
  });
  return fnv1a(basis);
}

export class MemoryCacheStore implements CacheStore {
  private m = new Map<string, LlmResponse>();
  async get(key: string): Promise<LlmResponse | null> {
    return this.m.get(key) ?? null;
  }
  async set(key: string, value: LlmResponse): Promise<void> {
    this.m.set(key, value);
  }
}

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
