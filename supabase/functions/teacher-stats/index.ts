// teacher-stats — M3.5 analytics + M4 quản trị lớp.
//
// GIỮ NGUYÊN (tương thích ngược): `metrics` (misconception/effort/mastery) và
// `review` (hàng chờ duyệt câu hỏi / thang Socratic).
// THÊM cho trang giáo viên "nhiều thứ để quản trị hơn" — TẤT CẢ tính từ dữ liệu
// THẬT, không bịa; rỗng thì trả 0/[] chứ không vỡ:
//   · students — roster từng học sinh: thành thạo, độ chính xác, nỗ lực, hoạt
//     động gần nhất, số bài đến hạn ôn, cờ cần chú ý.
//   · topics   — theo điểm kiến thức: bao nhiêu HS thành thạo / đang theo dõi.
//   · activity — phiên đang học, tổng bài đến hạn ôn, bài viết/nói chờ chấm,
//     số HS hoạt động 7 ngày.
//
// Đọc bằng service-role, phạm vi ĐÚNG tenant của người gọi. Truy vấn đều CHẶN số
// dòng (mẫu gần nhất) — gộp trong hàm, không quét vô hạn.
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can } from "../_shared/auth.ts";

const DAY = 86_400_000;

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401, req);
    if (!can(ctx, "report:class:read") && !can(ctx, "content:review:approve")) {
      return json({ error: "forbidden" }, 403, req);
    }
    const supa = admin();
    const t = ctx.tenantId;

    // Server-side, KHÔNG nhận từ client:
    const SAMPLE_LIMIT = 4000;  // mẫu attempts gần nhất (misconception + nỗ lực + per-student)
    const LIST_LIMIT = 200;     // phân trang review (câu hỏi / thang)
    const STATE_LIMIT = 10000;  // student_node_state của tenant (pilot nhỏ)
    const SESSION_LIMIT = 3000; // phiên gần nhất để suy hoạt động
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    const [
      { count: totalAttempts },
      { count: correctCount },
      { count: tracked },
      { count: masteredCount },
      { count: activeSessions },
      { count: pendingSubmissions },
      { data: sample },
      { data: questions },
      { data: ladders },
      { data: studentRows },
      { data: nodeStates },
      { data: sessions },
      { data: nodeLabelRows },
    ] = await Promise.all([
      supa.from("attempts").select("id", { count: "exact", head: true }).eq("tenant_id", t),
      supa.from("attempts").select("id", { count: "exact", head: true }).eq("tenant_id", t).eq("is_correct", true),
      supa.from("student_node_state").select("id", { count: "exact", head: true }).eq("tenant_id", t),
      supa.from("student_node_state").select("id", { count: "exact", head: true }).eq("tenant_id", t).eq("mastered", true),
      supa.from("learning_sessions").select("id", { count: "exact", head: true }).eq("tenant_id", t).eq("status", "active"),
      supa.from("submissions").select("id", { count: "exact", head: true }).eq("tenant_id", t).is("feedback", null),
      supa.from("attempts").select("student_id, attempt_no, is_correct, matched_misconception, created_at").eq("tenant_id", t).order("created_at", { ascending: false }).limit(SAMPLE_LIMIT),
      supa.from("questions").select("id, question_key, node_key, loai_danh_gia, noi_dung, trang_thai, p_value, discrimination, stats_n").eq("tenant_id", t).order("question_key").limit(LIST_LIMIT),
      supa.from("socratic_ladders").select("id, ladder_key, node_key, misconception, status").eq("tenant_id", t).order("ladder_key").limit(LIST_LIMIT),
      supa.from("profiles").select("id, full_name, grade").eq("tenant_id", t).eq("role", "student"),
      supa.from("student_node_state").select("student_id, node_id, mastered, mastery_score, next_review_at").eq("tenant_id", t).limit(STATE_LIMIT),
      supa.from("learning_sessions").select("student_id, status, started_at").eq("tenant_id", t).order("started_at", { ascending: false }).limit(SESSION_LIMIT),
      supa.from("kg_nodes").select("node_key, label").eq("tenant_id", t).limit(STATE_LIMIT),
    ]);

    const samp = sample ?? [];

    // ── metrics (GIỮ NGUYÊN) ────────────────────────────────────────────────
    const miscCount: Record<string, number> = {};
    for (const a of samp) {
      if (a.matched_misconception) miscCount[a.matched_misconception] = (miscCount[a.matched_misconception] ?? 0) + 1;
    }
    const misconceptions = Object.entries(miscCount)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const sampleCorrect = samp.filter((a) => a.is_correct);
    const avgEffort = sampleCorrect.length
      ? sampleCorrect.reduce((s, a) => s + (a.attempt_no ?? 1), 0) / sampleCorrect.length
      : 0;
    const totalAtt = totalAttempts ?? 0;
    const accuracy = totalAtt ? (correctCount ?? 0) / totalAtt : 0;
    const masteredN = masteredCount ?? 0;
    const trackedN = tracked ?? 0;
    const masteryRate = trackedN ? masteredN / trackedN : 0;

    // ── per-student & per-node gộp (THÊM) ───────────────────────────────────
    const labelOf: Record<string, string> = {};
    for (const r of nodeLabelRows ?? []) if (r.node_key && !(r.node_key in labelOf)) labelOf[r.node_key] = r.label ?? r.node_key;

    type Agg = { attempts: number; correct: number; effortSum: number; effortN: number; lastMs: number };
    const perStudent = new Map<string, Agg>();
    const bump = (id: string): Agg => {
      let a = perStudent.get(id);
      if (!a) { a = { attempts: 0, correct: 0, effortSum: 0, effortN: 0, lastMs: 0 }; perStudent.set(id, a); }
      return a;
    };
    let activeStudents7d = 0;
    const seen7d = new Set<string>();
    const weekAgo = nowMs - 7 * DAY;
    for (const a of samp) {
      if (!a.student_id) continue;
      const g = bump(a.student_id);
      g.attempts++;
      if (a.is_correct) { g.correct++; g.effortSum += a.attempt_no ?? 1; g.effortN++; }
      const ms = a.created_at ? Date.parse(a.created_at) : 0;
      if (ms > g.lastMs) g.lastMs = ms;
      if (ms >= weekAgo && !seen7d.has(a.student_id)) { seen7d.add(a.student_id); activeStudents7d++; }
    }

    // last-active cũng tính từ phiên (bắt đầu buổi mà chưa trả lời câu nào).
    for (const s of sessions ?? []) {
      if (!s.student_id) continue;
      const ms = s.started_at ? Date.parse(s.started_at) : 0;
      const g = bump(s.student_id);
      if (ms > g.lastMs) g.lastMs = ms;
    }

    type NodeAgg = { tracked: number; mastered: number; scoreSum: number };
    const perNode = new Map<string, NodeAgg>();
    const stateByStudent = new Map<string, { tracked: number; mastered: number; due: number }>();
    for (const ns of nodeStates ?? []) {
      // per-node
      const key = ns.node_id ?? "(?)";
      let na = perNode.get(key);
      if (!na) { na = { tracked: 0, mastered: 0, scoreSum: 0 }; perNode.set(key, na); }
      na.tracked++;
      if (ns.mastered) na.mastered++;
      na.scoreSum += ns.mastery_score ?? 0;
      // per-student mastery + due
      if (ns.student_id) {
        let sa = stateByStudent.get(ns.student_id);
        if (!sa) { sa = { tracked: 0, mastered: 0, due: 0 }; stateByStudent.set(ns.student_id, sa); }
        sa.tracked++;
        if (ns.mastered) sa.mastered++;
        if (ns.next_review_at && Date.parse(ns.next_review_at) <= nowMs) sa.due++;
      }
    }

    const students = (studentRows ?? []).map((p) => {
      const a = perStudent.get(p.id);
      const st = stateByStudent.get(p.id);
      const attempts = a?.attempts ?? 0;
      const acc = attempts ? (a!.correct / attempts) : 0;
      const eff = a && a.effortN ? a.effortSum / a.effortN : 0;
      const lastMs = a?.lastMs ?? 0;
      const due = st?.due ?? 0;
      const flags: string[] = [];
      if (attempts === 0) flags.push("chưa bắt đầu");
      else {
        if (attempts >= 5 && acc < 0.5) flags.push("cần kèm");
        if (lastMs && nowMs - lastMs > 14 * DAY) flags.push("lâu chưa học");
      }
      if (due > 0) flags.push("đến hạn ôn");
      return {
        id: p.id,
        name: (p.full_name ?? "").trim() || "Học sinh",
        grade: p.grade ?? null,
        mastered: st?.mastered ?? 0,
        tracked: st?.tracked ?? 0,
        accuracy: Number(acc.toFixed(2)),
        avgEffort: Number(eff.toFixed(2)),
        attempts,
        lastActiveAt: lastMs ? new Date(lastMs).toISOString() : null,
        dueReviews: due,
        flags,
      };
    })
    // Sắp: cần chú ý trước (nhiều cờ), rồi hoạt động gần đây.
    .sort((x, y) => (y.flags.length - x.flags.length) || ((Date.parse(y.lastActiveAt ?? "") || 0) - (Date.parse(x.lastActiveAt ?? "") || 0)));

    const topics = Array.from(perNode.entries())
      .map(([nodeKey, na]) => ({
        nodeKey,
        label: labelOf[nodeKey] ?? nodeKey,
        mastered: na.mastered,
        tracked: na.tracked,
        avgScore: na.tracked ? Number((na.scoreSum / na.tracked).toFixed(2)) : 0,
      }))
      // Chỗ cả lớp yếu nhất lên đầu: tỉ lệ thành thạo thấp, nhiều HS theo dõi.
      .sort((x, y) => (x.mastered / (x.tracked || 1)) - (y.mastered / (y.tracked || 1)) || (y.tracked - x.tracked))
      .slice(0, 16);

    const dueReviewsTotal = Array.from(stateByStudent.values()).reduce((s, v) => s + v.due, 0);

    return json({
      metrics: {
        misconceptions,
        effort: { avgAttemptsToCorrect: Number(avgEffort.toFixed(2)), accuracy: Number(accuracy.toFixed(2)), totalAttempts: totalAtt },
        mastery: { mastered: masteredN, tracked: trackedN, rate: Number(masteryRate.toFixed(2)) },
      },
      review: {
        questions: (questions ?? []).map((q) => ({
          id: q.id,
          key: q.question_key,
          node: q.node_key,
          kind: q.loai_danh_gia,
          status: q.trang_thai,
          prompt: (q.noi_dung ?? "").slice(0, 90),
          // Thống kê sống (question-stats): null khi chưa đủ dữ liệu.
          pValue: q.p_value,
          discrimination: q.discrimination,
          statsN: q.stats_n,
        })),
        ladders: (ladders ?? []).map((l) => ({
          id: l.id,
          key: l.ladder_key,
          node: l.node_key,
          misconception: l.misconception,
          status: l.status,
        })),
      },
      // ── THÊM ──
      roster: {
        total: (studentRows ?? []).length,
        needAttention: students.filter((s) => s.flags.length > 0).length,
        students,
      },
      topics,
      activity: {
        activeSessions: activeSessions ?? 0,
        dueReviewsTotal,
        pendingSubmissions: pendingSubmissions ?? 0,
        activeStudents7d,
      },
    }, 200, req);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500, req);
  }
});
