/**
 * Deno-side LLM gateway for Edge Functions. Mirrors @tutor/llm-gateway:
 * OpenRouter (z-ai/glm-5.2 primary + ordered fallback), PDPL anonymize, audit log.
 * The ONLY place a provider/key is used in the edge runtime.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type Tier = "cheap" | "default" | "strong";

// ── Token budget: trần token/HS/ngày (PRD §9.4, giữ MVP < $500/tháng) ─────────
// Kiểm TRƯỚC khi gọi OpenRouter; chạm trần → ném BudgetExceededError thay vì tiêu
// thêm token. Đọc theo token_usage(student_id, day). Cấu hình qua env, mặc định
// 200k token/HS/ngày.
const DAILY_TOKEN_LIMIT = Number(Deno.env.get("LLM_DAILY_TOKEN_LIMIT") ?? "200000");

export class BudgetExceededError extends Error {
  constructor(
    public studentId: string,
    public limit: number,
    public spent: number,
  ) {
    super(`Token budget exceeded for ${studentId}: ${spent}/${limit}`);
    this.name = "BudgetExceededError";
  }
}

/** Khóa ngày UTC dạng YYYY-MM-DD cho cột token_usage.day (kiểu date). */
function dayKeyUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Chạy một promise ở NỀN: giữ isolate sống tới khi xong nhưng KHÔNG chặn phản
 *  hồi. Không có EdgeRuntime (vd test local) → bỏ qua an toàn. */
function runInBackground(p: Promise<unknown>): void {
  (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime?.waitUntil?.(p);
}

const MODELS: Record<Tier, string> = {
  cheap: "deepseek/deepseek-v4-flash",
  default: "z-ai/glm-5.2",
  strong: "qwen/qwen3.7-plus",
};
const FALLBACK = ["z-ai/glm-5.2", "deepseek/deepseek-v4-flash", "qwen/qwen3.7-plus"];

export interface AnonymizeResult {
  text: string;
  map: Record<string, string>;
}

/** Scrub emails/phones/ids and known names BEFORE any LLM call (PDPL). */
export function anonymize(input: string, knownNames: string[] = []): AnonymizeResult {
  const map: Record<string, string> = {};
  let text = input ?? "";
  let n = 0;
  for (const name of [...knownNames].filter(Boolean).sort((a, b) => b.length - a.length)) {
    const ph = `[NAME_${n++}]`;
    const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    if (re.test(text)) {
      text = text.replace(re, ph);
      map[ph] = name;
    }
  }
  const pats: Array<[RegExp, string]> = [
    [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "EMAIL"],
    [/(?:\+?84|0)(?:\d[\s.-]?){8,10}\d/g, "PHONE"],
    [/\b\d{9,12}\b/g, "ID"],
  ];
  for (const [re, tag] of pats) {
    text = text.replace(re, (m) => {
      const ph = `[${tag}_${n++}]`;
      map[ph] = m;
      return ph;
    });
  }
  return { text, map };
}

/** Restore placeholders for display back to the student (never sent to the LLM). */
export function rehydrate(text: string, map: Record<string, string>): string {
  let out = text;
  for (const [ph, real] of Object.entries(map)) out = out.split(ph).join(real);
  return out;
}

export interface LlmCallArgs {
  system: string;
  user: string;
  tier?: Tier;
  maxTokens?: number;
  temperature?: number;
  studentId?: string;
  agent: string;
  tenantId?: string;
  supa?: SupabaseClient;
}

export interface LlmCallResult {
  text: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

/** Tripwire: never let a raw email reach the provider. */
function assertAnonymized(s: string): void {
  if (/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/.test(s)) {
    throw new Error("llm: message contains an email — anonymize first.");
  }
}

export async function callLLM(args: LlmCallArgs): Promise<LlmCallResult> {
  assertAnonymized(args.system + "\n" + args.user);
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) throw new Error("OPENROUTER_API_KEY not set in function secrets.");

  // KIỂM TOKEN-BUDGET TRƯỚC KHI GỌI LLM: đọc tổng token HS này đã tiêu hôm nay;
  // đã chạm trần → dừng, ném lỗi budget (caller bắt để báo HS "hết lượt hôm nay")
  // thay vì đốt thêm token. Chỉ tính khi có studentId + supa (lượt ẩn danh/chẩn
  // đoán không đo ở đây).
  if (args.supa && args.studentId) {
    const day = dayKeyUTC();
    const { data: rows } = await args.supa
      .from("token_usage")
      .select("tokens")
      .eq("student_id", args.studentId)
      .eq("day", day);
    const spent = ((rows ?? []) as Array<{ tokens: number | null }>)
      .reduce((s, r) => s + (r.tokens ?? 0), 0);
    if (spent >= DAILY_TOKEN_LIMIT) {
      throw new BudgetExceededError(args.studentId, DAILY_TOKEN_LIMIT, spent);
    }
  }

  const tier: Tier = args.tier ?? "default";
  const primary = MODELS[tier];
  const dedupe = (a: string[]) => a.filter((m, i, arr) => arr.indexOf(m) === i);
  // OpenRouter caps the `models` array at 3 items.
  const models = dedupe([primary, ...FALLBACK]).slice(0, 3);
  const retryModels = dedupe(["deepseek/deepseek-v4-flash", ...models]).slice(0, 3);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  const referer = Deno.env.get("OPENROUTER_REFERER");
  const title = Deno.env.get("OPENROUTER_TITLE");
  if (referer) headers["HTTP-Referer"] = referer;
  if (title) headers["X-Title"] = title;

  const payload = (extraModels: string[]) => ({
    models: extraModels,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    max_tokens: args.maxTokens ?? 420,
    temperature: args.temperature ?? 0.3,
    // DISABLE reasoning (not just hide it): tutoring turns don't need chain-of-
    // thought, and leaving it on made glm-5.2 take ~25s. enabled:false → fast
    // responses + no CoT to leak. exclude:true kept as a belt-and-braces signal.
    reasoning: { enabled: false, exclude: true },
  });

  // ONLY use final content. Never display reasoning/CoT to a student.
  const extractText = (d: unknown): string => {
    const msg = (d as { choices?: Array<{ message?: Record<string, unknown> }> }).choices?.[0]?.message;
    return String(msg?.content ?? "").trim();
  };

  let data: Record<string, unknown> = {};
  let text = "";
  for (let attempt = 0; attempt < 2 && !text; attempt++) {
    const useModels = attempt === 0 ? models : retryModels;
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(payload(useModels)),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
    data = await res.json();
    text = extractText(data);
  }

  const model: string = (data.model as string) ?? primary;
  const usage = {
    inputTokens: (data.usage as { prompt_tokens?: number } | undefined)?.prompt_tokens ?? 0,
    outputTokens: (data.usage as { completion_tokens?: number } | undefined)?.completion_tokens ?? 0,
  };

  // Audit mọi quyết định AI (PDPL) + ĐO token đã tiêu — CHẠY NỀN (waitUntil) để
  // KHÔNG chặn phản hồi cho học sinh. Lỗi ghi nuốt im lặng: đây là nhật ký/đo
  // lường, không phải dữ liệu quyết định học tập.
  if (args.supa) {
    const supa = args.supa;
    const total = usage.inputTokens + usage.outputTokens;
    const bg = (async () => {
      await supa.from("audit_logs").insert({
        tenant_id: args.tenantId ?? null,
        actor_id: null,
        action: "ai_generation",
        subject_type: "session",
        subject_id: args.studentId ?? null,
        ai_decision: { agent: args.agent, provider: "openrouter", model, tier, usage },
      });
      // Cộng dồn token_usage cho (HS, ngày) để lần gọi sau kiểm budget có số thật.
      // Best-effort read-modify-write; đủ cho phép đo (nếu cần tuyệt đối nguyên tử
      // thì thay bằng RPC increment — TODO khi có).
      if (args.studentId && total > 0) {
        const day = dayKeyUTC();
        const { data: cur } = await supa
          .from("token_usage")
          .select("tokens")
          .eq("student_id", args.studentId)
          .eq("day", day)
          .maybeSingle();
        await supa.from("token_usage").upsert(
          {
            tenant_id: args.tenantId ?? null,
            student_id: args.studentId,
            day,
            tokens: ((cur?.tokens as number | undefined) ?? 0) + total,
          },
          { onConflict: "student_id,day" },
        );
      }
    })().catch((e) =>
      console.error("llm: ghi audit/đo token nền thất bại —", e instanceof Error ? e.message : e)
    );
    runInBackground(bg);
  }
  // TODO(streaming): khi cần trả token dần cho UI, thêm cờ args.stream để trả
  // ReadableStream từ OpenRouter (stream:true) thay vì gom hết rồi trả một cục.
  return { text, model, usage };
}
