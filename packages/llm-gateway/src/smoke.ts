/**
 * Live gateway smoke test — one real Socratic call through OpenRouter (free model).
 * Run after putting OPENROUTER_API_KEY in .env:
 *   node --env-file=../../.env --import tsx packages/llm-gateway/src/smoke.ts
 * or from the package: pnpm --filter @tutor/llm-gateway smoke
 */
import { LlmGateway } from "./router.js";
import { MemoryCacheStore } from "./cache.js";
import { anonymize } from "./anonymize.js";
import { OpenRouterProvider } from "./providers/openrouter.js";

const key = process.env.OPENROUTER_API_KEY;
if (!key) {
  console.error("✗ OPENROUTER_API_KEY not set. Add it to .env first (https://openrouter.ai/keys).");
  process.exit(1);
}

const gateway = new LlmGateway({
  providers: [
    new OpenRouterProvider({
      apiKey: key,
      referer: process.env.OPENROUTER_REFERER,
      title: process.env.OPENROUTER_TITLE,
    }),
  ],
  defaultProvider: "openrouter",
  cache: new MemoryCacheStore(),
  onAudit: (e) =>
    console.log(
      `· audit: provider=${e.provider} model=${e.model} tier=${e.tier} ` +
        `in=${e.usage.inputTokens} out=${e.usage.outputTokens} cached=${e.cached}`,
    ),
});

// Anonymize the student message before it leaves (PDPL).
const studentName = "Nguyễn Văn An";
const { text: safeMsg } = anonymize(
  `Em ${studentName} chưa tìm được đỉnh của parabol y = x^2 - 4x + 3.`,
  [studentName],
);

const res = await gateway.complete({
  agent: "guide",
  studentId: "smoke-student",
  tier: "default",
  messages: [
    {
      role: "system",
      content:
        "Bạn là Tutor của Trường Việt Anh. Dẫn dắt kiểu Socratic, KHÔNG cho đáp án trực tiếp. " +
        "Đặt đúng MỘT câu hỏi gợi mở ngắn để học sinh tự tiến thêm một bước.",
    },
    { role: "user", content: safeMsg },
  ],
});

console.log("\n— Tutor (guide) —\n" + res.text + "\n");

// Sanity: a guiding question should not blurt the answer "(2, -1)".
if (/\(?\s*2\s*,\s*-?\s*1\s*\)?/.test(res.text)) {
  console.warn("⚠ response may have leaked the vertex — check the system prompt / model.");
} else {
  console.log("✓ no obvious answer leak in the guiding turn.");
}
