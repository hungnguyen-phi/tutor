# Onboard một MÔN MỚI vào Tutor (Đợt D)

Mở một môn Studio đã soạn (GDKTPL 10, Công nghệ 8–9, GDCD 9…) trên app tutor.
`subject` là cột **text** (không phải enum ràng buộc) nên **không cần migration enum** —
chỉ cần bundle dữ liệu + chạy importer.

## 1. Studio cấp 1 bundle JSON (theo mã atom bất biến)

```json
{
  "subject": "GDKTPL", "grade": "10", "label": "GDKTPL 10 — Kết nối tri thức",
  "nodes":     [{ "node_key": "KP10-C01-A01", "label": "...", "chapter": "C01",
                  "cluster": "...", "type": "KN", "bloom_cu_tru": "Understand",
                  "mo_ta": "...", "est_minutes": 8 }],
  "edges":     [{ "from_key": "KP10-C01-A02", "to_key": "KP10-C01-A01",
                  "relation": "prerequisite_hard", "weight": 1.0 }],
  "questions": [{ "question_key": "KP10-C01-A01-Q1", "node_key": "KP10-C01-A01",
                  "dang_cau_hoi": "mcq", "loai_danh_gia": "objective", "nhom_cham": "auto",
                  "noi_dung": "...", "dap_an": "A",
                  "distractors": [{ "phuong_an": "B", "quan_niem_sai": "..." }],
                  "tier": 1, "dok": 2, "do_kho": "de" }]
}
```

- `node_key` / `question_key` = **mã atom Studio** (khóa idempotent — sync lại không nhân đôi).
- `relation` ∈ `prerequisite_hard | related_soft | misconception | cross_subject | part_of`.
- `dang_cau_hoi` theo 17 dạng đã hỗ trợ (mcq, dung_sai, sap_xep, noi_cot, dien_dap_an,
  viet_doan, phan_bien…). Câu objective phải có `dap_an`; câu rubric nên kèm `rubric`.

## 2. Kiểm tra bundle (không ghi DB)

```
node scripts/import-kg-subject.mjs <bundle.json> --dry
```

Báo lỗi nếu thiếu trường bắt buộc, cạnh trỏ tới node lạ, hoặc `question_key` trùng.

## 3. Nạp vào production (idempotent)

```
node scripts/import-kg-subject.mjs <bundle.json>
```

Tạo/tái dùng `kg_versions` (status `published`) → upsert `kg_nodes` (theo
`kg_version_id,node_key`) → nạp lại `kg_edges` → upsert `questions` (theo
`kg_version_id,question_key`). Chạy lại an toàn khi kho Studio cập nhật.

## 4. Bật môn trên web

Thêm mã `subject` vào bộ chọn môn (`apps/web/lib/api.ts` → `type Subject`, và
subject-picker). Toán/Anh đã live; môn mới thêm mã tương ứng (vd `"GDKTPL"`).

> Ghi chú: engine (chat-turn, diagnose, thang Socratic, rubric theo kỹ năng) đã
> **agnostic theo môn** — không cần sửa gì thêm; có version published + câu active
> là học được ngay.
