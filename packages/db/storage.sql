-- Storage: bucket 'learning-assets' cho học liệu xuất từ Studio
-- (docs/INTEGRATION-STUDIO.md §6.2). Áp SAU rls.sql qua apply-sql.ts.
--
-- Bucket PRIVATE, chỉ-signed-URL phía ĐỌC: client KHÔNG BAO GIỜ đọc thẳng
-- storage.objects. Mọi truy cập đọc đi qua Edge Function `resources` — service
-- role ký URL 1 giờ (createSignedUrl) SAU KHI đã kiểm JWT + tenant. Vì thế
-- KHÔNG có policy SELECT nào cho việc đọc học liệu.
--
-- Phía GHI: Studio (đăng nhập bằng tài khoản teacher của tutor) được upload
-- học liệu đã duyệt chuẩn trường vào ĐÚNG prefix studio/* — cần INSERT (tải
-- lần đầu) + UPDATE/SELECT (x-upsert: true = đè lên file cũ, giữ nguyên link).
-- Giới hạn: đúng bucket, đúng prefix, đúng vai staff (is_staff() từ rls.sql).
--
-- Idempotent: chạy lại nhiều lần không hỏng.

insert into storage.buckets (id, name, public)
values ('learning-assets', 'learning-assets', false)
on conflict (id) do nothing;

drop policy if exists studio_upload_insert on storage.objects;
create policy studio_upload_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'learning-assets'
    and name like 'studio/%'
    and public.is_staff()
  );

drop policy if exists studio_upload_update on storage.objects;
create policy studio_upload_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'learning-assets'
    and name like 'studio/%'
    and public.is_staff()
  )
  with check (
    bucket_id = 'learning-assets'
    and name like 'studio/%'
    and public.is_staff()
  );

-- SELECT hẹp cho upsert: storage-api cần đọc metadata object cũ trước khi đè.
-- Chỉ mở đúng prefix studio/* cho staff — học sinh/anon vẫn không đọc được gì.
drop policy if exists studio_upload_select on storage.objects;
create policy studio_upload_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'learning-assets'
    and name like 'studio/%'
    and public.is_staff()
  );
