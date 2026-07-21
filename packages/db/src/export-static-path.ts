/**
 * Xuất lộ trình TĨNH cho web từ các bundle KG đã convert.
 *
 *   pnpm --filter @tutor/db export:path
 *
 * Vì sao tồn tại: learning-path chưa deploy / node chưa nạp thì app rơi về
 * fallback 1 node ("Bài 1/1") — chủ dự án yêu cầu lộ trình phải ĐẦY các bài.
 * File tĩnh này là chính giáo trình thật (nodes của bundle, đúng thứ tự
 * chương), web dùng làm fallback: node chưa học hiển thị "locked" — trung
 * thực, không nút chết. Khi learning-path trả dữ liệu, serverPath luôn thắng.
 *
 * Ghi ra apps/web/public/kg/path-<slug>.json — chỉ key/label/chapter (đủ để
 * vẽ lộ trình), không kéo cả mo_ta cho nhẹ (TA10 label đã khá dài).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve("../../apps/web/public/kg");

const BUNDLES = [
  { file: "bundles/kg-bundle-toan-10.json", slug: "toan" },
  { file: "bundles/kg-bundle-anh-10.json", slug: "anh" },
  { file: "bundles/kg-bundle-van-10.json", slug: "van" },
] as const;

mkdirSync(OUT_DIR, { recursive: true });

for (const { file, slug } of BUNDLES) {
  const b = JSON.parse(readFileSync(resolve(file), "utf8")) as {
    subject: string;
    grade: number;
    nodes: { id: string; label: string; chapter: string }[];
  };
  const out = {
    subject: b.subject,
    grade: b.grade,
    nodes: b.nodes.map((n) => ({ key: n.id, label: n.label, chapter: n.chapter })),
  };
  const path = resolve(OUT_DIR, `path-${slug}.json`);
  writeFileSync(path, JSON.stringify(out) + "\n", "utf8");
  console.log(`✓ ${b.subject} ${b.grade}: ${out.nodes.length} node → ${path}`);
}
