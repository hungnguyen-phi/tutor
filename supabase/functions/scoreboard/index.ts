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
    const self = targetId === ctx.userId;
    const staff = isStaff(ctx);
    let mentorKind: string | null = null;
    if (!self && !staff) {
      const { data: link } = await supa
        .from("coaching_links")
        .select("kind")
        .eq("student_id", targetId)
        .eq("mentor_id", ctx.userId)
        .maybeSingle();
      if (!link) return json({ error: "forbidden" }, 403);
      mentorKind = link.kind;
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
        .from("wigs").select("area, title, progress_pct, source").eq("student_id", targetId);
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
    const [{ data: prof }, { data: wigs }, { data: leads }, { data: board }, { data: links }] = await Promise.all([
      supa.from("profiles").select("full_name").eq("id", targetId).single(),
      supa.from("wigs").select("area, title, target_desc, progress_pct, source, sort").eq("student_id", targetId).order("sort"),
      supa.from("lead_measures").select("label, target_text, value_text, status, sort").eq("student_id", targetId).eq("week_start", week).order("sort"),
      supa.from("scoreboard_weeks").select("effort_rank, effort_scope, commitment, synced_at").eq("student_id", targetId).eq("week_start", week).maybeSingle(),
      supa.from("coaching_links").select("kind, cadence_days, last_meeting_at, mentor:mentor_id(full_name)").eq("student_id", targetId),
    ]);

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
      effort: { rank: board?.effort_rank ?? null, scope: board?.effort_scope ?? "lop" },
      commitment: board?.commitment ?? "",
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
