-- ═══════════════════════════════════════════════════════════════════════════
-- DỌN BẰNG CHỨNG MASTERY BỊ NHÂN BẢN QUA NHIỀU PHIÊN
--
-- Khoá chống trùng của mastery_evidence là (session_id, question_id) — chỉ dedup
-- TRONG một phiên. Làm lại CÙNG một câu ở phiên khác (mở lại bài hôm sau là một
-- phiên mới) đẻ thêm một dòng "đúng, câu đích" nữa của CHÍNH câu đó. Hệ quả:
--   · một câu duy nhất làm 3 lần tự thoả luật mastery (3 đúng trong cửa sổ 4);
--   · giáo viên chấm "làm lại" chỉ lật được dòng của phiên mới nhất — dòng cũ
--     vẫn giữ node xanh.
-- Từ nay chat-turn/teacher-grading dọn dòng cũ ngay khi ghi (MỘT câu = MỘT bằng
-- chứng). File này dọn phần đã lỡ sinh ra TRƯỚC bản vá.
--
-- Đo trên prod 27/07: 12 cặp (học sinh, câu) trùng → 25 dòng thừa, tất cả thuộc
-- ĐÚNG MỘT tài khoản (tài khoản thử) — không đụng dữ liệu học sinh thật.
--
--     node packages/db/run-sql.mjs packages/db/don-bang-chung-trung.sql --dry
--     node packages/db/run-sql.mjs packages/db/don-bang-chung-trung.sql
-- Idempotent: chạy lại lần hai là no-op.
-- ═══════════════════════════════════════════════════════════════════════════

-- Giữ dòng MỚI NHẤT của mỗi (học sinh, câu); xoá các dòng cũ hơn.
delete from mastery_evidence e
using (
  select id,
         row_number() over (
           partition by student_id, question_id
           order by created_at desc, id desc
         ) as rn
  from mastery_evidence
) t
where t.id = e.id and t.rn > 1;

-- student_node_state tự tính lại ở lượt trả lời kế tiếp của học sinh; nếu muốn
-- ép về đúng ngay, mở lại bài đó một lần là xong (không cần sửa tay bảng state).

-- Kiểm sau khi chạy — phải ra 0:
select count(*) as con_cap_trung from (
  select student_id, question_id
  from mastery_evidence
  group by 1, 2
  having count(*) > 1
) x;
