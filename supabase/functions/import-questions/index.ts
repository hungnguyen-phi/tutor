// import-questions — CỬA CẮM BỘ CÂU HỎI cho giáo viên (Đợt 2).
// Nhận gói va.kg-questions/2.2 (chỉ câu hỏi, KHÔNG node/edge), nhét vào một
// phiên bản KG ĐÃ CÓ (khớp subject + version_label). Mọi câu vào trạng thái
// 'review' + một hàng review_queue/câu → giáo viên duyệt mới phục vụ học sinh.
// Bàn cờ 204 node Toán 10 đã publish; đây là đường "ghép quân vào ô".
//
// KHÔNG chạy Zod của @tutor/shared trong Deno (import NodeNext .js→.ts không
// resolve) — frontend đã validate bằng schema thật trước khi gửi; ở đây kiểm
// PHÒNG THỦ các ràng buộc cốt lõi khớp constraint DB (questions_form_chk,
// questions_auto_objective_chk, unique(kg_version_id, question_key)).
import { handleOptions, json } from "../_shared/cors.ts";
import { admin, PILOT_TENANT_SLUG } from "../_shared/supa.ts";
import { authenticate, can, hasRole } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/ratelimit.ts";

const CHUNK = 200;

// Bảng tra dạng→nhóm chấm (mirror FORM_SPEC trong @tutor/shared). auto ⇒ objective;
// còn lại ⇒ rubric/speaking. phan_tu KHÔNG tính mastery (phản tư siêu nhận thức).
const FORM_GROUP: Record<string, "auto" | "rubric_agent" | "speaking_agent"> = {
  mcq: "auto", dung_sai: "auto", dien_dap_an: "auto", dien_khuyet: "auto",
  sap_xep: "auto", noi_cot: "auto", nhieu_buoc: "auto", nghe: "auto",
  tu_luan_ngan: "rubric_agent", tim_loi: "rubric_agent", viet_doan: "rubric_agent",
  giai_thich_cho_ban: "rubric_agent", du_doan_giai_thich: "rubric_agent",
  phan_bien: "rubric_agent", van_dung_thuc_te: "rubric_agent", phan_tu: "rubric_agent",
  noi: "speaking_agent",
};
const FORM_UI: Record<string, string> = {
  sap_xep: "drag_drop", noi_cot: "drag_drop", du_doan_giai_thich: "video_player",
  van_dung_thuc_te: "image_upload", noi: "microphone", nghe: "audio_player",
};

type Any = Record<string, unknown>;
const s = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : v == null ? undefined : String(v);

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    // Chỉ staff nội dung được nạp (cùng quyền teacher-review).
    if (!can(ctx, "content:review:approve") && !hasRole(ctx, "teacher", "admin", "leadership")) {
      return json({ error: "forbidden: cần vai giáo viên/admin" }, 403);
    }

    const supa = admin();
    // Nạp là ghi hàng loạt — chặn spam.
    const rl = await rateLimit(supa, `import-q:${ctx.tenantId}`, 6, 60);
    if (!rl.ok) return json({ error: "rate_limited", retryAfter: rl.retryAfter }, 429);

    let b: { schema?: string; subject?: string; version_label?: string; questions?: Any[] };
    try {
      b = await req.json();
    } catch {
      return json({ error: "body không phải JSON" }, 400);
    }

    const issues: string[] = [];
    if (b.schema !== "va.kg-questions/2.2") issues.push("schema phải là va.kg-questions/2.2");
    if (!b.subject) issues.push("thiếu subject");
    if (!b.version_label) issues.push("thiếu version_label");
    const questions = Array.isArray(b.questions) ? b.questions : [];
    if (questions.length === 0) issues.push("bộ câu hỏi rỗng");
    if (issues.length > 0) return json({ error: "gói không đạt chuẩn", issues }, 422);

    // ── Phiên bản đích: khớp (tenant, subject, label). Ưu tiên bản published
    //    (bản học sinh đang thấy); không có published thì lấy bản mới nhất. ──
    const { data: tenant } = await supa
      .from("tenants").select("id").eq("slug", PILOT_TENANT_SLUG).single();
    if (!tenant) return json({ error: `tenant ${PILOT_TENANT_SLUG} chưa seed` }, 500);
    if (tenant.id !== ctx.tenantId) return json({ error: "forbidden" }, 403);

    const { data: versions } = await supa
      .from("kg_versions")
      .select("id, status")
      .eq("tenant_id", tenant.id)
      .eq("subject", b.subject!)
      .eq("label", b.version_label!);
    const version =
      (versions ?? []).find((v) => v.status === "published") ?? (versions ?? [])[0];
    if (!version) {
      return json({
        error: `không tìm thấy phiên bản «${b.version_label}» môn ${b.subject}. ` +
          "Nhãn phải khớp đúng một bản đã nạp khung (bàn cờ node).",
      }, 404);
    }

    // ── node_key phải CÓ THẬT trong phiên bản này (không cắm câu vào ô trống) ──
    const { data: nodeRows } = await supa
      .from("kg_nodes").select("node_key").eq("kg_version_id", version.id);
    const nodeKeys = new Set((nodeRows ?? []).map((n) => n.node_key));

    // ── Map + kiểm phòng thủ từng câu ──────────────────────────────────────
    const rows: Any[] = [];
    const rejected: { id: string; reason: string }[] = [];
    const seenKey = new Set<string>();
    for (const q of questions) {
      const id = s(q.id ?? q.question_id) ?? `q-${rows.length + rejected.length + 1}`;
      const node_key = s(q.node_id ?? q.node_key);
      const form = s(q.dang_cau_hoi) ?? "";
      const group = FORM_GROUP[form];
      if (!node_key) { rejected.push({ id, reason: "thiếu node_id" }); continue; }
      if (!nodeKeys.has(node_key)) { rejected.push({ id, reason: `node «${node_key}» không có trong phiên bản` }); continue; }
      if (!group) { rejected.push({ id, reason: `dạng câu hỏi lạ: ${form || "(trống)"}` }); continue; }
      if (seenKey.has(id)) { rejected.push({ id, reason: "question_key trùng trong gói" }); continue; }
      seenKey.add(id);

      const loai_danh_gia = s(q.loai_danh_gia) ?? (group === "auto" ? "objective" : "rubric");
      const dap_an = s(q.dap_an);
      // Ràng buộc DB: nhóm 'auto' phải objective + có đáp án.
      if (group === "auto" && (loai_danh_gia !== "objective" || !dap_an)) {
        rejected.push({ id, reason: "câu tự chấm cần objective + đáp án" });
        continue;
      }
      if (loai_danh_gia === "rubric" && !q.rubric) {
        rejected.push({ id, reason: "câu rubric cần tiêu chí chấm (rubric)" });
        continue;
      }
      const dok = Number(q.dok);
      const doKho = s(q.do_kho);
      if (!(dok >= 1 && dok <= 4)) { rejected.push({ id, reason: "dok phải 1–4" }); continue; }
      if (!doKho || !["de", "TB", "kho"].includes(doKho)) { rejected.push({ id, reason: "do_kho phải de/TB/kho" }); continue; }
      const noi_dung = s(q.noi_dung);
      if (!noi_dung) { rejected.push({ id, reason: "thiếu nội dung" }); continue; }

      const tier = Number(q.tier);
      rows.push({
        tenant_id: tenant.id,
        kg_version_id: version.id,
        question_key: id,
        node_key,
        tier: tier >= 1 && tier <= 3 ? tier : null,
        loai_danh_gia,
        dang_cau_hoi: form,
        nhom_cham: group,
        ui_can_thiet: FORM_UI[form] ?? "none",
        tinh_mastery: form === "phan_tu" ? false : true,
        dok,
        do_kho: doKho,
        do_kho_uoc_luong: q.do_kho_uoc_luong === false ? false : true,
        hoi_do_tu_tin: q.hoi_do_tu_tin === true,
        noi_dung,
        dap_an: dap_an ?? null,
        loi_giai: s(q.loi_giai) ?? null,
        distractors: Array.isArray(q.distractors) ? q.distractors : [],
        tham_so_hoa: q.tham_so_hoa === true,
        tham_so: q.tham_so && typeof q.tham_so === "object" ? q.tham_so : null,
        buoc: Array.isArray(q.buoc) ? q.buoc : null,
        loi_cai_san: Array.isArray(q.loi_cai_san) ? q.loi_cai_san : null,
        audio_uri: s(q.audio_uri) ?? null,
        rubric: q.rubric ?? null,
        bai_mau: Array.isArray(q.bai_mau) ? q.bai_mau : null,
        loi_thuong_gap: Array.isArray(q.loi_thuong_gap) ? q.loi_thuong_gap : null,
        trang_thai: "review", // human-in-the-loop: chờ giáo viên duyệt
      });
    }

    if (rows.length === 0) {
      return json({ error: "không câu nào hợp lệ", rejected: rejected.slice(0, 10) }, 422);
    }

    // ── Upsert questions theo (kg_version_id, question_key) — chạy lại cùng gói
    //    thì cập nhật, không nhân bản. Đưa về 'review' để nội dung sửa phải duyệt lại. ──
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supa
        .from("questions")
        .upsert(rows.slice(i, i + CHUNK), { onConflict: "kg_version_id,question_key" });
      if (error) return json({ error: `questions chunk ${i}: ${error.message}` }, 500);
    }

    // ── review_queue: 1 hàng pending/câu, bỏ qua câu đã pending ──────────────
    const keys = rows.map((r) => r.question_key as string);
    const already = new Set<string>();
    for (let i = 0; i < keys.length; i += CHUNK) {
      const { data } = await supa
        .from("review_queue")
        .select("content_id")
        .eq("tenant_id", tenant.id)
        .eq("content_type", "question")
        .eq("status", "pending")
        .in("content_id", keys.slice(i, i + CHUNK));
      for (const r of data ?? []) already.add(r.content_id);
    }
    // content_id của review_queue là questions.id (uuid), không phải question_key —
    // đọc lại id thật của các câu vừa upsert để xếp hàng đúng đối tượng teacher-review.
    const { data: inserted } = await supa
      .from("questions")
      .select("id, question_key")
      .eq("kg_version_id", version.id)
      .in("question_key", keys);
    const queueRows = (inserted ?? [])
      .filter((r) => !already.has(r.id))
      .map((r) => ({
        tenant_id: tenant.id,
        content_type: "question",
        content_id: r.id,
        ai_generated: false,
        status: "pending",
        note: `bộ câu hỏi ${b.version_label}`,
      }));
    for (let i = 0; i < queueRows.length; i += CHUNK) {
      const { error } = await supa.from("review_queue").insert(queueRows.slice(i, i + CHUNK));
      if (error) return json({ error: `review_queue chunk ${i}: ${error.message}` }, 500);
    }

    // ── Phủ node: bao nhiêu node của phiên bản giờ đã có ≥1 câu (bức tranh
    //    "bàn cờ đầy dần") — đọc trên toàn bộ questions của version, không chỉ gói này. ──
    const { data: allQ } = await supa
      .from("questions").select("node_key").eq("kg_version_id", version.id);
    const nodesWithQ = new Set((allQ ?? []).map((r) => r.node_key)).size;

    return json({
      ok: true,
      version: b.version_label,
      accepted: rows.length,
      rejected: rejected.length,
      queued: queueRows.length,
      coverage: { nodesWithQuestions: nodesWithQ, totalNodes: nodeKeys.size },
      ...(rejected.length ? { rejectedSample: rejected.slice(0, 8) } : {}),
      message:
        `Đã nạp ${rows.length} câu vào hàng chờ duyệt cho «${b.version_label}»` +
        (rejected.length ? ` (${rejected.length} câu bị loại).` : ".") +
        ` Bàn cờ: ${nodesWithQ}/${nodeKeys.size} node đã có câu hỏi.`,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
