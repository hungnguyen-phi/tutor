-- Đ2 — GIÁO VIÊN ĐÍNH TỆP VÀO LỜI NHẮN KHI CHẤM BÀI
--
-- Vì sao: người thử 2 đề nghị "cho giáo viên gửi kèm tệp/ảnh chữa bài". Hiện
-- giáo viên chấm xong chỉ gõ được `teacher_note` (chữ, 500 ký tự). Bài toán có
-- hình vẽ thì chữ không nói hết — thầy cô muốn gửi lại tờ giấy đã chữa tay.
--
-- Cách làm bám đúng lối đang chạy cho bài nộp của học sinh (nop-bai.sql) và
-- học liệu giáo viên (hoc-lieu-giao-vien.sql):
--   · thêm MỘT cột đường dẫn trên `submissions`
--   · bucket vẫn PRIVATE, KHÔNG có policy đọc — mọi lượt xem đi qua edge
--     function ký link 1 giờ (learning-path ký cho học sinh)
--   · ghi thì chặn theo bucket + prefix + vai
--
-- Chạy: node packages/db/run-sql.mjs packages/db/2026-07-29-tep-dinh-kem-loi-nhan-gv.sql
-- (thêm --dry để xem trước). Chạy lại nhiều lần vô hại.

-- ── 1) Cột đường dẫn tệp chữa bài ─────────────────────────────────────────
-- Chỉ MỘT tệp mỗi bản nộp: thầy cô chữa lại bài nào thì gửi kèm tờ giấy đó.
-- Tên gốc nằm sẵn trong đường dẫn nên không cần cột tên riêng.
alter table submissions
  add column if not exists teacher_file_path text;

comment on column submissions.teacher_file_path is
  'Tệp thầy cô gửi kèm lời nhắn khi chấm (ảnh bài đã chữa tay…). Đường dẫn trong bucket private learning-assets, prefix cham-bai/<tenant>/<giáo viên>/. Xem qua link ký 1 giờ, không mở thẳng.';

-- ── 2) Giáo viên được GHI vào cham-bai/<trường>/<giáo viên>/… ─────────────
-- Chặn theo cả trường lẫn người như policy bài làm học sinh: sửa tay đường dẫn
-- để đè tệp của đồng nghiệp là không được. ĐỌC vẫn KHÔNG có policy nào.
drop policy if exists teacher_note_file_insert on storage.objects;
create policy teacher_note_file_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'learning-assets'
    and (storage.foldername(name))[1] = 'cham-bai'
    and (storage.foldername(name))[2] = public.current_tenant_id()::text
    and (storage.foldername(name))[3] = auth.uid()::text
    and public.is_staff()
  );

-- Gỡ tệp đính nhầm trước khi bấm chấm.
drop policy if exists teacher_note_file_delete on storage.objects;
create policy teacher_note_file_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'learning-assets'
    and (storage.foldername(name))[1] = 'cham-bai'
    and (storage.foldername(name))[2] = public.current_tenant_id()::text
    and (storage.foldername(name))[3] = auth.uid()::text
    and public.is_staff()
  );

-- ── Kiểm sau khi chạy ─────────────────────────────────────────────────────
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'submissions'
       and column_name = 'teacher_file_path')                          as cot_moi_1,
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname in ('teacher_note_file_insert','teacher_note_file_delete')) as policy_2;
