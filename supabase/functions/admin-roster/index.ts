// admin-roster — quản trị LỚP & HỌC SINH (Pha 3): tạo lớp, tạo/gán tài khoản
// thật, import danh sách, phân công GVCN/coach/buddy, liên kết phụ huynh.
// Scaffold đồng bộ hệ thống trường (CHƯA cắm). Chỉ admin/campus_admin.
//
// Identity + tenant từ JWT (authenticate) — không tin client. Mọi ghi CHỐT tenant.
// Bảo mật: allowlist vai (chống leo thang), rate-limit, audit log, không lộ mật
// khẩu tài khoản có quyền, xác thực class_id thuộc tenant, kiểm lỗi mọi lệnh ghi.
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can, hasRole } from "../_shared/auth.ts";

/** Mật khẩu tạm mạnh (người dùng đổi/đăng nhập SSO sau). crypto an toàn. */
function tempPassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (const b of bytes) out += chars[b % chars.length];
  return out + "#7"; // đảm bảo có số + ký tự đặc biệt cho policy mật khẩu
}

const norm = (v: unknown) => String(v ?? "").trim();
const email = (v: unknown) => norm(v).toLowerCase();

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    // CHỈ admin quản trị roster (phòng-thủ-chiều-sâu; UI cũng gác).
    if (!can(ctx, "iam:user:manage") && !hasRole(ctx, "admin", "campus_admin")) {
      return json({ error: "forbidden" }, 403);
    }

    const supa = admin();
    const t = ctx.tenantId;

    // Rate-limit theo người gọi (chống lạm dụng tạo tài khoản hàng loạt).
    if (req.method === "POST") {
      const { data: allowed } = await supa.rpc("rl_hit", { p_key: `roster:${ctx.userId}`, p_max: 60, p_window_sec: 60 });
      if (allowed === false) return json({ error: "rate_limited", message: "Thao tác quá nhanh, chờ chút rồi thử lại." }, 429);
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action: string = body.action ?? "overview";

    // Ghi audit (best-effort, không chặn luồng chính).
    const audit = (act: string, subjectType: string | null, subjectId: string | null, meta: unknown = null) =>
      supa.from("audit_logs").insert({ tenant_id: t, actor_id: ctx.userId, action: act, subject_type: subjectType, subject_id: subjectId, ai_decision: meta }).then(() => {}, () => {});

    // ── Allowlist VAI (chống leo thang) ────────────────────────────────────────
    // profiles.role enum: student|teacher|parent|admin|leadership. Qua roster CHỈ
    // gán student/parent tự do; 'teacher' cần quyền cấp vai; admin/leadership KHÔNG
    // BAO GIỜ gán qua roster (làm ở màn RBAC riêng) → chặn campus_admin tự nâng cấp.
    const canGrant = can(ctx, "iam:role:grant");
    const sanitizeRole = (requested: string): string => {
      const r = (norm(requested) || "student").toLowerCase();
      if (r === "student" || r === "parent") return r;
      if (r === "teacher") {
        if (!canGrant) throw new Error("Cần quyền cấp vai (iam:role:grant) để tạo tài khoản giáo viên");
        return "teacher";
      }
      throw new Error(`Không được gán vai '${requested}' qua roster — dùng màn quản trị RBAC.`);
    };

    // ── Helpers ──────────────────────────────────────────────────────────────
    type Prof = { id: string; role: string; full_name: string | null; class_id: string | null; grade: string | null };
    const findByEmail = async (em: string): Promise<Prof | null> => {
      if (!em) return null;
      // .eq (không ilike): email trong DB đã lowercased → khớp CHÍNH XÁC, không để
      // '%'/'_' thành ký tự đại diện (an toàn khi giải danh tính).
      const { data } = await supa
        .from("profiles").select("id, role, full_name, class_id, grade")
        .eq("tenant_id", t).eq("email", em).maybeSingle();
      return (data as Prof) ?? null;
    };

    const classInTenant = async (classId: string): Promise<boolean> => {
      if (!classId) return false;
      const { data } = await supa.from("classes").select("id").eq("id", classId).eq("tenant_id", t).maybeSingle();
      return !!data;
    };

    /** Tạo auth user (nếu chưa có profile khớp email) — trả id + mật khẩu tạm nếu mới. */
    const ensureUser = async (em: string, fullName: string | null): Promise<{ id: string; created: boolean; tempPassword?: string }> => {
      const existing = await findByEmail(em);
      if (existing) return { id: existing.id, created: false };
      const pw = tempPassword();
      const { data, error } = await supa.auth.admin.createUser({
        email: em, password: pw, email_confirm: true, user_metadata: { full_name: fullName ?? "" },
      });
      if (error || !data?.user) {
        throw new Error(`Không tạo được tài khoản ${em}: ${error?.message ?? "unknown"}`);
      }
      return { id: data.user.id, created: true, tempPassword: pw };
    };

    /** Tạo/cập nhật một người. role ĐÃ được sanitize ở nơi gọi. Kiểm lỗi mọi ghi;
     *  nếu ghi hồ sơ thất bại cho user MỚI → xoá auth user để không mồ côi email. */
    const upsertOne = async (row: { email: string; fullName: string | null; grade: string | null; classId: string | null; role: string }) => {
      const existing = await findByEmail(row.email);
      if (existing) {
        const patch: Record<string, unknown> = { email: row.email };
        if (row.fullName) patch.full_name = row.fullName;
        if (row.grade) patch.grade = row.grade;
        if (row.classId) patch.class_id = row.classId;
        // Đổi vai: KHÔNG được HẠ (hay đổi) vai một tài khoản ĐANG nâng cao
        // (teacher/admin/leadership) nếu người gọi không có quyền cấp vai —
        // chặn cả LEO THANG lẫn HẠ BẬC staff (vd campus_admin hạ hiệu trưởng
        // xuống 'parent' để vô hiệu hoá). student/parent đổi qua lại thì tự do.
        if (row.role && row.role !== "student" && row.role !== existing.role) {
          const elevated = existing.role !== "student" && existing.role !== "parent";
          if (elevated && !canGrant) {
            throw new Error(`Không được đổi vai tài khoản '${existing.role}' qua roster (cần quyền cấp vai).`);
          }
          patch.role = row.role;
        }
        const { error } = await supa.from("profiles").update(patch).eq("id", existing.id).eq("tenant_id", t);
        if (error) throw new Error(error.message);
        return { id: existing.id, created: false as const, role: existing.role };
      }
      const u = await ensureUser(row.email, row.fullName);
      const { error } = await supa.from("profiles").upsert(
        { id: u.id, tenant_id: t, role: row.role, full_name: row.fullName, grade: row.grade, class_id: row.classId, email: row.email },
        { onConflict: "id" },
      );
      if (error) {
        if (u.created) await supa.auth.admin.deleteUser(u.id).catch(() => {}); // dọn để retry được
        throw new Error(error.message);
      }
      return { id: u.id, created: true as const, role: row.role, tempPassword: u.tempPassword };
    };

    // ── OVERVIEW: lớp + sĩ số + tổng ───────────────────────────────────────────
    if (action === "overview") {
      const { data: classes } = await supa
        .from("classes")
        .select("id, grade, name, school_year, homeroom_teacher_id, homeroom:homeroom_teacher_id(full_name)")
        .eq("tenant_id", t).order("grade").order("name");
      // Sĩ số mỗi lớp: head-count riêng từng lớp (chính xác, không dính trần 1000 dòng).
      const counts = await Promise.all((classes ?? []).map((c) =>
        supa.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", t).eq("role", "student").eq("class_id", c.id).then((r) => [c.id, r.count ?? 0] as const),
      ));
      const countBy = Object.fromEntries(counts);
      const [{ count: totalStudents }, { count: unassigned }] = await Promise.all([
        supa.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", t).eq("role", "student"),
        supa.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", t).eq("role", "student").is("class_id", null),
      ]);
      return json({
        classes: (classes ?? []).map((c) => ({
          id: c.id, grade: c.grade, name: c.name, schoolYear: c.school_year,
          homeroom: (Array.isArray(c.homeroom) ? c.homeroom[0] : c.homeroom)?.full_name ?? null,
          students: countBy[c.id] ?? 0,
        })),
        totals: { students: totalStudents ?? 0, unassigned: unassigned ?? 0 },
      });
    }

    // ── ROSTER: học sinh (của một lớp, hoặc chưa xếp lớp, hoặc tất cả) ─────────
    if (action === "roster") {
      const classId = body.classId ? norm(body.classId) : null;
      let q = supa.from("profiles").select("id, full_name, email, grade, class_id")
        .eq("tenant_id", t).eq("role", "student").order("full_name").limit(500);
      if (classId === "__none__") q = q.is("class_id", null);
      else if (classId) q = q.eq("class_id", classId);
      const { data } = await q;
      return json({ students: (data ?? []).map((s) => ({ id: s.id, name: s.full_name, email: s.email, grade: s.grade, classId: s.class_id })) });
    }

    // ── CREATE CLASS ───────────────────────────────────────────────────────────
    if (action === "createClass") {
      const grade = norm(body.grade), name = norm(body.name);
      if (!grade || !name) return json({ error: "Thiếu khối hoặc tên lớp" }, 422);
      let homeroomId: string | null = null;
      if (body.homeroomTeacherEmail) homeroomId = (await findByEmail(email(body.homeroomTeacherEmail)))?.id ?? null;
      const { data, error } = await supa.from("classes")
        .insert({ tenant_id: t, grade, name, school_year: body.schoolYear ? norm(body.schoolYear) : null, homeroom_teacher_id: homeroomId })
        .select("id").maybeSingle();
      if (error) return json({ error: error.message.includes("duplicate") ? "Lớp này đã tồn tại" : error.message }, 400);
      await audit("roster.class.create", "class", data?.id ?? null, { name, grade });
      return json({ ok: true, id: data?.id });
    }

    // ── UPSERT STUDENT (thêm tay một học sinh) ─────────────────────────────────
    if (action === "upsertStudent") {
      const em = email(body.email);
      if (!em) return json({ error: "Thiếu email" }, 422);
      const classId = body.classId ? norm(body.classId) : null;
      if (classId && !(await classInTenant(classId))) return json({ error: "Lớp không thuộc trường của bạn" }, 422);
      const res = await upsertOne({ email: em, fullName: norm(body.fullName) || null, grade: body.grade ? norm(body.grade) : null, classId, role: "student" });
      await audit(res.created ? "roster.student.create" : "roster.student.update", "profile", res.id, null);
      // Mật khẩu tạm chỉ trả cho tài khoản HỌC SINH mới (đăng nhập pilot). Không cho vai khác.
      return json({ ok: true, id: res.id, created: res.created, tempPassword: res.created ? res.tempPassword : undefined });
    }

    // ── IMPORT (bulk từ CSV đã parse ở client) ─────────────────────────────────
    if (action === "import") {
      const rows: Record<string, unknown>[] = Array.isArray(body.rows) ? body.rows : [];
      if (rows.length === 0) return json({ error: "Không có dòng nào để nạp" }, 422);
      if (rows.length > 1000) return json({ error: "Tối đa 1000 dòng mỗi lần nạp" }, 422);
      const schoolYear = body.schoolYear ? norm(body.schoolYear) : null;
      // Cache lớp theo ĐÚNG khoá DB (name, school_year) — KHỚP classes_name_year_uq,
      // không lệch theo grade (tránh nhân bản lớp / học sinh rơi về chưa-xếp-lớp).
      const { data: existingClasses } = await supa.from("classes").select("id, name, school_year").eq("tenant_id", t);
      const ckey = (n: string, y: string | null) => `${n}|||${y ?? ""}`;
      const classMap = new Map<string, string>();
      for (const c of existingClasses ?? []) classMap.set(ckey(c.name, c.school_year), c.id);
      const ensureClass = async (grade: string, name: string): Promise<string | null> => {
        if (!name) return null;
        const k = ckey(name, schoolYear);
        const hit = classMap.get(k);
        if (hit) return hit;
        const ins = await supa.from("classes").insert({ tenant_id: t, grade, name, school_year: schoolYear }).select("id").maybeSingle();
        if (ins.data?.id) { classMap.set(k, ins.data.id); return ins.data.id; }
        // Trùng (đã có lớp cùng tên+năm) → tìm lại theo đúng khoá DB thay vì bỏ null.
        let q = supa.from("classes").select("id").eq("tenant_id", t).eq("name", name);
        q = schoolYear ? q.eq("school_year", schoolYear) : q.is("school_year", null);
        const { data: found } = await q.maybeSingle();
        if (found?.id) { classMap.set(k, found.id); return found.id; }
        throw new Error(ins.error?.message ?? `Không tạo/khớp được lớp ${name}`);
      };
      let created = 0, updated = 0;
      const errors: { email: string; error: string }[] = [];
      const credentials: { email: string; password: string }[] = [];
      for (const r of rows) {
        try {
          const em = email(r.email ?? r.Email);
          if (!em) { errors.push({ email: "(trống)", error: "thiếu email" }); continue; }
          let role: string;
          try { role = sanitizeRole(norm(r.role ?? r.vaitro ?? "")); }
          catch (e) { errors.push({ email: em, error: e instanceof Error ? e.message : String(e) }); continue; }
          const grade = norm(r.grade ?? r.khoi ?? r["khối"] ?? "") || null;
          const className = norm(r.class ?? r.className ?? r.lop ?? r["lớp"] ?? "");
          const classId = className ? await ensureClass(grade ?? "", className) : null;
          const fullName = norm(r.fullName ?? r.name ?? r.hoTen ?? r["họ tên"] ?? r["hovaten"] ?? "") || null;
          const res = await upsertOne({ email: em, fullName, grade, classId, role });
          if (res.created) {
            created++;
            // Chỉ lộ mật khẩu tạm cho HỌC SINH/PHỤ HUYNH (không cho giáo viên/nâng cao).
            if (res.tempPassword && (role === "student" || role === "parent")) credentials.push({ email: em, password: res.tempPassword });
          } else updated++;
        } catch (e) {
          errors.push({ email: email(r.email ?? r.Email) || "?", error: e instanceof Error ? e.message : String(e) });
        }
      }
      await audit("roster.import", null, null, { created, updated, errorCount: errors.length });
      return json({ ok: true, created, updated, errorCount: errors.length, errors: errors.slice(0, 20), credentials });
    }

    // ── ASSIGN HOMEROOM (GVCN cho lớp) — set cột + tạo coaching_links thật ─────
    if (action === "assignHomeroom") {
      const classId = norm(body.classId);
      if (!(await classInTenant(classId))) return json({ error: "Lớp không thuộc trường của bạn" }, 422);
      const teacher = await findByEmail(email(body.teacherEmail));
      if (!teacher) return json({ error: "Không tìm thấy giáo viên (theo email)" }, 422);
      const { error: eCls } = await supa.from("classes").update({ homeroom_teacher_id: teacher.id }).eq("id", classId).eq("tenant_id", t);
      if (eCls) return json({ error: eCls.message }, 400);
      // Tạo coaching_links(homeroom_coach) cho MỌI học sinh trong lớp → dashboard
      // coach/scoreboard mới thực sự hiện coachee (chỉ set cột không đủ).
      const { data: students } = await supa.from("profiles").select("id").eq("tenant_id", t).eq("class_id", classId).eq("role", "student");
      const links = (students ?? []).map((s) => ({ tenant_id: t, student_id: s.id, mentor_id: teacher.id, kind: "homeroom_coach", cadence_days: 28 }));
      if (links.length) {
        const { error: eLink } = await supa.from("coaching_links").upsert(links, { onConflict: "student_id,mentor_id,kind" });
        if (eLink) return json({ error: eLink.message }, 400);
      }
      await audit("roster.homeroom.assign", "class", classId, { teacher: teacher.id, linked: links.length });
      return json({ ok: true, linked: links.length });
    }

    // ── ASSIGN MENTOR (coach GVCN / buddy) ─────────────────────────────────────
    if (action === "assignMentor") {
      const student = await findByEmail(email(body.studentEmail));
      const mentor = await findByEmail(email(body.mentorEmail));
      if (!student || !mentor) return json({ error: "Không tìm thấy học sinh hoặc người đồng hành (theo email)" }, 422);
      const kind = body.kind === "buddy" ? "buddy" : "homeroom_coach";
      const { error } = await supa.from("coaching_links").upsert(
        { tenant_id: t, student_id: student.id, mentor_id: mentor.id, kind, cadence_days: kind === "buddy" ? 7 : (Number(body.cadenceDays) || 28) },
        { onConflict: "student_id,mentor_id,kind" },
      );
      if (error) return json({ error: error.message }, 400);
      await audit("roster.mentor.assign", "profile", student.id, { mentor: mentor.id, kind });
      return json({ ok: true });
    }

    // ── LINK PARENT (tạo/nối phụ huynh với học sinh) ───────────────────────────
    if (action === "linkParent") {
      const student = await findByEmail(email(body.studentEmail));
      if (!student) return json({ error: "Không tìm thấy học sinh (theo email)" }, 422);
      const pEmail = email(body.parentEmail);
      if (!pEmail) return json({ error: "Thiếu email phụ huynh" }, 422);
      let parent = await findByEmail(pEmail);
      let parentCreated = false;
      if (!parent) {
        const u = await ensureUser(pEmail, norm(body.parentName) || null);
        parentCreated = u.created;
        const { error } = await supa.from("profiles").upsert(
          { id: u.id, tenant_id: t, role: "parent", full_name: norm(body.parentName) || null, email: pEmail },
          { onConflict: "id" },
        );
        if (error) {
          if (u.created) await supa.auth.admin.deleteUser(u.id).catch(() => {});
          return json({ error: error.message }, 400);
        }
        parent = { id: u.id } as Prof;
      } else {
        // Nâng vai lên parent nếu đang là student (không hạ staff).
        await supa.from("profiles").update({ role: "parent" }).eq("id", parent.id).eq("tenant_id", t).eq("role", "student");
      }
      const { error } = await supa.from("guardian_links").upsert(
        { tenant_id: t, guardian_id: parent.id, student_id: student.id },
        { onConflict: "guardian_id,student_id" },
      );
      if (error) return json({ error: error.message }, 400);
      await audit("roster.parent.link", "profile", student.id, { parent: parent.id, parentCreated });
      return json({ ok: true, parentCreated });
    }

    // ── SYNC (scaffold — CHƯA cắm hệ thống trường) ─────────────────────────────
    if (action === "sync") {
      return json({
        ok: false, connected: false,
        note: "Đồng bộ hệ thống trường (SIS / Google Classroom) mới dựng khung, CHƯA cắm nguồn. Kích hoạt khi đội vận hành nối API trường.",
      });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
