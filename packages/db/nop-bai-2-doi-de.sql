-- ═══════════════════════════════════════════════════════════════════════════
-- LUỒNG NỘP BÀI — bước 2/2: ĐỔI CÂU SANG DẠNG NỘP BÀI
--
-- ⚠ CHẠY SAU CÙNG. Thứ tự bắt buộc:
--     1. node packages/db/run-sql.mjs packages/db/nop-bai.sql   (dựng khung)
--     2. git push  → web lên            (biết bày dạng nộp bài)
--     3. deploy chat-turn + diagnose    (biết nhận bài nộp)
--     4. file này
--   Chạy sớm hơn = học sinh gặp câu mà app chưa biết bày.
--
-- Cách đánh dấu: thêm nhãn "[NOPBAI] " vào đầu đề — ĐÚNG lối [WRITING]/[SPEAKING]
-- đã dùng sẵn. diagnose đọc nhãn → kind="nop_bai" rồi CẮT nhãn đi, học sinh không
-- thấy. Không đụng loai_danh_gia/dang_cau_hoi nên engine chọn câu vẫn chạy y cũ.
--
-- CHỌN CÂU NÀO: câu khách quan KHÔNG có phương án nào (⇒ app đang bắt gõ tay) mà
-- đáp án mẫu DÀI hơn ngưỡng dưới đây. Đo trên ngân hàng sống 27/07:
--     >120 ký tự → 352 câu | >160 → 323 câu | >200 → 289 câu | >260 → 221 câu
-- Đổi đúng MỘT số ở dòng `> 160` bên dưới nếu muốn rộng/hẹp hơn.
--
-- LÙI LẠI (nếu muốn trả về như cũ):
--     update questions set noi_dung = regexp_replace(noi_dung, '^\[NOPBAI\]\s*', '')
--     where noi_dung like '[NOPBAI]%';
-- ═══════════════════════════════════════════════════════════════════════════

update questions
set noi_dung = '[NOPBAI] ' || noi_dung
where trang_thai = 'active'
  and loai_danh_gia = 'objective'
  and coalesce(jsonb_array_length(distractors), 0) = 0
  and length(dap_an) > 160
  -- chưa mang nhãn nào (chạy lại lần hai là no-op)
  and noi_dung !~* '^\[(NOPBAI|WRITING|SPEAKING)\]';

-- Kiểm sau khi chạy:
select
  count(*) filter (where noi_dung like '[NOPBAI]%')                    as da_doi,
  count(*) filter (where noi_dung ~* '^\[(WRITING|SPEAKING)\]')        as dang_viet_noi,
  count(*)                                                            as tong_active
from questions where trang_thai = 'active';
