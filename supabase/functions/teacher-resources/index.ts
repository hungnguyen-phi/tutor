// teacher-resources — giáo viên tự gắn HỌC LIỆU vào từng bài.
//
// Trước đây học liệu chỉ vào được bằng gói import-kg từ Xưởng; cô giáo không có
// đường nào tự đưa slide/phiếu/video của mình cho lớp. Đây là đường đó.
//
// Bốn việc:
//   nodes  — duyệt TOÀN BỘ bài của môn, lọc theo LỚP cô dạy; kèm số câu hỏi và
//            số học liệu đã có, để cô biết bài nào còn trống.
//   list   — học liệu của một bài (kể cả mục đang ẨN — cô phải thấy để bật lại).
//   save   — thêm/sửa một học liệu. Nhiều định dạng của CÙNG một học liệu dùng
//            chung `resource_key`; cái nào tick hien_thi thì học sinh thấy, tick
//            nhiều thì hiện song song.
//   toggle — bật/tắt hiển thị. remove — gỡ hẳn.
//
// Học liệu KHÔNG ghi mastery (tự học). Mức 1/2/3 mở dần theo resource_progress —
// mỗi lượt vào kho báu chỉ ăn thêm một mức (xem function `resources`).
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can } from "../_shared/auth.ts";

const FORMATS = [
  "text", "infographic", "video", "animation", "mindmap", "podcast",
  "worked_example", "interactive", "slide", "worksheet", "flashcard", "quiz",
] as const;

/** Khoá gom nhóm cho học liệu do giáo viên đăng (Xưởng dùng khoá riêng của họ). */
const newKey = () => `HL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401, req);
    // Gắn học liệu là việc chuyên môn — cùng quyền với duyệt nội dung / đọc lớp.
    if (!can(ctx, "content:review:approve") && !can(ctx, "report:class:read")) {
      return json({ error: "forbidden" }, 403, req);
    }
    const supa = admin();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "nodes");

    // Version đang phục vụ của môn — mọi thao tác đều bám version này, không
    // hardcode: mỗi lần re-key id đổi, hardcode xong là học liệu mồ côi.
    const subject = String(body.subject ?? "Toan");
    const { data: version } = await supa
      .from("kg_versions")
      .select("id, label, subject")
      .eq("tenant_id", ctx.tenantId)
      .eq("subject", subject)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!version) return json({ nodes: [], classes: [], version: null }, 200, req);

    // ── Duyệt bài ───────────────────────────────────────────────────────────
    if (action === "nodes") {
      // LỚP CÔ DẠY: từ teacher_assignments (kèm chủ nhiệm). Không có phân công
      // nào → coi như dạy chung toàn khối, vẫn cho duyệt bài (pilot một trường
      // một khối); nói rõ trong `phamVi` để giao diện khỏi hứa suông.
      const { data: pc } = await supa
        .from("teacher_assignments")
        .select("class_id, subject, is_homeroom")
        .eq("tenant_id", ctx.tenantId)
        .eq("teacher_id", ctx.userId);
      const classIds = [...new Set((pc ?? []).map((x) => String(x.class_id ?? "")).filter(Boolean))];
      const { data: lop } = classIds.length
        ? await supa.from("classes").select("id, name, grade").in("id", classIds)
        : { data: [] };

      const [{ data: nodes }, { data: qs }, { data: res }] = await Promise.all([
        supa.from("kg_nodes")
          .select("node_key, label, chapter")
          .eq("kg_version_id", version.id)
          .eq("status", "active"),
        supa.from("questions")
          .select("node_key")
          .eq("kg_version_id", version.id)
          .eq("trang_thai", "active"),
        supa.from("resources")
          .select("node_key, hien_thi")
          .eq("kg_version_id", version.id),
      ]);
      const demCau = new Map<string, number>();
      for (const q of qs ?? []) demCau.set(q.node_key, (demCau.get(q.node_key) ?? 0) + 1);
      const demHL = new Map<string, { tong: number; hien: number }>();
      for (const r of res ?? []) {
        const cur = demHL.get(r.node_key) ?? { tong: 0, hien: 0 };
        cur.tong += 1;
        if (r.hien_thi) cur.hien += 1;
        demHL.set(r.node_key, cur);
      }
      // Thứ tự chương trình: kc_registry (node_key sau re-key không còn mang thứ tự).
      const keys = (nodes ?? []).map((n) => n.node_key);
      const { data: reg } = keys.length
        ? await supa.from("kc_registry").select("node_key, vi_tri_trong_ct").in("node_key", keys)
        : { data: [] };
      const seq = new Map((reg ?? []).map((r) => [r.node_key, String(r.vi_tri_trong_ct ?? "")]));
      const items = (nodes ?? [])
        .map((n) => ({
          key: n.node_key,
          label: n.label,
          chapter: n.chapter ?? "",
          soCau: demCau.get(n.node_key) ?? 0,
          soHocLieu: demHL.get(n.node_key)?.tong ?? 0,
          soHien: demHL.get(n.node_key)?.hien ?? 0,
          _s: seq.get(n.node_key) ?? n.node_key,
        }))
        .sort((a, b) => (a._s < b._s ? -1 : a._s > b._s ? 1 : 0))
        .map(({ _s, ...rest }) => rest);

      return json({
        version: { id: version.id, label: version.label, subject: version.subject },
        classes: (lop ?? []).map((c: Record<string, unknown>) => ({ id: c.id, name: c.name, grade: c.grade })),
        // Học liệu gắn theo BÀI nên dùng chung cho mọi lớp học bài đó — nói thẳng
        // để cô không tưởng mỗi lớp một kho riêng.
        phamVi: classIds.length
          ? "Học liệu gắn theo BÀI, mọi lớp học bài này đều thấy."
          : "Bạn chưa được phân công lớp nào — vẫn gắn được học liệu cho mọi bài của môn.",
        nodes: items,
      }, 200, req);
    }

    // ── Học liệu của một bài ────────────────────────────────────────────────
    if (action === "list") {
      const nodeKey = String(body.nodeKey ?? "");
      if (!nodeKey) return json({ error: "nodeKey required" }, 400, req);
      const { data: rows, error } = await supa
        .from("resources")
        .select("id, resource_key, tieu_de, format, tier, uri, ly_do_chon_format, hien_thi, status, created_at")
        .eq("kg_version_id", version.id)
        .eq("node_key", nodeKey)
        .order("tier", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 500, req);
      const { data: node } = await supa
        .from("kg_nodes").select("label, chapter")
        .eq("kg_version_id", version.id).eq("node_key", nodeKey).maybeSingle();
      return json({ node: { key: nodeKey, label: node?.label ?? nodeKey, chapter: node?.chapter ?? "" }, items: rows ?? [] }, 200, req);
    }

    // ── Thêm / sửa ──────────────────────────────────────────────────────────
    if (action === "save") {
      const nodeKey = String(body.nodeKey ?? "");
      const format = String(body.format ?? "");
      const uri = String(body.uri ?? "").trim();
      const tier = Math.min(3, Math.max(1, Number(body.tier) || 1));
      if (!nodeKey || !uri) return json({ error: "nodeKey và uri là bắt buộc" }, 400, req);
      if (!FORMATS.includes(format as typeof FORMATS[number])) {
        return json({ error: "định dạng không hợp lệ" }, 400, req);
      }
      // Node phải thuộc version đang phục vụ — chặn gắn học liệu vào bài đã gỡ.
      const { data: node } = await supa
        .from("kg_nodes").select("node_key")
        .eq("kg_version_id", version.id).eq("node_key", nodeKey).maybeSingle();
      if (!node) return json({ error: "bài không có trong chương trình đang chạy" }, 404, req);
      // Đường dẫn tệp phải nằm trong thư mục học liệu của TRƯỜNG MÌNH; link
      // ngoài thì phải là http(s) — chặn gán bừa đường dẫn nội bộ của người khác.
      const laLink = /^https?:\/\//i.test(uri);
      if (!laLink && !uri.startsWith(`hoc-lieu/${ctx.tenantId}/`)) {
        return json({ error: "đường dẫn tệp không hợp lệ" }, 400, req);
      }

      const row = {
        tenant_id: ctx.tenantId,
        kg_version_id: version.id,
        node_key: nodeKey,
        resource_key: String(body.resourceKey ?? "").trim() || newKey(),
        tieu_de: String(body.tieuDe ?? "").slice(0, 160) || null,
        format,
        tier,
        uri,
        ly_do_chon_format: String(body.goiY ?? "").slice(0, 200) || null,
        hien_thi: body.hienThi !== false,
        status: "active",
        lang: "vi",
        nguoi_dang: ctx.userId,
      };

      if (body.id) {
        const { error } = await supa.from("resources").update(row)
          .eq("id", String(body.id)).eq("tenant_id", ctx.tenantId);
        if (error) return json({ error: error.message }, 500, req);
        return json({ ok: true, id: body.id }, 200, req);
      }
      const { data: ins, error } = await supa.from("resources").insert(row).select("id").single();
      if (error) return json({ error: error.message }, 500, req);
      return json({ ok: true, id: ins?.id }, 200, req);
    }

    // ── Bật / tắt hiển thị ──────────────────────────────────────────────────
    if (action === "toggle") {
      const { error } = await supa.from("resources")
        .update({ hien_thi: body.hienThi === true })
        .eq("id", String(body.id ?? "")).eq("tenant_id", ctx.tenantId);
      if (error) return json({ error: error.message }, 500, req);
      return json({ ok: true }, 200, req);
    }

    // ── Gỡ ──────────────────────────────────────────────────────────────────
    if (action === "remove") {
      const { data: r } = await supa.from("resources")
        .select("uri").eq("id", String(body.id ?? "")).eq("tenant_id", ctx.tenantId).maybeSingle();
      const { error } = await supa.from("resources")
        .delete().eq("id", String(body.id ?? "")).eq("tenant_id", ctx.tenantId);
      if (error) return json({ error: error.message }, 500, req);
      // Tệp trong kho xoá theo, khỏi để rác; link ngoài thì thôi.
      if (r?.uri && !/^https?:\/\//i.test(String(r.uri))) {
        await supa.storage.from("learning-assets").remove([String(r.uri)]);
      }
      return json({ ok: true }, 200, req);
    }

    return json({ error: "unknown action" }, 400, req);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500, req);
  }
});
