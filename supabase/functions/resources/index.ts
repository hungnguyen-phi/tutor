// resources — học liệu active của một node cho học sinh (INTEGRATION-STUDIO §6.2).
// Bucket 'learning-assets' là PRIVATE: đường dẫn nội bộ được đổi thành signed URL
// 1 giờ bằng service role SAU KHI đã kiểm JWT + tenant. Link http(s) ngoài giữ nguyên.
// Đây là học liệu tự đọc/tự luyện — không ghi mastery_evidence (§6, hai đường ống).
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can } from "../_shared/auth.ts";

const BUCKET = "learning-assets";
const SIGNED_URL_TTL = 3600; // giây — đủ một buổi học; hết hạn thì client xin lại

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    if (!can(ctx, "learn:tutor:chat")) return json({ error: "forbidden" }, 403);

    const { subject, node_key } = await req.json();
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

    const { data: rows } = await supa
      .from("resources")
      .select("id, format, tier, uri, ly_do_chon_format, dual_coding")
      .eq("kg_version_id", version.id)
      .eq("node_key", node_key)
      .eq("status", "active")
      .order("tier", { ascending: true, nullsFirst: false });

    const resources = await Promise.all(
      (rows ?? []).map(async (r) => {
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
          format: r.format,
          tier: r.tier,
          uri,
          ly_do_chon_format: r.ly_do_chon_format,
          dual_coding: r.dual_coding,
        };
      }),
    );

    return json({ resources });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
