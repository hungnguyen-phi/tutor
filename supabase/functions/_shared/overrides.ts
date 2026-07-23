// Lớp phủ nội dung của giáo viên (H5) — nạp override đang hiệu lực của một
// tenant rồi áp lúc PHỤC VỤ câu hỏi: 'hide' → bỏ câu khỏi luồng; 'edit' → ghép
// patch (noi_dung/loi_giai) đè lên câu gốc. Nội dung gốc (Studio) không đổi.
import { admin } from "./supa.ts";

export interface QOverride {
  action: string; // 'hide' | 'edit'
  patch: Record<string, unknown>;
}

/** Map questionId → override đang hiệu lực cho tenant. Rỗng khi GV chưa chỉnh gì
 *  (đường phổ biến — 1 query nhẹ nhờ index (tenant) where active). */
export async function loadQuestionOverrides(
  supa: ReturnType<typeof admin>,
  tenantId: string,
): Promise<Map<string, QOverride>> {
  const m = new Map<string, QOverride>();
  const { data } = await supa
    .from("teacher_overrides")
    .select("content_id, action, patch")
    .eq("tenant_id", tenantId)
    .eq("content_type", "question")
    .eq("active", true);
  for (const o of (data ?? []) as Array<{ content_id: string; action: string; patch: Record<string, unknown> | null }>) {
    m.set(o.content_id, { action: o.action, patch: o.patch ?? {} });
  }
  return m;
}

/** Câu có đang bị GV ẩn không. */
export function isHidden(ov?: QOverride): boolean {
  return ov?.action === "hide";
}

/** Áp override 'edit' (ghép patch noi_dung/loi_giai). Không phải edit → nguyên. */
export function applyQuestionEdit<T extends Record<string, unknown>>(q: T, ov?: QOverride): T {
  if (!ov || ov.action !== "edit") return q;
  const p = ov.patch ?? {};
  return {
    ...q,
    ...(p.noi_dung != null ? { noi_dung: p.noi_dung } : {}),
    ...(p.loi_giai != null ? { loi_giai: p.loi_giai } : {}),
  };
}
