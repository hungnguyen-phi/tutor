// scoreboard — the student's 4DX Weekly Scoreboard (WIGs, lead measures, effort
// rank, coach/buddy, commitment) + the "push to school 4DX" sync.
// Access: a student reads their own; staff read tenant-wide; a linked coach or
// buddy reads their mentee (buddy gets a limited peer view). Writes (commit/sync)
// are self-only (or staff). Identity comes from the JWT — never client ids.
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can, type AuthCtx } from "../_shared/auth.ts";

const STAFF_ROLES = new Set(["teacher", "admin", "leadership"]);
const AREA_LABEL: Record<string, string> = {
  kien_thuc: "Kiến thức",
  ky_nang: "Kỹ năng",
  tieng_anh: "Tiếng Anh",
  the_chat: "Thể chất",
};
const AREA_SUBJECT: Record<string, string> = { kien_thuc: "Toán", tieng_anh: "Tiếng Anh" };

/** Monday (ISO date) of the week containing `d`. */
function mondayOf(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

function isStaff(ctx: AuthCtx): boolean {
  return STAFF_ROLES.has(ctx.role) || can(ctx, "report:student:read");
}

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action: string = body.action ?? "get";
    const targetId: string = body.studentId ?? ctx.userId;
    const supa = admin();

    // ── Authorize access to this student ─────────────────────────────────────
    // CHỐT tenant: studentId đến từ client → không được tin để đọc xuyên tenant.
    // - self: đọc chính mình.
    // - staff: chỉ trong tenant của mình → PHẢI xác nhận học sinh cùng tenant.
    // - mentor/buddy: link phải thuộc đúng tenant (link cùng tenant ⇒ cùng tenant).
    const self = targetId === ctx.userId;
    const staff = isStaff(ctx);
    let mentorKind: string | null = null;
    if (!self) {
      if (staff) {
        const { data: tp } = await supa
          .from("profiles").select("tenant_id").eq("id", targetId).maybeSingle();
        if (!tp || tp.tenant_id !== ctx.tenantId) return json({ error: "forbidden" }, 403);
      } else {
        const { data: link } = await supa
          .from("coaching_links")
          .select("kind")
          .eq("tenant_id", ctx.tenantId)
          .eq("student_id", targetId)
          .eq("mentor_id", ctx.userId)
          .maybeSingle();
        if (!link) return json({ error: "forbidden" }, 403);
        mentorKind = link.kind;
      }
    }
    const limited = mentorKind === "buddy"; // peer view: no coach details, read-only
    const week: string = body.weekStart ?? mondayOf(new Date());

    // ── Mutations ────────────────────────────────────────────────────────────
    if (action === "commit") {
      if (!self) return json({ error: "forbidden" }, 403); // only the student commits
      const commitment: string = (body.commitment ?? "").toString().slice(0, 280);
      await supa.from("scoreboard_weeks").upsert(
        { tenant_id: ctx.tenantId, student_id: targetId, week_start: week, commitment, updated_at: new Date().toISOString() },
        { onConflict: "student_id,week_start" },
      );
      return json({ ok: true, commitment });
    }

    if (action === "sync") {
      if (!self && !staff) return json({ error: "forbidden" }, 403);
      const syncedAt = new Date().toISOString();
      await supa.from("scoreboard_weeks").upsert(
        { tenant_id: ctx.tenantId, student_id: targetId, week_start: week, synced_at: syncedAt, updated_at: syncedAt },
        { onConflict: "student_id,week_start" },
      );
      const { data: wigs } = await supa
        .from("wigs").select("area, title, progress_pct, source").eq("tenant_id", ctx.tenantId).eq("student_id", targetId);
      // Envelope the school 4DX app can ingest (live endpoint binding pending).
      const exportPayload = {
        source: "viet-anh-tutor",
        student_id: targetId,
        week_start: week,
        synced_at: syncedAt,
        wigs: (wigs ?? []).map((w) => ({ area: w.area, title: w.title, progress_pct: w.progress_pct, owned_by_tutor: w.source === "tutor" })),
      };
      return json({ ok: true, syncedAt, export: exportPayload, note: "Đã ghi nhận; endpoint 4DX trường sẽ nhận payload này." });
    }

    // ── Read (default) ───────────────────────────────────────────────────────
    // Mọi truy vấn CHỐT tenant — targetId đã được xác nhận cùng tenant ở trên.
    const t = ctx.tenantId;
    const [{ data: prof }, { data: wigs }, { data: leads }, { data: board }, { data: links }, { data: myXp }] = await Promise.all([
      supa.from("profiles").select("full_name, grade").eq("id", targetId).eq("tenant_id", t).single(),
      supa.from("wigs").select("area, title, target_desc, progress_pct, source, sort").eq("tenant_id", t).eq("student_id", targetId).order("sort"),
      supa.from("lead_measures").select("label, target_text, value_text, status, sort").eq("tenant_id", t).eq("student_id", targetId).eq("week_start", week).order("sort"),
      supa.from("scoreboard_weeks").select("effort_rank, effort_scope, commitment, synced_at").eq("tenant_id", t).eq("student_id", targetId).eq("week_start", week).maybeSingle(),
      supa.from("coaching_links").select("kind, cadence_days, last_meeting_at, mentor:mentor_id(full_name)").eq("tenant_id", t).eq("student_id", targetId),
      supa.from("student_xp").select("xp_total, streak, last_day").eq("student_id", targetId).maybeSingle(),
    ]);

    // ── BẢNG TUẦN THẬT (roadmap 1.5): bạn cùng KHỐI (grade) + XP tuần + chuỗi ──
    // Tuần tính từ 00:00 thứ Hai giờ VN. Chỉ trả cho self/staff — mentor/buddy
    // xem hộ thì không cần danh sách cả khối của người khác.
    const weekStartIso = new Date(`${week}T00:00:00+07:00`).toISOString();
    let rows: Array<{ id: string; name: string; xp: number; streak: number; me: boolean }> | null = null;
    let myWeekXp = 0;
    let realRank: number | null = null;
    if (self || staff) {
      const { data: mates } = await supa
        .from("profiles")
        .select("id, full_name")
        .eq("tenant_id", t)
        .eq("role", "student")
        .eq("grade", prof?.grade ?? "")
        .limit(200);
      const ids = (mates ?? []).map((m) => m.id);
      if (ids.length > 0) {
        const [{ data: weekEvents }, { data: xps }] = await Promise.all([
          supa.from("xp_events").select("student_id, amount").eq("tenant_id", t).gte("created_at", weekStartIso).in("student_id", ids),
          supa.from("student_xp").select("student_id, streak, last_day").eq("tenant_id", t).in("student_id", ids),
        ]);
        const weekBy = new Map<string, number>();
        for (const ev of weekEvents ?? []) {
          weekBy.set(ev.student_id, (weekBy.get(ev.student_id) ?? 0) + ev.amount);
        }
        // Chuỗi "nguội" (bỏ lỡ từ hôm kia trở đi, giờ VN) thì không khoe trên bảng.
        const todayVN = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
        const yesterVN = new Date(Date.now() + 7 * 3600_000 - 86400_000).toISOString().slice(0, 10);
        const streakBy = new Map<string, number>();
        for (const x of xps ?? []) {
          const warm = x.last_day === todayVN || x.last_day === yesterVN;
          streakBy.set(x.student_id, warm ? x.streak : 0);
        }
        rows = (mates ?? [])
          .map((m) => ({
            id: m.id,
            name: m.full_name ?? "Học sinh",
            xp: weekBy.get(m.id) ?? 0,
            streak: streakBy.get(m.id) ?? 0,
            me: m.id === targetId,
          }))
          .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name, "vi"));
        const idx = rows.findIndex((r) => r.me);
        if (idx >= 0) {
          realRank = idx + 1;
          myWeekXp = rows[idx]!.xp;
        }
      }
    }

    const coachLink = (links ?? []).find((l) => l.kind === "homeroom_coach");
    const buddyLink = (links ?? []).find((l) => l.kind === "buddy");
    const mentorName = (l: { mentor?: { full_name?: string } | { full_name?: string }[] } | undefined) => {
      const m = Array.isArray(l?.mentor) ? l?.mentor[0] : l?.mentor;
      return m?.full_name ?? null;
    };

    return json({
      student: { id: targetId, name: prof?.full_name ?? "Học sinh" },
      weekStart: week,
      viewer: { self, staff, mentorKind },
      limited,
      wigs: (wigs ?? []).map((w) => ({
        area: w.area, areaLabel: AREA_LABEL[w.area] ?? w.area,
        title: w.title, targetDesc: w.target_desc,
        progressPct: Math.round(w.progress_pct), source: w.source,
      })),
      leadMeasures: (leads ?? []).map((l) => ({ label: l.label, targetText: l.target_text, valueText: l.value_text, status: l.status })),
      // Hạng THẬT từ XP tuần khi có bảng; chưa có dữ liệu tuần thì rơi về hạng
      // seed trong scoreboard_weeks (nếu có).
      effort: { rank: realRank ?? board?.effort_rank ?? null, scope: board?.effort_scope ?? "khoi" },
      commitment: board?.commitment ?? "",
      xp: {
        total: Number(myXp?.xp_total ?? 0),
        week: myWeekXp,
        streak: myXp?.streak ?? 0,
        lastDay: myXp?.last_day ?? null,
      },
      board: rows ? { scope: "khoi", rows } : null,
      subjectProgress: (wigs ?? [])
        .filter((w) => w.source === "tutor")
        .map((w) => ({ subject: AREA_SUBJECT[w.area] ?? AREA_LABEL[w.area], pct: Math.round(w.progress_pct) })),
      coach: limited || !coachLink ? null : { name: mentorName(coachLink), cadenceDays: coachLink.cadence_days, lastMeetingAt: coachLink.last_meeting_at },
      buddy: buddyLink ? { name: mentorName(buddyLink), lastMeetingAt: buddyLink.last_meeting_at } : null,
      sync: { syncedAt: board?.synced_at ?? null },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
