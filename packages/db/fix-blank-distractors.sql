-- ═══════════════════════════════════════════════════════════════════════════
-- SỬA PHƯƠNG ÁN NHIỄU HỎNG — câu điền khuyết (rà 2026-07-26)
--
-- Rà 119 câu "có chỗ trống + có phương án nhiễu" trên DB sống (project
-- oonuzgnfoypibrssvmrt). 20 câu hỏng ở mức KHÔNG sửa được bằng code vì lỗi nằm
-- ở chính nội dung phương án. File này sửa 13 câu chắc chắn; 7 câu còn lại cần
-- Studio viết lại đề — liệt kê ở cuối, file KHÔNG đụng tới.
--
-- CHẠY: dán vào SQL editor của project, hoặc
--   psql "$DB_URL" -f packages/db/fix-blank-distractors.sql
-- An toàn: mỗi lệnh khoá theo UUID ĐẦY ĐỦ (đã kiểm mỗi id khớp đúng 1 hàng),
-- và set giá trị tuyệt đối nên chạy lại nhiều lần vẫn ra cùng kết quả.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── NHÓM 1: ghi chú soạn bài LỌT vào phương án học sinh nhìn thấy ──────────
-- Phương án chứa lời bình của người soạn → tự tố cáo nó là đáp án sai.

-- "A(x₀ - x) + B(y₀ - y) và cho là khác đáp án"  →  bỏ đuôi ghi chú
UPDATE questions SET distractors = '[
  {"phuong_an": "A(x + x₀) + B(y + y₀)", "quan_niem_sai": "Nhầm dấu: PTTQ dùng (x − x₀), không phải (x + x₀)."},
  {"phuong_an": "A(x₀ - x) + B(y₀ - y)", "quan_niem_sai": "Đảo chiều hiệu — đổi dấu cả vế, không còn dạng chuẩn."},
  {"phuong_an": "B(x - x₀) + A(y - y₀)", "quan_niem_sai": "Hoán vị nhầm A với B: hệ số phải khớp đúng toạ độ VTPT."}
]'::jsonb
WHERE id = '4fc06895-8d5d-4eaa-b2d8-1de4fc00aec4';

-- "A ⊂ B (lặp)"  →  chữ "(lặp)" nói thẳng cho học sinh biết đây là đáp án sai
UPDATE questions SET distractors = '[
  {"phuong_an": "A ⊂ B", "quan_niem_sai": "Lặp lại điều kiện đã cho — hai tập bằng nhau cần bao hàm CẢ HAI CHIỀU."}
]'::jsonb
WHERE id = 'e63ce4ef-1ab6-409c-8b8a-e1e897156e38';

-- "có (chứa)"  →  ghép vào ra "nửa mặt phẳng có (chứa) chứa điểm thử"
UPDATE questions SET distractors = '[
  {"phuong_an": "có", "quan_niem_sai": "Ngược: mệnh đề SAI nghĩa là điểm thử KHÔNG thuộc miền nghiệm."}
]'::jsonb
WHERE id = '7e9f4b20-18db-4539-9005-9c5340a8269c';

-- "gộp (hợp)"  →  bỏ gloss trong ngoặc
UPDATE questions SET distractors = '[
  {"phuong_an": "gộp", "quan_niem_sai": "Gộp là HỢP; miền nghiệm của HỆ là phần CHUNG (giao)."}
]'::jsonb
WHERE id = '87d9c33a-078f-4176-b2fd-fc945c527241';

-- ── NHÓM 2: ghép phương án vào chỗ trống thì KHÔNG thành câu tiếng Việt ────
-- Học sinh loại được đáp án sai chỉ bằng ngữ pháp, không cần hiểu Toán.

-- "Tập rỗng ∅ là tập con của ___ tập hợp."  ·  nhiễu "chính nó"
--   → "…là tập con của chính nó tập hợp." (sai ngữ pháp, loại ngay)
UPDATE questions SET distractors = '[
  {"phuong_an": "một số", "quan_niem_sai": "∅ là tập con của MỌI tập hợp, không phải chỉ một số tập."},
  {"phuong_an": "chỉ một", "quan_niem_sai": "Không phải chỉ một: ∅ ⊂ A đúng với mọi A."}
]'::jsonb
WHERE id = '19761632-d4ee-4c7e-9e95-445b4a9272a5';

-- "A ∩ B gồm các phần tử thuộc ___ hai tập A và B."  ·  nhiễu "ít nhất một"
--   → "…thuộc ít nhất một hai tập A và B." (thiếu "trong", sai ngữ pháp)
UPDATE questions SET distractors = '[
  {"phuong_an": "một trong", "quan_niem_sai": "Đó là HỢP (∪). Giao đòi phần tử thuộc CẢ HAI tập."}
]'::jsonb
WHERE id = 'dbc3050f-85e5-421f-ae67-710ff45490b9';

-- "a và b KHÔNG ___ bằng 0."  ·  nhiễu "cùng khác 0"
--   → "…KHÔNG cùng khác 0 bằng 0." (vô nghĩa)
UPDATE questions SET distractors = '[
  {"phuong_an": "cùng", "quan_niem_sai": "Gần đúng nhưng thiếu chặt — điều kiện là a, b không ĐỒNG THỜI bằng 0."},
  {"phuong_an": "đều", "quan_niem_sai": "«Không đều bằng 0» vẫn cho phép một hệ số bằng 0; phải nói ĐỒNG THỜI."}
]'::jsonb
WHERE id = 'feb29d0f-91f1-4f0a-b6fd-d5b374cf04d7';

-- "x ___ A và x ___ B"  ·  nhiễu "∈ B ; ∉ A" tự mang tên tập → "x ∈ B A"
UPDATE questions SET distractors = '[
  {"phuong_an": "∉ ; ∈", "quan_niem_sai": "Ngược chiều: muốn bác bỏ A ⊂ B phải tìm x THUỘC A mà KHÔNG thuộc B."},
  {"phuong_an": "∉ ; ∉", "quan_niem_sai": "x ngoài cả hai tập thì không kết luận được gì về A ⊂ B."}
]'::jsonb
WHERE id = '70a331e9-96f6-4ca4-b35f-b0449d4cd8d9';

-- ── NHÓM 3: chính ĐỀ tự lộ đáp án ─────────────────────────────────────────

-- "…ta lấy phần ___ (vùng mà cả hai đều tô)."  ← ngoặc nói toạc đáp án "chung"
UPDATE questions SET noi_dung = 'Để tìm GIAO của hai đoạn trên trục số, ta lấy phần ___ .'
WHERE id = '1d0513dc-8147-416f-b82d-2494f70b1a4b';

-- "…KHÔNG dùng ___ làm điểm thử, mà nên chọn (1; 0) hoặc (0; 1)."
--   ← đề nêu (1;0) là lựa chọn TỐT, trong khi (1;0) đang là phương án nhiễu
UPDATE questions SET noi_dung = 'Khi BPT có c = 0 (bờ đi qua gốc), ta KHÔNG dùng ___ làm điểm thử.'
WHERE id = '2c4b5d19-2ca5-43e2-b11d-c1c9c04abc79';

-- "…mang nội dung ___ (số học, hình học, đại số...)."  ← ngoặc lộ "toán học"
UPDATE questions SET noi_dung = 'Mệnh đề toán học là mệnh đề mang nội dung ___ .'
WHERE id = 'fa2f6c6a-cac5-484d-8f82-911a5f04aa0a';

-- ── NHÓM 4: mẹo hình thức — đáp án IN HOA còn mọi nhiễu chữ thường ─────────
-- Học sinh chọn theo KIỂU CHỮ chứ không theo kiến thức. Hạ về chữ thường.

UPDATE questions SET dap_an = 'tất cả'
WHERE id = '6a449b1f-40c2-4e0a-af99-02d980748128';   -- trước: "TẤT CẢ"

UPDATE questions SET dap_an = 'nửa chu vi'
WHERE id = '82e85903-2b60-46b5-93be-9d2cae8f9235';   -- trước: "NỬA chu vi"

COMMIT;

-- Kiểm nhanh sau khi chạy: cả 13 câu phải hiện ra, không câu nào còn ghi chú
-- soạn bài trong phương án.
-- SELECT id, dap_an, distractors FROM questions WHERE id IN (
--   '4fc06895-8d5d-4eaa-b2d8-1de4fc00aec4','e63ce4ef-1ab6-409c-8b8a-e1e897156e38',
--   '7e9f4b20-18db-4539-9005-9c5340a8269c','87d9c33a-078f-4176-b2fd-fc945c527241',
--   '19761632-d4ee-4c7e-9e95-445b4a9272a5','dbc3050f-85e5-421f-ae67-710ff45490b9',
--   'feb29d0f-91f1-4f0a-b6fd-d5b374cf04d7','70a331e9-96f6-4ca4-b35f-b0449d4cd8d9',
--   '1d0513dc-8147-416f-b82d-2494f70b1a4b','2c4b5d19-2ca5-43e2-b11d-c1c9c04abc79',
--   'fa2f6c6a-cac5-484d-8f82-911a5f04aa0a','6a449b1f-40c2-4e0a-af99-02d980748128',
--   '82e85903-2b60-46b5-93be-9d2cae8f9235');

-- ═══════════════════════════════════════════════════════════════════════════
-- CẦN STUDIO VIẾT LẠI ĐỀ — file này KHÔNG đụng tới (7 câu)
--
-- 18e51813-…  Nhiễu là MÔ TẢ LỖI ("B1 đếm 4", "B3 viết ⊂") chứ không phải đáp
--             án → không dựng thành nút được. Đề nhiều bước B1/B2/B3 nên chuyển
--             thành câu MỞ (bỏ hẳn distractors) hoặc tách thành 3 câu riêng.
-- e006347d-…  Như trên ("B1 nói vô tỉ", "B2 nói '√2 = 1,41 nên = 141/100'").
-- c5a692be-…  Thực chất là câu NỐI CỘT (Cột B: a) ∈ · b) ⊂) nhưng gắn nhãn điền
--             khuyết; nhiễu là mảnh rời "1-b", "4-a" → nên đổi sang noi_cot.
-- 304ac474-…  4 chỗ trống nhưng đáp án trộn cả ";" lẫn "—" nên tách ra 3 phần,
--             không khớp 4 ô; nhiễu "đảo hai vế" là chỉ dẫn, không phải đáp án.
-- 112b323e-…  3 chỗ trống, đáp án chỉ có 2 phần ("n(A) / n(Ω) ; ĐỒNG KHẢ NĂNG").
-- 59b7da71-…  Nhiễu "MF₁ + MF₂ = 2a" là cả một phương trình; ghép vào chỗ trống
-- c385ef9a-…  thành "|MF₁ − MF₂| = MF₁ + MF₂ = 2a". Hai câu elip/hypebol đối xứng.
-- ═══════════════════════════════════════════════════════════════════════════
