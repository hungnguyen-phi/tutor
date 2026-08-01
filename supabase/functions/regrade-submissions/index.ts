// regrade-submissions — CHẠY LẠI hàng đợi bài nộp cũ bằng AI.
//
// Vì sao có (01/08): hôm nay đổi sang AI chấm hết và ẩn tab "Chấm bài" của giáo
// viên. Đo trước khi đổi: 69 bản nộp, **0 bản từng được chấm Đạt**, 60 bản nằm
// chờ. Ẩn tab đi mà không dọn thì 60 em đó thành mồ côi vĩnh viễn — mà [NOPBAI]
// thường là câu DOK≥3 duy nhất của node, nên lộ trình của các em đứng im.
//
// Dùng ĐÚNG bộ chấm của lượt nộp mới (`_shared/grade-open.ts`) và ĐÚNG bộ đọc
// tệp (`_shared/doc-bai-lam.ts`). Không có bản sao thứ hai nào để trôi lệch.
//
// Chạy MỘT LẦN, do người dùng gọi (Claude bị chặn ghi prod):
//   · {"action":"dry"}  — chỉ ĐẾM và xem trước, KHÔNG ghi một dòng nào.
//   · {"action":"run"}  — chấm thật. `limit` mặc định 25 để không đụng trần
//     thời gian của Edge Function; gọi lại tới khi `conLai` về 0.
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can } from "../_shared/auth.ts";
import { awardXp, type XpEventInput } from "../_shared/xp.ts";
import { recomputeNodeState } from "../_shared/mastery-state.ts";
import { gradeOpenAnswer, chotPhanQuyet } from "../_shared/grade-open.ts";
import { docBaiLamTuTep } from "../_shared/doc-bai-lam.ts";
import { isJunkOpenAnswer } from "../_shared/intent.ts";

interface KetQua {
  id: string;
  hocSinh: string;
  node: string;
  nguon: string;
  ketLuan: "dat" | "chua_dat" | "khong_cham_duoc" | "bai_rac";
  thieu?: string;
  masteredMoi?: boolean;
}

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401, req);
    // Cùng cửa quyền với màn chấm bài cũ — đây là việc quản trị nội dung.
    if (!can(ctx, "content:review:approve")) return json({ error: "forbidden" }, 403, req);

    const supa = admin();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "dry");
    const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 100);

    // Chỉ bản nộp MỚI NHẤT của mỗi (học sinh, câu). Em nộp lại ba lần thì chấm
    // MỘT bài — chấm cả ba là ba lần tiền token cho cùng một kết quả, và bản cũ
    // ghi đè bản mới thì phán quyết cuối lại là của bài cũ.
    const { data: keys, error: keyErr } = await supa
      .from("submissions")
      .select("id, student_id, question_id, created_at")
      .eq("tenant_id", ctx.tenantId)
      .eq("kind", "upload")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(3000);
    if (keyErr) return json({ error: keyErr.message }, 500, req);

    const moiNhat = new Map<string, string>();
    for (const r of keys ?? []) moiNhat.set(`${r.student_id}|${r.question_id}`, r.id);
    const canCham = [...moiNhat.values()];

    if (action === "dry") {
      return json({
        cheDo: "xem truoc — KHONG ghi gi",
        dongPending: (keys ?? []).length,
        baiCanCham: canCham.length,
        ghiChu: "Gọi lại với {\"action\":\"run\"} để chấm thật. Mỗi lượt chấm tối đa `limit` bài (mặc định 25).",
      }, 200, req);
    }
    if (action !== "run") return json({ error: "unknown action" }, 400, req);

    const lot = canCham.slice(0, limit);
    if (!lot.length) return json({ daCham: 0, conLai: 0, ketQua: [] }, 200, req);

    const { data: subs, error: subErr } = await supa
      .from("submissions")
      .select("id, tenant_id, session_id, student_id, question_id, node_key, text_content, file_path, mime")
      .in("id", lot);
    if (subErr) return json({ error: subErr.message }, 500, req);

    const rows = subs ?? [];
    // Đọc gộp một lượt: câu hỏi, phiên học, tên học sinh. N+1 trên 60 dòng là
    // 180 lượt đi-về, đủ để chạm trần thời gian trước khi chấm được bài nào.
    const qids = [...new Set(rows.map((r) => r.question_id))];
    const sids = [...new Set(rows.map((r) => r.session_id))];
    const hids = [...new Set(rows.map((r) => r.student_id))];
    const [qRes, sRes, pRes] = await Promise.all([
      supa.from("questions").select("id, node_key, noi_dung, dap_an, loi_giai, dok").in("id", qids),
      supa.from("learning_sessions").select("id, kg_version_id, subject").in("id", sids),
      supa.from("profiles").select("id, full_name, locale").in("id", hids),
    ]);
    const qOf = new Map((qRes.data ?? []).map((q) => [q.id, q]));
    const sOf = new Map((sRes.data ?? []).map((x) => [x.id, x]));
    const pOf = new Map((pRes.data ?? []).map((p) => [p.id, p]));

    const ketQua: KetQua[] = [];
    for (const sub of rows) {
      const q = qOf.get(sub.question_id);
      const ses = sOf.get(sub.session_id);
      const prof = pOf.get(sub.student_id) as { full_name?: string; locale?: string } | undefined;
      const hocSinh = prof?.full_name ?? "Học sinh";
      const node = sub.node_key ?? q?.node_key ?? "";
      if (!q || !ses) {
        ketQua.push({ id: sub.id, hocSinh, node, nguon: "?", ketLuan: "khong_cham_duoc" });
        continue;
      }
      const en = ses.subject === "Anh" || prof?.locale === "en";
      const names = prof?.full_name ? [prof.full_name] : [];

      // Đọc tệp NẾU bản nộp chưa có chữ. Bản cũ chỉ đính ảnh thì `text_content`
      // rỗng — chính là nhóm chưa bao giờ nhận được phản hồi nào.
      let doc = null;
      if (!String(sub.text_content ?? "").trim() && sub.file_path) {
        doc = await docBaiLamTuTep({
          supa, filePath: sub.file_path, mime: String(sub.mime ?? ""), en,
          studentId: sub.student_id, tenantId: sub.tenant_id,
        });
      }
      const bai = [String(sub.text_content ?? ""), doc?.text ?? ""]
        .filter((t) => t.trim()).join("\n\n").slice(0, 10_000);

      if (!bai.trim()) {
        ketQua.push({ id: sub.id, hocSinh, node, nguon: doc?.nguon ?? "?", ketLuan: "khong_cham_duoc" });
        continue;
      }

      const ref = [q.dap_an, q.loi_giai].filter(Boolean).join(" ");
      if (isJunkOpenAnswer(bai, ref)) {
        // Bài rác (chữ "ok" và họ hàng) — ĐÓNG là 'redo' để em thấy bàn chân đỏ
        // và biết đường làm lại, thay vì treo mãi ở hàng đợi không ai xem.
        await supa.from("submissions").update({
          status: "redo",
          feedback: { ai: { dung: false, thieu: "Bài nộp chưa có lời giải." }, chayLai: true },
          graded_at: new Date().toISOString(),
        }).eq("id", sub.id);
        ketQua.push({ id: sub.id, hocSinh, node, nguon: doc?.nguon ?? "go", ketLuan: "bai_rac" });
        continue;
      }

      const ai = await gradeOpenAnswer({
        prompt: String(q.noi_dung ?? "").replace(/^\[(NOPBAI|WRITING|SPEAKING)\]\s*/i, ""),
        reference: [q.dap_an, q.loi_giai].filter(Boolean).join("\n"),
        studentAnswer: bai,
        names, en,
        studentId: sub.student_id, tenantId: sub.tenant_id, supa,
      });
      const { chamDuoc, dat } = chotPhanQuyet(ai, bai, ref);
      if (!chamDuoc) {
        // Không chấm được → ĐỂ NGUYÊN 'pending'. Lượt chạy sau nhặt lại.
        ketQua.push({ id: sub.id, hocSinh, node, nguon: doc?.nguon ?? "go", ketLuan: "khong_cham_duoc" });
        continue;
      }

      await supa.from("submissions").update({
        status: dat ? "passed" : "redo",
        // Lưu lại BẢN CHÉP đã dùng để chấm — không có nó thì sau này không ai
        // dò được vì sao một bài ảnh bị đánh trượt.
        text_content: bai,
        feedback: { ai: { dung: dat, moHinhNoi: ai!.correct, thieu: ai!.detail ?? "" }, chayLai: true },
        graded_at: new Date().toISOString(),
      }).eq("id", sub.id);

      const { data: nodeRow } = await supa
        .from("kg_nodes").select("revision")
        .eq("kg_version_id", ses.kg_version_id).eq("node_key", node)
        .maybeSingle();

      await supa.from("mastery_evidence").delete()
        .eq("student_id", sub.student_id).eq("question_id", q.id).neq("session_id", ses.id);
      await supa.from("mastery_evidence").upsert({
        tenant_id: sub.tenant_id,
        session_id: ses.id,
        student_id: sub.student_id,
        node_id: node,
        question_id: q.id,
        correct: dat,
        dok: q.dok,
        do_kho: "kho",
        is_target_difficulty: true,
        kg_version_id: ses.kg_version_id,
        node_revision: nodeRow?.revision ?? null,
      }, { onConflict: "session_id,question_id" });

      const state = await recomputeNodeState(supa, {
        tenantId: sub.tenant_id, studentId: sub.student_id,
        kgVersionId: ses.kg_version_id, nodeKey: node,
        nodeRevision: nodeRow?.revision ?? null,
      });

      if (dat) {
        const ev: XpEventInput[] = [{ kind: "correct", questionId: q.id, sessionId: ses.id }];
        if (state.newlyMastered) {
          ev.push({ kind: "node_mastered", nodeId: node, kgVersionId: ses.kg_version_id, sessionId: ses.id });
        }
        await awardXp(supa, sub.tenant_id, sub.student_id, ev);
      }

      ketQua.push({
        id: sub.id, hocSinh, node, nguon: doc?.nguon ?? "go",
        ketLuan: dat ? "dat" : "chua_dat",
        ...(dat ? {} : { thieu: ai!.detail ?? "" }),
        ...(state.newlyMastered ? { masteredMoi: true } : {}),
      });
    }

    const dem = (k: KetQua["ketLuan"]) => ketQua.filter((r) => r.ketLuan === k).length;
    return json({
      daCham: ketQua.length,
      conLai: Math.max(0, canCham.length - lot.length),
      tomTat: {
        dat: dem("dat"),
        chuaDat: dem("chua_dat"),
        baiRac: dem("bai_rac"),
        khongChamDuoc: dem("khong_cham_duoc"),
        nodeVuaXanh: ketQua.filter((r) => r.masteredMoi).length,
      },
      ketQua,
    }, 200, req);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500, req);
  }
});
