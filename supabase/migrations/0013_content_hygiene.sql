-- ─────────────────────────────────────────────────────────────────────────────
-- 0013 — Dọn 3 vật thể chết/lệch phát hiện qua audit 24/07 (xem chat + artifact
-- "Sổ đăng ký CSDL"). Không đổi hành vi phục vụ học sinh — chỉ dọn dữ liệu/schema
-- không còn ai đọc, và vá độ lệch giữa review_queue với trạng thái thật.
-- Idempotent: mọi bước chạy lại lần 2 đều vô hại (IF EXISTS / WHERE đã đúng).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A) mv_student_mastery — materialized view dựng ở 0008 để dashboard đọc
-- nhanh, nhưng dashboard(leadership/parent) đang tự COUNT trực tiếp trên
-- student_node_state (xem supabase/functions/dashboard/index.ts). Không nơi
-- nào đọc view này → xoá. (0 FK tham chiếu tới, xác nhận trước khi viết migration.)
drop materialized view if exists public.mv_student_mastery;

-- ── B) kg_tiers — từng được importer CŨ (packages/db/src/import-kg.ts, bản
-- Drizzle, KHÔNG phải supabase/functions/import-kg đang deploy) ghi vào để định
-- nghĩa 3 bậc Bloom/DOK riêng cho từng node. Importer đang chạy SỐNG không ghi
-- bảng này; runtime (diagnose/chat-turn) đọc tier thẳng từ questions.tier. Chỉ
-- còn 5 dòng seed cũ, không FK nào trỏ VÀO bảng này → xoá.
drop table if exists public.kg_tiers;

-- ── C) review_queue — đóng-lại các dòng ĐÃ ĐƯỢC KÍCH HOẠT THẬT nhưng còn kẹt
-- 'pending' vì trước đây được publish thẳng bằng SQL (bỏ qua teacher-review) và
-- vì re-key P3 (23/07) đổi node_key sang KC- mà KHÔNG cập nhật review_queue
-- (bảng nội bộ Tutor, ngoài phạm vi remap của Studio). Bắc cầu qua
-- kc_registry.vi_tri_trong_ct để nối content_id CŨ (TO10-/TA10-…) với node_key
-- MỚI (KC-…) rồi đối chiếu trạng thái thật.
--
-- Node: 3 nguồn dòng cần đóng — GDKTPL (khớp thẳng node_key mới), Toán 10 +
-- Tiếng Anh 10 (khớp qua kc_registry, vì content_id còn là mã cũ pre-re-key).
-- Toán 9 (211 dòng, content_id TO09-…) CỐ TÌNH không đụng — kg_nodes tương ứng
-- vẫn đang 'review' thật, không phải lệch.
update public.review_queue rq
   set status = 'approved', reviewed_at = now()
  from public.kg_nodes n
 where rq.content_type = 'node'
   and rq.status = 'pending'
   and n.node_key = rq.content_id            -- GDKTPL: content_id đã là KC- mới
   and n.status = 'active';

-- Bọc bảo vệ: `kc_registry` chỉ tồn tại ở DB CŨ (tạo ad-hoc, ngoài migration).
-- Nhà mới chưa có bảng này lúc 0013 chạy (0014 tạo sau) → bỏ qua nếu vắng.
-- plpgsql late-bind: nhánh không chạy thì câu tham chiếu kc_registry không parse.
do $$
begin
  if to_regclass('public.kc_registry') is not null then
    update public.review_queue rq
       set status = 'approved', reviewed_at = now()
      from public.kc_registry r
      join public.kg_nodes n on n.node_key = r.node_key
     where rq.content_type = 'node'
       and rq.status = 'pending'
       and r.vi_tri_trong_ct = rq.content_id   -- Toán 10 / Tiếng Anh 10: bắc cầu qua mã cũ
       and n.status = 'active';
  end if;
end $$;

-- Câu hỏi: content_id = questions.id (UUID, KHÔNG đổi qua re-key) → so trực tiếp.
update public.review_queue rq
   set status = 'approved', reviewed_at = now()
  from public.questions q
 where rq.content_type = 'question'
   and rq.status = 'pending'
   and q.id::text = rq.content_id
   and q.trang_thai = 'active';
