// dashboard — one role-gated read endpoint backing every staff/role UI.
// action: coach | parent | buddy | leadership | admin | dpo | counselor
// Each branch checks RBAC perms/roles, reads live data via service role, and
// returns only what that role may see (parents/counsellors get no raw identity).
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can, hasRole, type AuthCtx } from "../_shared/auth.ts";

const short = (id: string) => "#" + id.slice(0, 4);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action: string = body.action ?? "";
    const supa = admin();
    const t = ctx.tenantId;
    const deny = () => json({ error: "forbidden" }, 403);

    // ── COACH (GVCN) — coachee list ──────────────────────────────────────────
    if (action === "coach") {
      if (!can(ctx, "learn:session:read_scope") && !hasRole(ctx, "teacher", "homeroom_teacher", "admin")) return deny();
      const { data: links } = await supa
        .from("coaching_links")
        .select("student_id, cadence_days, last_meeting_at, student:student_id(full_name)")
        .eq("tenant_id", t).eq("mentor_id", ctx.userId).eq("kind", "homeroom_coach")
        .limit(200); // phân trang: một GVCN không phụ trách quá 200 học sinh
      const ids = (links ?? []).map((l) => l.student_id);
      const { data: wigs } = ids.length
        ? await supa.from("wigs").select("student_id, progress_pct").eq("tenant_id", t).eq("area", "kien_thuc").in("student_id", ids)
        : { data: [] };
      const wigBy: Record<string, number> = {};
      for (const w of wigs ?? []) wigBy[w.student_id] = Math.round(w.progress_pct);
      const now = Date.now();
      const coachees = (links ?? []).map((l) => {
        const name = (Array.isArray(l.student) ? l.student[0] : l.student)?.full_name ?? "Học sinh";
        const lastMeet = l.last_meeting_at ? new Date(l.last_meeting_at).getTime() : 0;
        const overdue = lastMeet ? (now - lastMeet) / 86400000 > l.cadence_days : true;
        const knowledge = wigBy[l.student_id] ?? 0;
        return { studentId: l.student_id, name, knowledge, lastMeetingAt: l.last_meeting_at, overdue, needsAttention: overdue || knowledge < 50 };
      });
      return json({ role: "coach", coachees, counts: { total: coachees.length, attention: coachees.filter((c) => c.needsAttention).length } });
    }

    // ── PARENT — filtered, aggregated child report (no raw chat / no flags) ───
    if (action === "parent") {
      if (!hasRole(ctx, "parent")) return deny();
      const { data: gl } = await supa.from("guardian_links").select("student_id, student:student_id(full_name)").eq("tenant_id", t).eq("guardian_id", ctx.userId).limit(1).maybeSingle();
      if (!gl) return json({ role: "parent", child: null });
      const childId = gl.student_id;
      const childName = (Array.isArray(gl.student) ? gl.student[0] : gl.student)?.full_name ?? "Con";
      // Đếm mastered/tracked bằng AGGREGATE (head+count) — không kéo cả bảng state.
      const [{ count: tracked }, { count: masteredCount }, { data: wigs }, { data: consent }] = await Promise.all([
        supa.from("student_node_state").select("id", { count: "exact", head: true }).eq("tenant_id", t).eq("student_id", childId),
        supa.from("student_node_state").select("id", { count: "exact", head: true }).eq("tenant_id", t).eq("student_id", childId).eq("mastered", true),
        supa.from("wigs").select("area, title, progress_pct, source").eq("tenant_id", t).eq("student_id", childId).eq("source", "tutor"),
        supa.from("consent_records").select("status, purpose").eq("tenant_id", t).eq("student_id", childId),
      ]);
      const mastered = masteredCount ?? 0;
      return json({
        role: "parent",
        child: {
          name: childName,
          masteredNodes: mastered,
          practicingNodes: Math.max(0, (tracked ?? 0) - mastered),
          wigs: (wigs ?? []).map((w) => ({ subject: w.area === "kien_thuc" ? "Kiến thức (Toán)" : "Tiếng Anh", title: w.title, pct: Math.round(w.progress_pct) })),
          consent: (consent ?? []).map((c) => ({ purpose: c.purpose, status: c.status })),
        },
        note: "Báo cáo đã lọc — không hiển thị hội thoại chi tiết hay cờ nhạy cảm. Vấn đề nhạy cảm sẽ được giáo viên/cố vấn trao đổi trực tiếp.",
      });
    }

    // ── BUDDY — peer scoreboard of the linked mentee (limited) ───────────────
    if (action === "buddy") {
      const { data: link } = await supa.from("coaching_links").select("student_id, student:student_id(full_name)").eq("tenant_id", t).eq("mentor_id", ctx.userId).eq("kind", "buddy").limit(1).maybeSingle();
      if (!link) return deny();
      const sid = link.student_id;
      const name = (Array.isArray(link.student) ? link.student[0] : link.student)?.full_name ?? "Buddy";
      const monday = (() => { const x = new Date(); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); })();
      const [{ data: wigs }, { data: leads }, { data: board }] = await Promise.all([
        supa.from("wigs").select("area, title, progress_pct").eq("tenant_id", t).eq("student_id", sid).order("sort"),
        supa.from("lead_measures").select("label, value_text, status").eq("tenant_id", t).eq("student_id", sid).eq("week_start", monday).order("sort"),
        supa.from("scoreboard_weeks").select("effort_rank, commitment").eq("tenant_id", t).eq("student_id", sid).eq("week_start", monday).maybeSingle(),
      ]);
      return json({
        role: "buddy", buddy: { name },
        wigs: (wigs ?? []).map((w) => ({ area: w.area, title: w.title, pct: Math.round(w.progress_pct) })),
        leadMeasures: (leads ?? []).map((l) => ({ label: l.label, valueText: l.value_text, status: l.status })),
        effortRank: board?.effort_rank ?? null, commitment: board?.commitment ?? "",
      });
    }

    // ── LEADERSHIP — tenant aggregates (no raw data) ─────────────────────────
    if (action === "leadership") {
      if (!can(ctx, "report:school:read") && !hasRole(ctx, "leadership", "admin")) return deny();
      // Mastery = AGGREGATE (head+count), không kéo cả bảng state về gộp JS.
      // token_usage CHỐT tenant (trước đây thiếu → lộ tổng token liên tenant).
      const [{ count: tracked }, { count: masteredCount }, { count: sessions }, { count: students }, { data: tokens }] = await Promise.all([
        supa.from("student_node_state").select("id", { count: "exact", head: true }).eq("tenant_id", t),
        supa.from("student_node_state").select("id", { count: "exact", head: true }).eq("tenant_id", t).eq("mastered", true),
        supa.from("learning_sessions").select("id", { count: "exact", head: true }).eq("tenant_id", t),
        supa.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", t).eq("role", "student"),
        supa.from("token_usage").select("tokens").eq("tenant_id", t),
      ]);
      const mastered = masteredCount ?? 0;
      const trackedNodes = tracked ?? 0;
      const totalTokens = (tokens ?? []).reduce((s, r) => s + (r.tokens ?? 0), 0);
      return json({
        role: "leadership",
        metrics: {
          students: students ?? 0,
          sessions: sessions ?? 0,
          masteryRate: pct(mastered, trackedNodes),
          trackedNodes,
          aiTokens: totalTokens,
          aiCostUsd: Number((totalTokens / 1_000_000 * 0.3).toFixed(2)),
        },
      });
    }

    // ── ADMIN — RBAC + usage + ops ───────────────────────────────────────────
    if (action === "admin") {
      if (!can(ctx, "iam:user:manage") && !hasRole(ctx, "admin", "campus_admin")) return deny();
      // roles / role_permissions là bảng RBAC toàn hệ (không có tenant_id) → để
      // nguyên; còn profiles / user_roles / token_usage PHẢI chốt tenant (trước
      // đây thiếu → đếm người dùng & token của MỌI tenant).
      const [{ data: roleRows }, { data: profs }, { data: ur }, { data: tokens }, { data: perms }] = await Promise.all([
        supa.from("roles").select("key, label"),
        supa.from("profiles").select("role").eq("tenant_id", t),
        supa.from("user_roles").select("role_key").eq("tenant_id", t),
        supa.from("token_usage").select("tokens").eq("tenant_id", t),
        supa.from("role_permissions").select("role_key"),
      ]);
      const userCount: Record<string, number> = {};
      for (const p of profs ?? []) userCount[p.role] = (userCount[p.role] ?? 0) + 1;
      for (const r of ur ?? []) userCount[r.role_key] = (userCount[r.role_key] ?? 0) + 1;
      const permCount: Record<string, number> = {};
      for (const p of perms ?? []) permCount[p.role_key] = (permCount[p.role_key] ?? 0) + 1;
      const totalTokens = (tokens ?? []).reduce((s, r) => s + (r.tokens ?? 0), 0);
      return json({
        role: "admin",
        roles: (roleRows ?? []).map((r) => ({ key: r.key, label: r.label, users: userCount[r.key] ?? 0, perms: permCount[r.key] ?? 0 })).sort((a, b) => b.perms - a.perms),
        gateway: { provider: "OpenRouter", primary: "z-ai/glm-5.2", tokens: totalTokens, budgetUsd: 50, costUsd: Number((totalTokens / 1_000_000 * 0.3).toFixed(2)) },
        flags: [{ key: "Speaking (Web Speech)", on: true }, { key: "Content Factory (AI sinh)", on: false }, { key: "Streaming chat", on: false }],
      });
    }

    // ── DPO — governance (consent / DSAR / audit) ────────────────────────────
    if (action === "dpo") {
      if (!can(ctx, "privacy:consent:read") && !hasRole(ctx, "dpo", "admin")) return deny();
      const [{ data: consent }, { data: audit }] = await Promise.all([
        supa.from("consent_records").select("purpose, status").eq("tenant_id", t),
        supa.from("audit_logs").select("action, created_at").eq("tenant_id", t).order("created_at", { ascending: false }).limit(8),
      ]);
      const matrix: Record<string, { active: number; withdrawn: number }> = {};
      for (const c of consent ?? []) { matrix[c.purpose] ??= { active: 0, withdrawn: 0 }; matrix[c.purpose][c.status === "active" ? "active" : "withdrawn"]++; }
      return json({
        role: "dpo",
        consent: Object.entries(matrix).map(([purpose, v]) => ({ purpose, ...v })),
        audit: (audit ?? []).map((a) => ({ action: a.action, at: a.created_at })),
        counts: { consentRows: consent?.length ?? 0, dsarOpen: 0 },
      });
    }

    // ── COUNSELOR — safety queue (minimal context, identity anonymised) ──────
    if (action === "counselor") {
      if (!can(ctx, "safety:flag:read") && !hasRole(ctx, "counselor", "admin")) return deny();
      const { data: events } = await supa
        .from("safety_events").select("id, student_id, flag_type, status, created_at").eq("tenant_id", t).order("created_at", { ascending: false }).limit(20);
      const counts = { new: 0, verifying: 0, resolved: 0 };
      for (const e of events ?? []) if (e.status in counts) (counts as Record<string, number>)[e.status]++;
      return json({
        role: "counselor",
        queue: (events ?? []).map((e) => ({ ref: short(e.id), who: short(e.student_id), type: e.flag_type, status: e.status, at: e.created_at })),
        counts,
        note: "Cờ nhạy cảm phải người xác minh trước — KHÔNG tự động báo phụ huynh. Chỉ xem ngữ cảnh tối thiểu. Mọi truy cập được ghi audit.",
      });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
