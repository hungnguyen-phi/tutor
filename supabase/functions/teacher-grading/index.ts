// teacher-grading — hàng đợi CHẤM BÀI NỘP NGOÀI.
//
// Học sinh làm câu tự luận dài ra giấy/Word, chụp ảnh nộp lên (chat-turn action
// "submit-work"), rồi học tiếp ngay — KHÔNG được mastery, KHÔNG được XP. Đây là
// nơi khép vòng: giáo viên xem bài, chấm ĐẠT thì mới ghi bằng chứng mastery +
// thưởng XP; chấm CHƯA ĐẠT thì node hiện BÀN CHÂN ĐỎ trên lộ trình học sinh
// (learning-path đọc trạng thái 'redo' của bản nộp MỚI NHẤT).
//
// Ba việc:
//   list  — hàng đợi của TRƯỜNG mình, mặc định các bài chưa chấm.
//   file  — ký link xem bài 1 giờ (bucket private; đúng lối học liệu Xưởng).
//   grade — chấm ĐẠT / CHƯA ĐẠT + lời nhắn cho học sinh.
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can } from "../_shared/auth.ts";
import { awardXp } from "../_shared/xp.ts";
import { recomputeNodeState } from "../_shared/mastery-state.ts";

const BUCKET = "learning-assets";
const LIST_LIMIT = 200;

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401, req);
    // Chấm bài là việc của giáo viên — dùng chung quyền với duyệt nội dung.
    if (!can(ctx, "content:review:approve") && !can(ctx, "report:class:read")) {
      return json({ error: "forbidden" }, 403, req);
    }
    const supa = admin();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "list");

    // ── Hàng đợi ────────────────────────────────────────────────────────────
    if (action === "list") {
      const status = ["pending", "passed", "redo"].includes(String(body.status))
        ? String(body.status)
        : "pending";
      const { data: subs, error } = await supa
        .from("submissions")
        .select("id, student_id, question_id, node_key, file_path, mime, size_bytes, status, teacher_note, created_at, graded_at")
        .eq("tenant_id", ctx.tenantId)
        .eq("kind", "upload")
        .eq("status", status)
        .order("created_at", { ascending: true })
        .limit(LIST_LIMIT);
      if (error) return json({ error: error.message }, 500, req);
      const rows = subs ?? [];
      // Ghép TÊN học sinh + ĐỀ BÀI + TÊN BÀI HỌC: giáo viên không chấm nổi nếu
      // chỉ thấy id. Đọc gộp một lượt, không N+1.
      const ids = [...new Set(rows.map((r) => r.student_id))];
      const qids = [...new Set(rows.map((r) => r.question_id))];
      const nodes = [...new Set(rows.map((r) => r.node_key).filter(Boolean))] as string[];
      const [profRes, qRes, nodeRes] = await Promise.all([
        ids.length ? supa.from("profiles").select("id, full_name").in("id", ids) : { data: [] },
        qids.length ? supa.from("questions").select("id, noi_dung, dap_an").in("id", qids) : { data: [] },
        nodes.length ? supa.from("kg_nodes").select("node_key, label").in("node_key", nodes) : { data: [] },
      ]);
      const nameOf = new Map((profRes.data ?? []).map((p: Record<string, unknown>) => [p.id, p.full_name]));
      const qOf = new Map((qRes.data ?? []).map((q: Record<string, unknown>) => [q.id, q]));
      const labelOf = new Map((nodeRes.data ?? []).map((n: Record<string, unknown>) => [n.node_key, n.label]));
      const strip = (s: unknown) => String(s ?? "").replace(/^\[(NOPBAI|WRITING|SPEAKING)\]\s*/i, "");
      return json({
        items: rows.map((r) => ({
          id: r.id,
          studentName: nameOf.get(r.student_id) ?? "Học sinh",
          nodeLabel: r.node_key ? labelOf.get(r.node_key) ?? r.node_key : "",
          prompt: strip((qOf.get(r.question_id) as Record<string, unknown> | undefined)?.noi_dung),
          // Đáp án mẫu để giáo viên đối chiếu — CHỈ trả cho giáo viên.
          reference: String((qOf.get(r.question_id) as Record<string, unknown> | undefined)?.dap_an ?? ""),
          mime: r.mime,
          sizeKb: r.size_bytes ? Math.round(r.size_bytes / 1024) : null,
          status: r.status,
          note: r.teacher_note,
          submittedAt: r.created_at,
          gradedAt: r.graded_at,
        })),
      }, 200, req);
    }

    // ── Xem bài: ký link 1 giờ (bucket private, không lộ đường dẫn thẳng) ────
    if (action === "file") {
      const { data: sub } = await supa
        .from("submissions")
        .select("file_path, tenant_id")
        .eq("id", String(body.id ?? ""))
        .maybeSingle();
      if (!sub || sub.tenant_id !== ctx.tenantId) return json({ error: "not found" }, 404, req);
      if (!sub.file_path) return json({ error: "no file" }, 404, req);
      const { data: signed, error } = await supa.storage
        .from(BUCKET)
        .createSignedUrl(String(sub.file_path), 3600);
      if (error || !signed) return json({ error: error?.message ?? "sign failed" }, 500, req);
      return json({ url: signed.signedUrl }, 200, req);
    }

    // ── Chấm ────────────────────────────────────────────────────────────────
    if (action === "grade") {
      const pass = body.pass === true;
      const { data: sub } = await supa
        .from("submissions")
        .select("id, tenant_id, session_id, student_id, question_id, node_key, status")
        .eq("id", String(body.id ?? ""))
        .maybeSingle();
      if (!sub || sub.tenant_id !== ctx.tenantId) return json({ error: "not found" }, 404, req);

      const { error: upErr } = await supa
        .from("submissions")
        .update({
          status: pass ? "passed" : "redo",
          teacher_note: String(body.note ?? "").slice(0, 500) || null,
          graded_by: ctx.userId,
          graded_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
      if (upErr) return json({ error: upErr.message }, 500, req);

      // CHƯA ĐẠT: không ghi bằng chứng gì cả. Lộ trình sẽ tự hiện bàn chân đỏ
      // (learning-path đọc bản nộp mới nhất), học sinh làm lại rồi nộp lại.
      if (!pass) return json({ ok: true, status: "redo" }, 200, req);

      // ĐẠT: giờ mới ghi bằng chứng mastery + thưởng XP. Phải đọc phiên để biết
      // kg_version — bài nộp có thể được chấm nhiều ngày sau.
      const [{ data: ses }, { data: q }] = await Promise.all([
        supa.from("learning_sessions").select("id, kg_version_id").eq("id", sub.session_id).maybeSingle(),
        supa.from("questions").select("id, node_key, dok, do_kho").eq("id", sub.question_id).maybeSingle(),
      ]);
      if (!ses || !q) return json({ ok: true, status: "passed", note: "đã chấm, không tính mastery (thiếu phiên/câu)" }, 200, req);
      const nodeKey = sub.node_key ?? q.node_key;
      const { data: nodeRow } = await supa
        .from("kg_nodes")
        .select("revision")
        .eq("kg_version_id", ses.kg_version_id)
        .eq("node_key", nodeKey)
        .maybeSingle();

      await supa.from("mastery_evidence").upsert(
        {
          tenant_id: sub.tenant_id,
          session_id: ses.id,
          student_id: sub.student_id,
          node_id: nodeKey,
          question_id: q.id,
          correct: true,
          dok: q.dok,
          // Bài tự luận dài luôn là câu KHÓ của node → tính đúng độ khó mục tiêu.
          do_kho: "kho",
          is_target_difficulty: true,
          kg_version_id: ses.kg_version_id,
          node_revision: nodeRow?.revision ?? null,
        },
        { onConflict: "session_id,question_id", ignoreDuplicates: true },
      );
      const state = await recomputeNodeState(supa, {
        tenantId: sub.tenant_id,
        studentId: sub.student_id,
        kgVersionId: ses.kg_version_id,
        nodeKey,
        nodeRevision: nodeRow?.revision ?? null,
      });
      // XP đến ĐÚNG LÚC NÀY, không phải lúc bấm nộp (chống bấm bừa).
      await awardXp(supa, sub.tenant_id, sub.student_id, [
        { kind: "correct", questionId: q.id, sessionId: ses.id },
        ...(state.newlyMastered
          ? [{ kind: "node_mastered" as const, nodeId: nodeKey, kgVersionId: ses.kg_version_id, sessionId: ses.id }]
          : []),
      ]);
      return json({ ok: true, status: "passed", mastered: state.mastered }, 200, req);
    }

    return json({ error: "unknown action" }, 400, req);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500, req);
  }
});
