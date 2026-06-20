// chat-turn — per-student-turn orchestrator (PRD §21). No streaming.
// Loads session + persists every turn. Routes objective answers through CAS
// (evaluate path) and wrong answers through the effort gate → guide (Socratic).
// Keeps the evaluate vs guide agents on separate code paths.
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can } from "../_shared/auth.ts";
import { checkAnswer } from "../_shared/cas.ts";
import { evaluateEffortGate } from "../_shared/pedagogy.ts";
import { anonymize, rehydrate, callLLM } from "../_shared/llm.ts";
import {
  buildGuideSystem,
  buildRubricSystem,
  buildSpeakingSystem,
} from "../_shared/prompts.ts";

interface Session {
  id: string;
  tenant_id: string;
  student_id: string;
  subject: string;
  kg_version_id: string;
  current_node_id: string | null;
}

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);

    const body = await req.json();
    const supa = admin();

    const { data: session } = await supa
      .from("learning_sessions")
      .select("id, tenant_id, student_id, subject, kg_version_id, current_node_id")
      .eq("id", body.sessionId)
      .single();
    if (!session) return json({ error: "session not found" }, 404);
    const s = session as Session;

    // The caller must own the session (student) or be staff with scope access.
    if (s.student_id !== ctx.userId && !can(ctx, "learn:session:read_scope")) {
      return json({ error: "forbidden" }, 403);
    }

    const { data: profile } = await supa
      .from("profiles")
      .select("full_name, grade, locale")
      .eq("id", s.student_id)
      .single();
    const names = profile?.full_name ? [profile.full_name] : [];
    const grade = profile?.grade ?? "10";
    const language = s.subject === "Anh" ? "en" : (profile?.locale ?? "vi");

    const persist = (role: string, content: string, agent?: string, meta?: unknown) =>
      supa.from("session_turns").insert({
        tenant_id: s.tenant_id,
        session_id: s.id,
        role,
        agent: agent ?? null,
        content,
        meta: meta ?? null,
      });

    const action = body.action as string;

    // ── Objective answer (Toán CAS / Anh MCQ) ──────────────────────────────
    if (action === "answer") {
      const { data: q } = await supa
        .from("questions")
        .select("id, node_key, dap_an, distractors, dok, do_kho, loai_danh_gia, noi_dung")
        .eq("id", body.questionId)
        .single();
      if (!q) return json({ error: "question not found" }, 404);

      const studentAnswer = String(body.studentAnswer ?? "");
      await persist("student", studentAnswer, undefined, { questionId: q.id });

      const { count: prev } = await supa
        .from("attempts")
        .select("id", { count: "exact", head: true })
        .eq("session_id", s.id)
        .eq("question_id", q.id);
      const attemptNo = (prev ?? 0) + 1;

      const verdict = checkAnswer(studentAnswer, String(q.dap_an ?? ""), body.params);
      let matched: string | null = null;
      for (const d of (q.distractors ?? []) as Array<{ phuong_an: string; quan_niem_sai: string }>) {
        if (checkAnswer(studentAnswer, d.phuong_an, body.params).correct) {
          matched = d.quan_niem_sai;
          break;
        }
      }

      await supa.from("attempts").insert({
        tenant_id: s.tenant_id,
        session_id: s.id,
        student_id: s.student_id,
        question_id: q.id,
        node_id: q.node_key,
        attempt_no: attemptNo,
        raw_answer: studentAnswer,
        is_correct: verdict.correct,
        matched_misconception: matched,
      });
      await supa.from("mastery_evidence").insert({
        tenant_id: s.tenant_id,
        student_id: s.student_id,
        node_id: q.node_key,
        question_id: q.id,
        correct: verdict.correct,
        dok: q.dok,
        do_kho: q.do_kho,
        is_target_difficulty: true,
        kg_version_id: s.kg_version_id,
      });

      if (verdict.correct) {
        const msg =
          language === "en"
            ? "Correct — nice work! I can see your effort paying off. Ready for the next one?"
            : "Chính xác — làm tốt lắm! Thầy thấy rõ nỗ lực của em. Sẵn sàng câu tiếp theo chứ?";
        await persist("tutor", msg, "guide", { correct: true });
        return json({ correct: true, attemptNo, message: msg });
      }

      // Wrong → effort gate, then Socratic guide.
      const { data: ladder } = await supa
        .from("socratic_ladders")
        .select("id, rungs, bottom_out, cong_no_luc, misconception")
        .eq("kg_version_id", s.kg_version_id)
        .eq("node_key", q.node_key)
        .limit(1)
        .maybeSingle();
      const totalRungs = Array.isArray(ladder?.rungs) ? ladder!.rungs.length : 4;
      const minAttempts =
        (ladder?.cong_no_luc as { so_lan_thu_toi_thieu?: number } | null)?.so_lan_thu_toi_thieu ?? 2;
      const currentRung = Math.max(0, attemptNo - minAttempts);

      const gate = evaluateEffortGate({
        attempts: attemptNo,
        thinkingQuality: typeof body.thinkingQuality === "number" ? body.thinkingQuality : 1,
        currentRung,
        totalRungs,
        minAttempts,
      });

      if (gate.action === "require_attempt") {
        const msg =
          language === "en"
            ? "Not quite yet — give it one more try first. What was your reasoning?"
            : "Chưa đúng — em thử lại một lần nữa nhé. Em đã suy nghĩ thế nào để ra kết quả đó?";
        await persist("tutor", msg, "effort-gate", { gate: gate.action, matched });
        return json({ correct: false, attemptNo, gate: gate.action, message: msg });
      }

      const rungs = (ladder?.rungs ?? []) as Array<{ cau_hoi: string }>;
      const rungQuestion =
        gate.action === "advance_rung" ? rungs[Math.min(currentRung, rungs.length - 1)]?.cau_hoi : undefined;
      const bottomOut =
        gate.action === "bottom_out"
          ? (ladder?.bottom_out as { noi_dung?: string } | null)?.noi_dung
          : undefined;

      const system = buildGuideSystem({
        subject: s.subject,
        grade: String(grade),
        language,
        nodeLabel: q.node_key,
        question: q.noi_dung,
        misconception: matched ?? (ladder?.misconception as string | undefined),
        rungQuestion,
        bottomOut,
        attempts: attemptNo,
      });
      const { text: safeMsg, map } = anonymize(studentAnswer, names);
      const res = await callLLM({
        system,
        user: `Em trả lời: "${safeMsg}". Hãy dẫn dắt em.`,
        agent: "guide",
        tier: "default",
        studentId: s.student_id,
        tenantId: s.tenant_id,
        supa,
      });
      const text = rehydrate(res.text, map);
      await persist("tutor", text, "guide", { gate: gate.action, currentRung, matched });
      return json({ correct: false, attemptNo, gate: gate.action, currentRung, message: text });
    }

    // ── Writing (English rubric, formative) ────────────────────────────────
    if (action === "writing") {
      const { data: q } = await supa
        .from("questions")
        .select("id, rubric, bai_mau, noi_dung")
        .eq("id", body.questionId)
        .single();
      if (!q) return json({ error: "question not found" }, 404);
      const text = String(body.text ?? "");
      await persist("student", text, undefined, { questionId: q.id, kind: "writing" });

      const { text: safe, map } = anonymize(text, names);
      const system = buildRubricSystem(q.rubric, (q.bai_mau?.[0] as string) ?? "", language);
      const res = await callLLM({
        system,
        user: `Đề: ${q.noi_dung}\nBài làm của học sinh:\n${safe}`,
        agent: "evaluate-rubric",
        tier: "default",
        studentId: s.student_id,
        tenantId: s.tenant_id,
        supa,
      });
      const feedback = rehydrate(res.text, map);
      await supa.from("submissions").insert({
        tenant_id: s.tenant_id,
        session_id: s.id,
        student_id: s.student_id,
        question_id: q.id,
        kind: "writing",
        text_content: text,
        feedback: { formative: feedback },
      });
      await persist("tutor", feedback, "evaluate-rubric", { formative: true });
      return json({ kind: "writing", feedback, note: "formative — not an official grade" });
    }

    // ── Speaking (English; transcript from in-browser STT) ─────────────────
    if (action === "speaking") {
      const { data: q } = await supa
        .from("questions")
        .select("id, rubric, noi_dung")
        .eq("id", body.questionId)
        .single();
      if (!q) return json({ error: "question not found" }, 404);
      const transcript = String(body.transcript ?? "");
      await persist("student", transcript, undefined, { questionId: q.id, kind: "speaking" });

      const { text: safe, map } = anonymize(transcript, names);
      const system = buildSpeakingSystem(q.rubric, language);
      const res = await callLLM({
        system,
        user: `Đề nói: ${q.noi_dung}\nBản ghi (transcript) của học sinh:\n${safe}`,
        agent: "evaluate-speaking",
        tier: "default",
        studentId: s.student_id,
        tenantId: s.tenant_id,
        supa,
      });
      const feedback = rehydrate(res.text, map);
      await supa.from("submissions").insert({
        tenant_id: s.tenant_id,
        session_id: s.id,
        student_id: s.student_id,
        question_id: q.id,
        kind: "speaking",
        text_content: transcript,
        audio_path: body.audioPath ?? null,
        feedback: { formative: feedback },
      });
      await persist("tutor", feedback, "evaluate-speaking", { formative: true });
      return json({ kind: "speaking", feedback, note: "transcript-based; pronunciation scoring deferred to Azure F0" });
    }

    // ── Free Socratic message (no specific question) ───────────────────────
    if (action === "message") {
      const studentMessage = String(body.message ?? "");
      await persist("student", studentMessage);
      const { text: safe, map } = anonymize(studentMessage, names);
      const system = buildGuideSystem({
        subject: s.subject,
        grade: String(grade),
        language,
        nodeLabel: s.current_node_id ?? "",
        question: body.question ?? "",
        attempts: 0,
      });
      const res = await callLLM({
        system,
        user: safe || "(mở đầu buổi học)",
        agent: "guide",
        tier: "default",
        studentId: s.student_id,
        tenantId: s.tenant_id,
        supa,
      });
      const text = rehydrate(res.text, map);
      await persist("tutor", text, "guide");
      return json({ message: text });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
