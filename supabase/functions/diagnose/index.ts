// diagnose — MVP stub (PRD §11, Q4): creates a session and returns the active
// questions for the subject's pilot node (full adaptive diagnostic lands at M5).
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can, hasActiveConsent } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { genParams, seedFrom, fillTemplate, readSpec } from "../_shared/paramgen.ts";

// Server-side, KHÔNG nhận từ client: số câu tối đa trả về lượt đầu (chống kéo
// nguyên ngân hàng câu hỏi) + hạn mức chống lạm dụng (tạo phiên hàng loạt).
const FIRST_LOAD_LIMIT = 20;
const RL_MAX = 20; // tối đa 20 lượt diagnose
const RL_WINDOW_SEC = 60; // mỗi 60 giây / user

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const jdx = Math.floor(Math.random() * (i + 1));
    [a[i], a[jdx]] = [a[jdx]!, a[i]!];
  }
  return a;
}

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    if (!can(ctx, "learn:tutor:chat")) return json({ error: "forbidden" }, 403);

    // Chỉ nhận `subject` từ client; mọi thứ còn lại (tenant, version, giới hạn)
    // đều CHỐT server-side để không thể điều khiển hành vi qua tham số client.
    const { subject } = await req.json();
    if (!subject || typeof subject !== "string") return json({ error: "subject required" }, 400);

    const studentId = ctx.userId;
    const supa = admin();

    // Rate-limit theo user TRƯỚC khi chạm DB nặng / tạo phiên (chống spam phiên).
    const rl = await rateLimit(supa, `diagnose:${ctx.userId}`, RL_MAX, RL_WINDOW_SEC);
    if (!rl.ok) {
      return json({ error: "rate_limited", retryAfter: rl.retryAfter, message: "Bạn thao tác hơi nhanh — thử lại sau giây lát nhé." }, 429);
    }

    // Consent (PDPL) + tra version chạy SONG SONG — bớt một vòng mạng tuần tự.
    const [consentOk, versionRes] = await Promise.all([
      hasActiveConsent(ctx.userId),
      supa
        .from("kg_versions")
        .select("id")
        .eq("tenant_id", ctx.tenantId)
        .eq("subject", subject)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    // PDPL consent gate — no active consent → no processing.
    if (!consentOk) {
      return json({ error: "consent_required", message: "Cần đồng ý xử lý dữ liệu (consent) trước khi bắt đầu học." }, 403);
    }
    const version = versionRes.data;
    if (!version) return json({ error: `no published KG for ${subject}` }, 404);

    const { data: questions } = await supa
      .from("questions")
      .select("id, node_key, tier, dok, do_kho, loai_danh_gia, noi_dung, dap_an, distractors, rubric, tham_so_hoa, tham_so")
      .eq("kg_version_id", version.id)
      .eq("trang_thai", "active")
      // Câu KHUÔN THAM SỐ giờ ĐƯỢC phục vụ: máy sinh (paramgen) thay {b},{c}…
      // bằng số cụ thể tất định theo (session, câu); chấm ở chat-turn dùng cùng
      // seed nên số y hệt. Không còn placeholder thô lọt tới học sinh.
      .order("tier", { ascending: true })
      .order("dok", { ascending: true })
      // Giới hạn lượt đầu — không kéo cả ngân hàng câu về client.
      .limit(FIRST_LOAD_LIMIT);

    const firstNode = questions?.[0]?.node_key ?? null;
    const { data: ses } = await supa
      .from("learning_sessions")
      .insert({
        tenant_id: ctx.tenantId,
        student_id: studentId,
        subject,
        kg_version_id: version.id,
        current_node_id: firstNode,
        status: "active",
      })
      .select("id")
      .single();

    const items = (questions ?? []).map((q) => {
      const kind = /\[SPEAKING\]/i.test(q.noi_dung)
        ? "speaking"
        : /\[WRITING\]/i.test(q.noi_dung)
          ? "writing"
          : q.loai_danh_gia;
      // Câu khuôn: sinh params TẤT ĐỊNH theo (session, câu) — chat-turn chấm
      // dùng CÙNG seed nên số khớp cái học sinh thấy. Câu tĩnh: fill là no-op.
      const spec = q.tham_so_hoa ? readSpec(q.tham_so) : null;
      const params = spec && ses ? genParams(spec, seedFrom(ses.id, q.id)) : {};
      const fill = (t: string) => (spec ? fillTemplate(t, params) : t);
      const base = {
        id: q.id,
        nodeKey: q.node_key,
        tier: q.tier,
        dok: q.dok,
        doKho: q.do_kho,
        kind,
        prompt: fill(q.noi_dung.replace(/^\[(SPEAKING|WRITING)\]\s*/i, "")),
      };
      if (q.loai_danh_gia === "objective") {
        // Có phương án nhiễu → MCQ (thay params vào từng phương án); không có
        // (điền đáp án) → ô nhập tự do, chấm bằng CAS.
        const distractors = (q.distractors ?? []) as Array<{ phuong_an: string }>;
        if (distractors.length > 0) {
          const opts = shuffle([fill(String(q.dap_an)), ...distractors.map((d) => fill(d.phuong_an))]);
          return { ...base, options: opts };
        }
        return base;
      }
      if (q.loai_danh_gia === "rubric") return { ...base, rubric: q.rubric };
      return base;
    });

    return json({ sessionId: ses?.id, kgVersionId: version.id, node: firstNode, questions: items });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
