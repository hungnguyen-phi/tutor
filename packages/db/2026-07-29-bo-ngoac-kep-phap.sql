-- BỎ NGOẶC KÉP KIỂU PHÁP « » KHỎI NỘI DUNG HỌC SINH ĐỌC
--
-- Vì sao (chủ dự án yêu cầu 29/07): trên màn hình « » đọc ra thành "<<" và ">>",
-- trông như lỗi hiển thị. Đã dọn hết trong mã và chặn ở đường ra của AI
-- (_shared/llm.ts → rehydrate); còn lại là phần nằm trong DỮ LIỆU.
--
-- Rà toàn bộ nội dung học sinh đọc, chỉ thấy ĐÚNG MỘT chỗ:
--   questions.noi_dung     0     questions.dap_an   0
--   questions.loi_giai     0     kg_nodes.label     0
--   socratic_ladders       0     resources          0
--   questions.distractors  1  ← câu feb29d0f, node KC-9609209, đang hoạt động
-- Chuỗi dính là lời chẩn đoán quan niệm sai của một phương án nhiễu — học sinh
-- chọn đúng phương án đó là đọc thấy ngay.
--
-- Chạy: node packages/db/run-sql.mjs packages/db/2026-07-29-bo-ngoac-kep-phap.sql
-- (thêm --dry để xem trước). Chạy lại nhiều lần vô hại.

-- Đổi trên CHUỖI JSON rồi ép về jsonb: distractors là mảng object, sửa từng
-- phần tử bằng jsonb_set thì phải biết trước chỉ số và tên khoá. Cách này gọn
-- và đúng cho mọi hình dạng — replace chỉ đụng ĐÚNG hai ký tự đó, không ký tự
-- nào khác của JSON bị chạm (« » không nằm trong cú pháp JSON).
update questions
set distractors = replace(replace(distractors::text, '«', '"'), '»', '"')::jsonb
where distractors::text like '%«%' or distractors::text like '%»%';

-- Quét nốt các cột chữ khác cho chắc — hiện đếm ra 0, nhưng nội dung còn được
-- nạp thêm từ Xưởng nên để sẵn ở đây, chạy lại lúc nào cũng an toàn.
update questions set noi_dung = replace(replace(noi_dung, '«', '"'), '»', '"')
  where noi_dung like '%«%' or noi_dung like '%»%';
update questions set dap_an = replace(replace(dap_an, '«', '"'), '»', '"')
  where dap_an like '%«%' or dap_an like '%»%';
update questions set loi_giai = replace(replace(loi_giai, '«', '"'), '»', '"')
  where loi_giai like '%«%' or loi_giai like '%»%';
update kg_nodes set label = replace(replace(label, '«', '"'), '»', '"')
  where label like '%«%' or label like '%»%';

-- ── Kiểm sau khi chạy: cả bốn cột phải ra 0 ────────────────────────────────
select
  (select count(*) from questions where distractors::text like '%«%' or distractors::text like '%»%') as con_distractors,
  (select count(*) from questions where noi_dung like '%«%' or noi_dung like '%»%')                   as con_noi_dung,
  (select count(*) from questions where dap_an like '%«%' or dap_an like '%»%'
       or loi_giai like '%«%' or loi_giai like '%»%')                                                 as con_dap_an_loi_giai,
  (select count(*) from kg_nodes where label like '%«%' or label like '%»%')                          as con_nhan_bai;
