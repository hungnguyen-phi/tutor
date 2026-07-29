// review-queue — HÀNG ĐỢI ÔN TẬP của học sinh (mở cửa cho động cơ đã chạy sẵn).
//
// Bối cảnh (lỗi 3, rà 28-29/07): bảng `student_node_state` ĐÃ CÓ `leitner_box`
// + `next_review_at`, `end-session` và `_shared/mastery-state.ts` ĐANG GHI thật,
// `teacher-stats` đã đọc để đếm bài đến hạn cho giáo viên — nhưng HỌC SINH thì
// không có cửa nào để nhìn. Màn Ôn tập đọc localStorage (`va-tutor-mastered`),
// mà khoá đó chỉ được ghi khi kết thúc TRỌN một buổi học, nên đổi máy/thoát
// giữa chừng là "Chưa có gì để ôn" vĩnh viễn dù server có 3 node đã thành thạo.
//
// Function này KHÔNG tính toán gì mới: chỉ đọc lịch server đã hẹn, gộp nhãn bài
// từ kg_nodes, rồi chia ba rổ để màn Ôn tập nói đúng sự thật:
//   due     — đã tới hạn (next_review_at <= now)
//   soon    — chưa tới hạn, kèm ngày hẹn để KHÔNG phải nói "chưa có gì"
//   strong  — hộp Leitner cao nhất (đã nhớ bền), chỉ để em thấy thành quả
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate } from "../_shared/auth.ts";
import { LEITNER_DAYS } from "../_shared/pedagogy.ts";

/** Trần an toàn: một học sinh pilot có ~200 node/môn, lấy dư vẫn nhẹ. */
const LIMIT = 500;

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401, req);

    const body = await req.json().catch(() => ({}));
    const subject = typeof body.subject === "string" ? body.subject : null;
    const supa = admin();

    // Version đang publish của môn (nếu client nói rõ môn) — để không trộn lịch
    // ôn của Toán vào màn đang mở môn Anh.
    let versionId: string | null = null;
    if (subject) {
      const { data: v } = await supa
        .from("kg_versions")
        .select("id")
        .eq("tenant_id", ctx.tenantId)
        .eq("subject", subject)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      versionId = v?.id ?? null;
      // Môn chưa có KG publish → trả rỗng TRUNG THỰC, không phải lỗi.
      if (!versionId) {
        return json({ due: [], soon: [], strong: [], total: 0, subject }, 200, req);
      }
    }

    let q = supa
      .from("student_node_state")
      .select("node_id, kg_version_id, leitner_box, next_review_at, mastery_score")
      .eq("student_id", ctx.userId)
      .eq("mastered", true)
      .limit(LIMIT);
    if (versionId) q = q.eq("kg_version_id", versionId);
    const { data: states, error } = await q;
    if (error) return json({ error: error.message }, 500, req);

    const rows = states ?? [];
    if (rows.length === 0) {
      return json({ due: [], soon: [], strong: [], total: 0, subject }, 200, req);
    }

    // Nhãn + chương của từng bài: đọc GỘP một lượt (không N+1).
    const keys = [...new Set(rows.map((r) => String(r.node_id)))];
    const versions = [...new Set(rows.map((r) => String(r.kg_version_id)))];
    const { data: nodes } = await supa
      .from("kg_nodes")
      .select("node_key, label, chapter, kg_version_id")
      .in("node_key", keys)
      .in("kg_version_id", versions);
    const meta = new Map(
      (nodes ?? []).map((n) => [
        `${n.kg_version_id}|${n.node_key}`,
        { label: String(n.label ?? n.node_key), chapter: (n.chapter as string | null) ?? null },
      ]),
    );

    const now = Date.now();
    const TOP_BOX = LEITNER_DAYS.length - 1;
    interface Item {
      key: string;
      label: string;
      chapter: string | null;
      box: number;
      nextReviewAt: string | null;
      /** Số ngày quá hạn (due) hoặc còn lại (soon) — client khỏi tự tính. */
      days: number;
    }
    const due: Item[] = [];
    const soon: Item[] = [];
    const strong: Item[] = [];

    for (const r of rows) {
      const m = meta.get(`${r.kg_version_id}|${r.node_id}`);
      // Node đã ẩn/gộp khỏi KG → bỏ khỏi hàng đợi (giữ lịch sử ở DB, không mời
      // học sinh ôn một bài không còn tồn tại trên lộ trình).
      if (!m) continue;
      const box = Math.max(0, Math.min(TOP_BOX, Number(r.leitner_box) || 0));
      const at = r.next_review_at ? Date.parse(String(r.next_review_at)) : NaN;
      const item: Item = {
        key: String(r.node_id),
        label: m.label,
        chapter: m.chapter,
        box,
        nextReviewAt: r.next_review_at ? String(r.next_review_at) : null,
        days: 0,
      };
      if (!Number.isFinite(at)) {
        // Thành thạo TRƯỚC khi có lịch (dữ liệu cũ) → coi như đến hạn: thà mời
        // ôn sớm còn hơn để em nằm ngoài mọi rổ và màn hình lại trống.
        due.push({ ...item, days: 0 });
        continue;
      }
      const diffDays = Math.round((at - now) / 86_400_000);
      if (at <= now) due.push({ ...item, days: Math.max(0, -diffDays) });
      else if (box >= TOP_BOX) strong.push({ ...item, days: diffDays });
      else soon.push({ ...item, days: diffDays });
    }

    // Quá hạn lâu nhất lên trước (ôn cái sắp quên nhất); soon theo ngày gần nhất.
    due.sort((a, b) => b.days - a.days);
    soon.sort((a, b) => a.days - b.days);
    strong.sort((a, b) => a.days - b.days);

    return json(
      {
        subject,
        due,
        soon,
        strong,
        total: due.length + soon.length + strong.length,
        /** Ngày hẹn gần nhất — để màn RỖNG nói "quay lại ngày …" thay vì "chưa có gì". */
        nextAt: soon[0]?.nextReviewAt ?? strong[0]?.nextReviewAt ?? null,
      },
      200,
      req,
    );
  } catch (e) {
    console.error("review-queue error:", e instanceof Error ? (e.stack ?? e.message) : String(e));
    return json({ error: "internal" }, 500, req);
  }
});
