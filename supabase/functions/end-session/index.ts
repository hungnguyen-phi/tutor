// end-session — recompute mastery from evidence + schedule Leitner review, then
// close the session (PRD §22 WF-EndSession). Invoked by n8n (WF-EndSession) or
// directly by the client at session end. Idempotent.
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can } from "../_shared/auth.ts";
import { recomputeMastery, nextReviewISO, type Evidence } from "../_shared/pedagogy.ts";
import { awardXp } from "../_shared/xp.ts";
import { anonymize, callLLM } from "../_shared/llm.ts";

/**
 * GIỌNG ĐIỆU RIÊNG CHO TỪNG EM (chốt 02/08) + TÍN HIỆU NĂNG LỰC QUA CHAT
 * (chốt 03/09) — cùng MỘT lệnh gọi mô hình, đỡ nhân đôi độ trễ/chi phí.
 *
 * Không phải học sinh nào cũng học hiệu quả với cùng một giọng — có em cần
 * nghiêm túc ít đùa, có em cần vui vẻ khích lệ nhiều mới không nản. Ngoài ra,
 * CÁCH em diễn đạt lý do trong chat (không phải chỉ đúng/sai) cũng là tín hiệu
 * — hiểu sâu hay đoán mò, lý luận có ăn khớp với đáp án chọn hay không. Thay vì
 * lưu NGUYÊN VĂN lịch sử hội thoại (tốn, và không cần thiết), ở CUỐI mỗi buổi
 * học AI tự đúc kết lại thành HAI ghi chú NGẮN (1-2 câu mỗi ghi chú), ghi đè
 * lên bản cũ (không phải log cộng dồn):
 *   · `profiles.tutor_style_note`  — CÁCH NÓI (đọc ở chat-turn, dẫn giọng).
 *   · `profiles.tutor_ability_note` — TÍN HIỆU HIỂU BÀI qua lời nói (đọc ở
 *     chat-turn, CHỈ làm ngữ cảnh dẫn dắt — KHÔNG BAO GIỜ dùng để tính
 *     mastery/XP/DOK, những cái đó vẫn tất định qua mastery_evidence/CAS).
 *
 * BEST-EFFORT, không chặn việc đóng phiên: lỗi ở đây tuyệt đối không được làm
 * hỏng luồng chính (mastery + XP + đóng phiên) — đây là gia vị, không phải
 * xương sống.
 */
async function updateStyleNote(
  // deno-lint-ignore no-explicit-any
  supa: any,
  s: { id: string; tenant_id: string; student_id: string },
): Promise<void> {
  try {
    const [{ data: turns }, { data: profile }] = await Promise.all([
      supa
        .from("session_turns")
        .select("role, content")
        .eq("session_id", s.id)
        .order("created_at", { ascending: true })
        .limit(80),
      supa.from("profiles").select("full_name, tutor_style_note, tutor_ability_note").eq("id", s.student_id).single(),
    ]);
    const rows = (turns ?? []) as Array<{ role: string; content: string }>;
    // Đủ lời để đúc kết chưa? Buổi chỉ toàn bấm đáp án (không gõ chữ) thì
    // không có gì để suy giọng điệu/năng lực — bỏ qua lặng lẽ, không phải lỗi.
    const spoken = rows.filter((r) => r.role === "student" && String(r.content ?? "").trim().length >= 12);
    if (spoken.length < 2 || !Deno.env.get("OPENROUTER_API_KEY")) return;

    const names = profile?.full_name ? [String(profile.full_name)] : [];
    const transcriptRaw = rows
      .slice(-40)
      .map((r) => `${r.role === "student" ? "HS" : "TUTOR"}: ${String(r.content ?? "").slice(0, 200)}`)
      .join("\n");
    const { text: transcript, map } = anonymize(transcriptRaw, names);
    void map; // không cần hoàn nguyên — ghi chú lưu lại KHÔNG được chứa tên thật.

    const system = `Bạn đọc một đoạn hội thoại giữa gia sư AI và một học sinh lớp 10, rồi đúc kết
HAI ghi chú NGẮN cho các buổi sau. KHÔNG được dùng để chấm điểm/xếp mức khó —
chỉ là ngữ cảnh dẫn dắt.
(1) "giong": CÁCH NÓI CHUYỆN phù hợp nhất với RIÊNG em này — cần nghiêm túc
    hay vui vẻ, cần khích lệ nhiều hay ít, thích ngắn gọn hay thích giải thích
    kỹ, dễ nản hay kiên trì, thích đùa hay không...
(2) "hieu": CÁCH em HIỂU BÀI qua lời em nói (không phải điểm đúng/sai — đã có
    chỗ khác lo việc đó) — lý luận có mạch lạc không, diễn đạt lý do có ăn
    khớp với đáp án hay đoán mò, hiểu khái niệm hay chỉ nhớ máy móc...
QUY TẮC BẮT BUỘC:
- Mỗi trường ĐÚNG 1-2 CÂU, tiếng Việt, ngắn gọn, không lặp lại nguyên văn lời học sinh.
- KHÔNG nêu tên riêng, không suy đoán thông tin cá nhân ngoài cách học.
- Nếu hội thoại quá ngắn/không đủ tín hiệu rõ ràng cho một trường, để trường đó là CHUỖI RỖNG.
- Nếu đã có ghi chú cũ, XEM XÉT giữ lại phần vẫn đúng, chỉ cập nhật phần đổi.
- CHỈ trả JSON, không thêm lời nào khác: {"giong": "...", "hieu": "..."}`;
    const user =
      `${profile?.tutor_style_note ? `<giong_cu>${String(profile.tutor_style_note).slice(0, 200)}</giong_cu>\n` : ""}` +
      `${profile?.tutor_ability_note ? `<hieu_cu>${String(profile.tutor_ability_note).slice(0, 200)}</hieu_cu>\n` : ""}` +
      `<hoi_thoai>\n${transcript}\n</hoi_thoai>`;

    const res = await callLLM({
      system, user, agent: "style-note", tier: "cheap",
      maxTokens: 200, temperature: 0.3,
      studentId: s.student_id, tenantId: s.tenant_id, supa,
    });
    const hit = res.text.match(/\{[\s\S]*\}/);
    if (!hit) return;
    const j = JSON.parse(hit[0]) as { giong?: unknown; hieu?: unknown };
    // Trần 200 — khớp ĐÚNG trần `clip(giongRieng/tinHieuNangLuc, 200)` ở
    // buildGuideUser. Lưu dài hơn thì phần cuối không bao giờ tới được mô
    // hình, mà đọc trong DB lại tưởng nó đang có tác dụng.
    const giong = typeof j.giong === "string" ? j.giong.trim().slice(0, 200) : "";
    const hieu = typeof j.hieu === "string" ? j.hieu.trim().slice(0, 200) : "";
    const patch: Record<string, string> = {};
    if (giong) patch.tutor_style_note = giong;
    if (hieu) patch.tutor_ability_note = hieu;
    if (Object.keys(patch).length === 0) return;
    await supa.from("profiles").update(patch).eq("id", s.student_id);
  } catch {
    // Gia vị, không phải xương sống — lỗi ở đây không được lộ ra cho học sinh
    // hay chặn việc đóng phiên.
  }
}

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);

    const { sessionId } = await req.json();
    if (!sessionId) return json({ error: "sessionId required" }, 400);
    const supa = admin();

    const { data: s } = await supa
      .from("learning_sessions")
      .select("id, tenant_id, student_id, kg_version_id")
      .eq("id", sessionId)
      .single();
    if (!s) return json({ error: "session not found" }, 404);
    // CHỐT tenant: staff có read_scope ở tenant A KHÔNG được đóng phiên tenant B.
    // Danh tính + phiên đều phải cùng tenant với người gọi (KHÔNG tin body.studentId
    // — student_id lấy từ chính hàng phiên đã tải).
    if (s.tenant_id !== ctx.tenantId) return json({ error: "forbidden" }, 403);
    if (s.student_id !== ctx.userId && !can(ctx, "learn:session:read_scope")) {
      return json({ error: "forbidden" }, 403);
    }

    const { data: evidence } = await supa
      .from("mastery_evidence")
      .select("node_id, correct, dok, do_kho, is_target_difficulty, created_at")
      .eq("tenant_id", s.tenant_id)
      .eq("student_id", s.student_id)
      .eq("kg_version_id", s.kg_version_id);

    // Group evidence by node.
    const byNode = new Map<string, Evidence[]>();
    for (const e of evidence ?? []) {
      const arr = byNode.get(e.node_id) ?? [];
      arr.push({
        correct: e.correct,
        dok: e.dok,
        isTargetDifficulty: e.is_target_difficulty,
        at: new Date(e.created_at).getTime(),
      });
      byNode.set(e.node_id, arr);
    }

    // Đóng dấu revision hiện tại của node — nền tảng cơ chế xanh/vàng
    // (docs/INTEGRATION-STUDIO.md §4): sau này nội dung đổi NGHĨA thì so
    // revision mà biết, không xoá dấu "đã học". Node không còn trong KG → null.
    const revByKey = new Map<string, number>();
    if (byNode.size > 0) {
      const { data: revs } = await supa
        .from("kg_nodes")
        .select("node_key, revision")
        .eq("kg_version_id", s.kg_version_id)
        .in("node_key", [...byNode.keys()]);
      for (const r of revs ?? []) revByKey.set(r.node_key, r.revision);
    }

    const now = Date.now();
    const summary: Array<{ node: string; mastered: boolean; score: number }> = [];
    for (const [nodeId, ev] of byNode) {
      const v = recomputeMastery(ev);
      // Newly mastered → enter Leitner box 0 (first review in 1 day). The box
      // advances on each successful review (WF-SpacedRep, M5).
      const box = 0;
      await supa
        .from("student_node_state")
        .upsert(
          {
            tenant_id: s.tenant_id,
            student_id: s.student_id,
            node_id: nodeId,
            kg_version_id: s.kg_version_id,
            mastery_score: v.score,
            mastered: v.mastered,
            node_revision: revByKey.get(nodeId) ?? null,
            leitner_box: box,
            next_review_at: v.mastered ? nextReviewISO(box, now) : null,
            updated_at: new Date(now).toISOString(),
          },
          { onConflict: "student_id,node_id,kg_version_id" },
        );
      summary.push({ node: nodeId, mastered: v.mastered, score: Number(v.score.toFixed(2)) });
    }

    await supa
      .from("learning_sessions")
      .update({ status: "ended", ended_at: new Date(now).toISOString() })
      .eq("id", s.id);

    // XP hoàn thành buổi (+20, một lần mỗi phiên — unique index lo dedup nên
    // idempotent như phần còn lại của function). Lỗi cộng XP không chặn việc đóng phiên.
    const xp = await awardXp(supa, s.tenant_id, s.student_id, [
      { kind: "lesson_done", sessionId: s.id },
    ]);

    // Đúc kết giọng điệu riêng cho em này — chạy NỀN, không chặn response đóng
    // phiên (học sinh không cần chờ một lượt gọi LLM chỉ để thấy màn "đã lưu").
    (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
      .EdgeRuntime?.waitUntil?.(updateStyleNote(supa, s));

    return json({ sessionId: s.id, nodes: summary, ...(xp ? { xp } : {}) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
