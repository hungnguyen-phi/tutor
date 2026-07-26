-- ═══════════════════════════════════════════════════════════════════════════
-- 7 CÂU TỪNG XẾP "CẦN STUDIO VIẾT LẠI" — sửa được bằng dữ liệu (2026-07-26)
--
-- Đọc kỹ từng câu thì mỗi câu chỉ sai MỘT chỗ cụ thể, không cần soạn lại đề:
--   · số ô trống không khớp số phần đáp án  → chỉnh đề hoặc chỉnh đáp án
--   · nhiễu là MÔ TẢ LỖI, không phải đáp án → bỏ nhiễu, chuyển thành câu MỞ
--   · nhiễu là cả một phương trình, ghép vào chỗ trống không thành câu → thay
--
-- Mọi phương án mới đã thử với CHÍNH bộ phân tích production
-- (supabase/functions/_shared/interactive.ts) trước khi viết vào đây.
--
-- CHẠY:  node packages/db/run-sql.mjs packages/db/fix-studio-7.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. 112b323e — 3 ô trống nhưng đáp án chỉ có 2 phần ────────────────────
-- "P(A) = ______ / ______" thực ra là MỘT ý ("n(A) / n(Ω)") bị cắt làm hai ô.
-- Gộp lại còn 2 ô cho khớp 2 phần. Kèm hạ IN HOA "ĐỒNG KHẢ NĂNG" vì mọi nhiễu
-- đều chữ thường → học sinh chọn được theo kiểu chữ.
UPDATE questions SET
  noi_dung = 'Điền: Định nghĩa cổ điển: P(A) = ______ , áp dụng khi các kết quả ______.',
  dap_an   = 'n(A) / n(Ω) ; đồng khả năng'
WHERE id = '112b323e-62dc-46e5-b858-d35db381250a';

-- ── 2. 304ac474 — 4 ô trống, đáp án trộn ";" lẫn "—" nên chỉ tách ra 3 phần ─
-- Chuẩn hoá đáp án thành 4 phần ngăn bằng ";". Bỏ nhiễu "đảo hai vế" (là CHỈ
-- DẪN, không phải đáp án, không ghép vào ô trống được) → câu thành điền 4 ô.
UPDATE questions SET
  dap_an      = 'phần tử ; tập hợp ; tập hợp ; tập hợp',
  distractors = '[]'::jsonb
WHERE id = '304ac474-edf7-495c-bd85-ea735f6af4af';

-- ── 3. c5a692be — thực chất là NỐI CỘT nhưng nhiễu là mảnh rời "1-b", "4-a" ─
-- Thử chuyển sang noi_cot thì mục cuối nuốt luôn cụm "Cột B: a) ∈ · b) ⊂".
-- Dạng điền-4-ô sạch hơn hẳn và giữ nguyên ý đồ sư phạm (chọn ∈ hay ⊂).
UPDATE questions SET
  noi_dung    = 'Cho A = {1;2;3}. Điền ∈ hoặc ⊂ vào mỗi chỗ trống: 1) 1 ___ A · 2) {1} ___ A · 3) {1;2} ___ A · 4) ∅ ___ A',
  dap_an      = '∈ ; ⊂ ; ⊂ ; ⊂',
  distractors = '[]'::jsonb
WHERE id = 'c5a692be-7a2a-4728-84ce-5045a8fbee57';

-- ── 4 & 5. Hai câu nhiều bước B1/B2/B3 — nhiễu là MÔ TẢ LỖI ───────────────
-- "B1 đếm 4", "B2 nói 'không, vì là tập'" không thể hiện thành nút bấm.
-- Đáp án đã là bài giải nhiều bước → đúng bản chất là câu MỞ. Bỏ nhiễu và bỏ
-- "___" khỏi đề để câu rơi vào nhánh chấm-bằng-mô-hình (so Ý, không so chữ).
UPDATE questions SET
  noi_dung      = 'Cho A = {1; 2; {3; 4}}. Quan hệ giữa {3;4} và A dùng kí hiệu ∈ hay ⊂? B1: Liệt kê PHẦN TỬ của A. B2: {3;4} có phải MỘT PHẦN TỬ của A không? B3: Kết luận kí hiệu.',
  dang_cau_hoi  = 'dien_dap_an',
  distractors   = '[]'::jsonb
WHERE id = '18e51813-7226-4c28-a823-ed5f4b2f1b2e';

UPDATE questions SET
  noi_dung      = 'Phân loại √2 và √4. B1: Tính √4 — là số gì? B2: √2 có viết được dạng m/n không? B3: Kết luận: √4 và √2 có thuộc ℚ không?',
  dang_cau_hoi  = 'dien_dap_an',
  distractors   = '[]'::jsonb
WHERE id = 'e006347d-5bbe-4929-9cf1-f9a85992be64';

-- ── 6. 59b7da71 (hypebol) — nhiễu "MF₁ + MF₂ = 2a" là cả một phương trình ──
-- Ghép vào chỗ trống ra "|MF₁ − MF₂| = MF₁ + MF₂ = 2a" (vô nghĩa). Thay bằng
-- "2b" — vẫn bắt đúng quan niệm sai. Đồng thời thống nhất cách viết ngoặc để
-- đáp án không nổi bật hơn nhiễu về hình thức.
UPDATE questions SET distractors = '[
  {"phuong_an": "2a (với 2a > F₁F₂)", "quan_niem_sai": "Điều kiện ngược — đó là điều kiện của ELIP; hypebol cần 2a < F₁F₂."},
  {"phuong_an": "2b", "quan_niem_sai": "b là bán trục ảo, không phải hằng số hiệu khoảng cách."},
  {"phuong_an": "2c", "quan_niem_sai": "2c là tiêu cự F₁F₂, không phải hằng số hiệu khoảng cách."}
]'::jsonb
WHERE id = '59b7da71-e5ee-4647-98ac-92d1e424e8c3';

-- ── 7. c385ef9a (elip) — nhiễu "|MF₁ - MF₂| = 2a" cũng là phương trình ─────
-- Thay bằng "2a (với 2a < F₁F₂)": chính là điều kiện của HYPEBOL → bắt đúng
-- quan niệm sai "lẫn elip với hypebol", mà vẫn ghép vừa chỗ trống.
UPDATE questions SET distractors = '[
  {"phuong_an": "2a (với 2a < F₁F₂)", "quan_niem_sai": "Đó là điều kiện của HYPEBOL; elip cần 2a > F₁F₂."},
  {"phuong_an": "2c", "quan_niem_sai": "2c là khoảng cách giữa hai tiêu điểm, không phải tổng khoảng cách."},
  {"phuong_an": "2b", "quan_niem_sai": "b là bán trục nhỏ, không xuất hiện trong định nghĩa elip."}
]'::jsonb
WHERE id = 'c385ef9a-286c-419c-8a99-299435dc2737';

-- ── 8. 140 CÂU có phương án nhiễu RÁC ("—") ───────────────────────────────
-- Phát hiện khi đo mẹo "chọn phương án dài nhất": nhóm lệch nhất có tỉ lệ
-- 1000× vì đáp án là bài luận 1000+ ký tự còn "nhiễu" chỉ là MỘT DẤU GẠCH.
-- Học sinh nhìn thấy hai nút — một đoạn văn dài và một dấu "—" — nên chọn
-- đúng 100% mà không cần đọc đề.
--
-- Thực chất đây là câu MỞ ("Một bạn hỏi: 'Tại sao…'"), đáp án dài 102–1126 ký
-- tự (trung vị 540). Vì CÓ distractor nên chúng KHÔNG lọt vào nhóm câu mở và
-- đang bị CAS so chữ chấm. Bỏ nhiễu rác → rơi đúng vào nhánh chấm-bằng-mô-hình.
--
-- Điều kiện dưới đây đã đối chiếu với DB sống: khớp ĐÚNG 140 hàng.
UPDATE questions SET
  distractors  = '[]'::jsonb,
  dang_cau_hoi = 'dien_dap_an'
WHERE trang_thai = 'active'
  AND jsonb_array_length(coalesce(distractors, '[]'::jsonb)) > 0
  AND length(dap_an) > 40
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(distractors) d
    WHERE btrim(coalesce(d->>'phuong_an', '')) !~ '^[—–.·…[:space:]-]*$'
  );

COMMIT;
