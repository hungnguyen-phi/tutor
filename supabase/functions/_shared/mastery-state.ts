// Tính lại mastery/Leitner của MỘT node ngay sau khi có bằng chứng mới.
//
// Tách ra khỏi chat-turn vì giờ có HAI nguồn bằng chứng:
//   · học sinh trả lời tại chỗ  → chat-turn
//   · giáo viên chấm bài nộp ngoài → teacher-grading
// Hai nơi mà chép hai bản là sớm muộn cũng lệch, rồi node lên xanh ở đường này
// mà không lên ở đường kia. Một bản, hai chỗ gọi.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { recomputeMastery, nextReviewISO, type Evidence } from "./pedagogy.ts";

export interface NodeStateArgs {
  tenantId: string;
  studentId: string;
  kgVersionId: string;
  nodeKey: string;
  /** Đọc sẵn ở đường nóng thì truyền vào để khỏi đọc kg_nodes lần hai. */
  nodeRevision: number | null;
}

export async function recomputeNodeState(
  supa: SupabaseClient,
  a: NodeStateArgs,
): Promise<{ mastered: boolean; score: number; newlyMastered: boolean }> {
  const [{ data: evidence }, { data: prevState }] = await Promise.all([
    supa
      .from("mastery_evidence")
      .select("correct, dok, is_target_difficulty, created_at")
      .eq("student_id", a.studentId)
      .eq("kg_version_id", a.kgVersionId)
      .eq("node_id", a.nodeKey),
    supa
      .from("student_node_state")
      .select("mastered, leitner_box")
      .eq("student_id", a.studentId)
      .eq("kg_version_id", a.kgVersionId)
      .eq("node_id", a.nodeKey)
      .maybeSingle(),
  ]);
  const ev: Evidence[] = (evidence ?? []).map((e: Record<string, unknown>) => ({
    correct: e.correct as boolean,
    dok: e.dok as number,
    isTargetDifficulty: e.is_target_difficulty as boolean,
    at: new Date(e.created_at as string).getTime(),
  }));
  const v = recomputeMastery(ev);
  const now = Date.now();
  const box = (prevState?.leitner_box as number | undefined) ?? 0;
  await supa.from("student_node_state").upsert(
    {
      tenant_id: a.tenantId,
      student_id: a.studentId,
      node_id: a.nodeKey,
      kg_version_id: a.kgVersionId,
      mastery_score: v.score,
      mastered: v.mastered,
      node_revision: a.nodeRevision ?? null,
      leitner_box: box,
      next_review_at: v.mastered ? nextReviewISO(box, now) : null,
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: "student_id,node_id,kg_version_id" },
  );
  return { mastered: v.mastered, score: v.score, newlyMastered: v.mastered && !prevState?.mastered };
}
