// learning-path — lộ trình học một môn cho học sinh đang đăng nhập.
// Đọc KG mới nhất đã publish + student_node_state, trả node theo thứ tự tô-pô
// kèm trạng thái xanh/vàng/khoá (docs/INTEGRATION-STUDIO.md §4). Chỉ đọc,
// không tạo session — nên không cần cổng consent (consent gác việc XỬ LÝ
// dữ liệu học, không gác việc xem lộ trình).
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can } from "../_shared/auth.ts";

// "redo": bài đã nộp nhưng giáo viên chấm CHƯA ĐẠT — bàn chân đỏ, mời làm lại.
type NodeState = "mastered" | "stale" | "current" | "available" | "locked" | "redo";

interface NodeRow {
  node_key: string;
  label: string;
  chapter: string | null;
  cluster: string | null;
  revision: number;
  /** kc_registry.vi_tri_trong_ct — thứ tự bài đệm-0 (môn→lớp→chương→bài).
   *  node_key sau re-key là KC-####### ngẫu nhiên, KHÔNG còn mã hoá thứ tự;
   *  tín hiệu thứ tự tường minh này thay nó (hợp đồng docs/DoiUng-Tutor-ReKey.md
   *  mục B). Fallback về node_key nếu registry chưa có dòng khớp (không nên
   *  xảy ra — tránh vỡ toàn bộ topo-sort vì thiếu 1 dòng). */
  seq: string;
}

interface EdgeRow {
  from_key: string; // tiên quyết (seed.ts: T_HS → T_HSB2)
  to_key: string; // phụ thuộc
}

/** Thứ tự ổn định khi tô-pô không quyết định được. Sắp theo `seq` (đệm-0),
 *  KHÔNG theo node_key (KC-####### ngẫu nhiên từ 2026-07 không còn mang thứ
 *  tự). So theo NHÃN "Chương IX" cũng sai vì chuỗi La Mã sắp lệch (IX<V). */
function tiebreak(a: NodeRow, b: NodeRow): number {
  if (a.seq !== b.seq) return a.seq < b.seq ? -1 : 1;
  return 0;
}

/**
 * Kahn trên cạnh prerequisite_hard (from = tiên quyết, to = phụ thuộc).
 * Cạnh chạm node không active (mồ côi sau gộp/xoá) bị bỏ qua — một node
 * không bao giờ được phép bị khoá vĩnh viễn bởi thứ đã ẩn khỏi lộ trình.
 */
function topoSort(nodes: NodeRow[], edges: EdgeRow[]): NodeRow[] {
  const byKey = new Map(nodes.map((n) => [n.node_key, n]));
  const indeg = new Map(nodes.map((n) => [n.node_key, 0]));
  const out = new Map<string, string[]>();
  for (const e of edges) {
    if (!byKey.has(e.from_key) || !byKey.has(e.to_key)) continue;
    indeg.set(e.to_key, (indeg.get(e.to_key) ?? 0) + 1);
    const arr = out.get(e.from_key) ?? [];
    arr.push(e.to_key);
    out.set(e.from_key, arr);
  }

  const ready = nodes.filter((n) => (indeg.get(n.node_key) ?? 0) === 0).sort(tiebreak);
  const order: NodeRow[] = [];
  const seen = new Set<string>();
  while (ready.length > 0) {
    const n = ready.shift()!;
    order.push(n);
    seen.add(n.node_key);
    let unlocked = false;
    for (const k of out.get(n.node_key) ?? []) {
      const d = (indeg.get(k) ?? 0) - 1;
      indeg.set(k, d);
      if (d === 0) {
        ready.push(byKey.get(k)!);
        unlocked = true;
      }
    }
    if (unlocked) ready.sort(tiebreak);
  }
  // Chu trình (dữ liệu lỗi từ Studio) — không sập; phần còn lại xếp theo tiebreak.
  if (order.length < nodes.length) {
    order.push(...nodes.filter((n) => !seen.has(n.node_key)).sort(tiebreak));
  }
  return order;
}

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    if (!can(ctx, "learn:tutor:chat")) return json({ error: "forbidden" }, 403);

    const { subject } = await req.json();
    if (!subject) return json({ error: "subject required" }, 400);

    const supa = admin();

    const { data: version } = await supa
      .from("kg_versions")
      .select("id, label")
      .eq("tenant_id", ctx.tenantId)
      .eq("subject", subject)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // Chưa có KG publish cho môn này → lộ trình rỗng, KHÔNG phải lỗi
    // (LearningPath.tsx có sẵn màn "Chưa có bài học nào").
    if (!version) return json({ version_id: null, version_label: null, nodes: [] });

    const [nodesRes, edgesRes, statesRes, subRes, qRes, attRes] = await Promise.all([
      supa
        .from("kg_nodes")
        .select("node_key, label, chapter, cluster, revision")
        .eq("kg_version_id", version.id)
        .eq("status", "active"),
      supa
        .from("kg_edges")
        .select("from_key, to_key")
        .eq("kg_version_id", version.id)
        .eq("relation", "prerequisite_hard"),
      supa
        .from("student_node_state")
        .select("node_id, mastered, node_revision")
        .eq("student_id", ctx.userId)
        .eq("kg_version_id", version.id),
      // Bài NỘP làm ngoài + kết quả chấm của giáo viên. Lấy CẢ lịch sử rồi mới
      // rút bản mới nhất của từng câu: nộp lại lần nữa phải xoá được dấu đỏ,
      // không thì node đỏ vĩnh viễn dù em đã sửa bài.
      supa
        .from("submissions")
        .select("node_key, question_id, status, created_at")
        .eq("student_id", ctx.userId)
        .eq("kind", "upload")
        .order("created_at", { ascending: true }),
      // Node NÀO đã có câu hỏi luyện (servable) — nền của cơ chế "mở khoá thông
      // minh": chưa có bài tập thì không thể mastery, nên KHÔNG được quyền khoá
      // các bài sau. Khoá theo tiên quyết tự siết lại khi giáo viên cắm câu hỏi.
      supa
        .from("questions")
        .select("node_key")
        .eq("kg_version_id", version.id)
        .eq("trang_thai", "active")
        .eq("tham_so_hoa", false),
      // ĐÃ LÀM BAO NHIÊU CÂU của mỗi bài — đếm câu KHÁC NHAU đã trả lời. Đây là
      // "tiến trình" theo nghĩa học sinh hiểu; mastery_score KHÔNG phải (nó là
      // tỉ lệ đúng trong cửa sổ 4 bằng chứng gần nhất, làm đúng câu ĐẦU TIÊN đã
      // thành 100% trên một bài mới đi được 1/8).
      supa
        .from("attempts")
        .select("node_id, question_id")
        .eq("student_id", ctx.userId)
        .limit(5000), // trần an toàn: một học sinh pilot làm ~vài trăm câu
    ]);

    const rawNodes = nodesRes.data ?? [];
    // kc_registry chỉ tra được SAU khi biết node_key (không lọc theo
    // kg_version_id — registry là bảng đối chiếu chung, không theo version).
    const { data: seqRows } = await supa
      .from("kc_registry")
      .select("node_key, vi_tri_trong_ct")
      .in("node_key", rawNodes.map((n) => n.node_key));
    const seqOf = new Map((seqRows ?? []).map((r) => [r.node_key, r.vi_tri_trong_ct as string]));

    const nodes = rawNodes.map((n) => ({ ...n, seq: seqOf.get(n.node_key) ?? n.node_key })) as NodeRow[];
    const edges = (edgesRes.data ?? []) as EdgeRow[];
    const byKey = new Map(nodes.map((n) => [n.node_key, n]));
    const hasQuestions = new Set<string>((qRes.data ?? []).map((r) => r.node_key));
    // Mẫu số: số câu bài đó CÓ. Tử số: số câu KHÁC NHAU em đã trả lời.
    const qTotal = new Map<string, number>();
    for (const r of qRes.data ?? []) qTotal.set(r.node_key, (qTotal.get(r.node_key) ?? 0) + 1);
    const doneQs = new Map<string, Set<string>>();
    for (const a of attRes.data ?? []) {
      const k = String(a.node_id ?? "");
      if (!k) continue;
      (doneQs.get(k) ?? doneQs.set(k, new Set()).get(k)!).add(String(a.question_id));
    }

    // "Đã học" gồm cả xanh lẫn vàng — dấu đã học không bao giờ bị xoá (§4).
    // Vàng = đã học nhưng nội dung đã đổi NGHĨA sau đó: vẫn mở khoá node sau,
    // chỉ đổi màu để mời ôn lại. Hàng cũ chưa đóng dấu revision (trước v2.2)
    // → tính xanh, không phạt oan.
    const learned = new Set<string>();
    const stale = new Set<string>();
    for (const st of statesRes.data ?? []) {
      const node = byKey.get(st.node_id);
      if (!node) continue; // node đã ẩn/gộp — giữ lịch sử, không hiện trên lộ trình
      if (!st.mastered) continue;
      learned.add(st.node_id);
      if (st.node_revision != null && st.node_revision !== node.revision) stale.add(st.node_id);
    }

    // Bài nộp bị trả về: chỉ tính bản MỚI NHẤT của mỗi câu. Nộp lại (pending) đè
    // lên lần bị trả trước đó → dấu đỏ tự tắt, khỏi cần sửa dữ liệu cũ.
    const latestByQuestion = new Map<string, { node_key: string | null; status: string }>();
    for (const s of subRes.data ?? []) {
      latestByQuestion.set(String(s.question_id), { node_key: s.node_key, status: String(s.status) });
    }
    const redo = new Set<string>();
    const redoCount = new Map<string, number>();
    const pendingCount = new Map<string, number>();
    for (const s of latestByQuestion.values()) {
      if (!s.node_key || !byKey.has(s.node_key)) continue;
      if (s.status === "redo") {
        redo.add(s.node_key);
        redoCount.set(s.node_key, (redoCount.get(s.node_key) ?? 0) + 1);
      }
      // Bài đang CHỜ THẦY CÔ CHẤM: node phải nói ra điều đó ("⏳ chờ chấm"),
      // không thì học sinh nộp xong thấy lộ trình đứng im, tưởng app nuốt bài.
      if (s.status === "pending") {
        pendingCount.set(s.node_key, (pendingCount.get(s.node_key) ?? 0) + 1);
      }
    }

    // Tiên quyết còn thiếu của từng node — chỉ tính cạnh giữa các node active.
    // MỞ KHOÁ THÔNG MINH: bỏ qua tiên quyết CHƯA có câu hỏi (không thể mastery
    // → không được chặn). Nhờ vậy bản đồ đầy đủ vẫn ĐI ĐƯỢC khi nội dung còn
    // thưa; khi giáo viên cắm câu hỏi cho node nền, node đó mới bắt đầu khoá.
    const missing = new Map<string, string[]>();
    for (const e of edges) {
      if (!byKey.has(e.from_key) || !byKey.has(e.to_key)) continue;
      if (learned.has(e.from_key)) continue;
      if (!hasQuestions.has(e.from_key)) continue; // tiên quyết chưa luyện được → không khoá
      const arr = missing.get(e.to_key) ?? [];
      arr.push(e.from_key);
      missing.set(e.to_key, arr);
    }

    interface Item {
      key: string;
      label: string;
      state: NodeState;
      chapter?: string;
      blockedBy?: string[];
      /** Tiến trình dang dở 0..1 = số câu đã làm / số câu của bài (chưa mastered). */
      progress?: number;
      doneCount?: number;
      totalCount?: number;
      /** Số bài nộp đang chờ giáo viên chấm trên node này. */
      pending?: number;
    }

    // Bước 1: trạng thái cơ bản theo thứ tự tô-pô (chưa gán "current").
    // Node đã học giữ nguyên màu kể cả khi cạnh tiên quyết đổi sau đó (§4).
    const items: Item[] = topoSort(nodes, edges).map((n) => {
      let state: NodeState;
      // Bài bị trả về ĐỨNG TRÊN mọi trạng thái khác: dù node đã xanh, có bài
      // chấm chưa đạt là phải làm lại — và không bao giờ bị khoá theo lượt.
      if (redo.has(n.node_key)) {
        state = "redo";
      } else if (learned.has(n.node_key)) {
        state = stale.has(n.node_key) ? "stale" : "mastered";
      } else if ((missing.get(n.node_key)?.length ?? 0) > 0) {
        state = "locked";
      } else {
        state = "available";
      }
      const item: Item = { key: n.node_key, label: n.label, state };
      // chapter → LearningPath.tsx gom thành CHẶNG (điểm dừng khi cuộn).
      if (n.chapter) item.chapter = n.chapter;
      // blockedBy = MẢNG KEY tiên quyết còn thiếu; client tự đổi ra tên bài.
      if (state === "locked") item.blockedBy = missing.get(n.node_key)!;
      if (!learned.has(n.node_key)) {
        const done = doneQs.get(n.node_key)?.size ?? 0;
        const total = qTotal.get(n.node_key) ?? 0;
        if (done > 0 && total > 0) {
          item.progress = Math.round(Math.min(1, done / total) * 100) / 100;
          item.doneCount = Math.min(done, total);
          item.totalCount = total;
        }
      }
      if (pendingCount.has(n.node_key)) item.pending = pendingCount.get(n.node_key)!;
      return item;
    });

    // Bước 2: điểm BẮT ĐẦU = node available ĐẦU TIÊN CÓ câu hỏi (bấm là luyện
    // được ngay). Chưa có node nào có bài → lấy node available đầu tiên.
    let curIdx = items.findIndex((it) => it.state === "available" && hasQuestions.has(it.key));
    if (curIdx < 0) curIdx = items.findIndex((it) => it.state === "available");
    if (curIdx >= 0) items[curIdx]!.state = "current";

    // Bước 3: KHOÁ MỌI BÀI SAU BÀI ĐANG HỌC (quyết định chủ dự án 2026-07-27).
    // Trước đây mọi node đủ tiên quyết đều là "available" nên học sinh bấm nhảy
    // cóc được — mastery learning đòi đi tuần tự, học chắc bài này mới sang bài
    // sau. Node đã học (mastered/stale) GIỮ NGUYÊN để còn ôn lại; chỉ hạ những
    // node CHƯA học nằm SAU điểm hiện tại.
    //
    // blockedBy để TRỐNG có chủ đích: node này không thiếu tiên quyết, nó chỉ
    // chưa tới lượt. Client gặp blockedBy rỗng thì hiện "Chưa mở" — đúng nghĩa,
    // không bịa ra bài tiên quyết không tồn tại.
    if (curIdx >= 0) {
      for (let i = curIdx + 1; i < items.length; i++) {
        if (items[i]!.state === "available") items[i]!.state = "locked";
      }
    }

    return json({ version_id: version.id, version_label: version.label, nodes: items });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
