// import-kg — cửa nạp bundle KG từ App sản xuất (Studio) qua HTTP.
// Semantics = packages/db/src/import-kg.ts: kg_versions tìm-hoặc-tạo (draft,
// KHÔNG activate), kg_nodes upsert theo (version, node_key) status='review',
// review_queue 1 hàng pending/node (bỏ qua nếu đã pending), kg_edges thay
// nguyên khối theo version. Chỉ giáo viên/admin/leadership được gọi.
// Phục vụ: (1) nút "Gửi nạp" ở TeacherDashboard, (2) nạp CLI qua curl.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const SUBJECTS = new Set(["Toan", "Hoa", "Anh", "Van", "GDKTPL"]);
const RELATIONS = new Set(["prerequisite_hard", "related_soft", "misconception", "cross_subject", "part_of"]);
const CHUNK = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Ai gọi? Chỉ staff nội dung được nạp ──────────────────────────────
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await svc.auth.getUser(jwt);
  if (userErr || !userData.user) return json(401, { error: "unauthorized" });
  const { data: prof } = await svc
    .from("profiles")
    .select("role, tenant_id")
    .eq("id", userData.user.id)
    .single();
  if (!prof || !["teacher", "admin", "leadership"].includes(prof.role)) {
    return json(403, { error: "forbidden: cần vai giáo viên/admin" });
  }

  // ── Kiểm bundle tại cửa (phiên bản gọn của Zod importer) ─────────────
  let b: {
    schema?: string;
    subject?: string;
    grade?: unknown;
    version_label?: string;
    nodes?: Record<string, unknown>[];
    edges?: Record<string, unknown>[];
    resources?: Record<string, unknown>[];
  };
  try {
    b = await req.json();
  } catch {
    return json(400, { error: "body không phải JSON" });
  }
  const issues: string[] = [];
  if (b.schema !== "va.kg-bundle/2.2") issues.push("schema phải là va.kg-bundle/2.2");
  if (!b.subject || !SUBJECTS.has(b.subject)) issues.push("subject không hợp lệ");
  if (!b.version_label || typeof b.version_label !== "string") issues.push("version_label thiếu");
  // Bundle hợp lệ khi có nodes HOẶC resources. Resources là học liệu đã được
  // Studio duyệt (chuẩn trường) nên có thể nạp riêng, không cần kèm nodes.
  const hasNodes = Array.isArray(b.nodes) && b.nodes.length > 0;
  const hasResources = Array.isArray(b.resources) && b.resources.length > 0;
  if (!hasNodes && !hasResources) issues.push("bundle rỗng: cần nodes hoặc resources");
  const edges = Array.isArray(b.edges) ? b.edges : [];
  const seen = new Set<string>();
  for (const n of b.nodes ?? []) {
    const id = String(n.id ?? "");
    if (!id || !n.label || !n.chapter) issues.push(`node thiếu id/label/chapter: ${id || "?"}`);
    if (seen.has(id)) issues.push(`node id trùng: ${id}`);
    seen.add(id);
    if (issues.length > 8) break;
  }
  for (const e of edges) {
    if (!seen.has(String(e.from)) || !seen.has(String(e.to)))
      issues.push(`cạnh tham chiếu treo: ${e.from}→${e.to}`);
    if (!RELATIONS.has(String(e.relation))) issues.push(`relation lạ: ${e.relation}`);
    if (issues.length > 8) break;
  }
  for (const r of hasResources ? b.resources! : []) {
    if (!r.id || !r.node_id || !r.format)
      issues.push(`resource thiếu id/node_id/format: ${String(r.id ?? "?")}`);
    if (issues.length > 8) break;
  }
  if (issues.length > 0) return json(422, { error: "bundle không đạt chuẩn", issues: issues.slice(0, 8) });

  // ── Tenant (pilot một trường — giống guard của importer) ─────────────
  const { data: tenant } = await svc.from("tenants").select("id").eq("slug", "viet-anh").single();
  if (!tenant) return json(500, { error: "tenant viet-anh chưa được seed" });

  // ── Nạp nodes/edges (nếu có) vào bản DRAFT, chờ duyệt ────────────────
  let nodesN = 0, edgesN = 0, queuedN = 0;
  if (hasNodes) {
    // kg_versions: tìm-hoặc-tạo, giữ draft — KHÔNG activate
    let versionId: string;
    const { data: existing } = await svc
      .from("kg_versions")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("subject", b.subject!)
      .eq("label", b.version_label!)
      .limit(1)
      .maybeSingle();
    if (existing) {
      versionId = existing.id;
    } else {
      const { data: created, error: verErr } = await svc
        .from("kg_versions")
        .insert({ tenant_id: tenant.id, subject: b.subject, label: b.version_label, status: "draft" })
        .select("id")
        .single();
      if (verErr || !created) return json(500, { error: "không tạo được kg_versions: " + verErr?.message });
      versionId = created.id;
    }

    // kg_nodes: upsert theo (version, node_key), status review
    const nodeRows = (b.nodes ?? []).map((n) => ({
      tenant_id: tenant.id,
      kg_version_id: versionId,
      node_key: String(n.id),
      subject: b.subject,
      grade: n.grade == null ? null : String(n.grade),
      chapter: (n.chapter as string) ?? null,
      cluster: (n.cluster as string) ?? null,
      label: String(n.label),
      type: (n.type as string) ?? null,
      bloom_cu_tru: (n.bloom_cu_tru as string) ?? null,
      mo_ta: (n.mo_ta as string) ?? null,
      status: "review",
    }));
    for (let i = 0; i < nodeRows.length; i += CHUNK) {
      const { error } = await svc
        .from("kg_nodes")
        .upsert(nodeRows.slice(i, i + CHUNK), { onConflict: "kg_version_id,node_key" });
      if (error) return json(500, { error: `kg_nodes chunk ${i}: ${error.message}` });
    }

    // review_queue: 1 hàng pending/node, bỏ qua node đã pending
    const keys = nodeRows.map((r) => r.node_key);
    const already = new Set<string>();
    for (let i = 0; i < keys.length; i += CHUNK) {
      const { data } = await svc
        .from("review_queue")
        .select("content_id")
        .eq("tenant_id", tenant.id)
        .eq("content_type", "node")
        .eq("status", "pending")
        .in("content_id", keys.slice(i, i + CHUNK));
      for (const r of data ?? []) already.add(r.content_id);
    }
    const queueRows = keys
      .filter((k) => !already.has(k))
      .map((k) => ({
        tenant_id: tenant.id,
        content_type: "node",
        content_id: k,
        ai_generated: false,
        status: "pending",
        note: `bundle ${b.version_label}`,
      }));
    for (let i = 0; i < queueRows.length; i += CHUNK) {
      const { error } = await svc.from("review_queue").insert(queueRows.slice(i, i + CHUNK));
      if (error) return json(500, { error: `review_queue chunk ${i}: ${error.message}` });
    }

    // kg_edges: thay nguyên khối theo version
    const { error: delErr } = await svc.from("kg_edges").delete().eq("kg_version_id", versionId);
    if (delErr) return json(500, { error: "xoá edges cũ: " + delErr.message });
    const edgeRows = edges.map((e) => ({
      tenant_id: tenant.id,
      kg_version_id: versionId,
      from_key: String(e.from),
      to_key: String(e.to),
      relation: String(e.relation),
      weight: Math.min(1, Math.max(0, Number(e.weight ?? 1))),
    }));
    for (let i = 0; i < edgeRows.length; i += CHUNK) {
      const { error } = await svc.from("kg_edges").insert(edgeRows.slice(i, i + CHUNK));
      if (error) return json(500, { error: `kg_edges chunk ${i}: ${error.message}` });
    }
    nodesN = nodeRows.length;
    edgesN = edgeRows.length;
    queuedN = queueRows.length;
  }

  // ── Học liệu (resources): Studio đã duyệt (chuẩn trường) → KHÔNG qua review
  //    ở tutor. Gắn THẲNG lên bản PUBLISHED, status='active' ⇒ học sinh thấy
  //    ngay ở "bài đặc biệt". Có tài nguyên là auto chảy vào.
  let resourcesN = 0;
  if (hasResources) {
    const { data: pub } = await svc
      .from("kg_versions")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("subject", b.subject!)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pub) return json(409, { error: `chưa có bản published cho môn ${b.subject} để gắn học liệu` });
    const resRows = (b.resources ?? []).map((r) => ({
      tenant_id: tenant.id,
      kg_version_id: pub.id,
      resource_key: String(r.id),
      node_key: String(r.node_id),
      tier: r.tier == null ? null : Number(r.tier),
      format: String(r.format),
      ly_do_chon_format: (r.ly_do_chon_format as string) ?? null,
      dual_coding: Boolean(r.dual_coding ?? false),
      accessibility: (r.accessibility as string) ?? null,
      uri: (r.uri as string) ?? null,
      status: "active",
    }));
    for (let i = 0; i < resRows.length; i += CHUNK) {
      const { error } = await svc
        .from("resources")
        .upsert(resRows.slice(i, i + CHUNK), { onConflict: "kg_version_id,resource_key" });
      if (error) return json(500, { error: `resources chunk ${i}: ${error.message}` });
    }
    resourcesN = resRows.length;
  }

  return json(200, {
    ok: true,
    version: b.version_label,
    nodes: nodesN,
    edges: edgesN,
    queued: queuedN,
    resources: resourcesN,
    message: hasResources
      ? `Đã nạp ${resourcesN} học liệu (active — phục vụ ngay)` +
        (hasNodes ? `; ${nodesN} node vào hàng chờ duyệt.` : ".")
      : "Đã vào hàng chờ duyệt — chỉ nội dung được duyệt mới phục vụ học sinh.",
  });
});
