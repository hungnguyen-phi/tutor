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

// FULL DEEPSEEK (chủ dự án chốt 2026-07-25): flash cho việc nhẹ (đối thoại), pro cho
// việc nặng (chấm viết/nói). flash $0.094/$0.188 · pro $0.435/$0.870 per 1M, đều ctx 1M.
const MODELS: Record<Tier, string> = {
  cheap: "deepseek/deepseek-v4-flash",
  default: "deepseek/deepseek-v4-pro",
  strong: "deepseek/deepseek-v4-pro",
};
const FALLBACK = ["deepseek/deepseek-v4-flash", "deepseek/deepseek-v4-pro", "deepseek/deepseek-v3.2"];

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
  /**
   * Bật CACHE cho lượt gọi TẤT ĐỊNH (temperature 0). Hai lợi ích, cả hai đều
   * quan trọng với bài học 29/07:
   *  · TIẾT KIỆM TOKEN — cùng (đề, đáp án mẫu, bài làm) thì không gọi lại.
   *  · ỔN ĐỊNH PHÁN QUYẾT — đo trên prod: cùng chữ "ok" nộp 5 lần, mô hình trả
   *    3 lần ĐÚNG / 2 lần SAI dù temperature=0. Cache khoá kết quả lần đầu nên
   *    một bài làm không còn lúc đậu lúc trượt.
   * CHỈ dùng cho nhánh chấm; KHÔNG dùng cho đối thoại (mỗi lượt phải mới).
   */
  cache?: boolean;
}

/** Khoá cache = SHA-256 của (agent | tier | system | user). Băm để khoá ngắn,
 *  không chứa bài làm của học sinh dưới dạng đọc được (PDPL). */
async function cacheKeyOf(a: LlmCallArgs): Promise<string> {
  const raw = `${a.agent}|${a.tier ?? "default"}|${a.system}|${a.user}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
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

  // ── CACHE (chỉ nhánh chấm tất định) ───────────────────────────────────────
  // Đọc SAU khi kiểm ngân sách token ở dưới thì mất ý nghĩa (cache tồn tại để
  // KHỎI tiêu token), nhưng đọc trước thì lại lách được trần. Cách đi: đọc ở
  // đây nhưng CHỈ dùng khi chưa chạm trần — kiểm trần là một truy vấn nhẹ và
  // vẫn chạy ngay bên dưới cho cả hai nhánh.
  let ck: string | null = null;
  let cached: LlmCallResult | null = null;
  if (args.cache && args.supa) {
    try {
      ck = await cacheKeyOf(args);
      const { data: hit } = await args.supa
        .from("llm_cache")
        .select("response, created_at")
        .eq("key", ck)
        // TTL 30 ngày: nội dung câu hỏi / đáp án mẫu có thể được giáo viên sửa,
        // và một phán quyết sai không được đóng băng vĩnh viễn cho MỌI học sinh.
        .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
        .maybeSingle();
      const c = hit?.response as LlmCallResult | undefined;
      if (c && typeof c.text === "string") cached = { text: c.text, model: c.model ?? "cache", usage: { inputTokens: 0, outputTokens: 0 } };
    } catch {
      ck = ck ?? null; // cache hỏng KHÔNG được chặn việc chấm
    }
  }

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

  // Chưa chạm trần + có sẵn trong cache → trả luôn, KHÔNG tiêu token lượt này.
  if (cached) return cached;

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
      // Ghi cache TRƯỚC audit: đây là thứ lượt sau đọc để khỏi tiêu token lại.
      if (ck && text) {
        // PHẢI ghi lại created_at: upsert không kèm cột này thì ON CONFLICT giữ
        // nguyên mốc cũ ⇒ dòng quá 30 ngày là trượt TTL vĩnh viễn (mỗi lượt sau
        // đều trả tiền token rồi ghi đè mà vẫn không bao giờ đọc lại được).
        await supa.from("llm_cache").upsert(
          { key: ck, response: { text, model }, created_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      }
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
