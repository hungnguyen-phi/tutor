-- ═══════════════════════════════════════════════════════════════════════════
-- LUỒNG NỘP BÀI — bước 1/2: DỰNG KHUNG (chưa đổi gì học sinh đang thấy)
--
-- Bối cảnh: 323 câu đang gắn nhãn "objective" nhưng đáp án mẫu là cả đoạn giải
-- thích (dài nhất 288 chữ) — bắt gõ vào ô một dòng là không làm nổi. Đổi sang:
-- học sinh làm ngoài (giấy hoặc Word), chụp/tải lên, tự bấm "đã nộp" để đi tiếp;
-- GIÁO VIÊN chấm sau. Mastery KHÔNG tự cộng khi bấm nộp — chỉ lên khi chấm ĐẠT.
--
-- Chạy file này TRƯỚC (an toàn tuyệt đối: chỉ thêm cột/kiểu/policy, không sửa
-- một câu hỏi nào):
--     node packages/db/run-sql.mjs packages/db/nop-bai.sql
-- File nop-bai-2-doi-de.sql (đổi 323 câu sang dạng nộp bài) chỉ chạy SAU KHI
-- web + edge function đã lên — chạy sớm là học sinh gặp câu app chưa biết bày.
-- Idempotent: chạy lại nhiều lần không hỏng.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) submissions nhận thêm dạng "tải tệp lên" (đang có: writing | speaking)
alter type submission_kind add value if not exists 'upload';

-- 2) trạng thái chấm của một bài nộp
do $$ begin
  create type submission_status as enum ('pending', 'passed', 'redo');
exception when duplicate_object then null; end $$;

-- 3) submissions: thêm chỗ chứa tệp + vết chấm của giáo viên.
--    node_key nằm ngay tại đây (không join sang questions) để lộ trình học vẽ
--    "bàn chân đỏ" chỉ bằng MỘT truy vấn.
alter table submissions
  add column if not exists node_key     text,
  add column if not exists file_path    text,
  add column if not exists mime         text,
  add column if not exists size_bytes   integer,
  add column if not exists status       submission_status not null default 'pending',
  add column if not exists teacher_note text,
  add column if not exists graded_by    uuid references profiles(id) on delete set null,
  add column if not exists graded_at    timestamptz;

-- Hàng đợi chấm của giáo viên: lọc theo trường + trạng thái, mới nhất trước.
create index if not exists submissions_grading_idx
  on submissions (tenant_id, status, created_at desc);
-- Lộ trình của học sinh: "bài nào bị trả về phải làm lại".
create index if not exists submissions_student_idx
  on submissions (student_id, status);

-- 4) Học sinh được GHI bài làm vào ĐÚNG thư mục của mình:
--        bai-lam/<tenant_id>/<student_id>/<tên tệp>
--    Chặn theo cả trường lẫn người: sửa tay đường dẫn để ghi đè bài bạn khác là
--    không được. ĐỌC vẫn KHÔNG có policy nào — mọi lượt xem đi qua edge function
--    ký link 1 giờ (đúng lối học liệu Xưởng đang dùng).
drop policy if exists student_work_insert on storage.objects;
create policy student_work_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'learning-assets'
    and (storage.foldername(name))[1] = 'bai-lam'
    and (storage.foldername(name))[2] = public.current_tenant_id()::text
    and (storage.foldername(name))[3] = auth.uid()::text
  );

-- Kiểm sau khi chạy:
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'submissions'
       and column_name in ('node_key','file_path','mime','size_bytes','status','teacher_note','graded_by','graded_at')) as cot_moi_8,
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects' and policyname = 'student_work_insert') as policy_1,
  (select string_agg(e.enumlabel, '|' order by e.enumsortorder)
     from pg_type t join pg_enum e on e.enumtypid = t.oid where t.typname = 'submission_kind') as submission_kind;
