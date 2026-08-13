import { boGachNgang } from "./text.ts";
// CORS dùng chung. MẶC ĐỊNH AN TOÀN-KHÔNG-VỠ: khi CHƯA set ALLOWED_ORIGINS thì
// PHẢN CHIẾU origin của request (hành vi mở như '*' cũ) → deploy không làm vỡ web
// prod dù chưa cấu hình secret. Khi ĐÃ set ALLOWED_ORIGINS (secret, các origin
// tách bằng dấu phẩy) → SIẾT: chỉ origin nằm trong danh sách mới được phản chiếu,
// còn lại nhận origin đầu danh sách. Bật siết bằng cách:
//   supabase secrets set ALLOWED_ORIGINS="https://<web-prod>,http://localhost:3000"
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const RESTRICT = ALLOWED_ORIGINS.length > 0;

/** Chọn origin để trả. Chưa cấu hình → echo origin request (không chặn ai). */
function pickOrigin(req?: Request): string {
  const reqOrigin = req?.headers.get("Origin") ?? "";
  if (!RESTRICT) return reqOrigin || "*";
  // Origin nằm trong danh sách → phản chiếu đúng nó.
  if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin;
  // Có Origin nhưng KHÔNG được phép (vd evil.com) → trả origin cụ thể ≠ nó ⇒
  // preflight OPTIONS sẽ FAIL ở trình duyệt ⇒ chặn. Đây là CỔNG chặn allowlist.
  if (reqOrigin) return ALLOWED_ORIGINS[0]!;
  // KHÔNG có Origin (response dựng không kèm `req`, vd json(body,status)): không
  // biết origin để echo → trả "*". An toàn cho API bearer-token (KHÔNG cookie);
  // request bị chặn đã rớt ngay từ preflight ở trên nên "*" đây không mở cổng.
  return "*";
}

/** Header CORS cho MỘT request cụ thể (origin đã siết theo danh sách cho phép). */
export function corsHeadersFor(req?: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": pickOrigin(req),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    // Vì header đổi theo Origin → báo cache/proxy phân biệt theo Origin.
    "Vary": "Origin",
  };
}

// Header mặc định (origin app) — giữ export cũ để code đang spread `...corsHeaders`
// vẫn chạy. Response thực khi muốn phản chiếu đúng origin cho request đa-origin
// thì truyền `req` vào json()/handleOptions().
export const corsHeaders = corsHeadersFor();

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    // Preflight: phản chiếu đúng origin của request (nếu được phép).
    return new Response("ok", { headers: corsHeadersFor(req) });
  }
  return null;
}

// ── CẤM GẠCH NGANG, CHẶN Ở ĐƯỜNG RA (chủ dự án 13/08) ───────────────────────
// "con AI lúc nào cũng trả lời có gạch ngang, cấm hẳn luôn cho tôi."
// Prompt đã cấm từ 30/07 mà mô hình vẫn viết; hơn 50 câu SOẠN TAY trong
// `chat-turn` cũng viết theo lối "… nhé — thử mới biết…". Sửa tay từng câu thì
// câu viết thêm ngày mai lại dính, nên chặn ở đúng CỬA RA của mọi lời nói:
// hai trường `message` và `feedback` — đó là toàn bộ chữ mà học sinh đọc như
// lời của sư tử. KHÔNG đụng gì khác: đề bài, phương án, lời giải, dữ liệu bảng
// đều đi bằng trường khác và có thể chứa dấu trừ thật.
// (Luồng SSE không qua đây — nó được chặn ở `rehydrate` trong llm.ts.)
function sachLoiNoi(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const o = body as Record<string, unknown>;
  if (typeof o.message !== "string" && typeof o.feedback !== "string") return body;
  return {
    ...o,
    ...(typeof o.message === "string" ? { message: boGachNgang(o.message) } : {}),
    ...(typeof o.feedback === "string" ? { feedback: boGachNgang(o.feedback) } : {}),
  };
}

// `req` là tham số TÙY CHỌN (thêm mới, tương thích ngược với json(body, status)):
// truyền vào để phản chiếu đúng origin cho request; không truyền → dùng origin app.
export function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(sachLoiNoi(body)), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  });
}
