// consent — cửa CẤP/RÚT đồng thuận kép (K3, PDPL). Một endpoint, gác theo vai:
//   · status   : HS đọc trạng thái đồng thuận của CHÍNH mình (đủ đôi chưa)
//   · assent   : HS tự ƯNG THUẬN (student_assent=true) cho bản ghi của mình
//   · grant    : NGƯỜI GIÁM HỘ đồng ý cho CON đã liên kết (guardian_consent_by)
//   · withdraw : rút đồng ý → status=withdrawn (PDPL: dừng xử lý ngay; gác ở
//                hasActiveConsent + chat-turn)
// Gate thật (chặn xử lý) nằm ở _shared/auth.hasActiveConsent: dual_consent bật
// thì phải CÓ ĐỦ student_assent LẪN guardian_consent_by mới hợp lệ.
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, hasRole } from "../_shared/auth.ts";

const PURPOSE_DEFAULT = "ai_tutoring";

/** Người gọi có phải giám hộ đã-liên-kết của học sinh này không (hoặc admin). */
async function isGuardianOf(supa: ReturnType<typeof admin>, tenantId: string, guardianId: string, studentId: string): Promise<boolean> {
  const { data } = await supa
    .from("guardian_links")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("guardian_id", guardianId)
    .eq("student_id", studentId)
    .maybeSingle();
  return !!data;
}

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action: string = body.action ?? "status";
    const purpose: string = body.purpose ?? PURPOSE_DEFAULT;
    const supa = admin();

    // ── STATUS — trạng thái đồng thuận của chính HS đang đăng nhập ────────────
    if (action === "status") {
      const { data: rec } = await supa
        .from("consent_records")
        .select("status, dual_consent, student_assent, guardian_consent_by, granted_at, withdrawn_at")
        .eq("student_id", ctx.userId)
        .eq("purpose", purpose)
        .maybeSingle();
      const complete = !!rec && rec.status === "active" &&
        (!rec.dual_consent || (rec.student_assent === true && rec.guardian_consent_by != null));
      return json({
        record: rec ?? null,
        complete,
        needsAssent: !!rec && rec.dual_consent && rec.student_assent !== true,
        needsGuardian: !!rec && rec.dual_consent && rec.guardian_consent_by == null,
      }, 200, req);
    }

    // ── ASSENT — HS tự ưng thuận cho bản ghi của CHÍNH mình ───────────────────
    if (action === "assent") {
      const { data: rec } = await supa
        .from("consent_records").select("id")
        .eq("student_id", ctx.userId).eq("purpose", purpose).maybeSingle();
      if (rec) {
        const { error } = await supa.from("consent_records").update({ student_assent: true }).eq("id", rec.id);
        if (error) return json({ error: error.message }, 500, req);
      } else {
        const { error } = await supa.from("consent_records").insert({
          tenant_id: ctx.tenantId, student_id: ctx.userId, purpose,
          dual_consent: true, student_assent: true, guardian_consent_by: null,
          status: "active", granted_at: new Date().toISOString(),
        });
        if (error) return json({ error: error.message }, 500, req);
      }
      await supa.from("audit_logs").insert({
        action: "consent_assent", subject_type: "student", subject_id: ctx.userId,
        actor_id: ctx.userId, tenant_id: ctx.tenantId,
      });
      return json({ ok: true }, 200, req);
    }

    // ── GRANT — người giám hộ đồng ý cho CON đã liên kết ──────────────────────
    if (action === "grant") {
      let childId = String(body.studentId ?? "");
      // Không truyền studentId + giám hộ chỉ có ĐÚNG 1 con liên kết → tự suy
      // (để nút "Đồng ý cho con" ở trang phụ huynh khỏi cần biết id).
      if (!childId) {
        const { data: links } = await supa
          .from("guardian_links").select("student_id")
          .eq("tenant_id", ctx.tenantId).eq("guardian_id", ctx.userId);
        if ((links?.length ?? 0) === 1) childId = String(links![0].student_id);
      }
      if (!childId) return json({ error: "studentId required" }, 400, req);
      if (!(await isGuardianOf(supa, ctx.tenantId, ctx.userId, childId)) && !hasRole(ctx, "admin")) {
        return json({ error: "forbidden: không phải người giám hộ của học sinh này" }, 403, req);
      }
      const { data: rec } = await supa
        .from("consent_records").select("id")
        .eq("student_id", childId).eq("purpose", purpose).maybeSingle();
      if (rec) {
        const { error } = await supa.from("consent_records")
          .update({ guardian_consent_by: ctx.userId, status: "active" }).eq("id", rec.id);
        if (error) return json({ error: error.message }, 500, req);
      } else {
        const { error } = await supa.from("consent_records").insert({
          tenant_id: ctx.tenantId, student_id: childId, purpose,
          dual_consent: true, student_assent: false, guardian_consent_by: ctx.userId,
          status: "active", granted_at: new Date().toISOString(),
        });
        if (error) return json({ error: error.message }, 500, req);
      }
      await supa.from("audit_logs").insert({
        action: "consent_guardian_grant", subject_type: "student", subject_id: childId,
        actor_id: ctx.userId, tenant_id: ctx.tenantId,
      });
      return json({ ok: true }, 200, req);
    }

    // ── WITHDRAW — rút đồng ý (HS tự rút, hoặc giám hộ rút cho con) ────────────
    if (action === "withdraw") {
      const childId = String(body.studentId ?? ctx.userId);
      if (childId !== ctx.userId &&
          !(await isGuardianOf(supa, ctx.tenantId, ctx.userId, childId)) && !hasRole(ctx, "admin")) {
        return json({ error: "forbidden" }, 403, req);
      }
      const { error } = await supa.from("consent_records")
        .update({ status: "withdrawn", withdrawn_at: new Date().toISOString() })
        .eq("student_id", childId).eq("purpose", purpose);
      if (error) return json({ error: error.message }, 500, req);
      await supa.from("audit_logs").insert({
        action: "consent_withdraw", subject_type: "student", subject_id: childId,
        actor_id: ctx.userId, tenant_id: ctx.tenantId,
      });
      return json({ ok: true }, 200, req);
    }

    return json({ error: "unknown action" }, 400, req);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500, req);
  }
});
