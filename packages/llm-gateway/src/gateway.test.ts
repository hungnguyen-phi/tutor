import { describe, it, expect, vi } from "vitest";
import { LlmGateway, assertAnonymized } from "./router.js";
import { TokenBudget, BudgetExceededError, type BudgetStore } from "./budget.js";
import { MemoryCacheStore } from "./cache.js";
import { anonymize } from "./anonymize.js";
import type { LlmProvider, LlmRequest, LlmResponse } from "./types.js";

class FakeProvider implements LlmProvider {
  readonly name = "fake";
  calls = 0;
  modelFor() {
    return "fake-model";
  }
  async complete(_req: LlmRequest, model: string): Promise<LlmResponse> {
    this.calls++;
    return {
      text: "Em thử nói lại bước đầu tiên của mình xem?",
      usage: { inputTokens: 10, outputTokens: 8 },
      model,
      provider: this.name,
    };
  }
}

class MemoryBudgetStore implements BudgetStore {
  private m = new Map<string, number>();
  async getSpent(s: string, d: string) {
    return this.m.get(`${s}:${d}`) ?? 0;
  }
  async addSpent(s: string, d: string, t: number) {
    this.m.set(`${s}:${d}`, (this.m.get(`${s}:${d}`) ?? 0) + t);
  }
}

const guideReq = (studentId: string): LlmRequest => ({
  agent: "guide",
  studentId,
  messages: [
    { role: "system", content: "Bạn là Tutor, dẫn dắt Socratic, không cho đáp án." },
    { role: "user", content: "Đỉnh parabol y=x^2-4x+3 ở đâu ạ?" },
  ],
});

describe("anonymize (PDPL)", () => {
  it("scrubs email, phone, and known names before LLM", () => {
    const { text } = anonymize(
      "Em Nguyễn Văn An, email an@example.com, sđt 0901234567",
      ["Nguyễn Văn An"],
    );
    expect(text).not.toContain("an@example.com");
    expect(text).not.toContain("0901234567");
    expect(text).not.toContain("Nguyễn Văn An");
  });
});

describe("assertAnonymized tripwire", () => {
  it("throws if an email reaches the gateway", () => {
    expect(() =>
      assertAnonymized({ messages: [{ role: "user", content: "x@y.com" }] }),
    ).toThrow();
  });
});

describe("TokenBudget", () => {
  it("blocks once the daily limit is reached", async () => {
    const budget = new TokenBudget(new MemoryBudgetStore(), {
      dailyTokenLimit: 15,
      dayKey: () => "2026-06-18",
    });
    await budget.assertWithinBudget("stu1"); // ok at 0
    await budget.record("stu1", 20); // over
    await expect(budget.assertWithinBudget("stu1")).rejects.toBeInstanceOf(
      BudgetExceededError,
    );
  });
});

describe("LlmGateway", () => {
  it("caches: second identical request makes no provider call and spends 0", async () => {
    const provider = new FakeProvider();
    const audits: unknown[] = [];
    const gateway = new LlmGateway({
      providers: [provider],
      defaultProvider: "fake",
      cache: new MemoryCacheStore(),
      onAudit: (e) => void audits.push(e),
    });

    const a = await gateway.complete(guideReq("stu1"));
    const b = await gateway.complete(guideReq("stu1"));

    expect(provider.calls).toBe(1);
    expect(a.cached).toBeUndefined();
    expect(b.cached).toBe(true);
    expect(audits).toHaveLength(2);
  });

  it("enforces budget before calling the provider", async () => {
    const provider = new FakeProvider();
    const budget = new TokenBudget(new MemoryBudgetStore(), {
      dailyTokenLimit: 5,
      dayKey: () => "2026-06-18",
    });
    await budget.record("stu2", 10); // already over
    const gateway = new LlmGateway({
      providers: [provider],
      defaultProvider: "fake",
      budget,
    });
    await expect(gateway.complete(guideReq("stu2"))).rejects.toBeInstanceOf(
      BudgetExceededError,
    );
    expect(provider.calls).toBe(0);
  });
});
