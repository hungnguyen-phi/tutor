// content-sync — ĐỒNG BỘ nội dung một chiều: DB Studio ("school ai factory") →
// DB Tutor. Đọc Studio qua Management API (secret STUDIO_ACCESS_TOKEN +
// STUDIO_PROJECT_REF), CHUYỂN dạng thô → dạng Tutor, rồi upsert theo khoá bất
// biến KC-/Q-/L-. Idempotent: chạy lại chỉ cập nhật, không nhân bản.
//
// NGUYÊN TẮC:
//  · Chỉ kéo nội dung Studio đã `verified=true` (đã qua QA của Studio).
//  · Nội dung MỚI vào 'review' (human-in-the-loop: GV Tutor duyệt) nhờ BỎ cột
//    trạng thái khỏi payload → insert dùng default 'review', hàng ĐÃ có GIỮ
//    nguyên trạng thái (re-sync không hạ active→review). autoPublish=true →
//    ghi thẳng 'active' (bỏ qua duyệt; chỉ khi tin QA Studio).
//  · Nguồn chân lý = Studio; Tutor giữ bản-sao-phục-vụ (KHÔNG query Studio ở
//    đường nóng chat-turn/diagnose).
//
// Body: { subject?, grade?, autoPublish? } — bỏ trống subject/grade = đồng bộ
// TẤT CẢ (subject,grade) verified đang có ở Studio.
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, hasRole } from "../_shared/auth.ts";

const SUBJECT_MAP: Record<string, string> = {
  "Toán": "Toan", "Tiếng Anh": "Anh", "Ngữ văn": "Van",
  "Giáo dục kinh tế và pháp luật": "GDKTPL", "Hoá học": "Hoa", "Vật lí": "VatLi",
  "Sinh học": "Sinh", "Địa lí": "DiaLi", "Giáo dục công dân": "GDCD",
  "Công nghệ": "CongNghe", "Khoa học tự nhiên": "KHTN", "Oxford English": "Oxford",
};
const mapSubject = (vn: string) => SUBJECT_MAP[vn] ?? vn.normalize("NFKD").replace(/[^\w]/g, "");
const versionLabel = (vnSubject: string, grade: number) => `${vnSubject} ${grade}`;
const esc = (s: string) => s.replace(/'/g, "''");

async function studioQuery<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const token = Deno.env.get("STUDIO_ACCESS_TOKEN");
  const ref = Deno.env.get("STUDIO_PROJECT_REF");
  if (!token || !ref) throw new Error("Thiếu secret STUDIO_ACCESS_TOKEN / STUDIO_PROJECT_REF");
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const b = await res.json();
  if (!res.ok) throw new Error(`Studio query lỗi: ${JSON.stringify(b).slice(0, 200)}`);
  return b as T[];
}

type Studio = Record<string, any>;

function toDistractors(nhieu: unknown) {
  if (!Array.isArray(nhieu)) return [];
  return nhieu.map((d: any) => ({ phuong_an: String(d?.noiDung ?? ""), quan_niem_sai: String(d?.lyDo ?? "") }));
}
function toRungs(a: Studio) {
  return ([[1, "sieu_nhan_thuc", a.bac_1], [2, "huong_chu_y", a.bac_2], [3, "dan_ve_tien_de", a.bac_3], [4, "gian_giao_manh", a.bac_4]] as Array<[number, string, string]>)
    .filter(([, , t]) => t).map(([bac, loai, cau_hoi]) => ({ bac, loai, cau_hoi }));
}

async function upsertAll(supa: ReturnType<typeof admin>, table: string, rows: Array<Record<string, unknown>>, onConflict: string) {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supa.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
  }
}

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    if (!hasRole(ctx, "admin", "campus_admin")) return json({ error: "forbidden: chỉ admin" }, 403, req);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const wantSubject: string | undefined = body.subject;
    const wantGrade: number | undefined = body.grade != null ? Number(body.grade) : undefined;
    const pub = !!body.autoPublish; // true → active; false → giữ default 'review'
    const supa = admin();

    let scope = "verified=true";
    if (wantSubject) scope += ` and subject='${esc(wantSubject)}'`;
    if (wantGrade != null) scope += ` and grade=${wantGrade}`;
    const groups = await studioQuery<{ subject: string; grade: number }>(
      `select subject, grade from atoms where ${scope} group by subject, grade order by subject, grade`,
    );
    if (groups.length === 0) return json({ ok: true, message: "Không có atom verified khớp phạm vi.", synced: [] }, 200, req);

    const report: Array<Record<string, unknown>> = [];

    for (const g of groups) {
      const subj = mapSubject(g.subject);
      const label = versionLabel(g.subject, g.grade);
      const gWhere = `verified=true and subject='${esc(g.subject)}' and grade=${g.grade}`;

      // 1) kg_version
      const { data: verExist } = await supa.from("kg_versions")
        .select("id").eq("tenant_id", ctx.tenantId).eq("subject", subj).eq("label", label).maybeSingle();
      let versionId = verExist?.id as string | undefined;
      if (!versionId) {
        const { data: ins, error } = await supa.from("kg_versions")
          .insert({ tenant_id: ctx.tenantId, subject: subj, label, status: "published" }).select("id").single();
        if (error) throw new Error(`tạo version ${label}: ${error.message}`);
        versionId = ins!.id;
      }

      // 2) NODES + kc_registry (đối chiếu KC- ↔ mã vị trí cũ cho tiebreak lộ trình)
      const atoms = await studioQuery<Studio>(`select id,code,title,chapter,lesson,atom_type,bloom,yeu_cau from atoms where ${gWhere}`);
      const nodeKeys = new Set(atoms.map((a) => a.id));
      const nodeRows = atoms.map((a) => ({
        tenant_id: ctx.tenantId, kg_version_id: versionId, node_key: a.id, subject: subj, grade: String(g.grade),
        chapter: a.chapter, cluster: a.lesson, label: a.title, type: a.atom_type, bloom_cu_tru: a.bloom, mo_ta: a.yeu_cau,
        ...(pub ? { status: "active" } : {}),
      }));
      await upsertAll(supa, "kg_nodes", nodeRows, "kg_version_id,node_key");
      // kc_registry: node_key=KC-, vi_tri_trong_ct=code (mã vị trí đệm-0 → thứ tự bài)
      const regRows = atoms
        .filter((a) => /^KC-\d{7}$/.test(String(a.id)))
        .map((a) => ({ node_key: a.id, vi_tri_trong_ct: a.code, label: a.title, subject: subj, grade: String(g.grade), chapter: a.chapter }));
      await upsertAll(supa, "kc_registry", regRows, "node_key");

      // 3) EDGES (2 đầu trong cùng nhóm node)
      const edges = await studioQuery<Studio>(`select from_id,to_id,relation,weight,remediation_hint from edges where verified=true and from_id in (select id from atoms where subject='${esc(g.subject)}' and grade=${g.grade})`);
      const edgeRows = edges.filter((e) => nodeKeys.has(e.to_id)).map((e) => ({
        tenant_id: ctx.tenantId, kg_version_id: versionId, from_key: e.from_id, to_key: e.to_id,
        relation: e.relation, weight: Number(e.weight ?? 1), ghi_chu: e.remediation_hint ?? null,
      }));
      await upsertAll(supa, "kg_edges", edgeRows, "kg_version_id,from_key,to_key,relation");

      // 4) QUESTIONS
      const qs = await studioQuery<Studio>(`select id,atom_id,noi_dung,tier,dok,do_kho,dap_an,loi_giai,tham_so_hoa,nhieu from questions where atom_id in (select id from atoms where ${gWhere})`);
      const qRows = qs.map((q) => {
        const distractors = toDistractors(q.nhieu);
        return {
          tenant_id: ctx.tenantId, kg_version_id: versionId, question_key: q.id, node_key: q.atom_id,
          tier: q.tier != null ? (parseInt(String(q.tier), 10) || null) : null,
          loai_danh_gia: "objective", nhom_cham: "auto", dang_cau_hoi: distractors.length > 0 ? "mcq" : "dien_dap_an",
          dok: Number(q.dok) || 1, do_kho: q.do_kho ?? "TB", noi_dung: q.noi_dung, dap_an: q.dap_an ?? null,
          loi_giai: q.loi_giai ?? null, distractors, tham_so_hoa: !!q.tham_so_hoa,
          ...(pub ? { trang_thai: "active" } : {}),
        };
      });
      await upsertAll(supa, "questions", qRows, "kg_version_id,question_key");

      // 5) SOCRATIC LADDERS
      const lads = await studioQuery<Studio>(`select id,atom_id,misconception,bac_1,bac_2,bac_3,bac_4,dap_an,luat_no_luc from socratic where atom_id in (select id from atoms where ${gWhere})`);
      const ladRows = lads.map((l) => ({
        tenant_id: ctx.tenantId, kg_version_id: versionId, ladder_key: l.id, node_key: l.atom_id,
        misconception: l.misconception ?? "(chưa gắn)", rungs: toRungs(l),
        bottom_out: { noi_dung: l.dap_an ?? "", dieu_kien_mo: "qua_cong_no_luc" },
        cong_no_luc: { ghi_chu: l.luat_no_luc ?? "", yeu_cau: "thu_toi_thieu_va_giai_thich", so_lan_thu_toi_thieu: 2 },
        ...(pub ? { status: "active" } : {}),
      }));
      await upsertAll(supa, "socratic_ladders", ladRows, "kg_version_id,ladder_key");

      report.push({ subject: subj, grade: g.grade, version: label, nodes: nodeRows.length, edges: edgeRows.length, questions: qRows.length, ladders: ladRows.length });
    }

    await supa.from("audit_logs").insert({
      action: "content_sync", subject_type: "kg", subject_id: ctx.tenantId,
      actor_id: ctx.userId, tenant_id: ctx.tenantId, ai_decision: { groups: report },
    });
    return json({ ok: true, synced: report }, 200, req);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500, req);
  }
});
