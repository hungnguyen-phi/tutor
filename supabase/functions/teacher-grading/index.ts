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
const LIST_LIMIT = 200; // số BÀI trả về (sau khi gộp bản nộp lại)
const SCAN_LIMIT = 3000; // số DÒNG quét để biết đâu là bản mới nhất

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
      // HAI LƯỢT ĐỌC, cố ý. Chỉ giữ bản NỘP MỚI NHẤT của mỗi (học sinh, câu) —
      // em nộp lại 3 lần thì giáo viên chấm MỘT bài, không phải 3 dòng trùng
      // (đo 27/07: một buổi thử đã đẻ 6 dòng). Lượt 1 quét KHOÁ của cả hàng đợi
      // rồi mới chọn; gộp vào một truy vấn có .limit() là sai: cắt 200 dòng cũ
      // nhất TRƯỚC khi gộp thì bản mới nằm ngoài trang, giáo viên đọc bản cũ
      // tưởng là bản mới nhất.
      const { data: keys, error: keyErr } = await supa
        .from("submissions")
        .select("id, student_id, question_id, created_at")
        .eq("tenant_id", ctx.tenantId)
        .eq("kind", "upload")
        .eq("status", status)
        .order("created_at", { ascending: true })
        .limit(SCAN_LIMIT);
      if (keyErr) return json({ error: keyErr.message }, 500, req);
      const latest = new Map<string, string>();
      for (const r of keys ?? []) latest.set(`${r.student_id}|${r.question_id}`, r.id);
      const pick = [...latest.values()].slice(0, LIST_LIMIT); // vẫn theo thứ tự cũ→mới
      const { data: subs, error } = pick.length
        ? await supa
          .from("submissions")
          .select("id, student_id, question_id, node_key, text_content, feedback, file_path, mime, size_bytes, status, teacher_note, created_at, graded_at")
          .in("id", pick)
          .order("created_at", { ascending: true })
        : { data: [], error: null };
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
          // Bài GÕ của học sinh (nếu em gõ thay vì chụp ảnh) + sơ khảo của AI.
          text: r.text_content ?? null,
          aiVerdict: (r.feedback as { ai?: { dung?: boolean; thieu?: string } } | null)?.ai ?? null,
          hasFile: !!r.file_path,
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

      // Chấm là chấm CÂU, không phải chấm tờ giấy: đóng luôn mọi bản nộp còn
      // treo của cùng (học sinh, câu). Chỉ đóng bản mới nhất thì bản cũ vẫn
      // 'pending' → lượt mở hàng đợi sau nó nổi lên MỘT MÌNH như bài chưa chấm,
      // giáo viên chấm lại bài đã lỗi thời và ĐÈ ngược phán quyết vừa đưa.
      const { error: upErr } = await supa
        .from("submissions")
        .update({
          status: pass ? "passed" : "redo",
          teacher_note: String(body.note ?? "").slice(0, 500) || null,
          graded_by: ctx.userId,
          graded_at: new Date().toISOString(),
        })
        .eq("tenant_id", ctx.tenantId)
        .eq("student_id", sub.student_id)
        .eq("question_id", sub.question_id)
        .or(`id.eq.${sub.id},status.eq.pending`);
      if (upErr) return json({ error: upErr.message }, 500, req);

      // CẢ HAI NHÁNH đều ghi bằng chứng: AI sơ khảo có thể đã chấm NGƯỢC với
      // giáo viên (đạt↔làm lại). Phán quyết của giáo viên là CUỐI — đè bằng
      // chứng cũ rồi tính lại mastery, kẻo node xanh ngoài mặt vì AI dễ tính.
      const [{ data: ses }, { data: q }] = await Promise.all([
        supa.from("learning_sessions").select("id, kg_version_id").eq("id", sub.session_id).maybeSingle(),
        supa.from("questions").select("id, node_key, dok, do_kho").eq("id", sub.question_id).maybeSingle(),
      ]);
      if (!ses || !q) {
        return json({ ok: true, status: pass ? "passed" : "redo", note: "đã chấm, không tính mastery (thiếu phiên/câu)" }, 200, req);
      }
      const nodeKey = sub.node_key ?? q.node_key;
      const { data: nodeRow } = await supa
        .from("kg_nodes")
        .select("revision")
        .eq("kg_version_id", ses.kg_version_id)
        .eq("node_key", nodeKey)
        .maybeSingle();

      // MỘT câu = MỘT bằng chứng. Khoá chống trùng của bảng chỉ tính trong cùng
      // phiên, nên bằng chứng "đúng" mà AI ghi ở phiên trước phải dọn — không
      // thì bấm "Làm lại" chỉ lật được dòng của phiên này, dòng cũ vẫn giữ node
      // xanh và học sinh không hiểu vì sao vừa bị trả bài vừa vẫn qua bài.
      await supa.from("mastery_evidence").delete()
        .eq("student_id", sub.student_id).eq("question_id", q.id).neq("session_id", ses.id);
      await supa.from("mastery_evidence").upsert(
        {
          tenant_id: sub.tenant_id,
          session_id: ses.id,
          student_id: sub.student_id,
          node_id: nodeKey,
          question_id: q.id,
          correct: pass,
          dok: q.dok,
          // Bài tự luận dài luôn là câu KHÓ của node → tính đúng độ khó mục tiêu.
          do_kho: "kho",
          is_target_difficulty: true,
          kg_version_id: ses.kg_version_id,
          node_revision: nodeRow?.revision ?? null,
        },
        // KHÔNG ignoreDuplicates: AI sơ khảo có thể đã ghi correct:false cho đúng
        // (session, câu) này — phán quyết của GIÁO VIÊN phải ĐÈ lên, không thì
        // bấm "Đạt" mà bằng chứng sai vẫn nằm nguyên, node không lên nổi.
        { onConflict: "session_id,question_id" },
      );
      const state = await recomputeNodeState(supa, {
        tenantId: sub.tenant_id,
        studentId: sub.student_id,
        kgVersionId: ses.kg_version_id,
        nodeKey,
        nodeRevision: nodeRow?.revision ?? null,
      });
      // XP chỉ khi ĐẠT (dedup ở DB — AI đã thưởng trước thì không thưởng lần hai).
      if (pass) {
        await awardXp(supa, sub.tenant_id, sub.student_id, [
          { kind: "correct", questionId: q.id, sessionId: ses.id },
          ...(state.newlyMastered
            ? [{ kind: "node_mastered" as const, nodeId: nodeKey, kgVersionId: ses.kg_version_id, sessionId: ses.id }]
            : []),
        ]);
      }
      return json({ ok: true, status: pass ? "passed" : "redo", mastered: state.mastered }, 200, req);
    }

    return json({ error: "unknown action" }, 400, req);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500, req);
  }
});
