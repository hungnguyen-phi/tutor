-- Sửa "lộ đáp án": phương án ĐÚNG tự kèm lý do, các phương án nhiễu thì không.
-- Học sinh nhặt được đáp án mà không cần hiểu bài. Phần lý do KHÔNG mất đi —
-- nó vốn đã nằm trong loi_giai (hiện ra SAU khi học sinh trả lời).
-- Sinh tự động từ bản DB đọc lúc soạn; WHERE khớp nguyên văn nên chạy lại là no-op.

-- Q-0000133: «∀ ; P̄(x) (tức: ∀x ∈ D, không P(x))»  →  «∀ ; P̄(x)»
update questions set dap_an = '∀ ; P̄(x)' where question_key = 'Q-0000133' and dap_an = '∀ ; P̄(x) (tức: ∀x ∈ D, không P(x))';
-- Q-0000134: «'TỒN TẠI (ít nhất một) học sinh lớp 10A có điểm KHÔNG trên 5 (tức ≤ 5).'»  →  «'TỒN TẠI (ít nhất một) học sinh lớp 10A có điểm KHÔNG trên 5.'»
update questions set dap_an = '''TỒN TẠI (ít nhất một) học sinh lớp 10A có điểm KHÔNG trên 5.''' where question_key = 'Q-0000134' and dap_an = '''TỒN TẠI (ít nhất một) học sinh lớp 10A có điểm KHÔNG trên 5 (tức ≤ 5).''';
-- Q-0000571: «Chỉ cần kiểm góc ĐỐI DIỆN cạnh LỚN NHẤT — vì đó là góc lớn nhất.»  →  «Chỉ cần kiểm góc ĐỐI DIỆN cạnh LỚN NHẤT.»
update questions set dap_an = 'Chỉ cần kiểm góc ĐỐI DIỆN cạnh LỚN NHẤT.' where question_key = 'Q-0000571' and dap_an = 'Chỉ cần kiểm góc ĐỐI DIỆN cạnh LỚN NHẤT — vì đó là góc lớn nhất.';
-- Q-0001427: «y + 1 = 0 (tức y = -1)»  →  «y + 1 = 0»
update questions set dap_an = 'y + 1 = 0' where question_key = 'Q-0001427' and dap_an = 'y + 1 = 0 (tức y = -1)';
-- Q-0001428: «x + 2 = 0 (tức x = -2)»  →  «x + 2 = 0»
update questions set dap_an = 'x + 2 = 0' where question_key = 'Q-0001428' and dap_an = 'x + 2 = 0 (tức x = -2)';
-- Q-0001728: «24 (vì A(4,4) = 4! = 24)»  →  «24»
update questions set dap_an = '24' where question_key = 'Q-0001728' and dap_an = '24 (vì A(4,4) = 4! = 24)';
-- Q-0001746: «20 (vì C(6,3) = A(6,3)/3! = 120/6 = 20)»  →  «20»
update questions set dap_an = '20' where question_key = 'Q-0001746' and dap_an = '20 (vì C(6,3) = A(6,3)/3! = 120/6 = 20)';
-- Q-0000391 (đáp án nằm trong đề): cắt « (vì bờ KHÔNG thuộc miền nghiệm)»
update questions set noi_dung = 'Khi vẽ bờ của bất phương trình 2x + y < 5, ta vẽ đường thẳng 2x + y = 5 bằng: A. Nét ĐỨT B. Nét liền C. Nét liền, tô đậm D. Không cần vẽ đường thẳng' where question_key = 'Q-0000391' and noi_dung = 'Khi vẽ bờ của bất phương trình 2x + y < 5, ta vẽ đường thẳng 2x + y = 5 bằng: A. Nét ĐỨT (vì bờ KHÔNG thuộc miền nghiệm) B. Nét liền C. Nét liền, tô đậm D. Không cần vẽ đường thẳng';
-- Q-0000401 (đáp án nằm trong đề): cắt « (vì thay vào tính rất nhanh)»
update questions set noi_dung = 'Khi xác định miền nghiệm của bất phương trình ax + by ≤ c (với c ≠ 0), điểm thử ƯU TIÊN nên chọn là: A. Gốc toạ độ O(0; 0) B. Một điểm bất kì TRÊN đường thẳng bờ C. Điểm (1; 1) D. Giao điểm của bờ với trục Ox' where question_key = 'Q-0000401' and noi_dung = 'Khi xác định miền nghiệm của bất phương trình ax + by ≤ c (với c ≠ 0), điểm thử ƯU TIÊN nên chọn là: A. Gốc toạ độ O(0; 0) (vì thay vào tính rất nhanh) B. Một điểm bất kì TRÊN đường thẳng bờ C. Điểm (1; 1) D. Giao điểm của bờ với trục Ox';

-- Thiếu nhãn phương án trong distractors → app chỉ dựng đủ số nút CÓ nhãn,
-- phần còn lại của đề bị DÍNH vào nút cuối. Bổ sung nhãn còn thiếu.
-- Q-0000261: có 1 nhiễu [A] → thêm [C,D]
update questions set distractors = '[{"phuong_an":"A","quan_niem_sai":"Nhầm ∈ với ⊂ — đây là mô tả của ⊂"},{"phuong_an":"C","quan_niem_sai":"Nhầm ∈ là quan hệ giữa hai phần tử"},{"phuong_an":"D","quan_niem_sai":"Nghĩ ∈ chỉ dùng cho số"}]'::jsonb
  where question_key = 'Q-0000261' and jsonb_array_length(distractors) = 1;
-- Q-0000361: có 2 nhiễu [C,D] → thêm [B]
update questions set distractors = '[{"phuong_an":"C","quan_niem_sai":"Nghĩ giao hoán cần điều kiện — không hiểu đó là tính chất PHỔ QUÁT"},{"phuong_an":"D","quan_niem_sai":"Cùng lỗi trên"},{"phuong_an":"B","quan_niem_sai":"Cho rằng phép giao không giao hoán"}]'::jsonb
  where question_key = 'Q-0000361' and jsonb_array_length(distractors) = 2;

-- CHƯA sửa, cần tác giả quyết (script KHÔNG đụng tới):
--  · Q-0000658 «Cùng hướng (và cùng độ dài, tức là bằng nhau).» — cắt phần trong
--    ngoặc thì đáp án THIẾU (bằng nhau = cùng hướng + cùng độ dài). Gợi ý viết lại
--    thành «Bằng nhau» cho cân với ba nhiễu «Ngược hướng / Không cùng phương /
--    Vuông góc với nhau», rồi để phần giải thích trong loi_giai.
--  · ~16 câu dạng "tìm lỗi sai": mọi phương án đều là câu giải thích, nhưng phương
--    án ĐÚNG luôn dài nhất và chi tiết nhất → vẫn đoán được. Sửa là phải viết lại
--    cả bộ nhiễu cho cân, không cắt máy móc được.

-- Kiểm lại sau khi chạy:
select question_key, dap_an, jsonb_array_length(distractors) as so_nhieu
from questions where question_key in ('Q-0000133', 'Q-0000134', 'Q-0000571', 'Q-0001427', 'Q-0001428', 'Q-0001728', 'Q-0001746', 'Q-0000391', 'Q-0000401', 'Q-0000261', 'Q-0000361')
order by question_key;
