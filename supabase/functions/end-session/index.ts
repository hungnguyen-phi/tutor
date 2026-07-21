// end-session — recompute mastery from evidence + schedule Leitner review, then
// close the session (PRD §22 WF-EndSession). Invoked by n8n (WF-EndSession) or
// directly by the client at session end. Idempotent.
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can } from "../_shared/auth.ts";
import { recomputeMastery, nextReviewISO, type Evidence } from "../_shared/pedagogy.ts";
import { awardXp } from "../_shared/xp.ts";

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

    return json({ sessionId: s.id, nodes: summary, ...(xp ? { xp } : {}) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
