// resources — HỌC LIỆU của một bài cho học sinh ("kho báu" trên lộ trình).
//
// Bucket 'learning-assets' là PRIVATE: đường dẫn nội bộ được đổi thành signed URL
// 1 giờ bằng service role SAU KHI đã kiểm JWT + tenant. Link http(s) ngoài giữ nguyên.
// Đây là học liệu tự đọc/tự luyện — KHÔNG ghi mastery_evidence (§6, hai đường ống).
//
// BA MỨC MỞ DẦN (như bậc thang, không phải mở toang): mức đang mở =
// resource_progress.muc_da_qua + 1. Mỗi lượt học sinh bấm "đã xong mức này" chỉ
// ăn THÊM MỘT mức rồi phải quay lại lần sau — cố ý, để kho báu là lý do trở lại
// bài cũ chứ không phải một đống tài liệu đổ ập một lần rồi thôi.
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can } from "../_shared/auth.ts";
import { awardXp } from "../_shared/xp.ts";

/** 3 định dạng "ôn lại" trong thanh cạnh câu hỏi (chủ dự án 09/2026) — audio/
 *  video/ảnh, KHÔNG gồm quiz/flashcard (thứ luyện SAU khi đã hiểu, không giúp
 *  được lúc đang bí) hay mindmap/slide (ở lại Kho báu, không nhân đôi chỗ hiện). */
const RAIL_FORMATS = ["video", "podcast", "infographic"] as const;

const BUCKET = "learning-assets";
const SIGNED_URL_TTL = 3600; // giây — đủ một buổi học; hết hạn thì client xin lại
const MUC_TOI_DA = 3;

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    if (!can(ctx, "learn:tutor:chat")) return json({ error: "forbidden" }, 403);

    const body = await req.json();
    const { subject, node_key } = body;
    const action = String(body.action ?? "list");
    if (!subject || !node_key) return json({ error: "subject and node_key required" }, 400);

    const supa = admin();

    const { data: version } = await supa
      .from("kg_versions")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("subject", subject)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!version) return json({ resources: [] });

    // ── CỔNG KHOÁ: bài chưa mở thì kho báu cũng chưa mở ────────────────────
    // Chặn ở client là chưa đủ — gọi thẳng API vẫn lấy được học liệu của bài xa
    // tít phía sau. Ở đây kiểm ĐIỀU KIỆN TIÊN QUYẾT (cạnh prerequisite_hard):
    // còn bài tiên quyết chưa thành thạo → khoá. (Không mô phỏng thêm luật "khoá
    // mọi bài sau bài đang học" của lộ trình: luật đó cần topo-sort toàn đồ thị,
    // và phần chênh chỉ là học liệu của bài kế tiếp — client đã ẩn.)
    const [{ data: canh }, { data: daHoc }] = await Promise.all([
      supa.from("kg_edges").select("from_key")
        .eq("kg_version_id", version.id)
        .eq("relation", "prerequisite_hard")
        .eq("to_key", node_key),
      supa.from("student_node_state").select("node_id")
        .eq("student_id", ctx.userId)
        .eq("kg_version_id", version.id)
        .eq("mastered", true),
    ]);
    const xong = new Set((daHoc ?? []).map((s) => String(s.node_id)));
    const thieu = (canh ?? []).map((e) => String(e.from_key)).filter((k) => !xong.has(k));
    if (thieu.length > 0 && !xong.has(String(node_key))) {
      return json({ resources: [], mucDaQua: 0, mucDangMo: 0, mucCoSan: [], conMucSau: false, khoa: true });
    }

    // ── THANH ÔN LẠI cạnh câu hỏi (audio/video/ảnh) + thưởng XP xem hết ─────
    // KHÔNG theo luật "ba mức mở dần" của Kho báu (đó là cơ chế MỜI QUAY LẠI
    // nhiều lần; đây là tài liệu ôn TRƯỚC KHI làm bài, nên hiện hết ngay, không
    // khoá theo tier). "Xem" = học sinh BẤM MỞ popup — trình duyệt không bắt
    // được sự kiện "phát xong" qua iframe YouTube/Drive khác tên miền, nên đây
    // là tín hiệu chắc chắn nhất đo được, không giả vờ đo "xem hết thật".
    if (action === "rail") {
      const { data: rows } = await supa
        .from("resources")
        .select("id, resource_key, tieu_de, format, uri, ly_do_chon_format")
        .eq("kg_version_id", version.id)
        .eq("node_key", node_key)
        .eq("status", "active")
        .eq("hien_thi", true)
        .in("format", RAIL_FORMATS as unknown as string[]);
      const all = rows ?? [];
      const ids = all.map((r) => r.id);
      const { data: viewedRows } = ids.length
        ? await supa.from("resource_views").select("resource_id").eq("student_id", ctx.userId).in("resource_id", ids)
        : { data: [] as { resource_id: string }[] };
      const daXemSet = new Set((viewedRows ?? []).map((v) => v.resource_id));
      const resources = await Promise.all(
        all.map(async (r) => {
          let uri: string | null = r.uri ?? null;
          if (uri && !/^https?:\/\//i.test(uri)) {
            const { data: signed } = await supa.storage.from(BUCKET).createSignedUrl(uri, SIGNED_URL_TTL);
            uri = signed?.signedUrl ?? null;
          }
          return {
            id: r.id,
            resourceKey: r.resource_key,
            tieuDe: r.tieu_de ?? null,
            format: r.format,
            uri,
            lyDoChonFormat: r.ly_do_chon_format,
            daXem: daXemSet.has(r.id),
          };
        }),
      );
      return json({ resources, daXemHet: resources.length > 0 && resources.every((r) => r.daXem) });
    }

    if (action === "markViewed") {
      const resourceId = String(body.resourceId ?? "");
      if (!resourceId) return json({ error: "resourceId required" }, 400);
      await supa.from("resource_views").upsert(
        { tenant_id: ctx.tenantId, student_id: ctx.userId, kg_version_id: version.id, node_key, resource_id: resourceId },
        { onConflict: "student_id,resource_id" },
      );
      const { data: rows } = await supa
        .from("resources")
        .select("id")
        .eq("kg_version_id", version.id)
        .eq("node_key", node_key)
        .eq("status", "active")
        .eq("hien_thi", true)
        .in("format", RAIL_FORMATS as unknown as string[]);
      const ids = (rows ?? []).map((r) => r.id);
      let xp: Awaited<ReturnType<typeof awardXp>> = null;
      if (ids.length > 0) {
        const { data: viewedRows } = await supa.from("resource_views").select("resource_id").eq("student_id", ctx.userId).in("resource_id", ids);
        const daXemSet = new Set((viewedRows ?? []).map((v) => v.resource_id));
        const daXemHet = ids.every((id) => daXemSet.has(id));
        if (daXemHet) {
          xp = await awardXp(supa, ctx.tenantId, ctx.userId, [
            { kind: "resource_review", nodeId: String(node_key), kgVersionId: version.id },
          ]);
        }
      }
      return json({ ok: true, ...(xp ? { xp } : {}) });
    }

    const { data: prog } = await supa
      .from("resource_progress")
      .select("muc_da_qua")
      .eq("student_id", ctx.userId)
      .eq("kg_version_id", version.id)
      .eq("node_key", node_key)
      .maybeSingle();
    let mucDaQua = Math.min(MUC_TOI_DA, Math.max(0, Number(prog?.muc_da_qua) || 0));

    // ── Ghi nhận "đã xong mức này" ─────────────────────────────────────────
    // Cộng ở SERVER, cộng ĐÚNG MỘT mức, và chỉ khi mức đó thật sự đang mở —
    // client tự khai số mức thì mở toang kho báu bằng một lời gọi API.
    if (action === "done") {
      const mucGui = Math.min(MUC_TOI_DA, Math.max(1, Number(body.muc) || 1));
      if (mucGui === mucDaQua + 1) {
        mucDaQua = mucGui;
        await supa.from("resource_progress").upsert(
          {
            tenant_id: ctx.tenantId,
            student_id: ctx.userId,
            kg_version_id: version.id,
            node_key,
            muc_da_qua: mucDaQua,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "student_id,kg_version_id,node_key" },
        );
      }
    }

    const { data: rows } = await supa
      .from("resources")
      .select("id, resource_key, tieu_de, format, tier, uri, ly_do_chon_format, dual_coding")
      .eq("kg_version_id", version.id)
      .eq("node_key", node_key)
      .eq("status", "active")
      .eq("hien_thi", true)
      .order("tier", { ascending: true, nullsFirst: false });

    const all = rows ?? [];
    const mucDangMo = Math.min(MUC_TOI_DA, mucDaQua + 1);
    // Chỉ ký link cho phần học sinh ĐƯỢC XEM lúc này — mức chưa mở thì không
    // trả uri, kẻo mở devtools là thấy hết.
    const hienDuoc = all.filter((r) => (Number(r.tier) || 1) <= mucDangMo);

    const resources = await Promise.all(
      hienDuoc.map(async (r) => {
        let uri: string | null = r.uri ?? null;
        if (uri && !/^https?:\/\//i.test(uri)) {
          // Đường dẫn trong bucket → ký URL. Ký hỏng (file chưa upload) → null;
          // client tự ẩn thay vì đưa học sinh vào link chết.
          const { data: signed } = await supa.storage
            .from(BUCKET)
            .createSignedUrl(uri, SIGNED_URL_TTL);
          uri = signed?.signedUrl ?? null;
        }
        return {
          id: r.id,
          nhom: r.resource_key ?? r.id,
          tieuDe: r.tieu_de ?? null,
          format: r.format,
          tier: Number(r.tier) || 1,
          uri,
          ly_do_chon_format: r.ly_do_chon_format,
          dual_coding: r.dual_coding,
        };
      }),
    );

    // Các mức CÓ học liệu (để client vẽ 3 bậc thang đúng thực tế: bài chỉ có
    // mức 1 thì không vẽ ba bậc rồi để em chờ mãi mức không bao giờ tới).
    const mucCoSan = [...new Set(all.map((r) => Number(r.tier) || 1))].sort();

    // CÂU NỘP BÀI của cùng bài — để kho báu có đường NỘP LẠI ngay dưới phiếu
    // bài tập (lỗi 1: "tải về làm xong thì không có chỗ nào nộp lên").
    // Không đổi schema: bài nộp vẫn gắn vào một câu [NOPBAI] có thật của node,
    // nên nó chảy đúng vào hàng đợi chấm của giáo viên như mọi bài khác.
    let nopBaiQuestionId: string | null = null;
    if (all.some((r) => r.format === "worksheet")) {
      const { data: nb } = await supa
        .from("questions")
        .select("id, noi_dung")
        .eq("kg_version_id", version.id)
        .eq("node_key", node_key)
        .eq("trang_thai", "active")
        .ilike("noi_dung", "[NOPBAI]%")
        .order("question_key", { ascending: true })
        .limit(1)
        .maybeSingle();
      nopBaiQuestionId = nb?.id ?? null;
    }

    return json({
      resources,
      mucDaQua,
      mucDangMo,
      mucCoSan,
      // Còn mức nào phía sau chưa mở → client mời quay lại.
      conMucSau: mucCoSan.some((m) => m > mucDangMo),
      ...(nopBaiQuestionId ? { nopBaiQuestionId } : {}),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
