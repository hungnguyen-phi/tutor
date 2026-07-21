/**
 * Chuyển khung tri thức từ Studio (data/db.json) thành gói KgBundle v2.2.
 *
 *   pnpm --filter @tutor/db convert:kg -- --grade=9 [--subject=toan|anh] [--studio-db=<path>] [--out=<path>] [--label=<label>]
 *
 * Chỉ xuất KHUNG (nodes + edges) — câu hỏi/thang/tài nguyên đi đường ống khác
 * (Trạm 3–5 chưa chạy). Bundle rỗng các mảng đó vẫn hợp lệ theo schema.
 *
 * Đây là hiện thân tạm của quyết định "Tutor kéo, Studio không đẩy": chừng nào
 * Studio chưa mở 3 endpoint đọc, script này đọc thẳng db.json trên cùng máy.
 * Không cần .env — thuần biến đổi file, không chạm DB.
 *
 * Ánh xạ trường (Studio → KgBundle):
 *   code→id · title→label · atomType→type · bloom→bloom_cu_tru · yeuCau→mo_ta
 *   chapter = tổ tiên kind='chapter' · cluster = cha trực tiếp (lesson)
 *   Edge: from/to/relation/weight giữ nguyên (enum hai bên trùng khớp);
 *   bloomGap/quanNiemSai/tanSuat/remediationHint gói vào ghi_chu để không mất dữ liệu.
 *   `nangLuc` bị BỎ — KgNode chưa có chỗ chứa; muốn giữ thì phải nâng schema trước.
 *
 * KHÔNG lọc theo cờ `verified` của Studio: cờ này đang chấm ngược nhau giữa atom
 * và edge (TO09 atom false/edge true, TO10 ngược lại). Cổng chất lượng thật nằm ở
 * Tutor: importer mặc định đưa mọi thứ vào review_queue chờ người duyệt.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { KgBundle } from "@tutor/shared";

type StudioNode = {
  id: string;
  kind: "subject" | "grade" | "chapter" | "lesson" | "point" | "atom";
  parentId: string | null;
  title: string;
  code: string;
  atomType?: string;
  bloom?: string;
  dok?: number;
  nangLuc?: string;
  yeuCau?: string;
  verified?: boolean;
};

type StudioEdge = {
  id: string;
  from: string;
  to: string;
  relation: string;
  weight: number;
  bloomGap?: number;
  quanNiemSai?: string;
  tanSuat?: string;
  remediationHint?: string;
};

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const grade = Number(opt("grade"));
if (!Number.isInteger(grade)) {
  console.error("✗ Dùng: pnpm --filter @tutor/db convert:kg -- --grade=9 [--subject=toan|anh] [--studio-db=<path>] [--out=<path>]");
  process.exit(1);
}

// Môn: tên trong cây Studio ↔ enum KgBundle ↔ slug đặt tên file. Tiếng Anh
// chưa có edges (Trạm 2 kho chưa sản xuất) — bundle 0 cạnh vẫn hợp lệ.
const SUBJECTS = {
  toan: { title: "Toán", enum: "Toan", slug: "toan" },
  anh: { title: "Tiếng Anh", enum: "Anh", slug: "anh" },
  van: { title: "Ngữ văn", enum: "Van", slug: "van" },
  hoa: { title: "Hoá học", enum: "Hoa", slug: "hoa" },
} as const;
const subjectKey = (opt("subject") ?? "toan").toLowerCase() as keyof typeof SUBJECTS;
const SUBJ = SUBJECTS[subjectKey];
if (!SUBJ) {
  console.error(`✗ --subject='${opt("subject")}' không hỗ trợ — dùng: ${Object.keys(SUBJECTS).join(" | ")}`);
  process.exit(1);
}

const studioDb = opt("studio-db") ?? "D:/school ai/studio/data/db.json";
const label = opt("label") ?? `khung-${SUBJ.slug}-${grade}`;
const out = resolve(opt("out") ?? `bundles/kg-bundle-${SUBJ.slug}-${grade}.json`);

// ── 1. Đọc Studio db.json, dựng chỉ mục cây. ─────────────────────────────────
const db = JSON.parse(readFileSync(studioDb, "utf8")) as { tree: StudioNode[]; edges: StudioEdge[] };
const byId = new Map(db.tree.map((n) => [n.id, n]));

/** Leo cây tới tổ tiên có kind mong muốn (atom → lesson → chapter → grade → subject). */
function ancestor(n: StudioNode, kind: StudioNode["kind"]): StudioNode | undefined {
  let cur: StudioNode | undefined = n;
  while (cur) {
    if (cur.kind === kind) return cur;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return undefined;
}

// Chọn atom theo cây (đúng môn + đúng khối), không theo prefix mã — mã là quy ước
// có thể lệch, cây parentId là sự thật của Studio.
const atoms = db.tree.filter((n) => {
  if (n.kind !== "atom") return false;
  if (ancestor(n, "subject")?.title !== SUBJ.title) return false;
  const g = ancestor(n, "grade");
  return g ? /(\d+)\s*$/.test(g.code) && Number(g.code.match(/(\d+)\s*$/)![1]) === grade : false;
});

if (atoms.length === 0) {
  console.error(`✗ Không tìm thấy atom ${SUBJ.title} khối ${grade} nào trong ${studioDb}`);
  process.exit(1);
}

// ── 2. Ánh xạ node — dữ liệu thiếu bị chặn TẠI CỬA, không âm thầm bịa. ───────
const BLOOM = new Set(["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]);
const TYPE = new Set(["KN", "QT", "KY", "VD"]);
const bad: string[] = [];
const seen = new Set<string>();
let moTaFallback = 0;

const nodes = atoms.flatMap((a) => {
  if (seen.has(a.code)) {
    bad.push(`${a.code}: mã trùng lặp`);
    return [];
  }
  seen.add(a.code);
  if (!a.atomType || !TYPE.has(a.atomType)) bad.push(`${a.code}: atomType '${a.atomType}' không hợp lệ`);
  if (!a.bloom || !BLOOM.has(a.bloom)) bad.push(`${a.code}: bloom '${a.bloom}' không hợp lệ`);
  const chapter = ancestor(a, "chapter")?.title.trim();
  if (!chapter) bad.push(`${a.code}: không tìm thấy chương tổ tiên`);
  if (!a.yeuCau) moTaFallback++;
  return [{
    id: a.code,
    subject: SUBJ.enum,
    grade,
    chapter: chapter ?? "",
    cluster: ancestor(a, "lesson")?.title.trim(),
    label: a.title,
    type: a.atomType as "KN" | "QT" | "KY" | "VD",
    bloom_cu_tru: a.bloom as "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create",
    mo_ta: a.yeuCau ?? a.title,
  }];
});

if (bad.length > 0) {
  console.error(`✗ ${bad.length} atom không đạt chuẩn — sửa ở Studio rồi chạy lại:\n`);
  for (const b of bad.slice(0, 15)) console.error(`  · ${b}`);
  if (bad.length > 15) console.error(`  … và ${bad.length - 15} lỗi nữa`);
  process.exit(1);
}

// ── 3. Cạnh: chỉ giữ cạnh nội bộ khối; gói metadata sư phạm vào ghi_chu. ─────
const keys = new Set(nodes.map((n) => n.id));
const edgeSeen = new Set<string>();
let selfLoops = 0;
let dupEdges = 0;

const edges = db.edges.flatMap((e) => {
  if (!keys.has(e.from) || !keys.has(e.to)) return [];
  if (e.from === e.to) {
    selfLoops++;
    return [];
  }
  const dedupeKey = `${e.from}→${e.to}:${e.relation}`;
  if (edgeSeen.has(dedupeKey)) {
    dupEdges++;
    return [];
  }
  edgeSeen.add(dedupeKey);
  const notes = [
    e.bloomGap != null ? `bloomGap=${e.bloomGap}` : null,
    e.quanNiemSai ? `QNS: ${e.quanNiemSai}` : null,
    e.tanSuat ? `tần suất: ${e.tanSuat}` : null,
    e.remediationHint ? `gợi ý: ${e.remediationHint}` : null,
  ].filter(Boolean);
  return [{
    from: e.from,
    to: e.to,
    relation: e.relation as "prerequisite_hard" | "related_soft" | "misconception",
    weight: Math.min(1, Math.max(0, e.weight)),
    ...(notes.length ? { ghi_chu: notes.join(" · ") } : {}),
  }];
});

// ── 4. Validate bằng chính Zod của importer rồi mới ghi file. ─────────────────
const bundle = {
  schema: "va.kg-bundle/2.2" as const,
  subject: SUBJ.enum,
  grade,
  version_label: label,
  nguon: `Studio db.json (${studioDb}) — quy trình 6 Trạm, xuất ${new Date().toISOString().slice(0, 10)}`,
  nodes,
  edges,
};

const parsed = KgBundle.safeParse(bundle);
if (!parsed.success) {
  console.error("✗ Bundle sinh ra không khớp schema va.kg-bundle/2.2 — lỗi của script này:\n");
  for (const issue of parsed.error.issues.slice(0, 20)) {
    console.error(`  · ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(parsed.data, null, 2) + "\n", "utf8");

const rel = { prerequisite_hard: 0, related_soft: 0, misconception: 0 } as Record<string, number>;
for (const e of edges) rel[e.relation] = (rel[e.relation] ?? 0) + 1;

console.log(`✓ ${SUBJ.title} ${grade}: ${nodes.length} node, ${edges.length} cạnh → ${out}`);
console.log(`  cạnh: ${Object.entries(rel).map(([k, v]) => `${k}=${v}`).join(" · ")}`);
if (moTaFallback > 0) console.log(`  ⚠ ${moTaFallback} atom thiếu yeuCau — mo_ta tạm dùng title`);
if (selfLoops > 0) console.log(`  ⚠ bỏ ${selfLoops} cạnh tự trỏ`);
if (dupEdges > 0) console.log(`  ⚠ bỏ ${dupEdges} cạnh trùng (from,to,relation)`);
console.log(`  nạp thử:  pnpm --filter @tutor/db import:kg -- ${out}`);
console.log(`  (mặc định vào review_queue — KHÔNG --activate: bundle khung 0 câu hỏi,`);
console.log(`   publish sẽ đè version seed đang có câu hỏi và làm rỗng luồng diagnose)`);
