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

    return json({
      resources,
      mucDaQua,
      mucDangMo,
      mucCoSan,
      // Còn mức nào phía sau chưa mở → client mời quay lại.
      conMucSau: mucCoSan.some((m) => m > mucDangMo),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
